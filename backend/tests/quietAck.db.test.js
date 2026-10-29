// "ok" / "thanks" after the bot has finished talking gets no reply (23 Oct
// 2026: every "Ok" got another goodbye, three in a row). When the bot's last
// message asked something, "ok" is an answer and is replied to.
// Real inbound route; Meta (axios) and OpenAI faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");
require("../utils/ai/gateway").createChatCompletion = async (body) => (await axios.post("https://api.openai.com/v1/chat/completions", body)).data; // chat calls reach the axios fake

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, WaMessage, WaConversation, wa, seq = 0;
const calls = [];
let aiText = "Great, have a good day!";
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) { calls.push(body); return { data: { messages: [{ id: `wamid.out.${calls.length}` }] } }; }
  return { data: { choices: [{ message: { content: aiText } }], usage: {} } };
};
const say = (phone, msgText) => wa._handleInbound(org, { phone, name: "Asha", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text" });
const replies = (phone) => calls.filter((c) => c.to === phone);
const typing = () => calls.filter((c) => c.typing_indicator).length;

test("after a goodbye, 'Ok' and 'thanks 🙏' get no reply and no 'typing...'", async () => {
  const phone = "919811133301";
  await say(phone, "Hi, tell me about the Green Valley plots");
  const n = replies(phone).length, t = typing();
  await say(phone, "Ok");
  await say(phone, "thanks 🙏");
  assert.equal(replies(phone).length, n, "no new reply");
  assert.equal(typing(), t, "no typing indicator either");
});

test("'ok' with a question in it is answered", async () => {
  const phone = "919811133301";
  const n = replies(phone).length;
  await say(phone, "ok what is the price");
  assert.equal(replies(phone).length, n + 1);
});

test("'ok' after the bot asked something is an answer, and is replied to", async () => {
  const phone = "919811133302";
  await say(phone, "Hi, tell me about the Green Valley plots");
  const conv = await WaConversation.findOne({ contactPhone: phone }).lean();
  await WaMessage.create({ orgId: ORG, conversationId: conv._id, direction: "outbound", sender: "bot", body: "Shall I book a site visit for Saturday?", status: "sent", timestamp: new Date() });
  const n = replies(phone).length;
  await say(phone, "Ok");
  assert.equal(replies(phone).length, n + 1);
});

test("a chat that opens with 'Ok' is still greeted", async () => {
  const phone = "919811133303";
  await say(phone, "Ok");
  assert.equal(replies(phone).length, 1);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const Lead = require("../models/Lead");
  WaConversation = require("../models/WaConversation");
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
  await run("WhatsApp bot: no reply to a bare 'ok' after a goodbye");
})();
