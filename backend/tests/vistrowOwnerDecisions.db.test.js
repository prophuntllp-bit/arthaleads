// Owner decisions of 15 Oct 2026 for the Vistrow Voice hand-off, against a real
// in-memory MongoDB, the real routes and the real delivery service (store,
// routing, payload). Only Vistrow itself (fetch to api.vistrowvoice.com) and
// OpenAI (axios.post) are stubbed.
//
//  1. A WhatsApp lead is handed over once, after the chat's first AI read or
//     60 s (durable: a sweep sends it after a restart), with the read details,
//     the project its message names and the first message.
//  2. Vistrow queuing a call for a WhatsApp lead pauses that chat's bot; the
//     call result posts a team-only note and switches the bot back on only if
//     this pause is still in place; 15 minutes without a result resumes it.
//  3. Google leads can be called (switch + campaign/project rules).
//  4. A known number starting a new WhatsApp chat is a repeat enquiry: its own
//     event about the existing lead, still subject to the 24 h same-number rule.
//  5. A Facebook lead saved without a phone is handed over once it is recovered.
//  6. The first retry runs in-process at its due time, and the lease still
//     allows a single send; the worker is not tied to BACKGROUND_JOBS.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
delete process.env.VISTROW_OUTBOUND_DISABLED;
delete process.env.VISTROW_OUTBOUND_ALLOWED_HOSTS;

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AD = "120252242040050286";
const SECRET = "s3cr3t-token-value-0123456789";
const VISTROW_TOKEN = "tok-vistrow-owner-test";
const GOOGLE_KEY = "tok-google-owner-test";

// ── Vistrow and OpenAI stubs ────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const sent = [];
let vistrowReply = () => ({ status: 200, json: { ok: true, queued: true } });
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://api.vistrowvoice.com/")) {
    sent.push({ url: String(url), headers: opts.headers, body: JSON.parse(opts.body) });
    const r = vistrowReply();
    return { status: r.status, text: async () => JSON.stringify(r.json), headers: { get: () => null } };
  }
  return realFetch(url, opts);
};
const axios = require("axios");
require("../utils/ai/gateway").createChatCompletion = async (body) => (await axios.post("https://api.openai.com/v1/chat/completions", body)).data; // chat calls reach the axios fake
let aiReply = {};
axios.post = async () => ({ data: { choices: [{ message: { content: JSON.stringify(aiReply) } }], usage: {} } });

let ORG, PROJECT, org, base, server, mongod;
let Lead, WaConversation, WaMessage, OutboundDelivery, OutboundIntegration, wa, outbound;

const bodies = () => sent.map((s) => s.body);
const settle = async () => { await sleep(30); await outbound.service.drain(); };
let seq = 0;
const nextPhone = () => `9198123${String(40000 + ++seq).padStart(5, "0")}`;
const inbound = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: ".", msgId: `wamid.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
const convOf = (leadId) => WaConversation.findOne({ orgId: ORG, leadId }).lean();
const later = (ms) => new Date(Date.now() + ms);

async function post(p, body) {
  const r = await realFetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}

// ═══ 1. WhatsApp timing ════════════════════════════════════════════════════
test("1. new WhatsApp lead: nothing at the first message; sent once after the first chat read, with what was read", async () => {
  sent.length = 0;
  const phone = nextPhone();
  const opener = "Hi, I'd like details of the Shapoorji Pallonji Khopoli plots";
  await inbound(phone, opener);
  await settle();
  assert.equal(sent.length, 0, "not sent at the first message");
  const lead = await Lead.findOne({ orgId: ORG, phone }).lean();
  assert.ok(lead.vistrowEmit?.dueAt, "a pending hand-off is stored on the lead");
  assert.equal(await OutboundDelivery.countDocuments({ leadId: lead._id }), 0);

  await inbound(phone, "My name is Rahul Verma. Looking for a 2BHK flat in Wakad, budget 80 lakh");
  const conv = await convOf(lead._id);
  const recent = await WaMessage.find({ conversationId: conv._id }).sort({ timestamp: 1 }).lean();
  aiReply = { customer_name: "Rahul Verma", property_type: "Apartment", bhk: "2BHK", location: "Wakad", budget_min: 8000000, budget_max: 8000000 };
  await wa._leadCapture.enrichWhatsAppLead(conv, recent, { org });
  await settle();

  assert.equal(sent.length, 1, "sent once, right after the read");
  const b = sent[0].body;
  assert.equal(b.lead_id, String(lead._id));
  assert.equal(b.event_id, `evt_lc_${lead._id}`);
  assert.deepEqual([b.name, b.bhk, b.preferred_location, b.property_type, b.budget], ["Rahul Verma", "2BHK", "Wakad", "Apartment", "INR 80,00,000"]);
  assert.equal(b.project, "Shapoorji Pallonji Khopoli", "the project the message names (ad-less match) travels with it");
  assert.deepEqual([b.auto_call, b.agent_id], [true, "agent_proj"], "routed by that project");
  assert.equal(b.custom_fields.whatsapp_first_message, opener);

  // Another read, and the sweep after its time: still once.
  await wa._leadCapture.enrichWhatsAppLead(conv, recent, { org });
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(120e3) });
  await settle();
  assert.equal(sent.length, 1, "never twice");
  const after = await Lead.findById(lead._id).lean();
  assert.ok(!after.vistrowEmit.dueAt && after.vistrowEmit.emittedAt, "hand-off marked done");
});

test("1. no chat read: the 60 s rule is kept by the sweep (survives a restart), first message capped and cleaned", async () => {
  sent.length = 0;
  const phone = nextPhone();
  const bell = String.fromCharCode(7);
  await inbound(phone, `Hello${bell} there ${"x".repeat(800)}`);
  await settle();
  assert.equal(await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(30e3) }), 0, "not due at 30 s");
  await settle();
  assert.equal(sent.length, 0);
  assert.equal(await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) }), 1, "due at 60 s");
  await settle();
  assert.equal(sent.length, 1);
  const first = sent[0].body.custom_fields.whatsapp_first_message;
  assert.ok(first.startsWith("Hello there") && first.length <= 500 && !first.includes(bell), JSON.stringify(first.slice(0, 20)));
  assert.equal(await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(200e3) }), 0);
  await settle();
  assert.equal(sent.length, 1, "once");
});

test("1. click-to-WhatsApp ad lead: sent after its time with the ad, routed to the ad's agent", async () => {
  sent.length = 0;
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: false, reason: "test" } }); // no pause side effects here
  const phone = nextPhone();
  await inbound(phone, "Hi, tell me more", { referral: { source_id: AD, headline: "900+ Acre Launch", body: "Hi", ctwa_clid: "C1" } });
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) });
  await settle();
  const b = sent[0].body;
  assert.deepEqual([b.auto_call, b.agent_id, b.ad_id, b.lead_source], [true, "agent_ad", AD, "WhatsApp"], b.auto_call_reason);
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: true } });
});

// ═══ 4. Repeat enquiries ═══════════════════════════════════════════════════
test("4. a known number starting a new WhatsApp chat is a repeat enquiry: own event, existing lead id, 24 h rule kept", async () => {
  sent.length = 0;
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: false, reason: "test" } });
  const phone = nextPhone();
  const old = await Lead.create({ name: "Sita Rao", phone: phone.slice(2), source: "Facebook", status: "Contacted", orgId: ORG, createdAt: new Date(Date.now() - 3 * 86400e3) });
  await inbound(phone, "Hello again, is the Khopoli project still available?");
  assert.equal(await Lead.countDocuments({ orgId: ORG, phone: { $regex: `${phone.slice(2)}$` } }), 1, "no new lead");
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) });
  await settle();
  assert.equal(sent.length, 1, "the repeat enquiry is sent although the lead predates the switch-on");
  const b = sent[0].body;
  assert.equal(b.lead_id, String(old._id));
  assert.ok(b.event_id.startsWith(`evt_re_${old._id}_`), b.event_id);
  assert.equal(b.enquiry_id, b.event_id);
  assert.equal(b.custom_fields.repeat_enquiry, true);
  assert.equal(sent[0].headers["Idempotency-Key"], `${ORG}:${old._id}:${b.event_id}`);
  assert.deepEqual([b.auto_call, b.agent_id], [true, "agent_proj"]);

  // The same message re-delivered by WhatsApp changes nothing.
  const conv = await convOf(old._id);
  const lastIn = await WaMessage.findOne({ conversationId: conv._id }).lean();
  await wa._handleInbound(org, { phone, name: ".", msgId: lastIn.waMsgId, msgText: lastIn.body, msgType: "text" });
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(122e3) });
  await settle();
  assert.equal(sent.length, 1, "a literal re-delivery is not a new enquiry");

  // A third enquiry inside 24 h: sent, but as a Contact only.
  await WaConversation.deleteOne({ _id: conv._id });
  await sleep(5);
  await inbound(phone, "Hi, Khopoli plots please call me");
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) });
  await settle();
  assert.equal(sent.length, 2);
  const b2 = sent[1].body;
  assert.notEqual(b2.event_id, b.event_id, "distinct event per enquiry");
  assert.deepEqual([b2.auto_call, b2.auto_call_reason], [false, "recent_duplicate_phone"]);
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: true } });
});

// ═══ 2. Bot pause during the call ══════════════════════════════════════════
async function waLeadWithBot({ botEnabled = true, reason = "" } = {}) {
  const phone = nextPhone();
  const lead = await Lead.create({
    name: "Kiran Shah", phone, source: "WhatsApp", orgId: ORG, status: "New", propertyType: "N/A", purpose: "N/A", bhk: "N/A",
    campaignRef: { adId: AD, headline: "Launch" }, vistrowEmit: { dueAt: new Date(Date.now() - 1000), origin: "whatsapp-ctwa" },
  });
  const conv = await WaConversation.create({ orgId: ORG, leadId: lead._id, contactPhone: phone, botEnabled, status: botEnabled ? "bot" : "open", botPausedReason: reason, campaignRef: { adId: AD } });
  return { lead, conv, phone };
}
const callResult = (lead, phone, callId, crm_outcome) => post("/webhook/lead", {
  token: VISTROW_TOKEN, name: "Kiran Shah", phone: `+${phone}`, call_id: callId, arthaleads_lead_id: String(lead._id), direction: "outbound",
  duration_seconds: 120, transcript: [{ speaker: "Agent", text: "Namaste" }, { speaker: "Caller", text: "Haan" }], crm_outcome,
});

test("2. Vistrow queues the call -> the chat's bot pauses; the call result adds a team note and switches it back on", async () => {
  sent.length = 0;
  const { lead, conv, phone } = await waLeadWithBot();
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: new Date() });
  await settle();
  assert.equal(sent.length, 1);
  let c = await WaConversation.findById(conv._id).lean();
  assert.deepEqual([c.botEnabled, c.status, c.botPausedReason], [false, "open", "vistrow_call"], "paused for the call");
  const mins = (new Date(c.botResumeAt) - new Date(c.botPausedAt)) / 60000;
  assert.equal(mins, 15, "safety resume in 15 minutes");
  assert.equal(c.internalNotes.length, 1);
  assert.equal(await WaMessage.countDocuments({ conversationId: conv._id }), 0, "nothing is sent to the customer");

  const visitAt = new Date(Date.now() + 2 * 86400e3).toISOString();
  const r = await callResult(lead, phone, 9101, { booking: "Site Visit Booked", status: "Site Visit", site_visit_at: visitAt });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  c = await WaConversation.findById(conv._id).lean();
  assert.deepEqual([c.botEnabled, c.status, c.botPausedReason || ""], [true, "bot", ""], "bot back on");
  const note = c.internalNotes[c.internalNotes.length - 1].text;
  assert.ok(/Site Visit Booked/.test(note) && /Status: Site Visit/.test(note) && /Site visit:/.test(note) && /back on/.test(note), note);
  assert.equal(await WaMessage.countDocuments({ conversationId: conv._id }), 0, "the note is not a WhatsApp message");
});

test("2. a bot a person switched off stays off after the call result (note still added)", async () => {
  const { lead, conv, phone } = await waLeadWithBot({ botEnabled: false });
  await Lead.updateOne({ _id: lead._id }, { $unset: { vistrowEmit: 1 } });
  await callResult(lead, phone, 9102, { booking: "Call Back", follow_up_at: new Date(Date.now() + 86400e3).toISOString() });
  const c = await WaConversation.findById(conv._id).lean();
  assert.equal(c.botEnabled, false);
  assert.equal(c.internalNotes.length, 1);
  assert.ok(/Call Back/.test(c.internalNotes[0].text) && /Follow-up:/.test(c.internalNotes[0].text) && !/back on/.test(c.internalNotes[0].text));
});

test("2. no pause when Vistrow did not queue the call, or for a lead that is not from WhatsApp", async () => {
  sent.length = 0;
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: false, reason: "no_caller_number" } });
  const a = await waLeadWithBot();
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: new Date() });
  await settle();
  assert.equal((await WaConversation.findById(a.conv._id).lean()).botEnabled, true, "queued:false");
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: true } });

  const phone = nextPhone();
  const web = await Lead.create({ name: "Web Lead", phone, source: "Website", orgId: ORG, sourcePage: "https://x.com/khopoli-page/" });
  const conv = await WaConversation.create({ orgId: ORG, leadId: web._id, contactPhone: phone, botEnabled: true, status: "bot" });
  const { emitLeadCreated } = require("../utils/emitLeadCreated");
  await emitLeadCreated(web.toObject(), { origin: "webhook-website", routeSource: "website" });
  await settle();
  assert.equal(sent[sent.length - 1].body.auto_call, true);
  assert.equal((await WaConversation.findById(conv._id).lean()).botEnabled, true, "website lead");
});

test("2. no call result within 15 minutes: the bot comes back on by itself", async () => {
  const { pauseBotForCall, resumeOverduePauses } = require("../utils/vistrowBotPause");
  const { lead, conv } = await waLeadWithBot();
  const t0 = new Date();
  assert.equal(await pauseBotForCall({ orgId: ORG, leadId: lead._id, now: t0 }), 1);
  assert.equal(await resumeOverduePauses({ now: new Date(t0.getTime() + 10 * 60000) }), 0, "not yet at 10 minutes");
  assert.equal((await WaConversation.findById(conv._id).lean()).botEnabled, false);
  assert.ok(await resumeOverduePauses({ now: new Date(t0.getTime() + 16 * 60000) }) >= 1);
  const c = await WaConversation.findById(conv._id).lean();
  assert.deepEqual([c.botEnabled, c.status, c.botPausedReason || ""], [true, "bot", ""]);
  assert.ok(/No call result/.test(c.internalNotes[c.internalNotes.length - 1].text));
});

// ═══ 3. Google ═════════════════════════════════════════════════════════════
const googleBody = (phone, campaignId) => ({
  google_key: GOOGLE_KEY, is_test: false, lead_id: `L${phone}`, campaign_id: campaignId, campaign_name: "Khopoli Search",
  user_column_data: [{ column_id: "FULL_NAME", string_value: "Asha Menon" }, { column_id: "PHONE_NUMBER", string_value: `+${phone}` }],
});
test("3. Google lead-form leads: a routed campaign is called by its agent; other campaigns are Contacts only", async () => {
  sent.length = 0;
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: true } });
  const r = await post("/webhook/google", googleBody(nextPhone(), "21987654321"));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  await post("/webhook/google", googleBody(nextPhone(), "11111111"));
  await settle();
  assert.equal(sent.length, 2);
  assert.deepEqual([sent[0].body.auto_call, sent[0].body.agent_id, sent[0].body.route_label], [true, "agent_google", "Campaign 21987654321"]);
  assert.deepEqual([sent[1].body.auto_call, sent[1].body.auto_call_reason], [false, "no_route"]);
  const row = await OutboundDelivery.findOne({ eventId: sent[0].body.event_id }).lean();
  assert.deepEqual([row.routeSource, row.origin], ["google", "webhook-google"]);
});
test("3. Google is off by default for a new integration", async () => {
  const fresh = new OutboundIntegration({ orgId: oid() });
  assert.equal(fresh.routing.google.enabled, false);
});

// ═══ 5. Recovered Facebook phone ═══════════════════════════════════════════
test("5. a Facebook lead saved without a phone is handed over once its phone is recovered", async () => {
  sent.length = 0;
  const { emitLeadCreated } = require("../utils/emitLeadCreated");
  const ctx = { origin: "webhook-facebook", routeSource: "facebook", attribution: { campaign_id: "c1" } };
  const fb = await Lead.create({ name: "Facebook Lead", phone: "N/A", source: "Facebook", orgId: ORG });
  const first = await emitLeadCreated(fb.toObject(), ctx);
  assert.equal(first.reason, "invalid_phone");
  await Lead.updateOne({ _id: fb._id }, { $set: { phone: nextPhone().slice(2), name: "Meera Iyer" } });
  const recovered = await Lead.findById(fb._id).lean();
  const plain = await emitLeadCreated(recovered, ctx);
  assert.equal(plain.queued, false, "without the recovered flag the old row still blocks it");
  const r = await emitLeadCreated(recovered, { ...ctx, recovered: true });
  await settle();
  assert.equal(r.queued, true);
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].body.name, sent[0].body.event_id], ["Meera Iyer", `evt_lc_${fb._id}`]);
  const again = await emitLeadCreated(recovered, { ...ctx, recovered: true });
  await settle();
  assert.equal(again.queued, false);
  assert.equal(sent.length, 1, "never twice");
  assert.equal(await OutboundDelivery.countDocuments({ leadId: fb._id }), 1);
});
test("5. the Facebook self-heal path hands the recovered lead over", () => {
  const src = fs.readFileSync(path.join(__dirname, "../routes/webhookRoutes.js"), "utf8");
  const heal = src.slice(src.indexOf("auto-retry recovered field data"), src.indexOf("Send push notification", src.indexOf("auto-retry recovered field data")));
  assert.ok(/emitLeadCreated\(recoveredLead, \{ \.\.\.fbEmitCtx, recovered: true \}\)/.test(heal));
});

// ═══ Found on the way: the Mongo claim dropped the routing ═════════════════
test("a job claimed from MongoDB keeps its routing inputs, so a routed call is not withdrawn at send time", async () => {
  const { mongoStore } = require("../services/vistrowOutbound/store.mongo");
  const r = await mongoStore.insertDelivery({
    orgId: ORG, eventId: `evt_claim_${oid()}`, eventType: "lead.created", leadId: oid(), leadCreatedAt: new Date(), origin: "webhook-website",
    status: "pending", nextAttemptAt: new Date(Date.now() - 1000), payload: { x: 1 }, autoCall: true, agentId: "agent_web",
    routingInputs: { routeSource: "website", sourcePage: "https://x.com/khopoli-page/", projectId: "", adId: "", campaignId: "" },
  });
  const job = await mongoStore.claimById(r.delivery._id, { now: new Date(), leaseMs: 45000 });
  assert.equal(job.routingInputs?.routeSource, "website");
  assert.deepEqual(job.payload, { x: 1 });
});

// ═══ 6. Faster retries ═════════════════════════════════════════════════════
test("6. the first retry runs in-process at its due time, and the worker racing it still sends once", async () => {
  const { createService } = require("../services/vistrowOutbound/service");
  const { mongoStore } = require("../services/vistrowOutbound/store.mongo");
  let clock = new Date();
  const scheduled = [];
  let calls = 0;
  const svc = createService({
    store: mongoStore, now: () => clock, rand: () => 0.5, logger: { info() {}, warn() {}, error() {} },
    schedule: (fn, ms) => scheduled.push({ fn, ms }),
    send: async () => (++calls === 1 ? { httpStatus: 503, json: null, latencyMs: 3 } : { httpStatus: 200, json: { ok: true }, latencyMs: 3 }),
  });
  const phone = nextPhone().slice(2);
  const lead = await Lead.create({ name: "Retry Lead", phone, source: "Website", orgId: ORG });
  await svc.enqueueLeadCreated(lead.toObject(), { origin: "webhook-website", routeSource: "website" });
  await svc.drain();
  assert.equal(calls, 1);
  assert.equal(scheduled.length, 1, "first retry scheduled in-process");
  assert.equal(scheduled[0].ms, 3000);
  clock = new Date(clock.getTime() + 3100);
  scheduled[0].fn();
  await Promise.all([svc.processDue({ limit: 10 }), svc.drain()]);
  await svc.drain();
  assert.equal(calls, 2, "one retry send, not two");
  const row = await OutboundDelivery.findOne({ leadId: lead._id }).lean();
  assert.deepEqual([row.status, row.attempts], ["delivered", 2]);
  assert.equal(scheduled.length, 1, "only the first retry is scheduled in-process");
});
test("6. the outbound worker and the WhatsApp sweep start whatever BACKGROUND_JOBS says", () => {
  const src = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.ok(!/if \(BACKGROUND_JOBS\)[^\n]*startWorker/.test(src), "worker no longer gated by BACKGROUND_JOBS");
  const gate = src.slice(src.indexOf("if (VISTROW_WORKER) {"), src.indexOf("}", src.indexOf("if (VISTROW_WORKER) {")));
  assert.ok(/startWorker\(\)/.test(gate) && /startVistrowWhatsAppSweep\(\)/.test(gate));
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  WaMessage = require("../models/WaMessage");
  OutboundDelivery = require("../models/OutboundDelivery");
  OutboundIntegration = require("../models/OutboundIntegration");
  for (const M of [Lead, WaConversation, WaMessage, OutboundDelivery, OutboundIntegration]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});

  ORG = oid();
  PROJECT = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false, whatsapp: { botEnabled: false } });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  await mongoose.connection.collection("projects").insertOne({ _id: PROJECT, orgId: ORG, name: "Shapoorji Pallonji Khopoli", location: "Near Khopoli", propertyType: "Plot" });
  await mongoose.connection.collection("waagents").insertOne({ _id: oid(), orgId: ORG, name: "Artha", status: "active", projectIds: [PROJECT] });
  await mongoose.connection.collection("automations").insertMany([
    { _id: oid(), name: "Vistrow Voice", platform: "Vistrow Voice", verifyToken: VISTROW_TOKEN, isActive: true, orgId: ORG, createdBy: oid(), updatedBy: oid() },
    { _id: oid(), name: "Google Ads", platform: "Google", verifyToken: GOOGLE_KEY, isActive: true, orgId: ORG, createdBy: oid(), updatedBy: oid() },
  ]);
  const integ = new OutboundIntegration({
    orgId: ORG, enabled: true, enabledAt: new Date(Date.now() - 3600e3), baseUrl: "https://api.vistrowvoice.com", accountId: "acct_1",
    routing: {
      website: { enabled: true, routes: [{ matchKind: "url_contains", matchValue: "/khopoli-page/", agentId: "agent_web" }] },
      whatsapp: { enabled: true, routes: [
        { matchKind: "ad_id", matchValue: AD, agentId: "agent_ad" },
        { matchKind: "project", matchValue: String(PROJECT), projectId: PROJECT, projectName: "Shapoorji Pallonji Khopoli", agentId: "agent_proj" },
      ] },
      facebook: { enabled: true, routes: [] },
      google: { enabled: true, routes: [{ matchKind: "campaign_id", matchValue: "21987654321", agentId: "agent_google" }] },
    },
  });
  integ.setSecret(SECRET);
  await integ.save();

  wa = require("../routes/whatsappRoutes");
  outbound = require("../services/vistrowOutbound");
  const app = express();
  app.use("/webhook", require("../routes/webhookRoutes"));
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow Voice owner decisions (15 Oct 2026)");
})();
