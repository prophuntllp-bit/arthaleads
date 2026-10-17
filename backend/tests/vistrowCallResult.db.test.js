// POST /webhook/lead from Vistrow Voice (a call result), against a real
// in-memory MongoDB and the real route. Fixes of 2026-10-15:
//  * a call for a lead ArthaLeads sent (arthaleads_lead_id) updates that lead;
//  * otherwise the lead is matched on the last 10 digits of the phone, like
//    the CRM's own duplicate rule (an exact match split one person in two);
//  * a re-sent call is never appended twice, whatever the lead's source;
//  * crm_outcome moves status forward only, sets booking / follow-up / site
//    visit, and adds a note + activity, also on an existing lead;
//  * a mis-heard email or long name no longer fails the delivery (500).
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const { planOutcome, phoneFilter, cleanEmail, cleanName } = require("../utils/vistrowCallResult");

const oid = () => new mongoose.Types.ObjectId();
const NOW = new Date("2026-10-15T10:00:00Z");
const future = (h) => new Date(Date.now() + h * 3600e3).toISOString();

// ---------------------------------------------------------------- pure rules
test("status only moves forward and never leaves a closed lead", () => {
  assert.equal(planOutcome({ status: "New" }, { status: "Contacted" }, NOW).set.status, "Contacted");
  assert.equal(planOutcome({ status: "Site Visit" }, { status: "Contacted" }, NOW).set.status, undefined);
  assert.equal(planOutcome({ status: "Closed Won" }, { status: "Site Visit" }, NOW).set.status, undefined);
  assert.equal(planOutcome({ status: "Closed Lost" }, { status: "Contacted" }, NOW).set.status, undefined);
  assert.equal(planOutcome({ status: "New" }, { status: "Bogus" }, NOW).set.status, undefined);
});

test("booking: valid values only, strong bookings kept, Not Reachable never erases a result", () => {
  assert.equal(planOutcome({ booking: "" }, { booking: "Call Back" }, NOW).set.booking, "Call Back");
  assert.equal(planOutcome({ booking: "Booked" }, { booking: "Not Interested" }, NOW).set.booking, undefined);
  assert.equal(planOutcome({ booking: "Site Visit Done" }, { booking: "Site Visit Booked" }, NOW).set.booking, undefined);
  assert.equal(planOutcome({ booking: "Interested" }, { booking: "Not Reachable" }, NOW).set.booking, undefined);
  assert.equal(planOutcome({ booking: "" }, { booking: "Not Reachable" }, NOW).set.booking, "Not Reachable");
  assert.equal(planOutcome({ booking: "" }, { booking: "Maybe" }, NOW).set.booking, undefined);
});

test("follow-up and site visit: real, not past; an earlier upcoming follow-up is kept", () => {
  const at = "2026-10-20T18:30:00+05:30";
  const p = planOutcome({}, { follow_up_at: at, note: "after Diwali" }, NOW);
  assert.equal(p.set.followUpDate.toISOString(), new Date(at).toISOString());
  assert.equal(p.set.followUpNote, "after Diwali");
  assert.equal(p.activities.some((a) => a.type === "follow_up_set"), true);
  assert.equal(planOutcome({}, { follow_up_at: "2026-10-01T10:00:00+05:30" }, NOW).set.followUpDate, undefined, "past");
  assert.equal(planOutcome({}, { follow_up_at: "not a date" }, NOW).set.followUpDate, undefined);
  const earlier = new Date("2026-10-16T10:00:00Z");
  assert.equal(planOutcome({ followUpDate: earlier }, { follow_up_at: at }, NOW).set.followUpDate, undefined);
  const visit = planOutcome({}, { site_visit_at: "2026-10-17T11:00:00+05:30" }, NOW);
  assert.equal(visit.set.siteVisitDate.toISOString(), "2026-10-17T05:30:00.000Z");
  assert.equal(visit.activities[0].type, "site_visit");
});

test("garbage outcome is ignored", () => {
  for (const o of [undefined, null, "x", [], { booking: 5 }]) assert.deepEqual(planOutcome({}, o, NOW).set, {});
});

test("phone filter matches on the last 10 digits", () => {
  const f = phoneFilter("org", "+91 98123-45678");
  assert.equal(new RegExp(f.phone.$regex).test("9812345678"), true);
  assert.equal(new RegExp(f.phone.$regex).test("09812345678"), true);
  assert.equal(new RegExp(f.phone.$regex).test("9812345679"), false);
});

test("email and name cleaning", () => {
  assert.equal(cleanEmail("Ravi.Kumar@Gmail.com "), "ravi.kumar@gmail.com");
  assert.equal(cleanEmail("ravi at gmail dot com"), "");
  assert.equal(cleanName("  Ravi   Kumar ").length, 10);
  assert.equal(cleanName("x".repeat(300)).length, 100);
});

// ---------------------------------------------------------------- the route
let base, mongod, server, Lead, ORG;
const TOKEN = "tok-vistrow-test";

async function post(body) {
  const res = await fetch(`${base}/webhook/lead`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: TOKEN, ...body }),
  });
  return { status: res.status, body: await res.json() };
}

const call = (id, extra = {}) => ({
  name: "Ravi Kumar", phone: "+919812345678", call_id: id, duration_seconds: 95, language: "te-IN",
  transcript: [{ speaker: "Agent", text: "Namaskaram" }, { speaker: "Caller", text: "Cheppandi" }], ...extra,
});

test("new caller: lead created with the call's outcome; bad email does not 500", async () => {
  const r = await post(call(5001, { email: "ravi at gmail", crm_outcome: { booking: "Call Back", status: "Contacted", follow_up_at: future(48) } }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const lead = await Lead.findById(r.body.leadId).lean();
  assert.equal(lead.email, "");
  assert.equal(lead.status, "Contacted");
  assert.equal(lead.booking, "Call Back");
  assert.ok(lead.followUpDate);
  assert.equal(lead.activities.some((a) => a.type === "follow_up_set"), true);
});

test("re-send of the same call updates it, never duplicates", async () => {
  const again = await post(call(5001, { crm_outcome: { booking: "Call Back" } }));
  assert.equal(again.status, 200);
  const leads = await Lead.find({ orgId: ORG, "voiceCalls.externalCallId": 5001 }).lean();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].voiceCalls.length, 1);
});

test("existing Facebook lead typed without +91 gets the call (no duplicate lead) and moves to Site Visit", async () => {
  const fb = await Lead.create({ name: "Sita", phone: "9988776655", source: "Facebook", orgId: ORG, status: "New" });
  const r = await post(call(5002, { name: "Sita", phone: "+919988776655", direction: "outbound",
    crm_outcome: { booking: "Site Visit Booked", status: "Site Visit", site_visit_at: future(30) } }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(String(r.body.leadId), String(fb._id));
  const lead = await Lead.findById(fb._id).lean();
  assert.equal(await Lead.countDocuments({ orgId: ORG, phone: { $regex: "9988776655$" } }), 1);
  assert.equal(lead.status, "Site Visit");
  assert.equal(lead.booking, "Site Visit Booked");
  assert.ok(lead.siteVisitDate);
  assert.equal(lead.voiceCalls.length, 1);
  assert.equal(lead.notes.length, 1, "call summary note added");
  assert.deepEqual(lead.activities.map((a) => a.type).sort(), ["called", "site_visit", "status_changed"].sort());

  // Re-sent: still one call on that Facebook lead (used to append again).
  await post(call(5002, { name: "Sita", phone: "+919988776655" }));
  assert.equal((await Lead.findById(fb._id).lean()).voiceCalls.length, 1);
});

test("arthaleads_lead_id targets that exact lead, but never another org's", async () => {
  const target = await Lead.create({ name: "Arjun", phone: "9000011111", source: "Website", orgId: ORG, status: "Contacted" });
  const r = await post(call(5003, { name: "Arjun", phone: "+919000099999", arthaleads_lead_id: String(target._id),
    crm_outcome: { booking: "Interested", status: "Contacted" } }));
  assert.equal(String(r.body.leadId), String(target._id));
  assert.equal((await Lead.findById(target._id).lean()).booking, "Interested");

  const foreign = await Lead.create({ name: "Other", phone: "9111122222", source: "Website", orgId: oid(), status: "New" });
  const r2 = await post(call(5004, { name: "Mohan", phone: "+919777766666", arthaleads_lead_id: String(foreign._id) }));
  assert.notEqual(String(r2.body.leadId), String(foreign._id));
  assert.equal((await Lead.findById(foreign._id).lean()).voiceCalls?.length || 0, 0);
});

test("a later no-answer never downgrades a closed or booked lead", async () => {
  const won = await Lead.create({ name: "Won", phone: "9333344444", source: "Manual", orgId: ORG, status: "Closed Won", booking: "Booked" });
  await post(call(5005, { name: "Won", phone: "+919333344444", direction: "outbound", transcript: [],
    crm_outcome: { booking: "Not Reachable" } }));
  const lead = await Lead.findById(won._id).lean();
  assert.equal(lead.status, "Closed Won");
  assert.equal(lead.booking, "Booked");
  assert.equal(lead.voiceCalls.length, 1);
});

test("deleted leads are not matched by phone", async () => {
  await Lead.create({ name: "Gone", phone: "9444455555", source: "Manual", orgId: ORG, isDeleted: true });
  const r = await post(call(5006, { name: "Back", phone: "+919444455555" }));
  assert.equal(r.status, 201);
});

test("an org below Enterprise still gets the plan 403", async () => {
  await mongoose.connection.collection("organizations").updateOne({ _id: ORG }, { $set: { plan: "growth" } });
  const r = await post(call(5007));
  assert.equal(r.status, 403);
  await mongoose.connection.collection("organizations").updateOne({ _id: ORG }, { $set: { plan: "enterprise" } });
});

// ---------------------------------------------------------------- caller's name (17 Oct 2026)
// A WhatsApp lead is named after the profile ("😊", "+91..."). The AI agent
// asks the caller's name; a real one replaces a name that is not one.
let nameSeq = 0;
async function nameCase(leadName, callName, contactName = leadName) {
  const phone = `98123${String(70000 + ++nameSeq)}`;
  const lead = await Lead.create({ name: leadName, phone, source: "WhatsApp", orgId: ORG, status: "New" });
  const conv = await mongoose.connection.collection("waconversations").insertOne({ orgId: ORG, leadId: lead._id, contactPhone: `91${phone}`, contactName });
  const r = await post(call(5100 + nameSeq, { name: callName, phone: `+91${phone}`, arthaleads_lead_id: String(lead._id) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return {
    lead: await Lead.findById(lead._id).lean(),
    conv: await mongoose.connection.collection("waconversations").findOne({ _id: conv.insertedId }),
  };
}
const renamed = (lead) => lead.activities.filter((a) => /^Name updated from Vistrow Voice call/.test(a.description));

test("a WhatsApp lead named by an emoji or its number takes the real name said on the call", async () => {
  for (const before of ["🙏🙏", "+919812370099"]) {
    const { lead, conv } = await nameCase(before, "  Priya   Sharma ");
    assert.equal(lead.name, "Priya Sharma", before);
    assert.equal(conv.contactName, "Priya Sharma", "the chat's display name too");
    assert.deepEqual(renamed(lead).map((a) => a.type), ["vistrow_voice"]);
    assert.deepEqual(renamed(lead).map((a) => a.description), [`Name updated from Vistrow Voice call: ${before} → Priya Sharma`]);
    assert.equal(lead.voiceCalls.length, 1, "the call is still added");
  }
});

test("a real name on the lead is never replaced by the call's name", async () => {
  const { lead, conv } = await nameCase("Rakesh Pal", "Priya Sharma");
  assert.equal(lead.name, "Rakesh Pal");
  assert.equal(conv.contactName, "Rakesh Pal");
  assert.equal(renamed(lead).length, 0);
});

test("filler or an emoji heard as the name on the call changes nothing", async () => {
  for (const said of ["ji", "hello", "Haan ji", "😊😊"]) {
    const { lead, conv } = await nameCase("+919812370098", said);
    assert.equal(lead.name, "+919812370098", said);
    assert.equal(conv.contactName, "+919812370098", said);
    assert.equal(renamed(lead).length, 0, said);
  }
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  await Lead.init();
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false });
  await mongoose.connection.collection("automations").insertOne({
    _id: oid(), name: "Vistrow Voice", platform: "Vistrow Voice", verifyToken: TOKEN, isActive: true, orgId: ORG,
    createdBy: oid(), updatedBy: oid(),
  });
  const app = express();
  app.use("/webhook", require("../routes/webhookRoutes"));
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow Voice call results into ArthaLeads");
})();
