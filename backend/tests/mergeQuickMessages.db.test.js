// The WhatsApp bot waits until the customer has been quiet for a moment before
// answering typed text, so a burst of messages gets ONE reply (21 Oct 2026:
// two messages 4 s apart got two answers). Uses a short quiet time.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "400";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let org, wa, seq = 0, aiCalls = [], metaSends = [];

axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) {
    metaSends.push(body);
    return { data: { messages: [{ id: `wamid.out.${metaSends.length}` }] } };
  }
  if (String(url).includes("openai.com")) {
    // What the customer said last, as the model sees it.
    aiCalls.push(body.messages.filter((m) => m.role === "user").map((m) => m.content));
    return { data: { choices: [{ message: { content: "Sure, here you go." } }], usage: {} } };
  }
  throw new Error(`unexpected POST ${url}`);
};

const nextPhone = () => `9198777${String(10000 + ++seq).padStart(5, "0")}`;
const say = (phone, msgText, extra = {}) => wa._handleInbound(org, {
  phone, name: "Pravin", msgId: `wamid.in.${phone}.${++seq}`, msgText, msgType: "text", ...extra,
});
const repliesTo = (phone) => metaSends.filter((s) => s.to === phone && s.type === "text");

test("two typed messages a moment apart get one reply that has seen both", async () => {
  const phone = nextPhone();
  await say(phone, "Hi"); // first contact: answered on its own
  aiCalls = []; const before = repliesTo(phone).length;
  const a = say(phone, "Finalization depends on your response");
  await sleep(150);
  const b = say(phone, "What is the price of 1 BHK?");
  await Promise.all([a, b]);
  assert.equal(repliesTo(phone).length - before, 1, "one reply, not two");
  assert.equal(aiCalls.length, 1);
  const seen = aiCalls[0].join(" | ");
  assert.match(seen, /Finalization depends/);
  assert.match(seen, /price of 1 BHK/);
});

test("three quick messages still give one reply", async () => {
  const phone = nextPhone();
  await say(phone, "Hi");
  aiCalls = []; const before = repliesTo(phone).length;
  const p = [say(phone, "I saw your ad")];
  await sleep(100); p.push(say(phone, "for Everglades"));
  await sleep(100); p.push(say(phone, "is it RERA registered?"));
  await Promise.all(p);
  assert.equal(repliesTo(phone).length - before, 1);
  assert.equal(aiCalls.length, 1);
});

test("messages further apart than the quiet time each get their own reply", async () => {
  const phone = nextPhone();
  await say(phone, "Hi");
  aiCalls = []; const before = repliesTo(phone).length;
  await say(phone, "Is parking included?");
  await sleep(500);
  await say(phone, "And the maintenance?");
  assert.equal(repliesTo(phone).length - before, 2);
});

test("a single message is answered after the short wait, not dropped", async () => {
  const phone = nextPhone();
  const t0 = Date.now();
  await say(phone, "Hello");
  const took = Date.now() - t0;
  assert.ok(repliesTo(phone).length >= 1, "answered");
  assert.ok(took >= 350, `waited for the customer to finish (${took} ms)`);
});

test("a typed line right before a button tap is folded into the tap's turn", async () => {
  const phone = nextPhone();
  await say(phone, "Hi");
  aiCalls = []; const before = repliesTo(phone).length;
  const a = say(phone, "Finalization depends on your response");
  await sleep(150);
  const b = say(phone, "🖼️ Photos & Videos", { msgType: "interactive", interactiveId: "unknown_button" });
  await Promise.all([a, b]);
  assert.equal(repliesTo(phone).length - before, 1, "one reply for the pair");
  assert.match(aiCalls.map((c) => c.join(" ")).join(" "), /Finalization depends/, "the typed line was seen");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations", "leads", "waconversations", "wamessages"]) await mongoose.connection.createCollection(c).catch(() => {});
  const ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "growth", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  await mongoose.connection.collection("waagents").insertOne({ _id: oid(), orgId: ORG, name: "Riya", status: "active", isDefault: true, adIds: [], greetingEnabled: false, createdAt: new Date() });
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp bot: quick messages get one reply");
})();
