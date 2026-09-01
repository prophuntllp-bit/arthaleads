// The deletion service against a real MongoDB.
//
// The other two suites check that the map is complete and that the right
// queries are issued. Neither actually runs them, and purgeOrg destroys a
// company's CRM irreversibly -- not something to ship on the strength of
// recorded arguments. This one starts a real server, writes real documents,
// and reads back what survived.
//
// The property that matters most is tenant isolation: purging one organisation
// must leave every other one untouched. A missing orgId filter would pass every
// query-recording test ever written and still destroy unrelated customers.

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const Organization = require("../models/Organization");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const Attendance = require("../models/Attendance");
const PushSubscription = require("../models/PushSubscription");
const AuditLog = require("../models/AuditLog");

const svc = require("../services/accountDeletionService");

let failures = 0;
const check = (ok, msg, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && detail ? `  <- ${detail}` : ""}`);
  if (!ok) failures++;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Two tenants, so isolation can be proved rather than assumed.
  const orgA = await Organization.create({ name: "Rudranee Developers", slug: "rudranee" });
  const orgB = await Organization.create({ name: "Kohinoor Realty", slug: "kohinoor" });

  const asha = await User.create({ name: "Asha Menon", email: "asha@rudranee.in", role: "admin", orgId: orgA._id });
  const bilal = await User.create({ name: "Bilal Khan", email: "bilal@rudranee.in", role: "agent", orgId: orgA._id });
  const chandra = await User.create({ name: "Chandra Rao", email: "chandra@kohinoor.in", role: "admin", orgId: orgB._id });

  // A lead touched by both people in org A, so a sloppy array update shows up.
  const lead = await Lead.create({
    name: "Sunita Desai", phone: "9876543210", orgId: orgA._id,
    createdBy: asha._id, assignedTo: bilal._id, assignedToName: "Bilal Khan",
    notes: [
      { addedBy: bilal._id, addedByName: "Bilal Khan", text: "Called, wants a 3BHK" },
      { addedBy: asha._id, addedByName: "Asha Menon", text: "Following up Monday" },
    ],
    activities: [
      { type: "called", description: "Spoke about the 3BHK", performedBy: bilal._id, performedByName: "Bilal Khan" },
      { type: "assigned", description: "Assigned to Bilal", performedBy: asha._id, performedByName: "Asha Menon" },
    ],
  });

  const leadB = await Lead.create({
    name: "Vikram Joshi", phone: "9000000000", orgId: orgB._id,
    assignedTo: chandra._id, assignedToName: "Chandra Rao",
    notes: [{ addedBy: chandra._id, addedByName: "Chandra Rao", text: "Site visit booked" }],
  });

  await Task.create({
    orgId: orgA._id, title: "Call Sunita", dueDate: new Date(),
    assignedTo: bilal._id, assignedToName: "Bilal Khan",
    assignedBy: asha._id, assignedByName: "Asha Menon",
  });
  await Attendance.create({ userId: bilal._id, orgId: orgA._id, date: "2026-09-01", clockInSelfie: "data:image/png;base64,xx" });
  await Attendance.create({ userId: chandra._id, orgId: orgB._id, date: "2026-09-01" });
  await PushSubscription.create({ userId: bilal._id, orgId: orgA._id });
  await AuditLog.create({ action: "impersonate", performedBy: bilal._id, performedByName: "Bilal Khan", targetOrg: orgA._id, ip: "203.0.113.9" });
  await AuditLog.create({ action: "impersonate", performedBy: chandra._id, performedByName: "Chandra Rao", targetOrg: orgB._id, ip: "198.51.100.4" });

  // ── an agent deletes their account ───────────────────────────────────────
  console.log("\n  An agent deletes their account (the org keeps its admin)\n");
  await svc.requestDeletion({ _id: bilal._id, orgId: orgA._id, role: "agent" });

  check(!(await User.findById(bilal._id)), "the user record is gone");
  check(!!(await User.findById(asha._id)), "their colleague is untouched");
  check((await Attendance.countDocuments({ userId: bilal._id })) === 0, "attendance, with its selfie and location, is deleted");
  check((await PushSubscription.countDocuments({ userId: bilal._id })) === 0, "device tokens are deleted");

  const l = await Lead.findById(lead._id).lean();
  check(l.assignedTo === null, "the lead is unassigned");
  check(l.assignedToName === svc.TOMBSTONE, "the denormalised name is replaced", String(l.assignedToName));
  check(l.createdBy === null || String(l.createdBy) !== String(bilal._id), "createdBy no longer points at them");

  const theirNote = l.notes.find((n) => n.text.startsWith("Called"));
  const herNote = l.notes.find((n) => n.text.startsWith("Following"));
  check(theirNote.addedBy === null && theirNote.addedByName === svc.TOMBSTONE, "their note is anonymised");
  check(String(herNote.addedBy) === String(asha._id) && herNote.addedByName === "Asha Menon",
    "the colleague's note on the SAME lead is untouched", String(herNote.addedByName));

  const theirAct = l.activities.find((a) => a.type === "called");
  const herAct = l.activities.find((a) => a.type === "assigned");
  check(theirAct.performedBy === null, "their activity entry is anonymised");
  check(String(herAct.performedBy) === String(asha._id), "the colleague's activity is untouched");

  const t = await Task.findOne({ orgId: orgA._id }).lean();
  check(t.assignedTo === null && t.assignedToName === svc.TOMBSTONE, "tasks assigned to them are cleared");
  check(String(t.assignedBy) === String(asha._id), "who assigned it is preserved");

  const audit = await AuditLog.findOne({ targetOrg: orgA._id }).lean();
  check(!!audit, "the audit entry survives");
  check(audit.performedBy === null && audit.performedByName === svc.TOMBSTONE, "but is anonymised");
  check(audit.ip === "", "and the IP is scrubbed", String(audit.ip));

  check((await Lead.findById(leadB._id)).assignedToName === "Chandra Rao", "the other tenant's lead is untouched");
  check((await AuditLog.findOne({ targetOrg: orgB._id })).ip === "198.51.100.4", "the other tenant's audit IP is untouched");

  // ── the last admin ───────────────────────────────────────────────────────
  console.log("\n  The last admin asks to delete\n");
  const res = await svc.requestDeletion({ _id: asha._id, orgId: orgA._id, role: "admin" });
  check(res.outcome === "scheduled", "scheduled, not executed", String(res.outcome));
  check(!!(await User.findById(asha._id)), "the account still exists, so they can sign in to cancel");
  check(!!(await Lead.findById(lead._id)), "no company data is touched yet");
  check(!!(await Organization.findById(orgA._id)).deletionScheduledAt, "a date is recorded on the org");

  const early = await svc.runDueDeletions();
  check(early.processed === 0, "the job does nothing while the window is open", String(early.processed));
  check(!!(await Organization.findById(orgA._id)), "the organisation is still there");

  // ── they change their mind ───────────────────────────────────────────────
  console.log("\n  They cancel\n");
  await svc.cancelDeletion({ _id: asha._id, orgId: orgA._id });
  check((await Organization.findById(orgA._id)).deletionScheduledAt === null, "the schedule is cleared");
  check((await svc.runDueDeletions()).processed === 0, "and the job leaves it alone afterwards");

  // ── the window elapses ───────────────────────────────────────────────────
  console.log("\n  Thirty days pass without a cancellation\n");
  await svc.requestDeletion({ _id: asha._id, orgId: orgA._id, role: "admin" });
  await Organization.updateOne({ _id: orgA._id }, { $set: { deletionScheduledAt: new Date(Date.now() - 1000) } });

  const done = await svc.runDueDeletions();
  check(done.processed === 1, "exactly one organisation is purged", String(done.processed));

  check(!(await Organization.findById(orgA._id)), "the organisation record is gone");
  check((await User.countDocuments({ orgId: orgA._id })) === 0, "its users are gone");
  check((await Lead.countDocuments({ orgId: orgA._id })) === 0, "its leads are gone");
  check((await Task.countDocuments({ orgId: orgA._id })) === 0, "its tasks are gone");
  check((await Attendance.countDocuments({ orgId: orgA._id })) === 0, "its attendance is gone");
  check((await AuditLog.countDocuments({ targetOrg: orgA._id })) === 0, "its audit trail is gone");

  console.log("\n  The other tenant, after all of that\n");
  check(!!(await Organization.findById(orgB._id)), "organisation intact");
  check((await User.countDocuments({ orgId: orgB._id })) === 1, "its user intact");
  check((await Lead.countDocuments({ orgId: orgB._id })) === 1, "its lead intact");
  check((await Attendance.countDocuments({ orgId: orgB._id })) === 1, "its attendance intact");
  check((await AuditLog.countDocuments({ targetOrg: orgB._id })) === 1, "its audit trail intact");

  // Nothing anywhere should still point at a user that no longer exists.
  const liveUsers = (await User.find({}).select("_id").lean()).map((u) => String(u._id));
  const danglers = (await Lead.find({}).lean()).flatMap((L) =>
    [L.assignedTo, L.createdBy, ...(L.notes || []).map((n) => n.addedBy)]
      .filter(Boolean).map(String).filter((id) => !liveUsers.includes(id)));
  check(danglers.length === 0, "no lead still references a deleted user", danglers.join(", "));

  await mongoose.disconnect();
  await mongod.stop();
  console.log(`\n  ${failures ? `${failures} failed` : "all checks passed"}\n`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("  suite crashed: " + e.stack); process.exit(1); });
