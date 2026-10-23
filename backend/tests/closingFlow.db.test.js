// The closing step of a button flow, built per agent (23 Oct 2026: a webinar
// ad needed "reserve my seat" instead of the fixed Talk to Advisor / Book Site
// Visit). Real inbound route and flow service; Meta (axios) and OpenAI faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, Lead, WaConversation, WaAgent, EventReminder, wa, seq = 0;
const metaSends = [];
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) { metaSends.push(body); return { data: { messages: [{ id: `wamid.out.${metaSends.length}` }] } }; }
  return { data: { choices: [{ message: { content: "It starts at 11 AM." } }], usage: {} } };
};
const AD_LEGACY = "ad_legacy_1", AD_WEBINAR = "ad_webinar_1";
const START = new Date(Date.now() + 2 * 86400000); // the webinar, in two days
const LINK = "https://meet.example.com/sp-webinar";

const nextPhone = () => `9198222${String(10000 + ++seq).padStart(5, "0")}`;
const say = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: "~rs", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
const tap = (phone, id, title) => say(phone, title, { msgType: "interactive", interactiveId: id });
const toPhone = (phone) => metaSends.filter((m) => m.to === phone);
const last = (phone) => { const m = toPhone(phone).slice(-1)[0]; return m?.interactive?.body?.text || m?.text?.body || ""; };
const convOf = (phone) => WaConversation.findOne({ orgId: ORG, contactPhone: phone }).lean();
const leadOf = (phone) => Lead.findOne({ orgId: ORG, phone }).lean();

async function start(ad) {
  const phone = nextPhone();
  await say(phone, "Hi, I want to join", { referral: { source_id: ad, headline: "ad" } });
  await tap(phone, "inv", "Investment"); // the one question
  return phone;
}

test("an agent saved before custom closings still offers and does exactly what it did", async () => {
  const phone = await start(AD_LEGACY);
  const closing = toPhone(phone).slice(-1)[0];
  assert.deepEqual(closing.interactive.action.buttons.map((b) => b.reply.title), ["Talk to Advisor", "Book Site Visit"]);
  await tap(phone, "advisor", "Talk to Advisor");
  assert.match(last(phone), /^Connecting you with our team/);
  assert.equal((await convOf(phone)).status, "open", "handed to the team, as before");
});

test("the webinar closing: its own question and buttons", async () => {
  const phone = await start(AD_WEBINAR);
  const closing = toPhone(phone).slice(-1)[0];
  assert.match(closing.interactive.body.text, /reserve your seat for the SP Pallonji Webinar/);
  assert.deepEqual(closing.interactive.action.buttons.map((b) => b.reply.title), ["Reserve my seat", "Not now"]);
});

test("'Reserve my seat': asks the name, saves it, tags, confirms, schedules the link 30 minutes before", async () => {
  const phone = await start(AD_WEBINAR);
  await tap(phone, "reserve", "Reserve my seat");
  assert.equal(last(phone), "May I have your full name for the registration?");
  assert.equal((await convOf(phone)).flowState.step, "__ask__:reserve");
  await say(phone, "Rahul Sharma");
  const lead = await leadOf(phone);
  assert.equal(lead.name, "Rahul Sharma", "the typed name is the lead's name now");
  assert.ok(lead.tags.includes("Webinar 31 Oct"));
  assert.ok(lead.activities.some((a) => /Chose "Reserve my seat"/.test(a.description)));
  assert.match(last(phone), /^Thanks Rahul, your seat is reserved for SP Pallonji Webinar on \d+ \w+, \d+:\d\d (AM|PM)\./);
  const c = await convOf(phone);
  assert.ok(!c.flowState?.step, "flow ended");
  assert.equal(c.botEnabled, true, "the assistant stays on for questions");
  const r = await EventReminder.findOne({ conversationId: c._id }).lean();
  assert.equal(r.status, "pending");
  assert.equal(+r.sendAt, +START - 30 * 60000);
});

test("at reminder time inside the 24-hour window: the link goes as a normal message", async () => {
  const phone = await start(AD_WEBINAR);
  await tap(phone, "reserve", "Reserve my seat");
  await say(phone, "Priya");
  const c = await convOf(phone);
  const r = await EventReminder.findOne({ conversationId: c._id }).lean();
  const at = new Date(+r.sendAt + 1000);
  // The customer wrote an hour before the reminder.
  await mongoose.connection.collection("wamessages").insertOne({ _id: oid(), orgId: ORG, conversationId: c._id, direction: "inbound", sender: "customer", body: "ok", status: "delivered", timestamp: new Date(+at - 3600000) });
  await wa.runEventReminders(at);
  assert.equal(last(phone), `Hi Priya, the webinar starts in 30 minutes. Join here: ${LINK}`);
  const done = await EventReminder.findById(r._id).lean();
  assert.equal(done.status, "sent"); assert.equal(done.via, "text");
  await wa.runEventReminders(at);
  assert.equal(toPhone(phone).filter((m) => /Join here/.test(m.text?.body || "")).length, 1, "never twice");
});

test("outside the 24-hour window: the chosen template, with the name and link filled in", async () => {
  const phone = await start(AD_WEBINAR);
  await tap(phone, "reserve", "Reserve my seat");
  await say(phone, "Anil Kumar");
  const c = await convOf(phone);
  const r = await EventReminder.findOne({ conversationId: c._id }).lean();
  await wa.runEventReminders(new Date(+r.sendAt + 1000)); // two days after their last message
  const m = toPhone(phone).slice(-1)[0];
  assert.equal(m.type, "template");
  assert.equal(m.template.name, "webinar_link");
  assert.deepEqual(m.template.components[0].parameters.map((p) => p.text), ["Anil", LINK]);
  assert.equal((await EventReminder.findById(r._id).lean()).via, "template");
});

test("'Not now': its own polite reply, its tag, no alert, the assistant stays on", async () => {
  const phone = await start(AD_WEBINAR);
  await tap(phone, "later", "Not now");
  assert.equal(last(phone), "No problem! Message us here anytime if you change your mind.");
  const lead = await leadOf(phone);
  assert.ok(lead.tags.includes("Webinar not now"));
  const c = await convOf(phone);
  assert.equal(c.botEnabled, true);
  assert.ok(!c.flowState?.step);
  assert.equal(await EventReminder.countDocuments({ conversationId: c._id }), 0);
});

test("typing 'not now' at the closing works like the tap", async () => {
  const phone = await start(AD_WEBINAR);
  await say(phone, "Not now");
  assert.ok((await leadOf(phone)).tags.includes("Webinar not now"));
});

test("a question while asked for the name: answered, then the name asked again", async () => {
  const phone = await start(AD_WEBINAR);
  await tap(phone, "reserve", "Reserve my seat");
  await say(phone, "What time does it start?");
  assert.equal(last(phone), "Coming back to my earlier question:\n\nMay I have your full name for the registration?");
  await say(phone, "Meera Joshi");
  assert.equal((await leadOf(phone)).name, "Meera Joshi");
});

test("saving: a register button without the event's date is refused; old-style buttons keep their meaning", async () => {
  const base = { enabled: true, qualifyingQuestions: [{ id: "q", questionText: "Q?", mapsTo: "none", options: [{ id: "a", label: "A" }] }] };
  assert.throws(() => wa._sanitizeCtwaFlow({ ...base, closingButtons: [{ id: "r", label: "Register", action: "register" }] }), /event's name and date/);
  const clean = wa._sanitizeCtwaFlow({ ...base, closingButtons: [{ id: "advisor", label: "Talk to Advisor" }, { id: "x", label: "Hack", action: "drop_db" }] });
  assert.deepEqual(clean.closingButtons.map((b) => [b.id, b.action]), [["advisor", "handoff"]]);
  const four = wa._sanitizeCtwaFlow({ ...base, closingButtons: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, label: `B${i}`, action: "end" })) });
  assert.equal(four.closingButtons.length, 3, "WhatsApp allows three reply buttons");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  WaAgent = require("../models/WaAgent");
  EventReminder = require("../models/EventReminder");
  for (const M of [Lead, WaConversation, WaMessage, EventReminder]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  const question = [{ id: "purpose", questionText: "Investment or self use?", mapsTo: "purpose", options: [{ id: "inv", label: "Investment", action: "none", next: "" }, { id: "self", label: "Self Use", action: "none", next: "" }] }];
  await WaAgent.collection.insertMany([
    { _id: oid(), orgId: ORG, name: "Old Agent", status: "active", isDefault: true, adIds: [AD_LEGACY], greetingEnabled: false, createdAt: new Date(),
      ctwaFlow: { enabled: true, welcomeText: "", qualifyingQuestions: question, closingButtons: [{ id: "advisor", label: "Talk to Advisor" }, { id: "site_visit", label: "Book Site Visit" }] } },
    { _id: oid(), orgId: ORG, name: "Webinar Desk", status: "active", adIds: [AD_WEBINAR], greetingEnabled: false, createdAt: new Date(),
      ctwaFlow: {
        enabled: true, welcomeText: "", qualifyingQuestions: question,
        closingPrompt: "Shall I reserve your seat for the {{event}} on {{time}}?",
        closingButtons: [
          { id: "reserve", label: "Reserve my seat", action: "register", tag: "Webinar 31 Oct", notify: true,
            reply: "Thanks {{name}}, your seat is reserved for {{event}} on {{time}}. We'll send the joining link here {{minutes}} minutes before it starts.",
            askText: { prompt: "May I have your full name for the registration?", saveTo: "name" } },
          { id: "later", label: "Not now", action: "end", tag: "Webinar not now", notify: false, reply: "No problem! Message us here anytime if you change your mind." },
        ],
        event: { title: "SP Pallonji Webinar", startsAt: START, link: LINK, reminderMinutes: 30,
          reminderText: "Hi {{name}}, the webinar starts in {{minutes}} minutes. Join here: {{link}}",
          templateName: "webinar_link", templateLanguage: "en", templateVars: ["name", "link"] },
      } },
  ]);
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Button flows: closing step built per agent");
})();
