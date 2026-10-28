// Lead integrity (17 Oct 2026 audit item 6), against the real webhook routes:
//  - a Facebook lead Meta delivers twice is saved once, even when both arrive together
//  - a Google lead that fails on our side is answered 500 (Google re-sends) and
//    the re-send is saved once
//  - the same number written differently is the same person
//  - a routing rule whose person was deactivated hands the lead to someone active
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
delete process.env.FB_APP_SECRET; // signature checks have their own tests
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");

const oid = () => new mongoose.Types.ObjectId();
let mongod, server, base, Lead, ProjectLead, ORG, FB_PAGE, GOOGLE_KEY, SITE_TOKEN, ACTIVE, GONE, PROJECT;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${base}${path}`, { method: "POST", agent: false, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } }, (res) => {
      const chunks = []; res.on("data", (c) => chunks.push(c));
      res.on("end", () => { let json = null; try { json = JSON.parse(Buffer.concat(chunks).toString()); } catch { /* not json */ } resolve({ status: res.statusCode, json }); });
    });
    req.on("error", reject); req.end(data);
  });
}

const fbLead = (id, phone = "+919876500001") => ({
  object: "page",
  entry: [{ changes: [{ field: "leadgen", value: {
    leadgen_id: id, page_id: FB_PAGE,
    field_data: [{ name: "full_name", values: ["Asha Patil"] }, { name: "phone_number", values: [phone] }],
  } }] }],
});
const googleLead = (id, phone, extra = {}) => ({
  google_key: GOOGLE_KEY, lead_id: id, campaign_id: "C-1", campaign_name: "Khopoli",
  user_column_data: [{ column_id: "FULL_NAME", string_value: "Ravi Kulkarni" }, { column_id: "PHONE_NUMBER", string_value: phone }],
  ...extra,
});

// ── phone helper ────────────────────────────────────────────────────────────
test("every stored format of a number gives the same key; short numbers give none", () => {
  const { phoneKey, samePhone } = require("../utils/phone");
  for (const p of ["+919876543210", "919876543210", "09876543210", "9876543210", "+91 98765 43210", "+91-98765-43210"]) {
    assert.equal(phoneKey(p), "9876543210", p);
  }
  assert.equal(phoneKey("12345"), "");
  assert.equal(phoneKey("N/A"), "");
  assert.equal(samePhone("N/A"), null);
  const re = new RegExp(samePhone("09876543210").$regex);
  for (const stored of ["+919876543210", "919876543210", "9876543210", "+91 9876543210"]) assert.ok(re.test(stored), stored);
  assert.ok(!re.test("98765432109"), "a longer different number does not match");
});

// ── Facebook ────────────────────────────────────────────────────────────────
test("Facebook: the same lead delivered twice is saved once", async () => {
  const a = await post("/webhook", fbLead("FB-100"));
  const b = await post("/webhook", fbLead("FB-100"));
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(await Lead.countDocuments({ orgId: ORG, metaLeadId: "FB-100" }), 1);
});

test("Facebook: two deliveries arriving together still make one lead", async () => {
  const results = await Promise.all([1, 2, 3].map(() => post("/webhook", fbLead("FB-200", "+919876500002"))));
  assert.ok(results.every((r) => r.status === 200), results.map((r) => r.status).join(","));
  assert.equal(await Lead.countDocuments({ orgId: ORG, metaLeadId: "FB-200" }), 1);
});

test("Facebook: different lead ids are different leads", async () => {
  await post("/webhook", fbLead("FB-301", "+919876500003"));
  await post("/webhook", fbLead("FB-302", "+919876500004"));
  assert.equal(await Lead.countDocuments({ orgId: ORG, metaLeadId: { $in: ["FB-301", "FB-302"] } }), 2);
});

test("Facebook: the same lead id in another company is not blocked", async () => {
  const other = oid();
  await Lead.create({ name: "Elsewhere", phone: "9876500099", source: "Facebook", orgId: other, metaLeadId: "FB-100" });
  assert.equal(await Lead.countDocuments({ metaLeadId: "FB-100" }), 2);
});

// ── Google ──────────────────────────────────────────────────────────────────
test("Google: a failure on our side answers 500 so Google re-sends, and the re-send is saved once", async () => {
  const realCreate = Lead.create;
  Lead.create = async () => { throw new Error("database hiccup"); };
  let first;
  try { first = await post("/webhook/google", googleLead("G-1", "+919811100001")); } finally { Lead.create = realCreate; }
  assert.equal(first.status, 500, "an error must not be answered 200");
  assert.equal(await Lead.countDocuments({ orgId: ORG, externalId: "google:G-1" }), 0);

  const retry = await post("/webhook/google", googleLead("G-1", "+919811100001"));
  assert.equal(retry.status, 201);
  const again = await post("/webhook/google", googleLead("G-1", "+919811100001"));
  assert.equal(again.status, 200);
  assert.equal(await Lead.countDocuments({ orgId: ORG, externalId: "google:G-1" }), 1);
});

test("Google: test leads (which reuse ids) are not blocked by the id check", async () => {
  const t1 = await post("/webhook/google", googleLead("TEST", "", { is_test: true }));
  assert.equal(t1.status, 201);
  const lead = await Lead.findById(t1.json.leadId).lean();
  assert.equal(lead.externalId || "", "");
});

test("Google: a bad key is still refused, not retried", async () => {
  const r = await post("/webhook/google", { ...googleLead("G-9", "+919811100009"), google_key: "wrong" });
  assert.equal(r.status, 401);
});

// ── Same number, different format ───────────────────────────────────────────
test("Google: the same number written differently within 2 minutes is one lead", async () => {
  await post("/webhook/google", googleLead("G-2", "+919811100002"));
  const dup = await post("/webhook/google", googleLead("G-3", "09811100002"));
  assert.equal(dup.json?.message, "Duplicate lead ignored");
  assert.equal(await Lead.countDocuments({ orgId: ORG, phone: { $regex: "9811100002$" } }), 1);
});

test("Website: the same number written differently within 2 minutes is one lead", async () => {
  const a = await post("/webhook/website", { token: SITE_TOKEN, name: "Meera", phone: "9822200001", page_url: "https://example.in/" });
  const b = await post("/webhook/website", { token: SITE_TOKEN, name: "Meera", phone: "+91 98222 00001", page_url: "https://example.in/" });
  assert.ok([200, 201].includes(a.status), String(a.status));
  assert.equal(b.json?.message, "Duplicate lead ignored");
  assert.equal(await Lead.countDocuments({ orgId: ORG, source: "Website" }), 1);
});

test("Website: different numbers are still different leads", async () => {
  const c = await post("/webhook/website", { token: SITE_TOKEN, name: "Kiran", phone: "9822200002", page_url: "https://example.in/" });
  assert.ok([200, 201].includes(c.status), String(c.status));
  assert.equal(await Lead.countDocuments({ orgId: ORG, source: "Website" }), 2);
});

test("Website: a 'WordPress Site 5' connection labels leads with the site's own name", async () => {
  await post("/webhook/website", { token: "site-token-5", name: "Asha", phone: "9822200005", page_url: "https://shaporjipallonji.com/treetopia/" });
  const lead = await Lead.findOne({ orgId: ORG, phone: { $regex: "9822200005$" } }).lean();
  assert.equal(lead.leadSourceLabel, "Shaporji Pallonji");
});

test("Website: the plugin's site name replaces a 'WordPress Site N' connection name", async () => {
  const r = await post("/webhook/website/register", { token: "site-token-6", site_name: "Neoliv Developer", site_url: "https://neolivdeveloper.com" });
  assert.equal(r.status, 200);
  const a = await mongoose.connection.db.collection("automations").findOne({ verifyToken: "site-token-6" });
  assert.equal(a.name, "Neoliv Developer");
});

test("bulk import treats 0-prefixed and +91 numbers as the same person", async () => {
  const leadService = require("../services/leadService");
  const user = { _id: ACTIVE, orgId: ORG, name: "Active Agent", role: "admin" };
  await Lead.create({ name: "Existing", phone: "+919833300001", source: "Manual", orgId: ORG });
  const r = await leadService.bulkImport([
    { name: "Same person", phone: "09833300001" },
    { name: "New person", phone: "9833300002" },
    { name: "Same in file", phone: "+91 98333 00002" },
  ], user);
  assert.equal(await Lead.countDocuments({ orgId: ORG, phone: { $regex: "9833300001$" } }), 1, JSON.stringify(r));
  assert.equal(await Lead.countDocuments({ orgId: ORG, phone: { $regex: "9833300002$" } }), 1, JSON.stringify(r));
});

// ── Routing to someone who left ─────────────────────────────────────────────
test("a rule naming a deactivated person gives the lead to an active one", async () => {
  const r = await post("/webhook/google", googleLead("G-10", "+919844400001", { campaign_id: "RULED" }));
  assert.equal(r.status, 201);
  const lead = await Lead.findById(r.json.leadId).lean();
  assert.equal(String(lead.assignedTo), String(ACTIVE), "assigned to the active agent, not the deactivated one");
});

test("the rule still files the lead into its project, credited to the rule's owner", async () => {
  const copy = await ProjectLead.findOne({ project: PROJECT, phone: { $regex: "9844400001$" } }).lean();
  assert.ok(copy, "project copy made");
  assert.equal(String(copy.assignedTo), String(ACTIVE));
  assert.equal(String(copy.importedBy), String(GONE));
});

test("a rule naming an active person still assigns to them", async () => {
  await mongoose.connection.collection("users").updateOne({ _id: GONE }, { $set: { isActive: true } });
  const r = await post("/webhook/google", googleLead("G-11", "+919844400002", { campaign_id: "RULED" }));
  const lead = await Lead.findById(r.json.leadId).lean();
  assert.equal(String(lead.assignedTo), String(GONE));
  await mongoose.connection.collection("users").updateOne({ _id: GONE }, { $set: { isActive: false } });
});

test("a rule whose person was deleted outright also falls back", async () => {
  const { matchRoutingRule } = require("../utils/routingRules");
  const RoutingRule = require("../models/RoutingRule");
  await RoutingRule.create({ orgId: ORG, label: "Deleted owner", source: "google", matchField: "campaign_id", matchValue: "DELETED", assignTo: oid(), assignToName: "Ex Employee", isActive: true });
  const rule = await matchRoutingRule(ORG, "google", { campaign_id: "DELETED" });
  assert.equal(String(rule.assignTo), String(ACTIVE));
  assert.equal(rule.agentReplaced, true);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  ProjectLead = require("../models/ProjectLead");
  await Lead.init();
  const db = mongoose.connection;
  ORG = oid(); ACTIVE = oid(); GONE = oid(); PROJECT = oid();
  FB_PAGE = "PAGE-1"; GOOGLE_KEY = "google-key-1"; SITE_TOKEN = "site-token-1";
  await db.collection("organizations").insertOne({ _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: true });
  await db.collection("users").insertMany([
    { _id: ACTIVE, name: "Active Agent", email: "a@example.com", role: "agent", orgId: ORG, isActive: true },
    { _id: GONE, name: "Former Agent", email: "f@example.com", role: "agent", orgId: ORG, isActive: false },
  ]);
  await db.collection("projects").insertOne({ _id: PROJECT, name: "Khopoli Plots", orgId: ORG, createdBy: ACTIVE });
  const common = { isActive: true, orgId: ORG, createdBy: ACTIVE, updatedBy: ACTIVE };
  await db.collection("automations").insertMany([
    { _id: oid(), name: "FB", platform: "Facebook", pageId: FB_PAGE, accessToken: "tok", ...common },
    { _id: oid(), name: "Google Ads", platform: "Google", verifyToken: GOOGLE_KEY, ...common },
    { _id: oid(), name: "example.in", platform: "Website Form", verifyToken: SITE_TOKEN, ...common },
    { _id: oid(), name: "WordPress Site 5", siteName: "Shaporji Pallonji", siteUrl: "https://shaporjipallonji.com", platform: "Website Form", verifyToken: "site-token-5", ...common },
    { _id: oid(), name: "WordPress Site 6", platform: "Website Form", verifyToken: "site-token-6", ...common },
  ]);
  await db.collection("routingrules").insertOne({ _id: oid(), orgId: ORG, label: "Khopoli campaign", source: "google", matchField: "campaign_id", matchValue: "RULED", assignTo: GONE, assignToName: "Former Agent", assignToProject: PROJECT, assignToProjectName: "Khopoli Plots", isActive: true });

  const app = express();
  app.use("/webhook", require("../routes/webhookRoutes"));
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Lead integrity: no repeats, no lost Google leads, one phone key, no routing to people who left");
})();
