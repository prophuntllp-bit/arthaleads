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
  Ticket:           { drop: "userId" },

  // Organisation records that outlive whoever touched them.
  Lead: {
    scalar: [["createdBy", null], ["assignedTo", "assignedToName"], ["followUpSetBy", "followUpSetByName"]],
    arrays: [["notes", "addedBy", "addedByName"], ["activities", "performedBy", "performedByName"]],
  },
  ProjectLead: {
    scalar: [["remarkUpdatedBy", null], ["followUpSetBy", "followUpSetByName"], ["importedBy", null]],
    arrays: [["notes", "addedBy", "addedByName"], ["activities", "performedBy", "performedByName"]],
  },
  Task:           { scalar: [["assignedTo", "assignedToName"], ["assignedBy", "assignedByName"]] },
  RoutingRule:    { scalar: [["assignTo", "assignToName"], ["createdBy", null]] },
  WaConversation: { scalar: [["assignedTo", "assignedToName"]] },
  Project:        { scalar: [["assignedTo", null], ["createdBy", null]] },
  Automation:     { scalar: [["createdBy", null], ["updatedBy", null]] },
  Booking:        { scalar: [["createdBy", null]] },
  Invoice:        { scalar: [["createdBy", null]] },
  Payment:        { scalar: [["createdBy", null]] },
  Developer:      { scalar: [["createdBy", null]] },
  BlogPost:       { scalar: [["author", null]] },
  Organization:   { scalar: [["approvedBy", null], ["deletionRequestedBy", null]] },

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
