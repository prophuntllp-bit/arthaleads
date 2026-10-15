// scripts/staging-artha-demo.js - Artha pilot features on STAGING only.
//
// Run from the Railway staging service console:  node scripts/staging-artha-demo.js
// Turns on Artha's pilot features (morning brief, reply drafts, newest actions)
// for the staging demo company, and adds one fake WhatsApp chat with "Test
// Lead 1", assigned to the staging agent, so "Draft reply" can be tried in the
// Inbox (with a fake, non-working WhatsApp connection so the Inbox opens). Run it again to bring the chat back inside WhatsApp's 24-hour reply
// window. Same staging-only guard as seed-staging.js.
const env = process.env;
const isStaging = env.BACKGROUND_JOBS === "off"
  && env.AUTH_COOKIE_NAME === "crm_token_staging"
  && /railway\.internal/.test(env.MONGO_URI || "");
if (!isStaging) {
  console.error("[staging-artha-demo] refusing to run: this is not the staging environment (see docs/STAGING.md).");
  process.exit(1);
}

(async () => {
  const mongoose = require("mongoose");
  await mongoose.connect(env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");
  const Lead = require("../models/Lead");
  const WaConversation = require("../models/WaConversation");
  const WaMessage = require("../models/WaMessage");

  const org = await Organization.findOne({ slug: "staging-demo" });
  if (!org) { console.error("[staging-artha-demo] run scripts/seed-staging.js first."); process.exit(1); }
  await Organization.updateOne({ _id: org._id }, { $set: { "copilot.beta": true, "copilot.enabled": true, "copilot.brief": true, "copilot.drafts": true } });
  // A fake WhatsApp connection so the Inbox opens on staging. The key is not
  // real: anything actually sent fails at Meta, and no customer exists here.
  if (!org.whatsapp?.apiKey) {
    await Organization.updateOne({ _id: org._id }, { $set: { "whatsapp.enabled": true, "whatsapp.provider": "meta", "whatsapp.apiKey": "staging-not-real", "whatsapp.displayPhoneNumber": "+91 90000 00000" } });
  }

  const agent = await User.findOne({ orgId: org._id, role: "agent" }).select("name").lean();
  const lead = await Lead.findOne({ orgId: org._id, name: "Test Lead 1" });
  await Lead.updateOne({ _id: lead._id }, { $set: { bhk: "2BHK", preferredLocation: "Kharghar", "budget.max": 9000000, followUpDate: new Date(Date.now() - 26 * 3600e3) } });

  // Sample deals slipping, one per risk alert (copilot/risks.js).
  const D = 24 * 3600e3, at = (ms) => new Date(Date.now() - ms);
  // Straight to the collection: Mongoose treats createdAt as fixed and would drop it.
  const setLead = (name, fields) => Lead.collection.updateOne({ orgId: org._id, name }, { $set: fields });
  await setLead("Test Lead 2", { priority: "Hot", status: "Contacted", createdAt: at(4 * D) });
  await setLead("Test Lead 3", { status: "Site Visit", siteVisitDate: at(2 * D), siteVisitDone: false });
  await setLead("Test Lead 4", { status: "Site Visit", siteVisitDate: at(5 * D), siteVisitDone: true, createdAt: at(10 * D) });
  await setLead("Test Lead 5", { createdAt: at(2 * D) });
  await setLead("Test Lead 6", { createdAt: at(3 * D), assignedTo: null, assignedToName: "" });

  // An Artha suggestion card: the customer later asked for something different.
  await Lead.collection.updateOne({ _id: lead._id }, { $set: { arthaSuggest: { fields: { preferredLocation: "Wakad", bhk: "3BHK" }, at: new Date() } } });

  const phone = `91${String(lead.phone).replace(/\D/g, "").slice(-10)}`;
  let conv = await WaConversation.findOne({ orgId: org._id, contactPhone: phone });
  if (!conv) {
    conv = await WaConversation.create({
      orgId: org._id, leadId: lead._id, contactPhone: phone, contactName: lead.name, status: "open",
      botEnabled: false, assignedTo: agent._id, assignedToName: agent.name,
      campaignRef: { headline: "Staging Heights 2 & 3 BHK" },
    });
  }
  await WaMessage.deleteMany({ conversationId: conv._id });
  const now = Date.now();
  const lines = [
    ["inbound", "customer", "Hi, saw your ad. 2bhk ka price kya hai?", 50],
    ["outbound", "agent", "Hello! Thanks for reaching out. Which location are you looking at?", 45],
    ["inbound", "customer", "Kharghar side. Budget around 90 lakh. Can I visit this Sunday?", 30],
  ];
  await WaMessage.insertMany(lines.map(([direction, sender, body, minsAgo]) => ({
    conversationId: conv._id, orgId: org._id, direction, sender, senderName: sender === "agent" ? agent.name : lead.name,
    body, mediaType: "text", status: direction === "outbound" ? "delivered" : undefined, timestamp: new Date(now - minsAgo * 60e3),
  })));
  await WaConversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: new Date(now - 30 * 60e3), lastMessagePreview: lines[2][2], unreadCount: 1 } });

  await mongoose.disconnect();
  console.log("[staging-artha-demo] Artha pilot is on for Staging Demo Realty (Test Leads 2-6 now show risk alerts).");
  console.log(`[staging-artha-demo] WhatsApp chat with ${lead.name} is ready in ${agent.name}'s Inbox (sign in as staging-agent@example.com).`);
  process.exit(0); // some models start timers on load; don't leave the console hanging
})().catch((e) => { console.error("[staging-artha-demo] failed:", e.message); process.exit(1); });
