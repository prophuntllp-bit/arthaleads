// Lead score: how likely a lead is to buy, 0 to 100, from what the CUSTOMER
// said and did, plus what the team recorded. Pure function, no DB calls.
//
// Rebuilt 23 Oct 2026 (owner: "giving points just for some activity is wrong";
// a lead that only sent voice notes saying nothing scored 60). No points for
// sending a message, for being new, for the source, or for the default
// "New" / "Medium". The parts:
//
//   Button flow (lead.engagement, written by ctwaFlowService):
//     answered budget +8, answered purpose +4,
//     timeline within 30 days +12, 1-3 months +8, 3-6 months +4,
//     closing: booked a site visit +20, asked for the advisor / a call +15,
//     registered for the event +10, "Not now" -10.
//   The chat (lead.aiScore v2, services/aiLeadScore.js): strong buying intent
//     +20 to +30, interested +10 to +20, nothing of substance 0, not
//     interested -30; only when the AI is at least 60% sure and quotes the
//     customer. Lapses 14 days after the activity it read.
//   Gone quiet: the two parts above x0.7 after 7 days without a customer
//     message, x0.4 after 14.
//   The team: status Contacted +5, Site Visit +15, Negotiation +20,
//     site visit done +10, booked +20, follow-up due soon up to +10.
//   Closed Lost is 0.
//
// Score buckets: 80+ Hot, 60+ Warm, 40+ Lukewarm, below 40 Cold.
// Every screen scores from the same lead fields, so the Dashboard, the
// WhatsApp list, Artha and the Excel download always agree.

const AI_WINDOW_MS = 14 * 86400000;
const DAY = 86400000;

// The chat's part, while the activity the AI read is under 14 days old. Only
// reads from 23 Oct 2026 on (v 2) count: earlier ones scored activity.
function aiPoints(lead, now = Date.now()) {
  const a = lead.aiScore;
  if (!a || a.v !== 2 || !a.signalAt) return 0;
  if (now - new Date(a.signalAt).getTime() > AI_WINDOW_MS) return 0;
  return Math.max(-30, Math.min(30, Number(a.points) || 0));
}
const aiAdjust = aiPoints; // older name, kept for callers
function aiFresh(lead, now = Date.now()) {
  const a = lead.aiScore;
  return !!(a && a.v === 2 && a.reason && a.signalAt && now - new Date(a.signalAt).getTime() <= AI_WINDOW_MS);
}

function timelinePoints(label) {
  const t = String(label || "").toLowerCase();
  if (!t) return 0;
  if (/(30|thirty)\s*days|immediate|this month|within a month|1 month|asap|urgent/.test(t)) return 12;
  if (/1\s*(-|–|to)\s*3/.test(t)) return 8;
  if (/3\s*(-|–|to)\s*6/.test(t)) return 4;
  return 0;
}
const CLOSING_POINTS = { site_visit: 20, handoff: 15, register: 10, declined: -10 };

/** The score's parts, for screens that explain it. */
function scoreParts(lead, now = Date.now()) {
  const e = lead.engagement || {};
  const flow = (e.flow?.budget ? 8 : 0) + (e.flow?.purpose ? 4 : 0) + timelinePoints(e.flow?.timeline);
  const closing = CLOSING_POINTS[e.closing] || 0;
  const chat = aiPoints(lead, now);

  // Gone quiet: what they said counts for less as it ages.
  const lastSaid = [lead.lastCustomerSignalAt, e.at].filter(Boolean).map((d) => new Date(d).getTime()).sort((a, b) => b - a)[0];
  const idleDays = lastSaid ? (now - lastSaid) / DAY : 0;
  const fade = idleDays > 14 ? 0.4 : idleDays > 7 ? 0.7 : 1;
  let conversation = flow + closing + chat;
  if (conversation > 0) conversation = conversation * fade;

  let team = ({ Contacted: 5, "Site Visit": 15, Negotiation: 20 })[lead.status] || 0;
  if (lead.siteVisitDone) team += 10;
  if (lead.booking === "Booked") team += 20;
  if (lead.followUpDate) {
    const daysUntil = (new Date(lead.followUpDate) - now) / DAY;
    if (daysUntil <= 0 && daysUntil > -7) team += 10;
    else if (daysUntil > 0 && daysUntil <= 1) team += 8;
    else if (daysUntil > 1 && daysUntil <= 3) team += 5;
    else if (daysUntil > 3 && daysUntil <= 7) team += 3;
  }

  const total = lead.status === "Closed Lost" ? 0 : Math.max(0, Math.min(100, Math.round(conversation + team)));
  return { total, flow, closing, chat, fade, team };
}

function scoreLead(lead) {
  return scoreParts(lead).total;
}

function scoreLabel(score) {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Lukewarm";
  return "Cold";
}

// Derive the single most actionable suggestion for a lead
function nextBestAction(lead, score) {
  // The AI's suggestion, when it read this lead's recent chat and calls.
  if (aiFresh(lead) && lead.aiScore.nextStep) return { action: lead.aiScore.nextStep, icon: "sparkles", color: "orange", ai: true };
  if (lead.status === "Negotiation") return { action: "Send Proposal", icon: "file", color: "indigo" };
  if (lead.booking === "Site Visit Booked") return { action: "Confirm Site Visit", icon: "map-pin", color: "violet" };
  if (lead.booking === "Site Visit Done" || lead.siteVisitDone) return { action: "Follow Up & Close", icon: "handshake", color: "emerald" };
  if (lead.followUpDate && new Date(lead.followUpDate) <= new Date()) return { action: "Follow Up Now", icon: "bell", color: "amber" };
  if (lead.status === "Site Visit") return { action: "Schedule Site Visit", icon: "map-pin", color: "violet" };
  if (score >= 70) return { action: "Call Now", icon: "phone", color: "orange" };
  if (lead.status === "New") return { action: "Make First Contact", icon: "phone", color: "blue" };
  return { action: "Send WhatsApp", icon: "message", color: "green" };
}

// What screens show about the AI's part: null when the AI hasn't read the lead
// in the last 14 days (the score is then the rule score alone).
function aiSummary(lead) {
  if (!aiFresh(lead)) return null;
  const a = lead.aiScore;
  return { level: a.level, intent: a.intent, reason: a.reason, adjust: aiPoints(lead), points: aiPoints(lead), evidence: a.evidence || [], signals: a.signals || [], scoredAt: a.scoredAt, wrong: !!a.feedback?.wrong };
}

module.exports = { scoreLead, scoreParts, scoreLabel, nextBestAction, aiSummary, aiAdjust, aiPoints };
