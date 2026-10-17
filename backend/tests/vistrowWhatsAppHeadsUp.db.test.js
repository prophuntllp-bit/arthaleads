// Owner decision 17 Oct 2026: when Vistrow Voice queues the first automatic
// call for a WhatsApp lead, the WhatsApp assistant tells the customer a call is
// coming. Real in-memory MongoDB, the real delivery service and the real
// WhatsApp send path; only Vistrow (fetch to api.vistrowvoice.com) and the
// Meta Graph API (axios.post) are stubbed.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
delete process.env.VISTROW_OUTBOUND_DISABLED;
delete process.env.VISTROW_OUTBOUND_ALLOWED_HOSTS;

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AD = "120252242040050299";
const SOON = "Dhanyavaad! 🙏 Hamari property advisor aapko lagbhag 1 minute mein call karengi, taaki aapki requirement achhe se samajh sakein.";

// ── Stubs ───────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
let vistrowReply = () => ({ status: 200, json: { ok: true, queued: true } });
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://api.vistrowvoice.com/")) {
    const r = vistrowReply();
    return { status: r.status, text: async () => JSON.stringify(r.json), headers: { get: () => null } };
  }
  return realFetch(url, opts);
};
const axios = require("axios");
const metaSends = [];
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) {
    metaSends.push({ url: String(url), body });
    return { data: { messages: [{ id: `wamid.out.${metaSends.length}` }] } };
  }
  return { data: { choices: [{ message: { content: "{}" } }], usage: {} } };
};

let ORG, Lead, WaConversation, WaMessage, OutboundDelivery, OutboundIntegration, outbound;
let seq = 0;
const nextPhone = () => `9198124${String(40000 + ++seq).padStart(5, "0")}`;
const settle = async () => { await sleep(30); await outbound.service.drain(); await sleep(30); await outbound.service.drain(); };
const textsTo = (phone) => metaSends.filter((s) => s.body?.to === phone).map((s) => s.body.text?.body);

async function waLead({ inboundAgoMs = 60 * 1000, source = "WhatsApp" } = {}) {
  const phone = nextPhone();
  const lead = await Lead.create({
    name: "Kiran Shah", phone, source, orgId: ORG, status: "New", propertyType: "N/A", purpose: "N/A", bhk: "N/A",
    campaignRef: { adId: AD, headline: "Launch" },
  });
  const conv = await WaConversation.create({ orgId: ORG, leadId: lead._id, contactPhone: phone, botEnabled: true, status: "bot", campaignRef: { adId: AD } });
  if (inboundAgoMs !== null) {
    await WaMessage.create({ orgId: ORG, conversationId: conv._id, waMsgId: `wamid.in.${phone}`, direction: "inbound", sender: "customer", body: "Hi, details please", status: "delivered", timestamp: new Date(Date.now() - inboundAgoMs) });
  }
  return { lead, conv, phone };
}
const emit = (lead, ctx) => require("../utils/emitLeadCreated").emitLeadCreated(lead.toObject ? lead.toObject() : lead, { routeSource: "whatsapp", attribution: { ad_id: AD }, ...ctx });

test("(a) queued:true for a WhatsApp lead with a recent message: one 1-minute heads-up, stored on the chat", async () => {
  const { lead, conv, phone } = await waLead();
  await emit(lead, { origin: "whatsapp-ctwa" });
  await settle();
  assert.deepEqual(textsTo(phone), [SOON]);
  const out = await WaMessage.find({ conversationId: conv._id, direction: "outbound" }).lean();
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].sender, out[0].body, out[0].waMsgId], ["bot", SOON, out[0].waMsgId]);
  assert.ok(out[0].waMsgId, "Meta message id stored");
  const c = await WaConversation.findById(conv._id).lean();
  assert.equal(c.lastMessagePreview, SOON.slice(0, 80));
  assert.equal(c.botPausedReason, "vistrow_call", "the bot pause still happens");
  const d = await OutboundDelivery.findOne({ leadId: lead._id }).lean();
  assert.ok(d.waHeadsUpAt, "marker stored on the delivery");
});

test("(b) a re-sent queued answer for the same delivery does not send again", async () => {
  const { lead, conv, phone } = await waLead();
  await emit(lead, { origin: "whatsapp-inbound" });
  await settle();
  assert.equal(textsTo(phone).length, 1);
  const d = await OutboundDelivery.findOne({ leadId: lead._id }).lean();
  // Vistrow answers queued:true again for the same delivery (a retried send).
  await OutboundDelivery.updateOne({ _id: d._id }, { $set: { status: "pending", nextAttemptAt: new Date(Date.now() - 1000) }, $unset: { terminalAt: "" } });
  await outbound.service.processById(d._id);
  await settle();
  assert.equal((await OutboundDelivery.findById(d._id).lean()).status, "delivered", "the re-send really happened");
  assert.equal(textsTo(phone).length, 1, "still one heads-up");
  assert.equal(await WaMessage.countDocuments({ conversationId: conv._id, direction: "outbound" }), 1);
});

test("(c) no customer message in the last 24 hours: nothing sent", async () => {
  const { lead, conv, phone } = await waLead({ inboundAgoMs: 25 * 3600e3 });
  await emit(lead, { origin: "whatsapp-ctwa" });
  await settle();
  assert.equal(textsTo(phone).length, 0);
  assert.equal(await WaMessage.countDocuments({ conversationId: conv._id, direction: "outbound" }), 0);
  assert.equal((await WaConversation.findById(conv._id).lean()).botPausedReason, "vistrow_call", "pause unaffected");
});

test("(d) a non-WhatsApp lead, or a person's \"Call now\" (manual-call): nothing sent", async () => {
  const web = await waLead({ source: "Website" });
  await Lead.updateOne({ _id: web.lead._id }, { $set: { sourcePage: "https://x.com/khopoli-page/" } });
  await emit(await Lead.findById(web.lead._id).lean(), { origin: "webhook-website", routeSource: "website", attribution: undefined });
  const manual = await waLead();
  const r = await emit(manual.lead, { origin: "manual-call", callRequest: true, submittedAt: new Date() });
  assert.equal(r.queued, true, JSON.stringify(r));
  await settle();
  const md = await OutboundDelivery.findOne({ leadId: manual.lead._id }).lean();
  assert.deepEqual([md.origin, md.status, md.callQueued], ["manual-call", "delivered", true], "the manual call was queued");
  assert.equal(textsTo(web.phone).length + textsTo(manual.phone).length, 0);
});

test("(e) queued_until 3 hours away: the later-time text in IST", async () => {
  const at = new Date(Date.now() + 3 * 3600e3);
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: true, queued_until: at.toISOString() } });
  const { lead, phone } = await waLead();
  await emit(lead, { origin: "whatsapp-ctwa" });
  await settle();
  vistrowReply = () => ({ status: 200, json: { ok: true, queued: true } });
  const texts = textsTo(phone);
  assert.equal(texts.length, 1);
  const hhmm = at.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  assert.ok(texts[0].startsWith("Dhanyavaad! 🙏 Hamari property advisor aapko ") && texts[0].endsWith(`${hhmm} call karengi.`), texts[0]);
  assert.ok(!/1 minute/.test(texts[0]) && !/\d{10}/.test(texts[0]), texts[0]);
});

test("headsUpText: due now / missing / past is the 1-minute text; later days are named", () => {
  const { headsUpText } = require("../utils/vistrowWhatsAppHeadsUp");
  const now = new Date("2026-10-17T06:00:00Z"); // 11:30 am IST
  assert.equal(headsUpText(null, now), SOON);
  assert.equal(headsUpText(new Date(now.getTime() - 60e3), now), SOON);
  assert.equal(headsUpText(new Date(now.getTime() + 100e3), now), SOON);
  assert.equal(headsUpText(new Date("2026-10-18T04:30:00Z"), now), "Dhanyavaad! 🙏 Hamari property advisor aapko kal 10:00 am call karengi.");
  assert.equal(headsUpText(new Date("2026-10-19T04:30:00Z"), now), "Dhanyavaad! 🙏 Hamari property advisor aapko 19 Oct, 10:00 am call karengi.");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  WaMessage = require("../models/WaMessage");
  OutboundDelivery = require("../models/OutboundDelivery");
  OutboundIntegration = require("../models/OutboundIntegration");
  for (const M of [Lead, WaConversation, WaMessage, OutboundDelivery, OutboundIntegration]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});

  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  const integ = new OutboundIntegration({
    orgId: ORG, enabled: true, enabledAt: new Date(Date.now() - 3600e3), baseUrl: "https://api.vistrowvoice.com", accountId: "acct_1",
    routing: {
      website: { enabled: true, routes: [{ matchKind: "url_contains", matchValue: "/khopoli-page/", agentId: "agent_web" }] },
      whatsapp: { enabled: true, routes: [{ matchKind: "ad_id", matchValue: AD, agentId: "agent_ad" }] },
    },
    dedupeWindowHours: 0,
  });
  integ.setSecret("s3cr3t-token-value-0123456789");
  await integ.save();

  require("../routes/whatsappRoutes");
  outbound = require("../services/vistrowOutbound");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow Voice: WhatsApp heads-up before the AI call (17 Oct 2026)");
})();
