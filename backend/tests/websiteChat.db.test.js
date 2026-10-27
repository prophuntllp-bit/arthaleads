// Website Artha chats (27 Oct 2026): each question and answer is saved into the
// visitor's conversation (one WebsiteChat per visit id), with the page it
// started on and the device; bad visit ids are ignored; long chats keep only
// the latest 200 messages.
process.env.NODE_ENV = "test";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

let save, WebsiteChat;
const req = (body, ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile") => ({ body, get: (h) => (h.toLowerCase() === "user-agent" ? ua : "") });

test("questions from one visit land in one conversation", async () => {
  await save(req({ sessionId: "visit-abc12345", page: "/pricing" }), "How much is Growth?", { answer: "Rs 999 per user per month.", cta: "pricing" });
  await save(req({ sessionId: "visit-abc12345", page: "/features" }), "Can I see a demo?", { answer: "Yes, book one.", cta: "demo" });
  const c = await WebsiteChat.findOne({ sessionId: "visit-abc12345" }).lean();
  assert.equal(c.questions, 2);
  assert.equal(c.page, "/pricing", "keeps the page the chat started on");
  assert.equal(c.device, "mobile");
  assert.deepEqual(c.messages.map((m) => m.role), ["user", "bot", "user", "bot"]);
  assert.equal(c.messages[3].cta, "demo");
});

test("a missing or malformed visit id saves nothing", async () => {
  const before = await WebsiteChat.countDocuments();
  await save(req({}), "Hi", { answer: "Hello", cta: null });
  await save(req({ sessionId: "bad id with spaces" }), "Hi", { answer: "Hello", cta: null });
  await save(req({ sessionId: "short" }), "Hi", { answer: "Hello", cta: null });
  assert.equal(await WebsiteChat.countDocuments(), before);
});

test("desktop visitors are marked desktop, and only the last 200 messages are kept", async () => {
  for (let i = 0; i < 105; i++) {
    await save(req({ sessionId: "visit-long-chat", page: "/" }, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), `q${i}`, { answer: `a${i}`, cta: null });
  }
  const c = await WebsiteChat.findOne({ sessionId: "visit-long-chat" }).lean();
  assert.equal(c.device, "desktop");
  assert.equal(c.messages.length, 200);
  assert.equal(c.questions, 105);
  assert.equal(c.messages[199].text, "a104");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  WebsiteChat = require("../models/WebsiteChat");
  await WebsiteChat.init();
  save = require("../routes/publicRoutes").__saveWebsiteChat;
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Website Artha chats");
})();
