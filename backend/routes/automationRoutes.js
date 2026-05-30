const express = require("express");
const automationController = require("../controllers/automationController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { createAutomationSchema, updateAutomationSchema } = require("../validations/schemas");
const Automation = require("../models/Automation");
const { refreshFacebookTokens } = require("../utils/scheduler");

const router = express.Router();

// Public OAuth endpoints (Facebook initiates/redirects here - no auth cookie possible)
router.get("/facebook/connect", automationController.facebookConnect);
router.get("/facebook/callback", automationController.facebookCallback);

router.use(protect, authorize("admin", "manager"));

// Protected: only authenticated admin/manager can read the OAuth result
router.get("/facebook/result",                  automationController.getFacebookResult);
router.post("/facebook/verify-system-token",    automationController.verifySystemToken);

router.get("/website/token", automationController.getWebsiteToken);
router.post("/website/create", automationController.createWebsiteConnection);

router.route("/")
  .get(automationController.list)
  .post(validate(createAutomationSchema), automationController.create);

router.route("/:id")
  .patch(validate(updateAutomationSchema), automationController.update)
  .delete(automationController.remove);

// POST /api/automations/facebook/refresh-tokens
// Manually trigger the Facebook token refresh for all automations in this org.
// Returns which automations were refreshed and their new expiry dates.
router.post("/facebook/refresh-tokens", protect, authorize("admin", "manager", "super_admin"), async (req, res, next) => {
  try {
    if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) {
      return res.status(500).json({ success: false, message: "Facebook app credentials not configured on the server." });
    }

    const META_GRAPH_VERSION = "v23.0";
    const { automationId } = req.body;

    // If a specific automation ID is provided (per-card refresh), look up by _id only.
    // This works for super_admin viewing other orgs' automations.
    // Otherwise fall back to all active Facebook automations for the caller's org.
    const query = automationId
      ? { _id: automationId, platform: "Facebook", isActive: true, userToken: { $exists: true, $ne: "" } }
      : { orgId: req.user.orgId, platform: "Facebook", isActive: true, userToken: { $exists: true, $ne: "" } };

    const automations = await Automation.find(query);

    if (!automations.length) {
      return res.status(400).json({ success: false, message: "No connected Facebook automations found for this organization." });
    }

    const results = [];
    for (const auto of automations) {
      try {
        const params = new URLSearchParams({
          grant_type:        "fb_exchange_token",
          client_id:         process.env.FB_APP_ID,
          client_secret:     process.env.FB_APP_SECRET,
          fb_exchange_token: auto.userToken,
        });
        const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`);
        const json = await resp.json();

        if (!json.access_token) {
          results.push({ name: auto.name, status: "failed", reason: json.error?.message || "No token returned" });
          continue;
        }

        const freshUserToken = json.access_token;
        const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        const updates = { userToken: freshUserToken, userTokenExpiresAt: expiresAt, tokenRefreshedAt: new Date() };

        // Also refresh page token
        if (auto.pageId) {
          const pp = new URLSearchParams({ access_token: freshUserToken, fields: "access_token" });
          const pr = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${auto.pageId}?${pp.toString()}`);
          const pj = await pr.json();
          if (pj.access_token) updates.accessToken = pj.access_token;
        }

        await Automation.findByIdAndUpdate(auto._id, updates);
        results.push({ name: auto.name, status: "ok", expiresAt });
      } catch (err) {
        results.push({ name: auto.name, status: "failed", reason: err.message });
      }
    }

    const allOk = results.every((r) => r.status === "ok");
    res.json({
      success: allOk,
      message: allOk
        ? `All ${results.length} Facebook token(s) refreshed — valid for 60 more days.`
        : `${results.filter(r => r.status === "ok").length}/${results.length} token(s) refreshed. Check failed ones.`,
      results,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
