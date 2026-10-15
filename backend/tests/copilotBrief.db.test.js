// Artha morning brief against a real database: the right leads, in the right
// order, IST days, only the person's own work, and a team view for managers.
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
  for (const c of ["projects", "projectleads", "leads", "users", "waconversations"]) await mongoose.connection.createCollection(c).catch(() => {});
  const Lead = require("../models/Lead");
  const ProjectLead = require("../models/ProjectLead");
  const Project = require("../models/Project");
  const User = require("../models/User");
  const WaConversation = require("../models/WaConversation");
  const { buildBrief, briefForModel } = require("../copilot/brief");
  const { toolsFor, runTool } = require("../copilot/tools");
  const oid = () => new mongoose.Types.ObjectId();
  console.log("\nArtha morning brief\n");

  // 10:00 IST on Thu 15 Oct 2026 = 04:30 UTC.
  const now = new Date("2026-10-15T04:30:00Z");
  const at = (iso) => new Date(iso);
  const org = oid();
  const A = { _id: oid(), orgId: org, role: "agent", name: "Soniya" };
  const B = { _id: oid(), orgId: org, role: "agent", name: "Arjun" };
  const M = { _id: oid(), orgId: org, role: "manager", name: "Anil" };
  await User.collection.insertMany([A, B, M].map((u) => ({ ...u, email: `${u.name}@example.com`, isActive: true })));
  const lead = (name, owner, extra = {}) => ({ _id: oid(), orgId: org, name, phone: `9198000${Math.floor(10000 + Math.random() * 89999)}`, assignedTo: owner._id, createdBy: owner._id, status: "Contacted", source: "Facebook", isArchived: false, isDeleted: false, createdAt: at("2026-10-01T05:00:00Z"), activities: [], notes: [], ...extra });
  const visit = lead("Priya", A, { siteVisitDate: at("2026-10-15T10:30:00Z") });            // 4:00 pm IST today
  const missed = lead("Rohan", A, { followUpDate: at("2026-10-13T12:30:00Z") });             // Tue 6 pm IST
  const lateLastNight = lead("Kabir", A, { followUpDate: at("2026-10-14T18:00:00Z") });      // 11:30 pm IST yesterday = overdue
  const earlyToday = lead("Meera", A, { followUpDate: at("2026-10-14T19:00:00Z") });         // 00:30 IST today = due today, not overdue
  const fresh = lead("Neha", A, { status: "New", firstContactedAt: null, createdAt: at("2026-10-15T02:30:00Z") });
  const closed = lead("Old", A, { status: "Closed Won", followUpDate: at("2026-10-10T05:00:00Z") });
  const others = lead("Isha", B, { followUpDate: at("2026-10-12T05:00:00Z") });
  await Lead.collection.insertMany([visit, missed, lateLastNight, earlyToday, fresh, closed, others]);
  const proj = { _id: oid(), orgId: org, name: "Kalpataru", assignedTo: [A._id] };
  await Project.collection.insertOne(proj);
  await ProjectLead.collection.insertOne({ _id: oid(), orgId: org, project: proj._id, name: "Vikram", phone: "919811112222", status: "Contacted", isProspective: false, followUp: at("2026-10-14T05:00:00Z"), createdAt: at("2026-10-02T05:00:00Z") });
  await WaConversation.collection.insertOne({ _id: oid(), orgId: org, contactPhone: "919822223333", contactName: "Sahil", assignedTo: A._id, unreadCount: 2, status: "open", lastMessageAt: at("2026-10-15T03:00:00Z") });

  const b = await buildBrief(A, now);
  const names = b.items.map((x) => x.name);
  check(b.date === "2026-10-15", "the brief is for today in IST", b.date);
  check(names[0] === "Priya" && b.items[0].tag === "visit" && /4:00 pm/.test(b.items[0].reason), "a site visit today comes first, with its IST time", JSON.stringify(b.items[0]));
  check(names[1] === "Sahil" && b.items[1].tag === "chat", "an unread WhatsApp chat comes next", names.join(","));
  check(["Kabir", "Vikram", "Rohan"].every((n) => b.items.find((x) => x.name === n)?.tag === "overdue"), "missed follow-ups, project leads included, are overdue (11:30 pm IST yesterday counts)", JSON.stringify(b.items.map((x) => [x.name, x.tag])));
  check(b.items.find((x) => x.name === "Meera")?.tag === "today", "00:30 IST today is due today, not overdue");
  check(b.items.find((x) => x.name === "Neha")?.tag === "new", "a new uncontacted lead is listed");
  check(!names.includes("Old") && !names.includes("Isha"), "closed leads and a colleague's leads are left out");
  check(b.counts.overdue === 3 && b.counts.today === 1 && b.counts.visits === 1 && b.counts.chats === 1 && b.counts.fresh === 1, "counts add up", JSON.stringify(b.counts));
  check(b.team === null, "agents get no team summary");
  const vk = b.items.find((x) => x.name === "Vikram");
  check(vk.kind === "projectLead" && vk.projectName === "Kalpataru" && vk.projectId === String(proj._id), "project leads carry their project for linking");

  const mb = await buildBrief(M, now);
  const so = mb.team.find((r) => r.name === "Soniya");
  check(mb.items.length === 0 && so && so.overdue === 2 && so.fresh === 1 && so.visits === 1, "a manager gets the team summary per person", JSON.stringify(mb.team));

  const forModel = briefForModel(b);
  check(!JSON.stringify(forModel).includes(visit.phone) && !JSON.stringify(forModel).includes("919822223333"), "the model never sees phone numbers");

  const pilot = { _id: org, copilot: { beta: true } };
  check(toolsFor(A, pilot).some((t) => t.function.name === "morning_brief"), "pilot companies get the brief tool");
  check(!toolsFor(A, { copilot: { beta: true, brief: false } }).some((t) => t.function.name === "morning_brief") && !toolsFor(A, { copilot: {} }).some((t) => t.function.name === "morning_brief"), "the brief switch and non-pilot companies hide it");
  const r = await runTool("morning_brief", {}, { user: A, org: pilot, proposals: [], choices: [] });
  check(r.records.some((x) => x.name === "Priya" && x.kind === "lead"), "brief leads become links in the answer");

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all morning brief checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
