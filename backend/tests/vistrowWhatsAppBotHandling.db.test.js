// Owner decision 17 Oct 2026 (live incident: a click-to-WhatsApp lead was
// called while the assistant's button flow was mid-question). While the
// WhatsApp assistant is handling a chat, Vistrow gets the contact without a
// call; ONE call follows when the customer asks for one or the chat is handed
// to the team (rule 1), or after 15 minutes without a reply (rule 2). A chat
// with no assistant on it is called as before (rule 3).
// Real in-memory MongoDB, the real inbound route, button flow, delivery
// service, bot pause and heads-up; only Vistrow (fetch), OpenAI and the Meta
// Graph API (axios.post) are stubbed.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
delete process.env.VISTROW_OUTBOUND_DISABLED;
delete process.env.VISTROW_OUTBOUND_ALLOWED_HOSTS;

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AD = "120252242040050311";      // answered by the free-text assistant
const AD_FLOW = "120252242040050322"; // answered by the button flow (the incident)
const SOON = "Dhanyavaad! 🙏 Hamari property advisor aapko lagbhag 1 minute mein call karengi, taaki aapki requirement achhe se samajh sakein.";
const MIN = 60 * 1000;

// ── Stubs ───────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://api.vistrowvoice.com/")) {
    sent.push(JSON.parse(opts.body));
    return { status: 200, text: async () => JSON.stringify({ ok: true, queued: true }), headers: { get: () => null } };
  }
  return realFetch(url, opts);
};
const axios = require("axios");
const metaSends = [];
let aiText = "Sure, happy to help.";
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) {
    metaSends.push(body);
    return { data: { messages: [{ id: `wamid.out.${metaSends.length}` }] } };
  }
  return { data: { choices: [{ message: { content: aiText } }], usage: {} } };
};

let ORG, org, Lead, WaConversation, WaMessage, WaAgent, OutboundIntegration, wa, outbound;
let seq = 0;
const nextPhone = () => `9198555${String(10000 + ++seq).padStart(5, "0")}`;
const settle = async () => { for (let i = 0; i < 3; i++) { await sleep(30); await outbound.service.drain(); } };
const later = (ms) => new Date(Date.now() + ms);
const bodiesFor = (leadId) => sent.filter((b) => b.lead_id === String(leadId));
const callsFor = (leadId) => bodiesFor(leadId).filter((b) => b.auto_call === true);
const headsUps = (phone) => metaSends.filter((s) => s.to === phone && s.text?.body === SOON).length;

const say = (phone, msgText, extra = {}) => wa._handleInbound(org, {
  phone, name: "Prakash", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra,
});
const tap = (phone, id, title) => say(phone, title, { msgType: "interactive", interactiveId: id });

// A new chat from an ad, its first hand-off sent (the 60 s sweep).
async function chat({ ad = AD, beforeHandOff } = {}) {
  const phone = nextPhone();
  await say(phone, "Hi, I want details", { referral: { source_id: ad, headline: "Khopoli plots" } });
  const lead = await Lead.findOne({ orgId: ORG, phone }).lean();
  const conv = await WaConversation.findOne({ orgId: ORG, contactPhone: phone }).lean();
  if (beforeHandOff) await beforeHandOff({ lead, conv });
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) });
  await settle();
  return { phone, leadId: lead._id, convId: conv._id };
}
const leadOf = (id) => Lead.findById(id).lean();
const convOf = (id) => WaConversation.findById(id).lean();
const quiet = (ms) => wa._vistrowEmit.sweepQuietWhatsAppCalls({ now: later(ms) }).then(async (n) => { await settle(); return n; });

test("bot active: first hand-off sent with auto_call false + reason; no heads-up, no pause, no call", async () => {
  const { phone, leadId, convId } = await chat();
  const b = bodiesFor(leadId);
  assert.equal(b.length, 1, "the contact is handed to Vistrow once");
  assert.deepEqual([b[0].event_id, b[0].auto_call, b[0].auto_call_reason, b[0].agent_id], [`evt_lc_${leadId}`, false, "whatsapp_bot_handling", undefined]);
  assert.equal(headsUps(phone), 0, "no heads-up");
  const c = await convOf(convId);
  assert.deepEqual([c.botEnabled, c.status, c.botPausedReason || ""], [true, "bot", ""], "the assistant keeps the chat");
  const l = await leadOf(leadId);
  assert.ok(l.vistrowEmit.awaitingCallSince && l.vistrowEmit.quietDueAt && !l.vistrowEmit.callRequestedAt, "one call is waiting");
});

test("the incident: button flow mid-question at the hand-off -> no call, no heads-up, flow continues", async () => {
  const { phone, leadId, convId } = await chat({ ad: AD_FLOW });
  const c = await convOf(convId);
  assert.equal(c.flowState?.step, "purpose", "the qualifying question is on screen");
  assert.equal(callsFor(leadId).length, 0);
  assert.equal(bodiesFor(leadId)[0].auto_call_reason, "whatsapp_bot_handling");
  assert.equal(headsUps(phone), 0);
  assert.equal(c.botEnabled, true);
});

test("rule 1: the customer asks for a call -> one call request, heads-up once, bot paused", async () => {
  const { phone, leadId, convId } = await chat();
  await say(phone, "Please call me, baat karni hai");
  await settle();
  const calls = callsFor(leadId);
  assert.equal(calls.length, 1, "one call");
  assert.ok(calls[0].event_id.startsWith(`evt_call_${leadId}_`), calls[0].event_id);
  assert.deepEqual([calls[0].agent_id, calls[0].custom_fields.call_request, calls[0].custom_fields.call_trigger], ["agent_ad", true, "asked"]);
  assert.equal(headsUps(phone), 1, "heads-up once");
  assert.equal((await convOf(convId)).botPausedReason, "vistrow_call", "bot paused for the call");
  await say(phone, "call me");
  await settle();
  assert.equal(callsFor(leadId).length, 1, "asking again does not call twice");
  assert.equal(headsUps(phone), 1);
  const l = await leadOf(leadId);
  assert.ok(l.activities.some((a) => a.description === "Vistrow Voice asked to call this lead: the customer asked on WhatsApp to talk to someone"));
});

test("rule 1: the button flow hands off (Talk to Advisor) -> one call, heads-up once, bot paused", async () => {
  const { phone, leadId, convId } = await chat({ ad: AD_FLOW });
  await tap(phone, "inv", "Investment");
  await settle();
  assert.equal(callsFor(leadId).length, 0, "answering a question is not a hand-off");
  assert.equal((await convOf(convId)).flowState?.step, "closing");
  await tap(phone, "advisor", "Talk to Advisor");
  await settle();
  const calls = callsFor(leadId);
  assert.equal(calls.length, 1);
  assert.deepEqual([calls[0].custom_fields.call_trigger, calls[0].agent_id], ["handoff", "agent_flow"]);
  assert.equal(headsUps(phone), 1);
  const c = await convOf(convId);
  assert.deepEqual([c.botEnabled, c.botPausedReason], [false, "vistrow_call"]);
});

test("rule 1: the AI assistant hands the chat to a person ([HUMAN_TAKEOVER]) -> one call", async () => {
  const { phone, leadId } = await chat();
  aiText = "Sure, connecting you with our team. [HUMAN_TAKEOVER]";
  try { await say(phone, "I have a question about the loan"); } finally { aiText = "Sure, happy to help."; }
  await settle();
  assert.equal(callsFor(leadId).length, 1);
  assert.equal(callsFor(leadId)[0].custom_fields.call_trigger, "handoff");
  assert.equal(headsUps(phone), 1);
});

test("rule 2: 15 min of silence -> one call + heads-up; a reply at 14 min resets the clock", async () => {
  const { phone, leadId, convId } = await chat();
  // The customer's first message was 14 minutes ago...
  const first = await WaMessage.findOne({ conversationId: convId, direction: "inbound" }).sort({ timestamp: -1 });
  await WaMessage.updateOne({ _id: first._id }, { $set: { timestamp: new Date(Date.now() - 14 * MIN) } });
  await Lead.updateOne({ _id: leadId }, { $set: { "vistrowEmit.quietDueAt": new Date(Date.now() + 1 * MIN) } });
  // ...and they reply now.
  await say(phone, "Investment ke liye dekh raha hoon");
  await quiet(2 * MIN);
  assert.equal(callsFor(leadId).length, 0, "the old 15 minutes no longer count");
  await quiet(14 * MIN);
  assert.equal(callsFor(leadId).length, 0, "14 minutes after the reply: still nothing");
  await quiet(15 * MIN + 5000);
  const calls = callsFor(leadId);
  assert.equal(calls.length, 1, "15 minutes after the reply: the call");
  assert.equal(calls[0].custom_fields.call_trigger, "quiet");
  assert.equal(headsUps(phone), 1, "heads-up sent");
  assert.equal((await convOf(convId)).botPausedReason, "vistrow_call");
  await quiet(40 * MIN);
  assert.equal(callsFor(leadId).length, 1, "not again");
});

test("rule 2: a chat already handed off / flow completed is not called for silence", async () => {
  const { leadId, convId } = await chat({ ad: AD_FLOW });
  // The state a finished flow leaves (handOffToHuman: status open, flowState cleared).
  await WaConversation.updateOne({ _id: convId }, { $set: { status: "open", "flowFunnel.outcome": "advisor" }, $unset: { flowState: 1 } });
  await quiet(16 * MIN);
  assert.equal(callsFor(leadId).length, 0);
  assert.ok(!(await leadOf(leadId)).vistrowEmit.quietDueAt, "the silence timer is dropped");
});

test("rule 3: bot off on the chat -> immediate hand-off with auto_call true + heads-up (unchanged)", async () => {
  const { phone, leadId, convId } = await chat({
    beforeHandOff: ({ conv }) => WaConversation.updateOne({ _id: conv._id }, { $set: { botEnabled: false, status: "open" } }),
  });
  const b = bodiesFor(leadId);
  assert.equal(b.length, 1);
  assert.deepEqual([b[0].event_id, b[0].auto_call, b[0].agent_id], [`evt_lc_${leadId}`, true, "agent_ad"]);
  assert.equal(headsUps(phone), 1);
  assert.equal((await convOf(convId)).botPausedReason, "", "a chat the bot was not on is not paused");
  assert.ok(!(await leadOf(leadId)).vistrowEmit.awaitingCallSince, "nothing waiting");
});

test("rule 3: no active AI agent -> immediate call (unchanged)", async () => {
  await WaAgent.collection.updateMany({ orgId: ORG }, { $set: { status: "paused" } });
  let r;
  try {
    r = await chat({ beforeHandOff: () => WaAgent.collection.updateMany({ orgId: ORG }, { $set: { status: "paused" } }) });
  } finally { await WaAgent.collection.updateMany({ orgId: ORG }, { $set: { status: "active" } }); }
  const b = bodiesFor(r.leadId);
  assert.equal(b.length, 1);
  assert.equal(b[0].auto_call, true);
  assert.equal(headsUps(r.phone), 1);
});

test("a call asked for before the first hand-off: the first hand-off carries it (one call)", async () => {
  const { phone, leadId } = await chat({ beforeHandOff: ({ lead }) => say(lead.phone, "Can you call me?") });
  assert.equal(callsFor(leadId).length, 1);
  assert.equal(callsFor(leadId)[0].event_id, `evt_lc_${leadId}`);
  assert.equal(headsUps(phone), 1);
  await quiet(20 * MIN);
  assert.equal(callsFor(leadId).length, 1, "rule 2 adds nothing");
});

test("never two calls for one lead from rules 1 + 2", async () => {
  const { phone, leadId, convId } = await chat();
  await say(phone, "call me please");
  await settle();
  // The bot comes back on (call result), the customer goes quiet, the AI hands off.
  await WaConversation.updateOne({ _id: convId }, { $set: { botEnabled: true, status: "bot" }, $unset: { botPausedReason: 1 } });
  await quiet(20 * MIN);
  await Lead.updateOne({ _id: leadId }, { $set: { "vistrowEmit.quietDueAt": new Date() } });
  await quiet(20 * MIN);
  aiText = "Connecting you. [HUMAN_TAKEOVER]";
  try { await say(phone, "ok one more doubt"); } finally { aiText = "Sure, happy to help."; }
  await settle();
  assert.equal(callsFor(leadId).length, 1, "exactly one call");
  assert.equal(headsUps(phone), 1);
});

test("source disabled in routing: no call from any rule", async () => {
  const setWa = (enabled) => OutboundIntegration.updateOne({ orgId: ORG }, { $set: { "routing.whatsapp.enabled": enabled } });
  // Disabled before the first hand-off: nothing waits, nothing calls.
  await setWa(false);
  let a;
  try {
    a = await chat();
    assert.equal(bodiesFor(a.leadId)[0].auto_call_reason, "source_disabled");
    await say(a.phone, "call me");
    await quiet(20 * MIN);
  } finally { await setWa(true); }
  await settle();
  assert.equal(callsFor(a.leadId).length, 0);
  // Disabled after a deferred hand-off: rule 1 and rule 2 are refused.
  const b = await chat();
  await setWa(false);
  try {
    await say(b.phone, "call me");
    await quiet(20 * MIN);
    await settle();
  } finally { await setWa(true); }
  assert.equal(callsFor(b.leadId).length, 0);
  assert.equal(headsUps(a.phone) + headsUps(b.phone), 0);
  const l = await leadOf(b.leadId);
  assert.ok(l.activities.some((x) => /^No Vistrow Voice call although the customer asked/.test(x.description)), "the refusal is on the lead");
});

test("looksLikeCallAsk: asks vs. refusals and ordinary text", () => {
  const f = wa._vistrowEmit.looksLikeCallAsk;
  for (const t of ["call me", "Please call me back", "mujhe call karo", "advisor se baat karni hai", "Talk to Advisor", "can I speak to someone"]) assert.ok(f(t), t);
  for (const t of ["don't call me", "call mat karo", "Investment", "price?", "What is the location", "phone number of site office"]) assert.ok(!f(t), t);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  WaMessage = require("../models/WaMessage");
  WaAgent = require("../models/WaAgent");
  const OutboundDelivery = require("../models/OutboundDelivery");
  OutboundIntegration = require("../models/OutboundIntegration");
  for (const M of [Lead, WaConversation, WaMessage, OutboundDelivery, OutboundIntegration]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});

  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  await WaAgent.collection.insertMany([
    { _id: oid(), orgId: ORG, name: "Riya", status: "active", isDefault: true, adIds: [], createdAt: new Date() },
    {
      _id: oid(), orgId: ORG, name: "Riya (Bot)", status: "active", adIds: [AD_FLOW], createdAt: new Date(),
      ctwaFlow: {
        enabled: true, welcomeText: "",
        qualifyingQuestions: [{ id: "purpose", questionText: "Investment or self use?", mapsTo: "purpose", options: [
          { id: "inv", label: "Investment", action: "none", next: "" }, { id: "self", label: "Self Use", action: "none", next: "" },
        ] }],
        closingButtons: [{ id: "advisor", label: "Talk to Advisor" }],
      },
    },
  ]);
  const integ = new OutboundIntegration({
    orgId: ORG, enabled: true, enabledAt: new Date(Date.now() - 3600e3), baseUrl: "https://api.vistrowvoice.com", accountId: "acct_1",
    routing: { whatsapp: { enabled: true, routes: [
      { matchKind: "ad_id", matchValue: AD, agentId: "agent_ad" },
      { matchKind: "ad_id", matchValue: AD_FLOW, agentId: "agent_flow" },
    ] } },
    dedupeWindowHours: 0,
  });
  integ.setSecret("s3cr3t-token-value-0123456789");
  await integ.save();

  wa = require("../routes/whatsappRoutes");
  outbound = require("../services/vistrowOutbound");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow Voice: no call while the WhatsApp assistant is handling the chat (17 Oct 2026)");
})();
