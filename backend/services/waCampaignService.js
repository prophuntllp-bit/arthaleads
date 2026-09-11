// services/waCampaignService.js
//
// Template broadcasts to a filtered set of leads.
//
// Four things constrain every send here, and all four are ours to enforce
// rather than the tenant's, because Arthaleads holds the Meta credit line:
//
//   1. Consent    Meta requires recorded opt-in before a marketing template.
//                 An unset lead counts as NO.
//   2. Quality    A tenant tanking their own number's quality rating is our
//                 exposure. RED refuses to send.
//   3. Tier       Meta caps marketing volume per number per rolling 24h.
//                 Exceeding it just fails the sends, so we stop first.
//   4. Credit     Reserved for the whole run up front — a campaign that runs
//                 dry halfway is worse than one that never started.

const Lead           = require("../models/Lead");
const WaCampaign     = require("../models/WaCampaign");
const WaMessage      = require("../models/WaMessage");
const WaConversation = require("../models/WaConversation");
const credits        = require("./creditService");
const templates      = require("./whatsappTemplateService");
const logger         = require("../config/logger");

// Meta's marketing volume tiers, per phone number per rolling 24 hours.
const TIER_LIMITS = {
  TIER_50: 50, TIER_250: 250, TIER_1K: 1000,
  TIER_10K: 10_000, TIER_100K: 100_000, TIER_UNLIMITED: Infinity,
};

/** Category -> credit bucket. */
const categoryToCredit = (c) => ({
  MARKETING: "marketing", UTILITY: "utility", AUTHENTICATION: "authentication",
}[String(c || "").toUpperCase()] || "marketing");

/**
 * Resolve an audience from a Leads-page style filter.
 *
 * Returns the sendable leads plus why the others were excluded, so the
 * campaign preview can show "412 of 500 — 88 have not opted in" rather than
 * silently shrinking the number.
 */
async function resolveAudience(orgId, filter = {}, { requireConsent = true } = {}) {
  const q = { orgId };
  if (filter.status)     q.status = filter.status;
  if (filter.source)     q.source = filter.source;
  if (filter.priority)   q.priority = filter.priority;
  if (filter.siteFilter) q.websiteDomain = filter.siteFilter;
  if (filter.assignedTo) q.assignedTo = filter.assignedTo;
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) q.createdAt.$gte = new Date(`${String(filter.from).slice(0, 10)}T00:00:00+05:30`);
    if (filter.to)   q.createdAt.$lte = new Date(`${String(filter.to).slice(0, 10)}T23:59:59.999+05:30`);
  }

  const leads = await Lead.find(q).select("name phone whatsappConsent").lean();

  const noPhone   = [];
  const noConsent = [];
  const sendable  = [];

  for (const l of leads) {
    if (!l.phone) { noPhone.push(l); continue; }
    if (requireConsent && l.whatsappConsent?.status !== "granted") { noConsent.push(l); continue; }
    sendable.push(l);
  }

  return {
    total: leads.length,
    sendable,
    skippedNoPhone: noPhone.length,
    skippedNoConsent: noConsent.length,
  };
}

/**
 * Everything a tenant needs to decide whether to press send: how many people,
 * what it costs, and anything that would block it.
 */
async function preview(org, { templateName, filter }) {
  const approved = await templates.listApproved(org);
  const tpl = approved.find(t => t.name === templateName);
  if (!tpl) throw badRequest("Pick an approved template. Templates in review cannot be sent.");

  const category = categoryToCredit(tpl.category);
  const audience = await resolveAudience(org._id, filter, {
    // Only marketing legally needs opt-in; a utility template about something
    // the customer did is a different thing.
    requireConsent: category === "marketing",
  });

  const cost = await credits.canAfford(org._id, category, audience.sendable.length);
  const blockers = [];

  const quality = org.whatsapp?.qualityRating;
  if (quality === "RED") {
    blockers.push("This number's quality rating is RED. Sending more marketing now risks Meta restricting it.");
  }

  const tierCap = TIER_LIMITS[org.whatsapp?.messagingTier] ?? Infinity;
  if (audience.sendable.length > tierCap) {
    blockers.push(`Your number is limited to ${tierCap.toLocaleString("en-IN")} marketing messages per 24 hours.`);
  }

  if (!cost.ok) {
    blockers.push(`Not enough credits — need ₹${(cost.needPaise / 100).toFixed(2)}, have ₹${(cost.availablePaise / 100).toFixed(2)}.`);
  }

  return {
    template: { name: tpl.name, language: tpl.language, category: tpl.category, body: ((tpl.components || []).find((c) => c.type === "BODY") || {}).text || "" },
    variablesExpected: templates.countBodyVariables(tpl),
    ...audience,
    sendableCount: audience.sendable.length,
    costPaise: cost.needPaise,
    ratePaise: cost.ratePaise,
    availablePaise: cost.availablePaise,
    creditCategory: category,
    tierCap: tierCap === Infinity ? null : tierCap,
    qualityRating: quality || null,
    blockers,
    canSend: blockers.length === 0 && audience.sendable.length > 0,
  };
}

/**
 * Run a campaign.
 *
 * Sends sequentially and settles per message through the normal status-webhook
 * path, so a campaign message is billed exactly like any other. The whole run
 * is reserved first; whatever is not spent is released at the end.
 */
async function run(org, campaignId, sendProviderMessage) {
  const campaign = await WaCampaign.findOne({ _id: campaignId, orgId: org._id });
  if (!campaign) throw badRequest("Campaign not found");
  if (campaign.status !== "draft") throw badRequest(`This campaign is already ${campaign.status}.`);

  const p = await preview(org, { templateName: campaign.templateName, filter: campaign.audienceFilter });
  if (!p.canSend) throw badRequest(p.blockers[0] || "Nothing to send.");

  let held = 0;
  try {
    held = await credits.reserve(org._id, { category: p.creditCategory, count: p.sendableCount });
  } catch (err) {
    if (err instanceof credits.InsufficientCreditsError) throw badRequest("Not enough credits to start this campaign.");
    throw err;
  }

  campaign.status = "sending";
  campaign.startedAt = new Date();
  campaign.reservedPaise = held;
  campaign.stats = {
    audience: p.total, skippedNoConsent: p.skippedNoConsent, skippedNoPhone: p.skippedNoPhone,
    queued: p.sendableCount, sent: 0, failed: 0, droppedByMeta: 0,
  };
  await campaign.save();

  const perMessage = p.sendableCount > 0 ? Math.round(held / p.sendableCount) : 0;
  let sent = 0, failed = 0, lastError = "";

  for (const lead of p.sendable) {
    const values = (campaign.variableMapping || []).map(field =>
      field === "name" ? (lead.name || "there") :
      field === "phone" ? (lead.phone || "") : field
    );

    try {
      const components = templates.buildSendComponents({ components: [] }, values);
      const msgId = await sendProviderMessage(org, lead.phone.replace(/\D/g, ""), "", {
        name: campaign.templateName,
        language: campaign.templateLanguage,
        components,
      });

      const conv = await upsertConversation(org, lead);
      await WaMessage.create({
        orgId: org._id, conversationId: conv._id, waMsgId: msgId || undefined,
        direction: "outbound", sender: "agent",
        senderName: `Campaign: ${campaign.name}`,
        body: `[${campaign.templateName}]`,
        status: "sent", timestamp: new Date(),
        reservedPaise: perMessage, creditCategory: p.creditCategory,
      });
      sent++;
    } catch (err) {
      failed++;
      const me = err?.response?.data?.error;
      lastError = me
        ? "Meta error " + (me.code || "") + ": " + (me.error_user_msg || me.message || "send failed")
        : (err.message || "send failed");
      logger.warn(`[wa-campaign] ${campaign._id} -> ${lead.phone}: ${err?.response?.data?.error?.message || err.message}`);
    }

    if ((sent + failed) % 25 === 0) {
      await WaCampaign.updateOne({ _id: campaign._id }, { $set: { "stats.sent": sent, "stats.failed": failed } });
    }
  }

  // Anything that never went out was reserved and must come back. The messages
  // that did go out settle themselves when Meta reports their price.
  const unusedPaise = perMessage * failed;
  if (unusedPaise > 0) await credits.release(org._id, unusedPaise);

  campaign.status = failed && !sent ? "failed" : "sent";
  // Surfaced on the campaign card, so a failure says why instead of just red.
  if (failed) campaign.failureReason = lastError;
  campaign.stats.sent = sent;
  campaign.stats.failed = failed;
  campaign.spentPaise = perMessage * sent;
  campaign.finishedAt = new Date();
  await campaign.save();

  logger.info(`[wa-campaign] ${campaign.name} (${campaign._id}) — ${sent} sent, ${failed} failed`);
  return campaign;
}

/** A campaign message still belongs in the inbox thread for that contact. */
async function upsertConversation(org, lead) {
  const phone = lead.phone.replace(/\D/g, "");
  let conv = await WaConversation.findOne({ orgId: org._id, contactPhone: phone });
  if (!conv) {
    conv = await WaConversation.create({
      orgId: org._id, leadId: lead._id, contactPhone: phone,
      contactName: lead.name || phone, waContactId: phone,
      botEnabled: org.whatsapp?.botEnabled ?? true,
      status: org.whatsapp?.botEnabled ? "bot" : "open",
    });
  }
  return conv;
}

function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

module.exports = { resolveAudience, preview, run, TIER_LIMITS, categoryToCredit };
