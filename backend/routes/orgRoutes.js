const express = require("express");
const Organization = require("../models/Organization");
const { protect, authorize, invalidateOrgCache } = require("../middlewares/auth");

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

// PATCH /api/org/me/profile - update org contact & billing details (admin only)
router.patch("/me/profile", authorize("admin"), async (req, res, next) => {
  try {
    const ALLOWED = ["phone","email","address","gstNo","pan","cin","rera",
                     "bankAccountName","bankAccountNo","bankIfsc","bankName","bankBranch"];
    const update = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: "No valid fields provided." });
    }
    const org = await Organization.findByIdAndUpdate(
      req.orgId, { $set: update }, { new: true, runValidators: false }
    );
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    invalidateOrgCache(req.orgId);
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
        bufferMinutes:  s.bufferMinutes  ?? 15,
        halfDayMinutes: s.halfDayMinutes ?? 240,
        fullDayMinutes: s.fullDayMinutes ?? 480,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /api/org/me/attendance-settings — update shift/attendance config (admin only)
router.patch("/me/attendance-settings", authorize("admin"), async (req, res, next) => {
  try {
    const { shiftStartTime, bufferMinutes, halfDayMinutes, fullDayMinutes } = req.body;
    const update = {};
    if (shiftStartTime)    update["attendanceSettings.shiftStartTime"] = shiftStartTime;
    if (bufferMinutes  != null) update["attendanceSettings.bufferMinutes"]  = Math.max(0, parseInt(bufferMinutes));
    if (halfDayMinutes != null) update["attendanceSettings.halfDayMinutes"] = Math.max(1, parseInt(halfDayMinutes));
    if (fullDayMinutes != null) update["attendanceSettings.fullDayMinutes"] = Math.max(1, parseInt(fullDayMinutes));

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

module.exports = router;
