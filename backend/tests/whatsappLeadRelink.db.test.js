// An existing WhatsApp chat whose lead was deleted, archived or is gone used to
// just continue on a new message: no lead in the CRM, no Vistrow hand-off, no
// AI call (owner's live test, 17 Oct 2026). A chat that never had a lead
// (leadId null) behaves exactly as before: no lead, no hand-off (owner decision). Against a real in-memory MongoDB,
// the real inbound route and the real Vistrow delivery service; only Vistrow
// itself (fetch to api.vistrowvoice.com) and OpenAI (axios.post) are stubbed.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
delete process.env.VISTROW_OUTBOUND_DISABLED;
delete process.env.VISTROW_OUTBOUND_ALLOWED_HOSTS;

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const realFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://api.vistrowvoice.com/")) {
    sent.push({ url: String(url), body: JSON.parse(opts.body) });
    return { status: 200, text: async () => JSON.stringify({ ok: true, queued: false, reason: "test" }), headers: { get: () => null } };
  }
  return realFetch(url, opts);
};
const axios = require("axios");
axios.post = async () => ({ data: { choices: [{ message: { content: "{}" } }], usage: {} } });

let ORG, org, mongod, Lead, WaConversation, wa, outbound;
let seq = 0;
const nextPhone = () => `9198765${String(10000 + ++seq).padStart(5, "0")}`;
const inbound = (phone, msgText) => wa._handleInbound(org, { phone, name: "Ravi", msgId: `wamid.${phone}.${++seq}`, msgText, msgType: "text" });
const settle = async () => { await sleep(30); await outbound.service.drain(); };
const later = (ms) => new Date(Date.now() + ms);
const liveLeads = (phone) => Lead.find({ orgId: ORG, phone, isDeleted: { $ne: true }, isArchived: { $ne: true } }).lean();

// An old chat (history kept, a person turned the bot off) whose lead is gone.
async function oldChat(phone, leadState) {
  const old = await Lead.create({ name: "Ravi Old", phone, source: "WhatsApp", status: "Contacted", orgId: ORG, ...leadState, createdAt: new Date(Date.now() - 30 * 86400e3) });
  const conv = await WaConversation.create({ orgId: ORG, leadId: old._id, contactPhone: phone, contactName: "Ravi Old", waContactId: phone, botEnabled: false, status: "open" });
  await Lead.updateOne({ _id: old._id }, { whatsappConversationId: conv._id });
  return { old, conv };
}

test("(a) existing chat + deleted lead + new message: one new live lead, chat relinked, Vistrow hand-off runs", async () => {
  sent.length = 0;
  const phone = nextPhone();
  const { old, conv } = await oldChat(phone, { isDeleted: true, deletedAt: new Date() });
  await inbound(phone, "Hi, is the Khopoli project still available?");

  const live = await liveLeads(phone);
  assert.equal(live.length, 1, "exactly one live lead");
  const lead = live[0];
  assert.notEqual(String(lead._id), String(old._id));
  assert.equal(lead.source, "WhatsApp");
  assert.equal(String(lead.whatsappConversationId), String(conv._id), "lead points at the chat");
  const c = await WaConversation.findById(conv._id).lean();
  assert.equal(String(c.leadId), String(lead._id), "chat relinked to the new lead");
  assert.equal(await WaConversation.countDocuments({ orgId: ORG, contactPhone: phone }), 1, "the same chat is kept");
  assert.deepEqual([c.botEnabled, c.status], [false, "open"], "bot settings a person chose are untouched");
  assert.ok(lead.activities.some((a) => a.description === "Lead re-created: this number messaged on WhatsApp after its previous lead was deleted"), "activity on the new lead");
  assert.ok(lead.vistrowEmit?.dueAt, "a pending hand-off is stored on the lead");

  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) });
  await settle();
  assert.equal(sent.length, 1, "handed to Vistrow once");
  assert.equal(sent[0].body.lead_id, String(lead._id));
  assert.equal(sent[0].body.event_id, `evt_lc_${lead._id}`);
  assert.equal(sent[0].body.custom_fields.whatsapp_first_message, "Hi, is the Khopoli project still available?");
});

test("(a2) archived lead: same, activity says archived", async () => {
  const phone = nextPhone();
  const { old } = await oldChat(phone, { isArchived: true });
  await inbound(phone, "Hello");
  const live = await liveLeads(phone);
  assert.equal(live.length, 1);
  assert.notEqual(String(live[0]._id), String(old._id));
  assert.ok(live[0].activities.some((a) => /previous lead was archived$/.test(a.description)));
});

test("(b) two messages arriving together: still one lead", async () => {
  const phone = nextPhone();
  await oldChat(phone, { isDeleted: true });
  await Promise.all([inbound(phone, "Hi"), inbound(phone, "Need details please")]);
  assert.equal((await liveLeads(phone)).length, 1, "one live lead");
});

test("(c) existing chat + live lead: no new lead, nothing scheduled", async () => {
  const phone = nextPhone();
  const { old, conv } = await oldChat(phone, {});
  await inbound(phone, "Any update?");
  assert.equal(await Lead.countDocuments({ orgId: ORG, phone }), 1, "no new lead");
  assert.equal(String((await WaConversation.findById(conv._id).lean()).leadId), String(old._id));
  assert.ok(!(await Lead.findById(old._id).lean()).vistrowEmit?.dueAt, "unchanged: no hand-off for a continuing chat");
});

test("(d) deleted lead but another live lead with the same number: relinked to it as a repeat enquiry", async () => {
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) }); // earlier cases' hand-offs
  await settle();
  sent.length = 0;
  const phone = nextPhone();
  const { conv } = await oldChat(phone, { isDeleted: true });
  const other = await Lead.create({ name: "Ravi Facebook", phone, source: "Facebook", status: "Contacted", orgId: ORG });
  await inbound(phone, "Hi again");
  assert.equal((await liveLeads(phone)).length, 1, "no new lead");
  assert.equal(String((await WaConversation.findById(conv._id).lean()).leadId), String(other._id), "chat linked to the live lead");
  const o = await Lead.findById(other._id).lean();
  assert.equal(String(o.whatsappConversationId), String(conv._id));
  assert.ok(o.vistrowEmit?.dueAt && o.vistrowEmit.repeatAt, "repeat enquiry hand-off pending");
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) });
  await settle();
  assert.equal(sent.length, 1);
  assert.ok(sent[0].body.event_id.startsWith(`evt_re_${other._id}_`), sent[0].body.event_id);
});

test("(e) existing chat with no lead (leadId null, e.g. a broadcast recipient replying): no lead, no hand-off", async () => {
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) }); // earlier cases' hand-offs
  await settle();
  sent.length = 0;
  const phone = nextPhone();
  const conv = await WaConversation.create({ orgId: ORG, leadId: null, contactPhone: phone, contactName: "Ravi", waContactId: phone, botEnabled: false, status: "open" });
  await inbound(phone, "Interested, please share details");
  assert.equal(await Lead.countDocuments({ orgId: ORG, phone }), 0, "no lead created");
  assert.equal((await WaConversation.findById(conv._id).lean()).leadId, null, "chat still has no lead");
  await wa._vistrowEmit.sweepDueWhatsAppEmits({ now: later(61e3) });
  await settle();
  assert.equal(sent.length, 0, "nothing handed to Vistrow");
});

// 22 Oct 2026 (owner): a lead moved into a project stays with the project.
test("(f) lead moved into a project: no new lead in Leads; the project lead logs the reply, once per 6 hours", async () => {
  const phone = nextPhone();
  const { old, conv } = await oldChat(phone, { isArchived: true });
  const ProjectLead = require("../models/ProjectLead");
  const projectId = oid();
  await mongoose.connection.collection("projects").insertOne({ _id: projectId, orgId: ORG, name: "Khopoli Plots", assignedTo: [] });
  const pl = await ProjectLead.create({ orgId: ORG, project: projectId, name: "Ravi Old", phone, fromLeadId: old._id, importedBy: oid() });
  await inbound(phone, "Hi, is the 2000 sqft plot still available?");
  assert.equal((await liveLeads(phone)).length, 0, "no second lead in Leads");
  assert.equal(String((await WaConversation.findById(conv._id).lean()).leadId), String(old._id), "the chat stays on the original lead");
  let acts = (await ProjectLead.findById(pl._id).lean()).activities.filter((a) => a.meta?.whatsappReply);
  assert.equal(acts.length, 1);
  assert.match(acts[0].description, /^Replied on WhatsApp: "Hi, is the 2000 sqft plot still available\?"$/);
  await inbound(phone, "Please call me");
  acts = (await ProjectLead.findById(pl._id).lean()).activities.filter((a) => a.meta?.whatsappReply);
  assert.equal(acts.length, 1, "not logged again within 6 hours");
});

test("(g) a re-created lead carries the old lead's details over", async () => {
  const phone = nextPhone();
  const { old } = await oldChat(phone, {
    isDeleted: true, leadSourceLabel: "Facebook Ad · Wellness Capital", purpose: "Invest", timeline: "1-3 Months",
    campaignRef: { adId: "1202", headline: "Wellness Capital" }, budget: { min: 8900000, max: 12500000, currency: "INR" },
    propertyType: "Plot", preferredLocation: "Khopoli", remark1: "Wants corner plot",
    formResponses: [{ fieldKey: "q1", label: "When do you plan to buy?", value: "1-3 months" }],
    notes: [{ text: "Called once, asked for brochure", addedByName: "Sheetal" }],
  });
  await inbound(phone, "Hello again");
  const [lead] = await liveLeads(phone);
  assert.ok(lead && String(lead._id) !== String(old._id), "a new live lead");
  assert.equal(lead.leadSourceLabel, "Facebook Ad · Wellness Capital");
  assert.equal(lead.purpose, "Invest");
  assert.equal(lead.timeline, "1-3 Months");
  assert.equal(lead.campaignRef.adId, "1202");
  assert.equal(lead.budget.max, 12500000);
  assert.equal(lead.propertyType, "Plot");
  assert.equal(lead.preferredLocation, "Khopoli");
  assert.equal(lead.remark1, "Wants corner plot");
  assert.equal(lead.formResponses.length, 1);
  assert.equal(lead.notes[0].text, "Called once, asked for brochure");
  assert.ok(lead.activities.some((a) => String(a.meta?.previousLeadId) === String(old._id)), "linked to the old record");
});

test("(h) purpose buttons in an agent's own words are saved", async () => {
  const { normalizePurpose: n } = require("../utils/formFieldMapper");
  assert.equal(n("Future Villa / Self Use"), "Buy");
  assert.equal(n("Second Home"), "Buy");
  assert.equal(n("Investment"), "Invest");
  assert.equal(n("Rental income"), "Invest");
  assert.equal(n("For rent"), "Rent");
  assert.equal(n("Parent home"), null, "'parent' is not 'rent'");
  assert.equal(n("Just exploring"), null);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  const OutboundDelivery = require("../models/OutboundDelivery");
  const OutboundIntegration = require("../models/OutboundIntegration");
  for (const M of [Lead, WaConversation, WaMessage, OutboundDelivery, OutboundIntegration]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});

  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false, whatsapp: { botEnabled: false } });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  const integ = new OutboundIntegration({
    orgId: ORG, enabled: true, enabledAt: new Date(Date.now() - 3600e3), baseUrl: "https://api.vistrowvoice.com", accountId: "acct_1",
    routing: { whatsapp: { enabled: true, routes: [] } },
  });
  integ.setSecret("s3cr3t-token-value-0123456789");
  await integ.save();

  wa = require("../routes/whatsappRoutes");
  outbound = require("../services/vistrowOutbound");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp chat whose lead was deleted or archived");
})();
