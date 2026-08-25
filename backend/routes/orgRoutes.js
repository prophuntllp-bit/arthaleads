const express = require("express");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { protect, authorize, invalidateOrgCache } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
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
// "Auto round-robin lead assignment" is a Growth feature.
router.patch("/me/auto-assign", planGate("growth"), authorize("admin", "super_admin"), async (req, res, next) => {
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

// GET /api/org/seats — how many members the org may have, and how many it has.
// Backs the seat meter on the Team page. Deliberately readable by any signed-in
// member: an agent seeing "6 of 10 seats used" is harmless, and hiding it would
// mean the Add button's disabled state has no explanation.
router.get("/seats", async (req, res, next) => {
  try {
    const { seatLimitFor } = require("../constants/planPricing");
    const org = await Organization.findById(req.orgId).select("plan seats paidUntil").lean();
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });

    const used  = await User.countDocuments({ orgId: req.orgId, isActive: true });
    const limit = seatLimitFor(org.plan, org.seats);   // null = unlimited

    res.json({
      success: true,
      seats: {
        used,
        limit,                                   // null on Enterprise
        remaining: limit === null ? null : Math.max(0, limit - used),
        canAdd: limit === null || used < limit,
        // True when the ceiling is the number of seats bought rather than the
        // plan's own maximum — the Team page uses this to offer "buy more
        // seats" instead of "upgrade plan".
        cappedByPurchase: Boolean(org.seats) && limit === org.seats,
        plan: org.plan,
        purchased: org.seats ?? null,
        paidUntil: org.paidUntil ?? null,
      },
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
// Also carries the organisation's display name - same "identity" section on the
// frontend as the logo, editable by whoever runs the account (rebrand, client
// handoff, etc.) rather than being fixed at signup.
router.patch("/me/billing", authorize("admin"), async (req, res, next) => {
  try {
    const ALLOWED = ["name","address","phone","email","gstNo","pan","cin","rera",
                     "bankAccountName","bankAccountNo","bankIfsc","bankName","bankBranch"];
    const update = {};
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) update[k] = String(req.body[k]).trim();
    }
    if (update.name !== undefined && (update.name.length < 2 || update.name.length > 100)) {
      return res.status(400).json({ success: false, message: "Organisation name must be 2-100 characters." });
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

// GET /api/org/support-access — when Arthaleads support accessed this account.
//
// Support access happens through super-admin impersonation, which already
// writes an AuditLog entry ("impersonate", targetOrg, performedByName). This
// surfaces that history to the organisation itself, so access to their data is
// visible to them rather than only to us.
//
// Read-only by design: there is no request/approve workflow behind it. The
// mobile Settings screen previously rendered pending/approve/deny controls for
// this endpoint, which never existed on the server — the call 404'd, the error
// was swallowed, and the section sat permanently empty. The controls have been
// removed rather than faked.
router.get("/support-access", authorize("admin", "manager", "super_admin"), async (req, res, next) => {
  try {
    const AuditLog = require("../models/AuditLog");
    const entries = await AuditLog.find({ action: "impersonate", targetOrg: req.orgId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("performedByName targetUserName createdAt details")
      .lean();

    res.json({
      success: true,
      records: entries.map((e) => ({
        _id: String(e._id),
        accessedByName: e.performedByName || "Arthaleads Support",
        accessedAs: e.targetUserName || "",
        at: e.createdAt,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
