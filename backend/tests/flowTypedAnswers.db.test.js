// Button flows, typed replies (22 Oct 2026: a customer typed "1.5 cr" under
// the budget buttons and the flow ended there). For every agent's flow:
//  - a typed budget picks the matching button, or is saved as it is
//  - other typed answers are read by a small AI check, only when clear
//  - a side question is answered, then the pending question is asked again once
//  - a second non-answer ends the flow as before
// Real inbound route and flow service; Meta (axios), OpenAI replies (axios) and
// the typed-answer model (flowAnswer._setModel) are faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
const AD = "120252242040099001";
let ORG, org, Lead, WaConversation, wa, flowAnswer, seq = 0;
const metaSends = [], aiRequests = [], matchCalls = [];
let aiText = "The plots are near Khopoli, about 1.5 hours from Mumbai.";
let matchAnswer = null;

// Chat-model calls go through the AI gateway; send them to the same fake (axios.post is
// looked up at call time, so the per-test swaps below still apply).
require("../utils/ai/gateway").createChatCompletion = async (body) => (await axios.post("https://api.openai.com/v1/chat/completions", body)).data;
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) {
    metaSends.push(body);
    return { data: { messages: [{ id: `wamid.out.${metaSends.length}` }] } };
  }
  aiRequests.push(body);
  return { data: { choices: [{ message: { content: aiText } }], usage: {} } };
};

const nextPhone = () => `9198444${String(10000 + ++seq).padStart(5, "0")}`;
const say = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: "Vivek", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
const tap = (phone, id, title) => say(phone, title, { msgType: "interactive", interactiveId: id });
// The reply call (other AI calls, like reading lead details, also go out).
const replyCalls = () => aiRequests.filter((b) => (b.messages || []).some((m) => m.role === "system" && /Customer context/.test(m.content)));
const toPhone = (phone) => metaSends.filter((m) => m.to === phone);
const lastBody = (phone) => { const m = toPhone(phone).slice(-1)[0]; return m?.interactive?.body?.text || m?.text?.body || ""; };
const convOf = (phone) => WaConversation.findOne({ orgId: ORG, contactPhone: phone }).lean();
const leadOf = (phone) => Lead.findOne({ orgId: ORG, phone }).lean();

// A new chat from the ad, the purpose question tapped: now on the budget question.
async function atBudget() {
  const phone = nextPhone();
  await say(phone, "Hi, I'd like details of the plots near Khopoli.", { referral: { source_id: AD, headline: "Khopoli plots" } });
  await tap(phone, "self", "Future Villa / Self Use");
  assert.equal((await convOf(phone)).flowState?.step, "budget", "on the budget question");
  return phone;
}

test("the 22 Oct case: typing '1.5 cr' picks '₹1.5Cr+', saves the budget and moves on", async () => {
  const phone = await atBudget();
  await say(phone, "1.5 cr");
  const c = await convOf(phone);
  assert.equal(c.flowState?.step, "timeline", "the next question was asked");
  assert.match(lastBody(phone), /finalize/);
  const l = await leadOf(phone);
  assert.equal(l.budget.min, 15000000);
  assert.equal(replyCalls().length, 0, "no AI reply in between");
});

test("other ways of typing a budget work too", async () => {
  for (const [typed, min] of [["150 lakh", 15000000], ["1.3cr", 12500000], ["around 95 lac", 8900000], ["1.4", 12500000]]) {
    const phone = await atBudget();
    await say(phone, typed);
    assert.equal((await convOf(phone)).flowState?.step, "timeline", typed);
    assert.equal((await leadOf(phone)).budget.min, min, typed);
  }
});

test("a budget that fits no button is still an answer: saved as typed, flow moves on", async () => {
  const phone = await atBudget();
  await say(phone, "70 lakh");
  assert.equal((await convOf(phone)).flowState?.step, "timeline");
  const l = await leadOf(phone);
  assert.equal(l.budget.max, 7000000);
});

test("'I am looking at 3 plots' is not a budget", async () => {
  const phone = await atBudget();
  matchCalls.length = 0;
  await say(phone, "I am looking at 3 plots");
  assert.equal((await leadOf(phone)).budget?.max || 0, 0, "no budget saved");
});

test("a typed answer to another question is read by the AI check, only when clear", async () => {
  const phone = await atBudget();
  await say(phone, "1.5 cr");
  matchAnswer = "t0";
  await say(phone, "next month itself");
  matchAnswer = null;
  assert.equal((await convOf(phone)).flowState?.step, "closing", "the closing question came next");
  assert.match(matchCalls.slice(-1)[0], /next month itself/);
});

test("a side question is answered, then the pending question is asked again with its buttons", async () => {
  const phone = await atBudget();
  aiRequests.length = 0; matchCalls.length = 0;
  await say(phone, "Where exactly is the plot?");
  assert.equal(matchCalls.length, 0, "a question is never read as an answer");
  assert.equal(replyCalls().length, 1, "the AI answered it");
  const sys = replyCalls()[0].messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  assert.match(sys, /asked this again, with buttons: "Perfect\. What's your approximate budget range\?"/);
  const sends = toPhone(phone).slice(-2);
  assert.equal(sends[0].text?.body, aiText, "the answer first");
  assert.match(sends[1].interactive?.body?.text || "", /^Coming back to my earlier question:\n\nPerfect\. What's your approximate budget range\?/);
  assert.ok((sends[1].interactive?.action?.buttons || sends[1].interactive?.action?.sections || []).length, "with the buttons");
  const c = await convOf(phone);
  assert.equal(c.flowState?.step, "budget", "still in the flow");
  assert.ok(!c.flowState?.resumeAfterReply);
  // Then they answer: the flow carries on.
  await say(phone, "1.3 cr");
  assert.equal((await convOf(phone)).flowState?.step, "timeline");
});

test("a second non-answer to the same question ends the flow and the AI carries on", async () => {
  const phone = await atBudget();
  await say(phone, "Where exactly is the plot?");
  aiRequests.length = 0;
  await say(phone, "Is there a clubhouse?");
  const c = await convOf(phone);
  assert.ok(!c.flowState?.step, "flow ended");
  assert.equal(replyCalls().length, 1, "the AI answered");
  assert.ok(!/Coming back/.test(lastBody(phone)), "not asked a third time");
});

test("a person taking over in between: the question isn't re-asked", async () => {
  const phone = await atBudget();
  const conv = await convOf(phone);
  aiText = "Near Khopoli.";
  // The AI reply is sent, then a person switches the bot off before the re-ask.
  const realReply = axios.post;
  axios.post = async (url, body) => {
    const r = await realReply(url, body);
    if (!String(url).startsWith("https://graph.facebook.com/")) await WaConversation.updateOne({ _id: conv._id }, { $set: { botEnabled: false } });
    return r;
  };
  await say(phone, "Where is it?");
  axios.post = realReply;
  assert.ok(!/Coming back/.test(lastBody(phone)));
});

test("the typed-answer helpers: amounts, ranges, questions", async () => {
  assert.deepEqual(flowAnswer.readAmount("1.5 cr"), { min: 15000000, max: 15000000 });
  assert.deepEqual(flowAnswer.readAmount("1 - 1.5 crore"), { min: 10000000, max: 15000000 });
  assert.equal(flowAnswer.readAmount("2 bhk"), null);
  assert.equal(flowAnswer.readAmount("call me at 5"), null);
  assert.deepEqual(flowAnswer.optionRange({ label: "₹1.5Cr+" }), { min: 15000000, max: 0 }, "read from a label when no range is saved");
  assert.ok(flowAnswer.looksLikeQuestion("kitna price hai"));
  assert.ok(!flowAnswer.looksLikeQuestion("next month"));
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  const WaAgent = require("../models/WaAgent");
  for (const M of [Lead, WaConversation, WaMessage]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  const opt = (id, label, extra = {}) => ({ id, label, action: "none", next: "", ...extra });
  await WaAgent.collection.insertOne({
    _id: oid(), orgId: ORG, name: "Khopoli Project Advisor", status: "active", isDefault: true, adIds: [AD], greetingEnabled: false, createdAt: new Date(),
    ctwaFlow: {
      enabled: true, welcomeText: "", closingPrompt: "Would you like our project advisor to connect with you?",
      qualifyingQuestions: [
        { id: "purpose", questionText: "What are you primarily exploring this property for?", mapsTo: "purpose",
          options: [opt("inv", "Investment"), opt("second", "Second Home"), opt("self", "Future Villa / Self Use")] },
        { id: "budget", questionText: "Perfect. What's your approximate budget range?", mapsTo: "budget",
          options: [opt("b1", "₹89L – ₹1.25Cr", { min: 8900000, max: 12500000 }), opt("b2", "₹1.25Cr – ₹1.5Cr", { min: 12500000, max: 15000000 }), opt("b3", "₹1.5Cr+", { min: 15000000, max: 0 })] },
        { id: "timeline", questionText: "Got it. When are you looking to finalize?", mapsTo: "timeline",
          options: [opt("t0", "Within 30 Days"), opt("t1", "1-3 Months"), opt("t2", "3-6 Months")] },
      ],
    },
  });
  flowAnswer = require("../utils/flowAnswer");
  flowAnswer._setModel(async (messages) => {
    matchCalls.push(messages.map((m) => m.content).join("\n"));
    return { text: JSON.stringify({ option: matchAnswer }), usage: { total_tokens: 50 } };
  });
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Button flows: typed replies");
})();
