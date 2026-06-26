// Rule-based lead scoring — pure function, no DB calls.
// Returns an integer 0–100 representing lead "hotness".
//
// Score buckets:
//   80–100 → "Hot"  🔥
//   60–79  → "Warm" 🌡️
//   40–59  → "Lukewarm"
//   0–39   → "Cold"
//
// Factors (max raw = ~125, clamped to 100):
//   Status           0–25
//   Priority         0–20
//   Budget max       0–15
//   Booking          0–20
//   Site visit done  0–10
//   Activities       0–10
//   Notes            0–5
//   Follow-up due    0–15
//   Recent contact   0–10
//   Source warmth    0–5

function scoreLead(lead) {
  let s = 0;

  // Status (higher pipeline stage = warmer)
  const statusPts = { Negotiation: 25, "Site Visit": 20, Contacted: 15, New: 8, "Closed Won": 0, "Closed Lost": 0 };
  s += statusPts[lead.status] || 0;

  // Priority
  const priorityPts = { Hot: 20, High: 15, Medium: 8, Low: 3 };
  s += priorityPts[lead.priority] || 0;

  // Budget max in INR
  const budgetMax = lead.budget?.max || 0;
  if (budgetMax >= 1e7) s += 15;        // 1 Cr+
  else if (budgetMax >= 5e6) s += 10;   // 50 L+
  else if (budgetMax >= 2e6) s += 5;    // 20 L+

  // Booking (strong buying signal)
  if (lead.booking && !["", "Not Interested", "Not Reachable", "Low Budget"].includes(lead.booking)) {
    s += lead.booking === "Booked" ? 20 : 10;
  }

  // Site visit completed
  if (lead.siteVisitDone) s += 10;

  // Engagement depth
  const actCount = (lead.activities || []).length;
  if (actCount >= 5) s += 10;
  else if (actCount >= 2) s += 5;

  const noteCount = (lead.notes || []).length;
  if (noteCount >= 3) s += 5;
  else if (noteCount > 0) s += 2;

  // Follow-up urgency
  if (lead.followUpDate) {
    const daysUntil = (new Date(lead.followUpDate) - Date.now()) / 86400000;
    if (daysUntil <= 0) s += 15;       // overdue → highest urgency
    else if (daysUntil <= 1) s += 12;  // tomorrow
    else if (daysUntil <= 3) s += 8;   // this few days
    else if (daysUntil <= 7) s += 4;   // this week
  }

  // Recency of first contact (fresh leads respond better)
  if (lead.firstContactedAt) {
    const hoursAgo = (Date.now() - new Date(lead.firstContactedAt)) / 3600000;
    if (hoursAgo <= 24) s += 10;
    else if (hoursAgo <= 48) s += 5;
  }

  // Source warmth (WhatsApp = highest intent)
  if (lead.source === "WhatsApp") s += 5;
  else if (["Facebook", "Google"].includes(lead.source)) s += 3;

  return Math.min(Math.round(s), 100);
}

function scoreLabel(score) {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Lukewarm";
  return "Cold";
}

// Derive the single most actionable suggestion for a lead
function nextBestAction(lead, score) {
  if (lead.status === "Negotiation") return { action: "Send Proposal", icon: "file", color: "indigo" };
  if (lead.booking === "Site Visit Booked") return { action: "Confirm Site Visit", icon: "map-pin", color: "violet" };
  if (lead.booking === "Site Visit Done" || lead.siteVisitDone) return { action: "Follow Up & Close", icon: "handshake", color: "emerald" };
  if (lead.followUpDate && new Date(lead.followUpDate) <= new Date()) return { action: "Follow Up Now", icon: "bell", color: "amber" };
  if (lead.status === "Site Visit") return { action: "Schedule Site Visit", icon: "map-pin", color: "violet" };
  if (score >= 70) return { action: "Call Now", icon: "phone", color: "orange" };
  if (lead.status === "New") return { action: "Make First Contact", icon: "phone", color: "blue" };
  return { action: "Send WhatsApp", icon: "message", color: "green" };
}

module.exports = { scoreLead, scoreLabel, nextBestAction };
