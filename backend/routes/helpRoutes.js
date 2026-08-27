// routes/helpRoutes.js — in-app help copilot
const express = require("express");
const router  = express.Router();
const { protect } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const { answerHelpQuestion } = require("../utils/openai");
const { fetchPageContext } = require("../utils/copilotContext");
const { searchBothLeadTypes } = require("../utils/leadLookup");
const actions = require("../actions");
const AiUsage  = require("../models/AiUsage");

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

    // Only describe actions this user can actually run from this page. The
    // model cannot propose what it was never told about — and if it invents
    // one anyway, authorise() refuses it on the way in.
    const catalogue = actions.catalogueFor({ role: req.user.role, page });

    const result = await answerHelpQuestion(question, page, userName, context, history, catalogue);

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

// POST /api/help/action  — execute a copilot write action
// Body: { type, params, page, scopeConfirmed? }
//
// This handler no longer knows what any individual action does. It runs the
// gates and dispatches; the registry in actions/ owns the rest. Adding an
// action therefore cannot skip a check, because there is no per-action code
// here to forget to guard.
router.post("/action", async (req, res, next) => {
  try {
    const { type, params, page, scopeConfirmed } = req.body || {};
    if (!type) return res.status(400).json({ success: false, message: "Action type required." });

    const { action, params: clean } = actions.authorise({
      id: type,
      params,
      role: req.user.role,
      page,
      scopeConfirmed: Boolean(scopeConfirmed),
    });

    const result = await action.execute({ params: clean, user: req.user });
    return res.json({ success: true, ...result });
  } catch (err) {
    // A page-scope refusal is not a failure — it is the copilot asking to work
    // somewhere else. The client renders it as a prompt and may retry with
    // scopeConfirmed once the user agrees.
    if (err.needsScopeChange) {
      return res.status(409).json({
        success: false,
        needsScopeChange: true,
        message: err.message,
        scopeLabel: err.scopeLabel,
        allowedPages: err.allowedPages,
      });
    }
    next(err);
  }
});

// POST /api/help/preview — what would change, without changing it.
// Same gates as /action. Phase 3 renders this as the confirm card; exposing it
// now keeps preview and execute reading from one definition.
router.post("/preview", async (req, res, next) => {
  try {
    const { type, params, page, scopeConfirmed } = req.body || {};
    if (!type) return res.status(400).json({ success: false, message: "Action type required." });

    const { action, params: clean } = actions.authorise({
      id: type,
      params,
      role: req.user.role,
      page,
      scopeConfirmed: Boolean(scopeConfirmed),
    });

    if (typeof action.preview !== "function") {
      return res.status(400).json({ success: false, message: "This action has no preview." });
    }
    const diff = await action.preview({ params: clean, user: req.user });
    return res.json({ success: true, action: action.id, ...diff });
  } catch (err) {
    if (err.needsScopeChange) {
      return res.status(409).json({
        success: false, needsScopeChange: true, message: err.message,
        scopeLabel: err.scopeLabel, allowedPages: err.allowedPages,
      });
    }
    next(err);
  }
});

module.exports = router;
