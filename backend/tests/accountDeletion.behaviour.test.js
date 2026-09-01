// Behaviour of accountDeletionService, checked by recording the queries it
// issues rather than running them. No in-memory Mongo is installed and adding
// one pulls down a database binary, so this wraps the REAL schemas -- so
// reflection, paths and orgId detection are all genuine -- and replaces only
// the query methods.
//
// The bug worth catching here is the array update. Clearing "notes.$[].addedBy"
// would wipe the author off every note on the lead, not just the departing
// person's, and it would look like a successful deletion.

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MODELS_DIR = path.join(__dirname, "..", "models");
fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith(".js"))
  .forEach((f) => { try { require(path.join(MODELS_DIR, f)); } catch { /* needs env */ } });

const calls = [];
const USER_ID = "64b7f1c2a4d3e10012345678";
const ORG_ID  = "64b7f1c2a4d3e10087654321";

let otherAdmins = 1;      // flipped per scenario
let dueOrgs = [];

for (const [name, Model] of Object.entries(mongoose.models)) {
  const rec = (op) => (...args) => {
    calls.push({ model: name, op, args });
    if (op === "deleteMany" || op === "deleteOne") return Promise.resolve({ deletedCount: 1 });
    return Promise.resolve({ modifiedCount: 1, matchedCount: 1 });
  };
  Model.deleteMany = rec("deleteMany");
  Model.deleteOne = rec("deleteOne");
  Model.updateMany = rec("updateMany");
  Model.updateOne = rec("updateOne");
  if (name === "User") {
    Model.findById = () => ({ lean: async () => ({ _id: USER_ID, name: "Asha Menon", orgId: ORG_ID, role: "admin" }) });
    Model.countDocuments = async () => otherAdmins;
  }
  if (name === "Organization") {
    Model.find = () => ({ select: () => ({ lean: async () => dueOrgs }) });
  }
}

const svc = require("../services/accountDeletionService");

let failures = 0;
const check = (ok, msg, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && detail ? `  <- ${detail}` : ""}`);
  if (!ok) failures++;
};
const find = (model, op) => calls.filter((c) => c.model === model && c.op === op);

(async () => {
  // ── someone who is not the last admin ────────────────────────────────────
  console.log("\n  A colleague leaves (another admin remains)\n");
  otherAdmins = 1;
  calls.length = 0;
  const r1 = await svc.requestDeletion({ _id: USER_ID, orgId: ORG_ID, role: "admin" });

  check(r1.outcome === "erased", "erased immediately, no grace period", r1.outcome);
  check(find("User", "deleteOne").length === 1, "the user record itself is deleted");
  check(find("Organization", "updateOne").length === 0, "the organisation is left alone");

  for (const m of ["Attendance", "PushSubscription", "CopilotAction", "Ticket"]) {
    check(find(m, "deleteMany").length === 1, `${m} rows are dropped outright`);
  }

  const leadAssign = find("Lead", "updateMany").find((c) => "assignedTo" in (c.args[1].$set || {}));
  check(!!leadAssign && leadAssign.args[1].$set.assignedTo === null, "leads are unassigned");
  check(!!leadAssign && leadAssign.args[1].$set.assignedToName === svc.TOMBSTONE,
    "the denormalised name is replaced, not left behind");

  const noteUpdate = find("Lead", "updateMany").find((c) => JSON.stringify(c.args[1]).includes("notes.$"));
  check(!!noteUpdate, "notes written by them are updated");
  check(!!noteUpdate && JSON.stringify(noteUpdate.args[1]).includes("notes.$[el]"),
    "notes use a filtered positional operator");
  check(!!noteUpdate && !JSON.stringify(noteUpdate.args[1]).includes("notes.$[]."),
    "NOT a bare $[] -- that would clear every author on the lead");
  check(!!noteUpdate && Array.isArray(noteUpdate.args[2]?.arrayFilters)
        && String(noteUpdate.args[2].arrayFilters[0]["el.addedBy"]) === USER_ID,
    "arrayFilters scope the change to this person's notes");

  const audit = find("AuditLog", "updateMany");
  check(audit.length > 0, "the audit trail is updated, not deleted");
  check(find("AuditLog", "deleteMany").length === 0, "audit rows are kept as a security record");
  check(audit.some((c) => c.args[1].$set?.ip === ""), "the recorded IP is scrubbed");

  // ── the last admin ───────────────────────────────────────────────────────
  console.log("\n  The last admin leaves\n");
  otherAdmins = 0;
  calls.length = 0;
  const r2 = await svc.requestDeletion({ _id: USER_ID, orgId: ORG_ID, role: "admin" });

  check(r2.outcome === "scheduled", "scheduled rather than executed", r2.outcome);
  check(find("User", "deleteOne").length === 0, "the account survives, so they can sign in to cancel");
  check(find("Lead", "updateMany").length === 0, "no company data is touched yet");

  const sched = find("Organization", "updateOne")[0];
  const days = (new Date(sched.args[1].$set.deletionScheduledAt) - Date.now()) / 86400000;
  check(Math.round(days) === svc.GRACE_DAYS, `the window is ${svc.GRACE_DAYS} days`, `${days.toFixed(1)}`);
  check(String(sched.args[1].$set.deletionRequestedBy) === USER_ID, "who asked is recorded");

  // ── changing their mind ──────────────────────────────────────────────────
  console.log("\n  They sign back in and cancel\n");
  calls.length = 0;
  const r3 = await svc.cancelDeletion({ _id: USER_ID, orgId: ORG_ID });
  const cancel = find("Organization", "updateOne")[0];
  check(r3.cancelled === true, "cancellation reported");
  check(cancel.args[1].$set.deletionScheduledAt === null, "the schedule is cleared");
  check(cancel.args[0].deletionScheduledAt?.$ne === null,
    "only matches an org actually scheduled, so it cannot clear a live org by accident");

  // ── the window elapses ───────────────────────────────────────────────────
  console.log("\n  Thirty days pass\n");
  calls.length = 0;
  dueOrgs = [{ _id: ORG_ID, name: "Rudranee Developers" }];
  const r4 = await svc.runDueDeletions();
  check(r4.processed === 1, "the due organisation is processed");

  const purgedModels = new Set(calls.filter((c) => c.op === "deleteMany").map((c) => c.model));
  const orgScoped = Object.entries(mongoose.models)
    .filter(([n, M]) => n !== "Organization" && M.schema.path("orgId")).map(([n]) => n);
  const missed = orgScoped.filter((m) => !purgedModels.has(m));
  check(missed.length === 0, `all ${orgScoped.length} orgId collections purged`, missed.join(", "));
  check(purgedModels.has("AuditLog"), "AuditLog purged via targetOrg despite having no orgId");
  check(find("Organization", "deleteOne").length === 1, "the organisation record itself is deleted");

  console.log(`\n  ${failures ? `${failures} failed` : "all checks passed"}\n`);
  process.exit(failures ? 1 : 0);
})();
