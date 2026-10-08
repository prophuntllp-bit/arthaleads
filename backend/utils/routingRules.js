const RoutingRule = require("../models/RoutingRule");
const ProjectLead = require("../models/ProjectLead");
const logger = require("../config/logger");

// Finds the active routing rule (if any) that matches this lead's attribution
// data for the given source. `candidates` is a plain object of
// { matchField: value } — any entry with an empty/falsy value is dropped
// before querying, same as the Facebook webhook did inline before this was
// extracted. A rule saved before `source` existed has no `source` field, so
// it's treated as "facebook" ($or with { source: "facebook" } / { source: { $exists: false } }).
async function matchRoutingRule(orgId, source, candidates) {
  const clauses = Object.entries(candidates || {})
    .filter(([, value]) => !!value)
    .map(([matchField, value]) => ({ matchField, matchValue: String(value) }));

  if (!clauses.length) return null;

  const sourceClause = source === "facebook"
    ? { $or: [{ source: "facebook" }, { source: { $exists: false } }] }
    : { source };

  // Both conditions must hold. Spreading the source's own $or next to the match $or
  // would let the second overwrite the first and match another source's rule.
  return RoutingRule.findOne({
    orgId,
    isActive: true,
    $and: [sourceClause, { $or: clauses }],
  });
}

// Website rule matching needs one extra behavior beyond an exact-value match:
// "page_path" rules match when the lead's page URL *contains* the saved
// value (e.g. matchValue "/joyville-hinjewadi" should match
// "https://site.com/projects/joyville-hinjewadi?utm=fb"), not just when it's
// identical. Handled as a separate step so matchRoutingRule stays a simple
// exact-match lookup for every other source.
async function matchWebsiteRoutingRule(orgId, { domain, pageUrl }) {
  const exact = await matchRoutingRule(orgId, "website", { domain });
  if (exact) return exact;
  if (!pageUrl) return null;

  const pathRules = await RoutingRule.find({
    orgId,
    isActive: true,
    source: "website",
    matchField: "page_path",
  }).lean();

  return pathRules.find((r) => r.matchValue && pageUrl.includes(r.matchValue)) || null;
}

// When the matched rule names a project, also file the lead into that
// project's own lead list — the same copy the manual "Transfer to Project"
// action makes (see leadService.transferToProject), minus the archive step:
// the original Lead stays live in the main pipeline on purpose. Archiving it
// immediately would break findLiveLeadByPhone (whatsappRoutes.js), which
// excludes archived leads and is how an in-progress WhatsApp/CTWA
// conversation keeps finding and enriching this same lead on every
// subsequent inbound message. Best-effort: a failure here must never fail
// the webhook that already created the real Lead record.
//
// Someone already in that project (they clicked a second ad, or were imported
// there earlier) is not added again. The copy carries the rule's agent, so it
// shows up as theirs in the project too.
async function fileLeadInRoutedProject(rule, lead) {
  if (!rule?.assignToProject || !lead) return;
  try {
    const { findCopyInProject } = require("./projectCopies");
    if (await findCopyInProject(lead.orgId, rule.assignToProject, lead)) return;
    await ProjectLead.create({
      project: rule.assignToProject,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || "",
      source: lead.source || "Manual",
      leadSourceLabel: lead.leadSourceLabel || "",
      sourcePage: lead.sourcePage || "",
      sourceDomain: lead.sourceDomain || "",
      campaignRef: lead.campaignRef || undefined,
      assignedTo: lead.assignedTo || (rule.keepUnassigned ? null : rule.assignTo) || null,
      assignedToName: lead.assignedToName || (rule.keepUnassigned ? "" : rule.assignToName) || "",
      importedBy: rule.assignTo,
      orgId: lead.orgId,
    });
    notifyProjectTeam(rule.assignToProject, lead).catch(() => {});
  } catch (err) {
    logger.error(`[routing rule] failed to file lead ${lead._id} into project ${rule.assignToProject}: ${err.message}`);
  }
}

// Tells the people working a project that a lead just landed in it: the lead's
// own owner, or, when it has none, the agents assigned to the project.
async function notifyProjectTeam(projectId, lead) {
  const { sendPushToUser } = require("./push");
  const Project = require("../models/Project");
  const project = await Project.findById(projectId).select("name assignedTo").lean();
  if (!project) return;
  const ids = lead.assignedTo ? [lead.assignedTo] : (project.assignedTo || []);
  const payload = {
    title: `New lead in ${project.name}`,
    body: `${lead.name} (${lead.phone}) was added to the project.`,
    data: { url: `/projects/${projectId}` },
  };
  await Promise.all(ids.map((u) => sendPushToUser(u, payload).catch(() => {})));
}

module.exports = { notifyProjectTeam, matchRoutingRule, matchWebsiteRoutingRule, fileLeadInRoutedProject };
