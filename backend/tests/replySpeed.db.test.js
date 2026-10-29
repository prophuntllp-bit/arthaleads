// Faster bot replies (owner, 23 Oct 2026: 7 to 8 seconds per reply).
//  * "typing..." (and a read receipt) the moment a message the bot answers arrives;
//  * a chat's first message (an ad's pre-filled text) is answered without the
//    wait that lets a customer finish typing; later typed messages still wait;
//  * a reply reads the company's credit record once, not three times.
// Real inbound route; Meta (axios) and OpenAI faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "1500";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");
require("../utils/ai/gateway").createChatCompletion = async (body) => (await axios.post("https://api.openai.com/v1/chat/completions", body)).data; // chat calls reach the axios fake

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, WaMessage, wa, seq = 0;
const calls = []; // every Graph call, in order, with when it happened
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) { calls.push({ at: Date.now(), body }); return { data: { messages: [{ id: `wamid.out.${calls.length}` }] } }; }
  return { data: { choices: [{ message: { content: "Happy to help." } }], usage: {} } };
};
const say = (phone, msgText, extra = {}) => wa._handleInbound(org, { phone, name: "Asha", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra });
const repliesTo = (phone) => calls.filter((c) => c.body.to === phone);

test("'typing...' and a read receipt go out for the message, before the reply", async () => {
  const phone = "919811122201";
  await say(phone, "Hi, I'd like details of the Green Valley plots please");
  const typing = calls.find((c) => c.body.status === "read" && c.body.message_id === `wamid.in.${phone}.${seq}`);
  assert.ok(typing, "typing indicator sent");
  assert.deepEqual(typing.body.typing_indicator, { type: "text" });
  assert.ok(calls.indexOf(typing) < calls.indexOf(repliesTo(phone)[0]), "before the reply");
});

test("a chat's first message (the ad's text) is answered at once; a short 'hi' and later messages still wait", async () => {
  const phone = "919811122202";
  let t = Date.now();
  await say(phone, "Hi, I'd like details of the Green Valley plots please");
  assert.ok(Date.now() - t < 1200, `first reply took ${Date.now() - t} ms`);
  t = Date.now();
  await say(phone, "is there a clubhouse");
  assert.ok(Date.now() - t >= 1400, "waits so a second message can join the first");
  const p2 = "919811122209";
  t = Date.now();
  await say(p2, "Hi");
  assert.ok(Date.now() - t >= 1400, "a bare 'Hi' waits in case more is coming");
});

test("no typing indicator when the bot is off (a person is handling the chat)", async () => {
  const phone = "919811122203";
  await say(phone, "Hi there, I have a question about plots");
  await mongoose.connection.collection("waconversations").updateOne({ contactPhone: phone }, { $set: { botEnabled: false } });
  const before = calls.length;
  await say(phone, "hello?");
  assert.equal(calls.slice(before).filter((c) => c.body.typing_indicator).length, 0);
});

test("a reply reads the credit record once, and still records the free reply", async () => {
  const phone = "919811122204";
  let orgReads = 0;
  mongoose.set("debug", (coll, method) => { if (coll === "organizations" && /^find/.test(method)) orgReads++; });
  await say(phone, "Hi, I'd like details of the Green Valley plots please");
  mongoose.set("debug", false);
  assert.ok(orgReads <= 1, `${orgReads} reads of the company record`);
  const out = await WaMessage.findOne({ direction: "outbound", body: "Happy to help." }).sort({ timestamp: -1 }).lean();
  assert.equal(out.freeTierApplied, true);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const Lead = require("../models/Lead");
  const WaConversation = require("../models/WaConversation");
  WaMessage = require("../models/WaMessage");
  const WaAgent = require("../models/WaAgent");
  for (const M of [Lead, WaConversation, WaMessage]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations", "adprefills"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  await WaAgent.collection.insertOne({ _id: oid(), orgId: ORG, name: "Artha Assistant", status: "active", isDefault: true, adIds: [], projectIds: [], greetingEnabled: false, createdAt: new Date() });
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp bot: faster replies");
})();
