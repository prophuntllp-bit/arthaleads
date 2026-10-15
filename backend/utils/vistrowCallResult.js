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

module.exports = { planOutcome, phoneFilter, cleanEmail, cleanName, last10, STATUS_ORDER };
