// services/leadErasure.js
//
// Permanent erasure of a lead, for India's DPDP Act (owner, 28 Oct 2026). When
// a data principal asks the customer org (the data fiduciary) to erase them, or
// the org permanently deletes a lead, the person's data has to actually go:
// not just the Lead document, but every copy and file hanging off it.
//
// ── What personal data hangs off a lead ─────────────────────────────────────
//
//   Lead (the document)          name, phone, email, address, budget, form
//                                answers, notes, remarks, follow-ups, booking
//                                outcome, aiScore (+ reasons), campaignRef,
//                                activities (call history: transcripts, AI
//                                summaries, Vistrow voice calls), consent.
//     activities.meta.recordingUrl -> arthaleads/recordings/<...> in B2 (our
//                                own recordings, EnableX / Plivo). Vistrow
//                                voiceCall.recordingUrl points at Vistrow's own
//                                storage, not ours (see "not reached" below).
//   ProjectLead copies           the same person in a project's lead list:
//                                fromLeadId = lead._id (moved / restored into
//                                a project), or a routing-rule copy (same phone,
//                                no fromLeadId, created with the lead). Same
//                                fields + their own activities / recordings.
//   WaConversation               one per (org, phone): contactName, phone,
//                                internal notes, flow answers, ad clicked.
//   WaMessage                    every message both ways; inbound photos, voice
//                                notes and documents in B2 at
//                                arthaleads/wa-inbound/<orgId>/<month>/<random>.
//   EventReminder                phone + name for an event the person signed up to.
//   Task                         lead + leadName, and a title that usually names them.
//   OutboundDelivery             the lead as sent to Vistrow Voice (payload), phoneKey.
//   MetaEvent                    leadId + stage only (no contact details).
//   CopilotAction                Artha changes made to the lead: `before`
//                                snapshot, subjects[].name.
//   CopilotThread                Artha chats: records[] naming the lead; free
//                                text in turns (expires 90 days after the
//                                chat's last message, TTL index).
//   Booking / Invoice / Payment  customerName, unit and money: financial records.
//   StorageObject                the ledger row for each file above.
//   Backups                      utils/backup.js copies, aged out within 12 months.
//
// ── What hangs off a user (staff) ───────────────────────────────────────────
//   User (name, email, phone, avatar -> arthaleads/avatars/<orgId>/...),
//   Attendance (selfies -> arthaleads/attendance/..., GPS), PushSubscription,
//   CopilotThread / CopilotAction, Ticket (attachments), plus their name
//   denormalised on leads, tasks, etc. Handled by accountDeletionService.eraseUser.
//
// ── What hangs off an org ───────────────────────────────────────────────────
//   Every collection with an orgId (all of the above), the Organization record
//   (logo -> arthaleads/logos/org-<id>), project media (arthaleads/projects/<id>/,
//   brochures/, floorplans/), AuditLog rows keyed by targetOrg, and every file
//   in the ledger for that org. Handled by accountDeletionService.purgeOrg.
//
// ── What this erases, and what it keeps ─────────────────────────────────────
//   Erased: the Lead(s); ProjectLead copies of the same enquiry; recordings and
//   WhatsApp media files (every version, see storage.erase) and their ledger
//   rows; Tasks, EventReminders, MetaEvents, OutboundDeliveries and
//   CopilotActions about the lead; the lead's entries in Artha chat records.
//   The WhatsApp conversation and its messages go when nobody else in the org
//   still holds that number (no other Lead or ProjectLead with it). If another
//   record does, the conversation belongs to that one too: it is kept and only
//   unlinked from the erased lead. So erasing a person who has duplicates means
//   erasing every duplicate; the last one takes the chat with it.
//
//   Kept: Bookings, Invoices and Payments. They are accounting records the org
//   must keep (CGST Act s.35-36 / CGST Rule 56: 72 months; Income-tax Act
//   s.44AA / Rule 6F), which DPDP s.8(7) allows. The booking is unlinked from
//   the lead; the customer name on it stays because the invoice needs it.
//   Media files used by a record that survives (another lead, a kept project
//   entry) are not deleted. Free text in Artha chats is not rewritten; those
//   chats expire on their own within 90 days.
//
//   Not reached from here: copies held by other processors (Vistrow Voice's own
//   call records and recordings, Meta / WhatsApp's copy of the chat, a CRM a
//   webhook already pushed to). Those need a request to that processor.

const mongoose = require("mongoose");
const logger = require("../config/logger");
const storage = require("../utils/storage");
const { phoneVariants } = require("../utils/projectCopies");

const model = (name) => mongoose.models[name] || require(`../models/${name}`);

// Only files that are the person's own are erased with a lead. Project
// brochures, logos and avatars can appear in a chat (a brochure sent to the
// customer), but they belong to the org or its staff.
const PERSONAL_PREFIXES = ["arthaleads/recordings/", "arthaleads/wa-inbound/"];
const isPersonalKey = (key) => PERSONAL_PREFIXES.some((p) => key.startsWith(p));

// A routing rule files its project copy while the lead is being created
// (utils/routingRules.js fileLeadInRoutedProject), so a copy with no fromLeadId
// made within this window of the lead is that copy, not an earlier import.
const ROUTED_COPY_WINDOW_MS = 10 * 60 * 1000;

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mediaMatch = (key) => new RegExp(`/api/media/${esc(key.split("/").map(encodeURIComponent).join("/"))}`);

/**
 * Erase files from storage. Tolerates files that are already gone; logs each
 * one that could not be removed so it can be removed by hand. Never throws:
 * the records pointing at the files are already erased by the time this runs,
 * and failing the request would not bring them back.
 */
async function eraseFiles(keys, context) {
  const list = [...new Set(keys)].filter(Boolean);
  const result = { removed: 0, failed: [] };
  if (!list.length) return result;
  if (!storage.isConfigured()) {
    result.failed = list;
    logger.error(`[erasure] ${context}: file storage is not configured, ${list.length} file(s) NOT erased: ${list.join(", ")}`);
    return result;
  }
  for (const key of list) {
    try {
      await storage.erase(key);
      result.removed++;
      logger.info(`[erasure] ${context}: erased file ${key}`);
    } catch (err) {
      result.failed.push(key);
      logger.error(`[erasure] ${context}: could not erase file ${key}: ${err.message}`);
    }
  }
  return result;
}

/** Does any record of this org that is NOT being erased still use this file? */
async function fileStillUsed(orgId, key) {
  const match = mediaMatch(key);
  const Lead = model("Lead"), ProjectLead = model("ProjectLead"), WaMessage = model("WaMessage");
  return !!(
    (await Lead.exists({ orgId, "activities.meta.recordingUrl": match })) ||
    (await ProjectLead.exists({ orgId, "activities.meta.recordingUrl": match })) ||
    (await WaMessage.exists({ orgId, mediaUrl: match }))
  );
}

/** The person's own files referenced by these documents, for this org only. */
async function personalKeysIn(orgId, docs) {
  const keys = new Set();
  for (const doc of docs) for (const key of storage.keysIn(doc)) if (isPersonalKey(key)) keys.add(key);
  if (!keys.size) return [];
  // A wa-inbound key names its org; a ledger row names the owner of any key.
  // Never erase another org's file because a URL to it was pasted here.
  const owners = await model("StorageObject").find({ key: { $in: [...keys] } }).select("key orgId").lean();
  const ownerOf = new Map(owners.map((o) => [o.key, String(o.orgId)]));
  return [...keys].filter((key) => {
    const owner = ownerOf.get(key);
    if (owner && owner !== String(orgId)) return false;
    const m = /^arthaleads\/wa-inbound\/([^/]+)\//.exec(key);
    return !m || m[1] === String(orgId);
  });
}

/**
 * Erase the given Lead and ProjectLead documents (already loaded, lean) and
 * everything about the people in them. Returns counts for the log and tests.
 */
async function eraseRecords(orgId, leads, projectLeads, context) {
  orgId = oid(orgId);
  const Lead = model("Lead"), ProjectLead = model("ProjectLead");
  const WaConversation = model("WaConversation"), WaMessage = model("WaMessage");
  const summary = { leads: 0, projectLeads: 0, conversations: 0, conversationsKept: 0, messages: 0, tasks: 0, reminders: 0, files: 0, filesFailed: 0 };

  const leadIds = leads.map((l) => l._id);
  const plIds = projectLeads.map((p) => p._id);
  const allIds = [...leadIds, ...plIds];
  if (!allIds.length) return summary;

  const fileKeys = new Set(await personalKeysIn(orgId, [...leads, ...projectLeads]));

  // 1. The records themselves.
  if (leadIds.length) summary.leads = (await Lead.deleteMany({ _id: { $in: leadIds }, orgId })).deletedCount || 0;
  if (plIds.length) summary.projectLeads = (await ProjectLead.deleteMany({ _id: { $in: plIds } })).deletedCount || 0;

  // 2. WhatsApp: the conversation for each number, unless someone else in the
  //    org still holds that number (see the header).
  const phones = [...new Set([...leads, ...projectLeads].map((r) => r.phone).filter(Boolean))];
  const variants = [...new Set(phones.flatMap((p) => [p, ...phoneVariants(p)]))];
  const convs = await WaConversation.find({
    orgId,
    $or: [{ leadId: { $in: leadIds } }, ...(variants.length ? [{ contactPhone: { $in: variants } }] : [])],
  }).select("_id leadId contactPhone").lean();

  const doomedConvIds = [];
  for (const c of convs) {
    const cv = [c.contactPhone, ...phoneVariants(c.contactPhone)];
    const stillHeld = (await Lead.exists({ orgId, phone: { $in: cv } })) || (await ProjectLead.exists({ orgId, phone: { $in: cv } }));
    if (stillHeld) {
      summary.conversationsKept++;
      if (c.leadId && leadIds.some((id) => String(id) === String(c.leadId))) {
        await WaConversation.updateOne({ _id: c._id }, { $set: { leadId: null } });
      }
    } else {
      doomedConvIds.push(c._id);
    }
  }
  if (doomedConvIds.length) {
    const msgs = await WaMessage.find({ orgId, conversationId: { $in: doomedConvIds }, mediaUrl: { $nin: ["", null] } }).select("mediaUrl").lean();
    for (const k of await personalKeysIn(orgId, msgs)) fileKeys.add(k);
    summary.messages = (await WaMessage.deleteMany({ orgId, conversationId: { $in: doomedConvIds } })).deletedCount || 0;
    summary.conversations = (await WaConversation.deleteMany({ orgId, _id: { $in: doomedConvIds } })).deletedCount || 0;
  }

  // 3. Records that exist only because of this lead, or carry its details.
  summary.reminders = (await model("EventReminder").deleteMany({
    orgId, $or: [{ leadId: { $in: leadIds } }, { conversationId: { $in: doomedConvIds } }],
  })).deletedCount || 0;
  if (leadIds.length) {
    summary.tasks = (await model("Task").deleteMany({ orgId, lead: { $in: leadIds } })).deletedCount || 0;
    await model("MetaEvent").deleteMany({ orgId, leadId: { $in: leadIds } });
    await model("OutboundDelivery").deleteMany({ orgId, leadId: { $in: leadIds } });
    // Financial record, kept by law (see header): only the link to the lead goes.
    await model("Booking").updateMany({ orgId, leadId: { $in: leadIds } }, { $set: { leadId: null } });
  }
  await model("CopilotAction").deleteMany({ orgId, "subjects.id": { $in: allIds } });
  const idStrings = allIds.map(String);
  await model("CopilotThread").updateMany(
    { orgId, "turns.records.id": { $in: idStrings } },
    { $pull: { "turns.$[].records": { id: { $in: idStrings } } } }
  );

  // 4. Files, last, and only those nothing kept still points at.
  const toErase = [];
  for (const key of fileKeys) if (!(await fileStillUsed(orgId, key))) toErase.push(key);
  const files = await eraseFiles(toErase, context);
  summary.files = files.removed;
  summary.filesFailed = files.failed.length;

  // Ids and counts only: the log must not become another copy of the person.
  logger.warn(`[erasure] ${context}: ${JSON.stringify(summary)}`);
  return summary;
}

/** ProjectLead copies of these leads: moved/restored copies, and routing-rule copies. */
async function projectCopiesOf(orgId, leads) {
  const ProjectLead = model("ProjectLead");
  const ids = leads.map((l) => l._id);
  const linked = await ProjectLead.find({ orgId, fromLeadId: { $in: ids } }).lean();
  const routed = [];
  for (const l of leads) {
    const v = phoneVariants(l.phone);
    if (!v.length || !l.createdAt) continue;
    const at = new Date(l.createdAt).getTime();
    routed.push(...await ProjectLead.find({
      orgId, fromLeadId: null, phone: { $in: v },
      createdAt: { $gte: new Date(at - ROUTED_COPY_WINDOW_MS), $lte: new Date(at + ROUTED_COPY_WINDOW_MS) },
    }).lean());
  }
  const byId = new Map([...linked, ...routed].map((p) => [String(p._id), p]));
  return [...byId.values()];
}

/**
 * Permanently erase leads of an org and everything about them. Used by every
 * permanent-delete path in services/leadService.js. Returns the summary;
 * summary.leads is how many Lead documents were removed.
 */
async function eraseLeads(orgId, ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => mongoose.isValidObjectId(id)).map(oid);
  if (!list.length) return eraseRecords(orgId, [], [], "leads");
  const leads = await model("Lead").find({ _id: { $in: list }, orgId: oid(orgId) }).lean();
  const copies = await projectCopiesOf(oid(orgId), leads);
  return eraseRecords(orgId, leads, copies, `org ${orgId} lead(s) ${leads.map((l) => l._id).join(",")}`);
}

/**
 * Permanently erase project-list entries (the super admin hard delete in
 * services/projectService.js). The Lead they were moved from, if any, is a
 * separate record and stays; erase it from Leads / Dump to remove it too.
 */
async function eraseProjectLeads(orgId, ids, { projectId } = {}) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => mongoose.isValidObjectId(id)).map(oid);
  const filter = { _id: { $in: list }, ...(projectId ? { project: oid(projectId) } : {}) };
  const pls = list.length ? await model("ProjectLead").find(filter).lean() : [];
  // Old project entries may predate orgId on ProjectLead; the caller has already
  // checked the project belongs to this org.
  return eraseRecords(orgId, [], pls, `org ${orgId} project lead(s) ${pls.map((p) => p._id).join(",")}`);
}

module.exports = { eraseLeads, eraseProjectLeads, eraseFiles, personalKeysIn, PERSONAL_PREFIXES };
