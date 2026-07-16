// Pulls Lead Form submissions from the Google Ads API for every org that
// connected via "Sign in with Google" (Automation.platform "Google",
// mode "oauth"). This is the polling counterpart to the push-based
// POST /webhook/google — same destination (a Lead with source "Google"),
// different delivery mechanism.
//
// IMPORTANT: the exact GAQL resource/field names below (lead_form_submission_data,
// its sub-fields, and the REST JSON shape Google returns for them) are built from
// Google Ads API's documented schema, but have not been exercised against a live
// account from this environment — there is no Developer Token available here to
// test against. Treat the query/field-mapping as the first thing to verify (and
// adjust if needed) once real credentials exist; everything around it — token
// refresh, dedup, lead creation, assignment, notifications — follows the same
// tested pattern as the rest of this file's siblings (webhookRoutes.js, the
// Facebook token-refresh cron) and needs no such caveat.

const Automation = require("../models/Automation");
const Lead = require("../models/Lead");
const Organization = require("../models/Organization");
const logger = require("../config/logger");
const automationService = require("../services/automationService");
const { getNextAssignee } = require("./assignLead");
const { sendPushToAll, sendPushToUser } = require("./push");
const { mapGoogleLeadFields, fromApiFields } = require("./googleLeadFields");

const GOOGLE_ADS_API_VERSION = "v17";
// First-ever sync for a freshly connected account: look back this far rather
// than pulling full history or (if lastSyncAt were left null) nothing at all.
const INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function toGaqlDatetime(date) {
  // GAQL DATETIME literals: 'YYYY-MM-DD HH:MM:SS' (no timezone — Ads API uses
  // the customer account's own timezone internally for comparisons).
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function fetchSubmissions(customerId, accessToken, since) {
  const query = `
    SELECT
      lead_form_submission_data.resource_name,
      lead_form_submission_data.campaign_id,
      lead_form_submission_data.asset_id,
      lead_form_submission_data.gclid,
      lead_form_submission_data.submission_date_time,
      lead_form_submission_data.lead_form_submission_fields,
      lead_form_submission_data.custom_lead_form_submission_fields,
      lead_form_submission_data.is_test_lead
    FROM lead_form_submission_data
    WHERE lead_form_submission_data.submission_date_time > '${toGaqlDatetime(since)}'
    ORDER BY lead_form_submission_data.submission_date_time ASC
  `.trim();

  const resp = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, pageSize: 200 }),
    }
  );
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json.error?.message || `Google Ads API error (${resp.status})`);
  }
  return json.results || [];
}

// Runs one connection's sync. Exported separately so the manual "Sync now"
// button can trigger exactly the same logic as the cron, on demand.
async function pollOneGoogleAdsConnection(automation) {
  if (!automation.userToken) {
    logger.warn(`[google-ads-poll] "${automation.name}" (${automation._id}): no refresh token stored — skipping`);
    return { created: 0, skipped: 0, error: "No refresh token stored. Reconnect Google." };
  }
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return { created: 0, skipped: 0, error: "GOOGLE_ADS_DEVELOPER_TOKEN is not configured." };
  }

  const orgId = automation.orgId;
  const customerId = automation.googleCustomerId;
  if (!customerId) {
    return { created: 0, skipped: 0, error: "No Google Ads account linked to this connection." };
  }

  let accessToken;
  try {
    accessToken = await automationService.refreshGoogleAccessToken(automation.userToken);
  } catch (err) {
    logger.error(`[google-ads-poll] "${automation.name}" (${automation._id}): token refresh failed — ${err.message}`);
    return { created: 0, skipped: 0, error: `Token refresh failed: ${err.message}` };
  }

  const since = automation.lastSyncAt || new Date(Date.now() - INITIAL_LOOKBACK_MS);
  let rows;
  try {
    rows = await fetchSubmissions(customerId, accessToken, since);
  } catch (err) {
    logger.error(`[google-ads-poll] "${automation.name}" (${automation._id}): fetch failed — ${err.message}`);
    return { created: 0, skipped: 0, error: err.message };
  }

  if (!rows.length) {
    automation.lastSyncAt = new Date();
    automation.status = "connected";
    await automation.save();
    return { created: 0, skipped: 0 };
  }

  const org = await Organization.findById(orgId).select("autoAssign").lean();
  let created = 0, skipped = 0, latestSubmission = since;

  for (const row of rows) {
    const sub = row.leadFormSubmissionData || {};
    const resourceName = sub.resourceName;
    const submittedAt = sub.submissionDateTime ? new Date(sub.submissionDateTime) : new Date();
    if (submittedAt > latestSubmission) latestSubmission = submittedAt;

    if (!resourceName) { skipped++; continue; }

    // Dedup: never create the same submission twice, even if the lookback
    // window overlaps a previous run.
    const already = await Lead.findOne({ orgId, externalId: resourceName }).select("_id").lean();
    if (already) { skipped++; continue; }

    const fields = sub.leadFormSubmissionFields || sub.customLeadFormSubmissionFields || [];
    const { fullName, phone, email, formResponses, requirements, customFields } =
      mapGoogleLeadFields(fromApiFields(fields));

    const isTestLead = sub.isTestLead === true;
    const name = isTestLead ? "Test Lead (Google)" : (fullName || "Google Lead");

    if (!isTestLead && (!phone || phone.length < 7)) {
      skipped++;
      continue;
    }
    const cleanPhone = phone || "N/A (test)";

    let assignee = null;
    if (!isTestLead && org?.autoAssign !== false) {
      try { assignee = await getNextAssignee(orgId); } catch { /* no active agents */ }
    }

    const sourceLabel = isTestLead
      ? `${automation.name || "Google Ads"} - Test`
      : (automation.name || automation.googleCustomerName || "Google");

    const noteText = isTestLead
      ? `⚠️ Google Test Lead — pulled via the Google Ads API.\n\nSubmission: ${resourceName}`
      : [
          `✅ Lead imported from Google Ads (via account sync).`,
          `Name: ${name || "-"}`,
          `Phone: ${cleanPhone}`,
          `Email: ${email || "-"}`,
          requirements ? `\nForm Answers:\n${customFields.map((e) => `${e.label || e.id}: ${e.value}`).join("\n")}` : "",
        ].filter(Boolean).join("\n");

    try {
      const lead = await Lead.create({
        name,
        phone: cleanPhone,
        email,
        source: "Google",
        status: "New",
        requirements: isTestLead ? "" : requirements,
        formResponses: isTestLead ? [] : formResponses,
        externalId: resourceName,
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
          meta: { automationId: automation._id?.toString(), campaignId: sub.campaignId || "", gclid: sub.gclid || "" },
        }],
      });
      created++;

      if (assignee?._id) {
        sendPushToUser(assignee._id, {
          type: "lead_assigned",
          title: `New Google Lead: ${lead.name}`,
          body: [cleanPhone, sourceLabel].filter(Boolean).join(" · "),
          data: { url: "/leads" },
        }).catch(() => {});
      } else if (!isTestLead) {
        sendPushToAll({
          type: "new_lead",
          title: "New Google Lead 🔍",
          body: `${lead.name} came in from Google Ads`,
          data: { url: "/leads", leadName: lead.name, source: "Google" },
        }, orgId).catch(() => {});
      }
    } catch (err) {
      logger.error(`[google-ads-poll] "${automation.name}": failed to create lead for ${resourceName} — ${err.message}`);
      skipped++;
    }
  }

  automation.lastSyncAt = latestSubmission;
  automation.status = "connected";
  await automation.save();

  logger.info(`[google-ads-poll] "${automation.name}" (${automation._id}): ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

// Cron entry point — runs every connection in turn, one failure doesn't stop the rest.
async function pollGoogleAdsLeads() {
  const automations = await Automation.find({ platform: "Google", mode: "oauth", isActive: true });
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

module.exports = { pollGoogleAdsLeads, pollOneGoogleAdsConnection };
