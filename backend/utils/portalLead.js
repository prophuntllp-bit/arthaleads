// utils/portalLead.js - leads from property portals (99acres, Housing.com, MagicBricks).
//
// The portals don't publish one format. Each sends (or lets a CRM fetch) the
// same few facts under different names: "lead_name", "applicant_name",
// "SenderName"... as JSON, a form post, values in the link, or XML. This file
// reads any of those into one shape and saves it as a lead (27 Oct 2026).
//
// A buyer who already has a lead here is not added twice: the new enquiry is
// written on the existing lead and its owner is told. A deleted or archived
// lead doesn't count, the buyer gets a fresh lead (same as WhatsApp, 17 Oct).

const Lead = require("../models/Lead");
const Project = require("../models/Project");
const logger = require("../config/logger");
const { samePhone, phoneKey } = require("./phone");
const { shouldAutoAssign } = require("./autoAssign");
const { getNextAssignee } = require("./assignLead");
const { fileLeadInRoutedProject } = require("./routingRules");
const { emitLeadCreated } = require("./emitLeadCreated");
const { sendPushToAll, sendPushToUser } = require("./push");

const PORTALS = {
  "99acres":   { key: "acres99",     source: "99acres",     label: "99acres" },
  housing:     { key: "housing",     source: "Housing.com", label: "Housing.com" },
  magicbricks: { key: "magicbricks", source: "MagicBricks", label: "MagicBricks" },
};

// Field names seen in portal deliveries and CRM vendors' docs, compared with
// case, spaces, dashes and underscores removed.
const ALIASES = {
  name:      ["name", "leadname", "applicantname", "sendername", "contactname", "customername", "fullname", "buyername", "queriername", "qname", "username", "clientname", "firstname"],
  phone:     ["phone", "mobile", "leadphone", "phonenumber", "mobileno", "mobilenumber", "contactnumber", "contactno", "sendermobile", "sendermobileno", "queriermobile", "qmobile", "phoneno", "contact", "cell", "telephone", "usermobile"],
  email:     ["email", "leademail", "emailid", "senderemail", "querieremail", "qemail", "emailaddress", "useremail", "mail"],
  project:   ["project", "projectname", "propertyname", "propname", "listingtitle", "projecttitle", "society", "subproject", "propertytitle", "listingname"],
  projectId: ["projectid", "listingid", "propid", "propertyid", "propertycode", "resid", "listingcode"],
  locality:  ["locality", "location", "area", "sublocality", "projectlocality", "localityname"],
  city:      ["city", "cityname", "projectcity"],
  message:   ["message", "query", "comments", "comment", "remarks", "requirement", "enquiry", "enquirymessage", "msg", "qmsg", "querymessage", "details"],
  leadId:    ["leadid", "enquiryid", "queryid", "responseid", "qryid", "respid", "uniqueid", "uid", "qid", "id"],
  budget:    ["budget", "budgetrange", "price", "pricerange"],
  date:      ["leaddate", "date", "enquirydate", "querydate", "receivedon", "createdat", "datetime", "time"],
};
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Leaf values of an object, with nested keys flattened (last one wins). */
function flatten(obj, out = {}) {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, out);
    else if (Array.isArray(v)) { if (v.length && typeof v[0] !== "object") out[k] = v.join(", "); }
    else if (v !== null && v !== undefined && String(v).trim() !== "") out[k] = String(v).trim();
  }
  return out;
}

/** Leaf tags of a small XML document as { tag: text }; enough for lead feeds. */
function xmlLeaves(xml) {
  const out = {};
  const re = /<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
  let m;
  while ((m = re.exec(String(xml)))) {
    const text = m[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
    if (text) out[m[1]] = text;
  }
  // CDATA content isn't matched by [^<]*; pick those up too.
  const cre = /<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/\1>/g;
  while ((m = cre.exec(String(xml)))) if (m[2].trim()) out[m[1]] = m[2].trim();
  return out;
}

/**
 * One delivery as a list of raw field maps: a batch ({ leads: [...] } or an
 * array) gives several, anything else gives one. Query values are merged in
 * (MagicBricks puts the lead in the link).
 */
function rawRecords({ body, query, rawText }) {
  const q = { ...(query || {}) };
  if (typeof rawText === "string" && /^\s*</.test(rawText)) {
    // Several <lead>/<Qry>/<Resp> blocks become several records.
    const blocks = rawText.match(/<(lead|Lead|LEAD|Qry|Resp|response|enquiry|record)\b[\s\S]*?<\/\1>/g);
    if (blocks && blocks.length > 1) return blocks.map((b) => ({ ...q, ...xmlLeaves(b) }));
    return [{ ...q, ...xmlLeaves(rawText) }];
  }
  const b = body && typeof body === "object" ? body : {};
  const list = Array.isArray(b) ? b
    : Array.isArray(b.leads) ? b.leads
    : Array.isArray(b.data) ? b.data
    : Array.isArray(b.data?.leads) ? b.data.leads
    : null;
  if (list) return list.filter((r) => r && typeof r === "object").map((r) => ({ ...q, ...flatten(r) }));
  return [{ ...q, ...flatten(b) }];
}

/** A raw field map read into { name, phone, email, project, ..., extra }. */
function readFields(raw) {
  const byNorm = {};
  for (const [k, v] of Object.entries(raw || {})) byNorm[norm(k)] = { key: k, value: v };
  const used = new Set();
  const pick = (field) => {
    for (const a of ALIASES[field]) if (byNorm[a]) { used.add(a); return String(byNorm[a].value).trim(); }
    return "";
  };
  const out = {};
  for (const f of Object.keys(ALIASES)) out[f] = pick(f);
  // First/last name split across two fields.
  const last = byNorm.lastname?.value;
  if (last && out.name && !out.name.includes(last)) { out.name = `${out.name} ${last}`.trim(); used.add("lastname"); }
  const SKIP = new Set(["token", "key", "apikey", "secret", "hash"]);
  out.extra = Object.entries(byNorm)
    .filter(([n]) => !used.has(n) && !SKIP.has(n))
    .map(([, { key, value }]) => ({ key, value: String(value).slice(0, 300) }))
    .slice(0, 30);
  return out;
}

/** Epoch seconds / ms or a date string as a Date, or null. */
function toDate(v) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return new Date(n < 1e12 ? n * 1000 : n);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The org's live project whose name matches what the portal sent, if any. */
async function matchProject(orgId, projectName) {
  const want = norm(projectName);
  if (want.length < 3) return null;
  const projects = await Project.find({ orgId, isArchived: { $ne: true } }).select("name createdBy").lean();
  return projects.find((p) => norm(p.name) === want)
    || projects.find((p) => { const n = norm(p.name); return n.length >= 4 && (want.includes(n) || n.includes(want)); })
    || null;
}

const fmtIst = (d) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/**
 * Save one portal enquiry for an org.
 * @returns {{ result: "created"|"added"|"repeat"|"skipped", leadId?, reason? }}
 */
async function savePortalLead(org, portal, fields, { via = "push" } = {}) {
  const meta = PORTALS[portal];
  const orgId = org._id;
  const key = phoneKey(fields.phone);
  if (!key) return { result: "skipped", reason: "no phone number" };

  const label = meta.label;
  const externalId = fields.leadId ? `${portal}:${fields.leadId}`.slice(0, 200) : "";
  if (externalId && await Lead.exists({ orgId, externalId })) return { result: "repeat" };

  const when = toDate(fields.date) || new Date();
  const where = [fields.project, fields.locality, fields.city].filter(Boolean).join(", ");
  const extraLines = fields.extra.map((e) => `${e.key}: ${e.value}`);
  const enquiryText = [
    `Enquiry from ${label}${where ? ` for ${where}` : ""} (${fmtIst(when)}).`,
    fields.message ? `Message: ${fields.message}` : "",
    fields.budget ? `Budget: ${fields.budget}` : "",
    fields.projectId ? `${label} listing/project ID: ${fields.projectId}` : "",
    ...extraLines,
  ].filter(Boolean).join("\n").slice(0, 3000);

  // Same buyer already a live lead: note the enquiry there instead of a second lead.
  const existing = await Lead.findOne({ orgId, phone: samePhone(fields.phone), isDeleted: { $ne: true }, isArchived: { $ne: true } })
    .sort({ createdAt: -1 });
  if (existing) {
    // A portal re-sending the same enquiry (no id) within 10 minutes is not a new one.
    const tenMin = new Date(Date.now() - 10 * 60 * 1000);
    const recentSame = (existing.activities || []).some((a) => a.meta?.portal === portal && a.createdAt >= tenMin);
    if (recentSame) return { result: "repeat", leadId: existing._id };
    existing.notes.push({ text: enquiryText, addedBy: null, addedByName: label });
    existing.activities.push({
      type: "note_added",
      description: `Enquired again on ${label}${fields.project ? ` (${fields.project})` : ""}`,
      performedByName: label,
      meta: { portal, via, externalId, project: fields.project || "" },
    });
    if (externalId && !existing.externalId) existing.externalId = externalId;
    await existing.save();
    const body = `${existing.name} enquired again on ${label}${fields.project ? ` for ${fields.project}` : ""}`;
    if (existing.assignedTo) sendPushToUser(existing.assignedTo, { type: "lead_assigned", title: `Repeat enquiry: ${existing.name}`, body, data: { url: "/leads", leadId: String(existing._id) } }).catch(() => {});
    else sendPushToAll({ type: "new_lead", title: `Repeat enquiry from ${label}`, body, data: { url: "/leads", leadId: String(existing._id) } }, orgId).catch(() => {});
    return { result: "added", leadId: existing._id };
  }

  let assignee = null;
  if (shouldAutoAssign(org)) { try { assignee = await getNextAssignee(orgId); } catch { /* nobody active */ } }
  const project = fields.project ? await matchProject(orgId, fields.project) : null;
  const name = fields.name && fields.name.length >= 2 ? fields.name.slice(0, 120) : `${label} lead`;

  let lead;
  try {
    lead = await Lead.create({
      name,
      phone: String(fields.phone).trim().slice(0, 30),
      email: /^\S+@\S+\.\S+$/.test(fields.email) ? fields.email.toLowerCase() : "",
      source: meta.source,
      status: "New",
      ...(externalId ? { externalId } : {}),
      city: fields.city.slice(0, 80),
      preferredLocation: (fields.locality || "").slice(0, 120),
      requirements: (fields.message || "").slice(0, 1000),
      leadSourceLabel: fields.project ? `${label} - ${fields.project}`.slice(0, 120) : label,
      orgId,
      createdBy: assignee?._id || null,
      assignedTo: assignee?._id || null,
      assignedToName: assignee?.name || "",
      notes: [{ text: enquiryText, addedBy: null, addedByName: label }],
      activities: [{
        type: "created",
        description: `Lead received from ${label}${assignee ? ` - auto-assigned to ${assignee.name}` : " - unassigned"}`,
        performedBy: assignee?._id || null,
        performedByName: assignee?.name || "",
        meta: { portal, via, externalId, project: fields.project || "", projectId: fields.projectId || "" },
      }],
    });
  } catch (err) {
    if (err?.code === 11000 && err.keyPattern?.externalId) return { result: "repeat" };
    throw err;
  }

  if (project) await fileLeadInRoutedProject({ assignToProject: project._id, assignTo: assignee?._id || null, assignToName: assignee?.name || "", ruleOwner: assignee?._id || project.createdBy }, lead);
  emitLeadCreated(lead, { origin: `portal-${portal}`, routeSource: portal, isTest: false, project: project ? { id: project._id, name: project.name } : undefined });

  const pushBody = [lead.phone, fields.project || label].filter(Boolean).join(" · ");
  if (assignee?._id) sendPushToUser(assignee._id, { type: "lead_assigned", title: `New ${label} lead: ${lead.name}`, body: pushBody, data: { url: "/leads", leadId: String(lead._id) } }).catch(() => {});
  else sendPushToAll({ type: "new_lead", title: `New ${label} lead`, body: `${lead.name} · ${pushBody}`, data: { url: "/leads", leadId: String(lead._id), leadName: lead.name, source: meta.source } }, orgId).catch(() => {});

  logger.info(`[portal ${portal}] lead created for org ${orgId} via ${via}${project ? ` (project ${project.name})` : ""}`);
  return { result: "created", leadId: lead._id };
}

module.exports = { PORTALS, rawRecords, readFields, savePortalLead, matchProject, xmlLeaves, toDate };
