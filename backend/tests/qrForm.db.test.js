// QR enquiry form (21 Oct 2026), against the real /api/public routes and a real
// database:
//  - a valid org QR saves a lead; a bad token, an inactive company and an
//    archived project's QR are refused with a plain message
//  - bad input is a clear 400, never a server error
//  - the same number again is noted on the existing lead, not saved twice
//  - a project QR files the lead into that project too
//  - the hidden anti-bot field keeps nothing
//  - submissions are limited per QR code, not per network
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");

// No real pushes: record them instead.
const pushes = [];
const pushId = require.resolve("../utils/push");
require.cache[pushId] = { id: pushId, filename: pushId, loaded: true, exports: new Proxy({}, { get: () => async (p) => { pushes.push(p); } }) };

const oid = () => new mongoose.Types.ObjectId();
let mongod, server, base, Lead, ProjectLead, ORG, AGENT, PROJECT;
const ORG_QR = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const PROJECT_QR = "0f9e8d7c6b5a49382716f5e4d3c2b1a0";
const ARCHIVED_QR = "11112222333344445555666677778888";
const OFF_QR = "99998888777766665555444433332222";

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? new URLSearchParams(body).toString() : "";
    const req = http.request(`${base}${path}`, {
      method, agent: false,
      headers: { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(data) },
    }, (res) => {
      const chunks = []; res.on("data", (c) => chunks.push(c));
      res.on("end", () => { let json = null; try { json = JSON.parse(Buffer.concat(chunks).toString()); } catch { /* not json */ } resolve({ status: res.statusCode, json }); });
    });
    req.on("error", reject); req.end(data);
  });
}

test("the form loads the company (and project) for a good QR", async () => {
  const org = await call("GET", `/api/public/form/${ORG_QR}`);
  assert.equal(org.status, 200);
  assert.equal(org.json.org.name, "Test Realty");
  assert.equal(org.json.org.phone, "+91 98200 00000");
  assert.equal(org.json.project, null);
  const proj = await call("GET", `/api/public/form/${PROJECT_QR}`);
  assert.equal(proj.json.type, "project");
  assert.equal(proj.json.project.name, "Khopoli Plots");
});

test("a bad, archived or switched-off QR gets a plain refusal", async () => {
  assert.equal((await call("GET", "/api/public/form/deadbeefdeadbeefdeadbeefdeadbeef")).status, 404);
  const archived = await call("GET", `/api/public/form/${ARCHIVED_QR}`);
  assert.equal(archived.status, 410);
  assert.ok(/closed/i.test(archived.json.message));
  assert.equal((await call("POST", `/api/public/form/${ARCHIVED_QR}`, { name: "Asha", phone: "9876500011" })).status, 410);
  assert.equal((await call("GET", `/api/public/form/${OFF_QR}`)).status, 403);
});

test("bad input is a clear 400, never a crash", async () => {
  const short = await call("POST", `/api/public/form/${ORG_QR}`, { name: "A", phone: "9876500001" });
  assert.equal(short.status, 400);
  assert.ok(/name/i.test(short.json.message));
  const phone = await call("POST", `/api/public/form/${ORG_QR}`, { name: "Asha Patil", phone: "12345" });
  assert.equal(phone.status, 400);
  assert.ok(/mobile number/i.test(phone.json.message));
  const odd = await call("POST", `/api/public/form/${ORG_QR}`, { name: "Odd Budget", phone: "9876500002", budget: "lots", propertyType: "Castle" });
  assert.equal(odd.status, 201);
  const lead = await Lead.findOne({ name: "Odd Budget" }).lean();
  assert.equal(lead.budget.max, 0);
  assert.notEqual(lead.propertyType, "Castle");
});

test("an org QR saves one lead, phone cleaned, assigned, with a push that opens it", async () => {
  pushes.length = 0;
  const res = await call("POST", `/api/public/form/${ORG_QR}`, { name: "Ravi Kulkarni", phone: "+91 98765-43210", message: "2 BHK near station", whatsappConsent: "true" });
  assert.equal(res.status, 201);
  assert.equal(res.json.success, true);
  const lead = await Lead.findOne({ name: "Ravi Kulkarni" }).lean();
  assert.equal(lead.phone, "+919876543210");
  assert.equal(lead.source, "QR Code");
  assert.equal(String(lead.assignedTo), String(AGENT));
  assert.equal(lead.whatsappConsent.status, "granted");
  assert.equal(lead.notes[0].text, "2 BHK near station");
  assert.equal(pushes.at(-1).data.leadId, String(lead._id));
});

test("the same number again is noted on that lead, not saved twice", async () => {
  // Make the first one older than the two-minute double-tap window.
  await mongoose.connection.collection("leads").updateOne({ name: "Ravi Kulkarni" }, { $set: { createdAt: new Date(Date.now() - 3600e3) } });
  const again = await call("POST", `/api/public/form/${PROJECT_QR}`, { name: "Ravi K", phone: "9876543210", message: "Also interested in plots" });
  assert.equal(again.status, 201);
  assert.equal(await Lead.countDocuments({ phone: { $regex: "9876543210$" } }), 1);
  const lead = await Lead.findOne({ name: "Ravi Kulkarni" }).lean();
  assert.ok(lead.notes.some((n) => /Enquired again via QR code for Khopoli Plots/.test(n.text)));
  assert.equal(await ProjectLead.countDocuments({ project: PROJECT, phone: { $regex: "9876543210$" } }), 1);
});

test("a double tap within two minutes is one lead", async () => {
  await call("POST", `/api/public/form/${ORG_QR}`, { name: "Meera Iyer", phone: "9876500100" });
  await call("POST", `/api/public/form/${ORG_QR}`, { name: "Meera Iyer", phone: "9876500100" });
  assert.equal(await Lead.countDocuments({ phone: { $regex: "9876500100$" } }), 1);
  assert.equal((await Lead.findOne({ phone: { $regex: "9876500100$" } }).lean()).notes.length, 0);
});

test("a project QR puts a new lead in the project's own list", async () => {
  const res = await call("POST", `/api/public/form/${PROJECT_QR}`, { name: "Kiran Shah", phone: "9876500200" });
  assert.equal(res.status, 201);
  const lead = await Lead.findOne({ name: "Kiran Shah" }).lean();
  assert.equal(lead.leadSourceLabel, "QR code · Khopoli Plots");
  assert.equal(await ProjectLead.countDocuments({ project: PROJECT, name: "Kiran Shah" }), 1);
});

test("the hidden anti-bot field answers OK and keeps nothing", async () => {
  const res = await call("POST", `/api/public/form/${ORG_QR}`, { name: "Spam Bot", phone: "9876500300", company_website: "http://spam.example" });
  assert.equal(res.status, 201);
  assert.equal(await Lead.countDocuments({ name: "Spam Bot" }), 0);
});

test("the limit is per QR code (60 per 15 min), so one shared network is not cut off at 10", async () => {
  let accepted = 0;
  for (let i = 0; i < 15; i++) {
    const r = await call("POST", `/api/public/form/${ORG_QR}`, { name: `Expo Visitor ${i}`, phone: `98770${String(10000 + i)}` });
    if (r.status === 201) accepted++;
  }
  assert.equal(accepted, 15);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  ProjectLead = require("../models/ProjectLead");
  await Lead.init();
  const db = mongoose.connection;
  ORG = oid(); AGENT = oid(); PROJECT = oid();
  const OFF = oid();
  await db.collection("organizations").insertMany([
    { _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: true, isActive: true, qrToken: ORG_QR, phone: "+91 98200 00000" },
    { _id: OFF, name: "Closed Co", slug: `c-${OFF}`, plan: "enterprise", isActive: false, qrToken: OFF_QR },
  ]);
  await db.collection("users").insertOne({ _id: AGENT, name: "Riya Agent", email: "r@example.com", role: "agent", orgId: ORG, isActive: true });
  await db.collection("projects").insertMany([
    { _id: PROJECT, name: "Khopoli Plots", orgId: ORG, createdBy: AGENT, qrToken: PROJECT_QR },
    { _id: oid(), name: "Old Tower", orgId: ORG, createdBy: AGENT, qrToken: ARCHIVED_QR, isArchived: true },
  ]);

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use("/api/public", require("../routes/publicRoutes"));
  app.use((err, req, res, _next) => res.status(500).json({ success: false, message: err.message }));
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("QR enquiry form: loads the right company, saves once, files into the project, refuses cleanly");
})();
