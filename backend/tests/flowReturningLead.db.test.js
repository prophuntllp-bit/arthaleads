// A customer who enquired about another project weeks ago clicks a new ad:
// the new agent's button questions are asked, not skipped on the old
// project's answers (23 Oct 2026: the webinar ad went straight to its closing
// question). An answer that differs from the lead's value is offered on the
// Artha card instead of being dropped or overwriting it.
// Real inbound route; Meta (axios) and OpenAI faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, Lead, WaConversation, WaAgent, wa, seq = 0;
const sent = [];
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) { sent.push(body); return { data: { messages: [{ id: `wamid.out.${sent.length}` }] } }; }
  return { data: { choices: [{ message: { content: "Happy to help." } }], usage: {} } };
};
const AD = "ad_webinar_new";
const say = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: "Pranav", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
const tap = (phone, id, title) => say(phone, title, { msgType: "interactive", interactiveId: id });
const last = (phone) => { const m = sent.filter((x) => x.to === phone).slice(-1)[0]; return m?.interactive?.body?.text || m?.text?.body || ""; };
const convOf = (phone) => WaConversation.findOne({ orgId: ORG, contactPhone: phone }).lean();

async function lead(phone, createdAt, extra = {}) {
  await Lead.collection.insertOne({ _id: oid(), orgId: ORG, name: "Pranav Test", phone, source: "Website", status: "New",
    budget: { min: 10000000, max: 20000000, currency: "INR" }, timeline: "3 - 6 Months", purpose: "Invest",
    isDeleted: false, isArchived: false, createdAt, updatedAt: createdAt, activities: [], notes: [], tags: [], ...extra });
}

test("a lead from another project weeks ago: the new ad's questions are all asked", async () => {
  const phone = "917020950304";
  await lead(phone, new Date(Date.now() - 22 * 86400000));
  await say(phone, "Hi, I'd like to join the 31 Oct webinar on hilltop plots from ₹79L*.", { referral: { source_id: AD, source_type: "ad", headline: "Webinar" } });
  assert.match(last(phone), /^To begin, what investment budget/, "the first question, not the closing");
  assert.equal((await convOf(phone)).flowState.step, "budget");
});

test("an answer different from the lead's: not overwritten, offered on the Artha card", async () => {
  const phone = "917020950304";
  await tap(phone, "b1", "₹79L – ₹1Cr");
  const l = await Lead.findOne({ phone }).lean();
  assert.equal(l.budget.max, 20000000, "the lead's own budget is kept");
  assert.deepEqual(l.arthaSuggest.fields.budget, { min: 7900000, max: 10000000 });
  assert.equal(l.arthaSuggest.from.budget, "button_flow");
  assert.match(last(phone), /primary purpose/, "the next question");
  await tap(phone, "p0", "Investment");
  const l2 = await Lead.findOne({ phone }).lean();
  assert.equal(l2.arthaSuggest.fields.purpose, undefined, "same as the lead (Invest): nothing to suggest");
  await tap(phone, "t0", "Within 30 Days");
  const l3 = await Lead.findOne({ phone }).lean();
  assert.equal(l3.timeline, "3 - 6 Months");
  assert.ok(l3.arthaSuggest.fields.timeline, "timeline offered too");
  assert.match(last(phone), /reserve your seat/, "then the closing");
});

test("a lead created minutes ago from this agent's own ad: what it already said is not asked again", async () => {
  const phone = "919811100022";
  await lead(phone, new Date(Date.now() - 10 * 60000), { campaignRef: { adId: AD }, timeline: "", purpose: "N/A" });
  await say(phone, "Hi, I'd like to join the webinar", { referral: { source_id: AD, source_type: "ad", headline: "Webinar" } });
  assert.match(last(phone), /primary purpose/, "budget (from the form) skipped");
});

test("an empty field is simply filled", async () => {
  const phone = "919811100033";
  await lead(phone, new Date(Date.now() - 40 * 86400000), { budget: { min: 0, max: 0 }, timeline: "", purpose: "N/A" });
  await say(phone, "Hi, I'd like to join the webinar", { referral: { source_id: AD, source_type: "ad", headline: "Webinar" } });
  await tap(phone, "b1", "₹79L – ₹1Cr");
  const l = await Lead.findOne({ phone }).lean();
  assert.equal(l.budget.max, 10000000);
  assert.equal(l.arthaSuggest?.fields?.budget, undefined);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  WaAgent = require("../models/WaAgent");
  for (const M of [Lead, WaConversation, WaMessage]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations", "adprefills"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  const questions = [
    { id: "budget", questionText: "To begin, what investment budget are you considering?", mapsTo: "budget",
      options: [{ id: "b0", label: "Below ₹79L" }, { id: "b1", label: "₹79L – ₹1Cr" }, { id: "b2", label: "Above ₹1Cr" }] },
    { id: "purpose", questionText: "And what would be your primary purpose?", mapsTo: "purpose",
      options: [{ id: "p0", label: "Investment" }, { id: "p1", label: "Self Use" }] },
    { id: "timeline", questionText: "Lastly, when would you consider booking?", mapsTo: "timeline",
      options: [{ id: "t0", label: "Within 30 Days" }, { id: "t1", label: "1-3 Months" }] },
  ];
  await WaAgent.collection.insertMany([
    { _id: oid(), orgId: ORG, name: "Artha Assistant", status: "active", isDefault: true, adIds: [], projectIds: [], greetingEnabled: false, createdAt: new Date(Date.now() - 3e6) },
    { _id: oid(), orgId: ORG, name: "SP Webinar", status: "active", adIds: [AD], projectIds: [], greetingEnabled: false, createdAt: new Date(),
      ctwaFlow: { enabled: true, welcomeText: "", qualifyingQuestions: questions, closingPrompt: "Shall I reserve your seat?",
        closingButtons: [{ id: "reserve", label: "Reserve my seat", action: "end" }] } },
  ]);
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Button flows: returning customers on a new ad");
})();
