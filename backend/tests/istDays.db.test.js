// "Today" is the IST day everywhere, not the server's UTC day.
//
// Railway runs in UTC, where setHours(0) makes "today" run 05:30 to 05:29 IST,
// so a follow-up at 00:30 IST showed under yesterday and one at 01:00 IST
// tomorrow showed under today. This pins the edges of the IST day for
// Follow-ups, the Leads "follow-up today" filter and the task summary.
// Run as the production server does: in UTC, whatever the machine running the test uses.
process.env.TZ = "UTC";
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`);
  if (!ok) failures++;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Queries here join or union these collections; create them up front so the
  // in-memory server never sees one appear mid-query (a known flake).
  for (const c of ["projects", "projectleads", "leads", "tasks", "users"]) await mongoose.connection.createCollection(c).catch(() => {});
  const Lead = require("../models/Lead");
  const Task = require("../models/Task");
  const followupService = require("../services/followupService");
  const leadService = require("../services/leadService");
  const taskService = require("../services/taskService");
  const { istDateKey, startOfISTDay } = require("../utils/datetime");
  const oid = () => new mongoose.Types.ObjectId();
  console.log("\nIST day windows\n");

  const org = oid(), me = oid();
  const admin = { _id: me, orgId: org, role: "admin" };
  const today = startOfISTDay(istDateKey());
  const at = (h, m = 0) => new Date(today.getTime() + (h * 60 + m) * 60_000);  // hours after IST midnight today
  const rows = {
    justAfterMidnight: at(0, 30),     // 00:30 IST today: UTC day is still yesterday
    lateTonight:       at(23, 45),    // 23:45 IST today: UTC day is still today
    earlyTomorrow:     at(24, 15),    // 00:15 IST tomorrow: UTC day is still today
    lateYesterday:     at(-1, 0),     // 23:00 IST yesterday
  };
  const base = { orgId: org, status: "Contacted", source: "Facebook", isArchived: false, isDeleted: false, assignedTo: me, createdBy: me, createdAt: at(-48) };
  await Lead.collection.insertMany(Object.entries(rows).map(([name, followUpDate]) => ({ _id: oid(), name, phone: name, followUpDate, ...base })));

  const names = (r) => r.leads.map((l) => l.name).sort().join(",");
  const present = await followupService.get(admin, { section: "present" });
  check(names(present) === "justAfterMidnight,lateTonight", "Follow-ups 'today' is 00:00 to 23:59 IST", names(present));
  const past = await followupService.get(admin, { section: "past" });
  check(names(past) === "lateYesterday", "Follow-ups 'past' is before IST midnight", names(past));
  const future = await followupService.get(admin, { section: "future" });
  check(names(future) === "earlyTomorrow", "Follow-ups 'future' starts at IST midnight tonight", names(future));
  const tomorrowKey = istDateKey(at(36));
  const futureTo = await followupService.get(admin, { section: "future", from: tomorrowKey, to: tomorrowKey });
  check(names(futureTo) === "earlyTomorrow", "a date range picked in the app covers the whole IST day", names(futureTo));

  const leadsToday = await leadService.getAllUnified({ page: 1, limit: 50, followUpToday: "true" }, admin);
  check(leadsToday.leads.map((l) => l.name).sort().join(",") === "justAfterMidnight,lateTonight", "Leads 'follow-up today' filter uses the IST day", leadsToday.leads.map((l) => l.name).join(","));

  await Task.collection.insertMany([
    { _id: oid(), orgId: org, title: "t1", dueDate: at(0, 30), assignedTo: me, assignedBy: me, status: "pending" },
    { _id: oid(), orgId: org, title: "t2", dueDate: at(24, 15), assignedTo: me, assignedBy: me, status: "pending" },
    { _id: oid(), orgId: org, title: "t3", dueDate: at(-1), assignedTo: me, assignedBy: me, status: "pending" },
  ]);
  const { summary } = await taskService.list(admin);
  check(summary.today === 1 && summary.upcoming === 1 && summary.overdue === 1, "task summary counts today, upcoming and overdue by IST day", JSON.stringify(summary));

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all IST day checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
