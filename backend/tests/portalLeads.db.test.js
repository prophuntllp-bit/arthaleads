// Property portal leads (27 Oct 2026). Real routes over HTTP: each portal's
// delivery formats (JSON, form, link values, XML, batches) become leads with
// the right source, a repeat enquiry lands on the existing lead, the plan and
// the link are checked, and Housing.com fetching signs its requests as its
// document asks (Housing.com itself faked).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CRYPTO_KEY = process.env.CRYPTO_KEY || "c".repeat(64);
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
let base, server, db, ORG, STARTER, ADMIN, AGENT, PROJECT, LINK = {};

const housingCalls = [];
let housingAnswer = { status: 200, body: [] };
const realFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://leads.housing.com/")) {
    housingCalls.push(new URL(url));
    return new Response(JSON.stringify(housingAnswer.body), { status: housingAnswer.status });
  }
  return realFetch(url, opts);
};
const pushes = [];
require("../utils/push").sendPushToUser = async (id, msg) => { pushes.push({ id, ...msg }); };
require("../utils/push").sendPushToAll = async (msg) => { pushes.push({ all: true, ...msg }); };

const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function api(method, path, userId, body) {
  const res = await realFetch(base + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(userId)}` }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function deliver(link, { method = "POST", json, form, xml, query = "" } = {}) {
  const headers = {};
  let body;
  if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (form) { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  if (xml) { headers["Content-Type"] = "text/xml"; body = xml; }
  const res = await realFetch(base + new URL(link).pathname + query, { method, headers, body });
  let out = null; try { out = await res.json(); } catch {}
  return { status: res.status, json: out };
}
const leadsByPhone = (p) => db.collection("leads").find({ orgId: ORG, phone: { $regex: `${p}$` } }).toArray();

test("settings give each portal its own private link (admins on Growth)", async () => {
  const r = await api("GET", "/api/portal-leads/settings", ADMIN);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.portals.map((p) => p.slug), ["99acres", "housing", "magicbricks"]);
  for (const p of r.json.portals) { assert.match(p.link, /^http:\/\/127\.0\.0\.1|^https:\/\/api\.arthaleads\.com\/api\/portal-leads\/in\//); LINK[p.slug] = p.link; }
  assert.match(LINK["99acres"], /\/api\/portal-leads\/in\/99acres\/[A-Za-z0-9_-]{24}$/);
  const again = await api("GET", "/api/portal-leads/settings", ADMIN);
  assert.equal(again.json.portals[0].link, LINK["99acres"], "the link stays the same between visits");
  assert.equal((await api("GET", "/api/portal-leads/settings", AGENT)).status, 403, "agents can't see the links");
});

test("99acres JSON enquiry becomes a 99acres lead with project, locality and the enquiry note", async () => {
  const r = await deliver(LINK["99acres"], { json: { applicant_name: "Kavya Nair", phone_number: "+91 98220 10001", email: "kavya@example.com", project: "Skyline Heights", locality: "Wakad", city: "Pune", budget_range: "80L-1Cr", enquiry_id: "99A-1" } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.created, 1);
  const [l] = await leadsByPhone("10001");
  assert.equal(l.source, "99acres");
  assert.equal(l.name, "Kavya Nair");
  assert.equal(l.email, "kavya@example.com");
  assert.equal(l.preferredLocation, "Wakad");
  assert.equal(l.city, "Pune");
  assert.equal(l.leadSourceLabel, "99acres - Skyline Heights");
  assert.equal(l.externalId, "99acres:99A-1");
  assert.match(l.notes[0].text, /Budget: 80L-1Cr/);
  const copy = await db.collection("projectleads").findOne({ project: PROJECT, phone: l.phone });
  assert.ok(copy, "filed into the matching project");
});

test("the same enquiry sent twice is saved once", async () => {
  const r = await deliver(LINK["99acres"], { json: { applicant_name: "Kavya Nair", phone_number: "9822010001", enquiry_id: "99A-1" } });
  assert.equal(r.json.created, 0);
  assert.equal((await leadsByPhone("10001")).length, 1);
});

test("MagicBricks lead in the link (GET with values) is saved", async () => {
  const r = await deliver(LINK.magicbricks, { method: "GET", query: "?name=Rohan%20Shah&mobile=9822010002&project=Green%20Valley&city=Pune" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [l] = await leadsByPhone("10002");
  assert.equal(l.source, "MagicBricks");
  assert.equal(l.name, "Rohan Shah");
});

test("form post and XML deliveries are read too", async () => {
  await deliver(LINK.housing, { form: { lead_name: "Meera Iyer", lead_phone: "9822010003", project_name: "Lake View", locality: "Baner" } });
  const [h] = await leadsByPhone("10003");
  assert.equal(h.source, "Housing.com");
  assert.equal(h.preferredLocation, "Baner");
  await deliver(LINK["99acres"], { xml: "<?xml version='1.0'?><Xml><Resp><QryInfo><SenderName><![CDATA[Arjun Rao]]></SenderName><Phone>9822010004</Phone><Email>arjun@example.com</Email><ProjectName>Skyline Heights</ProjectName><QryId>Q-77</QryId></QryInfo></Resp></Xml>" });
  const [x] = await leadsByPhone("10004");
  assert.equal(x.name, "Arjun Rao");
  assert.equal(x.email, "arjun@example.com");
  assert.equal(x.externalId, "99acres:Q-77");
});

test("a batch of leads in one delivery makes one lead each", async () => {
  const r = await deliver(LINK.magicbricks, { json: { leads: [{ name: "A One", mobile: "9822010011" }, { name: "B Two", mobile: "9822010012" }] } });
  assert.equal(r.json.created, 2);
});

test("a buyer who is already a lead: the enquiry is added to that lead and its owner is told", async () => {
  pushes.length = 0;
  await db.collection("leads").insertOne({ orgId: ORG, name: "Sanjay Kulkarni", phone: "+91 98220 10020", source: "Facebook", status: "Contacted", assignedTo: AGENT, notes: [], activities: [], createdAt: new Date() });
  const r = await deliver(LINK.housing, { json: { lead_name: "Sanjay K", lead_phone: "919822010020", project_name: "Lake View" } });
  assert.equal(r.json.addedToExisting, 1);
  const list = await leadsByPhone("10020");
  assert.equal(list.length, 1, "no second lead");
  assert.equal(list[0].source, "Facebook", "the first source stays");
  assert.match(list[0].activities.at(-1).description, /Enquired again on Housing\.com \(Lake View\)/);
  assert.ok(pushes.some((p) => String(p.id) === String(AGENT) && /Repeat enquiry/.test(p.title)));
});

test("a deleted lead doesn't count: the buyer gets a new lead", async () => {
  await db.collection("leads").insertOne({ orgId: ORG, name: "Old Lead", phone: "9822010030", status: "New", isDeleted: true, notes: [], activities: [], createdAt: new Date() });
  await deliver(LINK["99acres"], { json: { name: "Nisha Old", phone: "9822010030" } });
  assert.equal((await leadsByPhone("10030")).length, 2);
});

test("no phone number: answered 200, nothing saved", async () => {
  const r = await deliver(LINK["99acres"], { json: { name: "No Phone" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.created, 0);
});

test("a wrong link is refused; a plain GET on the right link says it works", async () => {
  assert.equal((await deliver(LINK["99acres"].replace(/[^/]+$/, "x".repeat(24)), { json: { name: "X", phone: "9822010040" } })).status, 401);
  const ok = await deliver(LINK["99acres"], { method: "GET" });
  assert.equal(ok.status, 200);
  assert.match(ok.json.message, /working/);
});

test("below Growth the link answers but saves nothing", async () => {
  const t = "s".repeat(24);
  await db.collection("organizations").updateOne({ _id: STARTER }, { $set: { "portals.token": t } });
  const r = await deliver(`http://x/api/portal-leads/in/99acres/${t}`, { json: { name: "Starter Lead", phone: "9822010050" } });
  assert.equal(r.status, 200);
  assert.equal(await db.collection("leads").countDocuments({ orgId: STARTER }), 0);
});

test("Housing.com fetch: signed as its document asks, leads saved, repeats skipped", async () => {
  housingCalls.length = 0;
  const KEY = "housing-secret-key";
  let r = await api("PUT", "/api/portal-leads/settings/housing", ADMIN, { profileId: "4544", secretKey: KEY, enabled: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.housing.keySet, true);
  const org = await db.collection("organizations").findOne({ _id: ORG });
  assert.match(org.portals.housing.secretKey, /^enc1:/, "the key is stored encrypted");
  housingAnswer = { status: 200, body: { data: [{ lead_name: "Priya Desai", lead_phone: "9822010060", lead_email: null, project_id: 1233, project_name: "Lake View", locality: "Baner", lead_date: 1793000000 }] } };
  r = await api("POST", "/api/portal-leads/settings/housing/pull", ADMIN);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.created, 1);
  const q = housingCalls[0].searchParams;
  assert.equal(q.get("id"), "4544");
  assert.equal(q.get("hash"), crypto.createHmac("sha256", KEY).update(q.get("current_time")).digest("hex"));
  assert.ok(Number(q.get("end_date")) - Number(q.get("start_date")) >= 24 * 3600, "first fetch covers the last day");
  const [l] = await leadsByPhone("10060");
  assert.equal(l.source, "Housing.com");
  r = await api("POST", "/api/portal-leads/settings/housing/pull", ADMIN);
  assert.equal(r.json.created, 0, "the same lead fetched again is not saved twice");
  assert.equal((await leadsByPhone("10060")).length, 1);
});

test("Housing.com refusing the key shows a clear message", async () => {
  housingAnswer = { status: 401, body: { message: "unauthorised" } };
  const r = await api("POST", "/api/portal-leads/settings/housing/pull", ADMIN);
  assert.equal(r.status, 400);
  assert.match(r.json.message, /refused the ID or key/);
  const s = await api("GET", "/api/portal-leads/settings", ADMIN);
  assert.match(s.json.housing.lastError, /refused/);
});

test("a new link replaces the old one", async () => {
  const r = await api("POST", "/api/portal-leads/settings/new-link", ADMIN);
  assert.notEqual(r.json.portals[0].link, LINK["99acres"]);
  assert.equal((await deliver(LINK["99acres"], { json: { name: "Late", phone: "9822010070" } })).status, 401);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
  for (const m of ["Lead", "User", "Organization", "ProjectLead", "Project"]) await require(`../models/${m}`).init().catch(() => {});
  ORG = oid(); STARTER = oid(); ADMIN = oid(); AGENT = oid(); PROJECT = oid();
  await db.collection("organizations").insertMany([
    { _id: ORG, name: "Prophunt LLP", slug: `prophunt-${ORG}`, plan: "growth", isActive: true, approvalStatus: "approved", autoAssign: false },
    { _id: STARTER, name: "Small Co", slug: `small-${STARTER}`, plan: "starter", isActive: true, approvalStatus: "approved" },
  ]);
  await db.collection("users").insertMany([
    { _id: ADMIN, name: "Admin", email: "admin@example.com", role: "admin", orgId: ORG, isActive: true },
    { _id: AGENT, name: "Sheetal Powar", email: "sheetal@example.com", role: "agent", orgId: ORG, isActive: true },
  ]);
  await db.collection("projects").insertOne({ _id: PROJECT, name: "Skyline Heights", orgId: ORG, createdBy: ADMIN, isArchived: false, assignedTo: [] });
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/portal-leads", require("../routes/portalRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  console.warn = () => {}; console.info = () => {};
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Property portal leads");
})();
