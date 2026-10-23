// An agent's test numbers can run its button flow over and over: the ad (or
// its pre-filled message) always restarts it from the first question, after
// a finished run, a hand-off or a mute, and earlier runs' answers are not
// used to skip questions (owner, 23 Oct 2026). A real customer is unaffected.
// Real inbound route; Meta (axios) and OpenAI faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, WaConversation, wa, seq = 0;
const sent = [];
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) { sent.push(body); return { data: { messages: [{ id: `wamid.out.${sent.length}` }] } }; }
  return { data: { choices: [{ message: { content: "Happy to help." } }], usage: {} } };
};
const AD = "ad_webinar";
const AD_TEXT = "Hi! I want to register for the FREE webinar on 31 Oct at 12 PM.";
const TESTER = "917020950304"; // saved on the agent as 10 digits
const say = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: "Pranav", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
const tap = (phone, id, title) => say(phone, title, { msgType: "interactive", interactiveId: id });
const last = (phone) => { const m = sent.filter((x) => x.to === phone).slice(-1)[0]; return m?.interactive?.body?.text || m?.text?.body || ""; };
const convOf = (phone) => WaConversation.findOne({ orgId: ORG, contactPhone: phone }).lean();
const runThrough = async (phone) => { await tap(phone, "b1", "₹79L – ₹1Cr"); await tap(phone, "p0", "Investment"); };

test("a test number: first run, then the ad's message again starts over from question 1", async () => {
  await say(TESTER, AD_TEXT, { referral: { source_id: AD, source_type: "ad", headline: "Webinar" } });
  assert.match(last(TESTER), /budget/);
  await runThrough(TESTER);
  assert.match(last(TESTER), /reserve your seat/);
  await tap(TESTER, "later", "Not now");
  await say(TESTER, AD_TEXT);
  assert.match(last(TESTER), /budget/, "asked again, though the first run filled the lead's budget and purpose");
  assert.equal((await convOf(TESTER)).flowState.step, "budget");
});

test("mid-run, the ad's message restarts it too", async () => {
  await tap(TESTER, "b1", "₹79L – ₹1Cr");
  assert.match(last(TESTER), /purpose/);
  await say(TESTER, AD_TEXT);
  assert.match(last(TESTER), /budget/);
});

test("after a hand-off to the team (bot handed over), the ad's message brings the bot back and restarts", async () => {
  await runThrough(TESTER);
  await tap(TESTER, "call", "Call me");
  assert.equal((await convOf(TESTER)).status, "open");
  await WaConversation.updateOne({ contactPhone: TESTER }, { $set: { botEnabled: false, botPausedReason: "human_reply" } });
  await say(TESTER, AD_TEXT);
  const c = await convOf(TESTER);
  assert.equal(c.botEnabled, true);
  assert.equal(c.flowState.step, "budget");
});

test("a muted test chat (read as a vendor pitch) is unmuted by the ad's message", async () => {
  await WaConversation.updateOne({ contactPhone: TESTER }, { $set: { botEnabled: false, status: "resolved" }, $unset: { flowState: 1 } });
  await say(TESTER, AD_TEXT);
  const c = await convOf(TESTER);
  assert.equal(c.botEnabled, true);
  assert.equal(c.flowState.step, "budget");
});

test("a real customer sending the ad's message twice is not restarted", async () => {
  // The agent is locked to its test numbers, so a real customer gets the normal chat; this
  // checks only that nothing restarts or switches for them.
  const phone = "919800000777";
  await say(phone, AD_TEXT, { referral: { source_id: AD, source_type: "ad", headline: "Webinar" } });
  await say(phone, AD_TEXT);
  assert.ok(!(await convOf(phone)).flowState?.step);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  const WaAgent = require("../models/WaAgent");
  const AdPrefill = require("../models/AdPrefill");
  for (const M of [Lead, WaConversation, WaMessage, AdPrefill]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  const questions = [
    { id: "budget", questionText: "What budget are you considering?", mapsTo: "budget",
      options: [{ id: "b0", label: "Below ₹79L" }, { id: "b1", label: "₹79L – ₹1Cr" }, { id: "b2", label: "Above ₹1Cr" }] },
    { id: "purpose", questionText: "And your primary purpose?", mapsTo: "purpose",
      options: [{ id: "p0", label: "Investment" }, { id: "p1", label: "Self Use" }] },
  ];
  const agentId = oid();
  await WaAgent.collection.insertMany([
    { _id: oid(), orgId: ORG, name: "Artha Assistant", status: "active", isDefault: true, adIds: [], projectIds: [], greetingEnabled: false, createdAt: new Date(Date.now() - 3e6) },
    { _id: agentId, orgId: ORG, name: "SP Webinar", status: "active", adIds: [AD], projectIds: [], greetingEnabled: false, createdAt: new Date(),
      ctwaFlow: { enabled: true, welcomeText: "", qualifyingQuestions: questions, testPhones: ["7020950304"], closingPrompt: "Shall I reserve your seat?",
        closingButtons: [{ id: "later", label: "Not now", action: "end" }, { id: "call", label: "Call me", action: "handoff" }] } },
  ]);
  await require("../utils/adPrefill").addManual(ORG, AD, AD_TEXT);
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Button flows: test numbers can test again and again");
})();
