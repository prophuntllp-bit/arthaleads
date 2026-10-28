// Lead erasure (DPDP, owner, 28 Oct 2026): a permanent delete removes the lead
// and what hangs off it -- its WhatsApp conversation and messages, its project
// copies, its call recording and WhatsApp media files (and their ledger rows),
// tasks and reminders about it -- while keeping bookings (financial records),
// files and chats still used by another record, and the other tenant's data.
process.env.NODE_ENV = "test";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

// Fake bucket: storage.erase is what the erasure calls for every file.
const storage = require("../utils/storage");
const erased = [];
let failKey = null;
storage.isConfigured = () => true;
storage.erase = async (key) => {
  if (key === failKey) throw new Error("bucket said no");
  erased.push(key);
  await require("../utils/storageLedger").forget(key);
  return 1;
};

const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const WaConversation = require("../models/WaConversation");
const WaMessage = require("../models/WaMessage");
const StorageObject = require("../models/StorageObject");
const Task = require("../models/Task");
const Booking = require("../models/Booking");
const EventReminder = require("../models/EventReminder");
const leadService = require("../services/leadService");
const projectService = require("../services/projectService");

const oid = () => new mongoose.Types.ObjectId();
const ORG = oid(), OTHER = oid(), ADMIN = oid(), PROJECT = oid();
const media = (key) => `https://api.arthaleads.com/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
let db;

// One person with everything: a call recording, a WhatsApp chat with a photo,
// a project copy, a routing copy, a task, a reminder and a booking.
async function seedPerson({ phone, name, orgId = ORG, tag }) {
  const leadId = oid(), convId = oid();
  const createdAt = new Date();
  const recKey = `arthaleads/recordings/call-${tag}.wav`;
  const photoKey = `arthaleads/wa-inbound/${orgId}/2026-10/${tag}.jpg`;
  const voiceKey = `arthaleads/wa-inbound/${orgId}/2026-10/${tag}-voice.ogg`;
  const brochureKey = `arthaleads/brochures/project-${PROJECT}`;
  await db.collection("leads").insertOne({
    _id: leadId, orgId, name, phone, createdAt, isDeleted: true,
    activities: [{ type: "call", description: "Call", meta: { recordingUrl: media(recKey) }, createdAt }],
  });
  await db.collection("projectleads").insertMany([
    { _id: oid(), orgId, project: PROJECT, name, phone, fromLeadId: leadId, createdAt },                 // moved copy
    { _id: oid(), orgId, project: PROJECT, name, phone: `+91${phone.slice(-10)}`, fromLeadId: null, createdAt }, // routing copy
  ]);
  await db.collection("waconversations").insertOne({ _id: convId, orgId, leadId, contactPhone: `91${phone.slice(-10)}`, contactName: name });
  await db.collection("wamessages").insertMany([
    { orgId, conversationId: convId, direction: "inbound", sender: "customer", body: "Hi", mediaType: "image", mediaUrl: media(photoKey) },
    { orgId, conversationId: convId, direction: "inbound", sender: "customer", body: "", mediaType: "audio", mediaUrl: media(voiceKey) },
    // A brochure the team sent: the org's file, not the person's.
    { orgId, conversationId: convId, direction: "outbound", sender: "agent", body: "Brochure", mediaType: "document", mediaUrl: media(brochureKey) },
  ]);
  for (const key of [recKey, photoKey, voiceKey, brochureKey]) {
    await db.collection("storageobjects").updateOne({ key }, { $set: { orgId, key, bytes: 100, category: "other" } }, { upsert: true });
  }
  await db.collection("tasks").insertOne({ orgId, title: `Call ${name}`, lead: leadId, leadName: name, dueDate: new Date(), assignedTo: ADMIN, assignedBy: ADMIN });
  await db.collection("eventreminders").insertOne({ orgId, agentId: oid(), conversationId: convId, leadId, phone, name, sendAt: new Date() });
  const bookingId = oid();
  await db.collection("bookings").insertOne({ _id: bookingId, orgId, leadId, customerName: name, projectName: "Neoliv", unitNo: "A-101", developerId: oid() });
  return { leadId, convId, recKey, photoKey, voiceKey, brochureKey, bookingId };
}

test("Dump Leads permanent delete erases the lead, its chat, project copies and files", async () => {
  erased.length = 0;
  const p = await seedPerson({ phone: "9876500001", name: "Asha Kulkarni", tag: "a" });
  // An unrelated project import of someone else.
  await db.collection("projectleads").insertOne({ orgId: ORG, project: PROJECT, name: "Other", phone: "9000000000", fromLeadId: null, createdAt: new Date() });

  await leadService.permanentDelete(String(p.leadId), ORG);

  assert.equal(await Lead.countDocuments({ _id: p.leadId }), 0, "lead gone");
  assert.equal(await ProjectLead.countDocuments({ orgId: ORG, phone: { $in: ["9876500001", "+919876500001"] } }), 0, "project copies gone");
  assert.equal(await ProjectLead.countDocuments({ orgId: ORG, phone: "9000000000" }), 1, "someone else's project entry untouched");
  assert.equal(await WaConversation.countDocuments({ _id: p.convId }), 0, "conversation gone");
  assert.equal(await WaMessage.countDocuments({ conversationId: p.convId }), 0, "messages gone");
  assert.equal(await Task.countDocuments({ lead: p.leadId }), 0, "task about the lead gone");
  assert.equal(await EventReminder.countDocuments({ leadId: p.leadId }), 0, "event reminder gone");
  for (const k of [p.recKey, p.photoKey, p.voiceKey]) {
    assert.ok(erased.includes(k), `storage erase called for ${k}`);
    assert.equal(await StorageObject.countDocuments({ key: k }), 0, `ledger row for ${k} gone`);
  }
  assert.ok(!erased.includes(p.brochureKey), "the project brochure sent in the chat is not erased");
  assert.equal(await StorageObject.countDocuments({ key: p.brochureKey }), 1);
  const booking = await Booking.findById(p.bookingId).lean();
  assert.ok(booking, "booking kept (financial record)");
  assert.equal(booking.leadId, null, "booking unlinked from the erased lead");
});

test("another record with the same number keeps the chat (unlinked) and shared files", async () => {
  erased.length = 0;
  const p = await seedPerson({ phone: "9876500002", name: "Ravi Shinde", tag: "b" });
  // A duplicate live lead for the same person, which also has the same recording.
  await db.collection("leads").insertOne({
    orgId: ORG, name: "Ravi Shinde", phone: "+91 9876500002", createdAt: new Date(Date.now() - 86400000 * 30),
    activities: [{ type: "call", description: "Call", meta: { recordingUrl: media(p.recKey) }, createdAt: new Date() }],
  });

  await leadService.permanentDelete(String(p.leadId), ORG);

  assert.equal(await Lead.countDocuments({ _id: p.leadId }), 0);
  const conv = await WaConversation.findById(p.convId).lean();
  assert.ok(conv, "conversation kept for the remaining record");
  assert.equal(conv.leadId, null, "but no longer linked to the erased lead");
  assert.equal(await WaMessage.countDocuments({ conversationId: p.convId }), 3, "messages kept with it");
  assert.ok(!erased.includes(p.recKey), "a recording the duplicate still uses is kept");
  assert.ok(!erased.includes(p.photoKey), "chat media kept with the chat");
});

test("a project import of the same number from months earlier is a separate record: kept, and so is the chat", async () => {
  erased.length = 0;
  const p = await seedPerson({ phone: "9876500010", name: "Old Import", tag: "j" });
  await db.collection("projectleads").insertOne({ orgId: ORG, project: PROJECT, name: "Old Import", phone: "09876500010", fromLeadId: null, createdAt: new Date(Date.now() - 60 * 86400000) });
  await leadService.permanentDelete(String(p.leadId), ORG);
  assert.equal(await ProjectLead.countDocuments({ fromLeadId: p.leadId }), 0, "the moved copy goes");
  assert.equal(await ProjectLead.countDocuments({ orgId: ORG, phone: "09876500010" }), 1, "the earlier import stays");
  assert.equal(await ProjectLead.countDocuments({ orgId: ORG, phone: "+919876500010" }), 0, "the routing copy goes");
  assert.equal(await WaConversation.countDocuments({ _id: p.convId }), 1, "chat kept for the record that remains");
});

test("super admin delete and bulk delete erase the same way", async () => {
  erased.length = 0;
  const a = await seedPerson({ phone: "9876500003", name: "Meera Joshi", tag: "c" });
  const b = await seedPerson({ phone: "9876500004", name: "Kiran Patil", tag: "d" });
  const c = await seedPerson({ phone: "9876500005", name: "Sunil Pawar", tag: "e" });
  const sa = { _id: ADMIN, orgId: ORG, role: "super_admin", name: "SA" };

  await leadService.delete(String(a.leadId), sa);
  const n = await leadService.bulkDelete([String(b.leadId), String(c.leadId)], sa);

  assert.equal(n, 2, "bulk delete reports the leads removed");
  for (const p of [a, b, c]) {
    assert.equal(await Lead.countDocuments({ _id: p.leadId }), 0);
    assert.equal(await WaConversation.countDocuments({ _id: p.convId }), 0);
    assert.equal(await ProjectLead.countDocuments({ fromLeadId: p.leadId }), 0);
    assert.ok(erased.includes(p.recKey) && erased.includes(p.photoKey));
  }
});

test("a normal delete is still a soft delete into Dump Leads, nothing erased", async () => {
  erased.length = 0;
  const p = await seedPerson({ phone: "9876500006", name: "Neha Rao", tag: "f" });
  await db.collection("leads").updateOne({ _id: p.leadId }, { $set: { isDeleted: false } });
  await leadService.delete(String(p.leadId), { _id: ADMIN, orgId: ORG, role: "admin", name: "Admin" });
  const lead = await Lead.findById(p.leadId).lean();
  assert.equal(lead.isDeleted, true);
  assert.equal(await WaConversation.countDocuments({ _id: p.convId }), 1);
  assert.equal(erased.length, 0);
});

test("super admin project-lead delete erases its recording and, with no one left, its chat", async () => {
  erased.length = 0;
  const plId = oid(), convId = oid();
  const recKey = "arthaleads/recordings/call-pl.wav";
  await db.collection("projects").insertOne({ _id: PROJECT, orgId: ORG, name: "Neoliv", createdBy: ADMIN, assignedTo: [] });
  await db.collection("projectleads").insertOne({ _id: plId, orgId: ORG, project: PROJECT, name: "Pooja", phone: "9876500007",
    activities: [{ type: "call", description: "Call", meta: { recordingUrl: media(recKey) }, createdAt: new Date() }] });
  await db.collection("waconversations").insertOne({ _id: convId, orgId: ORG, contactPhone: "919876500007" });
  await db.collection("wamessages").insertOne({ orgId: ORG, conversationId: convId, direction: "inbound", sender: "customer", body: "hello" });

  await projectService.deleteLead(String(plId), { _id: ADMIN, orgId: ORG, role: "super_admin", name: "SA" });

  assert.equal(await ProjectLead.countDocuments({ _id: plId }), 0);
  assert.equal(await WaConversation.countDocuments({ _id: convId }), 0);
  assert.equal(await WaMessage.countDocuments({ conversationId: convId }), 0);
  assert.ok(erased.includes(recKey));
});

test("a file that will not delete is logged and does not stop the erasure", async () => {
  erased.length = 0;
  const p = await seedPerson({ phone: "9876500008", name: "Amit Deshmukh", tag: "g" });
  failKey = p.recKey;
  await leadService.permanentDelete(String(p.leadId), ORG);
  failKey = null;
  assert.equal(await Lead.countDocuments({ _id: p.leadId }), 0);
  assert.ok(erased.includes(p.photoKey), "the other files still go");
  assert.equal(await StorageObject.countDocuments({ key: p.recKey }), 1, "the failed file stays in the ledger so it is still counted and findable");
});

test("never reaches another org: same number elsewhere, or another org's file", async () => {
  erased.length = 0;
  const theirs = await seedPerson({ phone: "9876500009", name: "Other Tenant Lead", orgId: OTHER, tag: "h" });
  const p = await seedPerson({ phone: "9876500009", name: "Same Number Here", tag: "i" });
  // A URL to the other org's recording pasted onto this lead.
  await db.collection("leads").updateOne({ _id: p.leadId }, { $push: { activities: { type: "note", description: "x", meta: { recordingUrl: media(theirs.recKey) }, createdAt: new Date() } } });

  await leadService.permanentDelete(String(p.leadId), ORG);

  assert.equal(await Lead.countDocuments({ _id: theirs.leadId }), 1);
  assert.equal(await WaConversation.countDocuments({ _id: theirs.convId }), 1);
  assert.equal(await ProjectLead.countDocuments({ orgId: OTHER }), 2);
  assert.ok(!erased.includes(theirs.recKey), "the other org's recording is not erased");
  assert.ok(erased.includes(p.recKey));
  await assert.rejects(leadService.permanentDelete(String(theirs.leadId), ORG), /not found/i, "cannot erase another org's lead");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
  for (const M of [Lead, ProjectLead, WaConversation, WaMessage, StorageObject]) await M.syncIndexes();
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Lead erasure (DPDP)");
})();
