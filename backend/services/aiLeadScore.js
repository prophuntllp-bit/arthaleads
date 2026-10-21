// services/aiLeadScore.js — the AI's read of a lead's recent conversations.
//
// The rule score (utils/leadScorer.js) only sees filled-in fields. This adds
// what is in the WhatsApp chat and the call summaries: "wants a visit on
// Saturday, loan approved" or "just browsing, budget far below the project".
// The AI returns hot / warm / cold, a confidence and one plain reason; that
// moves the rule score by at most 20 points (10 when unsure). It never
// assigns, archives or drops a lead: it only reorders who to call first.
//
// Owner rules (21 Oct 2026):
//   - only leads whose CUSTOMER did something in the last 14 days, and only
//     those 14 days are read; the adjustment lapses 14 days after that
//   - never project leads (a separate collection, never read here) and never
//     a spreadsheet-imported lead until the customer replies after the import
//   - included in the plan (Growth and up), within a daily limit per company
//
// Runs from a 5-minute job (utils/scheduler.js): a lead is scored once the
// customer has been quiet for 10 minutes since their last message, so a burst
// of eight messages is read once, and again only after new activity.
const OpenAI = require("openai");
const Lead = require("../models/Lead");
const Organization = require("../models/Organization");
const WaConversation = require("../models/WaConversation");
const WaMessage = require("../models/WaMessage");
const AiUsage = require("../models/AiUsage");
const { levelOf } = require("../middlewares/planGate");
const logger = require("../config/logger");

const WINDOW_DAYS = 14;
const DAY = 86400000;
const QUIET_MS = Number(process.env.AI_SCORE_QUIET_MS ?? 10 * 60 * 1000);
const DAILY_LIMIT = Number(process.env.AI_SCORE_DAILY_LIMIT ?? 300); // per company
const PER_RUN = 60;
const MODEL = process.env.AI_SCORE_MODEL || "gpt-4o-mini";
const MAX_MESSAGES = 40;
const ADJUST = { hot: 20, warm: 5, cold: -20 };
const SIGNALS = ["visit_wanted", "visit_booked", "budget_confirmed", "loan_ready", "timeline_soon", "decision_maker",
  "asked_price", "asked_documents", "comparing_options", "price_objection", "just_browsing", "not_interested", "wrong_budget", "no_reply_to_questions"];
const CLOSED = ["Closed Won", "Closed Lost"];

// ── The model call (replaceable in tests) ───────────────────────────────────
let client = null;
async function defaultModel(messages) {
  if (!client) client = new OpenAI({ timeout: 30000, maxRetries: 1 });
  const res = await client.chat.completions.create({
    model: MODEL, messages, temperature: 0.1, max_tokens: 300, response_format: { type: "json_object" },
  });
  return { text: res.choices[0]?.message?.content || "", usage: res.usage, model: MODEL };
}
let callModel = defaultModel;

// Phone numbers and email addresses never leave the server.
function scrub(text) {
  return String(text || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    // 10+ digits: a phone number. "4500000" (a budget) stays.
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]")
    .slice(0, 600);
}

// Whether the AI may look at this lead at all (the query below already
// filters; this is the same rule for one lead, used by the sweep and tests).
function eligible(lead, now = Date.now()) {
  if (!lead || lead.isDeleted || lead.isArchived || CLOSED.includes(lead.status)) return false;
  if ((lead.tags || []).includes("Not a buyer")) return false;
  const at = lead.lastCustomerSignalAt && new Date(lead.lastCustomerSignalAt).getTime();
  if (!at || now - at > WINDOW_DAYS * DAY) return false;
  // A spreadsheet row is not a conversation until the customer answers.
  if (lead.importedAt && at <= new Date(lead.importedAt).getTime()) return false;
  return true;
}

// What the AI reads: the lead's fields and the last 14 days only.
async function evidence(lead, now = Date.now()) {
  const since = new Date(now - WINDOW_DAYS * DAY);
  const convs = await WaConversation.find({ orgId: lead.orgId, leadId: lead._id }).select("_id").lean();
  const msgs = convs.length ? await WaMessage.find({
    conversationId: { $in: convs.map((c) => c._id) }, timestamp: { $gte: since },
  }).sort({ timestamp: -1 }).limit(MAX_MESSAGES).select("direction sender body mediaType timestamp").lean() : [];
  const chat = msgs.reverse()
    .filter((m) => m.body || m.mediaType !== "text")
    .map((m) => `${m.direction === "inbound" ? "Customer" : m.sender === "bot" ? "Assistant" : "Sales team"}: ${m.body ? scrub(m.body) : `(${m.mediaType})`}`);

  const calls = (lead.activities || [])
    .filter((a) => a.type === "called" && a.createdAt && new Date(a.createdAt) >= since && (a.meta?.summary || a.meta?.intent))
    .slice(-5)
    .map((a) => `Team call (${a.meta?.status || "call"}): ${scrub(a.meta?.summary || "")}${a.meta?.intent ? ` Intent: ${a.meta.intent}.` : ""}${a.meta?.sentiment ? ` Mood: ${a.meta.sentiment}.` : ""}${a.meta?.nextAction ? ` Next: ${scrub(a.meta.nextAction)}` : ""}`);
  const voice = (lead.voiceCalls || [])
    .filter((v) => v.createdAt && new Date(v.createdAt) >= since)
    .slice(-3)
    .map((v) => {
      const said = (v.transcript || []).filter((t) => t.text).slice(-8).map((t) => `${/agent|bot|assistant/i.test(t.speaker) ? "AI caller" : "Customer"}: ${scrub(t.text)}`).join(" | ");
      return `AI phone call${v.result ? ` (outcome: ${v.result})` : ""}${v.sentiment ? `, mood ${v.sentiment}` : ""}: ${said || "no transcript"}`;
    });

  const budget = lead.budget?.max ? `up to Rs ${lead.budget.max.toLocaleString("en-IN")}` : "not given";
  const fields = [
    `Status: ${lead.status || "New"}`, `Priority: ${lead.priority || "-"}`, `Source: ${lead.source || "-"}`,
    lead.leadSourceLabel ? `Came from: ${scrub(lead.leadSourceLabel)}` : "", lead.campaignRef?.headline ? `Ad: ${scrub(lead.campaignRef.headline)}` : "",
    `Looking for: ${[lead.bhk, lead.propertyType, lead.purpose].filter((x) => x && x !== "N/A").join(" ") || "-"}`,
    `Budget: ${budget}`, lead.preferredLocation ? `Location: ${scrub(lead.preferredLocation)}` : "", lead.timeline ? `Timeline: ${scrub(lead.timeline)}` : "",
    lead.siteVisitDone ? "Site visit: done" : lead.siteVisitDate ? "Site visit: scheduled" : "",
    lead.booking ? `Outcome so far: ${lead.booking}` : "",
  ].filter(Boolean).join("\n");
  return { chat, calls, voice, fields };
}

function promptFor(ev) {
  return [
    { role: "system", content:
`You judge how likely a real estate lead in India is to buy soon, from the last ${WINDOW_DAYS} days of their WhatsApp chat and calls. Chats may be in English, Hindi, Marathi or Hinglish.
Answer only with JSON: {"level":"hot"|"warm"|"cold","confidence":0 to 1,"reason":"...","signals":[...],"nextStep":"..."}
- hot: clear buying intent now (wants a visit, asks price/payment/documents, budget fits, timeline soon).
- warm: interested but undecided, or too little said to tell.
- cold: just browsing, not interested, budget far off, or stopped answering questions.
- reason: one short sentence in plain English for a sales agent, quoting what the customer actually said or did. No dashes as punctuation.
- signals: only from ${JSON.stringify(SIGNALS)}.
- nextStep: what the agent should do next, at most 8 words.
- Judge only from what is below. When there is little to go on, say warm with low confidence.` },
    { role: "user", content:
`Lead details:
${ev.fields}

WhatsApp (oldest first):
${ev.chat.join("\n") || "(no messages)"}

Calls:
${[...ev.calls, ...ev.voice].join("\n") || "(no calls)"}` },
  ];
}

// The model's answer, checked. Anything malformed is null (the lead keeps its
// rule score and is not retried until something new happens).
function parse(text) {
  let j;
  try { j = JSON.parse(String(text || "").replace(/^```(json)?|```$/g, "").trim()); } catch { return null; }
  const level = String(j.level || "").toLowerCase();
  if (!(level in ADJUST)) return null;
  const confidence = Math.max(0, Math.min(1, Number(j.confidence) || 0));
  const clean = (s, n) => String(s || "").replace(/\s*[–—]\s*/g, ", ").replace(/\s+/g, " ").trim().slice(0, n);
  const reason = clean(j.reason, 200);
  if (!reason) return null;
  // Unsure answers count half: one odd chat can't wreck the ranking.
  const adjust = Math.round(ADJUST[level] * (confidence >= 0.6 ? 1 : 0.5));
  return {
    level, confidence, reason, adjust,
    signals: (Array.isArray(j.signals) ? j.signals : []).filter((s) => SIGNALS.includes(s)).slice(0, 6),
    nextStep: clean(j.nextStep, 80),
  };
}

async function recordUsage(orgId, usage) {
  if (!usage) return;
  try {
    await AiUsage.updateOne({ orgId, month: new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7) },
      { $inc: { leadScoreCalls: 1, leadScoreTokens: usage.total_tokens || 0 } }, { upsert: true });
  } catch { /* accounting never blocks scoring */ }
}

/** Score one lead now. Returns the saved aiScore, or null. */
async function scoreOne(lead, now = Date.now()) {
  if (!eligible(lead, now)) return null;
  const ev = await evidence(lead, now);
  if (!ev.chat.length && !ev.calls.length && !ev.voice.length) return null;
  const signalAt = lead.lastCustomerSignalAt;
  let out;
  try { out = await callModel(promptFor(ev)); }
  catch (err) { logger.warn(`[ai-score] model call failed for lead ${lead._id}: ${err.message}`); return null; }
  recordUsage(lead.orgId, out.usage);
  const read = parse(out.text);
  const aiScore = read
    ? { ...read, scoredAt: new Date(now), signalAt, model: out.model || MODEL }
    // Unreadable answer: remember we looked, so the sweep doesn't retry it
    // every five minutes; the old adjustment (if any) is dropped.
    : { level: "warm", adjust: 0, confidence: 0, reason: "", scoredAt: new Date(now), signalAt, model: out.model || MODEL };
  // Only if no newer customer activity arrived while the model was thinking.
  await Lead.updateOne({ _id: lead._id, lastCustomerSignalAt: signalAt }, { $set: { aiScore } });
  return read ? aiScore : null;
}

function istDayStart(now = Date.now()) {
  const ist = new Date(now + 5.5 * 3600000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600000);
}

/** The 5-minute job: score leads with new customer activity, quiet for 10 minutes. */
async function runSweep(now = Date.now()) {
  if (callModel === defaultModel && !process.env.OPENAI_API_KEY) return { scored: 0, skipped: "no AI key" };
  const orgs = await Organization.find({ isActive: { $ne: false } }).select("plan").lean();
  const allowed = orgs.filter((o) => levelOf(o.plan) >= 2).map((o) => o._id);
  if (!allowed.length) return { scored: 0 };
  const candidates = await Lead.find({
    orgId: { $in: allowed },
    isDeleted: { $ne: true }, isArchived: { $ne: true },
    status: { $nin: CLOSED }, tags: { $ne: "Not a buyer" },
    lastCustomerSignalAt: { $gte: new Date(now - WINDOW_DAYS * DAY), $lte: new Date(now - QUIET_MS) },
    $expr: { $or: [
      { $eq: [{ $ifNull: ["$aiScore.signalAt", null] }, null] },
      { $lt: ["$aiScore.signalAt", "$lastCustomerSignalAt"] },
    ] },
  }).sort({ lastCustomerSignalAt: -1 }).limit(PER_RUN).lean();

  const usedToday = new Map();
  let scored = 0;
  for (const lead of candidates) {
    const key = String(lead.orgId);
    if (!usedToday.has(key)) usedToday.set(key, await Lead.countDocuments({ orgId: lead.orgId, "aiScore.scoredAt": { $gte: istDayStart(now) } }));
    if (usedToday.get(key) >= DAILY_LIMIT) continue;
    usedToday.set(key, usedToday.get(key) + 1);
    if (await scoreOne(lead, now)) scored++;
  }
  return { scored };
}

/** The customer just did something (a WhatsApp message, a call with a transcript). */
async function markSignal(leadId, at = new Date()) {
  if (!leadId) return;
  await Lead.updateOne({ _id: leadId, $or: [{ lastCustomerSignalAt: { $exists: false } }, { lastCustomerSignalAt: { $lt: at } }] },
    { $set: { lastCustomerSignalAt: at } }).catch(() => {});
}

module.exports = {
  runSweep, scoreOne, markSignal, eligible, parse, scrub, WINDOW_DAYS,
  _setModel: (fn) => { callModel = fn || defaultModel; },
  _promptFor: promptFor, _evidence: evidence,
};
