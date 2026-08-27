// routes/helpRoutes.js — in-app help copilot
const express = require("express");
const router  = express.Router();
const mongoose = require("mongoose");
const { protect } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const { answerHelpQuestion } = require("../utils/openai");
const { fetchPageContext } = require("../utils/copilotContext");
const { findLeadById, searchBothLeadTypes } = require("../utils/leadLookup");
const leadService    = require("../services/leadService");
const projectService = require("../services/projectService");
const taskService    = require("../services/taskService");
const { STATUS }     = require("../constants/leadOptions");
const AiUsage  = require("../models/AiUsage");
const { formatISTDateShort } = require("../utils/datetime");

// The AI copilot is a Growth feature. Each question costs an LLM call, so
// this gate protects margin as well as the packaging.
router.use(protect, planGate("growth"));

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
          // Search project leads too, otherwise asking Artha about anyone who
          // only exists on a project silently resolves to no lead context.
          const matches = await searchBothLeadTypes(query, { select: "_id name", limit: 2 });
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
//
// Every branch below delegates to the same service function the UI calls. That
// is the whole point of this handler: the services already enforce who may do
// what and already write the lead timeline, so the copilot cannot drift into
// being more permissive than the screen. Writing to the models directly here
// is what previously let an agent reassign a colleague's lead through chat
// with nothing recorded.
//
// Services throw AppError with a status code, so a refusal surfaces as a real
// 403 rather than a silent success.
router.post("/action", async (req, res, next) => {
  try {
    const { type, params = {} } = req.body;
    if (!type) return res.status(400).json({ success: false, message: "Action type required." });

    // Resolve the target across both collections. A lead the copilot just
    // described might live in either, and answering "Lead not found." for one
    // it had just talked about is the bug leadLookup.js exists to prevent.
    const resolve = async (leadId) => {
      if (!leadId || !mongoose.isValidObjectId(leadId)) return { doc: null };
      const found = await findLeadById(leadId, req.user.orgId);
      if (!found.doc || found.doc.isDeleted === true) return { doc: null };
      return found;
    };

    // ── Update lead status ────────────────────────────────────────────────────
    if (type === "update_lead_status") {
      const { leadId, status } = params;
      if (!STATUS.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status." });
      }
      const { doc, isProject } = await resolve(leadId);
      if (!doc) return res.status(404).json({ success: false, message: "Lead not found." });

      if (isProject) await projectService.updateLeadFields(leadId, { status }, req.user);
      else           await leadService.update(leadId, { status }, req.user);

      return res.json({ success: true, message: `${doc.name}'s status updated to "${status}".`, data: { leadId, status } });
    }

    // ── Set follow-up date ────────────────────────────────────────────────────
    if (type === "set_followup") {
      const { leadId, date } = params;
      const followUpDate = new Date(date);
      if (isNaN(followUpDate)) return res.status(400).json({ success: false, message: "Invalid date." });
      const { doc, isProject } = await resolve(leadId);
      if (!doc) return res.status(404).json({ success: false, message: "Lead not found." });

      // The two collections name this field differently: Lead.followUpDate,
      // ProjectLead.followUp. Both services stamp followUpSetBy themselves.
      if (isProject) await projectService.updateLeadFields(leadId, { followUp: followUpDate }, req.user);
      else           await leadService.update(leadId, { followUpDate }, req.user);

      return res.json({
        success: true,
        message: `Follow-up for ${doc.name} set to ${formatISTDateShort(followUpDate)}.`,
        data: { leadId, date: followUpDate.toISOString() },
      });
    }

    // ── Assign lead ───────────────────────────────────────────────────────────
    if (type === "assign_lead") {
      const { leadId, agentId } = params;
      if (!mongoose.isValidObjectId(agentId)) return res.status(400).json({ success: false, message: "Invalid agent." });
      const { doc, isProject } = await resolve(leadId);
      if (!doc) return res.status(404).json({ success: false, message: "Lead not found." });

      // Project leads are worked by whoever the parent project is assigned to;
      // there is no per-lead owner to set, so there is nothing to reassign.
      if (isProject) {
        return res.status(400).json({
          success: false,
          message: "Project leads follow the project's team. Change the project's assignees instead.",
        });
      }

      // leadService.assign refuses agents, checks the target belongs to this
      // org, writes the timeline entry and notifies the new owner. The agent
      // name is read from that user record rather than trusted from the
      // client, which also fixes the copilot writing a misspelt field that
      // Mongoose silently dropped, leaving the previous owner's name on screen.
      const updated = await leadService.assign(leadId, agentId, req.user);
      return res.json({
        success: true,
        message: `${doc.name} assigned to ${updated.assignedToName || "the agent"}.`,
        data: { leadId, agentId },
      });
    }

    // ── Complete a task ───────────────────────────────────────────────────────
    if (type === "complete_task") {
      const { taskId, note } = params;
      if (!mongoose.isValidObjectId(taskId)) return res.status(400).json({ success: false, message: "Invalid task." });
      const task = await taskService.complete(taskId, note, req.user);
      return res.json({ success: true, message: `Task "${task.title}" marked as completed.`, data: { taskId } });
    }

    // ── Add note to lead ──────────────────────────────────────────────────────
    if (type === "add_lead_note") {
      const { leadId, note } = params;
      if (!note?.trim()) return res.status(400).json({ success: false, message: "Note text required." });
      const { doc, isProject } = await resolve(leadId);
      if (!doc) return res.status(404).json({ success: false, message: "Lead not found." });

      if (isProject) await projectService.addNote(String(doc.project), leadId, note, req.user);
      else           await leadService.addNote(leadId, note, req.user);

      return res.json({ success: true, message: `Note added to ${doc.name}'s profile.`, data: { leadId } });
    }

    return res.status(400).json({ success: false, message: "Unknown action type." });
  } catch (err) { next(err); }
});

module.exports = router;
