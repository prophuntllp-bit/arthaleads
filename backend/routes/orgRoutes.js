const express = require("express");
const Organization = require("../models/Organization");
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
        requireSelfie:  s.requireSelfie  ?? false,
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

module.exports = router;
