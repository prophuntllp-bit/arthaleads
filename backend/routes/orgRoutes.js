const express = require("express");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { protect, authorize, invalidateOrgCache } = require("../middlewares/auth");
const { uploadOrgLogo, deleteOrgLogo } = require("../utils/upload");

const router = express.Router();

router.use(protect);

// GET /api/org/me - current org details
router.get("/me", async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    res.json({ success: true, org });
  } catch (err) { next(err); }
});

// PUT /api/org/me - update org name/industry (admin only)
router.put("/me", authorize("admin"), async (req, res, next) => {
  try {
    const { name, industry } = req.body;
    const org = await Organization.findById(req.orgId);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    if (name) org.name = name;
    if (industry) org.industry = industry;
    await org.save();
    invalidateOrgCache(req.orgId); // bust cache so next request sees updated name/industry
    res.json({ success: true, org });
  } catch (err) { next(err); }
});

// POST /api/org/me/onboarding — first-run setup wizard (admin only)
// Saves org business details + user personal profile in one shot and marks
// onboarding complete so the blocking gate dismisses permanently.
router.post("/me/onboarding", authorize("admin"), async (req, res, next) => {
  try {
    const {
      name, industry, companySize, phone, email, city, address,
      gstNo, pan, rera,
      fullName, personalPhone,
    } = req.body;

    // Build org update — only touch fields that were actually sent
    const orgUpdate = { onboardingCompletedAt: new Date() };
    if (name)        orgUpdate.name        = name.trim();
    if (industry)    orgUpdate.industry    = industry;
    if (companySize) orgUpdate.companySize = companySize;
    if (phone)       orgUpdate.phone       = phone.trim();
    if (email)       orgUpdate.email       = email.trim();
    if (city)        orgUpdate.city        = city.trim();
    if (address)     orgUpdate.address     = address.trim();
    if (gstNo)       orgUpdate.gstNo       = gstNo.trim().toUpperCase();
    if (pan)         orgUpdate.pan         = pan.trim().toUpperCase();
    if (rera)        orgUpdate.rera        = rera.trim();

    const org = await Organization.findByIdAndUpdate(
      req.orgId, { $set: orgUpdate }, { new: true, runValidators: true }
    );
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    invalidateOrgCache(req.orgId);

    // Update the admin's personal profile
    const userUpdate = {};
    if (fullName)     userUpdate.name  = fullName.trim();
    if (personalPhone) userUpdate.phone = personalPhone.trim();
    const user = Object.keys(userUpdate).length
      ? await User.findByIdAndUpdate(req.user._id, { $set: userUpdate }, { new: true })
      : await User.findById(req.user._id);

    res.json({ success: true, org, user });
  } catch (err) { next(err); }
});

// PATCH /api/org/me/auto-assign - toggle round-robin auto-assignment (admin + super_admin)
router.patch("/me/auto-assign", authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const { autoAssign } = req.body;
    if (typeof autoAssign !== "boolean") {
      return res.status(400).json({ success: false, message: "autoAssign must be true or false" });
    }
    const org = await Organization.findByIdAndUpdate(
      req.orgId,
      { autoAssign },
      { new: true }
    );
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    invalidateOrgCache(req.orgId); // bust cache after update
    res.json({
      success: true,
      autoAssign: org.autoAssign,
      message: `Auto-assignment ${org.autoAssign ? "enabled" : "disabled"}`,
    });
  } catch (err) { next(err); }
});

// GET /api/org/me/attendance-settings — read shift/attendance config
router.get("/me/attendance-settings", async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId).select("attendanceSettings").lean();
    const s = org?.attendanceSettings || {};
    res.json({
      success: true,
      settings: {
        shiftStartTime: s.shiftStartTime || "09:30",
        shiftEndTime:   s.shiftEndTime   || "19:00",
        bufferMinutes:  s.bufferMinutes  ?? 15,
        halfDayMinutes: s.halfDayMinutes ?? 240,
        fullDayMinutes: s.fullDayMinutes ?? 480,
        requireSelfie:  s.requireSelfie  ?? true,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /api/org/me/attendance-settings — update shift/attendance config (admin only)
router.patch("/me/attendance-settings", authorize("admin"), async (req, res, next) => {
  try {
    const { shiftStartTime, shiftEndTime, bufferMinutes, halfDayMinutes, fullDayMinutes, requireSelfie } = req.body;
    const update = {};
    if (shiftStartTime)    update["attendanceSettings.shiftStartTime"] = shiftStartTime;
    if (shiftEndTime)      update["attendanceSettings.shiftEndTime"]   = shiftEndTime;
    if (bufferMinutes  != null) update["attendanceSettings.bufferMinutes"]  = Math.max(0, parseInt(bufferMinutes));
    if (halfDayMinutes != null) update["attendanceSettings.halfDayMinutes"] = Math.max(1, parseInt(halfDayMinutes));
    if (fullDayMinutes != null) update["attendanceSettings.fullDayMinutes"] = Math.max(1, parseInt(fullDayMinutes));
    if (requireSelfie  != null) update["attendanceSettings.requireSelfie"]  = Boolean(requireSelfie);

    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: "No valid fields provided." });
    }

    const org = await Organization.findByIdAndUpdate(
      req.orgId, { $set: update }, { new: true, runValidators: false }
    ).select("attendanceSettings");

    invalidateOrgCache(req.orgId);
    res.json({ success: true, settings: org.attendanceSettings });
  } catch (err) { next(err); }
});

// PATCH /api/org/me/logo — upload org logo (admin only); tries Cloudinary, falls back to base64
router.patch("/me/logo", authorize("admin"), async (req, res, next) => {
  try {
    const { logo } = req.body;
    if (logo === undefined) return res.status(400).json({ success: false, message: "logo field is required." });

    let logoUrl = "";
    if (logo !== "") {
      const isBase64 = logo.startsWith("data:image/");
      const isUrl    = logo.startsWith("https://") || logo.startsWith("http://");
      if (!isBase64 && !isUrl) return res.status(400).json({ success: false, message: "logo must be a data-URI or HTTPS URL." });

      if (isBase64) {
        try {
          logoUrl = await uploadOrgLogo(logo, req.orgId.toString());
        } catch {
          logoUrl = logo; // Cloudinary not configured — store base64 directly
        }
      } else {
        logoUrl = logo;
      }
    } else {
      deleteOrgLogo(req.orgId.toString()); // fire-and-forget
    }

    const org = await Organization.findByIdAndUpdate(
      req.orgId, { logo: logoUrl }, { new: true }
    );
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });
    invalidateOrgCache(req.orgId);
    res.json({ success: true, org });
  } catch (err) { next(err); }
});

// PATCH /api/org/me/billing — save invoice letterhead / billing details (admin only)
router.patch("/me/billing", authorize("admin"), async (req, res, next) => {
  try {
    const ALLOWED = ["address","phone","email","gstNo","pan","cin","rera",
                     "bankAccountName","bankAccountNo","bankIfsc","bankName","bankBranch"];
    const update = {};
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) update[k] = String(req.body[k]).trim();
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: "No valid fields provided." });
    }
    const org = await Organization.findByIdAndUpdate(
      req.orgId, { $set: update }, { new: true, runValidators: false }
    );
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });
    invalidateOrgCache(req.orgId);
    res.json({ success: true, org });
  } catch (err) { next(err); }
});

// PATCH /api/org/me/goal — set monthly closing goal (admin + manager)
router.patch("/me/goal", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const goal = parseInt(req.body.monthlyClosingGoal, 10);
    if (isNaN(goal) || goal < 1) {
      return res.status(400).json({ success: false, message: "Goal must be a positive number" });
    }
    const org = await Organization.findByIdAndUpdate(
      req.orgId,
      { monthlyClosingGoal: goal },
      { new: true }
    );
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    invalidateOrgCache(req.orgId);
    res.json({ success: true, monthlyClosingGoal: org.monthlyClosingGoal });
  } catch (err) { next(err); }
});

// POST /api/org/me/qr-token — generate / regenerate org-level QR token (admin only)
router.post("/me/qr-token", authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const crypto = require("crypto");
    const token = crypto.randomBytes(16).toString("hex");
    const org = await Organization.findByIdAndUpdate(req.orgId, { qrToken: token }, { new: true });
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    res.json({ success: true, qrToken: org.qrToken });
  } catch (err) { next(err); }
});

// GET /api/org/me/qr-token — fetch current org QR token (admin/manager)
router.get("/me/qr-token", authorize("admin", "manager", "super_admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId).select("qrToken").lean();
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    res.json({ success: true, qrToken: org.qrToken || "" });
  } catch (err) { next(err); }
});

// POST /api/org/me/voice-key — generate / rotate per-org Voice API key (admin only)
// The returned key is the one to configure in the telephony provider (e.g. EnableX).
router.post("/me/voice-key", authorize("admin"), async (req, res, next) => {
  try {
    const crypto = require("crypto");
    const voiceApiKey = "vk_" + crypto.randomBytes(24).toString("hex");
    const org = await Organization.findByIdAndUpdate(req.orgId, { voiceApiKey }, { new: true });
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    res.json({ success: true, voiceApiKey: org.voiceApiKey });
  } catch (err) { next(err); }
});

// GET /api/org/me/voice-key — fetch current Voice API key (admin only, masked)
router.get("/me/voice-key", authorize("admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId).select("voiceApiKey").lean();
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    const key = org.voiceApiKey || "";
    // Return masked key: show prefix + last 4 chars only
    const masked = key.length > 8 ? key.slice(0, 6) + "****" + key.slice(-4) : (key ? "****" : "");
    res.json({ success: true, voiceApiKey: masked, isConfigured: !!key });
  } catch (err) { next(err); }
});

// ── Support Access (org admin side) ──────────────────────────────────────────

// GET /api/org/support-access — list all access requests for this org
router.get("/support-access", authorize("admin"), async (req, res, next) => {
  try {
    const SupportAccess = require("../models/SupportAccess");
    const records = await SupportAccess.find({ orgId: req.orgId })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, records });
  } catch (err) { next(err); }
});

// POST /api/org/support-access/:id/respond — approve or deny a pending request
router.post("/support-access/:id/respond", authorize("admin"), async (req, res, next) => {
  try {
    const SupportAccess = require("../models/SupportAccess");
    const { action } = req.body; // "approve" | "deny"
    if (!["approve", "deny"].includes(action)) return res.status(400).json({ success: false, message: "Invalid action" });

    const record = await SupportAccess.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: "Request not found" });
    if (String(record.orgId) !== String(req.orgId)) return res.status(403).json({ success: false, message: "Forbidden" });
    if (record.status !== "pending") return res.status(400).json({ success: false, message: "Request already resolved" });

    record.status = action === "approve" ? "approved" : "denied";
    record.resolvedAt = new Date();
    record.seenByOrgAdmin = true;
    await record.save();

    // Notify super admin via push
    const { sendPushToUser } = require("../utils/push");
    sendPushToUser(record.requestedBy, {
      title: action === "approve" ? "Access Approved" : "Access Denied",
      body:  action === "approve"
        ? `${req.user.name} approved your support access request. You can now enter the session.`
        : `${req.user.name} denied your support access request.`,
      data:  { type: "support_access_response", requestId: String(record._id), action },
    }).catch(() => {});

    res.json({ success: true, status: record.status });
  } catch (err) { next(err); }
});

// POST /api/org/support-access/end-session — org admin ends active support session
router.post("/support-access/end-session", authorize("admin"), async (req, res, next) => {
  try {
    const SupportAccess = require("../models/SupportAccess");
    await Organization.findByIdAndUpdate(req.orgId, {
      "activeSupportSession.active":    false,
      "activeSupportSession.startedAt": null,
    });
    await SupportAccess.updateMany(
      { orgId: req.orgId, status: "active" },
      { status: "completed", endedAt: new Date() }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
