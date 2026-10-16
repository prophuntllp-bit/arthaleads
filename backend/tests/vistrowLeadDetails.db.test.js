// Vistrow Voice call result -> an EXISTING lead's details, the status pill
// marker and the brochure request (16 Oct 2026), against a real in-memory
// MongoDB and the real POST /webhook/lead route.
//  * details the caller stated fill a field only while it is empty, with the
//    same rules as the WhatsApp chat reader (utils/leadFieldFill.js);
//  * a value already on the lead is never overwritten; a different value the
//    caller said becomes an Artha suggestion marked as from the call;
//  * the note carries summary + key points;
//  * a status set by the call is marked (statusSetBy) and a person's change clears it;
//  * crm_outcome.brochure_requested -> one task (assignee, else admins), a push
//    and an activity, once per (lead, call_id), also across re-sends.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");

const oid = () => new mongoose.Types.ObjectId();
let base, mongod, server, Lead, Task, User, ORG, AGENT, ADMIN1, ADMIN2;
const TOKEN = "tok-vistrow-details";

async function post(body) {
  const res = await fetch(`${base}/webhook/lead`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: TOKEN, ...body }),
  });
  return { status: res.status, body: await res.json() };
}

const CRORE = { budget_min: 10000000, budget_max: 10000000, purpose: "Buy" };
const call = (id, phone, extra = {}) => ({
  name: "Vistrow Test", phone, call_id: id, duration_seconds: 120, direction: "outbound",
  transcript: [{ speaker: "Agent", text: "Namaste" }, { speaker: "Caller", text: "Budget ek crore" }], ...extra,
});

// ---------------------------------------------------------------- pure rules (shared helper)
test("shared fill rules: empty fields filled, real values kept, project guess replaced", () => {
  const { planFieldFill, suggestionsFrom } = require("../utils/leadFieldFill");
  const empty = { propertyType: "N/A", purpose: "N/A", bhk: "N/A", preferredLocation: "", budget: { min: 0, max: 0 } };
  const said = { propertyType: "Plot", purpose: "Buy", budget: { min: 1e7, max: 1e7, currency: "INR" }, preferredLocation: "Hinjewadi" };
  assert.deepEqual(Object.keys(planFieldFill(empty, said)).sort(), ["budget", "preferredLocation", "propertyType", "purpose"]);
  const set = { propertyType: "Apartment", purpose: "Invest", bhk: "N/A", preferredLocation: "Wakad", budget: { min: 5e6, max: 6e6 } };
  assert.deepEqual(planFieldFill(set, said), {});
  assert.deepEqual(Object.keys(suggestionsFrom(set, said, {})).sort(), ["budget", "preferredLocation", "propertyType", "purpose"]);
  // A type the CRM guessed from the project may be corrected by the buyer.
  assert.equal(planFieldFill({ ...empty, propertyType: "Villa" }, { propertyType: "Plot" }, { projectType: "Villa" }).propertyType, "Plot");
  // Null budget (contract wording) counts as empty too.
  assert.ok(planFieldFill({ ...empty, budget: { min: null, max: null } }, said).budget);
});

// ---------------------------------------------------------------- the route
test("existing lead with empty budget/purpose gets ₹1 Cr / Buy, one activity, summary in the note", async () => {
  const lead = await Lead.create({ name: "Empty One", phone: "9876500001", source: "Facebook", orgId: ORG, status: "New",
    propertyType: "N/A", purpose: "N/A", bhk: "N/A", budget: { min: null, max: null, currency: "INR" } });
  const r = await post(call(7001, "+919876500001", {
    arthaleads_lead_id: String(lead._id),
    extracted_data: { ...CRORE, budget_text: "around 1 crore", property_type: "Plot", configuration: "plot 2000 sq ft and above", preferred_location: "Hinjewadi" },
    summary: "Wants a plot for future self-use, budget around 1 crore.",
    key_points: ["Interested for future self-use", "Budget around 1 crore"],
  }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.budget.min, 10000000);
  assert.equal(after.budget.max, 10000000);
  assert.equal(after.budget.currency, "INR");
  assert.equal(after.purpose, "Buy");
  assert.equal(after.propertyType, "Plot");
  assert.equal(after.preferredLocation, "Hinjewadi");
  const acts = after.activities.filter((a) => /Lead details updated from Vistrow Voice call/.test(a.description));
  assert.equal(acts.length, 1);
  assert.match(acts[0].description, /Budget ₹1 Cr/);
  assert.match(acts[0].description, /Purpose Buy/);
  const note = after.notes.map((n) => n.text).join("\n");
  assert.match(note, /Wants a plot for future self-use/);
  assert.match(note, /Interested for future self-use/);
  assert.match(note, /Budget Text: around 1 crore/);

  // Re-send: nothing changes again, no second activity.
  await post(call(7001, "+919876500001", { arthaleads_lead_id: String(lead._id), extracted_data: { ...CRORE } }));
  const again = await Lead.findById(lead._id).lean();
  assert.equal(again.activities.filter((a) => /Lead details updated/.test(a.description)).length, 1);
  assert.equal(again.voiceCalls.length, 1);
});

test("a person-set budget / purpose / type / location is NOT overwritten; the difference is a suggestion", async () => {
  const lead = await Lead.create({ name: "Set One", phone: "9876500002", source: "Manual", orgId: ORG, status: "New",
    propertyType: "Apartment", purpose: "Invest", bhk: "2BHK", preferredLocation: "Wakad", budget: { min: 5000000, max: 6000000 } });
  const r = await post(call(7002, "+919876500002", { extracted_data: { ...CRORE, property_type: "Plot", bhk: "3BHK", preferred_location: "Hinjewadi" } }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.budget.min, 5000000);
  assert.equal(after.budget.max, 6000000);
  assert.equal(after.purpose, "Invest");
  assert.equal(after.propertyType, "Apartment");
  assert.equal(after.bhk, "2BHK");
  assert.equal(after.preferredLocation, "Wakad");
  assert.equal(after.activities.some((a) => /Lead details updated/.test(a.description)), false);
  const s = after.arthaSuggest?.fields || {};
  assert.equal(s.propertyType, "Plot");
  assert.equal(s.purpose, "Buy");
  assert.deepEqual(s.budget, { min: 10000000, max: 10000000 });
  assert.equal(after.arthaSuggest.from.propertyType, "vistrow_voice");
  assert.match(after.notes.map((n) => n.text).join("\n"), /Not changed/);
});

test("hand-made lead with form defaults (Apartment/Buy): budget filled, Apartment kept, Plot suggested", async () => {
  const lead = await Lead.create({ name: "Vistrow Test", phone: "9876500003", source: "Manual", orgId: ORG, status: "New" });
  assert.equal(lead.propertyType, "Apartment");
  await post(call(7003, "+919876500003", { extracted_data: { ...CRORE, property_type: "Plot" } }));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.budget.min, 10000000);
  assert.equal(after.propertyType, "Apartment");
  assert.equal(after.purpose, "Buy");
  assert.equal(after.arthaSuggest.fields.propertyType, "Plot");
  assert.equal(after.arthaSuggest.fields.purpose, undefined, "same value is not suggested");
});

test("integration lead (Facebook) with untouched Apartment/Buy defaults: the caller's Plot, budget and timeline fill it", async () => {
  // What the Facebook webhook stores when the form never asked property type / purpose.
  const lead = await Lead.create({ name: "FB Default", phone: "9876500013", source: "Facebook", orgId: ORG, status: "New" });
  assert.equal(lead.propertyType, "Apartment");
  assert.equal(lead.purpose, "Buy");
  await post(call(7013, "+919876500013", { extracted_data: { budget_min: 10000000, budget_max: 10000000, purpose: "Invest", property_type: "Plot", timeline: "within 6 months" } }));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.propertyType, "Plot");
  assert.equal(after.purpose, "Invest");
  assert.equal(after.budget.min, 10000000);
  assert.equal(after.timeline, "within 6 months");
  assert.equal(after.arthaSuggest?.fields?.propertyType, undefined, "filled, not suggested");
  const note = after.notes.map((n) => n.text).join("\n");
  assert.match(note, /Replaced the default: Property type Apartment to Plot, Purpose Buy to Invest/);
  const act = after.activities.find((a) => /Lead details updated/.test(a.description));
  assert.match(act.description, /Timeline within 6 months/);
});

test("a detail a person changed in Edit Lead is theirs: a later call never fills over it", async () => {
  const lead = await Lead.create({ name: "FB Edited", phone: "9876500014", source: "Facebook", orgId: ORG, status: "New", propertyType: "Villa" });
  const leadService = require("../services/leadService");
  const admin = await User.findById(ADMIN1).lean();
  // The Edit Lead form sends every field; only the changed one is marked.
  await leadService.update(String(lead._id), { propertyType: "Apartment", purpose: "Buy", bhk: "N/A", preferredLocation: "" }, { ...admin, orgId: ORG });
  const edited = await Lead.findById(lead._id).lean();
  assert.deepEqual(edited.detailsSetByPerson, ["propertyType"]);
  await post(call(7014, "+919876500014", { extracted_data: { property_type: "Plot", purpose: "Invest" } }));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.propertyType, "Apartment", "a person's pick is kept");
  assert.equal(after.arthaSuggest.fields.propertyType, "Plot");
  assert.equal(after.purpose, "Invest", "purpose was never touched by a person, so the default is filled");
});

test("WhatsApp lead: Apartment there was a person's pick (created as N/A), so it is kept", async () => {
  const lead = await Lead.create({ name: "WA", phone: "9876500015", source: "WhatsApp", orgId: ORG, status: "New", propertyType: "Apartment", purpose: "N/A" });
  await post(call(7015, "+919876500015", { extracted_data: { property_type: "Plot" } }));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.propertyType, "Apartment");
  assert.equal(after.arthaSuggest.fields.propertyType, "Plot");
});

test("a dismissed suggestion is not offered again", async () => {
  const lead = await Lead.create({ name: "Dismissed", phone: "9876500004", source: "Manual", orgId: ORG,
    arthaSuggest: { dismissed: { propertyType: ["Plot"] } } });
  await post(call(7004, "+919876500004", { extracted_data: { property_type: "Plot" } }));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.arthaSuggest?.fields?.propertyType, undefined);
});

test("status set by the call is marked; a person's change clears the mark", async () => {
  const lead = await Lead.create({ name: "Status", phone: "9876500005", source: "Manual", orgId: ORG, status: "New" });
  await post(call(7005, "+919876500005", { crm_outcome: { status: "Contacted", booking: "Interested" } }));
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.status, "Contacted");
  assert.equal(after.statusSetBy?.by, "vistrow_voice");
  assert.equal(after.statusSetBy?.status, "Contacted");
  const leadService = require("../services/leadService");
  const admin = await User.findById(ADMIN1).lean();
  await leadService.update(String(lead._id), { status: "Site Visit" }, { ...admin, orgId: ORG });
  const changed = await Lead.findById(lead._id).lean();
  assert.equal(changed.status, "Site Visit");
  assert.equal(changed.statusSetBy, undefined);
  // New lead created by a call is marked too.
  const r = await post(call(7006, "+919876500006", { name: "Fresh", crm_outcome: { status: "Contacted" } }));
  assert.equal(r.status, 201);
  assert.equal((await Lead.findById(r.body.leadId).lean()).statusSetBy?.by, "vistrow_voice");
});

test("brochure asked on the call: one task for the assignee, push + activity, once across re-sends", async () => {
  const lead = await Lead.create({ name: "Brochure", phone: "9876500007", source: "Manual", orgId: ORG, assignedTo: AGENT, assignedToName: "Agent A" });
  const body = call(7007, "+919876500007", { crm_outcome: { booking: "Interested", brochure_requested: true } });
  await post(body);
  await post(body);
  await Promise.all([post(body), post(body)]);
  const tasks = await Task.find({ orgId: ORG, lead: lead._id }).lean();
  assert.equal(tasks.length, 1);
  assert.equal(String(tasks[0].assignedTo), String(AGENT));
  assert.match(tasks[0].title, /Send brochure \(asked on Vistrow Voice call\)/);
  assert.ok(tasks[0].dueDate.getTime() <= Date.now());
  const after = await Lead.findById(lead._id).lean();
  assert.equal(after.activities.filter((a) => /brochure/i.test(a.description)).length, 1);
  assert.ok(after.voiceCalls[0].brochureRequestedAt);
});

test("brochure flag on a later re-send of a call still creates the task once", async () => {
  const lead = await Lead.create({ name: "Late Flag", phone: "9876500008", source: "Manual", orgId: ORG, assignedTo: AGENT });
  await post(call(7008, "+919876500008"));
  assert.equal(await Task.countDocuments({ lead: lead._id }), 0);
  await post(call(7008, "+919876500008", { crm_outcome: { brochure_requested: true } }));
  await post(call(7008, "+919876500008", { crm_outcome: { brochure_requested: true } }));
  assert.equal(await Task.countDocuments({ lead: lead._id }), 1);
});

test("unassigned lead: a task for each active admin; new lead from a call too", async () => {
  const lead = await Lead.create({ name: "Nobody", phone: "9876500009", source: "Manual", orgId: ORG });
  await post(call(7009, "+919876500009", { crm_outcome: { brochure_requested: true } }));
  const tasks = await Task.find({ lead: lead._id }).lean();
  assert.deepEqual(tasks.map((t) => String(t.assignedTo)).sort(), [String(ADMIN1), String(ADMIN2)].sort());

  const r = await post(call(7010, "+919876500010", { name: "Brand New", crm_outcome: { brochure_requested: true } }));
  assert.equal(r.status, 201);
  await post(call(7010, "+919876500010", { name: "Brand New", crm_outcome: { brochure_requested: true } }));
  assert.equal(await Task.countDocuments({ lead: r.body.leadId }), 2);
});

test("no brochure flag, no task", async () => {
  const lead = await Lead.create({ name: "No Ask", phone: "9876500011", source: "Manual", orgId: ORG, assignedTo: AGENT });
  await post(call(7011, "+919876500011", { crm_outcome: { brochure_requested: "yes" } }));
  assert.equal(await Task.countDocuments({ lead: lead._id }), 0);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  Task = require("../models/Task");
  User = require("../models/User");
  await Lead.init();
  ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Test Realty", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false });
  AGENT = oid(); ADMIN1 = oid(); ADMIN2 = oid();
  await mongoose.connection.collection("users").insertMany([
    { _id: AGENT, name: "Agent A", email: "a@example.com", role: "agent", orgId: ORG, isActive: true },
    { _id: ADMIN1, name: "Admin One", email: "ad1@example.com", role: "admin", orgId: ORG, isActive: true },
    { _id: ADMIN2, name: "Admin Two", email: "ad2@example.com", role: "admin", orgId: ORG, isActive: true },
    { _id: oid(), name: "Old Admin", email: "ad3@example.com", role: "admin", orgId: ORG, isActive: false },
    { _id: oid(), name: "Other Org Admin", email: "ad4@example.com", role: "admin", orgId: oid(), isActive: true },
  ]);
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
  await run("Vistrow Voice call result: lead details, AI status, brochure request");
})();
