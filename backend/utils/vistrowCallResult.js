// What a Vistrow Voice call result does to an ArthaLeads lead (POST /webhook/lead
// with call_id). Pure functions so the rules are tested without a server.
//
// Vistrow sends `crm_outcome` in this CRM's own vocabulary
// (constants/leadOptions.js): booking, a status hint, follow_up_at and
// site_visit_at (ISO with offset). The rules here decide what may change:
//   * status only moves forward (New -> Contacted -> Site Visit -> Negotiation
//     -> Closed Won) and never leaves Closed Won / Closed Lost;
//   * booking never overwrites a stronger one (Booked, Site Visit Done), and a
//     "Not Reachable" never erases what a person already recorded;
//   * a follow-up or site-visit time is taken only if it is a real date that
//     is not in the past.
// Every change is also returned as an activity, so the lead's history says what
// the call did.

const OPTS = require("../constants/leadOptions");

const STATUS_ORDER = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won"];
const FINAL_STATUSES = new Set(["Closed Won", "Closed Lost"]);
const PROTECTED_BOOKINGS = new Set(["Booked", "Site Visit Done"]);
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function cleanEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 200 ? e : "";
}

function cleanName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function last10(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Mongo filter for "the same person" by phone, the way the CRM's own duplicate
// check does (services/leadService.js): last 10 digits, so "+91 98123 45678",
// "09812345678" and "9812345678" are one person.
function phoneFilter(orgId, phone) {
  const d = last10(phone);
  if (d.length < 10) return { orgId, phone: String(phone || "").trim(), isDeleted: { $ne: true } };
  return { orgId, isDeleted: { $ne: true }, phone: { $regex: escapeRegex(d) + "$" } };
}

function validDate(iso, now) {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // A time slightly in the past (clock skew, a call that ran long) is fine;
  // yesterday's slot is not a follow-up.
  if (d.getTime() < now.getTime() - 60 * 60 * 1000) return null;
  return d;
}

const fmt = (d) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Scheduled follow-up calls Vistrow places on its own (15 Oct 2026):
// `follow_up_kind` at the top level or inside `custom_fields`.
const FOLLOW_UP_LABELS = {
  callback: "Scheduled call-back by Vistrow Voice",
  visit_reminder: "Site-visit reminder call",
  nurture: "Follow-up call",
};

function followUpKindOf(body) {
  const b = body && typeof body === "object" ? body : {};
  const cf = b.custom_fields && typeof b.custom_fields === "object" && !Array.isArray(b.custom_fields) ? b.custom_fields : {};
  const raw = b.follow_up_kind ?? cf.follow_up_kind;
  const k = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return Object.prototype.hasOwnProperty.call(FOLLOW_UP_LABELS, k) ? k : "";
}

// crm_outcome.attempts: how many dials Vistrow made for this lead (sent with
// the final "Not Reachable" report once its retries are used up).
function attemptsOf(outcome) {
  const n = Number(outcome && typeof outcome === "object" ? outcome.attempts : NaN);
  return Number.isInteger(n) && n > 0 && n < 1000 ? n : null;
}

// The booking Vistrow reported, whether or not the rules let it change the lead.
function reportedBooking(outcome) {
  const b = outcome && typeof outcome === "object" && typeof outcome.booking === "string" ? outcome.booking.trim() : "";
  return b && OPTS.BOOKING.includes(b) ? b : "";
}

// One line for the lead's activity feed saying what this call was.
function callDescription({ direction, followUpKind, attempts, booking, durationSeconds, conversationType } = {}) {
  const secs = Number(durationSeconds) > 0 ? ` (${Math.round(Number(durationSeconds))}s)` : "";
  if (booking === "Not Reachable" && attempts) {
    return `Vistrow Voice could not reach this lead after ${attempts} ${attempts === 1 ? "try" : "tries"}`;
  }
  if (followUpKind && FOLLOW_UP_LABELS[followUpKind]) return `${FOLLOW_UP_LABELS[followUpKind]}${secs}`;
  return `${direction === "outbound" ? "Outbound" : "Inbound"} Vistrow Voice ${conversationType === "text" ? "text chat" : "call"}${secs}`;
}

// Voice call or text chat (31 Oct 2026): Vistrow's conversation_type when it
// says "voice" or "text", else read from the channel. Chat / WhatsApp / text /
// SMS channels are text; phone, website widget, web, or a call with a
// duration or a recording is voice. "" when nothing tells.
function conversationTypeOf(explicit, channel, { durationSeconds, recordingUrl } = {}) {
  const t = typeof explicit === "string" ? explicit.trim().toLowerCase() : "";
  if (t === "voice" || t === "text") return t;
  const c = typeof channel === "string" ? channel.toLowerCase() : "";
  if (/chat|whatsapp|text|sms|message/.test(c)) return "text";
  if (/phone|widget|web|call|voice/.test(c) || Number(durationSeconds) > 0 || recordingUrl) return "voice";
  return "";
}

// extracted_data as stored on the call: a plain object of at most 60 fields,
// keys without "." or "$" (Mongo field names), text cut to 1,000 characters,
// nested values kept as JSON text. null when nothing usable is left.
function cleanExtractedData(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out = {};
  for (const [rawKey, val] of Object.entries(v).slice(0, 60)) {
    const k = String(rawKey).replace(/[.$]/g, "_").trim().slice(0, 60);
    if (!k || val === null || val === undefined || val === "") continue;
    if (typeof val === "string") out[k] = val.slice(0, 1000);
    else if (typeof val === "number") { if (Number.isFinite(val)) out[k] = val; }
    else if (typeof val === "boolean") out[k] = val;
    else if (typeof val === "object") {
      try { out[k] = JSON.stringify(val).slice(0, 1000); } catch { /* circular: dropped */ }
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * @param {object} current  the lead as stored now (status, booking, followUpDate, siteVisitDate)
 * @param {object} outcome  Vistrow's crm_outcome
 * @param {Date}   now
 * @returns {{ set: object, activities: object[], lines: string[] }}
 */
function planOutcome(current, outcome, now = new Date()) {
  const set = {};
  const activities = [];
  const lines = [];
  const cur = current || {};
  const o = outcome && typeof outcome === "object" && !Array.isArray(outcome) ? outcome : {};
  const by = "Vistrow Voice";

  // Booking (the call's result).
  const booking = typeof o.booking === "string" ? o.booking.trim() : "";
  if (booking && OPTS.BOOKING.includes(booking) && booking !== cur.booking) {
    const curBooking = cur.booking || "";
    const blocked = PROTECTED_BOOKINGS.has(curBooking) || (booking === "Not Reachable" && curBooking !== "");
    if (!blocked) {
      set.booking = booking;
      lines.push(`Call result: ${booking}`);
    }
  }

  // Status: forward only.
  const status = typeof o.status === "string" ? o.status.trim() : "";
  const curStatus = cur.status || "New";
  if (status && STATUS_ORDER.includes(status) && !FINAL_STATUSES.has(curStatus)) {
    const from = STATUS_ORDER.indexOf(curStatus);
    const to = STATUS_ORDER.indexOf(status);
    if (to > from) {
      set.status = status;
      // Lets the UI show this status as set by an AI call (see Lead.statusSetBy).
      set.statusSetBy = { by: "vistrow_voice", status, at: now };
      activities.push({ type: "status_changed", description: `Status changed from ${curStatus} to ${status} by a Vistrow Voice call`, performedByName: by, meta: { from: curStatus, to: status } });
      lines.push(`Status: ${curStatus} -> ${status}`);
    }
  }

  // Site visit.
  const visit = validDate(o.site_visit_at, now);
  if (visit) {
    set.siteVisitDate = visit;
    activities.push({ type: "site_visit", description: `Site visit booked on the call for ${fmt(visit)}`, performedByName: by, meta: { at: visit.toISOString() } });
    lines.push(`Site visit: ${fmt(visit)}`);
  }

  // Follow-up (callback). Never replaces an earlier follow-up a person set
  // that is still ahead; an overdue or empty one is replaced.
  const follow = validDate(o.follow_up_at, now);
  if (follow) {
    const existing = cur.followUpDate ? new Date(cur.followUpDate) : null;
    const keepExisting = existing && !Number.isNaN(existing.getTime()) && existing > now && existing < follow;
    if (!keepExisting) {
      set.followUpDate = follow;
      set.followUpNote = String(o.note || "Caller asked for a call back (Vistrow Voice)").slice(0, 300);
      set.followUpSetByName = by;
      activities.push({ type: "follow_up_set", description: `Follow-up set for ${fmt(follow)} from a Vistrow Voice call`, performedByName: by, meta: { at: follow.toISOString() } });
      lines.push(`Follow-up: ${fmt(follow)}`);
    }
  }

  return { set, activities, lines };
}

module.exports = { planOutcome, phoneFilter, cleanEmail, cleanName, last10, STATUS_ORDER, FOLLOW_UP_LABELS, followUpKindOf, attemptsOf, reportedBooking, callDescription, conversationTypeOf, cleanExtractedData };
