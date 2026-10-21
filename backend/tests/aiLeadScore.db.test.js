// AI lead scoring (services/aiLeadScore.js, utils/leadScorer.js), with the
// model faked. Owner rules, 21 Oct 2026: only leads whose customer did
// something in the last 14 days, only those 14 days are read; bulk-imported
// leads only once the customer replies; project leads never; included in
// Growth and up within a daily limit; the AI moves the rule score by at most 20.
process.env.AI_SCORE_QUIET_MS = String(10 * 60 * 1000);
process.env.AI_SCORE_DAILY_LIMIT = "3";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const oid = () => new mongoose.Types.ObjectId();
const MIN = 60000, DAY = 86400000;
let mongod, db, ai, scorer, Lead, prompts = [], answer = null, phoneSeq = 0;

const fakeModel = async (messages) => {
  prompts.push(messages.map((m) => m.content).join("\n"));
  return { text: JSON.stringify(answer || { level: "hot", confidence: 0.9, reason: "Asked for a Saturday site visit and said the loan is approved.", signals: ["visit_wanted", "loan_ready"], nextStep: "Confirm the Saturday visit" }), usage: { total_tokens: 900 }, model: "fake" };
};

async function org(plan = "growth") {
  const _id = oid();
  await db.collection("organizations").insertOne({ _id, name: `Org ${plan}`, slug: `o-${_id}`, plan, isActive: true });
  return _id;
}
async function lead(orgId, extra = {}) {
  const _id = oid();
  await db.collection("leads").insertOne({ _id, orgId, name: "Asha Patil", phone: "919800000001", status: "Contacted", priority: "Medium", source: "WhatsApp",
    isDeleted: false, isArchived: false, createdAt: new Date(Date.now() - 3 * DAY), updatedAt: new Date(), activities: [], notes: [], tags: [], ...extra });
  return _id;
}
async function chat(orgId, leadId, lines) {
  const convId = oid();
  await db.collection("waconversations").insertOne({ _id: convId, orgId, leadId, contactPhone: `9198${String(++phoneSeq).padStart(8, "0")}`, status: "open", lastMessageAt: new Date() });
  for (const [dir, body, agoMs] of lines) {
    await db.collection("wamessages").insertOne({ _id: oid(), orgId, conversationId: convId, direction: dir, sender: dir === "inbound" ? "customer" : "bot", body, mediaType: "text", status: "delivered", timestamp: new Date(Date.now() - agoMs) });
  }
}
async function fresh() {
  prompts = []; answer = null;
  for (const c of ["organizations", "leads", "waconversations", "wamessages", "aiusages"]) await db.collection(c).deleteMany({});
}
const get = (id) => Lead.findById(id).lean();

test("a customer quiet for 10 minutes is read once, and the score moves up with a reason", async () => {
  await fresh();
  const o = await org();
  const id = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 15 * MIN) });
  await chat(o, id, [["inbound", "Hi, is the 1 BHK still available?", 40 * MIN], ["outbound", "Yes! Would you like to visit?", 39 * MIN], ["inbound", "Saturday works, my loan is approved", 15 * MIN]]);
  const before = scorer.scoreLead(await get(id));
  const r = await ai.runSweep();
  assert.equal(r.scored, 1);
  const l = await get(id);
  assert.equal(l.aiScore.level, "hot");
  assert.match(l.aiScore.reason, /Saturday/);
  assert.equal(scorer.scoreLead(l) - before, 20, "hot with high confidence adds 20");
  assert.equal(scorer.nextBestAction(l, 80).action, "Confirm the Saturday visit");
  assert.ok(prompts[0].includes("Saturday works, my loan is approved"), "the AI read the chat");
  // Nothing new happened: the next run reads nothing.
  prompts = [];
  assert.equal((await ai.runSweep()).scored, 0);
  assert.equal(prompts.length, 0);
});

test("not before the customer has been quiet for 10 minutes", async () => {
  await fresh();
  const o = await org();
  const id = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 3 * MIN) });
  await chat(o, id, [["inbound", "one more question", 3 * MIN]]);
  assert.equal((await ai.runSweep()).scored, 0);
});

test("a bulk-imported lead is not read until the customer replies after the import", async () => {
  await fresh();
  const o = await org();
  const imported = new Date(Date.now() - 2 * DAY);
  const silent = await lead(o, { importedAt: imported });
  const stale = await lead(o, { importedAt: imported, lastCustomerSignalAt: new Date(imported - DAY) }); // activity from before the import
  assert.equal((await ai.runSweep()).scored, 0);
  assert.equal(prompts.length, 0, "nothing sent to the AI");
  const replied = await lead(o, { importedAt: imported, lastCustomerSignalAt: new Date(Date.now() - 20 * MIN) });
  await chat(o, replied, [["outbound", "Hello from Prophunt, new launch in Wakad", DAY], ["inbound", "Send me the price list", 20 * MIN]]);
  assert.equal((await ai.runSweep()).scored, 1);
  assert.ok((await get(replied)).aiScore);
  assert.ok(!(await get(silent)).aiScore && !(await get(stale)).aiScore);
});

test("only the last 14 days: older activity isn't read, and an old AI adjustment lapses", async () => {
  await fresh();
  const o = await org();
  const old = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 15 * DAY) });
  await chat(o, old, [["inbound", "interested", 15 * DAY]]);
  assert.equal((await ai.runSweep()).scored, 0);

  const recent = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 20 * MIN) });
  await chat(o, recent, [["inbound", "THIS IS OLD", 20 * DAY], ["inbound", "Can I visit tomorrow?", 20 * MIN]]);
  await ai.runSweep();
  assert.ok(!prompts[0].includes("THIS IS OLD"), "messages older than 14 days are not sent");

  const l = await get(recent);
  const lapsed = { ...l, aiScore: { ...l.aiScore, signalAt: new Date(Date.now() - 15 * DAY) } };
  assert.equal(scorer.aiAdjust(lapsed), 0, "15 days later the AI part is gone");
  assert.equal(scorer.aiSummary(lapsed), null);
});

test("closed, deleted, 'Not a buyer' and Starter-plan leads are never read", async () => {
  await fresh();
  const o = await org();
  const starter = await org("starter");
  const at = new Date(Date.now() - 20 * MIN);
  for (const extra of [{ status: "Closed Won" }, { status: "Closed Lost" }, { isDeleted: true }, { isArchived: true }, { tags: ["Not a buyer"] }]) {
    const id = await lead(o, { ...extra, lastCustomerSignalAt: at });
    await chat(o, id, [["inbound", "hello", 20 * MIN]]);
  }
  const s = await lead(starter, { lastCustomerSignalAt: at });
  await chat(starter, s, [["inbound", "hello", 20 * MIN]]);
  assert.equal((await ai.runSweep()).scored, 0);
  assert.equal(prompts.length, 0);
});

test("phone numbers and emails never reach the AI", async () => {
  await fresh();
  const o = await org();
  const id = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 20 * MIN) });
  await chat(o, id, [["inbound", "call me on +91 98765 43210 or mail asha.patil@gmail.com, budget 4500000", 20 * MIN]]);
  await ai.runSweep();
  assert.ok(!/98765|asha\.patil|919800000001/.test(prompts[0]), prompts[0]);
  assert.ok(prompts[0].includes("4500000"), "a budget is not mistaken for a phone number");
});

test("an unsure answer moves the score half as much; cold moves it down; nothing beyond 20", async () => {
  await fresh();
  const o = await org();
  answer = { level: "hot", confidence: 0.3, reason: "Said maybe next month." };
  const unsure = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 20 * MIN) });
  await chat(o, unsure, [["inbound", "maybe next month", 20 * MIN]]);
  await ai.runSweep();
  assert.equal((await get(unsure)).aiScore.adjust, 10);

  answer = { level: "cold", confidence: 0.95, reason: "Says they are just browsing, budget well below the project." };
  const cold = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 20 * MIN) });
  await chat(o, cold, [["inbound", "just browsing", 20 * MIN]]);
  await ai.runSweep();
  const c = await get(cold);
  assert.equal(c.aiScore.adjust, -20);
  assert.equal(scorer.aiAdjust({ ...c, aiScore: { ...c.aiScore, adjust: -90 } }), -20, "clamped");
});

test("a garbled AI answer leaves the rule score alone and isn't retried until something new happens", async () => {
  await fresh();
  const o = await org();
  const id = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 20 * MIN) });
  await chat(o, id, [["inbound", "hi", 20 * MIN]]);
  const sc = scorer.scoreLead(await get(id));
  answer = "not json";
  ai._setModel(async () => ({ text: "sorry, I can't", usage: null, model: "fake" }));
  await ai.runSweep();
  ai._setModel(fakeModel);
  const l = await get(id);
  assert.equal(scorer.scoreLead(l), sc);
  assert.equal(scorer.aiSummary(l), null);
  prompts = [];
  await ai.runSweep();
  assert.equal(prompts.length, 0, "not asked again every 5 minutes");
});

test("a company's daily limit holds", async () => {
  await fresh();
  const o = await org();
  for (let i = 0; i < 5; i++) {
    const id = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - (20 + i) * MIN) });
    await chat(o, id, [["inbound", `hello ${i}`, (20 + i) * MIN]]);
  }
  assert.equal((await ai.runSweep()).scored, 3, "AI_SCORE_DAILY_LIMIT=3");
  assert.equal((await ai.runSweep()).scored, 0);
});

test("customer activity is stamped: a WhatsApp reply, and a Vistrow AI call however it is saved", async () => {
  await fresh();
  const o = await org();
  const id = await lead(o);
  const at = new Date();
  await ai.markSignal(id, at);
  assert.equal(+(await get(id)).lastCustomerSignalAt, +at);
  await ai.markSignal(id, new Date(at - DAY));
  assert.equal(+(await get(id)).lastCustomerSignalAt, +at, "never moves backwards");

  const v = await lead(o);
  await Lead.updateOne({ _id: v }, { $push: { voiceCalls: { externalCallId: 1, transcript: [{ speaker: "user", text: "yes call me" }] } } });
  assert.ok((await get(v)).lastCustomerSignalAt, "a pushed voice call stamps it");
  const created = await Lead.create({ orgId: o, name: "New from call", phone: "919811111111", voiceCalls: [{ externalCallId: 2 }] });
  assert.ok(created.lastCustomerSignalAt, "a lead created from a call is stamped");
});

test("Artha sees the real score instead of 'not scored'", async () => {
  await fresh();
  const o = await org();
  const id = await lead(o, { lastCustomerSignalAt: new Date(Date.now() - 20 * MIN) });
  await chat(o, id, [["inbound", "visit Saturday", 20 * MIN]]);
  await ai.runSweep();
  const src = require("fs").readFileSync(require.resolve("../utils/copilotContext"), "utf8");
  assert.ok(!src.includes("lead.score ??"), "the old missing field is gone");
  const l = await get(id);
  assert.ok(scorer.aiSummary(l).reason.includes("Saturday"));
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection;
  for (const c of ["organizations", "leads", "waconversations", "wamessages", "aiusages"]) await db.createCollection(c).catch(() => {});
  Lead = require("../models/Lead");
  ai = require("../services/aiLeadScore");
  scorer = require("../utils/leadScorer");
  ai._setModel(fakeModel);
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("AI lead scoring");
})();
