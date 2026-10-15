// Plain-language text for what Vistrow says about a call we asked for, so the
// delivery log and the lead's activity feed tell a salesperson why nobody was
// called (or when they will be) in the same words.

const NOT_QUEUED = {
  auto_call_off: "Auto-call is switched off for this agent in Vistrow",
  agent_not_live: "The Vistrow agent is not live",
  agent_has_no_caller_number: "The Vistrow agent has no caller number",
  auto_call_campaign_paused: "Vistrow's auto-call campaign is paused",
  no_matching_enabled_route: "No enabled calling route matched in Vistrow",
  lead_opted_out: "This lead has opted out of calls",
};

// Why ArthaLeads itself did not ask for a call (routing.js reasons).
const NOT_ROUTED = {
  source_disabled: "Calls are switched off for this lead's source",
  no_route: "No calling rule matches this lead",
  ambiguous_route: "Two calling rules tie for this lead",
  agent_missing: "The matching rule has no agent",
  not_auto_source: "Only Website, Facebook, WhatsApp and Google leads can be called",
  recent_duplicate_phone: "This number was called recently",
  changed_before_send: "The calling rules changed before sending",
};

const CODE_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

function notQueuedText(code) {
  const c = String(code || "").trim();
  if (!c) return "Vistrow did not queue the call";
  return NOT_QUEUED[c] || (CODE_RE.test(c) ? `Vistrow did not queue the call (${c})` : "Vistrow did not queue the call");
}

function notRoutedText(code) {
  return NOT_ROUTED[String(code || "")] || "No call was requested";
}

const fmtIST = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

module.exports = { NOT_QUEUED, NOT_ROUTED, notQueuedText, notRoutedText, fmtIST };
