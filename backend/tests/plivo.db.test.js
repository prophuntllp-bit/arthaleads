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
    if (/\/Application\/$/.test(url)) return new Response(JSON.stringify({ message: "created", app_id: "app-1" }), { status: 201 });
    if (/\/Application\/app-1\/$/.test(url)) return new Response(JSON.stringify({ message: "changed" }), { status: 202 });
    if (/\/Number\/\?/.test(url)) return new Response(JSON.stringify({ objects: [{ number: "18885550100" }, { number: "912240123457" }, { number: "912240123456" }] }), { status: 200 });
    if (/\/Number\//.test(url)) return new Response(JSON.stringify({ message: "changed" }), { status: 202 });
    return new Response(JSON.stringify({ name: "Prophunt LLP", cash_credits: "1000" }), { status: 200 });
  }
  if (url.startsWith("https://media.plivo.com/")) { downloads++; return new Response(Buffer.from("RIFF....WAVE"), { status: 200 }); }
  return realFetch(url, opts);
};
let uploads = 0;
require("../utils/storage").isConfigured = () => true;
require("../utils/upload").uploadCallRecording = async () => `https://files.example.com/rec-${++uploads}.wav`;
const pushes = [];
require("../utils/push").sendPushToUser = async (id, msg) => { pushes.push({ id, ...msg }); };
require("../utils/push").sendPushToAll = async (msg) => { pushes.push({ all: true, ...msg }); };

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
  const first = await api("PATCH", "/api/plivo/settings", admin2, { authId: AUTH_ID, authToken: TOKEN });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  const saved = await db.collection("organizations").findOne({ _id: org2 });
  assert.notEqual(saved.plivo.authToken, TOKEN, "encrypted at rest");
  assert.equal(saved.plivo.number, "912240123457", "the account's first Indian number, not typed in");
  assert.deepEqual(saved.plivo.numbers, ["912240123457", "912240123456", "18885550100"]);
  assert.equal((await api("PATCH", "/api/plivo/settings", admin2, { number: "+91 22 4012 3456" })).status, 200, "another number on the account");
  assert.equal((await db.collection("organizations").findOne({ _id: org2 })).plivo.number, "912240123456");
  const got = await api("GET", "/api/plivo/settings", admin2);
  assert.equal(got.json.plivo.hasAuthToken, true);
  assert.ok(!JSON.stringify(got.json).includes(TOKEN));
  assert.equal((await api("PATCH", "/api/plivo/settings", admin2, { provider: "plivo" })).status, 200);
  assert.equal((await db.collection("organizations").findOne({ _id: org2 })).telephony.provider, "plivo");
  const t = await api("POST", "/api/plivo/settings/test", admin2);
  assert.equal(t.status, 200, JSON.stringify(t.json));
  assert.equal((await api("PATCH", "/api/plivo/settings", admin2, { number: "022 9999 0000" })).status, 400, "not a number on the account");
});

// ── Incoming calls ────────────────────────────────────────────────────────────
test("connect incoming calls: an application pointing at us, the number attached; again = update", async () => {
  plivoCalls.length = 0;
  const r = await api("POST", "/api/plivo/settings/inbound", ADMIN);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const app = plivoCalls.find((c) => /\/Application\/$/.test(c.url));
  assert.equal(app.body.answer_url, `https://api.test.example/api/plivo/inbound/${ORG}`);
  assert.equal(app.body.hangup_url, `https://api.test.example/api/plivo/inbound-hangup/${ORG}`);
  const num = plivoCalls.find((c) => /\/Number\/912240123456\/$/.test(c.url));
  assert.equal(num.body.app_id, "app-1");
  const org = await db.collection("organizations").findOne({ _id: ORG });
  assert.equal(org.plivo.appId, "app-1");
  assert.ok(org.plivo.inboundConnectedAt);
  plivoCalls.length = 0;
  await api("POST", "/api/plivo/settings/inbound", ADMIN);
  assert.ok(plivoCalls.some((c) => /\/Application\/app-1\/$/.test(c.url)), "updates the existing app");
  assert.ok(!plivoCalls.some((c) => /\/Application\/$/.test(c.url)), "no second app");
});

async function leadCalledBy(phone, userId, userName) {
  const lead = await db.collection("leads").insertOne({ orgId: ORG, name: "Ravi Kulkarni", phone, status: "Contacted", createdAt: new Date(), updatedAt: new Date(),
    activities: [{ _id: oid(), type: "called", performedBy: userId, performedByName: userName, createdAt: new Date(Date.now() - 86400000), meta: { direction: "outbound", status: "answered", agentPhone: "9876500001" } }] });
  return lead.insertedId;
}

test("a lead calls back: it rings the agent who last called them, recorded in stereo, logged on the lead", async () => {
  const leadId = await leadCalledBy("9822001200", AGENT, "Sheetal Powar");
  pushes.length = 0;
  const r = await callback(`/api/plivo/inbound/${ORG}`, { CallUUID: "in-1", From: "919822001200", To: "912240123456", Direction: "inbound", CallStatus: "ringing" });
  assert.match(r.text, /<Record [^>]*startOnDialAnswer="true"[^>]*recordChannelType="stereo"/);
  assert.match(r.text, /<Dial callerId="912240123456"[^>]*action="https:\/\/api\.test\.example\/api\/plivo\/inbound-dialed\//);
  assert.match(r.text, /<Number>919876500001<\/Number>/);
  const lead = await db.collection("leads").findOne({ _id: leadId });
  const a = lead.activities.find((x) => x.meta?.direction === "inbound");
  assert.equal(a.meta.provider, "plivo");
  assert.equal(a.meta.callUuid, "in-1");
  assert.equal(a.performedByName, "Sheetal Powar");
  assert.ok(pushes.some((p) => p.title === "Ravi Kulkarni is calling" && /Pick up your phone/.test(p.body)));
});

test("incoming call answered: talk time from the agent leg, then the caller's hangup changes nothing", async () => {
  const leadId = await leadCalledBy("9822001201", AGENT, "Sheetal Powar");
  const r = await callback(`/api/plivo/inbound/${ORG}`, { CallUUID: "in-2", From: "919822001201" });
  const ref = decodeURIComponent(r.text.match(/inbound-dialed\/[^?]+\?ref=([^"&]+)/)[1]);
  await callback(`/api/plivo/dial/${ORG}?ref=${encodeURIComponent(ref)}`, { DialAction: "answer", DialBLegUUID: "ag-2" });
  await callback(`/api/plivo/dial/${ORG}?ref=${encodeURIComponent(ref)}`, { DialAction: "hangup", DialBLegDuration: "50" });
  await callback(`/api/plivo/inbound-hangup/${ORG}`, { CallUUID: "in-2", CallStatus: "completed" });
  await sleep(200);
  const a = (await db.collection("leads").findOne({ _id: leadId })).activities.find((x) => x.meta?.callUuid === "in-2");
  assert.equal(a.meta.status, "answered");
  assert.equal(a.meta.duration, 50);
});

test("incoming call nobody picks up: the caller hears a sorry message; missed, and the agent is told", async () => {
  const leadId = await leadCalledBy("9822001202", AGENT, "Sheetal Powar");
  const r = await callback(`/api/plivo/inbound/${ORG}`, { CallUUID: "in-3", From: "919822001202" });
  const ref = decodeURIComponent(r.text.match(/inbound-dialed\/[^?]+\?ref=([^"&]+)/)[1]);
  const dialed = await callback(`/api/plivo/inbound-dialed/${ORG}?ref=${encodeURIComponent(ref)}`, { DialStatus: "no-answer" });
  assert.match(dialed.text, /<Speak[^>]*>Sorry, we could not connect your call right now/);
  pushes.length = 0;
  await callback(`/api/plivo/inbound-hangup/${ORG}`, { CallUUID: "in-3", CallStatus: "completed" });
  await sleep(200);
  const a = (await db.collection("leads").findOne({ _id: leadId })).activities.find((x) => x.meta?.callUuid === "in-3");
  assert.equal(a.meta.status, "missed");
  assert.match(a.description, /^Missed inbound call from Ravi Kulkarni/);
  assert.ok(pushes.some((p) => /Missed call from Ravi Kulkarni/.test(p.title)));
  assert.match((await callback(`/api/plivo/inbound-dialed/${ORG}?ref=x`, { DialStatus: "completed" })).text, /^<Response><Hangup\/><\/Response>$/);
});

test("a lead stored with spaces (+91 98220 01299) is still recognised when they call in", async () => {
  const lead = await db.collection("leads").insertOne({ orgId: ORG, name: "Meena Joshi", phone: "+91 98220 01299", status: "New", createdAt: new Date(), updatedAt: new Date(),
    activities: [{ _id: oid(), type: "called", performedBy: AGENT, performedByName: "Sheetal Powar", createdAt: new Date(), meta: { direction: "outbound", status: "answered" } }] });
  await callback(`/api/plivo/inbound/${ORG}`, { CallUUID: "in-5", From: "919822001299" });
  const a = (await db.collection("leads").findOne({ _id: lead.insertedId })).activities.find((x) => x.meta?.callUuid === "in-5");
  assert.ok(a, "logged on Meena's lead");
  assert.equal(a.meta.direction, "inbound");
});

test("signature over a raw '+' that Plivo didn't percent-encode still checks out", async () => {
  const url = `${process.env.APP_URL}/api/plivo/inbound/${ORG}`;
  const nonce = "n-plus";
  const params = { CallUUID: "in-6", From: "+919000000123" };
  const sorted = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  const sig = crypto.createHmac("sha256", TOKEN).update(`${url}.${sorted}.${nonce}`).digest("base64");
  process.env.PLIVO_WEBHOOK_ENFORCE = "true";
  const res = await realFetch(`${base}/api/plivo/inbound/${ORG}`, { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Plivo-Signature-V3": sig, "X-Plivo-Signature-V3-Nonce": nonce },
    body: "CallUUID=in-6&From=+919000000123" });
  delete process.env.PLIVO_WEBHOOK_ENFORCE;
  assert.match(await res.text(), /<Dial/, "accepted, not refused");
});

test("an unknown number still reaches someone on the team; nothing logged against a lead", async () => {
  const r = await callback(`/api/plivo/inbound/${ORG}`, { CallUUID: "in-4", From: "919000000099" });
  assert.match(r.text, /<Number>919876500001<\/Number>/, "the only team member with a phone");
  assert.equal(await db.collection("leads").countDocuments({ "activities.meta.callUuid": "in-4" }), 0);
});

test("both services off: click-to-call is refused and an incoming call is not put through", async () => {
  await db.collection("organizations").updateOne({ _id: ORG }, { $set: { "telephony.provider": "none" } });
  const lead = await db.collection("leads").insertOne({ orgId: ORG, name: "Off Test", phone: "9822001199", status: "New", activities: [], createdAt: new Date() });
  const r = await api("POST", "/api/calls/initiate", AGENT, { leadId: String(lead.insertedId) });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /switched off/);
  const inb = await callback(`/api/plivo/inbound/${ORG}`, { CallUUID: "in-off", From: "919822001199", To: "912240123456" });
  assert.doesNotMatch(inb.text, /<Dial/, "nobody's phone rings");
  assert.match(inb.text, /<Hangup|<Speak/);
  assert.equal((await api("PATCH", "/api/plivo/settings", ADMIN, { provider: "none" })).status, 200, "an admin can switch both off");
  await db.collection("organizations").updateOne({ _id: ORG }, { $set: { "telephony.provider": "plivo" } });
});

test("a foreign number is refused before the agent's phone rings", async () => {
  plivoCalls.length = 0;
  const lead = await db.collection("leads").insertOne({ orgId: ORG, name: "NRI Lead", phone: "971504865636", status: "New", activities: [], createdAt: new Date() });
  const r = await api("POST", "/api/calls/initiate", AGENT, { leadId: String(lead.insertedId) });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, "international");
  assert.match(r.json.message, /UAE number/);
  assert.equal(plivoCalls.filter((c) => /\/Call\/$/.test(c.url)).length, 0, "Plivo is never asked to call");
});

test("two numbers in one field: the first Indian one, or the one the agent picked, is dialled", async () => {
  const lead = await db.collection("leads").insertOne({ orgId: ORG, name: "Two Numbers", phone: "7020074316/8958108809", status: "New", activities: [], createdAt: new Date() });
  let r = await api("POST", "/api/calls/initiate", AGENT, { leadId: String(lead.insertedId) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  let doc = await db.collection("leads").findOne({ _id: lead.insertedId });
  let act = doc.activities.at(-1);
  assert.equal(act.meta.leadPhone, "917020074316");
  const ans = await callback(`/api/plivo/answer/${ORG}?ref=${encodeURIComponent(act.meta.ownerRef)}`, { CallUUID: "two-1" });
  assert.match(ans.text, /<Number>917020074316<\/Number>/);
  r = await api("POST", "/api/calls/initiate", AGENT, { leadId: String(lead.insertedId), phone: "8958108809" });
  doc = await db.collection("leads").findOne({ _id: lead.insertedId });
  assert.equal(doc.activities.at(-1).meta.leadPhone, "918958108809");
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
