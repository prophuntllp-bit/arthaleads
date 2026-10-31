// Pulls Lead Form submissions from the Google Ads API for every org that
// connected via "Sign in with Google" (Automation.platform "Google",
// mode "oauth"). This is the polling counterpart to the push-based
// POST /webhook/google — same destination (a Lead with source "Google"),
// different delivery mechanism.
//
// The query fields were checked against Google's v26 field reference on
// 29-30 Oct 2026 (lead_form_submission_data has no campaign_id, asset_id or test
// flag; campaign, ad group, ad and form names come from the attributed
// resources). Checked against a real test account on staging 30 Oct 2026.
//
// With instant delivery on (our webhook on every lead form, POST /webhook/google),
// this sync is the safety net: it runs every SAFETY_NET_MS instead of every cron
// tick, and a lead the webhook already saved is not saved twice.

const Automation = require("../models/Automation");
const { shouldAutoAssign } = require("./autoAssign");
const Lead = require("../models/Lead");
const Organization = require("../models/Organization");
const logger = require("../config/logger");
const automationService = require("../services/automationService");
const { getNextAssignee } = require("./assignLead");
const { emitLeadCreated, routedProject } = require("./emitLeadCreated");
const { sendPushToAll, sendPushToUser } = require("./push");
const { mapGoogleLeadFields, fromApiFields, googleAdRef, adRefLines, googleSourceLabel } = require("./googleLeadFields");
const { samePhone } = require("./phone");
const { mapCustomFieldsToLead } = require("./formFieldMapper");
const { matchRoutingRule, fileLeadInRoutedProject } = require("./routingRules");
const { levelOf } = require("../middlewares/planGate");
const googleAds = require("./googleAdsApi");

// First-ever sync for a freshly connected account: look back this far rather
// than pulling full history or (if lastSyncAt were left null) nothing at all.
const INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
// Google compares the 'since' time in the ad account's own time zone, not UTC, so
// each sync reaches back a day further; already-saved leads are skipped.
const TIMEZONE_OVERLAP_MS = 24 * 60 * 60 * 1000;
// When every lead form pushes to us, the sync only needs to run this often.
const SAFETY_NET_MS = 30 * 60 * 1000;
// A lead the webhook saved with this phone in this window is the same enquiry.
const SAME_LEAD_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

function toGaqlDatetime(date) {
  // GAQL DATETIME literals: 'YYYY-MM-DD HH:MM:SS' (no timezone — Ads API uses
  // the customer account's own timezone internally for comparisons).
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function fetchSubmissions(automation, accessToken, since) {
  const query = `
    SELECT
      lead_form_submission_data.resource_name,
      lead_form_submission_data.id,
      lead_form_submission_data.campaign,
      lead_form_submission_data.asset,
      lead_form_submission_data.gclid,
      lead_form_submission_data.submission_date_time,
      lead_form_submission_data.lead_form_submission_fields,
      lead_form_submission_data.custom_lead_form_submission_fields,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      asset.id,
      asset.name,
      asset.lead_form_asset.headline
    FROM lead_form_submission_data
    WHERE lead_form_submission_data.submission_date_time > '${toGaqlDatetime(new Date(since.getTime() - TIMEZONE_OVERLAP_MS))}'
    ORDER BY lead_form_submission_data.submission_date_time ASC
  `.trim();
  return googleAds.search(automation.googleCustomerId, query, { accessToken, loginCustomerId: automation.googleLoginCustomerId });
}

// Standard questions (name, phone, email, ...) and the advertiser's own
// questions arrive in two lists; custom ones are keyed by their question text.
function submissionEntries(sub) {
  const custom = (sub.customLeadFormSubmissionFields || []).map((f) => ({
    id: f?.questionText, label: f?.questionText, value: f?.fieldValue,
  }));
  return [...fromApiFields(sub.leadFormSubmissionFields), ...custom];
}

// Where Google pushes leads for this server (the same route as a pasted webhook).
function webhookUrl() {
  return `${new URL(automationService.getGoogleRedirectUri()).origin}/webhook/google`;
}

/**
 * Puts our webhook on the account's lead forms that have none and records how
 * many push to us. Never throws: a failure only leaves the sync doing the work.
 */
async function ensureInstantDelivery(automation, accessToken) {
  if (!automation.verifyToken) return null;
  try {
    const r = await googleAds.ensureLeadFormWebhooks(automation.googleCustomerId, {
      url: webhookUrl(), secret: automation.verifyToken, accessToken, loginCustomerId: automation.googleLoginCustomerId,
    });
    automation.googleDelivery = { ...r, checkedAt: new Date() };
  } catch (err) {
    logger.warn(`[google-ads-poll] "${automation.name}": instant delivery check failed: ${err.message}`);
    const prev = automation.googleDelivery ? (automation.googleDelivery.toObject?.() || automation.googleDelivery) : {};
    automation.googleDelivery = { ...prev, error: err.message, checkedAt: new Date() };
  }
  return automation.googleDelivery;
}

// Every lead form of the account sends to us (and there is at least one).
const pushCoversAll = (a) => !!a.googleDelivery && a.googleDelivery.total > 0 && a.googleDelivery.ours === a.googleDelivery.total;

// Runs one connection's sync. Exported separately so the manual "Sync now"
// button can trigger exactly the same logic as the cron, on demand.
async function pollOneGoogleAdsConnection(automation) {
  if (!automation.userToken) {
    logger.warn(`[google-ads-poll] "${automation.name}" (${automation._id}): no refresh token stored — skipping`);
    return { created: 0, skipped: 0, error: "No refresh token stored. Reconnect Google." };
  }

  const orgId = automation.orgId;
  const customerId = automation.googleCustomerId;
  if (!customerId) {
    return { created: 0, skipped: 0, error: "No Google Ads account linked to this connection." };
  }

  // Google Ads capture is an Enterprise feature. A connection kept after a downgrade stays
  // on file but stops pulling leads.
  const planOrg = await Organization.findById(orgId).select("plan").lean();
  if (levelOf(planOrg?.plan) < 3) {
    return { created: 0, skipped: 0, error: "Google Ads capture is part of the Enterprise plan." };
  }

  let accessToken;
  try {
    accessToken = await automationService.refreshGoogleAccessToken(automation.userToken);
  } catch (err) {
    logger.error(`[google-ads-poll] "${automation.name}" (${automation._id}): token refresh failed — ${err.message}`);
    return { created: 0, skipped: 0, error: `Token refresh failed: ${err.message}` };
  }

  await ensureInstantDelivery(automation, accessToken);
  automation.googlePolledAt = new Date();

  const since = automation.lastSyncAt || new Date(Date.now() - INITIAL_LOOKBACK_MS);
  let rows;
  try {
    rows = await fetchSubmissions(automation, accessToken, since);
  } catch (err) {
    logger.error(`[google-ads-poll] "${automation.name}" (${automation._id}): fetch failed — ${err.message}`);
    await automation.save().catch(() => {});
    return { created: 0, skipped: 0, error: err.message };
  }

  if (!rows.length) {
    automation.lastSyncAt = new Date();
    automation.status = "connected";
    await automation.save();
    return { created: 0, skipped: 0 };
  }

  const org = await Organization.findById(orgId).select("autoAssign plan").lean();
  let created = 0, skipped = 0, latestSubmission = since, earliestFailure = null;

  for (const row of rows) {
    const sub = row.leadFormSubmissionData || {};
    const resourceName = sub.resourceName;
    const submittedAt = sub.submissionDateTime ? new Date(sub.submissionDateTime) : new Date();
    // The cursor only moves past a submission once it has been dealt with (saved, a duplicate,
    // or not usable). One that failed to save holds the cursor back so the next run retries it.
    const advance = () => { if (submittedAt > latestSubmission) latestSubmission = submittedAt; };

    if (!resourceName) { skipped++; advance(); continue; }

    // Dedup: never create the same submission twice, whether an earlier sync or
    // the webhook (which keys it as google:<lead id>) saved it.
    const ids = [resourceName, sub.id ? `google:${sub.id}` : ""].filter(Boolean);
    const already = await Lead.findOne({ orgId, externalId: { $in: ids } }).select("_id").lean();
    if (already) { skipped++; advance(); continue; }

    const { fullName, phone, email, formResponses: allFormResponses, requirements, customFields } =
      mapGoogleLeadFields(submissionEntries(sub));
    const { leadUpdates: mappedLeadFields, remaining: formResponses } = mapCustomFieldsToLead(allFormResponses);

    // The API has no test-lead flag (Google's "Send test data" only reaches the webhook).
    const name = fullName || "Google Lead";
    if (!phone || phone.length < 7) {
      skipped++; advance();
      continue;
    }
    const cleanPhone = phone;
    // The webhook's lead id may not match the API's submission id, so a Google lead
    // with this phone saved in the last two days is taken as the same enquiry.
    const sameRecent = await Lead.findOne({
      orgId, source: "Google", phone: samePhone(cleanPhone) || cleanPhone, createdAt: { $gte: new Date(Date.now() - SAME_LEAD_WINDOW_MS) },
    }).select("_id").lean();
    if (sameRecent) { skipped++; advance(); continue; }

    const campaignId = String(row.campaign?.id || googleAds.idFromResourceName(sub.campaign) || "");
    const adRef = googleAdRef({
      campaignId, campaignName: row.campaign?.name,
      adGroupId: row.adGroup?.id, adGroupName: row.adGroup?.name,
      adId: row.adGroupAd?.ad?.id, adName: row.adGroupAd?.ad?.name,
      formId: row.asset?.id || googleAds.idFromResourceName(sub.asset), formName: row.asset?.name || row.asset?.leadFormAsset?.headline,
      gclid: sub.gclid,
    });

    const ruleMatch = await matchRoutingRule(orgId, "google", { campaign_id: campaignId });

    let assignee = null;
    if (ruleMatch?.assignTo) {
      assignee = { _id: ruleMatch.assignTo, name: ruleMatch.assignToName };
    } else if (shouldAutoAssign(org)) {
      try { assignee = await getNextAssignee(orgId); } catch { /* no active agents */ }
    }

    const sourceLabel = googleSourceLabel(automation.name || automation.googleCustomerName || "Google", adRef);

    const noteText = [
      `✅ Lead imported from Google Ads (via account sync).`,
      `Name: ${name || "-"}`,
      `Phone: ${cleanPhone}`,
      `Email: ${email || "-"}`,
      ...adRefLines(adRef),
      requirements ? `\nForm Answers:\n${customFields.map((e) => `${e.label || e.id}: ${e.value}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    try {
      const lead = await Lead.create({
        name,
        phone: cleanPhone,
        email,
        source: "Google",
        status: "New",
        requirements,
        formResponses,
        ...mappedLeadFields,
        externalId: resourceName,
        adRef,
        orgId,
        createdBy: assignee?._id || automation.createdBy || null,
        assignedTo: assignee?._id || null,
        assignedToName: assignee?.name || "",
        leadSourceLabel: sourceLabel,
        notes: [{ text: noteText, addedBy: assignee?._id || null, addedByName: assignee?.name || "" }],
        activities: [{
          type: "created",
          description: assignee
            ? `Lead pulled from Google Ads account sync - auto-assigned to ${assignee.name}`
            : "Lead pulled from Google Ads account sync - unassigned",
          performedBy: assignee?._id || null,
          performedByName: assignee?.name || "",
          meta: { automationId: automation._id?.toString(), campaignId, adGroupId: adRef.adGroupId || "", adId: adRef.adId || "", formId: adRef.formId || "", gclid: sub.gclid || "" },
        }],
      });
      created++; advance();
      // A rule that names a project files the lead there too, as the other sources do.
      if (ruleMatch) await fileLeadInRoutedProject(ruleMatch, lead);
      // New-lead hand-off to Vistrow (no-op unless the owner enabled it). submittedAt is when
      // the person actually enquired: the first sync reaches back 7 days, and an enquiry that
      // old must not be phoned as if it had just arrived (the age guard uses this, not createdAt).
      emitLeadCreated(lead, {
        origin: "poller-google", routeSource: "google", isTest: false, submittedAt, project: routedProject(ruleMatch),
        attribution: { campaign_id: campaignId, campaign_name: adRef.campaignName || "", adgroup_id: adRef.adGroupId || "", adgroup_name: adRef.adGroupName || "", ad_id: adRef.adId || "" },
      });

      if (assignee?._id) {
        sendPushToUser(assignee._id, {
          type: "lead_assigned",
          title: `New Google Lead: ${lead.name}`,
          body: [cleanPhone, sourceLabel].filter(Boolean).join(" · "),
          data: { url: "/leads", leadId: String(lead._id) },
        }).catch(() => {});
      } else {
        sendPushToAll({
          type: "new_lead",
          title: `New Google lead: ${lead.name}`,
          body: "From a Google Ads lead form. Not assigned to anyone yet.",
          data: { url: "/leads", leadId: String(lead._id), leadName: lead.name, source: "Google" },
        }, orgId).catch(() => {});
      }
    } catch (err) {
      logger.error(`[google-ads-poll] "${automation.name}": failed to create lead for ${resourceName} — ${err.message}`);
      skipped++;
      if (!earliestFailure || submittedAt < earliestFailure) earliestFailure = submittedAt;
    }
  }

  // Never move the cursor past a submission that failed: stop just before it so it is fetched again.
  let cursor = latestSubmission;
  if (earliestFailure) cursor = new Date(Math.max(since.getTime(), Math.min(cursor.getTime(), earliestFailure.getTime() - 1)));
  automation.lastSyncAt = cursor;
  automation.status = "connected";
  await automation.save();

  logger.info(`[google-ads-poll] "${automation.name}" (${automation._id}): ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

// Cron entry point — runs every connection in turn, one failure doesn't stop the rest.
// A connection whose lead forms all push to us is only checked every SAFETY_NET_MS.
async function pollGoogleAdsLeads() {
  const all = await Automation.find({ platform: "Google", mode: "oauth", isActive: true });
  const automations = all.filter((a) => !(pushCoversAll(a) && a.googlePolledAt && Date.now() - a.googlePolledAt.getTime() < SAFETY_NET_MS));
  if (!automations.length) return;

  logger.info(`[google-ads-poll] syncing ${automations.length} Google Ads connection(s)`);
  for (const automation of automations) {
    try {
      await pollOneGoogleAdsConnection(automation);
    } catch (err) {
      logger.error(`[google-ads-poll] "${automation.name}" (${automation._id}): unexpected error — ${err.message}`);
    }
  }
}

module.exports = { pollGoogleAdsLeads, pollOneGoogleAdsConnection, ensureInstantDelivery, webhookUrl };
