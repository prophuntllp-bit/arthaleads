// routes/helpRoutes.js — in-app help copilot
const express = require("express");
const router  = express.Router();
const mongoose = require("mongoose");
const { protect } = require("../middlewares/auth");
const { answerHelpQuestion } = require("../utils/openai");
const { fetchPageContext } = require("../utils/copilotContext");
const Lead     = require("../models/Lead");
const Task     = require("../models/Task");
const AiUsage  = require("../models/AiUsage");

router.use(protect);

// POST /api/help/ask
// Body: { question, page, leadId?, history? }
router.post("/ask", async (req, res, next) => {
  try {
    const question = (req.body.question || "").toString().trim().slice(0, 500);
    const page     = (req.body.page   || "").toString().slice(0, 80);
    const leadId   = (req.body.leadId || "").toString().slice(0, 30);
    const userName = (req.user?.name  || "").toString().slice(0, 80);
    const history  = Array.isArray(req.body.history)
      ? req.body.history.slice(-6).map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          text: String(m.text || "").slice(0, 800),
        }))
      : [];

    if (!question) return res.status(400).json({ success: false, message: "Please type a question." });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "The AI assistant isn't configured yet. Try the quick answers, or raise a support ticket.",
      });
    }

    // Auto-resolve a lead by name mentioned in the question (when no panel is open)
    let resolvedLeadId = leadId;
    if (!resolvedLeadId) {
      try {
        const STOP = new Set([
          "what","whats","is","the","of","this","lead","a","an","for","in","at","to",
          "and","or","his","her","their","my","how","when","where","why","can","do",
          "did","has","have","been","status","update","phone","email","budget","follow",
          "up","set","mark","assign","show","tell","me","get","find","i","us","s",
          "that","with","about","last","next","current","any","check","please","hi",
        ]);
        // Prefer capitalized name sequences ("Sahil Mishra"); fall back to non-stopword words
        const capMatch = question.match(/\b([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){1,3})\b/);
        const words = capMatch
          ? capMatch[1].split(/\s+/)
          : question.split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w.toLowerCase())).slice(0, 3);

        if (words.length > 0) {
          const regexConds = words.map(w => ({ name: { $regex: w, $options: "i" } }));
          const query = {
            orgId: req.user.orgId, isDeleted: { $ne: true },
            ...(regexConds.length > 1 ? { $and: regexConds } : regexConds[0]),
          };
          const matches = await Lead.find(query).select("_id name").limit(2).lean();
          // Use when exactly 1 lead matches, or when a multi-word name matches anything
          if (matches.length === 1 || (matches.length >= 1 && words.length >= 2)) {
            resolvedLeadId = matches[0]._id.toString();
          }
        }
      } catch { /* non-critical — fall through without lead context */ }
    }

    // Fetch live context from the database for this user/page
    const context = await fetchPageContext(page, req.user._id, req.user.orgId, resolvedLeadId || null);

    const result = await answerHelpQuestion(question, page, userName, context, history);

    // Fire-and-forget: increment monthly AI usage counter for this org
    const month = new Date().toISOString().slice(0, 7); // "2026-06"
    AiUsage.findOneAndUpdate(
      { orgId: req.user.orgId, month },
      {
        $inc: {
          calls:            1,
          promptTokens:     result._usage?.prompt_tokens     || 0,
          completionTokens: result._usage?.completion_tokens || 0,
          totalTokens:      result._usage?.total_tokens      || 0,
        },
      },
      { upsert: true, new: true }
    ).catch(() => {});

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

    // ── Complete a task ───────────────────────────────────────────────────────
    if (type === "complete_task") {
      const { taskId, note } = params;
      if (!mongoose.isValidObjectId(taskId)) return res.status(400).json({ success: false, message: "Invalid task." });
      const task = await Task.findOne({ _id: taskId, orgId: req.user.orgId });
      if (!task) return res.status(404).json({ success: false, message: "Task not found." });
      task.status         = "completed";
      task.completedAt    = new Date();
      task.completionNote = note || "";
      await task.save();
      return res.json({ success: true, message: `Task "${task.title}" marked as completed.`, data: { taskId } });
    }

    // ── Add note to lead ──────────────────────────────────────────────────────
    if (type === "add_lead_note") {
      const { leadId, note } = params;
      if (!note?.trim()) return res.status(400).json({ success: false, message: "Note text required." });
      const lead = await validateLead(leadId);
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
      const noteEntry = {
        text:      note.trim(),
        addedBy:   req.user._id,
        addedName: req.user.name,
        addedAt:   new Date(),
      };
      lead.notes = [...(lead.notes || []), noteEntry];
      await lead.save();
      return res.json({ success: true, message: `Note added to ${lead.name}'s profile.`, data: { leadId } });
    }

    return res.status(400).json({ success: false, message: "Unknown action type." });
  } catch (err) { next(err); }
});

module.exports = router;
