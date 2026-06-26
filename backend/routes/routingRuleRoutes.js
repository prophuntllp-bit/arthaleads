const express = require("express");
const RoutingRule = require("../models/RoutingRule");
const User = require("../models/User");
const { protect, authorize } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");

const router = express.Router();

router.use(protect, planGate("growth"), authorize("admin", "manager"));

// GET /api/routing-rules
router.get("/", async (req, res) => {
  try {
    const rules = await RoutingRule.find({ orgId: req.orgId }).sort({ createdAt: -1 });
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/routing-rules
router.post("/", async (req, res) => {
  try {
    const { label, matchField, matchValue, assignTo } = req.body;
    if (!label || !matchValue || !assignTo) {
      return res.status(400).json({ success: false, message: "label, matchValue and assignTo are required" });
    }
    const agent = await User.findOne({ _id: assignTo, orgId: req.orgId }).select("_id name");
    if (!agent) return res.status(404).json({ success: false, message: "Agent not found" });

    const rule = await RoutingRule.create({
      label,
      matchField: matchField || "form_id",
      matchValue,
      assignTo: agent._id,
      assignToName: agent.name,
      isActive: true,
      orgId: req.orgId,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/routing-rules/:id  (toggle active)
router.patch("/:id", async (req, res) => {
  try {
    const rule = await RoutingRule.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    if (req.body.isActive !== undefined) rule.isActive = req.body.isActive;
    await rule.save();
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/routing-rules/:id
router.delete("/:id", async (req, res) => {
  try {
    await RoutingRule.findOneAndDelete({ _id: req.params.id, orgId: req.orgId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
