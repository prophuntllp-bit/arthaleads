// One-off (26 Oct 2026): leads that came from a WhatsApp Status placement were
// labelled "Facebook Ad · Status ad", because Meta sends that as the headline.
// New clicks get the ad's real name (utils/adHeadline.js); this renames the
// existing ones, taking the name from other clicks on the same ad id.
//
//   node scripts/fixStatusAdLabels.js            # dry run: lists what would change, writes nothing
//   node scripts/fixStatusAdLabels.js --apply    # renames
//
// Ads with no other click to name them are left as they are.
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const Lead = require("../models/Lead");
  const WaConversation = require("../models/WaConversation");
  const { knownHeadline, renameEarlier } = require("../utils/adHeadline");

  const PLACEHOLDER_RE = /^\s*status ad\s*$/i;
  const pairs = new Map();
  for (const l of await Lead.find({ "campaignRef.headline": PLACEHOLDER_RE }).select("orgId campaignRef.adId").lean()) {
    pairs.set(`${l.orgId}|${l.campaignRef.adId}`, { orgId: l.orgId, adId: l.campaignRef.adId });
  }
  for (const c of await WaConversation.find({ $or: [{ "campaignRef.headline": PLACEHOLDER_RE }, { "campaignHistory.headline": PLACEHOLDER_RE }] }).select("orgId campaignRef campaignHistory").lean()) {
    for (const r of [c.campaignRef, ...(c.campaignHistory || [])]) {
      if (r?.adId && PLACEHOLDER_RE.test(r.headline || "")) pairs.set(`${c.orgId}|${r.adId}`, { orgId: c.orgId, adId: r.adId });
    }
  }

  let named = 0, unnamed = 0;
  for (const { orgId, adId } of pairs.values()) {
    const name = adId ? await knownHeadline(orgId, adId) : "";
    const leads = await Lead.find({ orgId, "campaignRef.adId": adId, "campaignRef.headline": PLACEHOLDER_RE }).select("name").lean();
    if (!name) { unnamed++; console.log(`ad ${adId}: no other click names it, left as is (${leads.length} lead(s))`); continue; }
    named++;
    console.log(`ad ${adId} -> "${name}": ${leads.map((l) => l.name).join(", ") || "(chats only)"}`);
    if (apply) await renameEarlier(orgId, adId, name);
  }
  console.log(`\n${pairs.size} ad(s) with "Status ad"; ${named} named${apply ? " and renamed" : " (dry run, nothing written)"}, ${unnamed} left.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
