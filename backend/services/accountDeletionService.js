// services/accountDeletionService.js
//
// Account deletion, as Google Play's User Data policy requires it: a person can
// remove their account and the data attached to it, and what follows is an
// actual erase rather than a deactivation.
//
// Two paths, because a CRM is multi-tenant and "your data" means two different
// things depending on who is asking:
//
//   * Anyone whose organisation still has another admin is removed straight
//     away. Their personal data goes; the organisation's business records stay,
//     because leads and bookings belong to the company, other people are still
//     working them, and the company is the controller of that data. The
//     departing person is unlinked from them and their name is scrubbed.
//
//   * The last admin of an organisation is different: there is nobody left to
//     hand the company's data to, so deleting them means closing the
//     organisation. That is scheduled 30 days out rather than done on the spot.
//     One misdirected click should not destroy a company's CRM, and signing
//     back in during the window cancels it. The account keeps working well
//     enough to authenticate for exactly that reason -- it cannot be erased on
//     day 0 if logging in is what cancels the deletion.
//
// DISPOSITION below is deliberately explicit rather than reflected. Guessing
// per-collection semantics is how you either orphan a foreign key or delete a
// company's pipeline; but a hand-written map also rots the moment somebody adds
// a model, so the test suite reflects over mongoose.models and fails when a
// collection referencing User is missing here.

const mongoose = require("mongoose");
const logger = require("../config/logger");

/** The window between requesting organisation deletion and it happening. */
const GRACE_DAYS = 30;

/** Replaces a departed person's name wherever one was denormalised. */
const TOMBSTONE = "Deleted user";

// What happens to each collection that references a User.
//
//   drop    — the document exists only because that person did; it goes.
//   scalar  — [refField, nameField|null] pairs, cleared on the document.
//   arrays  — [arrayPath, refField, nameField|null], cleared per matching element.
//   pull    — array fields of user ids; the person is removed from the list, the others stay.
//   scrub   — free-text fields holding the person's own details, emptied.
//
// Customer-facing names (Booking.customerName, Invoice.customerName,
// WaConversation.contactName) are deliberately absent: those describe the
// organisation's clients, not its staff, and belong to the organisation.
const DISPOSITION = {
  // Exists only to serve one person.
  Attendance:       { drop: "userId" },
  PushSubscription: { drop: "userId" },
  CopilotAction:    { drop: "userId" },
  CopilotThread:    { drop: "userId" },   // a person's own Artha chats go with them
  Ticket:           { drop: "userId" },

  // Organisation records that outlive whoever touched them.
  Lead: {
    scalar: [["createdBy", null], ["assignedTo", "assignedToName"], ["followUpSetBy", "followUpSetByName"], ["deletedBy", "deletedByName"]],
    arrays: [["notes", "addedBy", "addedByName"], ["activities", "performedBy", "performedByName"]],
  },
  ProjectLead: {
    scalar: [["remarkUpdatedBy", null], ["followUpSetBy", "followUpSetByName"], ["importedBy", null], ["assignedTo", "assignedToName"]],
    arrays: [["notes", "addedBy", "addedByName"], ["activities", "performedBy", "performedByName"]],
  },
  Task:           { scalar: [["assignedTo", "assignedToName"], ["assignedBy", "assignedByName"]] },
  RoutingRule:    { scalar: [["assignTo", "assignToName"], ["createdBy", null]] },
  OutboundIntegration: { scalar: [["createdBy", null], ["updatedBy", null], ["enabledBy", "enabledByName"]] },
  WaConversation: { scalar: [["assignedTo", "assignedToName"]] },
  // assignedTo is a list of people: only this person leaves it (setting it to null
  // would have taken every other assignee off the project too).
  Project:        { scalar: [["createdBy", null], ["advisorId", null]], pull: ["assignedTo"] },
  Automation:     { scalar: [["createdBy", null], ["updatedBy", null]] },
  Booking:        { scalar: [["createdBy", null]] },
  Invoice:        { scalar: [["createdBy", null]] },
  Payment:        { scalar: [["createdBy", null]] },
  Developer:      { scalar: [["createdBy", null]] },
  BlogPost:       { scalar: [["author", null]] },
  // A website demo request is about the prospect; only the admin who handled it is unlinked.
  DemoRequest:    { scalar: [["handledBy", null]] },
  // Kept and unlinked rather than dropped. A report is a signal about the
  // model's output, not a record about the person who raised it, and deleting
  // it would throw away the moderation history Play expects us to act on.
  ContentReport:  { scalar: [["userId", null]] },
  Organization:   { scalar: [["approvedBy", null], ["deletionRequestedBy", null]],
    pull: ["whatsapp.notifyOn.newConversation", "whatsapp.notifyOn.lowCredits", "whatsapp.notifyOn.qualityDrop"] },

  // Who created an order, agent or campaign. The record is the organisation's.
  CreditOrder:    { scalar: [["createdBy", null]] },
  StorageOrder:   { scalar: [["createdBy", null]] },
  WaAgent:        { scalar: [["createdBy", "createdByName"]] },
  WaCampaign:     { scalar: [["createdBy", "createdByName"]] },

  // The audit trail is kept — it is the record of who did what to whom, and
  // erasing it on request would make it useless as a security control. The
  // person is unlinked from it instead, and everything identifying them,
  // including the IP, is removed.
  AuditLog: {
    scalar: [["performedBy", "performedByName"], ["targetUser", "targetUserName"]],
    scrub: ["ip"],
  },
};

const model = (name) => mongoose.models[name];

// ── Stored files (DPDP, owner, 28 Oct 2026) ─────────────────────────────────
// Deleting the documents used to leave every file they pointed at in the
// bucket: selfies, avatars, recordings, WhatsApp media, project media. Files are
// now found before the documents go (by the URLs in them, the storage ledger
// and the org's own key prefixes) and erased after. What the records hold, per
// lead, user and org, is mapped at the top of services/leadErasure.js.

// Platform files that are never any one org's, even if an org links to them.
const PLATFORM_PREFIXES = ["arthaleads/blog/", "arthaleads/site/", "arthaleads/backups/"];
const isOrgFile = (key) => !PLATFORM_PREFIXES.some((p) => key.startsWith(p));

/** Storage keys referenced by the documents `filter` matches in `Model`. */
async function keysInDocs(Model, filter) {
  const { keysIn } = require("../utils/storage");
  const keys = new Set();
  const add = (doc) => { for (const key of keysIn(doc)) if (isOrgFile(key)) keys.add(key); };
  const query = Model.find(filter).lean();
  // Streamed: an org's messages alone can run to hundreds of thousands.
  if (typeof query.cursor === "function") for await (const doc of query.cursor()) add(doc);
  else for (const doc of (await query) || []) add(doc);
  return keys;
}

/** Keys under a prefix in the bucket itself, for files no record points at any more. */
async function keysUnder(prefix) {
  const storage = require("../utils/storage");
  if (!storage.isConfigured()) return [];
  try { return (await storage.list(prefix)).map((o) => o.key); }
  catch (err) { logger.warn(`[account-deletion] could not list ${prefix}: ${err.message}`); return []; }
}

/** Drop keys whose ledger row says another org owns them. */
async function onlyOwnedBy(orgId, keys) {
  const list = [...keys];
  if (!list.length || !model("StorageObject")) return list;
  const rows = await model("StorageObject").find({ key: { $in: list } }).select("key orgId").lean();
  const other = new Set((rows || []).filter((r) => orgId && String(r.orgId) !== String(orgId)).map((r) => r.key));
  return list.filter((k) => !other.has(k));
}

const eraseFiles = (keys, context) => require("./leadErasure").eraseFiles(keys, context);

/**
 * Removes a person and unlinks them from everything the organisation keeps.
 * Does not touch the organisation itself.
 */
async function eraseUser(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const User = model("User");
  const user = await User.findById(id).lean();
  if (!user) return { erased: false, reason: "not found" };

  const touched = {};

  // Their own files: the avatar (every one they ever uploaded) and the files
  // on the rows that are dropped with them (attendance selfies, ticket
  // attachments). Found now, erased once the records are gone.
  const files = new Set(require("../utils/storage").keysIn(user.avatar || ""));
  for (const [name, rule] of Object.entries(DISPOSITION)) {
    if (!rule.drop || !model(name)) continue;
    for (const key of await keysInDocs(model(name), { [rule.drop]: id })) files.add(key);
  }
  if (user.orgId) for (const key of await keysUnder(`arthaleads/avatars/${user.orgId}/${id}-`)) files.add(key);

  for (const [name, rule] of Object.entries(DISPOSITION)) {
    const Model = model(name);
    if (!Model) continue; // model not registered in this process

    if (rule.drop) {
      const { deletedCount } = await Model.deleteMany({ [rule.drop]: id });
      if (deletedCount) touched[name] = `${deletedCount} deleted`;
      continue;
    }

    let changed = 0;

    // Scrub before the refs are cleared, not after. These rows are found BY
    // the ref, so clearing it first leaves nothing for this query to match --
    // which is how the IP survived a deletion that reported success. A test
    // that only records queries cannot see it: both statements are issued and
    // both look right in isolation.
    for (const field of rule.scrub || []) {
      const q = rule.scalar
        ? { $or: rule.scalar.map(([ref]) => ({ [ref]: id })) }
        : { [field]: { $ne: null } };
      const res = await Model.updateMany(q, { $set: { [field]: "" } });
      changed += res.modifiedCount || 0;
    }

    for (const [ref, nameField] of rule.scalar || []) {
      const set = { [ref]: null };
      if (nameField) set[nameField] = TOMBSTONE;
      const res = await Model.updateMany({ [ref]: id }, { $set: set });
      changed += res.modifiedCount || 0;
    }

    for (const path of rule.pull || []) {
      const res = await Model.updateMany({ [path]: id }, { $pull: { [path]: id } });
      changed += res.modifiedCount || 0;
    }

    // Array elements need arrayFilters — a bare $[] would clear the entry for
    // everyone who ever added a note, not just this person.
    for (const [path, ref, nameField] of rule.arrays || []) {
      const set = { [`${path}.$[el].${ref}`]: null };
      if (nameField) set[`${path}.$[el].${nameField}`] = TOMBSTONE;
      const res = await Model.updateMany(
        { [`${path}.${ref}`]: id },
        { $set: set },
        { arrayFilters: [{ [`el.${ref}`]: id }] }
      );
      changed += res.modifiedCount || 0;
    }

    if (changed) touched[name] = `${changed} unlinked`;
  }

  // The person's own record goes last, so a failure part-way leaves an account
  // that can be retried rather than orphaned rows with no owner.
  await User.deleteOne({ _id: id });
  touched.User = "1 deleted";

  const fileResult = await eraseFiles(await onlyOwnedBy(user.orgId, files), `user ${id}`);
  if (fileResult.removed || fileResult.failed.length) touched.files = `${fileResult.removed} erased, ${fileResult.failed.length} failed`;

  logger.info(`[account-deletion] erased user ${id}: ${JSON.stringify(touched)}`);
  return { erased: true, touched };
}

/**
 * Deletes an organisation and everything belonging to it.
 *
 * Collections are found by reflection rather than listed: every model carrying
 * an orgId is purged by it. A hand-maintained list would silently miss the next
 * collection somebody adds, and missing one here means retaining a company's
 * data after telling them it was destroyed.
 */
async function purgeOrg(orgId) {
  const id = new mongoose.Types.ObjectId(String(orgId));
  const purged = {};

  // Every file the org holds, found before its records are deleted: the
  // ledger, every /api/media URL in any of its documents (logo, avatars,
  // selfies, recordings, WhatsApp media, project media), and its own folders.
  const files = new Set();
  const StorageObject = model("StorageObject");
  if (StorageObject) for (const r of (await StorageObject.find({ orgId: id }).select("key").lean()) || []) files.add(r.key);
  for (const [name, Model] of Object.entries(mongoose.models)) {
    if (name === "StorageObject") continue;
    const filter = name === "Organization" ? { _id: id } : Model.schema.path("orgId") ? { orgId: id } : null;
    if (!filter) continue;
    for (const key of await keysInDocs(Model, filter)) files.add(key);
  }
  const projects = model("Project") ? (await model("Project").find({ orgId: id }).select("_id").lean()) || [] : [];
  const prefixes = [`arthaleads/wa-inbound/${id}/`, `arthaleads/avatars/${id}/`, `arthaleads/logos/org-${id}`,
    ...projects.flatMap((p) => [`arthaleads/projects/${p._id}/`, `arthaleads/brochures/project-${p._id}`, `arthaleads/floorplans/project-${p._id}`])];
  for (const prefix of prefixes) for (const key of await keysUnder(prefix)) files.add(key);

  for (const [name, Model] of Object.entries(mongoose.models)) {
    if (name === "Organization") continue;
    if (!Model.schema.path("orgId")) continue;
    const { deletedCount } = await Model.deleteMany({ orgId: id });
    if (deletedCount) purged[name] = deletedCount;
  }

  // AuditLog has no orgId — it is keyed to the org through targetOrg.
  const AuditLog = model("AuditLog");
  if (AuditLog) {
    const { deletedCount } = await AuditLog.deleteMany({ targetOrg: id });
    if (deletedCount) purged.AuditLog = deletedCount;
  }

  await model("Organization").deleteOne({ _id: id });
  purged.Organization = 1;

  // Last, so a file that will not delete never holds up erasing the records.
  // Each one left behind is logged by key (leadErasure.eraseFiles).
  const fileResult = await eraseFiles(await onlyOwnedBy(id, files), `org ${id}`);
  purged.files = fileResult.removed;
  if (fileResult.failed.length) purged.filesFailed = fileResult.failed.length;

  logger.warn(`[account-deletion] purged org ${id}: ${JSON.stringify(purged)}`);
  return purged;
}

/** True when this person is the only active admin their organisation has. */
async function isLastAdmin(user) {
  if (!user.orgId) return false;
  const others = await model("User").countDocuments({
    orgId: user.orgId,
    role: "admin",
    isActive: true,
    _id: { $ne: user._id },
  });
  return others === 0;
}

/**
 * Entry point for "delete my account". Picks the path and returns what
 * happened, so the caller can tell the person which one they got.
 */
async function requestDeletion(user) {
  const lastAdmin = user.role === "admin" && (await isLastAdmin(user));

  if (!lastAdmin) {
    await eraseUser(user._id);
    return { outcome: "erased" };
  }

  const scheduledFor = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  await model("Organization").updateOne(
    { _id: user.orgId },
    { $set: { deletionScheduledAt: scheduledFor, deletionRequestedBy: user._id, deletionRequestedAt: new Date() } }
  );
  logger.warn(`[account-deletion] org ${user.orgId} scheduled for ${scheduledFor.toISOString()} by ${user._id}`);
  return { outcome: "scheduled", scheduledFor, graceDays: GRACE_DAYS };
}

/** Called when someone signs back in during the window and changes their mind. */
async function cancelDeletion(user) {
  const res = await model("Organization").updateOne(
    { _id: user.orgId, deletionScheduledAt: { $ne: null } },
    { $set: { deletionScheduledAt: null, deletionRequestedBy: null, deletionRequestedAt: null } }
  );
  if (!res.matchedCount) return { cancelled: false };
  logger.info(`[account-deletion] org ${user.orgId} deletion cancelled by ${user._id}`);
  return { cancelled: true };
}

/** Cron entry point: carries out every deletion whose window has elapsed. */
async function runDueDeletions() {
  const due = await model("Organization")
    .find({ deletionScheduledAt: { $ne: null, $lte: new Date() } })
    .select("_id name")
    .lean();

  if (!due.length) return { processed: 0 };

  for (const org of due) {
    try {
      await purgeOrg(org._id);
    } catch (err) {
      // Keep going: one organisation failing to purge should not hold up the
      // rest, and the record stays due so the next run retries it.
      logger.error(`[account-deletion] purge failed for org ${org._id}: ${err.message}`);
    }
  }
  return { processed: due.length };
}

module.exports = {
  requestDeletion,
  cancelDeletion,
  runDueDeletions,
  eraseUser,
  purgeOrg,
  isLastAdmin,
  GRACE_DAYS,
  TOMBSTONE,
  DISPOSITION,
};
