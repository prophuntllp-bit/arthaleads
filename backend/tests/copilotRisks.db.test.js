// Artha risk alerts against a real database: each rule fires when it should
// and stays quiet when someone has already acted.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["leads", "users", "waconversations", "wamessages", "projects", "projectleads"]) await mongoose.connection.createCollection(c).catch(() => {});
  const Lead = require("../models/Lead");
  const User = require("../models/User");
  const WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  const { buildRisks } = require("../copilot/risks");
  const { buildBrief } = require("../copilot/brief");
  const oid = () => new mongoose.Types.ObjectId();
  console.log("\nArtha risk alerts\n");

  // 11:00 IST, Thu 15 Oct 2026.
  const now = new Date("2026-10-15T05:30:00Z");
  const ago = (h) => new Date(now.getTime() - h * 3600e3);
  const org = oid();
  const A = { _id: oid(), orgId: org, role: "agent", name: "Soniya" };
  const B = { _id: oid(), orgId: org, role: "agent", name: "Arjun" };
  const M = { _id: oid(), orgId: org, role: "manager", name: "Anil" };
  await User.collection.insertMany([A, B, M].map((u) => ({ ...u, email: `${u.name}@example.com`, isActive: true })));
  const L = (name, owner, extra = {}) => ({ _id: oid(), orgId: org, name, phone: "9198000" + Math.floor(10000 + Math.random() * 89999), assignedTo: owner._id, assignedToName: owner.name, status: "Contacted", priority: "Medium", isArchived: false, isDeleted: false, createdAt: ago(24 * 10), activities: [], notes: [], ...extra });
  const touch = (h, who = A) => ({ type: "called", description: "Called", performedBy: who._id, createdAt: ago(h) });

  const hotCold = L("Hot Cold", A, { priority: "Hot", activities: [touch(72)] });
  const hotFresh = L("Hot Fresh", A, { priority: "Hot", activities: [touch(5)] });
  const hotBotOnly = L("Hot Bot Only", A, { priority: "High", activities: [{ type: "status_changed", description: "by webhook", createdAt: ago(1) }] });
  const visitSilent = L("Visit Silent", A, { status: "Site Visit", siteVisitDone: true, siteVisitDate: ago(24 * 5), activities: [touch(24 * 6)] });
  const visitFollowed = L("Visit Followed", A, { status: "Site Visit", siteVisitDone: true, siteVisitDate: ago(24 * 5), notes: [{ text: "Liked it", addedBy: A._id, createdAt: ago(24) }] });
  const visitMissed = L("Visit Missed", A, { status: "Site Visit", siteVisitDate: ago(24 * 2) });
  const visitUpcoming = L("Visit Upcoming", A, { status: "Site Visit", siteVisitDate: new Date(now.getTime() + 24 * 3600e3) });
  const newWaiting = L("New Waiting", A, { status: "New", firstContactedAt: null, createdAt: ago(30) });
  const newRecent = L("New Recent", A, { status: "New", firstContactedAt: null, createdAt: ago(5) });
  const closedHot = L("Closed Hot", A, { status: "Closed Won", priority: "Hot" });
  const orphan1 = L("Orphan One", A, { status: "New", firstContactedAt: null, createdAt: ago(48), assignedTo: null, assignedToName: "" });
  const orphan2 = L("Orphan Two", A, { status: "New", firstContactedAt: null, createdAt: ago(26), assignedTo: null, assignedToName: "" });
  const arjunHot = L("Arjun Hot", B, { priority: "Hot", activities: [touch(100, B)] });
  const waReplied = L("WA Replied", A, { priority: "Hot", activities: [touch(80)] });
  await Lead.collection.insertMany([hotCold, hotFresh, hotBotOnly, visitSilent, visitFollowed, visitMissed, visitUpcoming, newWaiting, newRecent, closedHot, arjunHot, waReplied, orphan1, orphan2]);

  // A WhatsApp reply from the team counts as contact.
  const c1 = { _id: oid(), orgId: org, leadId: waReplied._id, contactPhone: "919811110001", contactName: "WA Replied", assignedTo: A._id, status: "open", lastMessageAt: ago(3) };
  // Customer waiting 20 hours: window closes in 4.
  const c2 = { _id: oid(), orgId: org, contactPhone: "919811110002", contactName: "Closing Chat", assignedTo: A._id, assignedToName: "Soniya", status: "open", lastMessageAt: ago(20) };
  // Customer waiting 3 hours: plenty of window left.
  const c3 = { _id: oid(), orgId: org, contactPhone: "919811110003", contactName: "Open Chat", assignedTo: A._id, status: "open", lastMessageAt: ago(3) };
  // Customer wrote 20 hours ago but was answered.
  const c4 = { _id: oid(), orgId: org, contactPhone: "919811110004", contactName: "Answered Chat", assignedTo: A._id, status: "open", lastMessageAt: ago(19) };
  await WaConversation.collection.insertMany([c1, c2, c3, c4]);
  await WaMessage.collection.insertMany([
    { conversationId: c1._id, orgId: org, direction: "outbound", sender: "agent", body: "Hi", mediaType: "text", timestamp: ago(3) },
    { conversationId: c2._id, orgId: org, direction: "inbound", sender: "customer", body: "Price?", mediaType: "text", timestamp: ago(20) },
    { conversationId: c3._id, orgId: org, direction: "inbound", sender: "customer", body: "Hello", mediaType: "text", timestamp: ago(3) },
    { conversationId: c4._id, orgId: org, direction: "inbound", sender: "customer", body: "Hello", mediaType: "text", timestamp: ago(20) },
    { conversationId: c4._id, orgId: org, direction: "outbound", sender: "agent", body: "Hi!", mediaType: "text", timestamp: ago(19) },
  ]);

  const r = await buildRisks(A, now);
  const type = (n) => r.list.find((x) => x.name === n)?.type;
  check(type("Hot Cold") === "hot_cold" && /no contact for 3 days/.test(r.list.find((x) => x.name === "Hot Cold").reason), "a hot lead with no contact for 3 days is flagged", JSON.stringify(r.list.find((x) => x.name === "Hot Cold")));
  check(!type("Hot Fresh"), "a hot lead called 5 hours ago is not");
  check(type("Hot Bot Only") === "hot_cold", "an automatic (no person) update doesn't count as contact");
  check(type("Visit Silent") === "visit_silent" && /Ask how it went/.test(r.list.find((x) => x.name === "Visit Silent").reason), "a visit 5 days ago with no contact since is flagged");
  check(!type("Visit Followed"), "a visit followed by a note yesterday is not");
  check(type("Visit Missed") === "visit_missed" && /Tue, 13 Oct|Tue 13 Oct/.test(r.list.find((x) => x.name === "Visit Missed").reason), "a visit date that passed without being marked done is flagged, with its IST date", r.list.find((x) => x.name === "Visit Missed")?.reason);
  check(!type("Visit Upcoming"), "an upcoming visit is not");
  check(type("New Waiting") === "new_waiting" && !type("New Recent"), "a new lead waiting 30 hours is flagged; one from 5 hours ago is not");
  check(!type("Closed Hot"), "closed leads are left out");
  check(!type("WA Replied"), "a WhatsApp reply from the team counts as contact");
  check(type("Arjun Hot") === undefined, "an agent only sees their own risks");
  check(r.list[0].type === "chat_closing" && r.list[0].name === "Closing Chat" && /closes in 4 hours/.test(r.list[0].reason), "a chat whose reply window closes in 4 hours comes first", JSON.stringify(r.list[0]));
  check(!r.list.some((x) => x.name === "Open Chat" || x.name === "Answered Chat"), "chats with time left, or already answered, are not flagged");
  check(r.total === 6 && r.counts.hot_cold === 2, "totals add up", JSON.stringify(r.counts));

  const m = await buildRisks(M, now);
  const ah = m.list.find((x) => x.name === "Arjun Hot");
  check(ah && ah.owner === "Arjun" && m.byOwner[String(B._id)] === 1, "a manager sees the whole team, with each lead's owner", JSON.stringify(ah));

  const sum = m.list.find((x) => x.type === "unassigned_waiting");
  check(sum && sum.count === 2 && /2 new leads .* no owner/.test(sum.reason) && !m.list.some((x) => /Orphan/.test(x.name)), "unassigned new leads become one summary line for managers", JSON.stringify(sum));
  check(!r.list.some((x) => x.type === "unassigned_waiting"), "agents don't get the unassigned summary");
  const b = await buildBrief(A, now);
  check(b.risks.total === 6 && !b.items.some((it) => b.risks.list.some((x) => x.id === it.id)), "the brief lists risks once, not again under 'call first'");
  const mb = await buildBrief(M, now);
  check(mb.team.find((x) => x.name === "Soniya")?.atRisk >= 5, "the team table counts each person's at-risk leads", JSON.stringify(mb.team));

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all risk alert checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
