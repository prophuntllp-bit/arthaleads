// services/aiLeadScore.js — the AI's read of a lead's recent conversations.
//
// The rule score (utils/leadScorer.js) only sees filled-in fields. This adds
// what is in the WhatsApp chat and the call summaries: "wants a visit on
// Saturday, loan approved" or "just browsing, budget far below the project".
// Since 23 Oct 2026 (owner: "the points should come from the conversation")
// the AI names the customer's intent and quotes the customer's own messages
// it judged from; that is the chat's share of the score (see INTENT_POINTS),
// counted only when it is at least 60% sure and the quotes are really in the
// chat. It never assigns, archives or drops a lead: it only reorders who to
// call first.
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
// What the customer's own messages show, and what that is worth. "strong" and
// "interested" scale with how sure the AI is (60% gets the low end).
const INTENT_POINTS = { strong: [20, 30], interested: [10, 20], neutral: [0, 0], not_interested: [-30, -30], vendor: [0, 0] };
const INTENT_LEVEL = { strong: "hot", interested: "warm", neutral: "cold", not_interested: "cold", vendor: "cold" };
const MIN_CONFIDENCE = 0.6;
// 3 (24 Oct 2026): the ad's pre-filled message and button taps are labelled
// and never count as the customer's own words (v2 gave +28 for "Please share
// price and floor plan details", which the ad wrote).
const VERSION = 3;
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
  }).sort({ timestamp: -1 }).limit(MAX_MESSAGES).select("direction sender body transcript mediaType timestamp interactiveOptions").lean() : [];
  msgs.reverse();
  // Not the customer's own words: a tap on a button the bot had just offered
  // (the button flow scores those itself), and the ad's pre-filled message.
  const adPrefill = require("../utils/adPrefill");
  const AdPrefill = require("../models/AdPrefill");
  const adRows = await AdPrefill.find({ orgId: lead.orgId, hidden: { $ne: true }, $or: [{ manual: true }, { count: { $gte: adPrefill.MIN_CLICKS } }] }).select("norm").lean();
  let offered = [];
  for (const m of msgs) {
    if (m.direction !== "inbound") { offered = (m.interactiveOptions || []).map((o) => String(o.title || "").trim().toLowerCase()); continue; }
    if (!m.transcript && offered.includes(String(m.body || "").trim().toLowerCase())) m._kind = "tap";
    else if (!m.transcript && await adPrefill.isAdText(lead.orgId, m.body, adRows)) m._kind = "ad";
  }
  const said = (m) => m.transcript ? `(voice note) ${scrub(m.transcript)}` : m.body ? scrub(m.body) : `(${m.mediaType})`;
  const who = (m) => m.direction === "inbound"
    ? (m._kind === "tap" ? "Customer (tapped a button)" : m._kind === "ad" ? "Customer (the ad's pre-written message)" : "Customer")
    : m.sender === "bot" ? "Assistant" : "Sales team";
  const chat = msgs
    .filter((m) => m.body || m.transcript || m.mediaType !== "text")
    .map((m) => `${who(m)}: ${said(m)}`);
  // The customer's own words, to check the AI's quotes against.
  const customerText = msgs.filter((m) => m.direction === "inbound" && !m._kind).map((m) => m.transcript || m.body || "").join("\n");

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
  return { chat, calls, voice, fields, customerText };
}

function promptFor(ev) {
  return [
    { role: "system", content:
`You read the last ${WINDOW_DAYS} days of a real estate lead's WhatsApp chat and calls (India; English, Hindi, Marathi or Hinglish) and judge what the CUSTOMER's own messages show. Messages from the Assistant or Sales team are not the customer's intent. Lines marked "(the ad's pre-written message)" were written by the ad, not the customer: they show nothing. Lines marked "(tapped a button)" are answers to the bot's buttons, already counted elsewhere: never use them as evidence or as a reason. Judge only what the customer typed or said themselves; if that is nothing of substance, answer neutral.
Answer only with JSON: {"intent":"strong"|"interested"|"neutral"|"not_interested"|"vendor","confidence":0 to 1,"evidence":["..."],"reason":"...","signals":[...],"nextStep":"..."}
- strong: the customer asks for a site visit, price, payment plan, availability, documents or booking, or says they want to buy soon.
- interested: the customer asks real questions about the project (location, size, amenities, possession) or answers the questions with intent.
- neutral: only greetings, "ok", "thanks", emojis, an unclear voice note, or nothing of substance. Activity alone is NOT interest.
- not_interested: says they are not interested, bought elsewhere, wrong number, or the budget is far off.
- vendor: selling their own services (marketing, ads, leads, software), not buying.
- evidence: up to 3 short quotes copied exactly from lines marked just "Customer:" (their own words). Empty for neutral.
- reason: one short sentence for a sales agent, in plain English. No dashes as punctuation.
- signals: only from ${JSON.stringify(SIGNALS)}.
- nextStep: what the agent should do next, at most 8 words.
- When there is little to go on, answer neutral.` },
    { role: "user", content:
`Lead details (filled in by forms or the team; not the customer's words in the chat):
${ev.fields}

WhatsApp (oldest first):
${ev.chat.join("\n") || "(no messages)"}

Calls:
${[...ev.calls, ...ev.voice].join("\n") || "(no calls)"}` },
  ];
}

const norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// The model's answer, checked. Anything malformed is null (the lead keeps its
// score without the chat's share and is not retried until something new
// happens). Points only when the AI is sure enough and at least one quote is
// really in the customer's messages (calls count as their own evidence).
function parse(text, ev = {}) {
  let j;
  try { j = JSON.parse(String(text || "").replace(/^```(json)?|```$/g, "").trim()); } catch { return null; }
  const intent = String(j.intent || "").toLowerCase();
  if (!(intent in INTENT_POINTS)) return null;
  const confidence = Math.max(0, Math.min(1, Number(j.confidence) || 0));
  const clean = (s, n) => String(s || "").replace(/\s*[–—]\s*/g, ", ").replace(/\s+/g, " ").trim().slice(0, n);
  const reason = clean(j.reason, 200);
  if (!reason) return null;
  const said = norm(ev.customerText);
  const evidence = (Array.isArray(j.evidence) ? j.evidence : []).map((q) => clean(q, 160)).filter(Boolean).slice(0, 3);
  const quoted = evidence.filter((q) => norm(q).length >= 2 && said.includes(norm(q)));
  const fromCalls = (ev.calls?.length || 0) + (ev.voice?.length || 0) > 0;
  const [lo, hi] = INTENT_POINTS[intent];
  let points = 0;
  if (confidence >= MIN_CONFIDENCE && (quoted.length || fromCalls || lo === 0)) {
    points = Math.round(lo + (hi - lo) * Math.min(1, (confidence - MIN_CONFIDENCE) / (1 - MIN_CONFIDENCE)));
  }
  return {
    v: VERSION, intent, level: INTENT_LEVEL[intent], confidence, reason, points, adjust: points, evidence: quoted,
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
  const read = parse(out.text, ev);
  const aiScore = read
    ? { ...read, scoredAt: new Date(now), signalAt, model: out.model || MODEL }
    // Unreadable answer: remember we looked, so the sweep doesn't retry it
    // every five minutes; the chat adds nothing to the score.
    : { v: VERSION, intent: "neutral", level: "cold", points: 0, adjust: 0, confidence: 0, reason: "", scoredAt: new Date(now), signalAt, model: out.model || MODEL };
  // Only if no newer customer activity arrived while the model was thinking.
  const update = { $set: { aiScore } };
  // Someone selling their own services: marked, so the team and the bot skip it.
  if (read?.intent === "vendor" && read.confidence >= MIN_CONFIDENCE) update.$addToSet = { tags: "Not a buyer" };
  await Lead.updateOne({ _id: lead._id, lastCustomerSignalAt: signalAt }, update);
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
      // Read before 23 Oct 2026's conversation-based score: read again once.
      { $ne: [{ $ifNull: ["$aiScore.v", 1] }, VERSION] },
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
  runSweep, scoreOne, markSignal, eligible, parse, scrub, WINDOW_DAYS, INTENT_POINTS, VERSION,
  _setModel: (fn) => { callModel = fn || defaultModel; },
  _promptFor: promptFor, _evidence: evidence,
};
