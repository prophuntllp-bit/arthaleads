// The WhatsApp assistant stays quiet while Vistrow Voice is on the phone with
// the same lead (owner decision, 15 Oct 2026).
//
//   * Vistrow answers queued:true for a WhatsApp lead -> pauseBotForCall: the
//     conversation's bot is switched off, marked botPausedReason "vistrow_call".
//   * The call result arrives (POST /webhook/lead, call_id) -> noteCallResult:
//     an internal note with the result goes into the chat (never sent to the
//     customer), and the bot is switched back on ONLY if this pause is still in
//     place. A person who toggled the bot in between clears the reason, so their
//     choice is never undone.
//   * No result within PAUSE_MINUTES -> resumeOverduePauses switches it back on.

const WaConversation = require("../models/WaConversation");

const PAUSE_REASON = "vistrow_call";
const PAUSE_MINUTES = 15;
const MAX_NOTES = 50;
const BY = "Vistrow Voice";

// eslint-disable-next-line no-control-regex
const CONTROL = new RegExp("[\\x00-\\x1F\\x7F" + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + "]", "g");
const clean = (v, max = 200) => String(v ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max);
const noteOp = (text, at) => ({ $push: { internalNotes: { $each: [{ text, by: BY, at }], $slice: -MAX_NOTES } } });
const RESUME = { botEnabled: true, status: "bot" };
const CLEAR = { botPausedReason: "", botPausedAt: "", botResumeAt: "" };

async function pauseBotForCall({ orgId, leadId, now = new Date(), minutes = PAUSE_MINUTES }) {
  if (!orgId || !leadId) return 0;
  const res = await WaConversation.updateMany(
    { orgId, leadId, botEnabled: true },
    {
      $set: { botEnabled: false, status: "open", botPausedReason: PAUSE_REASON, botPausedAt: now, botResumeAt: new Date(now.getTime() + minutes * 60000) },
      ...noteOp(`Vistrow Voice is calling this lead. The WhatsApp assistant is paused until the call result arrives (at most ${minutes} minutes).`, now),
    }
  );
  return res.modifiedCount || 0;
}

const fmt = (d) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const asDate = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

// One line per thing the call decided, from Vistrow's crm_outcome.
function callResultText({ outcome, direction, durationSeconds } = {}) {
  const o = outcome && typeof outcome === "object" && !Array.isArray(outcome) ? outcome : {};
  const parts = [];
  if (o.booking) parts.push(`Result: ${clean(o.booking, 60)}`);
  if (o.status) parts.push(`Status: ${clean(o.status, 60)}`);
  const visit = asDate(o.site_visit_at);
  if (visit) parts.push(`Site visit: ${fmt(visit)}`);
  const follow = asDate(o.follow_up_at);
  if (follow) parts.push(`Follow-up: ${fmt(follow)}`);
  if (o.note) parts.push(`Note: ${clean(o.note, 300)}`);
  const secs = Number(durationSeconds) > 0 ? ` (${Math.round(Number(durationSeconds))}s)` : "";
  const head = `${direction === "inbound" ? "Inbound" : "Outbound"} Vistrow Voice call finished${secs}.`;
  return parts.length ? `${head} ${parts.join(". ")}.` : `${head} No result was reported.`;
}

// Internal note with the result in every WhatsApp chat of the lead, and the bot
// back on where this automation paused it.
async function noteCallResult({ orgId, leadId, outcome, direction, durationSeconds, now = new Date() }) {
  if (!orgId || !leadId) return { noted: 0, resumed: 0 };
  const convs = await WaConversation.find({ orgId, leadId }).select("_id").lean();
  const text = callResultText({ outcome, direction, durationSeconds });
  let resumed = 0;
  for (const c of convs) {
    const r = await WaConversation.updateOne(
      { _id: c._id, botEnabled: false, botPausedReason: PAUSE_REASON },
      { $set: RESUME, $unset: CLEAR, ...noteOp(`${text} The WhatsApp assistant is back on.`, now) }
    );
    if (r.modifiedCount) { resumed++; continue; }
    await WaConversation.updateOne({ _id: c._id }, noteOp(text, now));
  }
  return { noted: convs.length, resumed };
}

// Safety net: a call whose result never arrives must not silence the chat for good.
async function resumeOverduePauses({ now = new Date(), limit = 50 } = {}) {
  const due = await WaConversation.find({ botPausedReason: PAUSE_REASON, botResumeAt: { $lte: now } }).select("_id").limit(limit).lean();
  let resumed = 0;
  for (const c of due) {
    const r = await WaConversation.updateOne(
      { _id: c._id, botEnabled: false, botPausedReason: PAUSE_REASON, botResumeAt: { $lte: now } },
      { $set: RESUME, $unset: CLEAR, ...noteOp(`No call result from Vistrow Voice within ${PAUSE_MINUTES} minutes, so the WhatsApp assistant is back on.`, now) }
    );
    resumed += r.modifiedCount || 0;
  }
  return resumed;
}

module.exports = { pauseBotForCall, noteCallResult, resumeOverduePauses, callResultText, PAUSE_REASON, PAUSE_MINUTES, CLEAR_PAUSE: CLEAR };
