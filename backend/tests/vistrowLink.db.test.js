// Single-token handshake from Vistrow Voice (POST /webhook/vistrow/link and
// /unlink), against a real in-memory MongoDB and the real routes. Contract of
// 2026-10-16: the Vistrow Voice connection token alone fills step 1 of the
// Auto-call tab; linking never enables; re-pointing an enabled integration
// switches it off; the owner's manual path marks linkedBy "manual".
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CRYPTO_KEY = process.env.CRYPTO_KEY || "a".repeat(64);
process.env.VISTROW_OUTBOUND_ALLOWED_HOSTS = "api.vistrowvoice.com,staging.vistrowvoice.com";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");

const oid = () => new mongoose.Types.ObjectId();
const TOKEN = "AW-" + "x".repeat(48);
const OTHER_TOKEN = "AW-" + "y".repeat(48);
const INACTIVE_TOKEN = "AW-" + "z".repeat(48);
let base, mongod, server, ORG, OTHER_ORG, admin, OutboundIntegration, OutboundDelivery;

async function post(path, body) {
  const res = await fetch(`${base}/webhook/vistrow/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const link = (extra = {}) => post("link", { token: TOKEN, account_id: "2", base_url: "https://api.vistrowvoice.com", account_name: "Vistrow Technologies", ...extra });
const load = (org = ORG) => OutboundIntegration.findOne({ orgId: org, provider: "vistrow" }).select("+secretEnc");
const auth = (u) => ({ Authorization: `Bearer ${jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "1h" })}` });

test("link happy path: doc created with the token as secret, origin, account, linkedBy vistrow", async () => {
  const r = await link({ base_url: "https://api.vistrowvoice.com/", account_name: "  Vistrow   Technologies  " });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(Object.keys(r.body).sort(), ["account_id", "enabled", "linked_at", "org_id", "org_name", "success", "switched_off"]);
  assert.equal(r.body.success, true);
  assert.equal(r.body.org_id, String(ORG));
  assert.equal(r.body.org_name, "Prophunt LLP");
  assert.equal(r.body.account_id, "2");
  assert.equal(r.body.enabled, false);
  assert.equal(r.body.switched_off, false);
  assert.ok(!Number.isNaN(Date.parse(r.body.linked_at)));
  const doc = await load();
  assert.equal(doc.baseUrl, "https://api.vistrowvoice.com");
  assert.equal(doc.accountId, "2");
  assert.equal(doc.authMode, "header");
  assert.equal(doc.getSecret(), TOKEN);
  assert.equal(doc.linkedBy, "vistrow");
  assert.equal(doc.linkedAccountName, "Vistrow Technologies");
  assert.equal(doc.linkedAt.toISOString(), r.body.linked_at);
  assert.equal(doc.enabled, false, "linking never enables");
});

test("idempotent repeat: same values, no switch-off, enabled untouched", async () => {
  await OutboundIntegration.updateOne({ orgId: ORG }, { $set: { enabled: true, enabledAt: new Date() } });
  const r = await link();
  assert.equal(r.status, 200);
  assert.equal(r.body.switched_off, false);
  assert.equal(r.body.enabled, true);
  assert.equal((await load()).enabled, true);
  assert.equal(await OutboundIntegration.countDocuments({ orgId: ORG }), 1);
});

test("re-link with a different account while enabled: switched off, pending deliveries cancelled", async () => {
  await OutboundDelivery.create({ orgId: ORG, provider: "vistrow", eventId: "evt_pending_1", status: "pending", leadId: oid(), leadCreatedAt: new Date() });
  const r = await link({ account_id: "7" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.switched_off, true);
  assert.equal(r.body.enabled, false);
  assert.equal(r.body.account_id, "7");
  const doc = await load();
  assert.equal(doc.enabled, false);
  assert.equal(doc.accountId, "7");
  const d = await OutboundDelivery.findOne({ orgId: ORG, eventId: "evt_pending_1" }).lean();
  assert.equal(d.status, "cancelled");
  assert.equal(d.skipReason, "relinked");
});

test("unknown token -> 401 key_rejected", async () => {
  const r = await link({ token: "AW-nope" });
  assert.equal(r.status, 401);
  assert.equal(r.body.success, false);
  assert.equal(r.body.code, "key_rejected");
  const missing = await post("link", { account_id: "2", base_url: "https://api.vistrowvoice.com" });
  assert.equal(missing.status, 401);
  assert.equal(missing.body.code, "key_rejected");
});

test("inactive automation -> 401", async () => {
  const r = await link({ token: INACTIVE_TOKEN });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "key_rejected");
});

test("org below enterprise -> 403 plan", async () => {
  const r = await link({ token: OTHER_TOKEN });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "plan");
  assert.equal(await OutboundIntegration.countDocuments({ orgId: OTHER_ORG }), 0);
});

test("disallowed host -> 400 base_url", async () => {
  const r = await link({ base_url: "https://evil.example.com" });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "base_url");
  assert.equal((await load()).accountId, "7", "nothing changed");
});

test("bad account id -> 400 account_id", async () => {
  for (const account_id of ["", "a b", "x".repeat(65), "1/2"]) {
    const r = await link({ account_id });
    assert.equal(r.status, 400, account_id);
    assert.equal(r.body.code, "account_id");
  }
});

test("status endpoint exposes linkedBy / linkedAt / linkedAccountName", async () => {
  const res = await fetch(`${base}/api/integrations/vistrow-outbound`, { headers: auth(admin) });
  assert.equal(res.status, 200);
  const { status } = await res.json();
  assert.equal(status.configured, true);
  assert.equal(status.config.linkedBy, "vistrow");
  assert.equal(status.config.linkedAccountName, "Vistrow Technologies");
  assert.ok(status.config.linkedAt);
  assert.equal(status.config.hasSecret, true);
  assert.equal(JSON.stringify(status).includes(TOKEN), false, "token never serialised");
});

test("manual PUT /config marks linkedBy manual", async () => {
  const res = await fetch(`${base}/api/integrations/vistrow-outbound/config`, {
    method: "PUT", headers: { ...auth(admin), "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: "https://api.vistrowvoice.com", accountId: "9", authMode: "header", secret: "manual-key-0123456789" }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  const { status } = body;
  assert.equal(status.config.linkedBy, "manual");
  assert.ok(status.config.linkedAt);
  assert.equal((await load()).getSecret(), "manual-key-0123456789");
});

test("unlink clears and disables; a second unlink is still 200", async () => {
  await OutboundIntegration.updateOne({ orgId: ORG }, { $set: { enabled: true, enabledAt: new Date() } });
  await OutboundDelivery.create({ orgId: ORG, provider: "vistrow", eventId: "evt_pending_2", status: "pending", leadId: oid(), leadCreatedAt: new Date() });
  const r = await post("unlink", { token: TOKEN });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { success: true, unlinked: true });
  const doc = await load();
  assert.equal(doc.enabled, false);
  assert.equal(doc.baseUrl, "");
  assert.equal(doc.accountId, "");
  assert.equal(doc.secretEnc, "");
  assert.equal(doc.getSecret(), "");
  assert.equal(doc.linkedAt, null);
  assert.equal(doc.linkedBy, "");
  assert.equal(doc.linkedAccountName, "");
  assert.equal((await OutboundDelivery.findOne({ orgId: ORG, eventId: "evt_pending_2" }).lean()).skipReason, "unlinked");
  assert.deepEqual((await post("unlink", { token: TOKEN })).body, { success: true, unlinked: true });
  assert.equal((await post("unlink", { token: "AW-nope" })).status, 401);
  assert.equal((await post("unlink", { token: OTHER_TOKEN })).status, 403);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  OutboundIntegration = require("../models/OutboundIntegration");
  OutboundDelivery = require("../models/OutboundDelivery");
  await OutboundIntegration.init();
  await OutboundDelivery.init();
  const User = require("../models/User");
  ORG = oid(); OTHER_ORG = oid();
  await mongoose.connection.collection("organizations").insertMany([
    { _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false, isActive: true, approvalStatus: "approved" },
    { _id: OTHER_ORG, name: "Small Co", slug: `t-${OTHER_ORG}`, plan: "growth", autoAssign: false, isActive: true, approvalStatus: "approved" },
  ]);
  admin = { _id: oid(), orgId: ORG, role: "admin", name: "Admin A", email: "admin@example.com", isActive: true };
  await User.collection.insertOne(admin);
  const automation = (orgId, verifyToken, isActive) => ({ _id: oid(), name: "Vistrow Voice", platform: "Vistrow Voice", verifyToken, isActive, orgId, createdBy: oid(), updatedBy: oid() });
  await mongoose.connection.collection("automations").insertMany([
    automation(ORG, TOKEN, true), automation(ORG, INACTIVE_TOKEN, false), automation(OTHER_ORG, OTHER_TOKEN, true),
  ]);

  const app = express();
  app.use("/webhook/vistrow", require("../routes/vistrowLinkRoutes"));
  app.use(express.json());
  app.use("/api/integrations/vistrow-outbound", require("../routes/vistrowOutboundRoutes"));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message })); // eslint-disable-line no-unused-vars
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow Voice single-token link handshake");
})();
