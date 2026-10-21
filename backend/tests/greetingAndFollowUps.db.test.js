// WhatsApp agents (21 Oct 2026):
//  - "Send a greeting" can be switched off, and the first reply then never says
//    hello (the ad's own Meta greeting already did); with a greeting message
//    sent, the first reply doesn't greet a second time.
//  - "Follow up if they go quiet" works for ordinary AI chats, not only for
//    button-flow chats, and only when the assistant's last message asked
//    something.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let mongod, wa, db, sent = [];
const MIN = 60 * 1000, HOUR = 60 * MIN;

// Meta's send API, faked: every text that would reach a customer lands here.
axios.post = async (url, payload) => {
  if (/graph\.facebook\.com\/.*\/messages/.test(url)) {
    sent.push(payload?.text?.body || payload?.interactive?.body?.text || "");
    return { data: { messages: [{ id: `wamid.test${sent.length}` }] } };
  }
  throw new Error(`unexpected POST ${url}`);
};

async function setup({ plan = "growth", nudges = true, nudgeText = "Just checking in, {{name}} 🙂", greetingEnabled } = {}) {
  const orgId = oid(), agentId = oid(), convId = oid();
  await db.collection("organizations").insertOne({
    _id: orgId, name: "Prophunt LLP", slug: `p-${orgId}`, plan, isActive: true,
    whatsapp: { enabled: true, provider: "meta", phoneNumberId: "PN1", apiKey: "tok", botEnabled: true },
    credits: { balancePaise: 0, reservedPaise: 0, freeService: { yyyymm: "", used: 0 } },
  });
  await db.collection("waagents").insertOne({
    _id: agentId, orgId, name: "Riya", status: "active", isDefault: true,
    ...(greetingEnabled !== undefined ? { greetingEnabled } : {}),
    ctwaFlow: { enabled: false, nudgesEnabled: nudges, nudgeText },
  });
  await db.collection("waconversations").insertOne({
    _id: convId, orgId, agentId, contactPhone: "919800000001", contactName: "Asha",
    botEnabled: true, nudgeCount: 0, status: "open", lastMessageAt: new Date(), createdAt: new Date(Date.now() - 2 * HOUR),
  });
  return { orgId, agentId, convId };
}
async function say(convId, orgId, direction, sender, body, agoMs, extra = {}) {
  await db.collection("wamessages").insertOne({
    _id: oid(), orgId, conversationId: convId, direction, sender, body, status: "delivered",
    timestamp: new Date(Date.now() - agoMs), createdAt: new Date(Date.now() - agoMs), ...extra,
  });
}
// Each follow-up test starts from an empty database: the job looks at every chat.
async function fresh() {
  sent = [];
  for (const c of ["organizations", "waagents", "waconversations", "wamessages"]) await db.collection(c).deleteMany({});
}
const botMsgs = async (convId) => db.collection("wamessages").find({ conversationId: convId, direction: "outbound", sender: "bot" }).sort({ timestamp: 1 }).toArray();

// ── First reply: never two hellos ───────────────────────────────────────────
test("greeting off: the first reply is told not to greet or introduce itself", async () => {
  const org = { _id: oid(), name: "Prophunt LLP", whatsapp: {} };
  const p = await wa._buildProjectGroundedPrompt(org, { name: "Riya" }, "", null, { isFirstBotReply: true, greetingMode: "off" });
  assert.match(p, /Do NOT greet them, say hello or introduce yourself/);
  assert.doesNotMatch(p, /Warmly greet them by name/);
});

test("greeting message already sent: the first reply doesn't greet again", async () => {
  const org = { _id: oid(), name: "Prophunt LLP", whatsapp: {} };
  const p = await wa._buildProjectGroundedPrompt(org, { name: "Riya" }, "", null, { isFirstBotReply: true, greetingMode: "sent" });
  assert.match(p, /already sent to them just before this reply, so do NOT say hello/);
  assert.doesNotMatch(p, /Warmly greet them by name/);
});

test("no greeting set and switch on: the first reply greets, as before", async () => {
  const org = { _id: oid(), name: "Prophunt LLP", whatsapp: {} };
  const p = await wa._buildProjectGroundedPrompt(org, { name: "Riya" }, "", null, { isFirstBotReply: true });
  assert.match(p, /Warmly greet them by name/);
});

test("later replies carry no first-reply rule at all", async () => {
  const org = { _id: oid(), name: "Prophunt LLP", whatsapp: {} };
  const p = await wa._buildProjectGroundedPrompt(org, { name: "Riya" }, "", null, { isFirstBotReply: false, greetingMode: "off" });
  assert.doesNotMatch(p, /very first reply/);
});

test("an agent saved before the switch existed counts as greeting on; off counts as a finished setup step", async () => {
  const WaAgent = require("../models/WaAgent");
  const legacy = new WaAgent({ orgId: oid(), name: "Old" });
  assert.equal(legacy.greetingEnabled, true);
  const off = new WaAgent({ orgId: oid(), name: "Ad agent", greetingEnabled: false });
  assert.equal(off.readiness(1).checks.find((c) => c.key === "greeting").ok, true, "greeting switched off counts as done");
  assert.equal(legacy.readiness(1).checks.find((c) => c.key === "greeting").ok, false, "on with no text still asks for a greeting");
});

// ── Follow-ups for ordinary AI chats ────────────────────────────────────────
test("a quiet customer in an ordinary AI chat gets one reminder repeating the assistant's question", async () => {
  await fresh();
  const { orgId, convId } = await setup();
  await say(convId, orgId, "inbound", "customer", "Hi, I want to register for the webinar", 40 * MIN);
  await say(convId, orgId, "outbound", "bot", "Great to hear you're interested in the webinar! Could you please share your full name to proceed?", 30 * MIN);
  await wa.runFlowNudges(new Date());
  assert.equal(sent.length, 1, JSON.stringify(sent));
  assert.equal(sent[0], "Just checking in, Asha 🙂\n\nCould you please share your full name to proceed?");
  const conv = await db.collection("waconversations").findOne({ _id: convId });
  assert.equal(conv.nudgeCount, 1);
  // Running again in the same silence sends nothing more.
  await wa.runFlowNudges(new Date());
  assert.equal(sent.length, 1);
});

test("no reminder when the assistant's last message didn't ask anything", async () => {
  await fresh();
  const { orgId, convId } = await setup();
  await say(convId, orgId, "inbound", "customer", "ok thanks", 40 * MIN);
  await say(convId, orgId, "outbound", "bot", "You're registered. See you on 31 October!", 30 * MIN);
  await wa.runFlowNudges(new Date());
  assert.equal(sent.length, 0);
});

test("no reminder when the setting is off, the plan has no AI agent, or a person replied last", async () => {
  await fresh();
  const a = await setup({ nudges: false });
  await say(a.convId, a.orgId, "outbound", "bot", "What is your budget?", 30 * MIN);
  const b = await setup({ plan: "starter" });
  await say(b.convId, b.orgId, "outbound", "bot", "What is your budget?", 30 * MIN);
  const c = await setup();
  await say(c.convId, c.orgId, "outbound", "bot", "What is your budget?", 40 * MIN);
  await say(c.convId, c.orgId, "outbound", "agent", "Hi, this is Kabir from the sales team.", 30 * MIN);
  await wa.runFlowNudges(new Date());
  assert.equal(sent.length, 0, JSON.stringify(sent));
});

test("too soon (under 15 minutes) waits; shortly before the 24-hour window closes, the last reminder goes", async () => {
  await fresh();
  const early = await setup();
  await say(early.convId, early.orgId, "inbound", "customer", "hi", 10 * MIN);
  await say(early.convId, early.orgId, "outbound", "bot", "Which city are you looking in?", 5 * MIN);
  await wa.runFlowNudges(new Date());
  assert.equal(sent.length, 0);

  const late = await setup();
  await say(late.convId, late.orgId, "inbound", "customer", "hi", 21 * HOUR);
  await say(late.convId, late.orgId, "outbound", "bot", "Which city are you looking in?", 21 * HOUR - MIN);
  await db.collection("waconversations").updateOne({ _id: late.convId }, { $set: { nudgeCount: 1 } });
  await wa.runFlowNudges(new Date());
  assert.equal(sent.length, 1);
  assert.match(sent[0], /^One last check-in from me/);
  assert.match(sent[0], /Which city are you looking in\?$/);
  assert.equal((await db.collection("waconversations").findOne({ _id: late.convId })).nudgeCount, 2);
});

test("reminders contain no em or en dashes", async () => {
  await fresh();
  const { orgId, convId } = await setup({ nudgeText: "Just checking in — {{name}}" });
  await say(convId, orgId, "outbound", "bot", "Is a 2BHK — or a 3BHK — what you want?", 30 * MIN);
  await wa.runFlowNudges(new Date());
  assert.equal(sent.length, 1);
  assert.ok(!/[–—]/.test(sent[0]), sent[0]);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection;
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp agents: greeting switch and follow-ups for ordinary chats");
})();
