// POST /webhook/lead hardening (31 Oct 2026), against a real in-memory MongoDB
// and the real route.
//  * Calls 1702/1703 (outbound auto-calls, name "not provided", arthaleads_lead_id)
//    answered 500: the unique (orgId, source, voiceCalls.externalCallId) index
//    keyed every call stored without an id as null, so once one lead of a
//    source held an id-less and an id'd call, adding a call to a second such
//    lead failed with E11000 on every try. The index is now non-unique and the
//    old one is dropped on boot (Lead.dropLegacyCallIdIndex).
//  * A placeholder name ("not provided", "unknown", "n/a", the phone) becomes
//    the phone on a new lead and never replaces a real name.
//  * No input shape gives a 500; a bad request gets a 4xx with a message.
//  * A side effect failing (push, connection status) never fails the request.
//  * conversation_type voice / text, given or read from the channel.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const { isPlaceholderName, looksLikeRealName, looksLikeCallerName } = require("../utils/personName");
const { conversationTypeOf, cleanExtractedData } = require("../utils/vistrowCallResult");

const oid = () => new mongoose.Types.ObjectId();
let base, mongod, server, Lead, ORG;
const TOKEN = "tok-vistrow-hardening";
// The route allows 60 deliveries per token per 15 minutes: spread this
// suite's few hundred requests over several connections of the same org.
const POOL = Array.from({ length: 12 }, (_, i) => `${TOKEN}-${i}`);
let sent = 0;
// The route takes sendPushToUser/sendPushToAll at load time: route them
// through pushImpl so a test can make them fail.
const pushImpl = { user: async () => {}, all: async () => {} };
const LEGACY = "orgId_1_source_1_voiceCalls.externalCallId_1";

async function post(body, raw) {
  const res = await fetch(`${base}/webhook/lead`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: raw !== undefined ? raw : JSON.stringify({ token: POOL[Math.floor(sent++ / 50) % POOL.length], ...body }),
  });
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, body: json };
}

// The payload Vistrow's agent/tools.py _integration_body builds for ArthaLeads.
const vistrowCall = (extra = {}) => ({
  name: "not provided", phone: "+919800000431", email: "",
  message: "Agent: Namaste\nCaller: Plot chahiye",
  transcript: [{ speaker: "Agent", text: "Namaste, Treetopia se Siya" }, { speaker: "Caller", text: "Plot chahiye, 2000 sq ft" }],
  sentiment: "positive", duration_seconds: 84, channel: "Phone", language: "hi-IN",
  agent_name: "Siya – Treetopia", agent_id: "12", page_path: "",
  recording_url: "https://api.vistrowvoice.com/public/calls/1702/recording?t=x", recording_mime_type: "audio/wav",
  extracted_data: { property_type: "Plot", configuration: "around 2000 sq ft", purpose: "Invest", budget_text: "around 1 crore", budget_min: 10000000, budget_max: 10000000, timeline: "3 months" },
  direction: "outbound", crm_outcome: { status: "Contacted", booking: "Interested" },
  summary: "Wants a 2000 sq ft plot to invest, about 1 crore, in 3 months.", key_points: ["Plot", "1 crore"],
  ...extra,
});

const lead = (fields) => Lead.collection.insertOne({
  status: "New", orgId: ORG, isDeleted: false, isArchived: false, createdAt: new Date(), updatedAt: new Date(),
  notes: [], activities: [], ...fields,
}).then((r) => r.insertedId);

// ---------------------------------------------------------------- pure rules
test("placeholder names are recognised, real names are not", () => {
  for (const n of ["not provided", "Not Provided.", "unknown", "N/A", "na", "none", "", "  ", "+919800000431", "9800000431", "😊", "-"]) {
    assert.equal(isPlaceholderName(n, "+919800000431"), true, JSON.stringify(n));
    assert.equal(looksLikeCallerName(n), false, JSON.stringify(n));
  }
  for (const n of ["Tushar", "Priya Sharma", "राहुल"]) {
    assert.equal(isPlaceholderName(n, "+919800000431"), false, n);
    assert.equal(looksLikeRealName(n), true, n);
  }
  assert.equal(looksLikeRealName("not provided"), false, "a placeholder on a lead is not a real name");
});

test("conversation type: given, else read from the channel", () => {
  assert.equal(conversationTypeOf("text", "Phone"), "text");
  assert.equal(conversationTypeOf(" VOICE ", "Website chat"), "voice");
  assert.equal(conversationTypeOf("video", "Website chat"), "text", "unknown value: read the channel");
  for (const c of ["Website chat", "WhatsApp", "SMS", "text"]) assert.equal(conversationTypeOf(undefined, c), "text", c);
  for (const c of ["Phone", "Website Widget", "Web"]) assert.equal(conversationTypeOf(undefined, c), "voice", c);
  assert.equal(conversationTypeOf(undefined, "", { durationSeconds: 30 }), "voice");
  assert.equal(conversationTypeOf(undefined, "", { recordingUrl: "https://x" }), "voice");
  assert.equal(conversationTypeOf(undefined, ""), "");
  assert.equal(conversationTypeOf(42, { a: 1 }), "");
});

test("extracted_data is cleaned, never thrown on", () => {
  assert.equal(cleanExtractedData(null), null);
  assert.equal(cleanExtractedData([1, 2]), null);
  assert.equal(cleanExtractedData("x"), null);
  const c = cleanExtractedData({ "a.b": "x", $c: 1, nested: { d: [1] }, long: "y".repeat(5000), empty: "", nan: NaN, ok: true });
  assert.deepEqual(Object.keys(c).sort(), ["_c", "a_b", "long", "nested", "ok"]);
  assert.equal(c.nested, '{"d":[1]}');
  assert.equal(c.long.length, 1000);
});

// ---------------------------------------------------------------- the 31 Oct bug
test("calls 1702/1703: with the old unique index a second id-less lead fails (the 500), after the drop it is stored", async () => {
  await Lead.collection.createIndex(
    { orgId: 1, source: 1, "voiceCalls.externalCallId": 1 },
    { name: LEGACY, unique: true, partialFilterExpression: { "voiceCalls.externalCallId": { $exists: true } } }
  );
  // Another WhatsApp lead already holds an older call without an id and one with an id.
  await lead({ name: "Other", phone: "+919800000555", source: "WhatsApp", voiceCalls: [{ _id: oid(), channel: "Phone" }, { _id: oid(), externalCallId: 1500 }] });
  // The lead the auto-call was placed for: also an older call without an id.
  const target = await lead({ name: "Abhi Test", phone: "+919800000431", source: "WhatsApp", voiceCalls: [{ _id: oid(), channel: "Phone", durationSeconds: 40 }] });

  const before = await post(vistrowCall({ call_id: 1702, arthaleads_lead_id: String(target) }));
  assert.equal(before.status, 500, "reproduces the production failure while the old index exists");

  assert.equal(await Lead.dropLegacyCallIdIndex(), true);
  assert.equal(await Lead.dropLegacyCallIdIndex(), false, "second run: nothing to drop");

  const first = await post(vistrowCall({ call_id: 1702, arthaleads_lead_id: String(target) }));
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(String(first.body.leadId), String(target));
  const second = await post(vistrowCall({ call_id: 1703, arthaleads_lead_id: String(target), recording_url: "https://api.vistrowvoice.com/public/calls/1703/recording?t=y" }));
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const repush = await post(vistrowCall({ call_id: 1702, arthaleads_lead_id: String(target) }));
  assert.equal(repush.status, 200);
  assert.equal(repush.body.message, "Call updated");

  const l = await Lead.findById(target).lean();
  assert.equal(l.name, "Abhi Test", "a placeholder never replaces the real name");
  assert.deepEqual(l.voiceCalls.map((c) => c.externalCallId).filter(Boolean).sort(), [1702, 1703]);
  assert.equal(l.voiceCalls.filter((c) => c.externalCallId === 1702).length, 1, "re-push did not duplicate");
  assert.equal(l.voiceCalls.find((c) => c.externalCallId === 1703).conversationType, "voice");
  assert.equal(l.propertyType, "Plot");
  assert.equal(l.budget.min, 10000000);
  assert.equal(l.activities.some((a) => /Name updated/.test(a.description)), false);
});

test("a lead named by its phone keeps it when the call says 'not provided'; a real name later replaces both", async () => {
  const id = await lead({ name: "+919800000432", phone: "+919800000432", source: "Facebook" });
  assert.equal((await post(vistrowCall({ phone: "+919800000432", call_id: 1801, arthaleads_lead_id: String(id) }))).status, 200);
  assert.equal((await Lead.findById(id).lean()).name, "+919800000432");
  const id2 = await lead({ name: "not provided", phone: "+919800000433", source: "Facebook" });
  assert.equal((await post(vistrowCall({ name: "Tushar", phone: "+919800000433", call_id: 1802, arthaleads_lead_id: String(id2) }))).status, 200);
  assert.equal((await Lead.findById(id2).lean()).name, "Tushar", "a placeholder on the lead is replaced by a real name");
});

test("new caller with a placeholder or missing name: the lead is named by the phone", async () => {
  for (const [i, name] of [["1811", "not provided"], ["1812", "unknown"], ["1813", "N/A"], ["1814", undefined], ["1815", { first: "x" }]]) {
    const phone = `+91980000${i}`;
    const r = await post(vistrowCall({ name, phone, call_id: Number(i), direction: "inbound" }));
    assert.equal(r.status, 201, `${name}: ${JSON.stringify(r.body)}`);
    assert.equal((await Lead.findById(r.body.leadId).lean()).name, phone, String(name));
  }
});

test("'Tushar' on a new number still creates a normal lead (call 1698)", async () => {
  const r = await post(vistrowCall({ name: "Tushar", phone: "+919800001698", call_id: 1698, direction: "inbound", channel: "Website Widget" }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const l = await Lead.findById(r.body.leadId).lean();
  assert.equal(l.name, "Tushar");
  assert.equal(l.voiceCalls[0].conversationType, "voice");
});

// ---------------------------------------------------------------- never a 500
test("bad requests get a 4xx with a clear message", async () => {
  const cases = [
    [{ token: undefined, phone: "+919800000700" }, 400, /token/i],
    [{ phone: undefined }, 400, /phone/i],
    [{ phone: { $gt: "" } }, 400, /phone/i],
    [{ phone: ["+919800000700"] }, 400, /phone/i],
    [{ phone: "12" }, 400, /phone/i],
    [{ phone: "9".repeat(60) }, 400, /phone/i],
    [{ phone: "+919800000701", call_id: "abc" }, 400, /call_id/],
    [{ phone: "+919800000701", call_id: -5 }, 400, /call_id/],
    [{ phone: "+919800000701", call_id: 1.5 }, 400, /call_id/],
    [{ phone: "+919800000701", call_id: true }, 400, /call_id/],
    [{ token: "wrong-token", phone: "+919800000701" }, 401, /token/i],
  ];
  for (const [body, status, re] of cases) {
    const r = await post({ name: "Ravi", ...body });
    assert.equal(r.status, status, `${JSON.stringify(body)} -> ${JSON.stringify(r.body)}`);
    assert.match(r.body.message, re);
  }
  const broken = await post(null, "{not json");
  assert.equal(broken.status < 500 && broken.status >= 400, true, `malformed JSON -> ${broken.status}`);
});

test("wrong types, nulls, huge and nested values in every optional field are stored or dropped, never a 500", async () => {
  const weird = [null, 0, 1, true, "", "x".repeat(50000), [], [1, { a: 2 }], { a: { b: { c: [1, 2] } } }, -1, 1e308];
  const fields = ["email", "message", "source_name", "transcript", "sentiment", "duration_seconds", "channel", "language",
    "agent_name", "extracted_data", "recording_url", "recording_mime_type", "page_path", "page_url", "website_url",
    "arthaleads_lead_id", "crm_outcome", "direction", "summary", "key_points", "conversation_type", "follow_up_kind", "custom_fields", "some_future_field"];
  let n = 0;
  for (const f of fields) {
    for (const v of weird) {
      n++;
      const r = await post(vistrowCall({ name: "Ravi", phone: `+9197${String(n).padStart(8, "0")}`, call_id: 20000 + n, [f]: v }));
      assert.ok(r.status === 200 || r.status === 201, `${f}=${JSON.stringify(v).slice(0, 40)} -> ${r.status} ${JSON.stringify(r.body)}`);
    }
  }
  // The same variety without a call_id (the plain Custom webhook path).
  for (const f of ["email", "extracted_data", "transcript", "channel", "message"]) {
    for (const v of weird) {
      n++;
      const r = await post({ name: "Ravi", phone: `+9196${String(n).padStart(8, "0")}`, [f]: v });
      assert.ok(r.status === 200 || r.status === 201, `no call_id ${f}=${JSON.stringify(v).slice(0, 40)} -> ${r.status} ${JSON.stringify(r.body)}`);
    }
  }
});

test("duplicate and re-sent call_ids update, never throw or duplicate", async () => {
  const body = vistrowCall({ name: "Meera", phone: "+919800000900", call_id: 3001, direction: "inbound" });
  const results = await Promise.all([post(body), post(body), post(body)]);
  for (const r of results) assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
  assert.equal(await Lead.countDocuments({ orgId: ORG, "voiceCalls.externalCallId": 3001 }), 1, "one lead for the call");
  const l = await Lead.findOne({ orgId: ORG, "voiceCalls.externalCallId": 3001 }).lean();
  assert.equal(l.voiceCalls.filter((c) => c.externalCallId === 3001).length, 1, "one call entry");
  const again = await post({ ...body, call_id: "3001", summary: "updated" });
  assert.equal(again.status, 200);
  assert.equal(again.body.message, "Call updated");
});

test("a failing side effect (push, connection status) does not fail the delivery", async () => {
  const Automation = require("../models/Automation");
  const orig = { upd: Automation.updateOne };
  pushImpl.user = () => Promise.reject(new Error("push down"));
  pushImpl.all = () => { throw new Error("push down"); };
  Automation.updateOne = () => Promise.reject(new Error("db hiccup"));
  try {
    const r = await post(vistrowCall({ name: "Kiran", phone: "+919800000950", call_id: 3101, direction: "inbound" }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const r2 = await post({ name: "Kiran", phone: "+919800000951" });
    assert.equal(r2.status, 201, JSON.stringify(r2.body));
    assert.ok(await Lead.findById(r.body.leadId));
  } finally {
    pushImpl.user = pushImpl.all = async () => {}; Automation.updateOne = orig.upd;
  }
});

// ---------------------------------------------------------------- voice / text
test("conversation_type is stored on the call, the note and the activity", async () => {
  const text = await post(vistrowCall({ name: "Asha", phone: "+919800001001", call_id: 4001, direction: "inbound", channel: "Website chat", duration_seconds: undefined, recording_url: undefined }));
  assert.equal(text.status, 201, JSON.stringify(text.body));
  let l = await Lead.findById(text.body.leadId).lean();
  assert.equal(l.voiceCalls[0].conversationType, "text");
  assert.match(l.notes[0].text, /chat summary/);
  assert.match(l.notes[0].text, /Text chat/);
  const act = l.activities.find((a) => a.type === "called");
  assert.equal(act.meta.conversationType, "text");
  assert.match(act.description, /text chat/);

  const explicit = await post(vistrowCall({ name: "Asha", phone: "+919800001002", call_id: 4002, channel: "Phone", conversation_type: "text" }));
  l = await Lead.findById(explicit.body.leadId).lean();
  assert.equal(l.voiceCalls[0].conversationType, "text", "conversation_type wins over the channel");

  const wa = await post(vistrowCall({ name: "Asha", phone: "+919800001003", call_id: 4003, channel: "WhatsApp" }));
  l = await Lead.findById(wa.body.leadId).lean();
  assert.equal(l.voiceCalls[0].conversationType, "text");

  const old = await post(vistrowCall({ name: "Asha", phone: "+919800001004", call_id: 4004, channel: undefined, duration_seconds: undefined, recording_url: undefined, conversation_type: undefined }));
  l = await Lead.findById(old.body.leadId).lean();
  assert.equal(l.voiceCalls[0].conversationType, undefined, "nothing to tell: left unset (shown as a voice call)");
  assert.match(l.notes[0].text, /call summary/);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  await Lead.init();
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false });
  await mongoose.connection.collection("automations").insertMany(POOL.map((t) => ({
    _id: oid(), name: "Vistrow Voice", platform: "Vistrow Voice", verifyToken: t, isActive: true, orgId: ORG,
    createdBy: oid(), updatedBy: oid(),
  })));
  const push = require("../utils/push");
  push.sendPushToUser = (...a) => pushImpl.user(...a);
  push.sendPushToAll = (...a) => pushImpl.all(...a);
  const app = express();
  app.use("/webhook", require("../routes/webhookRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow webhook hardening: 31 Oct 500, placeholder names, voice/text");
})();
