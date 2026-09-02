// routes/helpRoutes.js — in-app help copilot
const express = require("express");
const router  = express.Router();
const { protect } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const { answerHelpQuestion } = require("../utils/openai");
const { fetchPageContext } = require("../utils/copilotContext");
const { searchBothLeadTypes } = require("../utils/leadLookup");
const actions = require("../actions");
const CopilotAction = require("../models/CopilotAction");
const Organization = require("../models/Organization");
const logger = require("../config/logger");
const { AppError } = require("../middlewares/errorHandler");
const AiUsage  = require("../models/AiUsage");
const ContentReport = require("../models/ContentReport");

router.use(protect);

// POST /api/help/report — flag something the assistant said.
//
// Deliberately above the plan gate. Play's AI-Generated Content policy requires
// a way to flag offensive output from inside the app, and "your trial lapsed
// since that message" is not an acceptable reason for the flag to stop working.
router.post("/report", async (req, res, next) => {
  try {
    const reportedText = (req.body.reportedText || "").toString().trim().slice(0, 8000);
    if (!reportedText) return next(new AppError("Nothing to report", 400));

    const reason = ContentReport.REASONS.includes(req.body.reason) ? req.body.reason : "other";

    await ContentReport.create({
      orgId:   req.user.orgId,
      userId:  req.user._id,
      reason,
      detail:  (req.body.detail || "").toString().trim().slice(0, 1000),
      reportedText,
      prompt:  (req.body.prompt  || "").toString().slice(0, 2000),
      page:    (req.body.page    || "").toString().slice(0, 80),
      surface: req.body.surface === "mobile" ? "mobile" : "web",
    });

    logger.warn(`[copilot-report] ${reason} reported by ${req.user._id} (org ${req.user.orgId})`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// The AI copilot is a Growth feature. Each question costs an LLM call, so
// this gate protects margin as well as the packaging.
router.use(planGate("growth"));

// POST /api/help/ask
// Body: { question, page, leadId?, history? }
router.post("/ask", async (req, res, next) => {
  try {
    const question = (req.body.question || "").toString().trim().slice(0, 500);
    const page     = (req.body.page   || "").toString().slice(0, 80);
    const leadId   = (req.body.leadId || "").toString().slice(0, 30);
    // Which app is asking. Only changes how navigation is worded -- the mobile
    // client sends the same web routes in `page`, because that is what the
    // live-context lookups and the action scoping are keyed on. Whitelisted
    // rather than passed through: it lands in a model prompt.
    const surface  = req.body.surface === "mobile" ? "mobile" : "web";
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

    const result = await answerHelpQuestion(question, page, userName, context, history, catalogue, surface);

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
    const { type, params, page, scopeConfirmed, idempotencyKey } = req.body || {};
    if (!type) return res.status(400).json({ success: false, message: "Action type required." });

    // Kill switch. Reads stay working; only writes stop. Checked here rather
    // than in the registry because it is an org-wide operational switch, not a
    // property of any action.
    const org = await Organization.findById(req.orgId).select("copilotWritesDisabled").lean();
    if (org && org.copilotWritesDisabled) {
      return res.status(403).json({
        success: false,
        message: "Copilot changes are switched off for your organisation. Ask your admin.",
      });
    }

    const { action, params: clean } = actions.authorise({
      id: type,
      params,
      role: req.user.role,
      page,
      scopeConfirmed: Boolean(scopeConfirmed),
    });

    // ── Idempotency ────────────────────────────────────────────────────────
    // Without this, a dropped response and a second tap on Apply assign the
    // lead twice, or append the note twice. The key is minted when the
    // preview is shown, so every retry of that one proposal reuses it.
    const key = typeof idempotencyKey === "string" ? idempotencyKey.slice(0, 100) : null;
    let claim = null;

    if (key) {
      // Upsert returns the PREVIOUS document: null means we just created it
      // and therefore own this execution.
      const existing = await CopilotAction.findOneAndUpdate(
        { idempotencyKey: key },
        {
          $setOnInsert: {
            idempotencyKey: key,
            orgId: req.orgId,
            userId: req.user._id,
            userName: req.user.name || "",
            actionId: action.id,
            params: clean,
            page: String(page || "").slice(0, 80),
            prompt: String(req.body.prompt || "").slice(0, 500),
            status: "pending",
          },
        },
        { upsert: true, new: false }
      ).lean();

      if (existing && existing.status === "done") {
        return res.json({ success: true, replayed: true, ...(existing.result || {}) });
      }
      if (existing && existing.status === "pending") {
        return res.status(409).json({ success: false, message: "That change is already being applied." });
      }
      claim = key;
    }

    // Snapshot what is about to change, as close to the write as possible.
    // A failure here must not stop the action the user already approved — it
    // only costs the ability to undo, so it is recorded and moved past.
    let before = null;
    if (typeof action.captureBefore === "function") {
      try {
        before = await action.captureBefore({ params: clean, user: req.user });
      } catch (err) {
        logger.warn(`[copilot] could not capture undo state for ${action.id}: ${err.message}`);
      }
    }

    let result;
    try {
      result = await action.execute({ params: clean, user: req.user });
    } catch (err) {
      // Release the claim so the user can retry the same proposal.
      if (claim) await CopilotAction.deleteOne({ idempotencyKey: claim }).catch(() => {});
      throw err;
    }

    if (claim) {
      await CopilotAction.updateOne(
        { idempotencyKey: claim },
        { $set: { status: "done", result, before } }
      ).catch(() => {});
    }

    // Undo is only offered when there is both a receipt and a way to apply it.
    const undoable = Boolean(claim && before && typeof action.undo === "function");
    return res.json({ success: true, ...result, undoable, undoKey: undoable ? claim : null });
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

// POST /api/help/undo — put back a change the copilot made.
// Body: { undoKey }
//
// Undo runs through the same services as the original write, so it is subject
// to the same permission rules. If a colleague has since changed the record
// again, this restores the value from the receipt over the top — it is an
// undo of the copilot's edit, not a full revision history.
const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

router.post("/undo", async (req, res, next) => {
  try {
    const { undoKey } = req.body || {};
    if (!undoKey) return res.status(400).json({ success: false, message: "Nothing to undo." });

    const row = await CopilotAction.findOne({
      idempotencyKey: String(undoKey).slice(0, 100),
      orgId: req.orgId,
    }).lean();

    if (!row) return res.status(404).json({ success: false, message: "That change was not found." });
    if (row.undoneAt) return res.status(409).json({ success: false, message: "That change was already undone." });
    if (row.status !== "done") return res.status(409).json({ success: false, message: "That change did not complete." });
    if (!row.before) return res.status(400).json({ success: false, message: "That change cannot be undone." });
    if (Date.now() - new Date(row.createdAt).getTime() > UNDO_WINDOW_MS) {
      return res.status(410).json({ success: false, message: "Undo is only available for 24 hours." });
    }

    const action = actions.byId.get(row.actionId);
    if (!action || typeof action.undo !== "function") {
      return res.status(400).json({ success: false, message: "That change cannot be undone." });
    }

    // Claim it first, so two taps on Undo cannot both run the inverse.
    const claimed = await CopilotAction.findOneAndUpdate(
      { _id: row._id, undoneAt: null },
      { $set: { undoneAt: new Date() } },
      { new: true }
    ).lean();
    if (!claimed) return res.status(409).json({ success: false, message: "That change was already undone." });

    try {
      const out = await action.undo({
        before: row.before,
        result: row.result,
        params: row.params,
        user: req.user,
      });
      return res.json({ success: true, ...out });
    } catch (err) {
      // Release so the user can try again — a permission error here is real
      // and should not consume their one chance to undo.
      await CopilotAction.updateOne({ _id: row._id }, { $set: { undoneAt: null } }).catch(() => {});
      throw err;
    }
  } catch (err) { next(err); }
});

module.exports = router;
