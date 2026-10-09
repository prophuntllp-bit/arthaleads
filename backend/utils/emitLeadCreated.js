// Call this right after a NEW lead has been created (committed), from the
// code path that created it. Never for updates, transfers, or leads that
// arrived FROM Vistrow.
//
//     emitLeadCreated(lead, { origin: "webhook-website", project: routedProject(ruleMatch) });
//
// Fire-and-forget by design: it returns a promise that never rejects, and it is
// safe to call without await, so lead creation cannot be slowed or failed by
// the Vistrow integration -- including if that module could not even load.
// Whether anything is actually sent is decided inside (off unless the owner has
// enabled it for the organisation).

function emitLeadCreated(lead, ctx) {
  try {
    return require("../services/vistrowOutbound").enqueueLeadCreated(lead, ctx).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

// For bulk creation (import). Same guarantees.
function emitLeadsCreated(leads, ctx) {
  try {
    return require("../services/vistrowOutbound").enqueueLeadsCreated(leads, ctx).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

// The project a matched routing rule files the lead into, in the shape the
// payload builder expects. undefined when the rule names no project.
function routedProject(rule) {
  return rule?.assignToProject ? { id: rule.assignToProject, name: rule.assignToProjectName || "" } : undefined;
}

module.exports = { emitLeadCreated, emitLeadsCreated, routedProject };
