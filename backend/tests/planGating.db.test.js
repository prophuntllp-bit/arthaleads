// What each plan gets matches the pricing page, enforced by the server, and
// agents can't hand leads to others or read the company's bank details.
// Every case here was found open by the 24 Oct 2026 staging sweep
// (outputs/security-sweep-2026-10-24.md). Real routes over HTTP, signed-in
// as real users of three companies (Starter, Growth, Enterprise).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
let base, server, db;
const O = {}; // plan -> { org, admin, manager, agent, agent2, project }

const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function call(method, path, userId, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(userId ? { Authorization: `Bearer ${tokenFor(userId)}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const planBlock = (r) => r.status === 403 && /plan/i.test(r.json?.message || "");

test("team performance: Growth and up", async () => {
  assert.ok(planBlock(await call("GET", "/api/auth/performance", O.starter.admin)));
  assert.ok(planBlock(await call("GET", "/api/auth/performance/leads", O.starter.manager)));
  assert.equal((await call("GET", "/api/auth/performance", O.growth.admin)).status, 200);
});

test("API access: Enterprise only; a key made earlier stops working below Enterprise", async () => {
  assert.ok(planBlock(await call("POST", "/api/org/me/voice-key", O.growth.admin)));
  const made = await call("POST", "/api/org/me/voice-key", O.enterprise.admin);
  assert.equal(made.status, 200);
  const key = made.json.voiceApiKey;
  assert.equal((await call("GET", "/api/voice/leads?limit=1", null, undefined, { "X-Api-Key": key })).status, 200);
  await db.collection("organizations").updateOne({ _id: O.enterprise.org }, { $set: { plan: "growth" } });
  const after = await call("GET", "/api/voice/leads?limit=1", null, undefined, { "X-Api-Key": key });
  await db.collection("organizations").updateOne({ _id: O.enterprise.org }, { $set: { plan: "enterprise" } });
  assert.equal(after.status, 403, "downgraded: the key is refused");
});

test("Vistrow Voice outbound calling: Enterprise only", async () => {
  assert.ok(planBlock(await call("PUT", "/api/integrations/vistrow-outbound/config", O.starter.admin, { defaultCountryCode: "91" })));
  assert.ok(planBlock(await call("PUT", "/api/integrations/vistrow-outbound/config", O.growth.admin, { defaultCountryCode: "91" })));
  assert.notEqual((await call("GET", "/api/integrations/vistrow-outbound/config", O.enterprise.admin)).status, 403);
});

test("AI WhatsApp draft on a project lead: Growth and up", async () => {
  const p = O.starter.project;
  const pl = await db.collection("projectleads").insertOne({ project: p, orgId: O.starter.org, name: "Asha", phone: "919811100001", source: "Manual", createdAt: new Date() });
  assert.ok(planBlock(await call("POST", `/api/projects/${p}/leads/${pl.insertedId}/draft-message`, O.starter.admin, {})));
});

test("AI call summary: Enterprise only", async () => {
  const lead = await db.collection("leads").insertOne({ orgId: O.growth.org, name: "Ravi", phone: "919811100002", status: "New", activities: [], createdAt: new Date() });
  assert.ok(planBlock(await call("POST", `/api/calls/lead/${lead.insertedId}/summary`, O.growth.admin, {})));
});

test("bulk export: the sheet export is Growth too", async () => {
  assert.ok(planBlock(await call("POST", "/api/leads/export-sheet", O.starter.admin, { sheets: { Leads: [] } })));
});

test("dashboard numbers: every plan gets the basics; the advanced reports are Growth", async () => {
  const s = await call("GET", "/api/leads/analytics", O.starter.admin);
  assert.equal(s.status, 200);
  assert.equal(s.json.data.advanced, false);
  assert.deepEqual(s.json.data.byAgent, []);
  assert.equal(s.json.data.conversionRate, null);
  assert.equal(typeof s.json.data.totalLeads, "number");
  const g = await call("GET", "/api/leads/analytics", O.growth.admin);
  assert.equal(g.json.data.advanced, true);
});

test("round-robin: Growth assigns new leads, Starter leaves them for the admin", async () => {
  const s = await call("POST", "/api/leads", O.starter.admin, { name: "RR starter", phone: "919811100003", source: "Manual" });
  assert.equal(s.status, 201);
  assert.ok(!(s.json.data || s.json.lead).assignedTo, "Starter: unassigned");
  const g = await call("POST", "/api/leads", O.growth.admin, { name: "RR growth", phone: "919811100004", source: "Manual" });
  assert.ok((g.json.data || g.json.lead).assignedTo, "Growth: assigned by round-robin");
});

test("Google Ads connections: Enterprise, on the generic create route too", async () => {
  assert.ok(planBlock(await call("POST", "/api/automations", O.growth.admin, { name: "G", platform: "Google" })));
});

test("agents can't hand leads to someone else: edit and create", async () => {
  const g = O.growth;
  const own = await db.collection("leads").insertOne({ orgId: g.org, name: "Mine", phone: "919811100005", status: "New", assignedTo: g.agent, assignedToName: "Agent", createdBy: g.agent, activities: [], createdAt: new Date() });
  const edit = await call("PUT", `/api/leads/${own.insertedId}`, g.agent, { assignedTo: String(g.agent2) });
  assert.equal(edit.status, 403);
  assert.equal(String((await db.collection("leads").findOne({ _id: own.insertedId })).assignedTo), String(g.agent), "still the agent's");
  assert.equal((await call("PUT", `/api/leads/${own.insertedId}`, g.agent, { assignedTo: String(g.agent), name: "Mine too" })).status, 200, "sending the same owner back is fine");
  assert.equal((await call("POST", "/api/leads", g.agent, { name: "Pushed", phone: "919811100006", source: "Manual", assignedTo: String(g.admin) })).status, 403);
  assert.equal((await call("PUT", `/api/leads/${own.insertedId}`, g.manager, { assignedTo: String(g.agent2) })).status, 200, "a manager may");
});

test("an agent's view of the company has no bank, tax or sign-up details", async () => {
  await db.collection("organizations").updateOne({ _id: O.growth.org }, { $set: { bankAccountNo: "000111222", pan: "ABCDE1234F", gstNo: "27ABC", signupIp: "1.2.3.4", "whatsapp.botSystemPrompt": "secret" } });
  const a = (await call("GET", "/api/org/me", O.growth.agent)).json.org;
  for (const k of ["bankAccountNo", "pan", "gstNo", "signupIp", "referralCode"]) assert.equal(a[k], undefined, k);
  assert.equal(a.whatsapp?.botSystemPrompt, undefined);
  assert.equal(a.name, "QA Growth", "the rest is still there");
  const ad = (await call("GET", "/api/org/me", O.growth.admin)).json.org;
  assert.equal(ad.bankAccountNo, "000111222", "admins still see it");
});

test("deleting a routing rule that isn't yours: not found", async () => {
  const r = await db.collection("routingrules").insertOne({ orgId: O.growth.org, label: "x", source: "facebook", matchField: "ad_id", matchValue: "1", isActive: true });
  assert.equal((await call("DELETE", `/api/routing-rules/${r.insertedId}`, O.enterprise.admin)).status, 404);
  assert.ok(await db.collection("routingrules").findOne({ _id: r.insertedId }));
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
  for (const m of ["Lead", "User", "Organization", "Project", "ProjectLead", "RoutingRule", "Automation"]) await require(`../models/${m}`).init().catch(() => {});
  for (const plan of ["starter", "growth", "enterprise"]) {
    const org = oid();
    await db.collection("organizations").insertOne({ _id: org, name: `QA ${plan[0].toUpperCase()}${plan.slice(1)}`, slug: `qa-${plan}-${org}`, plan, isActive: true, approvalStatus: "approved", autoAssign: true });
    const o = { org };
    for (const role of ["admin", "manager", "agent", "agent2"]) {
      o[role] = oid();
      await db.collection("users").insertOne({ _id: o[role], name: `${plan} ${role}`, email: `${plan}-${role}@example.com`, role: role === "agent2" ? "agent" : role, orgId: org, isActive: true });
    }
    o.project = oid();
    await db.collection("projects").insertOne({ _id: o.project, name: `${plan} Heights`, orgId: org, createdBy: o.admin, assignedTo: [] });
    O[plan] = o;
  }
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/org", require("../routes/orgRoutes"));
  app.use("/api/leads", require("../routes/leadRoutes"));
  app.use("/api/automations", require("../routes/automationRoutes"));
  app.use("/api/routing-rules", require("../routes/routingRuleRoutes"));
  app.use("/api/integrations/vistrow-outbound", require("../routes/vistrowOutboundRoutes"));
  app.use("/api/projects", require("../routes/projectRoutes"));
  app.use("/api/voice", require("../routes/voiceRoutes"));
  app.use("/api/calls", require("../routes/enablexRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Plans match the pricing page; agents can't reassign or read bank details");
})();
