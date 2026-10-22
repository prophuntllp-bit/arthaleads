// Photos, voice notes and documents customers send on WhatsApp (22 Oct 2026:
// a customer sent three photos over three days; each showed as an empty
// bubble, the bot said nothing and nobody was told). Now the file is saved,
// the bot looks at photos, and voice notes / documents get a short reply.
// Real inbound route; Meta (axios get/post), storage and OpenAI are faked.
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
process.env.WA_BOT_QUIET_MS = "0";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");
const axios = require("axios");

const oid = () => new mongoose.Types.ObjectId();
let ORG, org, WaMessage, wa, seq = 0;
const metaSends = [], aiRequests = [], stored = [];
const FILES = {
  "media-photo": { mime: "image/jpeg", bytes: Buffer.from("fake-jpeg-bytes") },
  "media-voice": { mime: "audio/ogg", bytes: Buffer.from("fake-ogg-bytes") },
  "media-pdf": { mime: "application/pdf", bytes: Buffer.from("%PDF-fake") },
};
axios.get = async (url, opts = {}) => {
  const id = /graph\.facebook\.com\/v[\d.]+\/([^/?]+)$/.exec(url)?.[1];
  if (id) {
    assert.equal(opts.headers?.Authorization, "Bearer fake-token", "fetched with the business token");
    if (!FILES[id]) { const e = new Error("not found"); e.response = { status: 404 }; throw e; }
    return { data: { url: `https://lookaside.fbsbx.com/${id}`, mime_type: FILES[id].mime, file_size: FILES[id].bytes.length } };
  }
  const f = FILES[/lookaside\.fbsbx\.com\/(.+)$/.exec(url)?.[1]];
  if (f) return { data: f.bytes, headers: { "content-type": f.mime } };
  throw new Error(`unexpected GET ${url}`);
};
axios.post = async (url, body) => {
  if (String(url).startsWith("https://graph.facebook.com/")) { metaSends.push(body); return { data: { messages: [{ id: `wamid.out.${metaSends.length}` }] } }; }
  aiRequests.push(body);
  return { data: { choices: [{ message: { content: "That's the Khopoli plots ad. Plots start at ₹79L. Would you like the location?" } }], usage: {} } };
};
const storage = require("../utils/storage");
storage.put = async (key, buffer, contentType) => { stored.push({ key, contentType, size: buffer.length }); return `https://api.example.com/api/media/${key}`; };

const nextPhone = () => `9198333${String(10000 + ++seq).padStart(5, "0")}`;
// What Meta's webhook delivers, through the real parser.
const deliver = async (phone, message) => {
  const [parsed] = wa._parseMetaMessages({ entry: [{ changes: [{ value: { contacts: [{ wa_id: phone, profile: { name: "Vinod" } }], messages: [{ from: phone, id: `wamid.in.${++seq}`, ...message }] } }] }] });
  await wa._handleInbound(org, parsed);
};
const lastIn = (phone) => WaMessage.findOne({ direction: "inbound" }).sort({ timestamp: -1 }).lean();
const replyCalls = () => aiRequests.filter((b) => (b.messages || []).some((m) => m.role === "system" && /Customer context/.test(m.content)));
const textsTo = (phone) => metaSends.filter((m) => m.to === phone && m.type === "text").map((m) => m.text.body);

test("the webhook parser keeps the photo's media id and caption", async () => {
  const [p] = wa._parseMetaMessages({ entry: [{ changes: [{ value: { contacts: [], messages: [{ from: "91999", id: "x", type: "image", image: { id: "media-photo", mime_type: "image/jpeg", caption: "price?" } }] } }] }] });
  assert.equal(p.mediaId, "media-photo");
  assert.equal(p.caption, "price?");
  assert.equal(p.msgText, "[Image] price?");
});

test("a photo is saved and shown, and the bot looks at it and replies", async () => {
  const phone = nextPhone();
  await deliver(phone, { type: "image", image: { id: "media-photo", mime_type: "image/jpeg" } });
  const m = await lastIn(phone);
  assert.equal(m.mediaType, "image");
  assert.match(m.mediaUrl, /\/api\/media\/arthaleads\/wa-inbound\/.+\.jpg$/, "saved in our storage");
  assert.ok(/\/[0-9a-f]{24}\.jpg$/.test(stored.slice(-1)[0].key), "a random file name");
  const call = replyCalls().slice(-1)[0];
  assert.ok(call, "the bot answered");
  const userTurn = call.messages.filter((x) => x.role === "user").slice(-1)[0];
  const img = Array.isArray(userTurn.content) && userTurn.content.find((c) => c.type === "image_url");
  assert.ok(img && /^data:image\/jpeg;base64,/.test(img.image_url.url), "the model was given the photo");
  assert.ok(textsTo(phone).some((t) => /Khopoli/.test(t)), "the reply went out");
});

test("a photo with a caption: the caption is read along with the photo", async () => {
  const phone = nextPhone();
  aiRequests.length = 0;
  await deliver(phone, { type: "image", image: { id: "media-photo", mime_type: "image/jpeg", caption: "what is the price of this?" } });
  const userTurn = replyCalls()[0].messages.filter((x) => x.role === "user").slice(-1)[0];
  assert.match(userTurn.content.find((c) => c.type === "text").text, /what is the price of this\?/);
});

test("a voice note is saved and gets a short reply asking them to type; no AI call", async () => {
  const phone = nextPhone();
  aiRequests.length = 0;
  await deliver(phone, { type: "audio", audio: { id: "media-voice", mime_type: "audio/ogg; codecs=opus" } });
  assert.match((await lastIn(phone)).mediaUrl, /\.ogg$/);
  assert.equal(replyCalls().length, 0);
  assert.ok(textsTo(phone).some((t) => /can't play voice notes/.test(t)), JSON.stringify(textsTo(phone)));
  // A second one right after: no second notice.
  const before = textsTo(phone).length;
  await deliver(phone, { type: "audio", audio: { id: "media-voice", mime_type: "audio/ogg" } });
  assert.equal(textsTo(phone).length, before);
});

test("a document is saved and acknowledged", async () => {
  const phone = nextPhone();
  await deliver(phone, { type: "document", document: { id: "media-pdf", mime_type: "application/pdf", filename: "salary-slip.pdf" } });
  const m = await lastIn(phone);
  assert.match(m.mediaUrl, /\.pdf$/);
  assert.ok(textsTo(phone).some((t) => /shared it with our team/.test(t)));
});

test("if Meta won't give the file, the message is still saved and the bot still replies", async () => {
  const phone = nextPhone();
  aiRequests.length = 0;
  await deliver(phone, { type: "image", image: { id: "media-gone", mime_type: "image/jpeg" } });
  const m = await lastIn(phone);
  assert.equal(m.mediaUrl, "");
  assert.equal(m.body, "[Image]");
  assert.equal(replyCalls().length, 1, "answered without the picture");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const Lead = require("../models/Lead");
  const WaConversation = require("../models/WaConversation");
  WaMessage = require("../models/WaMessage");
  for (const M of [Lead, WaConversation, WaMessage]) await M.init();
  for (const c of ["projects", "waagents", "aiusages", "organizations", "routingrules", "users", "automations"]) await mongoose.connection.createCollection(c).catch(() => {});
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "growth", autoAssign: false,
    whatsapp: { enabled: true, provider: "meta", apiKey: "fake-token", phoneNumberId: "1234567890", botEnabled: true },
  });
  org = await mongoose.connection.collection("organizations").findOne({ _id: ORG });
  await mongoose.connection.collection("waagents").insertOne({ _id: oid(), orgId: ORG, name: "Riya", status: "active", isDefault: true, adIds: [], greetingEnabled: false, createdAt: new Date() });
  wa = require("../routes/whatsappRoutes");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp: photos, voice notes and documents from customers");
})();
