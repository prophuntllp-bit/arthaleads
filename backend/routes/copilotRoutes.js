// Artha v2: chat with tools, streamed; saved chats; instant starters.
//
//   POST   /api/copilot/chat            streamed answer (server-sent events)
//   GET    /api/copilot/threads         this person's recent chats
//   GET    /api/copilot/threads/:id     one chat
//   DELETE /api/copilot/threads/:id     delete a chat
//   POST   /api/copilot/threads/:id/turns/:turnId/rating   thumbs up/down
//   GET    /api/copilot/starters?page=  page + role starter buttons (no AI call)
//
// Changes Artha proposes are applied through the existing /api/help/preview,
// /api/help/action and /api/help/undo (same gates, idempotency and undo).
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { protect } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const Organization = require("../models/Organization");
const User = require("../models/User");
const AiUsage = require("../models/AiUsage");
const CopilotThread = require("../models/CopilotThread");
const provider = require("../utils/ai/provider");
const { runTurn } = require("../copilot/agent");
const { startersFor } = require("../copilot/starters");
const logger = require("../config/logger");

const router = express.Router();
router.use(protect);
router.use(planGate("growth"));

// A person asking fast is fine; a script hammering the model is not.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: parseInt(process.env.COPILOT_RATE_LIMIT) || 40,
  keyGenerator: (req) => `artha:${req.user._id}`,
  message: { success: false, message: "You're asking very quickly. Give it a minute and try again." },
  standardHeaders: true, legacyHeaders: false,
});

// Monthly fair-use allowance per company: COPILOT_BUDGET_USD_PER_USER (default
// $5, about Rs 440) times its active users. Answers stop with a clear message
// when it is used up, never silently.
const BUDGET_PER_USER_MICRO = Math.round((parseFloat(process.env.COPILOT_BUDGET_USD_PER_USER) || 5) * 1e6);
const seatCache = new Map();
async function allowanceLeft(orgId) {
  const key = String(orgId);
  let seats = seatCache.get(key);
  if (!seats || seats.at < Date.now() - 10 * 60 * 1000) {
    seats = { n: await User.countDocuments({ orgId, isActive: true }), at: Date.now() };
    seatCache.set(key, seats);
  }
  const row = await AiUsage.findOne({ orgId, month: provider.istMonth() }).select("arthaCostMicroUsd").lean();
  return Math.max(1, seats.n) * BUDGET_PER_USER_MICRO - (row?.arthaCostMicroUsd || 0);
}

async function loadOrg(req) {
  if (req.org && req.org.copilot !== undefined) return req.org;
  return Organization.findById(req.orgId).select("plan copilot copilotWritesDisabled").lean();
}

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || "")) && String(v).length === 24;

router.post("/chat", chatLimiter, async (req, res) => {
  const question = String(req.body?.question || "").trim().slice(0, 2000);
  const page = String(req.body?.page || "/").slice(0, 120);
  const focus = req.body?.focus && isId(req.body.focus.id)
    ? { id: String(req.body.focus.id), kind: req.body.focus.kind === "projectLead" ? "projectLead" : "lead", name: String(req.body.focus.name || "").slice(0, 80) }
    : null;
  if (!question) return res.status(400).json({ success: false, message: "Ask a question." });

  const org = await loadOrg(req);
  if (org?.copilot?.enabled === false) return res.status(403).json({ success: false, message: "Artha is turned off for your company. An admin can turn it back on." });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ success: false, message: "Artha isn't available right now." });
  if ((await allowanceLeft(req.orgId)) <= 0) {
    return res.status(429).json({ success: false, code: "ALLOWANCE", message: "Your company has used this month's Artha allowance. How-to help still works from the Help page; an admin can ask us to raise it." });
  }

  let thread = null;
  if (isId(req.body?.threadId)) thread = await CopilotThread.findOne({ _id: req.body.threadId, userId: req.user._id });
  if (!thread) thread = new CopilotThread({ orgId: req.orgId, userId: req.user._id, title: question.slice(0, 80), turns: [] });

  // Server-sent events. X-Accel-Buffering stops proxies holding the stream back.
  res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders?.();
  const send = (event) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); };
  const abort = new AbortController();
  req.on("close", () => { if (!res.writableEnded) abort.abort(); });
  send({ type: "start", threadId: String(thread._id) });

  try {
    const priorTurns = thread.turns.map((t) => (t.toObject ? t.toObject() : t));
    const out = await runTurn({ user: req.user, org: org || { _id: req.orgId }, turns: priorTurns, question, page, focus, send, signal: abort.signal });
    thread.turns.push({ role: "user", text: question, page });
    thread.turns.push({ role: "assistant", text: out.text || "", steps: out.steps, records: out.records.slice(0, 60), proposals: out.proposals.slice(0, 10), page });
    thread.lastMessageAt = new Date();
    if (thread.turns.length > 200) thread.turns = thread.turns.slice(-200);
    await thread.save();
    const saved = thread.turns[thread.turns.length - 1];
    send({ type: "done", threadId: String(thread._id), turnId: String(saved._id), text: out.text, records: out.records, proposals: out.proposals, choices: out.choices, writesDisabled: !!org?.copilotWritesDisabled || org?.copilot?.actions === false });
  } catch (err) {
    if (!abort.signal.aborted) {
      logger.error(`[artha] turn failed for user ${req.user._id}: ${err.message}`);
      send({ type: "error", message: err.statusCode === 503 ? "Artha isn't available right now." : "Something went wrong answering that. Please try again." });
    }
  } finally {
    res.end();
  }
});

router.get("/threads", async (req, res, next) => {
  try {
    const rows = await CopilotThread.find({ userId: req.user._id }).sort({ lastMessageAt: -1 }).limit(40).select("title lastMessageAt").lean();
    res.json({ success: true, threads: rows.map((t) => ({ id: String(t._id), title: t.title, lastMessageAt: t.lastMessageAt })) });
  } catch (err) { next(err); }
});

router.get("/threads/:id", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: "Chat not found." });
    const t = await CopilotThread.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!t) return res.status(404).json({ success: false, message: "Chat not found." });
    res.json({ success: true, thread: { id: String(t._id), title: t.title, turns: t.turns.map((x) => ({ id: String(x._id), role: x.role, text: x.text, steps: x.steps, records: x.records, proposals: x.proposals, rating: x.rating, at: x.at })) } });
  } catch (err) { next(err); }
});

router.delete("/threads/:id", async (req, res, next) => {
  try {
    if (isId(req.params.id)) await CopilotThread.deleteOne({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/threads/:id/turns/:turnId/rating", async (req, res, next) => {
  try {
    const rating = ["up", "down"].includes(req.body?.rating) ? req.body.rating : null;
    if (!isId(req.params.id) || !isId(req.params.turnId)) return res.status(404).json({ success: false });
    await CopilotThread.updateOne({ _id: req.params.id, userId: req.user._id, "turns._id": req.params.turnId }, { $set: { "turns.$.rating": rating } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Changes Artha applied: managers and admins see the company's, agents their own.
// Newest first; the message is what the person saw after Apply.
router.get("/actions", async (req, res, next) => {
  try {
    const CopilotAction = require("../models/CopilotAction");
    const actions = require("../actions");
    const match = { orgId: req.orgId, status: "done" };
    if (req.user.role === "agent") match.userId = req.user._id;
    const rows = await CopilotAction.find(match).sort({ createdAt: -1 }).limit(Math.min(100, parseInt(req.query.limit) || 50))
      .select("userName actionId result createdAt undoneAt source").lean();
    res.json({ success: true, actions: rows.map((r) => ({
      id: String(r._id), by: r.userName, what: actions.byId.get(r.actionId)?.describe.summary || r.actionId,
      message: r.result?.message || "", at: r.createdAt, undone: !!r.undoneAt,
    })) });
  } catch (err) { next(err); }
});

router.get("/starters", (req, res) => {
  res.json({ success: true, starters: startersFor({ role: req.user.role, page: String(req.query.page || "/") }) });
});

module.exports = router;
