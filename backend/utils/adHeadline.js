// The ad's name for a WhatsApp ad click.
//
// When an ad is shown in someone's WhatsApp Status, Meta sends the click with
// the headline "Status ad" instead of the ad's own (26 Oct 2026: a webinar lead
// showed as "Facebook Ad · Status ad"). The ad id is still right, so the name
// is taken from another click on the same ad. And when a click with the real
// name arrives, earlier "Status ad" leads of that ad are renamed. The label
// keeps "(Status Ad)" so the team can tell where the click came from.
const Lead = require("../models/Lead");
const WaConversation = require("../models/WaConversation");

const PLACEHOLDER_RE = /^\s*status ad\s*$/i;
const PLACEHOLDER_LABEL_RE = /^Facebook Ad · status ad$/i;
const isPlaceholderHeadline = (h) => !String(h || "").trim() || PLACEHOLDER_RE.test(h);
const labelFor = (headline) => `Facebook Ad · ${headline} (Status Ad)`;

async function knownHeadline(orgId, adId) {
  const real = { $exists: true, $nin: ["", null], $not: PLACEHOLDER_RE };
  const lead = await Lead.findOne({ orgId, "campaignRef.adId": adId, "campaignRef.headline": real })
    .sort({ createdAt: -1 }).select("campaignRef.headline").lean();
  if (lead) return lead.campaignRef.headline;
  const conv = await WaConversation.findOne({ orgId, campaignHistory: { $elemMatch: { adId, headline: real } } })
    .sort({ updatedAt: -1 }).select("campaignHistory").lean();
  const hit = conv?.campaignHistory?.slice().reverse().find((h) => h.adId === adId && !isPlaceholderHeadline(h.headline));
  return hit?.headline || "";
}

// Renames this ad's earlier "Status ad" leads and chats to the real name.
async function renameEarlier(orgId, adId, headline) {
  const placeholder = { "campaignRef.adId": adId, "campaignRef.headline": PLACEHOLDER_RE };
  await Lead.updateMany({ orgId, ...placeholder, leadSourceLabel: PLACEHOLDER_LABEL_RE },
    { $set: { "campaignRef.headline": headline, leadSourceLabel: labelFor(headline) } });
  await Lead.updateMany({ orgId, ...placeholder }, { $set: { "campaignRef.headline": headline } });
  await WaConversation.updateMany({ orgId, ...placeholder }, { $set: { "campaignRef.headline": headline } });
  await WaConversation.updateMany({ orgId, campaignHistory: { $elemMatch: { adId, headline: PLACEHOLDER_RE } } },
    { $set: { "campaignHistory.$[h].headline": headline } },
    { arrayFilters: [{ "h.adId": adId, "h.headline": PLACEHOLDER_RE }] });
}

/** The referral with the ad's real headline when Meta sent "Status ad". */
async function withRealHeadline(orgId, referral) {
  const adId = String(referral?.source_id || "").trim();
  if (!adId) return referral;
  if (isPlaceholderHeadline(referral.headline)) {
    const name = await knownHeadline(orgId, adId);
    return name ? { ...referral, headline: name, viaStatus: true } : referral;
  }
  renameEarlier(orgId, adId, String(referral.headline).trim())
    .catch((err) => console.error("[WhatsApp] Status ad rename failed:", err.message));
  return referral;
}

module.exports = { withRealHeadline, renameEarlier, knownHeadline, isPlaceholderHeadline };
