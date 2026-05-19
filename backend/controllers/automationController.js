const automationService = require("../services/automationService");

function renderPopupScript(payload, targetOrigin) {
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; padding: 24px;">
    <p>Completing Facebook connection...</p>
    <script>
      (function () {
        var payload = ${serialized};
        if (window.opener) {
          window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
          window.close();
        } else {
          document.body.innerHTML = '<p>You can close this window and return to the CRM.</p>';
        }
      })();
    </script>
  </body>
</html>`;
}

const crypto = require("crypto");
const Automation = require("../models/Automation");

function generateWebsiteToken() {
  // 192 bits of entropy — URL-safe hex, no need for slice
  return "AW-" + crypto.randomBytes(24).toString("hex");
}

const automationController = {
  // GET /api/automations/website/connections — list all website automations (read-only)
  async getWebsiteToken(req, res) {
    try {
      const automations = await Automation.find({
        orgId: req.user.orgId,
        platform: "Website Form",
        isActive: true,
      }).sort({ createdAt: 1 });

      res.json({
        success: true,
        connections: automations.map((a) => ({
          id: a._id,
          name: a.name,
          token: a.verifyToken,
          status: a.status,
          lastSyncAt: a.lastSyncAt,
          siteUrl: a.siteUrl || "",
          siteName: a.siteName || "",
          connectedForms: a.connectedForms || [],
        })),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/automations/website/create — add a new website connection
  async createWebsiteConnection(req, res) {
    try {
      const { name } = req.body || {};
      const automation = await Automation.create({
        name: name || "New WordPress Site",
        platform: "Website Form",
        mode: "form",
        status: "draft",
        leadSourceLabel: "Website",
        webhookPath: "/webhook/website",
        verifyToken: generateWebsiteToken(),
        description: "Receives leads from WordPress contact forms via the Arthaleads plugin.",
        isActive: true,
        orgId: req.user.orgId,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      res.status(201).json({
        success: true,
        connection: {
          id: automation._id,
          name: automation.name,
          token: automation.verifyToken,
          status: automation.status,
          lastSyncAt: automation.lastSyncAt,
          siteUrl: "",
          siteName: "",
          connectedForms: [],
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async list(req, res, next) {
    try {
      const automations = await automationService.list(req.user.orgId);
      res.json({ success: true, automations });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const automation = await automationService.create(req.body, req.user);
      res.status(201).json({ success: true, automation });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const automation = await automationService.update(req.params.id, req.body, req.user);
      res.json({ success: true, automation });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await automationService.remove(req.params.id, req.user.orgId);
      res.json({ success: true, message: "Automation source removed successfully" });
    } catch (err) {
      next(err);
    }
  },

  async facebookConnect(req, res, next) {
    // Must set COOP before redirect — helmet's default COOP: same-origin
    // nullifies window.opener on the very first popup page load
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    try {
      // Cookie is sent automatically by browser for same-origin popup navigation;
      // fall back to query param for backward compatibility
      const rawToken = req.cookies?.crm_token || req.query.token || "";
      const user = await automationService.verifyPopupToken(rawToken);
      // Pass only userId — never embed the session token in the OAuth state (URL-visible)
      const state = automationService.createFacebookState({ userId: user._id.toString() });
      const authUrl = automationService.getFacebookAuthUrl(state);
      res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  },

  async facebookCallback(req, res) {
    const frontendOrigin = automationService.getFrontendOrigin();
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");

    try {
      const { code, state } = req.query;
      if (!code || !state) throw new Error("Missing Facebook callback data");

      const statePayload = automationService.verifyFacebookState(state);
      const { pages, freshToken } = await automationService.getFacebookConnectionData(code);

      console.log(`[facebookCallback] pages fetched: ${pages.length} | userId: ${statePayload.userId}`);
      pages.forEach(p => console.log(`  page: ${p.name} (${p.id}) | forms: ${p.forms?.length ?? 0} | ${JSON.stringify(p.forms?.map(f => f.name))}`));
      if (pages.length === 0) console.warn("[facebookCallback] WARNING: No pages returned — user may not have approved pages_show_list or has no admin pages");

      const sessionId = require("crypto").randomBytes(16).toString("hex");
      await automationService.storeOAuthResult(sessionId, { type: "success", pages, freshToken });
      return res.redirect(`${frontendOrigin}/fb-callback?session=${sessionId}`);
    } catch (err) {
      const sessionId = require("crypto").randomBytes(16).toString("hex");
      await automationService.storeOAuthResult(sessionId, { type: "error", message: err.message || "Facebook connection failed" });
      return res.redirect(`${frontendOrigin}/fb-callback?session=${sessionId}`);
    }
  },

  async getFacebookResult(req, res) {
    const { session } = req.query;
    if (!session) return res.status(400).json({ error: "Missing session" });
    const result = await automationService.getOAuthResult(session);
    if (!result) return res.status(404).json({ error: "Session not found or expired" });
    return res.json(result);
  },
};

module.exports = automationController;
