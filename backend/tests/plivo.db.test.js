// Plivo click-to-call (27 Oct 2026). Real routes over HTTP with the Plivo API,
// file storage and push faked: the agent is rung through Plivo, the answer URL
// bridges the customer with a stereo recording, signed callbacks write the
// outcome once, and the recording is copied into storage.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CRYPTO_KEY = process.env.CRYPTO_KEY || "b".repeat(64);
process.env.APP_URL = "https://api.test.example";
process.env.PLIVO_HANGUP_WAIT_MS = "60";
delete process.env.OPENAI_API_KEY; // transcription has its own test
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AUTH_ID = "MAYWI2NJEWMJMTNZBHZS", TOKEN = "plivo-test-auth-token-0123456789";
let base, server, db, ORG, ADMIN, AGENT, plivo;

// Plivo API + recording host, faked.
const plivoCalls = [];
let downloads = 0;
const realFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://api.plivo.com/")) {
    plivoCalls.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null, auth: opts.headers?.Authorization });
    if (/\/Call\/$/.test(url)) return new Response(JSON.stringify({ message: "call fired", request_uuid: "req-123", api_id: "a1" }), { status: 201 });
    if (/\/Number\//.test(url)) return new Response("{}", { status: 200 });
    return new Response(JSON.stringify({ name: "Prophunt LLP", cash_credits: "1000" }), { status: 200 });
  }
  if (url.startsWith("https://media.plivo.com/")) { downloads++; return new Response(Buffer.from("RIFF....WAVE"), { status: 200 }); }
  return realFetch(url, opts);
};
let uploads = 0;
require("../utils/upload").uploadCallRecording = async () => `https://files.example.com/rec-${++uploads}.wav`;
require("../utils/push").sendPushToUser = async () => {};

const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function api(method, path, userId, body) {
  const res = await realFetch(base + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(userId)}` }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
/** Posts a Plivo callback, signed the way Plivo signs (V3) unless sign=false. */
async function callback(path, params, { sign = true, token = TOKEN } = {}) {
  const url = `${process.env.APP_URL}${path}`;
  const nonce = String(Date.now() + Math.random());
  const sorted = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  const sig = crypto.createHmac("sha256", token).update(`${url}.${sorted}.${nonce}`).digest("base64");
  const res = await realFetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(sign ? { "X-Plivo-Signature-V3": sig, "X-Plivo-Signature-V3-Nonce": nonce } : {}) },
    body: new URLSearchParams(params).toString(),
  });
  return { status: res.status, text: await res.text() };
}
async function newCall(phone = "9822001100") {
  const lead = await db.collection("leads").insertOne({ orgId: ORG, name: "Asha Patil", phone, status: "New", activities: [], createdAt: new Date() });
  const r = await api("POST", "/api/calls/initiate", AGENT, { leadId: String(lead.insertedId) });
  const doc = await db.collection("leads").findOne({ _id: lead.insertedId });
  return { r, leadId: lead.insertedId, ref: doc.activities[0]?.meta?.ownerRef };
}
const act = async (leadId) => (await db.collection("leads").findOne({ _id: leadId })).activities[0];

test("click-to-call rings the agent through Plivo from the company number", async () => {
  plivoCalls.length = 0;
  const { r, leadId, ref } = await newCall();
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const call = plivoCalls.find((c) => /\/Call\/$/.test(c.url));
  assert.equal(call.method, "POST");
  assert.equal(call.body.from, "912240123456");
  assert.equal(call.body.to, "919876500001", "the agent's phone first");
  assert.equal(call.body.answer_url, `https://api.test.example/api/plivo/answer/${ORG}?ref=${encodeURIComponent(ref)}`);
  assert.match(call.auth, /^Basic /);
  const a = await act(leadId);
  assert.equal(a.meta.provider, "plivo");
  assert.equal(a.meta.status, "initiated");
  assert.equal(a.meta.requestUuid, "req-123");
});

test("agent answers: record both sides in stereo once the customer picks up, dial the customer", async () => {
  const { leadId, ref } = await newCall("9822001101");
  const r = await callback(`/api/plivo/answer/${ORG}?ref=${encodeURIComponent(ref)}`, { CallUUID: "a-leg-1", From: "912240123456", To: "919876500001", CallStatus: "in-progress" });
  assert.match(r.text, /<Record [^>]*startOnDialAnswer="true"/);
  assert.match(r.text, /recordChannelType="stereo"/);
  assert.match(r.text, /maxLength="7200"/);
  assert.match(r.text, /<Dial callerId="912240123456"[^>]*><Number>919822001101<\/Number><\/Dial>/);
  assert.ok(r.text.indexOf("<Record") < r.text.indexOf("<Dial"), "recording set up before dialling");
  const a = await act(leadId);
  assert.equal(a.meta.agentAnswered, true);
  assert.equal(a.meta.callUuid, "a-leg-1");
});

test("customer hangs up after talking: answered with the talk time, lead moves to Contacted; the agent leg's hangup changes nothing", async () => {
  const { leadId, ref } = await newCall("9822001102");
  const q = `?ref=${encodeURIComponent(ref)}`;
  await callback(`/api/plivo/answer/${ORG}${q}`, { CallUUID: "a-2" });
  await callback(`/api/plivo/dial/${ORG}${q}`, { DialAction: "answer", DialBLegUUID: "b-2", DialALegUUID: "a-2" });
  await callback(`/api/plivo/dial/${ORG}${q}`, { DialAction: "hangup", DialBLegUUID: "b-2", DialBLegDuration: "42", DialBLegHangupCauseName: "NORMAL_CLEARING", DialBLegHangupSource: "Callee" });
  await callback(`/api/plivo/hangup/${ORG}${q}`, { CallUUID: "a-2", CallStatus: "completed", Duration: "55" });
  await sleep(200);
  const a = await act(leadId);
  assert.equal(a.meta.status, "answered");
  assert.equal(a.meta.duration, 42, "talk time, not the agent leg's 55 s");
  assert.equal(a.meta.customerAnswered, true);
  assert.equal((await db.collection("leads").findOne({ _id: leadId })).status, "Contacted");
});

test("agent never picks up: missed, once the agent leg ends", async () => {
  const { leadId, ref } = await newCall("9822001103");
  await callback(`/api/plivo/hangup/${ORG}?ref=${encodeURIComponent(ref)}`, { CallUUID: "a-3", CallStatus: "no-answer", HangupCauseName: "NO_ANSWER" });
  await sleep(200);
  const a = await act(leadId);
  assert.equal(a.meta.status, "missed");
  assert.equal(a.meta.agentLegStatus, "no-answer");
});

test("the stereo recording is copied into storage once, even if Plivo sends the callback twice", async () => {
  const { leadId, ref } = await newCall("9822001104");
  const q = `?ref=${encodeURIComponent(ref)}`;
  const params = { RecordUrl: "https://media.plivo.com/v1/Account/x/Recording/r-1.wav", RecordingID: "r-1", RecordingDuration: "40" };
  const before = downloads;
  await callback(`/api/plivo/recording/${ORG}${q}`, params);
  await callback(`/api/plivo/recording/${ORG}${q}`, params);
  await sleep(150);
  assert.equal(downloads - before, 1);
  const a = await act(leadId);
  assert.match(a.meta.recordingUrl, /^https:\/\/files\.example\.com\/rec-/);
  assert.equal(a.meta.recordingChannels, 2);
  assert.equal(a.meta.recordingId, "r-1");
});

test("a recording URL that isn't Plivo's is never fetched", async () => {
  const { leadId, ref } = await newCall("9822001105");
  const before = downloads;
  await callback(`/api/plivo/recording/${ORG}?ref=${encodeURIComponent(ref)}`, { RecordUrl: "https://evil.example.com/x.wav", RecordingID: "r-2" });
  await sleep(100);
  assert.equal(downloads, before);
  assert.ok(!(await act(leadId)).meta.recordingUrl);
});

test("signatures: unsigned or wrongly signed callbacks are refused once enforcement is on", async () => {
  const { ref } = await newCall("9822001106");
  const path = `/api/plivo/answer/${ORG}?ref=${encodeURIComponent(ref)}`;
  assert.match((await callback(path, { CallUUID: "a-6" }, { sign: false })).text, /<Dial/, "enforcement off: allowed, logged");
  process.env.PLIVO_WEBHOOK_ENFORCE = "true";
  assert.match((await callback(path, { CallUUID: "a-6" }, { token: "someone-elses-token-000000" })).text, /^<Response><Hangup\/><\/Response>$/);
  assert.match((await callback(path, { CallUUID: "a-6" })).text, /<Dial/, "a real Plivo signature still connects");
  delete process.env.PLIVO_WEBHOOK_ENFORCE;
});

test("signature check: query string in either order, and several active tokens", () => {
  const url = "https://api.test.example/api/plivo/dial/x?ref=lead_1&b=2";
  const nonce = "n1";
  const sortedUrl = "https://api.test.example/api/plivo/dial/x?b=2&ref=lead_1";
  const sig = crypto.createHmac("sha256", TOKEN).update(`${sortedUrl}.DialActionhangup.${nonce}`).digest("base64");
  assert.equal(plivo.checkSignature({ url, params: { DialAction: "hangup" }, nonce, signature: `wrongsig==,${sig}`, authToken: TOKEN }), "ok");
  assert.equal(plivo.checkSignature({ url, params: { DialAction: "answer" }, nonce, signature: sig, authToken: TOKEN }), "invalid");
  assert.equal(plivo.checkSignature({ url, params: {}, nonce: "", signature: "", authToken: TOKEN }), "missing");
});

test("settings: the token is stored encrypted and never sent back; switching to Plivo needs it all", async () => {
  const org2 = oid(), admin2 = oid();
  await db.collection("organizations").insertOne({ _id: org2, name: "Second", slug: `second-${org2}`, plan: "enterprise", isActive: true, approvalStatus: "approved" });
  await db.collection("users").insertOne({ _id: admin2, name: "Admin Two", email: "a2@example.com", role: "admin", orgId: org2, isActive: true });
  assert.equal((await api("PATCH", "/api/plivo/settings", admin2, { provider: "plivo" })).status, 400, "nothing saved yet");
  assert.equal((await api("PATCH", "/api/plivo/settings", admin2, { authId: AUTH_ID, authToken: TOKEN, number: "022 4012 3457" })).status, 200);
  const saved = await db.collection("organizations").findOne({ _id: org2 });
  assert.notEqual(saved.plivo.authToken, TOKEN, "encrypted at rest");
  assert.equal(saved.plivo.number, "912240123457");
  const got = await api("GET", "/api/plivo/settings", admin2);
  assert.equal(got.json.plivo.hasAuthToken, true);
  assert.ok(!JSON.stringify(got.json).includes(TOKEN));
  assert.equal((await api("PATCH", "/api/plivo/settings", admin2, { provider: "plivo" })).status, 200);
  assert.equal((await db.collection("organizations").findOne({ _id: org2 })).telephony.provider, "plivo");
  const t = await api("POST", "/api/plivo/settings/test", admin2);
  assert.equal(t.status, 200, JSON.stringify(t.json));
  assert.equal((await api("PATCH", "/api/plivo/settings", admin2, { number: "12345" })).status, 400, "not an Indian number");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
  for (const m of ["Lead", "User", "Organization", "ProjectLead"]) await require(`../models/${m}`).init().catch(() => {});
  plivo = require("../services/plivo");
  ORG = oid(); ADMIN = oid(); AGENT = oid();
  await db.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `prophunt-${ORG}`, plan: "enterprise", isActive: true, approvalStatus: "approved",
    telephony: { provider: "plivo" },
    plivo: { enabled: true, authId: AUTH_ID, authToken: plivo.encryptField(TOKEN), number: "912240123456" },
  });
  await db.collection("users").insertMany([
    { _id: ADMIN, name: "Admin", email: "admin@example.com", role: "admin", orgId: ORG, isActive: true },
    { _id: AGENT, name: "Sheetal Powar", email: "sheetal@example.com", role: "admin", orgId: ORG, isActive: true, phone: "9876500001" },
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/calls", require("../routes/enablexRoutes"));
  app.use("/api/plivo", require("../routes/plivoRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  console.warn = () => {}; console.info = () => {};
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Plivo click-to-call");
})();
