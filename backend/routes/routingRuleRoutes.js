const express = require("express");
const RoutingRule = require("../models/RoutingRule");
const User = require("../models/User");
const Project = require("../models/Project");
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
    const source = RoutingRule.SOURCES.includes(req.body.source) ? req.body.source : "facebook";
    if (!label || !matchValue || !assignTo) {
      return res.status(400).json({ success: false, message: "label, matchValue and assignTo are required" });
    }
    const validFields = RoutingRule.MATCH_FIELDS_BY_SOURCE[source];
    const field = validFields.includes(matchField) ? matchField : validFields[0];
    // Hostnames are always lowercase — normalize here too, not just in the
    // frontend, so a rule saved from any client still matches.
    const value = field === "domain" ? matchValue.toLowerCase() : matchValue;

    const agent = await User.findOne({ _id: assignTo, orgId: req.orgId }).select("_id name");
    if (!agent) return res.status(404).json({ success: false, message: "Agent not found" });

    // Optional: also file matched leads into a project's lead list.
    let project = null;
    if (req.body.assignToProject) {
      project = await Project.findOne({ _id: req.body.assignToProject, orgId: req.orgId, isArchived: { $ne: true } }).select("_id name");
      if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    }

    const rule = await RoutingRule.create({
      label,
      source,
      matchField: field,
      matchValue: value,
      assignTo: agent._id,
      assignToName: agent.name,
      assignToProject: project?._id || null,
      assignToProjectName: project?.name || "",
      isActive: true,
      orgId: req.orgId,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/routing-rules/:id  (pause/resume, or change name, agent and project)
// What a rule matches on (source, field, value) is not editable: that is its
// identity. To match something else, add a new rule. Changing the agent or
// project only affects leads that arrive from now on; leads already routed keep
// the agent they were given.
router.patch("/:id", async (req, res) => {
  try {
    const rule = await RoutingRule.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    if (req.body.isActive !== undefined) rule.isActive = req.body.isActive;

    if (req.body.label !== undefined) {
      const label = String(req.body.label).trim();
      if (!label) return res.status(400).json({ success: false, message: "Rule name cannot be empty" });
      rule.label = label.slice(0, 120);
    }
    if (req.body.assignTo !== undefined) {
      const agent = await User.findOne({ _id: req.body.assignTo, orgId: req.orgId, isActive: { $ne: false } }).select("_id name");
      if (!agent) return res.status(404).json({ success: false, message: "Agent not found" });
      rule.assignTo = agent._id;
      rule.assignToName = agent.name;
    }
    if (req.body.assignToProject !== undefined) {
      if (!req.body.assignToProject) {
        rule.assignToProject = null;
        rule.assignToProjectName = "";
      } else {
        const project = await Project.findOne({ _id: req.body.assignToProject, orgId: req.orgId, isArchived: { $ne: true } }).select("_id name");
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });
        rule.assignToProject = project._id;
        rule.assignToProjectName = project.name;
      }
    }
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
