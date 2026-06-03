// routes/helpRoutes.js — in-app help copilot
const express = require("express");
const router  = express.Router();
const mongoose = require("mongoose");
const { protect } = require("../middlewares/auth");
const { answerHelpQuestion } = require("../utils/openai");
const { fetchPageContext } = require("../utils/copilotContext");
const Lead = require("../models/Lead");

router.use(protect);

// POST /api/help/ask
// Body: { question, page, leadId? }
router.post("/ask", async (req, res, next) => {
  try {
    const question = (req.body.question || "").toString().trim().slice(0, 500);
    const page     = (req.body.page   || "").toString().slice(0, 80);
    const leadId   = (req.body.leadId || "").toString().slice(0, 30);
    const userName = (req.user?.name  || "").toString().slice(0, 80);

    if (!question) return res.status(400).json({ success: false, message: "Please type a question." });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "The AI assistant isn't configured yet. Try the quick answers, or raise a support ticket.",
      });
    }

    // Fetch live context from the database for this user/page
    const context = await fetchPageContext(page, req.user._id, req.user.orgId, leadId || null);

    const result = await answerHelpQuestion(question, page, userName, context);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(503).json({ success: false, message: "The AI assistant isn't configured yet." });
    }
    next(err);
  }
});

// POST /api/help/action  — execute a copilot write action (after user confirms)
// Body: { type, params }
router.post("/action", async (req, res, next) => {
  try {
    const { type, params = {} } = req.body;
    if (!type) return res.status(400).json({ success: false, message: "Action type required." });

    // Validate leadId belongs to this org before any mutation
    const validateLead = async (leadId) => {
      if (!leadId || !mongoose.isValidObjectId(leadId)) return null;
      return Lead.findOne({ _id: leadId, orgId: req.user.orgId, isDeleted: { $ne: true } });
    };

    // ── Update lead status ────────────────────────────────────────────────────
    if (type === "update_lead_status") {
      const { leadId, status } = params;
      const VALID = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"];
      if (!VALID.includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });
      const lead = await validateLead(leadId);
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
      lead.status = status;
      await lead.save();
      return res.json({ success: true, message: `${lead.name}'s status updated to "${status}".`, data: { leadId, status } });
    }

    // ── Set follow-up date ────────────────────────────────────────────────────
    if (type === "set_followup") {
      const { leadId, date } = params;
      const followUpDate = new Date(date);
      if (isNaN(followUpDate)) return res.status(400).json({ success: false, message: "Invalid date." });
      const lead = await validateLead(leadId);
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
      lead.followUpDate = followUpDate;
      lead.followUpSetBy     = req.user._id;
      lead.followUpSetByName = req.user.name;
      await lead.save();
      return res.json({
        success: true,
        message: `Follow-up for ${lead.name} set to ${followUpDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`,
        data: { leadId, date: followUpDate.toISOString() },
      });
    }

    // ── Assign lead ───────────────────────────────────────────────────────────
    if (type === "assign_lead") {
      const { leadId, agentId, agentName } = params;
      if (!mongoose.isValidObjectId(agentId)) return res.status(400).json({ success: false, message: "Invalid agent." });
      const lead = await validateLead(leadId);
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
      lead.assignedTo   = agentId;
      lead.assignedName = agentName || "";
      await lead.save();
      return res.json({ success: true, message: `${lead.name} assigned to ${agentName || "the agent"}.`, data: { leadId, agentId } });
    }

    return res.status(400).json({ success: false, message: "Unknown action type." });
  } catch (err) { next(err); }
});

module.exports = router;
