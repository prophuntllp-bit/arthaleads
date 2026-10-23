// One-off (23 Oct 2026): give existing leads the button-flow part of the new
// lead score (lead.engagement, utils/leadScorer.js) from the chats they
// already had. For each chat in the last 30 days: a customer reply that is
// exactly one of the buttons the bot had just offered counts as that answer
// (budget / purpose / timeline questions) or that ending (site visit,
// advisor, webinar, "Not now").
//
//   node scripts/backfillFlowEngagement.js           # dry run: lists them, writes nothing
//   node scripts/backfillFlowEngagement.js --apply   # writes lead.engagement
//
// Only fills what is missing: a lead that already has engagement from the
// live flow keeps it.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const WaAgent = require("../models/WaAgent");
const WaConversation = require("../models/WaConversation");
const WaMessage = require("../models/WaMessage");

const APPLY = process.argv.includes("--apply");
const DAYS = 30;
const LEGACY = { advisor: "handoff", site_visit: "site_visit" };
const DECLINE_RE = /\b(not now|later|no|nahi|nako|not interested|maybe later|skip)\b/i;
const clean = (t) => String(t || "").trim().toLowerCase();

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const agents = await WaAgent.find({ "ctwaFlow.qualifyingQuestions.0": { $exists: true } }).lean();
  const byId = new Map(agents.map((a) => [String(a._id), a]));
  const convs = await WaConversation.find({ agentId: { $in: agents.map((a) => a._id) }, leadId: { $ne: null }, lastMessageAt: { $gte: new Date(Date.now() - DAYS * 86400000) } })
    .select("agentId leadId").lean();
  let changed = 0;
  for (const c of convs) {
    const agent = byId.get(String(c.agentId));
    const questions = agent.ctwaFlow.qualifyingQuestions || [];
    const closing = (agent.ctwaFlow.closingButtons || []).map((b) => ({ title: clean(b.label), action: b.action || LEGACY[b.id] })).filter((b) => b.action);
    const msgs = await WaMessage.find({ conversationId: c._id }).sort({ timestamp: 1 }).select("direction body interactiveOptions timestamp").lean();
    const set = {};
    let lastAt = null; // when the customer last answered: the score fades from then
    let offered = [];
    for (const m of msgs) {
      if (m.direction === "outbound") { offered = (m.interactiveOptions || []).map((o) => clean(o.title)); continue; }
      const said = clean(m.body);
      if (!offered.includes(said)) continue;
      lastAt = m.timestamp;
      const q = questions.find((x) => (x.options || []).some((o) => clean(o.label) === said));
      if (q && ["budget", "purpose"].includes(q.mapsTo)) set[`engagement.flow.${q.mapsTo}`] = true;
      if (q && q.mapsTo === "timeline") set["engagement.flow.timeline"] = String(m.body).trim().slice(0, 60);
      const opt = q?.options.find((o) => clean(o.label) === said);
      if (opt?.action === "site_visit") set["engagement.closing"] = "site_visit";
      if (opt?.action === "advisor" && set["engagement.closing"] !== "site_visit") set["engagement.closing"] = "handoff";
      const b = closing.find((x) => x.title === said);
      if (b) {
        set["engagement.closing"] = b.action === "end" ? (DECLINE_RE.test(said) ? "declined" : "end") : b.action;
        set["engagement.closingLabel"] = String(m.body).trim().slice(0, 40);
      }
    }
    if (!Object.keys(set).length) continue;
    const lead = await Lead.findById(c.leadId).select("name engagement").lean();
    if (!lead || lead.engagement?.at) continue; // the live flow already recorded it
    changed++;
    console.log(`${lead.name || c.leadId}: ${Object.entries(set).map(([k, v]) => `${k.replace("engagement.", "")}=${v}`).join(", ")}`);
    if (APPLY) await Lead.updateOne({ _id: lead._id }, { $set: { ...set, "engagement.at": lastAt } });
  }
  console.log(`\n${changed} lead(s) ${APPLY ? "updated" : "would be updated"} from ${convs.length} chats with a button flow in the last ${DAYS} days.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
