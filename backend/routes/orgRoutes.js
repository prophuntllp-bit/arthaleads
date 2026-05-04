const express = require("express");
const Organization = require("../models/Organization");
const { protect, authorize } = require("../middlewares/auth");

const router = express.Router();

router.use(protect);

// GET /api/org/me — current org details
router.get("/me", async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    res.json({ success: true, org });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/org/me — update org name/industry (admin only)
router.put("/me", authorize("admin"), async (req, res) => {
  try {
    const { name, industry } = req.body;
    const org = await Organization.findById(req.orgId);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });
    if (name) org.name = name;
    if (industry) org.industry = industry;
    await org.save();
    res.json({ success: true, org });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/org/me/auto-assign — toggle round-robin auto-assignment (admin only)
router.patch("/me/auto-assign", authorize("admin"), async (req, res) => {
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
    res.json({
      success: true,
      autoAssign: org.autoAssign,
      message: `Auto-assignment ${org.autoAssign ? "enabled" : "disabled"}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
