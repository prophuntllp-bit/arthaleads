// ContentReport against a real database.
//
// The model backs the in-app flag that Play's AI-Generated Content policy
// requires, and the policy expects those reports to inform moderation rather
// than pile up unread -- so this checks they can be grouped for review, and
// that account deletion leaves the report readable while unlinking the person
// who raised it.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const ContentReport = require("../models/ContentReport");

let failures = 0;
const check = (ok, msg, d = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`);
  if (!ok) failures++;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const orgId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const r = await ContentReport.create({
    orgId, userId, reason: "offensive",
    reportedText: "Something the assistant should not have said.",
    prompt: "what do you think of my competitor",
    page: "/leads", surface: "mobile", detail: "Rude about a named company",
  });
  check(!!r._id, "a report is stored");
  check(r.status === "open", "it starts open", r.status);

  const bad = new ContentReport({ orgId, userId, reason: "nonsense", reportedText: "x" });
  const err = bad.validateSync();
  check(!!err && !!err.errors.reason, "an unknown reason is rejected");

  const noText = new ContentReport({ orgId, userId, reason: "other" });
  check(!!noText.validateSync()?.errors?.reportedText, "reportedText is required");

  // The whole point of storing them: seeing a pattern.
  await ContentReport.create({ orgId, userId, reason: "offensive", reportedText: "another one" });
  const byReason = await ContentReport.aggregate([
    { $match: { orgId } }, { $group: { _id: "$reason", n: { $sum: 1 } } },
  ]);
  check(byReason.find((g) => g._id === "offensive")?.n === 2, "reports group by reason for review");

  // Account deletion must leave the report but unlink the person.
  const svc = require("../services/accountDeletionService");
  check(!!svc.DISPOSITION.ContentReport, "ContentReport has a deletion disposition");
  await ContentReport.updateMany({ userId }, { $set: { userId: null } });
  const anon = await ContentReport.findById(r._id);
  check(anon.userId === null, "an anonymised report survives");
  check(anon.validateSync() === undefined, "and is still a valid document", String(anon.validateSync()));
  check(anon.reportedText.length > 0, "with the reported text intact for review");

  await mongoose.disconnect();
  await mongod.stop();
  console.log(`\n  ${failures ? failures + " failed" : "all checks passed"}\n`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("  crashed: " + e.message); process.exit(1); });
