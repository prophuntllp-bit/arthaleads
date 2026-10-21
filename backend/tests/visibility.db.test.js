// Who may see what, against a real database.
//
// utils/visibility.js is the one rule every screen and the Artha copilot use.
// These checks pin it down per role so a change that lets an agent see another
// agent's leads, calls, chats or tasks (the Oct 2026 leak) fails the build.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`);
  if (!ok) failures++;
};
const ids = (rows) => rows.map((r) => String(r._id)).sort().join(",");

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Queries here join or union these collections; create them up front so the
  // in-memory server never sees one appear mid-query (a known flake).
  for (const c of ["projects", "projectleads", "leads", "tasks", "users"]) await mongoose.connection.createCollection(c).catch(() => {});
  const Lead = require("../models/Lead");
  const ProjectLead = require("../models/ProjectLead");
  const Project = require("../models/Project");
  const Task = require("../models/Task");
  const visibility = require("../utils/visibility");
  const leadService = require("../services/leadService");
  const taskService = require("../services/taskService");
  const oid = () => new mongoose.Types.ObjectId();

  console.log("\nvisibility: one rule for every screen and Artha\n");

  const org = oid(), otherOrg = oid();
  const A = { _id: oid(), orgId: org, role: "agent", name: "Agent A" };
  const Bg = { _id: oid(), orgId: org, role: "agent", name: "Agent B" };
  const M = { _id: oid(), orgId: org, role: "manager", name: "Manager" };
  const AD = { _id: oid(), orgId: org, role: "admin", name: "Admin" };
  const X = { _id: oid(), orgId: otherOrg, role: "admin", name: "Other org admin" };

  const base = { status: "New", source: "Facebook", isArchived: false, isDeleted: false, createdAt: new Date(), updatedAt: new Date() };
  const L = {
    aAssigned:   { _id: oid(), orgId: org, name: "A assigned", phone: "911", assignedTo: A._id, createdBy: AD._id, ...base },
    aCreated:    { _id: oid(), orgId: org, name: "A created, B assigned", phone: "912", assignedTo: Bg._id, createdBy: A._id, ...base },
    bOnly:       { _id: oid(), orgId: org, name: "B only", phone: "913", assignedTo: Bg._id, createdBy: Bg._id, ...base },
    unassigned:  { _id: oid(), orgId: org, name: "Nobody's", phone: "914", assignedTo: null, createdBy: null, ...base },
    otherOrg:    { _id: oid(), orgId: otherOrg, name: "Other org", phone: "915", assignedTo: A._id, createdBy: A._id, ...base },
  };
  await Lead.collection.insertMany(Object.values(L));

  const projA = { _id: oid(), orgId: org, name: "Project with A", assignedTo: [A._id], createdBy: AD._id };
  const projB = { _id: oid(), orgId: org, name: "Project with B", assignedTo: [Bg._id], createdBy: AD._id };
  await Project.collection.insertMany([projA, projB]);
  const P = {
    inProjA:        { _id: oid(), orgId: org, project: projA._id, name: "In A's project", phone: "921", assignedTo: null, fromLeadId: oid(), createdAt: new Date() },
    inProjBforA:    { _id: oid(), orgId: org, project: projB._id, name: "B's project, assigned to A", phone: "922", assignedTo: A._id, fromLeadId: oid(), createdAt: new Date() },
    inProjB:        { _id: oid(), orgId: org, project: projB._id, name: "B's project", phone: "923", assignedTo: null, fromLeadId: oid(), createdAt: new Date() },
  };
  await ProjectLead.collection.insertMany(Object.values(P));

  // ── leads list (Leads page, Artha search) ──────────────────────────────────
  const list = async (user, q = {}) => (await leadService.getAllUnified({ page: 1, limit: 100, type: "all", ...q }, user)).leads || [];
  const aRows = await list(A);
  const want = [L.aAssigned, L.aCreated, P.inProjA, P.inProjBforA];
  check(ids(aRows) === ids(want), "agent sees own assigned + own created leads and project leads of their project or assigned to them", aRows.map((r) => r.name).join(" | "));
  check(!aRows.some((r) => String(r._id) === String(L.unassigned._id)), "agent does not see unassigned leads");
  check(!aRows.some((r) => String(r._id) === String(L.otherOrg._id)), "agent does not see another organisation's lead, even one assigned to them");
  const mRows = await list(M);
  check(mRows.length === 7, "manager sees every lead and project lead in the organisation, nothing from others", `${mRows.length}`);
  const asA = await list(AD, { assignedTo: String(A._id) });
  check(ids(asA) === ids(want), "admin filtering by agent A sees exactly what A sees");
  check((await list(X)).length === 1, "another organisation's admin sees only their own lead");

  // ── Excel / CSV download (GET /leads/export) ──────────────────────────────
  // The download's Summary sheet (team performance, hot leads, follow-ups) is
  // built only from the leads this returns, so an agent's file can never show
  // a colleague's leads or numbers (owner rule, 21 Oct 2026).
  const exported = async (user, idList) => (await leadService.getAllUnified(
    { page: 1, limit: 5000, type: "all" }, user,
    { fetchCap: 5000, ...(idList ? { ids: idList.map(String) } : {}) })).leads || [];
  check(ids(await exported(A)) === ids(want), "agent's download holds only their own leads");
  const picked = await exported(A, [L.aAssigned._id, L.bOnly._id, L.unassigned._id, L.otherOrg._id]);
  check(ids(picked) === ids([L.aAssigned]), "agent asking to download a colleague's or an unassigned lead by id gets only their own", picked.map((r) => r.name).join(" | "));
  check((await exported(M)).length === 7, "manager's download covers the whole organisation");

  // ── single records (lead panel, calls, Artha get_lead) ────────────────────
  check(visibility.canSeeLead(A, L.aAssigned) && visibility.canSeeLead(A, L.aCreated), "canSeeLead: own assigned and own created");
  check(!visibility.canSeeLead(A, L.bOnly) && !visibility.canSeeLead(A, L.unassigned), "canSeeLead: not a colleague's or an unassigned lead");
  check(!visibility.canSeeLead(X, L.aAssigned), "canSeeLead: never across organisations, even for an admin");
  check(visibility.canSeeLead(M, L.bOnly), "canSeeLead: manager sees any lead in the organisation");
  let denied = false;
  try { await leadService.getById(L.bOnly._id, A); } catch (e) { denied = e.statusCode === 403; }
  check(denied, "getById refuses a colleague's lead to an agent (403)");
  check(String((await leadService.getById(L.bOnly._id, M))._id) === String(L.bOnly._id), "getById opens it for a manager");
  check(await visibility.canSeeProjectLead(A, P.inProjA), "canSeeProjectLead: lead in a project the agent is on");
  check(await visibility.canSeeProjectLead(A, P.inProjBforA), "canSeeProjectLead: lead assigned to the agent in someone else's project");
  check(!(await visibility.canSeeProjectLead(A, P.inProjB)), "canSeeProjectLead: not a lead in a project the agent is not on");

  // ── WhatsApp, calls, tasks ─────────────────────────────────────────────────
  const conv = (assignedTo, orgId = org) => ({ _id: oid(), orgId, assignedTo });
  check(visibility.canSeeConversation(A, conv(A._id)), "conversation assigned to the agent is visible");
  check(!visibility.canSeeConversation(A, conv(Bg._id)) && !visibility.canSeeConversation(A, conv(null)), "a colleague's or an unclaimed conversation is not");
  check(visibility.canSeeConversation(M, conv(null)) && !visibility.canSeeConversation(M, conv(null, otherOrg)), "manager sees all conversations in the organisation only");
  check(String(visibility.ownCallsMatch(A)["activities.performedBy"]) === String(A._id) && Object.keys(visibility.ownCallsMatch(M)).length === 0, "calls: agents see calls they made, managers see all");

  await Task.collection.insertMany([
    { _id: oid(), orgId: org, title: "A's task", dueDate: new Date(), assignedTo: A._id, assignedBy: AD._id, status: "pending" },
    { _id: oid(), orgId: org, title: "B's task", dueDate: new Date(), assignedTo: Bg._id, assignedBy: AD._id, status: "pending" },
    { _id: oid(), orgId: otherOrg, title: "Other org", dueDate: new Date(), assignedTo: A._id, assignedBy: AD._id, status: "pending" },
  ]);
  const at = await taskService.list(A);
  check(at.tasks.length === 1 && at.tasks[0].title === "A's task", "tasks: agent sees only their own", at.tasks.map((t) => t.title).join(","));
  check((await taskService.list(M)).tasks.length === 2, "tasks: manager sees the organisation's");
  check((await taskService.list(M, { myOnly: "true" })).tasks.length === 0, "tasks: 'my tasks' for a manager is only theirs");

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all visibility checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
