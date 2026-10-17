// Vistrow Voice retries, scheduled follow-up calls and "call now" (15 Oct 2026),
// against a real in-memory MongoDB, the real routes and the real delivery
// service (Vistrow itself is a fake fetch).
//  * receiver: a final "Not Reachable" report with crm_outcome.attempts and no
//    transcript / recording / duration still goes through the call_id branch,
//    records "could not reach this lead after N tries", applies the booking
//    forward-only, and a re-send never appends a second call;
//  * receiver: follow_up_kind (top level or custom_fields) labels the call and
//    a visit_reminder result applies Site Visit Done / Not Interested;
//  * sender: queued_until is stored on the delivery and shown on the lead;
//    queued:false reasons become readable text on the delivery and the lead;
//  * POST /vistrow-outbound/leads/:id/call re-emits with auto_call:true for
//    the routed agent, admin/manager + Enterprise only, once per minute.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CRYPTO_KEY = process.env.CRYPTO_KEY || "a".repeat(64);
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const { followUpKindOf, attemptsOf, callDescription } = require("../utils/vistrowCallResult");
const { callResultActivity } = require("../utils/vistrowCallActivity");
const T = require("../services/vistrowOutbound/transport");

const oid = () => new mongoose.Types.ObjectId();
const future = (h) => new Date(Date.now() + h * 3600e3).toISOString();

// ---------------------------------------------------------------- pure rules
test("follow_up_kind is read from the top level or custom_fields, unknown values ignored", () => {
  assert.equal(followUpKindOf({ follow_up_kind: "callback" }), "callback");
  assert.equal(followUpKindOf({ custom_fields: { follow_up_kind: "Visit_Reminder" } }), "visit_reminder");
  assert.equal(followUpKindOf({ follow_up_kind: "nurture", custom_fields: { follow_up_kind: "callback" } }), "nurture");
  assert.equal(followUpKindOf({ follow_up_kind: "spam" }), "");
  assert.equal(followUpKindOf({}), "");
});

test("attempts: positive integers only", () => {
  assert.equal(attemptsOf({ attempts: 3 }), 3);
  assert.equal(attemptsOf({ attempts: "2" }), 2);
  for (const bad of [{ attempts: 0 }, { attempts: -1 }, { attempts: 1.5 }, { attempts: "x" }, {}, null]) assert.equal(attemptsOf(bad), null);
});

test("call descriptions", () => {
  assert.equal(callDescription({ booking: "Not Reachable", attempts: 3 }), "Vistrow Voice could not reach this lead after 3 tries");
  assert.equal(callDescription({ booking: "Not Reachable", attempts: 1 }), "Vistrow Voice could not reach this lead after 1 try");
  assert.equal(callDescription({ followUpKind: "callback", durationSeconds: 40 }), "Scheduled call-back by Vistrow Voice (40s)");
  assert.equal(callDescription({ followUpKind: "visit_reminder" }), "Site-visit reminder call");
  assert.equal(callDescription({ followUpKind: "nurture" }), "Follow-up call");
  assert.equal(callDescription({ direction: "outbound", durationSeconds: 12 }), "Outbound Vistrow Voice call (12s)");
});

test("queued_until is parsed from Vistrow's reply, garbage ignored", () => {
  const ok = T.classifyResult({ httpStatus: 200, json: { ok: true, queued: true, queued_until: "2026-10-16T03:30:00Z" } }, []);
  assert.equal(ok.queued, true);
  assert.equal(ok.queuedUntil.toISOString(), "2026-10-16T03:30:00.000Z");
  assert.equal(T.classifyResult({ httpStatus: 200, json: { ok: true, queued: true, queued_until: "soon" } }, []).queuedUntil, null);
  assert.equal(T.classifyResult({ httpStatus: 200, json: { ok: true, queued: false, reason: "agent_not_live" } }, []).queuedUntil, null);
});

test("lead activity text for Vistrow's answer", () => {
  assert.match(callResultActivity({ queued: true, queuedUntil: "2026-10-16T03:30:00Z" }).description, /^Vistrow Voice call scheduled for 16 Oct, 9:00 am$/);
  assert.equal(callResultActivity({ queued: true }).description, "Vistrow Voice is calling this lead now");
  assert.equal(callResultActivity({ queued: false, reasonText: "The Vistrow agent is not live" }).description, "Vistrow Voice did not call: The Vistrow agent is not live");
});

// ---------------------------------------------------------------- the routes
let base, mongod, server, Lead, OutboundDelivery, ORG, admin, agentUser, service;
const TOKEN = "tok-vistrow-followup";
const vistrow = { replies: [], calls: [] };

async function post(body) {
  const res = await fetch(`${base}/webhook/lead`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: TOKEN, ...body }),
  });
  return { status: res.status, body: await res.json() };
}
const auth = (u) => ({ Authorization: `Bearer ${jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "1h" })}` });
async function api(method, path, user, body) {
  const res = await fetch(`${base}/api/integrations/vistrow-outbound${path}`, {
    method, headers: { "Content-Type": "application/json", ...auth(user) }, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

// The undelivered-dial shape: no transcript, no recording, duration 0.
const undelivered = (id, extra = {}) => ({
  name: "Meera Iyer", phone: "+919811122233", call_id: id, direction: "outbound", duration_seconds: 0,
  crm_outcome: { booking: "Not Reachable", attempts: 3 }, ...extra,
});

test("final Not Reachable after 3 tries: existing lead gets the activity and booking, re-send dedupes", async () => {
  const lead = await Lead.create({ name: "Meera", phone: "9811122233", source: "Website", orgId: ORG, status: "Contacted" });
  const r = await post(undelivered(7001, { arthaleads_lead_id: String(lead._id) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(String(r.body.leadId), String(lead._id));
  let l = await Lead.findById(lead._id).lean();
  assert.equal(l.booking, "Not Reachable");
  assert.equal(l.status, "Contacted", "status untouched");
  assert.equal(l.voiceCalls.length, 1);
  assert.equal(l.voiceCalls[0].externalCallId, 7001);
  assert.equal(l.voiceCalls[0].attempts, 3);
  assert.equal(l.voiceCalls[0].result, "Not Reachable");
  assert.equal(l.voiceCalls[0].durationSeconds, undefined);
  const act = l.activities.find((a) => a.type === "called");
  assert.equal(act.description, "Vistrow Voice could not reach this lead after 3 tries");
  assert.equal(act.meta.attempts, 3);
  assert.ok(l.notes[0].text.startsWith("📞 Vistrow Voice could not reach this lead after 3 tries"), l.notes[0].text);

  const again = await post(undelivered(7001, { arthaleads_lead_id: String(lead._id), crm_outcome: { booking: "Not Reachable", attempts: 4 } }));
  assert.equal(again.status, 200);
  l = await Lead.findById(lead._id).lean();
  assert.equal(l.voiceCalls.length, 1, "no second call entry");
  assert.equal(l.voiceCalls[0].attempts, 4, "re-send updates the count");
  assert.equal(l.activities.filter((a) => a.type === "called").length, 1, "no second activity");
});

test("Not Reachable never erases a result a person recorded", async () => {
  const lead = await Lead.create({ name: "Kept", phone: "9822233344", source: "Facebook", orgId: ORG, status: "Contacted", booking: "Interested" });
  await post(undelivered(7002, { name: "Kept", phone: "+919822233344" }));
  const l = await Lead.findById(lead._id).lean();
  assert.equal(l.booking, "Interested");
  assert.equal(l.voiceCalls.length, 1);
  assert.equal(l.activities.find((a) => a.type === "called").description, "Vistrow Voice could not reach this lead after 3 tries");
});

test("an unknown number's final report still creates the lead with the dials on record", async () => {
  const r = await post(undelivered(7003, { name: "Nobody", phone: "+919833344455" }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const l = await Lead.findById(r.body.leadId).lean();
  assert.equal(l.booking, "Not Reachable");
  assert.equal(l.voiceCalls[0].externalCallId, 7003);
  assert.equal(l.activities.some((a) => a.type === "called" && /after 3 tries/.test(a.description)), true);
  assert.equal((await post(undelivered(7003, { name: "Nobody", phone: "+919833344455" }))).status, 200);
  assert.equal(await Lead.countDocuments({ orgId: ORG, "voiceCalls.externalCallId": 7003 }), 1);
});

test("scheduled call-back result is labelled and sets the follow-up", async () => {
  const lead = await Lead.create({ name: "Cb", phone: "9844455566", source: "Website", orgId: ORG, status: "Contacted" });
  const at = future(26);
  const r = await post({
    name: "Cb", phone: "+919844455566", call_id: 7004, direction: "outbound", duration_seconds: 70, follow_up_kind: "callback",
    arthaleads_lead_id: String(lead._id), transcript: [{ speaker: "Agent", text: "Calling back as promised" }],
    crm_outcome: { booking: "Interested", follow_up_at: at },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const l = await Lead.findById(lead._id).lean();
  assert.equal(l.voiceCalls[0].followUpKind, "callback");
  assert.equal(l.activities.find((a) => a.type === "called").description, "Scheduled call-back by Vistrow Voice (70s)");
  assert.ok(l.notes[0].text.startsWith("📞 Scheduled call-back by Vistrow Voice"), l.notes[0].text);
  assert.equal(l.booking, "Interested");
  assert.equal(new Date(l.followUpDate).toISOString(), new Date(at).toISOString());
});

test("site-visit reminder (custom_fields) applies Site Visit Done, and nothing weaker afterwards", async () => {
  const lead = await Lead.create({ name: "Visit", phone: "9855566677", source: "Facebook", orgId: ORG, status: "Site Visit", booking: "Site Visit Booked" });
  const r = await post({
    name: "Visit", phone: "+919855566677", call_id: 7005, direction: "outbound", duration_seconds: 30,
    custom_fields: { follow_up_kind: "visit_reminder" }, arthaleads_lead_id: String(lead._id),
    crm_outcome: { booking: "Site Visit Done" },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let l = await Lead.findById(lead._id).lean();
  assert.equal(l.booking, "Site Visit Done");
  assert.equal(l.activities.find((a) => a.type === "called").description, "Site-visit reminder call (30s)");
  assert.equal(l.voiceCalls[0].followUpKind, "visit_reminder");

  // A later reminder saying "Not Interested" must not undo a done visit.
  await post({ name: "Visit", phone: "+919855566677", call_id: 7006, direction: "outbound", duration_seconds: 20,
    custom_fields: { follow_up_kind: "visit_reminder" }, arthaleads_lead_id: String(lead._id), crm_outcome: { booking: "Not Interested" } });
  l = await Lead.findById(lead._id).lean();
  assert.equal(l.booking, "Site Visit Done");
  assert.equal(l.voiceCalls.length, 2);
});

test("site-visit reminder: Not Interested is applied when nothing stronger is recorded; nurture call labelled", async () => {
  const lead = await Lead.create({ name: "Cold", phone: "9866677788", source: "WhatsApp", orgId: ORG, status: "Site Visit", booking: "Site Visit Booked" });
  await post({ name: "Cold", phone: "+919866677788", call_id: 7007, direction: "outbound", duration_seconds: 25,
    follow_up_kind: "visit_reminder", arthaleads_lead_id: String(lead._id), crm_outcome: { booking: "Not Interested" } });
  let l = await Lead.findById(lead._id).lean();
  assert.equal(l.booking, "Not Interested");
  await post({ name: "Cold", phone: "+919866677788", call_id: 7008, direction: "outbound", duration_seconds: 15,
    follow_up_kind: "nurture", arthaleads_lead_id: String(lead._id), crm_outcome: {} });
  l = await Lead.findById(lead._id).lean();
  assert.equal(l.activities.filter((a) => a.type === "called").pop().description, "Follow-up call (15s)");
  assert.equal(l.voiceCalls.length, 2);
});

// ---- sender: what Vistrow answers, shown on the delivery and the lead ----
test("status endpoint: integration off -> cannot call, no delivery", async () => {
  const lead = await Lead.create({ name: "Web", phone: "9877788899", source: "Website", sourcePage: "https://shaporjipallonji.com/shapoorji-pallonji-khopoli/", orgId: ORG, status: "New" });
  const r = await api("GET", `/leads/${lead._id}/status`, admin);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.enabled, r.body.canCall, r.body.lastDelivery], [false, false, null]);
  const c = await api("POST", `/leads/${lead._id}/call`, admin);
  assert.equal(c.status, 400);
  assert.equal(c.body.reason, "disabled");
  assert.equal(await OutboundDelivery.countDocuments({ leadId: lead._id }), 0);
});

async function enableIntegration() {
  const OutboundIntegration = require("../models/OutboundIntegration");
  const doc = new OutboundIntegration({
    orgId: ORG, provider: "vistrow", baseUrl: "https://api.vistrowvoice.com", accountId: "acct_1", authMode: "header",
    enabled: true, enabledAt: new Date(Date.now() - 3600e3), defaultCountryCode: "91", dedupeWindowHours: 24, maxLeadAgeMinutes: 15,
    routing: { website: { enabled: true, routes: [{ label: "", matchKind: "url_contains", matchValue: "/shapoorji-pallonji-khopoli/", agentId: "agent_khopoli", agentLabel: "Siya KHOPOLI" }] } },
  });
  doc.setSecret("s3cr3t-token-value-0123456789");
  await doc.save();
}

test("call now: admin request re-emits with auto_call:true for the routed agent; queued_until lands on the delivery and the lead", async () => {
  await enableIntegration();
  const lead = await Lead.create({ name: "Web", phone: "9888899900", source: "Website", sourcePage: "https://shaporjipallonji.com/shapoorji-pallonji-khopoli/", orgId: ORG, status: "New",
    voiceCalls: [{ externalCallId: 7100, attempts: 2, result: "Not Reachable" }] });
  const st = await api("GET", `/leads/${lead._id}/status`, agentUser);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.deepEqual([st.body.enabled, st.body.canCall], [true, true]);
  // The button names the agent the NEXT call comes from (current routing).
  assert.equal(st.body.nextAgentLabel, "Siya KHOPOLI");

  vistrow.replies.push({ ok: true, queued: true, queued_until: "2026-10-16T03:30:00Z" });
  const r = await api("POST", `/leads/${lead._id}/call`, admin);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.queued, true);
  await service.drain();

  assert.equal(vistrow.calls.length, 1, "one request reached Vistrow");
  const sent = vistrow.calls[0];
  assert.equal(sent.body.auto_call, true);
  assert.equal(sent.body.agent_id, "agent_khopoli");
  assert.equal(sent.body.lead_id, String(lead._id));
  assert.match(sent.body.enquiry_id, /^evt_call_/);
  assert.equal(sent.body.custom_fields.call_request, true);
  assert.equal(sent.body.custom_fields.requested_by, "Admin A");
  assert.equal(sent.headers["idempotency-key"], `${ORG}:${lead._id}:${sent.body.enquiry_id}`);

  const d = await OutboundDelivery.findOne({ leadId: lead._id }).lean();
  assert.equal(d.origin, "manual-call");
  assert.equal(d.status, "delivered");
  assert.equal(d.callQueued, true);
  assert.equal(d.callQueuedUntil.toISOString(), "2026-10-16T03:30:00.000Z");

  const l = await Lead.findById(lead._id).lean();
  const acts = l.activities.filter((a) => a.type === "vistrow_voice").map((a) => a.description);
  assert.deepEqual(acts, ["Admin A asked Vistrow Voice to call this lead now", "Vistrow Voice call scheduled for 16 Oct, 9:00 am"]);

  const st2 = await api("GET", `/leads/${lead._id}/status`, agentUser);
  assert.equal(st2.body.lastDelivery.callQueuedUntil, "2026-10-16T03:30:00.000Z");
  assert.equal(st2.body.lastDelivery.callReasonText, "");

  // Idempotent per minute: a second press is a no-op.
  const again = await api("POST", `/leads/${lead._id}/call`, admin);
  assert.equal(again.status, 200);
  assert.equal(again.body.reason, "recent_request");
  assert.equal(await OutboundDelivery.countDocuments({ leadId: lead._id }), 1);
  assert.equal(vistrow.calls.length, 1);
});

test("call now: Vistrow declines with a reason -> readable text on the delivery log and the lead", async () => {
  const lead = await Lead.create({ name: "Declined", phone: "9899900011", source: "Website", sourcePage: "https://shaporjipallonji.com/shapoorji-pallonji-khopoli/", orgId: ORG, status: "New" });
  vistrow.replies.push({ ok: true, queued: false, reason: "agent_has_no_caller_number" });
  const r = await api("POST", `/leads/${lead._id}/call`, admin);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await service.drain();
  const d = await OutboundDelivery.findOne({ leadId: lead._id }).lean();
  assert.deepEqual([d.status, d.callQueued, d.callReason, d.callQueuedUntil], ["delivered", false, "agent_has_no_caller_number", null]);
  const l = await Lead.findById(lead._id).lean();
  assert.equal(l.activities.filter((a) => a.type === "vistrow_voice").pop().description, "Vistrow Voice did not call: The Vistrow agent has no caller number");
  const log = await api("GET", `/deliveries?limit=5`, admin);
  const row = log.body.deliveries.find((x) => String(x.leadId) === String(lead._id));
  assert.equal(row.callReasonText, "The Vistrow agent has no caller number");
  const st = await api("GET", `/leads/${lead._id}/status`, admin);
  assert.equal(st.body.lastDelivery.callReasonText, "The Vistrow agent has no caller number");
});

test("call now: refused when no agent routes, for agents, and below Enterprise", async () => {
  const other = await Lead.create({ name: "Other page", phone: "9800011122", source: "Website", sourcePage: "https://shaporjipallonji.com/other/", orgId: ORG, status: "New" });
  const st = await api("GET", `/leads/${other._id}/status`, admin);
  assert.deepEqual([st.body.canCall, st.body.whyNot], [false, "No calling rule matches this lead"]);
  const r = await api("POST", `/leads/${other._id}/call`, admin);
  assert.equal(r.status, 400);
  assert.equal(r.body.reason, "no_route");
  assert.equal(await OutboundDelivery.countDocuments({ leadId: other._id }), 0);
  assert.equal((await Lead.findById(other._id).lean()).activities.filter((a) => a.type === "vistrow_voice").length, 0, "nothing audited when nothing was sent");

  const manual = await Lead.create({ name: "Typed", phone: "9800011133", source: "Manual", orgId: ORG, status: "New" });
  assert.equal((await api("POST", `/leads/${manual._id}/call`, admin)).body.reason, "not_auto_source");

  const web = await Lead.create({ name: "Web", phone: "9800011144", source: "Website", sourcePage: "https://shaporjipallonji.com/shapoorji-pallonji-khopoli/", orgId: ORG, status: "New" });
  assert.equal((await api("POST", `/leads/${web._id}/call`, agentUser)).status, 403, "agents cannot request calls");
  await mongoose.connection.collection("organizations").updateOne({ _id: ORG }, { $set: { plan: "growth" } });
  require("../middlewares/auth").invalidateOrgCache(ORG);
  const below = await api("POST", `/leads/${web._id}/call`, admin);
  assert.equal(below.status, 403, JSON.stringify(below.body));
  await mongoose.connection.collection("organizations").updateOne({ _id: ORG }, { $set: { plan: "enterprise" } });
  assert.equal(vistrow.calls.length, 2, "nothing more reached Vistrow");
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  OutboundDelivery = require("../models/OutboundDelivery");
  await Lead.init();
  await OutboundDelivery.init();
  const User = require("../models/User");
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false, isActive: true, approvalStatus: "approved" });
  admin = { _id: oid(), orgId: ORG, role: "admin", name: "Admin A", email: "admin@example.com", isActive: true };
  agentUser = { _id: oid(), orgId: ORG, role: "agent", name: "Agent B", email: "agent@example.com", isActive: true };
  await User.collection.insertMany([admin, agentUser]);
  await mongoose.connection.collection("automations").insertOne({
    _id: oid(), name: "Vistrow Voice", platform: "Vistrow Voice", verifyToken: TOKEN, isActive: true, orgId: ORG, createdBy: oid(), updatedBy: oid(),
  });

  // Vistrow itself: whatever the test queued as the next reply.
  globalThis.fetch = (() => {
    const real = globalThis.fetch;
    return async (url, init) => {
      if (!String(url).startsWith("https://api.vistrowvoice.com/")) return real(url, init);
      const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      vistrow.calls.push({ url: String(url), headers, body: JSON.parse(init.body) });
      const json = vistrow.replies.shift() || { ok: true };
      return { status: 200, text: async () => JSON.stringify(json), headers: { get: () => null } };
    };
  })();
  service = require("../services/vistrowOutbound").service;

  const app = express();
  app.use(express.json());
  app.use("/webhook", require("../routes/webhookRoutes"));
  app.use("/api/integrations/vistrow-outbound/leads", require("../routes/vistrowLeadRoutes"));
  app.use("/api/integrations/vistrow-outbound", require("../routes/vistrowOutboundRoutes"));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message })); // eslint-disable-line no-unused-vars
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow Voice retries, follow-up calls and call now");
})();
