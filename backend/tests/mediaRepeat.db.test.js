// The WhatsApp bot never sends the same photos, videos or documents twice in a
// chat within 24 hours, unless the customer asks again (20 Oct 2026: a tap on
// "Photos & Videos" then a "Yes" to another question sent all four files twice).
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let mongod, wa, db, org, agent, project, media = [], texts = [], aiReply = "";

axios.post = async (url, payload) => {
  if (/graph\.facebook\.com\/.*\/messages/.test(url)) {
    if (payload.type === "text") texts.push(payload.text.body);
    else media.push(payload[payload.type]?.link);
    return { data: { messages: [{ id: `wamid.${media.length}.${texts.length}.${Math.random()}` }] } };
  }
  if (/api\.openai\.com/.test(url)) {
    return { data: { choices: [{ message: { content: aiReply } }], usage: { prompt_tokens: 10, completion_tokens: 10 } } };
  }
  throw new Error(`unexpected POST ${url}`);
};

const PHOTOS = ["https://api.arthaleads.com/api/media/arthaleads/projects/p/a.jpg", "https://api.arthaleads.com/api/media/arthaleads/projects/p/b.jpg"];
const VIDEOS = ["https://api.arthaleads.com/api/media/arthaleads/projects/p/videos/v1.mp4", "https://api.arthaleads.com/api/media/arthaleads/projects/p/videos/v2.mp4"];

async function newChat() {
  media = []; texts = [];
  const _id = oid();
  await db.collection("waconversations").insertOne({ _id, orgId: org._id, agentId: agent._id, contactPhone: `9198${Date.now() % 1e8}`, contactName: "Pravin", botEnabled: true, status: "open", lastMessageAt: new Date() });
  return db.collection("waconversations").findOne({ _id });
}
const wants = { wantsPhotos: true, wantsVideos: true, project: null };
const sendBot = (conv, extra = {}) => wa._sendQualifiedMedia(org, agent, conv, "Riya", "Paranjape Everglades", { ...wants, project, ...extra });

test("the same photos and videos are not sent twice by the bot", async () => {
  const conv = await newChat();
  const first = await sendBot(conv);
  assert.deepEqual(first.sent.sort(), ["photos", "videos"]);
  assert.equal(media.length, 4);
  const second = await sendBot(conv);
  assert.equal(media.length, 4, "nothing new went out");
  assert.deepEqual(second.sent, []);
  assert.deepEqual(second.missing, [], "already sent is not reported as missing");
});

test("a button tap (force) right after is not a second copy either", async () => {
  const conv = await newChat();
  await sendBot(conv);
  await sendBot(conv, { force: true });
  assert.equal(media.length, 4);
});

test("when the customer asks again, the files go out again", async () => {
  const conv = await newChat();
  await sendBot(conv);
  await sendBot(conv, { allowRepeat: true });
  assert.equal(media.length, 8);
});

test("a person sending from the chat always sends what they picked", async () => {
  const conv = await newChat();
  await sendBot(conv);
  await wa._sendQualifiedMedia(org, null, conv, "Kabir", project.name, { ...wants, project, force: true, senderOverride: "agent", senderNameOverride: "Kabir" });
  assert.equal(media.length, 8);
});

test("a newly uploaded photo is still sent; only the ones already sent are skipped", async () => {
  const conv = await newChat();
  await sendBot(conv);
  const withNew = { ...project, images: [...PHOTOS, "https://api.arthaleads.com/api/media/arthaleads/projects/p/c.jpg"] };
  const r = await wa._sendQualifiedMedia(org, agent, conv, "Riya", "x", { ...wants, project: withNew });
  assert.deepEqual(media.slice(4), ["https://api.arthaleads.com/api/media/arthaleads/projects/p/c.jpg"]);
  assert.deepEqual(r.sent, ["photos"]);
});

test("after 24 hours the same files may be sent again", async () => {
  const conv = await newChat();
  await sendBot(conv);
  await db.collection("wamessages").updateMany({ conversationId: conv._id }, { $set: { timestamp: new Date(Date.now() - 25 * 3600e3) } });
  await sendBot(conv);
  assert.equal(media.length, 8);
});

test("'send again', 'didn't get it', 'phir se' count as asking again; 'Yes' does not", async () => {
  for (const t of ["Can you send again?", "I didn't get the video", "not loading", "phir se bhejo", "दोबारा भेजो", "resend please"]) assert.ok(wa._ASK_AGAIN.test(t), t);
  for (const t of ["Yes", "ok", "Photos & Videos", "send photos", "nice video"]) assert.ok(!wa._ASK_AGAIN.test(t), t);
});

test("the 20 Oct case: the AI says it is sending them again, but nothing is re-sent", async () => {
  const conv = await newChat();
  await db.collection("wamessages").insertOne({ _id: oid(), orgId: org._id, conversationId: conv._id, direction: "inbound", sender: "customer", body: "🖼️ Photos & Videos", status: "delivered", timestamp: new Date(Date.now() - 20000) });
  await sendBot(conv);
  assert.equal(media.length, 4);
  aiReply = "Awesome! I'm sending over the photos and the video of Paranjape Everglades now. [SHARE_PHOTOS] [SHARE_VIDEO]";
  await wa._triggerBotReply(org, agent, conv, "Yes");
  await new Promise((r) => setTimeout(r, 300)); // media is sent after the reply
  assert.ok(texts.some((t) => /^Awesome!/.test(t)), `the reply itself went out: ${JSON.stringify(texts)}`);
  assert.equal(media.length, 4, `files re-sent: ${media.length - 4}`);
  assert.ok(!texts.some((t) => /isn't ready on my side/.test(t)), "no false 'not ready' message");
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection;
  const orgId = oid(), agentId = oid(), projectId = oid();
  await db.collection("organizations").insertOne({ _id: orgId, name: "Prophunt LLP", slug: `p-${orgId}`, plan: "enterprise", isActive: true,
    whatsapp: { enabled: true, provider: "meta", phoneNumberId: "PN1", apiKey: "tok", botEnabled: true },
    credits: { balancePaise: 0, reservedPaise: 0 } });
  await db.collection("projects").insertOne({ _id: projectId, orgId, name: "Paranjape Everglades", status: "active", isArchived: false, createdBy: oid(),
    images: PHOTOS, videos: VIDEOS.map((url) => ({ url })) });
  await db.collection("waagents").insertOne({ _id: agentId, orgId, name: "Riya", status: "active", isDefault: true, shareProjectPhotos: true, shareVideos: true, projectIds: [projectId] });
  org = await db.collection("organizations").findOne({ _id: orgId });
  agent = await db.collection("waagents").findOne({ _id: agentId });
  project = await db.collection("projects").findOne({ _id: projectId });
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp bot: no repeat photos, videos or documents");
})();
