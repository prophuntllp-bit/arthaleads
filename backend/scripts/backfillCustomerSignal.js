// One-off (21 Oct 2026): give existing leads their "customer last did
// something" time from the last 14 days of WhatsApp, so AI lead scoring
// (services/aiLeadScore.js) can read leads that were active before it
// shipped. New activity is stamped as it happens; this only fills the gap.
//
//   node scripts/backfillCustomerSignal.js            # dry run: counts only, writes nothing
//   node scripts/backfillCustomerSignal.js --apply    # writes lastCustomerSignalAt
//
// Only ever moves the time forward, never touches any other field, and never
// touches project leads.
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const WaMessage = require("../models/WaMessage");
  const WaConversation = require("../models/WaConversation");
  const Lead = require("../models/Lead");
  const since = new Date(Date.now() - 14 * 86400000);

  const lastIn = await WaMessage.aggregate([
    { $match: { direction: "inbound", timestamp: { $gte: since } } },
    { $group: { _id: "$conversationId", at: { $max: "$timestamp" } } },
  ]);
  const convs = await WaConversation.find({ _id: { $in: lastIn.map((r) => r._id) }, leadId: { $ne: null } }).select("leadId").lean();
  const leadOf = new Map(convs.map((c) => [String(c._id), c.leadId]));
  const latest = new Map();
  for (const r of lastIn) {
    const id = leadOf.get(String(r._id));
    if (id && (!latest.has(String(id)) || r.at > latest.get(String(id)).at)) latest.set(String(id), { id, at: r.at });
  }

  let changed = 0;
  for (const { id, at } of latest.values()) {
    const filter = { _id: id, $or: [{ lastCustomerSignalAt: { $exists: false } }, { lastCustomerSignalAt: { $lt: at } }] };
    if (apply) changed += (await Lead.updateOne(filter, { $set: { lastCustomerSignalAt: at } })).modifiedCount;
    else changed += await Lead.countDocuments(filter);
  }
  console.log(`${apply ? "Updated" : "Would update"} ${changed} lead(s) with WhatsApp activity in the last 14 days.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
