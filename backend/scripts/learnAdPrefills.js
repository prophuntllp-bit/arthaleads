// One-off: teach every ad its pre-filled message from past ad clicks (the
// first message of each chat that arrived with an ad id), so chats with no ad
// details are placed from day one instead of after two new clicks per ad.
// See utils/adPrefill.js.
//
//   node scripts/learnAdPrefills.js            # dry run: prints what it would save
//   node scripts/learnAdPrefills.js --write    # saves
//
// Writes only to the adprefills collection. Safe to run again: counts are
// rebuilt from the chats, not added on top.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const WaConversation = require("../models/WaConversation");
const WaMessage = require("../models/WaMessage");
const AdPrefill = require("../models/AdPrefill");
const { normalize } = require("../utils/adPrefill");

const WRITE = process.argv.includes("--write");
const DAYS = 120;

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const since = new Date(Date.now() - DAYS * 86400000);
  const convs = await WaConversation.find({ "campaignRef.adId": { $nin: [null, ""] }, createdAt: { $gte: since } })
    .select("orgId campaignRef").lean();
  const tally = new Map(); // orgId|adId|norm -> { orgId, adId, norm, sample, count, lastSeenAt }
  for (const c of convs) {
    const first = await WaMessage.findOne({ conversationId: c._id, direction: "inbound", mediaType: "text" })
      .sort({ timestamp: 1 }).select("body timestamp").lean();
    const norm = normalize(first?.body);
    if (!first || norm.split(" ").length < 4) continue;
    const key = `${c.orgId}|${c.campaignRef.adId}|${norm}`;
    const t = tally.get(key) || { orgId: c.orgId, adId: c.campaignRef.adId, norm, sample: String(first.body).trim().slice(0, 300), count: 0, lastSeenAt: first.timestamp };
    t.count += 1;
    if (first.timestamp > t.lastSeenAt) t.lastSeenAt = first.timestamp;
    tally.set(key, t);
  }
  const rows = [...tally.values()].sort((a, b) => b.count - a.count);
  for (const r of rows) console.log(`${String(r.count).padStart(4)}  ${r.adId}  ${r.count >= 2 ? "USED " : "once "}  ${r.sample.replace(/\s+/g, " ").slice(0, 90)}`);
  console.log(`\n${rows.length} ad messages from ${convs.length} ad-click chats (last ${DAYS} days); ${rows.filter((r) => r.count >= 2).length} seen twice or more.`);
  if (WRITE) {
    for (const r of rows) {
      await AdPrefill.updateOne(
        { orgId: r.orgId, adId: r.adId, norm: r.norm },
        { $set: { count: r.count, sample: r.sample, lastSeenAt: r.lastSeenAt } },
        { upsert: true }
      );
    }
    console.log("Saved.");
  } else {
    console.log("Dry run, nothing saved. Add --write to save.");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
