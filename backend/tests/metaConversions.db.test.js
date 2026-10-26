// Meta Conversions API (26 Oct 2026). Click-to-WhatsApp leads go through the
// Business Messaging API, which accepts only Meta's own event names, so they
// get LeadSubmitted / QualifiedLead / Purchase while lead-form leads keep the
// names the company set. A WhatsApp ad lead who asks for a site visit or an
// advisor, or registers, in the button flow is reported as QualifiedLead, once.
// Real inbound route and flow service; Meta (fetch + axios) faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
process.env.CRYPTO_KEY = process.env.CRYPTO_KEY || "a".repeat(64);
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, Lead, capi, wa, seq = 0;
const sent = []; // every event posted to the Conversions API
global.fetch = async (url, opts) => {
  if (String(url).includes("/events?")) for (const e of JSON.parse(opts.body).data) sent.push(e);
  return { ok: true, json: async () => ({ events_received: 1, fbtrace_id: "t" }) };
};
axios.post = async (url) => {
  if (String(url).startsWith("https://graph.facebook.com/")) return { data: { messages: [{ id: `wamid.out.${++seq}` }] } };
  return { data: { choices: [{ message: { content: "Hello!" } }], usage: {} } };
};
const AD = "ad_flow_1";
const nextPhone = () => `9198444${String(10000 + ++seq).padStart(5, "0")}`;
const settle = () => new Promise((r) => setTimeout(r, 150));

async function makeLead(extra) {
  const l = await Lead.create({ orgId: ORG, name: "Asha", phone: nextPhone(), source: "WhatsApp", status: "New", ...extra });
  return l.toObject();
}
const ctwa = () => makeLead({ campaignRef: { adId: "ad1", headline: "Ad", ctwaClid: `clid${++seq}` } });
const form = () => makeLead({ source: "Facebook", metaLeadId: `lead${++seq}`, email: "asha@example.com" });
const names = async (leadId) => (await mongoose.connection.collection("metaevents").find({ leadId }).sort({ createdAt: 1 }).toArray()).map((e) => e.eventName);

test("event names: WhatsApp leads get Meta's business-messaging names; lead forms keep theirs", () => {
  assert.equal(capi.eventNameFor("whatsapp_ctwa", "Lead"), "LeadSubmitted");
  assert.equal(capi.eventNameFor("whatsapp_ctwa", "Schedule"), "QualifiedLead");
  assert.equal(capi.eventNameFor("whatsapp_ctwa", "Purchase"), "Purchase");
  assert.equal(capi.eventNameFor("whatsapp_ctwa", "Contacted"), null, "no WhatsApp equivalent: not sent");
  assert.equal(capi.eventNameFor("lead_ads", "Lead"), "Lead");
  assert.equal(capi.eventNameFor("lead_ads", "Contacted"), "Contacted");
});

test("a WhatsApp ad lead arriving is sent as LeadSubmitted over business messaging", async () => {
  const l = await ctwa();
  const before = sent.length;
  await capi.track(l, "New");
  const e = sent.slice(before);
  assert.equal(e.length, 1);
  assert.equal(e[0].event_name, "LeadSubmitted");
  assert.equal(e[0].action_source, "business_messaging");
  assert.equal(e[0].messaging_channel, "whatsapp");
  assert.equal(e[0].user_data.ctwa_clid, l.campaignRef.ctwaClid);
  assert.equal(e[0].user_data.whatsapp_business_account_id, "waba_1");
});

test("a lead-form lead keeps 'Lead' and the CRM-event fields", async () => {
  const l = await form();
  const before = sent.length;
  await capi.track(l, "New");
  const e = sent.slice(before)[0];
  assert.equal(e.event_name, "Lead");
  assert.equal(e.action_source, "system_generated");
  assert.equal(e.user_data.lead_id, l.metaLeadId);
});

test("a stage with no WhatsApp name (Contacted) goes for lead forms only", async () => {
  const w = await ctwa(), f = await form();
  await capi.track(w, "Contacted");
  await capi.track(f, "Contacted");
  assert.deepEqual(await names(w._id), []);
  assert.deepEqual(await names(f._id), ["Contacted"]);
});

test("chat QualifiedLead, then Site Visit: reported once; Closed Won is Purchase", async () => {
  const l = await ctwa();
  await capi.trackChatQualified(l);
  await capi.track(l, "Site Visit");
  await capi.track(l, "Closed Won");
  assert.deepEqual(await names(l._id), ["QualifiedLead", "Purchase"]);
  const ev = await mongoose.connection.collection("metaevents").findOne({ leadId: l._id, eventName: "QualifiedLead" });
  assert.equal(ev.stage, "Qualified on WhatsApp");
  assert.equal(ev.status, "sent");
});

test("chat QualifiedLead is only for WhatsApp ad leads, and can be switched off", async () => {
  const f = await form();
  await capi.trackChatQualified(f);
  assert.deepEqual(await names(f._id), []);
  await mongoose.connection.collection("organizations").updateOne({ _id: ORG }, { $set: { "metaCapi.whatsappQualified": false } });
  const w = await ctwa();
  await capi.trackChatQualified(w);
  await mongoose.connection.collection("organizations").updateOne({ _id: ORG }, { $set: { "metaCapi.whatsappQualified": true } });
  assert.deepEqual(await names(w._id), []);
});

test("in the real flow: tapping Talk to Advisor reports QualifiedLead; 'Not now' does not", async () => {
  const say = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: "Ravi", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
  const tap = (phone, id, title) => say(phone, title, { msgType: "interactive", interactiveId: id });
  const yes = nextPhone();
  await say(yes, "Hi, I want details", { referral: { source_id: AD, headline: "Plots", ctwa_clid: "clid_yes" } });
  await tap(yes, "inv", "Investment");
  await tap(yes, "advisor", "Talk to Advisor");
  await settle();
  const ly = await Lead.findOne({ orgId: ORG, phone: yes }).lean();
  assert.equal(ly.engagement.closing, "handoff");
  assert.ok((await names(ly._id)).includes("QualifiedLead"));

  const no = nextPhone();
  await say(no, "Hi, I want details", { referral: { source_id: AD, headline: "Plots", ctwa_clid: "clid_no" } });
  await tap(no, "inv", "Investment");
  await tap(no, "later", "Not now");
  await settle();
  const ln = await Lead.findOne({ orgId: ORG, phone: no }).lean();
  assert.ok(!(await names(ln._id)).includes("QualifiedLead"));
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  const WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  const MetaEvent = require("../models/MetaEvent");
  const WaAgent = require("../models/WaAgent");
  for (const M of [Lead, WaConversation, WaMessage, MetaEvent]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});
  capi = require("../services/metaConversions");
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true, wabaId: "waba_1" },
    metaCapi: {
      enabled: true, datasetId: "123456789012345", accessToken: capi.encryptField("EAAtesttokentesttokentesttoken"),
      events: [
        { stage: "New", eventName: "Lead", enabled: true },
        { stage: "Contacted", eventName: "Contacted", enabled: true },
        { stage: "Site Visit", eventName: "Schedule", enabled: true },
        { stage: "Closed Won", eventName: "Purchase", enabled: true },
      ],
    },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  const question = [{ id: "purpose", questionText: "Investment or self use?", mapsTo: "purpose", options: [{ id: "inv", label: "Investment", action: "none", next: "" }, { id: "self", label: "Self Use", action: "none", next: "" }] }];
  await WaAgent.collection.insertOne({
    _id: oid(), orgId: ORG, name: "Plots Desk", status: "active", isDefault: true, adIds: [AD], greetingEnabled: false, createdAt: new Date(),
    ctwaFlow: { enabled: true, welcomeText: "", qualifyingQuestions: question,
      closingButtons: [{ id: "advisor", label: "Talk to Advisor", action: "handoff" }, { id: "later", label: "Not now", action: "end" }] },
  });
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Meta Conversions API: WhatsApp names and chat QualifiedLead");
})();
