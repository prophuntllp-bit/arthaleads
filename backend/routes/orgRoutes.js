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

module.exports = router;
