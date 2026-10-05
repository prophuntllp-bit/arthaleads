const ProjectLead = require("../models/ProjectLead");
const Lead = require("../models/Lead");
const logger = require("../config/logger");
const { projectLeadFromLead } = require("./projectLeadFromLead");

// A person can sit in a project's lead list without having been moved there
// from Leads: a routing rule files a copy of every matching ad lead into its
// project (utils/routingRules.js), and a project's own imports land there
// directly. Those copies have no fromLeadId, so nothing tied them back to the
// lead in Leads. They are matched here by phone number instead.

// The same number is stored as "919890209768", "+919890209768",
// "9890209768" or "09890209768" depending on where it came from.
function phoneVariants(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 10) return [];
  const ten = d.slice(-10);
  return [ten, `91${ten}`, `+91${ten}`, `0${ten}`, `+91 ${ten}`];
}
const phoneKey = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

// For a page of plain leads: which projects already hold each of them.
// Returns Map(leadId -> [{ projectId, projectName }]).
async function projectCopiesFor(orgId, leads) {
  const out = new Map();
  const variants = [...new Set(leads.flatMap((l) => phoneVariants(l.phone)))];
  if (!variants.length) return out;
  const copies = await ProjectLead.find({ orgId, phone: { $in: variants }, fromLeadId: null })
    .select("phone project").populate({ path: "project", select: "name isArchived" }).lean();
  const byPhone = new Map();
  for (const c of copies) {
    if (!c.project || c.project.isArchived) continue;
    const k = phoneKey(c.phone);
    const list = byPhone.get(k) || [];
    if (!list.some((p) => String(p.projectId) === String(c.project._id))) list.push({ projectId: c.project._id, projectName: c.project.name });
    byPhone.set(k, list);
  }
  for (const l of leads) {
    const list = byPhone.get(phoneKey(l.phone));
    if (list?.length) out.set(String(l._id), list);
  }
  return out;
}

// The entry this person already has in the target project, if any.
function findCopyInProject(orgId, projectId, lead) {
  const variants = phoneVariants(lead.phone);
  if (!variants.length) return null;
  return ProjectLead.findOne({ orgId, project: projectId, phone: { $in: variants } })
    .sort({ createdAt: 1 });
}

// Budget counts as blank when it has neither a min nor a max.
const isBlank = (v) => v === undefined || v === null || v === "" || v === "N/A"
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && ("min" in v || "max" in v) && !v.min && !v.max);

const REMARK_FIELDS = [["remark1", "Remark 1"], ["remark2", "Remark 2"], ["remark3", "Remark 3"], ["remark4", "Remark 4"], ["remarkNote", "Note"]];
const SKIP = new Set(["project", "importedBy", "orgId", "createdAt", "fromLeadId", "transferredAt", "notes", "activities", "tags", "formResponses", ...REMARK_FIELDS.map(([f]) => f)]);

// Moving a lead into a project that already has them: fold the lead into the
// existing entry instead of adding a second row for the same person. What was
// already written in the project wins; anything the project entry is missing
// is filled from the lead; a remark both sides have, worded differently, is
// kept as a note so nothing anyone typed is lost.
function mergeLeadIntoCopy(copy, leadDoc, user, projectName) {
  const from = projectLeadFromLead(leadDoc, copy.project, user, { projectName });
  for (const [k, v] of Object.entries(from)) {
    if (SKIP.has(k) || isBlank(v)) continue;
    if (isBlank(copy[k])) copy[k] = v;
  }
  const extraNotes = [];
  for (const [f, label] of REMARK_FIELDS) {
    const theirs = String(from[f] || "").trim();
    if (!theirs) continue;
    const ours = String(copy[f] || "").trim();
    if (!ours) copy[f] = theirs;
    else if (ours.toLowerCase() !== theirs.toLowerCase()) extraNotes.push(`${label} from Leads: ${theirs}`);
  }
  const seen = new Set((copy.notes || []).map((n) => String(n.text || "").trim().toLowerCase()));
  for (const n of from.notes || []) if (!seen.has(String(n.text || "").trim().toLowerCase())) copy.notes.push(n);
  for (const text of extraNotes) copy.notes.push({ text, addedBy: user._id, addedByName: user.name || "", createdAt: new Date() });
  copy.tags = [...new Set([...(copy.tags || []), ...(from.tags || [])])];
  const keys = new Set((copy.formResponses || []).map((r) => r.fieldKey));
  for (const r of from.formResponses || []) if (!keys.has(r.fieldKey)) copy.formResponses.push(r);
  const acts = from.activities || [];
  copy.activities.push(...acts.slice(0, -1), { ...acts[acts.length - 1], description: `Moved from Leads to ${projectName || "a project"}; merged with the entry already there` });
  copy.fromLeadId = leadDoc._id;
  copy.transferredAt = new Date();
  return copy;
}

// One lead into a project: merge into the entry already there, or create one.
// Returns { projectLead, merged }.
async function moveLeadIntoProject(leadDoc, project, user) {
  const existing = await findCopyInProject(user.orgId, project._id, leadDoc);
  if (existing) {
    mergeLeadIntoCopy(existing, leadDoc, user, project.name);
    await existing.save({ validateBeforeSave: false });
    return { projectLead: existing, merged: true };
  }
  const projectLead = await ProjectLead.create(projectLeadFromLead(leadDoc, project._id, user, { projectName: project.name }));
  return { projectLead, merged: false };
}

// ── Keeping the two copies in step ────────────────────────────────────────────
// While a lead sits in Leads AND in a project (routing filed it there), edits
// made on one are written to the other: remarks, status, booking, notes. Only
// the fields that were just edited are sent, so filing a copy never overwrites
// anything. Follow-up dates are deliberately not mirrored: the Follow Ups page
// and the reminders already read both sides, so a mirrored date would be
// counted twice. Everything here is best-effort and uses plain updates (no
// save hooks), so a mirrored write can never bounce back and loop.
const PL_TO_LEAD = { remark1: "remark1", remark2: "remark2", remark3: "remark3", remark4: "remark4", booking: "booking", remarkNote: "remark", status: "status" };
const LEAD_TO_PL = { remark1: "remark1", remark2: "remark2", remark3: "remark3", remark4: "remark4", booking: "booking", remark: "remarkNote", status: "status" };
const SITE_VISIT = ["Site Visit Booked", "Site Visit Done"];

function liveLeadFor(orgId, pl) {
  const variants = phoneVariants(pl.phone);
  if (!variants.length) return null;
  return Lead.findOne({ orgId, phone: { $in: variants }, isDeleted: { $ne: true }, isArchived: { $ne: true } }).sort({ createdAt: -1 });
}
function openCopiesOf(orgId, lead) {
  const variants = phoneVariants(lead.phone);
  if (!variants.length) return [];
  return ProjectLead.find({ orgId, phone: { $in: variants }, fromLeadId: null });
}

// op: { fields: ["remark1", ...] } and/or { note: { op: "add"|"edit"|"delete", note } }
async function mirrorProjectEdit(pl, op, user) {
  try {
    if (!pl || pl.fromLeadId) return;       // moved: the project entry is the only one
    const orgId = pl.orgId || (await require("../models/Project").findById(pl.project).select("orgId").lean())?.orgId;
    if (!orgId) return;
    const lead = await liveLeadFor(orgId, pl);
    if (!lead) return;
    const $set = {}; const $push = {}; const $pull = {};
    for (const f of op.fields || []) if (PL_TO_LEAD[f] && !(f === "status" && !pl.status)) $set[PL_TO_LEAD[f]] = pl[f] ?? "";
    // What the project work means for the lead's own status (forward only).
    let status = $set.status;
    if (!status && (op.fields || []).includes("remark") && pl.remark === "Contacted" && lead.status === "New") status = "Contacted";
    if (!status && (op.fields || []).includes("booking") && SITE_VISIT.includes(pl.booking) && ["New", "Contacted"].includes(lead.status)) status = "Site Visit";
    if (status && status !== lead.status) {
      $set.status = status;
      if (status === "Contacted" && !lead.firstContactedAt) $set.firstContactedAt = new Date();
      $push.activities = { type: "status_changed", description: `Status changed from "${lead.status}" to "${status}" (updated in the project)`, performedBy: user?._id, performedByName: user?.name || "", meta: { from: lead.status, to: status } };
    } else delete $set.status;
    const n = op.note;
    if (n?.note) {
      const has = lead.notes.some((x) => String(x._id) === String(n.note._id));
      if (n.op === "add" && !has) $push.notes = { _id: n.note._id, text: n.note.text, addedBy: n.note.addedBy, addedByName: n.note.addedByName, createdAt: n.note.createdAt };
      if (n.op === "edit" && has) { await Lead.updateOne({ _id: lead._id, "notes._id": n.note._id }, { $set: { "notes.$.text": n.note.text } }); }
      if (n.op === "delete" && has) $pull.notes = { _id: n.note._id };
    }
    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($push).length) update.$push = $push;
    if (Object.keys($pull).length) update.$pull = $pull;
    if (Object.keys(update).length) await Lead.updateOne({ _id: lead._id }, update);
  } catch (err) {
    logger.error(`[copy sync] project -> lead failed for ${pl?._id}: ${err.message}`);
  }
}

async function mirrorLeadEdit(lead, op, user) {
  try {
    if (!lead) return;
    const copies = await openCopiesOf(lead.orgId, lead);
    for (const pl of copies) {
      const $set = {}; const $push = {}; const $pull = {};
      for (const f of op.fields || []) if (LEAD_TO_PL[f]) $set[LEAD_TO_PL[f]] = lead[f] ?? "";
      if ($set.booking && SITE_VISIT.includes($set.booking)) $set.isProspective = true;
      if ($set.status && $set.status !== "New" && !pl.remark) $set.remark = "Contacted";
      const n = op.note;
      if (n?.note) {
        const has = pl.notes.some((x) => String(x._id) === String(n.note._id));
        if (n.op === "add" && !has) $push.notes = { _id: n.note._id, text: n.note.text, addedBy: n.note.addedBy, addedByName: n.note.addedByName, createdAt: n.note.createdAt };
        if (n.op === "edit" && has) await ProjectLead.updateOne({ _id: pl._id, "notes._id": n.note._id }, { $set: { "notes.$.text": n.note.text } });
        if (n.op === "delete" && has) $pull.notes = { _id: n.note._id };
      }
      const update = {};
      if (Object.keys($set).length) update.$set = $set;
      if (Object.keys($push).length) update.$push = $push;
      if (Object.keys($pull).length) update.$pull = $pull;
      if (Object.keys(update).length) await ProjectLead.updateOne({ _id: pl._id }, update);
    }
  } catch (err) {
    logger.error(`[copy sync] lead -> project failed for ${lead?._id}: ${err.message}`);
  }
}

module.exports = { phoneVariants, projectCopiesFor, findCopyInProject, moveLeadIntoProject, mirrorProjectEdit, mirrorLeadEdit, mergeLeadIntoCopy };
