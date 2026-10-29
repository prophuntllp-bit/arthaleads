// Artha suggestion card: what the customer said on WhatsApp that differs from
// the lead becomes a suggestion (never a silent overwrite); Save applies it
// with a history note signed "(via Artha)"; Dismiss drops it for good; only
// people who can see the lead, in pilot companies, can act on it.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const express = require("express");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["users", "organizations", "leads", "projects", "waagents", "waconversations", "wamessages", "aiusages"]) await mongoose.connection.createCollection(c).catch(() => {});
  const axios = require("axios");
  let reply = {};
  axios.post = async () => ({ data: { choices: [{ message: { content: JSON.stringify(reply) } }], usage: {} } });
  require("../utils/ai/gateway").createChatCompletion = async (body) => (await axios.post("https://api.openai.com/v1/chat/completions", body)).data;
  const { enrichWhatsAppLead } = require("../routes/whatsappRoutes")._leadCapture;
  const Organization = require("../models/Organization"), User = require("../models/User"), Lead = require("../models/Lead"), WaMessage = require("../models/WaMessage");
  const oid = () => new mongoose.Types.ObjectId();
  console.log("\nArtha suggestion card\n");

  const orgId = oid(), plainOrg = oid();
  await Organization.collection.insertMany([
    { _id: orgId, name: "Prophunt", isActive: true, plan: "growth", approvalStatus: "approved", copilot: { beta: true, enabled: true } },
    { _id: plainOrg, name: "Other", isActive: true, plan: "growth", approvalStatus: "approved", copilot: { beta: false } },
  ]);
  const A = { _id: oid(), orgId, role: "agent", name: "Soniya", email: "s@example.com", isActive: true };
  const B = { _id: oid(), orgId, role: "agent", name: "Arjun", email: "a@example.com", isActive: true };
  await User.collection.insertMany([A, B]);
  const lead = { _id: oid(), orgId, name: "Rahul Verma", phone: "919800001111", source: "WhatsApp", status: "Contacted", assignedTo: A._id, createdBy: A._id, propertyType: "Plot", purpose: "N/A", bhk: "2BHK", preferredLocation: "Khopoli", budget: { min: 0, max: 0 }, activities: [], notes: [], isDeleted: false, isArchived: false };
  await Lead.collection.insertOne(lead);
  const conv = { _id: oid(), orgId, leadId: lead._id, contactName: "Rahul Verma" };
  let t = Date.now() - 3600e3;
  const msgs = [["Hi, details of the Khopoli plots please"], ["Actually I want a 3BHK in Wakad, budget 90 lakh"]].map(([b], i) => ({ _id: oid(), conversationId: conv._id, orgId, direction: "inbound", sender: "customer", body: b, mediaType: "text", timestamp: new Date(t += 60000 * (i + 1)) }));
  await WaMessage.collection.insertMany(msgs);

  reply = { bhk: "3BHK", location: "Wakad", budget_min: 9000000, budget_max: 9000000 };
  await enrichWhatsAppLead(conv, msgs, { org: { _id: orgId } });
  let l = await Lead.findById(lead._id).lean();
  check(l.bhk === "2BHK" && l.preferredLocation === "Khopoli", "values already on the lead are not overwritten automatically");
  check(l.budget.max === 9000000, "an empty field (budget) is still filled automatically", JSON.stringify(l.budget));
  check(l.arthaSuggest?.fields?.bhk === "3BHK" && l.arthaSuggest.fields.preferredLocation === "Wakad" && !("budget" in l.arthaSuggest.fields), "the differing values become suggestions", JSON.stringify(l.arthaSuggest));

  const app = express();
  app.use(express.json());
  app.use("/api/copilot", require("../routes/copilotRoutes"));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/copilot`;
  const as = (u) => ({ authorization: `Bearer ${jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "1h" })}`, "content-type": "application/json" });
  const post = (u, body) => fetch(`${base}/suggestions/${lead._id}`, { method: "POST", headers: as(u), body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));

  const f = await fetch(`${base}/features`, { headers: as(A) }).then((r) => r.json());
  check(f.features?.suggestions === true, "pilot companies have suggestions on");
  let r = await post(B, { action: "save" });
  check(r.status === 404, "a colleague who can't see the lead can't act on it");

  r = await post(A, { action: "save", fields: ["preferredLocation"] });
  l = await Lead.findById(lead._id).lean();
  check(r.status === 200 && l.preferredLocation === "Wakad" && l.bhk === "2BHK", "Save applies only the ticked field", JSON.stringify({ s: r.status, loc: l.preferredLocation, bhk: l.bhk }));
  const note = l.notes.slice(-1)[0]?.text || "";
  check(/Preferred location: Khopoli to Wakad/.test(note), "a note records what changed, from and to", note);
  check(l.activities.some((a) => /via Artha/.test(a.description || "")), "the history entry is signed '(via Artha)'");
  check(l.arthaSuggest.fields.bhk === "3BHK" && !("preferredLocation" in l.arthaSuggest.fields), "the other suggestion stays until handled");

  r = await post(A, { action: "dismiss", fields: ["bhk"] });
  l = await Lead.findById(lead._id).lean();
  check(r.status === 200 && !Object.keys(l.arthaSuggest.fields || {}).length && l.bhk === "2BHK", "Dismiss drops it without changing the lead");
  await enrichWhatsAppLead(conv, msgs, { org: { _id: orgId } });
  l = await Lead.findById(lead._id).lean();
  check(!l.arthaSuggest?.fields?.bhk, "a dismissed value is not suggested again", JSON.stringify(l.arthaSuggest));

  reply = { bhk: "4BHK" };
  await enrichWhatsAppLead(conv, msgs, { org: { _id: orgId } });
  l = await Lead.findById(lead._id).lean();
  check(l.arthaSuggest?.fields?.bhk === "4BHK", "a new, different value is suggested");
  reply = { bhk: "2BHK" };
  await enrichWhatsAppLead(conv, msgs, { org: { _id: orgId } });
  l = await Lead.findById(lead._id).lean();
  check(!l.arthaSuggest?.fields?.bhk, "a suggestion that now matches the lead disappears");

  server.close();
  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all suggestion card checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
