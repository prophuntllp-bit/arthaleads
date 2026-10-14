// Who may see what. One answer, used by every screen and by the Artha copilot,
// so the copilot can never see more than the CRM shows the same person.
//
// Leads: an agent sees leads assigned to them or created by them (an agent's
// new lead is often round-robined to a colleague but stays theirs to see).
// Unassigned leads are NOT visible to agents: an admin or manager assigning
// one is the only way an agent reaches it (see getAllUnified's history).
//
// Project leads: an agent sees the project leads of projects they are on
// (Project.assignedTo) and any project lead assigned to them personally (one
// moved in from Leads).
//
// WhatsApp conversations: an agent sees only conversations assigned to them;
// an unclaimed thread stays hidden until someone assigns it.
//
// Managers, admins and super admins see the whole organisation. Every query
// must still filter by orgId itself; these helpers only add the per-person part.
//
// This is a permission rule, not a to-do list: "my follow-ups" and "my tasks"
// stay "assigned to me" (followupService, taskService).
const mongoose = require("mongoose");
const Project = require("../models/Project");

const idOf = (v) => (v && v._id ? String(v._id) : v ? String(v) : "");
const asObjectId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));

function isRestricted(user) {
  return user?.role === "agent";
}

// Mongo condition limiting Lead queries to what `subjectId` may see, or null
// for no restriction. `subjectId` defaults to the user; managers/admins pass an
// agent's id to look through that agent's eyes (the Leads page agent filter).
function leadCondition(user, subjectId = null) {
  const who = subjectId || (isRestricted(user) ? user._id : null);
  if (!who) return null;
  return { $or: [{ assignedTo: who }, { createdBy: who }] };
}

async function projectIdsFor(orgId, who) {
  const rows = await Project.find({ orgId, assignedTo: who }).select("_id").lean();
  return rows.map((p) => p._id);
}

// Same as leadCondition, for ProjectLead queries.
async function projectLeadCondition(user, subjectId = null) {
  const who = subjectId || (isRestricted(user) ? user._id : null);
  if (!who) return null;
  const projects = await projectIdsFor(user.orgId, who);
  return { $or: [{ project: { $in: projects } }, { assignedTo: who }] };
}

// Records from another organisation are never visible. Only compared when both
// sides carry an orgId (callers often select a lead without it).
const otherOrg = (user, doc) => !!(doc?.orgId && user?.orgId && idOf(doc.orgId) !== idOf(user.orgId));

// The lead is assigned to, or was created by, this person.
function ownsLead(userId, lead) {
  const me = idOf(userId);
  return !!lead && (idOf(lead.assignedTo) === me || idOf(lead.createdBy) === me);
}

function canSeeLead(user, lead) {
  if (!lead || otherOrg(user, lead)) return false;
  if (!isRestricted(user)) return true;
  return ownsLead(user._id, lead);
}

async function canSeeProjectLead(user, projectLead) {
  if (!projectLead || otherOrg(user, projectLead)) return false;
  if (!isRestricted(user)) return true;
  const me = idOf(user._id);
  if (idOf(projectLead.assignedTo) === me) return true;
  const project = await Project.findOne({ _id: projectLead.project?._id || projectLead.project, orgId: user.orgId }).select("assignedTo").lean();
  return !!project?.assignedTo?.some((a) => idOf(a) === me);
}

function canSeeConversation(user, conv) {
  if (!conv || otherOrg(user, conv)) return false;
  if (!isRestricted(user)) return true;
  if (!conv.assignedTo) return false;
  return idOf(conv.assignedTo) === idOf(user._id);
}

// Calls are activities on leads; an agent sees the ones they performed.
function ownCallsMatch(user) {
  if (!isRestricted(user)) return {};
  return { "activities.performedBy": asObjectId(user._id) };
}

module.exports = {
  isRestricted, leadCondition, projectLeadCondition, ownsLead,
  canSeeLead, canSeeProjectLead, canSeeConversation, ownCallsMatch,
};
