// DPDP notice and consent on the QR enquiry form (28 Oct 2026), against the real
// /api/public routes and a real database:
//  - the form serves the exact consent wording (naming the company) and its
//    privacy policy link
//  - an enquiry without the consent tick is refused with a plain 400 and
//    saves nothing, so the box can't be skipped by posting to the API
//  - with the tick, the lead records dataConsent (given, time, source, the
//    wording shown), and a project QR's copy in the project carries it too
//  - a repeat enquiry refreshes the consent on the existing lead
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");

// No real pushes.
const pushId = require.resolve("../utils/push");
require.cache[pushId] = { id: pushId, filename: pushId, loaded: true, exports: new Proxy({}, { get: () => async () => {} }) };

const oid = () => new mongoose.Types.ObjectId();
let mongod, server, base, Lead, ProjectLead, PROJECT;
const ORG_QR = "c0ffee00c0ffee00c0ffee00c0ffee00";
const PROJECT_QR = "beef0000beef0000beef0000beef0000";
const WORDING = "I agree that Sunrise Homes may contact me about this enquiry by phone, WhatsApp or email, and store my details in its CRM.";

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

test("the form serves the consent wording naming the company, and its privacy link", async () => {
  const r = await call("GET", `/api/public/form/${ORG_QR}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.consentText, WORDING);
  assert.equal(r.json.org.privacyUrl, "https://sunrisehomes.example/privacy");
});

test("an enquiry without the consent tick is refused and saves nothing", async () => {
  for (const body of [
    { name: "Nikhil Rao", phone: "9876511111" },
    { name: "Nikhil Rao", phone: "9876511111", dataConsent: "false" },
    { name: "Nikhil Rao", phone: "9876511111", dataConsent: "" },
  ]) {
    const r = await call("POST", `/api/public/form/${ORG_QR}`, body);
    assert.equal(r.status, 400);
    assert.equal(r.json.success, false);
    assert.ok(/tick the box/i.test(r.json.message), r.json.message);
  }
  assert.equal(await Lead.countDocuments({ phone: { $regex: "9876511111$" } }), 0);
});

test("with the tick, the lead stores dataConsent with source, time and wording", async () => {
  const before = Date.now();
  const r = await call("POST", `/api/public/form/${ORG_QR}`, { name: "Nikhil Rao", phone: "9876511111", dataConsent: "true" });
  assert.equal(r.status, 201);
  const lead = await Lead.findOne({ phone: { $regex: "9876511111$" } }).lean();
  assert.equal(lead.dataConsent.given, true);
  assert.equal(lead.dataConsent.source, "qr-form");
  assert.equal(lead.dataConsent.text, WORDING);
  assert.ok(lead.dataConsent.at.getTime() >= before - 1000 && lead.dataConsent.at.getTime() <= Date.now());
  // The separate WhatsApp marketing opt-in was not ticked, so it stays unset.
  assert.notEqual(lead.whatsappConsent?.status, "granted");
});

test("a project QR's copy in the project carries the consent too", async () => {
  const r = await call("POST", `/api/public/form/${PROJECT_QR}`, { name: "Pooja Desai", phone: "9876522222", dataConsent: "on" });
  assert.equal(r.status, 201);
  const pl = await ProjectLead.findOne({ project: PROJECT, name: "Pooja Desai" }).lean();
  assert.ok(pl, "filed into the project");
  assert.equal(pl.dataConsent.given, true);
  assert.equal(pl.dataConsent.source, "qr-form");
  assert.equal(pl.dataConsent.text, WORDING);
});

test("a repeat enquiry refreshes the consent on the existing lead", async () => {
  const old = new Date(Date.now() - 3600e3);
  await mongoose.connection.collection("leads").updateOne(
    { phone: { $regex: "9876511111$" } },
    { $set: { createdAt: old, "dataConsent.at": old } },
  );
  const r = await call("POST", `/api/public/form/${ORG_QR}`, { name: "Nikhil R", phone: "9876511111", dataConsent: "true" });
  assert.equal(r.status, 201);
  assert.equal(await Lead.countDocuments({ phone: { $regex: "9876511111$" } }), 1);
  const lead = await Lead.findOne({ phone: { $regex: "9876511111$" } }).lean();
  assert.ok(lead.dataConsent.at > old);
});

test("a lead made another way gets no dataConsent", async () => {
  const lead = await Lead.create({ name: "Manual Lead", phone: "9876533333", orgId: oid(), source: "Manual" });
  assert.equal((await Lead.findById(lead._id).lean()).dataConsent, undefined);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  ProjectLead = require("../models/ProjectLead");
  await Lead.init();
  const db = mongoose.connection;
  const ORG = oid(); const AGENT = oid(); PROJECT = oid();
  await db.collection("organizations").insertOne({
    _id: ORG, name: "Sunrise Homes", slug: `s-${ORG}`, plan: "enterprise", autoAssign: true, isActive: true,
    qrToken: ORG_QR, privacyUrl: "https://sunrisehomes.example/privacy",
  });
  await db.collection("users").insertOne({ _id: AGENT, name: "Riya Agent", email: "r@example.com", role: "agent", orgId: ORG, isActive: true });
  await db.collection("projects").insertOne({ _id: PROJECT, name: "Lakeview", orgId: ORG, createdBy: AGENT, qrToken: PROJECT_QR });

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use("/api/public", require("../routes/publicRoutes"));
  app.use((err, req, res, _next) => res.status(500).json({ success: false, message: err.message }));
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("QR enquiry form: DPDP notice and consent");
})();
