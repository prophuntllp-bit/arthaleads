// Book a Demo requests (26 Oct 2026): the public form saves a DemoRequest,
// alerts the team (contact inbox + super admins) and confirms to the visitor;
// bad input is rejected; super admins list and update them. Email is faked.
process.env.NODE_ENV = "test";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const mails = [];
const email = require("../utils/email");
email.notifyDemoRequest = async (r) => { mails.push({ kind: "team", r }); };
email.sendDemoRequestConfirmation = async (r) => { mails.push({ kind: "visitor", r }); };

let ctrl, DemoRequest;
const res = () => {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const valid = () => ({
  name: "Rajesh Patil", email: "Rajesh@Example.com", phone: "+91 98765 43210", city: "Pune",
  company: "Milestone Properties", role: "Owner / Director", businessType: "Builder / Developer", teamSize: "11-30",
  monthlyLeads: "100-500", leadSources: ["Facebook", "WhatsApp", "Nonsense"], currentTool: "Excel",
  preferredDate: "2026-10-28", preferredTime: "Morning (10 AM-1 PM)", format: "Video call", language: "Hindi",
  message: "<b>Show</b> the WhatsApp agent", source: "/",
});
const flush = () => new Promise((r) => setImmediate(r));

test("a valid request is saved, cleaned, and both emails go out", async () => {
  mails.length = 0;
  const r = res();
  await ctrl.submitDemoRequest({ body: valid() }, r);
  await flush();
  assert.equal(r.code, 201);
  const doc = await DemoRequest.findOne({ company: "Milestone Properties" }).lean();
  assert.ok(doc, "saved");
  assert.equal(doc.email, "rajesh@example.com");
  assert.deepEqual(doc.leadSources, ["Facebook", "WhatsApp"]);
  assert.equal(doc.message, "Show the WhatsApp agent");
  assert.equal(doc.status, "new");
  assert.deepEqual(mails.map((m) => m.kind).sort(), ["team", "visitor"]);
});

test("missing required fields are rejected and nothing is saved", async () => {
  const before = await DemoRequest.countDocuments();
  const r = res();
  await ctrl.submitDemoRequest({ body: { ...valid(), city: "" } }, r);
  assert.equal(r.code, 400);
  assert.equal(await DemoRequest.countDocuments(), before);
});

test("bad email, short phone and made-up choices are rejected", async () => {
  for (const patch of [{ email: "nope" }, { phone: "12345" }, { teamSize: "a million" }, { format: "Carrier pigeon" }]) {
    const r = res();
    await ctrl.submitDemoRequest({ body: { ...valid(), ...patch } }, r);
    assert.equal(r.code, 400, JSON.stringify(patch));
  }
});

test("a failing email does not fail the request", async () => {
  const orig = email.notifyDemoRequest;
  email.notifyDemoRequest = async () => { throw new Error("resend down"); };
  const r = res();
  await ctrl.submitDemoRequest({ body: { ...valid(), company: "Mail Down Realty" } }, r);
  await flush();
  email.notifyDemoRequest = orig;
  assert.equal(r.code, 201);
  assert.ok(await DemoRequest.findOne({ company: "Mail Down Realty" }));
});

test("super admin list counts by status and update records who handled it", async () => {
  const listRes = res();
  await ctrl.listDemoRequests({ query: {} }, listRes, (e) => { throw e; });
  assert.ok(listRes.body.items.length >= 2);
  assert.ok(listRes.body.counts.new >= 2);
  const id = listRes.body.items[0]._id;
  const admin = new mongoose.Types.ObjectId();
  const upd = res();
  await ctrl.updateDemoRequest({ params: { id }, body: { status: "scheduled", notes: "Thu 11 AM" }, user: { _id: admin } }, upd, (e) => { throw e; });
  assert.equal(upd.body.item.status, "scheduled");
  assert.equal(upd.body.item.notes, "Thu 11 AM");
  const bad = res();
  await ctrl.updateDemoRequest({ params: { id }, body: { status: "won" }, user: { _id: admin } }, bad, (e) => { throw e; });
  assert.equal(bad.code, 400);
  const newOnly = res();
  await ctrl.listDemoRequests({ query: { status: "new" } }, newOnly, (e) => { throw e; });
  assert.ok(newOnly.body.items.every((i) => i.status === "new"));
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  require("../models/User");
  DemoRequest = require("../models/DemoRequest");
  ctrl = require("../controllers/demoRequestController");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Book a Demo requests");
})();
