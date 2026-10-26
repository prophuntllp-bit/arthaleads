// A click from a WhatsApp Status placement arrives headlined "Status ad"
// (26 Oct 2026: a webinar lead showed as "Facebook Ad · Status ad"). The lead
// gets the ad's real name from other clicks on the same ad id, and earlier
// "Status ad" leads are renamed when the real name arrives. Real inbound route.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, Lead, WaConversation, wa, seq = 0;
axios.post = async (url) => {
  if (String(url).startsWith("https://graph.facebook.com/")) return { data: { messages: [{ id: `wamid.out.${++seq}` }] } };
  return { data: { choices: [{ message: { content: "Hello!" } }], usage: {} } };
};
const nextPhone = () => `9198333${String(10000 + ++seq).padStart(5, "0")}`;
const click = (phone, adId, headline) => wa._handleInbound(org, {
  phone, name: "Asha", msgId: `wamid.in.${phone}.${++seq}`, msgText: "Hi! I want to register for the FREE webinar", msgType: "text",
  referral: { source_id: adId, headline, source_type: "ad" },
});
const leadOf = (phone) => Lead.findOne({ orgId: ORG, phone }).lean();
const convOf = (phone) => WaConversation.findOne({ orgId: ORG, contactPhone: phone }).lean();

test("a Status click on an ad already known by name gets that name", async () => {
  await click(nextPhone(), "ad_web", "FREE Shapoorji Pallonji Webinar");
  const phone = nextPhone();
  await click(phone, "ad_web", "Status ad");
  const lead = await leadOf(phone);
  assert.equal(lead.leadSourceLabel, "Facebook Ad · FREE Shapoorji Pallonji Webinar (Status Ad)");
  assert.equal(lead.campaignRef.headline, "FREE Shapoorji Pallonji Webinar");
  assert.equal(lead.campaignRef.adId, "ad_web");
  assert.equal((await convOf(phone)).campaignRef.headline, "FREE Shapoorji Pallonji Webinar");
  assert.equal(lead.campaignRef.viaStatus, undefined, "the marker is not stored");
  const normal = nextPhone();
  await click(normal, "ad_web", "FREE Shapoorji Pallonji Webinar");
  assert.equal((await leadOf(normal)).leadSourceLabel, "Facebook Ad · FREE Shapoorji Pallonji Webinar", "a normal click has no (Status Ad)");
});

test("a Status click first stays 'Status ad', then is renamed when the real name arrives", async () => {
  const early = nextPhone();
  await click(early, "ad_new", "Status ad");
  assert.equal((await leadOf(early)).leadSourceLabel, "Facebook Ad · Status ad", "nothing to go by yet");
  await click(nextPhone(), "ad_new", "1 BHK from 45L");
  await new Promise((r) => setTimeout(r, 200)); // the rename runs in the background
  const lead = await leadOf(early);
  assert.equal(lead.leadSourceLabel, "Facebook Ad · 1 BHK from 45L (Status Ad)");
  assert.equal(lead.campaignRef.headline, "1 BHK from 45L");
  const c = await convOf(early);
  assert.equal(c.campaignRef.headline, "1 BHK from 45L");
  assert.ok(c.campaignHistory.every((h) => h.headline !== "Status ad"));
});

test("only that ad's 'Status ad' leads are renamed; a lead the team relabelled keeps its label", async () => {
  const other = nextPhone();
  await click(other, "ad_other", "Status ad");
  const custom = nextPhone();
  await click(custom, "ad_three", "Status ad");
  await Lead.updateOne({ orgId: ORG, phone: custom }, { $set: { leadSourceLabel: "Walk-in referral" } });
  await click(nextPhone(), "ad_three", "Plots near Khopoli");
  await new Promise((r) => setTimeout(r, 200));
  assert.equal((await leadOf(other)).leadSourceLabel, "Facebook Ad · Status ad", "a different ad is untouched");
  const c = await leadOf(custom);
  assert.equal(c.leadSourceLabel, "Walk-in referral");
  assert.equal(c.campaignRef.headline, "Plots near Khopoli", "the ad's name is still corrected");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");
  for (const M of [Lead, WaConversation, WaMessage]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: false },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Status ad clicks get the ad's real name");
})();
