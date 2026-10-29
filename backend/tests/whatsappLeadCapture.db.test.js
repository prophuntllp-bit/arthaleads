// Reading lead details out of WhatsApp chats (the model is mocked): location
// only from words the customer typed (never the ad's pre-written opener),
// property type from the chat's project only while empty, and the customer's
// own words correct a project guess but never a person's edit.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["leads", "projects", "waagents", "waconversations", "wamessages", "aiusages", "organizations"]) await mongoose.connection.createCollection(c).catch(() => {});
  const axios = require("axios");
  let reply = {};
  axios.post = async () => ({ data: { choices: [{ message: { content: JSON.stringify(reply) } }], usage: {} } });
  require("../utils/ai/gateway").createChatCompletion = async (body) => (await axios.post("https://api.openai.com/v1/chat/completions", body)).data;
  const { enrichWhatsAppLead, typedByCustomer } = require("../routes/whatsappRoutes")._leadCapture;
  const Lead = require("../models/Lead"), Project = require("../models/Project"), WaAgent = require("../models/WaAgent"), WaMessage = require("../models/WaMessage");
  const oid = () => new mongoose.Types.ObjectId();
  console.log("\nWhatsApp lead details from the chat\n");

  const org = { _id: oid(), plan: "enterprise" };
  const project = { _id: oid(), orgId: org._id, name: "Shapoorji Pallonji Khopoli Plots", location: "Near Khopoli", propertyType: "Plot" };
  await Project.collection.insertOne(project);
  const agent = { _id: oid(), orgId: org._id, name: "Artha", projectIds: [project._id] };
  await WaAgent.collection.insertOne(agent);

  const setup = async (lines, leadExtra = {}) => {
    const lead = { _id: oid(), orgId: org._id, name: "Rahul Verma", source: "WhatsApp", propertyType: "N/A", purpose: "N/A", bhk: "N/A", preferredLocation: "", budget: { min: 0, max: 0 }, ...leadExtra };
    await Lead.collection.insertOne(lead);
    const conv = { _id: oid(), orgId: org._id, leadId: lead._id, agentId: agent._id, contactName: "Rahul Verma", campaignRef: { adId: "1", headline: "Khopoli plots" } };
    let t = Date.now() - 3600e3;
    const msgs = lines.map(([who, body]) => ({ _id: oid(), conversationId: conv._id, orgId: org._id, direction: who === "c" ? "inbound" : "outbound", sender: who === "c" ? "customer" : "bot", body, mediaType: "text", timestamp: new Date(t += 60000) }));
    await WaMessage.collection.insertMany(msgs);
    return { lead, conv, msgs };
  };
  const run = async ({ conv, msgs }, r) => { reply = r; await enrichWhatsAppLead(conv, msgs, { org }); return Lead.findById(conv.leadId).lean(); };

  // The ad's opener names Khopoli; the customer never typed it themselves.
  let c = await setup([["c", "Hi, I'd like details of the new Shapoorji Pallonji plots near Khopoli."], ["b", "Sure! What's your budget?"], ["c", "around 40 lakh"]]);
  let l = await run(c, { location: "Khopoli", budget_min: 4000000, budget_max: 4000000 });
  check(!l.preferredLocation, "a location only in the ad's pre-written message is not saved", l.preferredLocation);
  check(l.propertyType === "Plot" && l.budget.max === 4000000, "property type comes from the chat's project; the typed budget is saved", JSON.stringify({ t: l.propertyType, b: l.budget }));

  // The customer says where they actually want to buy.
  c = await setup([["c", "Hi, I'd like details of the plots near Khopoli."], ["b", "Which location suits you?"], ["c", "Actually I'm looking in Wakad, not Khopoli"]]);
  l = await run(c, { location: "Wakad" });
  check(l.preferredLocation === "Wakad", "a location the customer typed is saved", l.preferredLocation);

  // "I want a flat" after a plot ad corrects the project's guess...
  c = await setup([["c", "Hi, details of the plots near Khopoli"], ["c", "Actually I want a 2BHK flat"]], { propertyType: "Plot" });
  l = await run(c, { property_type: "Apartment", bhk: "2BHK" });
  check(l.propertyType === "Apartment" && l.bhk === "2BHK", "the customer's own words replace the project's guess", JSON.stringify({ t: l.propertyType, b: l.bhk }));

  // ...but never a value a person set.
  c = await setup([["c", "Hi"], ["c", "I want a flat"]], { propertyType: "Villa", preferredLocation: "Lonavala" });
  l = await run(c, { property_type: "Apartment", location: "Pune" });
  check(l.propertyType === "Villa" && l.preferredLocation === "Lonavala", "a value someone already set is never overwritten", JSON.stringify({ t: l.propertyType, loc: l.preferredLocation }));

  check(typedByCustomer("Navi Mumbai", ["looking in navi mumbai area"]) && !typedByCustomer("Khopoli", ["ok", "40 lakh"]), "location check matches the customer's typed words");

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all WhatsApp lead capture checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
