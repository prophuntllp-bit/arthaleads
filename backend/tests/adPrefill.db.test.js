// A WhatsApp chat that arrives from an ad with no ad details is placed by its
// first message: each ad pre-fills its own text, learned from earlier clicks
// (23 Oct 2026: a Khopoli lead typed/sent the Khopoli ad's text, Meta sent no
// ad id, and it went to the general assistant with a blank project).
// Real inbound route; Meta (axios) and OpenAI faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, Lead, WaConversation, WaAgent, AdPrefill, wa, seq = 0;
const AG = {};
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) return { data: { messages: [{ id: `wamid.out.${++seq}` }] } };
  return { data: { choices: [{ message: { content: "Happy to help." } }], usage: {} } };
};
const KHOPOLI_TEXT = "Hi, I’d like details of Shapoorji Pallonji’s new plots near Khopoli.";
const WEBINAR_TEXT = "Hi! I want to register for the FREE webinar on 31 Oct at 12 PM.";
const AD_K1 = "ad_khopoli_1", AD_K2 = "ad_khopoli_2", AD_W = "ad_webinar";

const nextPhone = () => `9198333${String(10000 + ++seq).padStart(5, "0")}`;
const say = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: "~cust", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
const click = (phone, text, adId) => say(phone, text, { referral: { source_id: adId, source_type: "ad", headline: "ad" } });
const convOf = (phone) => WaConversation.findOne({ orgId: ORG, contactPhone: phone }).lean();
const leadOf = (phone) => Lead.findOne({ orgId: ORG, phone }).lean();
const settle = () => new Promise((r) => setTimeout(r, 150)); // labelAdlessLead runs in the background

test("ad clicks teach each ad its pre-filled message, counted per click", async () => {
  await click(nextPhone(), KHOPOLI_TEXT, AD_K1);
  await click(nextPhone(), KHOPOLI_TEXT, AD_K1);
  await click(nextPhone(), "Hello bhaiya ji kya rate hai", AD_K1);
  const rows = await AdPrefill.find({ adId: AD_K1 }).lean();
  assert.equal(rows.find((r) => /khopoli/.test(r.norm)).count, 2);
  assert.equal(rows.find((r) => /bhaiya/.test(r.norm)).count, 1, "a one-off typed message is recorded but not trusted");
});

test("the same text with no ad details reaches that ad's agent, and its buttons start", async () => {
  const phone = nextPhone();
  await say(phone, KHOPOLI_TEXT);
  const c = await convOf(phone);
  assert.equal(String(c.agentId), String(AG.khopoli), "not the general assistant");
  assert.equal(c.flowState?.step, "purpose", "the Khopoli button flow started");
  await settle();
  const lead = await leadOf(phone);
  assert.equal(lead.leadSourceLabel, "Facebook Ad · Shapoorji Pallonji Khopoli Plots");
  assert.ok(lead.notes.some((n) => /pre-filled message of our ad ad_khopoli_1 \(Shapoorji Pallonji Khopoli Plots\)/.test(n.text)), "the note says which ad");
});

test("small changes still match; a one-off message or a long question does not", async () => {
  const typo = nextPhone();
  await say(typo, "MmHi, I’d like details of Shapoorji Pallonji’s new plots near Khopoli. Location");
  assert.equal(String((await convOf(typo)).agentId), String(AG.khopoli));
  const once = nextPhone();
  await say(once, "Hello bhaiya ji kya rate hai");
  assert.equal(String((await convOf(once)).agentId), String(AG.general), "seen only once: not trusted");
  const q = nextPhone();
  await say(q, "Can you tell me if the new plots near Khopoli by Shapoorji Pallonji have a clubhouse, a pool and what the maintenance charges per month would be for a plot owner?");
  assert.equal(String((await convOf(q)).agentId), String(AG.general));
});

test("a message naming a project two agents share keeps its project, even with no agent", async () => {
  const phone = nextPhone();
  await say(phone, "Is anything still available near Khopoli?");
  assert.equal(String((await convOf(phone)).agentId), String(AG.general));
  await settle();
  assert.equal((await leadOf(phone)).leadSourceLabel, "WhatsApp enquiry · Shapoorji Pallonji Khopoli Plots", "was blank before");
});

test("an existing chat typing the webinar ad's message moves to the webinar agent (test number saved without 91)", async () => {
  await click(nextPhone(), WEBINAR_TEXT, AD_W);
  await click(nextPhone(), WEBINAR_TEXT, AD_W);
  const phone = "917020950304";
  await say(phone, "Hi");
  assert.equal(String((await convOf(phone)).agentId), String(AG.general));
  await say(phone, WEBINAR_TEXT);
  const c = await convOf(phone);
  assert.equal(String(c.agentId), String(AG.webinar));
  assert.equal(c.flowState?.step, "purpose", "its buttons start for the test number");
});

test("an existing chat asking a short common question stays where it is", async () => {
  await click(nextPhone(), "What is the payment plan?", AD_K1);
  await click(nextPhone(), "What is the payment plan?", AD_K1);
  const phone = nextPhone();
  await say(phone, "Hello, I have a question");
  await say(phone, "What is the payment plan?");
  assert.equal(String((await convOf(phone)).agentId), String(AG.general), "a short question is not an ad click");
});

test("two agents' ads with the same text: nobody is guessed", async () => {
  await WaAgent.updateOne({ _id: AG.webinar }, { $push: { adIds: AD_K2 } });
  await click(nextPhone(), KHOPOLI_TEXT, AD_K2);
  await click(nextPhone(), KHOPOLI_TEXT, AD_K2);
  const phone = nextPhone();
  await say(phone, KHOPOLI_TEXT);
  assert.equal(String((await convOf(phone)).agentId), String(AG.general));
  await WaAgent.updateOne({ _id: AG.webinar }, { $pull: { adIds: AD_K2 } });
});

test("saving: test numbers get their 91; a hand-added ad message works at once", async () => {
  const base = { enabled: true, qualifyingQuestions: [{ id: "q", questionText: "Q?", mapsTo: "none", options: [{ id: "a", label: "A" }] }] };
  assert.deepEqual(wa._sanitizeCtwaFlow({ ...base, testPhones: ["70209 50304", "08080197945", "917020950304"] }).testPhones, ["917020950304", "918080197945"]);
  const adPrefill = require("../utils/adPrefill");
  await adPrefill.addManual(ORG, AD_W, "Book my free seat for the plot owners webinar please");
  const phone = nextPhone();
  await say(phone, "Book my free seat for the plot owners webinar please");
  assert.equal(String((await convOf(phone)).agentId), String(AG.webinar));
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  WaAgent = require("../models/WaAgent");
  AdPrefill = require("../models/AdPrefill");
  for (const M of [Lead, WaConversation, WaMessage, AdPrefill]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  const K = oid();
  await mongoose.connection.collection("projects").insertOne({ _id: K, orgId: ORG, name: "Shapoorji Pallonji Khopoli Plots", location: "Near Khopoli, Maharashtra" });
  const question = [{ id: "purpose", questionText: "Investment or self use?", mapsTo: "purpose", options: [{ id: "inv", label: "Investment", action: "none", next: "" }, { id: "self", label: "Self Use", action: "none", next: "" }] }];
  AG.general = oid(); AG.khopoli = oid(); AG.webinar = oid();
  await WaAgent.collection.insertMany([
    { _id: AG.general, orgId: ORG, name: "Artha Assistant", status: "active", isDefault: true, adIds: [], projectIds: [], greetingEnabled: false, createdAt: new Date(Date.now() - 3e6) },
    { _id: AG.khopoli, orgId: ORG, name: "Khopoli Project Advisor", status: "active", adIds: [AD_K1], projectIds: [K], greetingEnabled: false, createdAt: new Date(Date.now() - 2e6),
      ctwaFlow: { enabled: true, welcomeText: "", qualifyingQuestions: question } },
    { _id: AG.webinar, orgId: ORG, name: "SP Webinar", status: "active", adIds: [AD_W], projectIds: [K], greetingEnabled: false, createdAt: new Date(Date.now() - 1e6),
      ctwaFlow: { enabled: true, welcomeText: "", qualifyingQuestions: question, testPhones: ["7020950304"] } },
  ]);
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp: chats placed by the ad's pre-filled message");
})();
