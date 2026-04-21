const express = require("express");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Automation = require("../models/Automation");
const logger = require("../config/logger");
const { sendPushToAll } = require("../utils/push");
const { getNextAssignee } = require("../utils/assignLead");
const RoutingRule = require("../models/RoutingRule");

const router = express.Router();

async function getFacebookLeadFields(leadgenId, accessToken) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "field_data,created_time,ad_id,adgroup_id,form_id,page_id",
  });

  const response = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?${params.toString()}`);
  const json = await response.json();

  if (!response.ok) {
    const errCode = json?.error?.code;
    const errMsg  = json?.error?.message || JSON.stringify(json);

    // code 190 = OAuthException (expired / revoked token)
    // code 102 = Session key invalid or no longer valid
    if (errCode === 190 || errCode === 102) {
      const err = new Error(errMsg);
      err.isAuthError = true;
      throw err;
    }

    // code 100 with "No lead with leadgen id" = fake test ID
    throw new Error(errMsg);
  }

  return json;
}

async function findFacebookAutomationByPayload(leadData) {
  const candidates = await Automation.find({
    platform: "Facebook",
    isActive: true,
  }).sort({ updatedAt: -1 });

  // Priority 1: exact page + form match
  const exactMatch = candidates.find((item) => {
    const pageMatch = !item.pageId || item.pageId === String(leadData.page_id || "");
    const formMatch = !item.formId || item.formId === String(leadData.form_id || "");
    return pageMatch && formMatch;
  });
  if (exactMatch) return exactMatch;

  // Priority 2: match by page_id only (covers any new form on that page)
  if (leadData.page_id) {
    const pageMatch = candidates.find(
      (item) => item.pageId && item.pageId === String(leadData.page_id)
    );
    if (pageMatch) return pageMatch;
  }

  // Priority 3: any automation with no page restriction
  return candidates.find((item) => !item.pageId) || null;
}

// Try all active Facebook tokens until one successfully fetches the lead
async function fetchLeadWithFallback(leadgenId, primaryToken, primaryAutomationId) {
  // First try the primary token
  try {
    const result = await getFacebookLeadFields(leadgenId, primaryToken);
    return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
  } catch (err) {
    if (err.isAuthError) {
      // Primary token is expired — try other automations' tokens
      logger.warn(`Facebook webhook: primary token expired for lead ${leadgenId}, trying fallback tokens`);
    } else {
      // Non-auth error on primary — could be wrong page token, try others before declaring test lead
      logger.warn(`Facebook webhook: primary token failed for lead ${leadgenId} (${err.message}), trying fallback tokens`);
    }
  }

  // Try all other active automation tokens as fallback
  const allAutomations = await Automation.find({
    platform: "Facebook",
    isActive: true,
    accessToken: { $exists: true, $ne: "" },
    _id: { $ne: primaryAutomationId },
  });

  for (const auto of allAutomations) {
    try {
      const result = await getFacebookLeadFields(leadgenId, auto.accessToken);
      logger.info(`Facebook webhook: fallback token from automation "${auto.name}" succeeded for lead ${leadgenId}`);
      return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
    } catch (e) {
      if (e.isAuthError) continue; // Try next token
      // Non-auth error (e.g. "No lead with leadgen id") = fake/test ID — stop trying
      return { leadDetails: null, isAuthError: false, isTestLead: true, fetchError: e.message };
    }
  }

  // All tokens exhausted without a definitive "fake ID" error — mark as auth error
  // so the user gets a clear message to reconnect
  return {
    leadDetails: null,
    isAuthError: true,
    isTestLead: false,
    fetchError: "All access tokens failed. Please reconnect Facebook in Automation settings.",
  };
}

router.get("/", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const matchedAutomation = token
    ? await Automation.findOne({ platform: "Facebook", verifyToken: token, isActive: true })
    : null;

  if (mode === "subscribe" && (matchedAutomation || token === process.env.FB_VERIFY_TOKEN)) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, message: "Webhook verification failed" });
});

router.post("/", express.json(), async (req, res) => {
  console.log("[webhook] POST received:", JSON.stringify(req.body).slice(0, 500));
  try {
    const entries = req.body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const leadData = change.value || {};
        let automation = await findFacebookAutomationByPayload(leadData);

        // Fall back to any active Facebook automation (handles test leads with fake IDs)
        if (!automation) {
          automation = await Automation.findOne({ platform: "Facebook", isActive: true }).sort({ updatedAt: -1 });
        }

        if (!automation) {
          logger.warn(`Facebook webhook skipped lead ${leadData.leadgen_id || "unknown"}: no active Facebook automation found`);
          continue;
        }

        const accessToken = automation.accessToken || process.env.FB_PAGE_ACCESS_TOKEN;

        if (!accessToken) {
          logger.warn(`Facebook webhook skipped lead ${leadData.leadgen_id || "unknown"}: no access token configured`);
          continue;
        }

        let leadDetails = leadData;
        let isTestLead = false;
        let isAuthError = false;
        let fetchError = null;

        if (!leadData.field_data) {
          const tokenPreview = accessToken ? accessToken.slice(0, 20) + "..." : "NONE";
          logger.info(`Facebook webhook: fetching lead ${leadData.leadgen_id} with token ${tokenPreview}`);
          const fetchResult = await fetchLeadWithFallback(leadData.leadgen_id, accessToken, automation._id);
          if (fetchResult.leadDetails) {
            leadDetails = fetchResult.leadDetails;
            logger.info(`Facebook webhook: fetched lead fields for ${leadData.leadgen_id} — fields: ${(leadDetails.field_data || []).map(f => f.name).join(", ")}`);
          } else {
            isTestLead  = fetchResult.isTestLead;
            isAuthError = fetchResult.isAuthError;
            fetchError  = fetchResult.fetchError;
            if (isAuthError) logger.error(`Facebook webhook: all tokens failed for lead ${leadData.leadgen_id}: ${fetchError}`);
            if (isTestLead)  logger.warn(`Facebook webhook: lead ${leadData.leadgen_id} is a test/fake ID: ${fetchError}`);
          }
        }

        const fieldMap = Object.fromEntries((leadDetails.field_data || []).map((item) => [item.name, item.values?.[0] || ""]));

        // Extract custom form answers as requirements (exclude standard contact fields)
        const STANDARD_FIELDS = new Set(["full_name", "first_name", "last_name", "email", "phone_number", "phone"]);
        const requirements = Object.entries(fieldMap)
          .filter(([k]) => !STANDARD_FIELDS.has(k) && fieldMap[k])
          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
          .join(" · ");

        const name = isTestLead
          ? "Test Lead (Facebook)"
          : (fieldMap.full_name ||
             [fieldMap.first_name, fieldMap.last_name].filter(Boolean).join(" ").trim() ||
             "Facebook Lead");

        const noteText = isTestLead
          ? `⚠️ Facebook Test Lead — Sent via Meta's testing tool. The lead ID is simulated and cannot be retrieved from the Graph API. Real leads from your Facebook ad form will include name, phone, email, and all form fields.\n\nLead ID: ${leadData.leadgen_id || "unknown"}`
          : isAuthError
          ? `⚠️ Facebook lead received but field data could not be fetched — the page access token has expired or been revoked.\n\nAction required: Go to CRM → Automation → Facebook and reconnect your Facebook account to refresh the token.\n\nLead ID: ${leadData.leadgen_id || "unknown"}\nError: ${fetchError}`
          : `Imported from Meta Lead Ads.\nLead ID: ${leadData.leadgen_id || "unknown"}${
              Object.keys(fieldMap).length > 0
                ? `\nFields: ${Object.entries(fieldMap).map(([k, v]) => `${k}: ${v}`).join(", ")}`
                : ""
            }`;

        // Check campaign routing rules first (form_id, campaign_id, adset_id, ad_id)
        const ruleMatch = await RoutingRule.findOne({
          isActive: true,
          $or: [
            { matchField: "form_id",     matchValue: String(leadData.form_id     || leadDetails.form_id     || "") },
            { matchField: "campaign_id", matchValue: String(leadData.campaign_id || "") },
            { matchField: "adset_id",    matchValue: String(leadData.adset_id    || "") },
            { matchField: "ad_id",       matchValue: String(leadData.ad_id       || leadDetails.ad_id       || "") },
          ].filter((c) => c.matchValue),
        });

        let assignee;
        if (ruleMatch) {
          assignee = { _id: ruleMatch.assignTo, name: ruleMatch.assignToName };
          logger.info(`Facebook webhook: rule "${ruleMatch.label}" matched — assigning "${name}" to ${assignee.name}`);
        } else {
          assignee = await getNextAssignee();
          logger.info(`Facebook webhook: no rule matched — round-robin assigning "${name}" to ${assignee.name}`);
        }

        await Lead.create({
          name,
          phone: fieldMap.phone_number || fieldMap.phone || (isTestLead ? "N/A (test)" : "N/A"),
          email: fieldMap.email || "",
          source: "Facebook",
          status: "New",
          requirements: isTestLead ? "" : requirements,
          createdBy: assignee._id,
          assignedTo: assignee._id,
          assignedToName: assignee.name,
          leadSourceLabel: isTestLead
            ? `${automation?.name || "Facebook Lead Ads"} — Test`
            : (automation?.name || "Facebook Lead Ads"),
          notes: [
            {
              text: noteText,
              addedBy: assignee._id,
              addedByName: assignee.name,
            },
          ],
          activities: [
            {
              type: "created",
              description: `Lead received from Meta Lead Ads webhook — auto-assigned to ${assignee.name}`,
              performedBy: assignee._id,
              performedByName: assignee.name,
              meta: {
                formId: leadDetails.form_id || leadData.form_id || "",
                pageId: leadDetails.page_id || leadData.page_id || "",
                automationId: automation?._id?.toString() || "",
              },
            },
          ],
        });

        if (automation) {
          automation.status = "connected";
          automation.lastSyncAt = new Date();
          await automation.save();
        }

        // Send push notification to all subscribed users
        sendPushToAll({
          type: "new_lead",
          title: "New Facebook Lead 🏠",
          body: `${name} just submitted a lead from Facebook`,
          data: { leadName: name, source: "Facebook" },
        }).catch((e) => logger.warn("Push notification failed:", e.message));
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error(`Facebook webhook error: ${err.message}`);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
});

// ── Website / WordPress webhook ───────────────────────────────────────────────
// POST /webhook/website  { token, name, phone, email, message, source_name, form_plugin, form_name, page_url }
router.post("/website", express.json(), async (req, res) => {
  try {
    const { token, name, phone, email, message, source_name, form_plugin, form_name, page_url } = req.body || {};

    if (!token) return res.status(400).json({ success: false, message: "Missing token" });

    const automation = await Automation.findOne({ platform: "Website Form", verifyToken: token, isActive: true });
    if (!automation) return res.status(401).json({ success: false, message: "Invalid token" });

    const assignee = await getNextAssignee();

    // Use the actual form name if the plugin sent it (e.g. "Vanaha Verdant Contact Form")
    // Fall back to "siteName via PluginName" if no form name available
    const pluginLabels = {
      metform: "MetForm", elementor_form: "Elementor Pro Forms", cf7: "Contact Form 7",
      wpforms: "WPForms", gravity_form: "Gravity Forms", ninja_form: "Ninja Forms",
      forminator_form: "Forminator", fluent_form: "Fluent Forms", manual_test: "Test Lead",
    };
    const siteName = source_name || automation.siteName || automation.name || "Website";
    const pluginLabel = pluginLabels[form_plugin] || form_plugin || "";
    const sourceLabel = form_name
      ? form_name
      : pluginLabel ? `${siteName} via ${pluginLabel}` : siteName;

    const lead = await Lead.create({
      name: name || "Website Lead",
      phone: phone || "N/A",
      email: email || "",
      source: "Website",
      status: "New",
      requirements: message || "",
      createdBy: assignee._id,
      assignedTo: assignee._id,
      assignedToName: assignee.name,
      leadSourceLabel: sourceLabel,
      formPlugin: form_plugin || "",
      notes: [
        {
          text: [
            message ? `Message: ${message}` : null,
            form_plugin ? `Form plugin: ${form_plugin}` : null,
            page_url ? `Page: ${page_url}` : null,
          ].filter(Boolean).join("\n") || "Lead received from website contact form",
          addedBy: assignee._id,
          addedByName: assignee.name,
        },
      ],
      activities: [
        {
          type: "created",
          description: `Lead received from website contact form — auto-assigned to ${assignee.name}`,
          performedBy: assignee._id,
          performedByName: assignee.name,
          meta: { formPlugin: form_plugin || "", pageUrl: page_url || "", automationId: automation._id?.toString() },
        },
      ],
    });

    automation.status = "connected";
    automation.lastSyncAt = new Date();
    await automation.save();

    sendPushToAll({
      type: "new_lead",
      title: "New Website Lead 🌐",
      body: `${lead.name} submitted a form on your website`,
      data: { leadName: lead.name, source: "Website" },
    }).catch(() => {});

    logger.info(`[website webhook] lead created: ${lead.name} | ${phone} | plugin: ${form_plugin}`);
    res.status(200).json({ success: true, message: "Lead received" });
  } catch (err) {
    logger.error(`[website webhook] error: ${err.message}`);
    res.status(500).json({ success: false, message: "Failed to process lead" });
  }
});

// ── Website plugin registration (called when plugin saves settings) ───────────
// POST /webhook/website/register  { token, site_name, site_url, forms: [] }
router.post("/website/register", express.json(), async (req, res) => {
  try {
    const { token, site_name, site_url, forms } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: "Missing token" });

    const automation = await Automation.findOne({ platform: "Website Form", verifyToken: token, isActive: true });
    if (!automation) return res.status(401).json({ success: false, message: "Invalid token" });

    if (site_name) automation.siteName = site_name;
    if (site_url)  automation.siteUrl  = site_url;
    if (Array.isArray(forms)) automation.connectedForms = forms;
    automation.status = "connected";
    automation.lastSyncAt = new Date();
    await automation.save();

    logger.info(`[website register] connected: ${site_name || site_url} | forms: ${(forms || []).join(", ")}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`[website register] error: ${err.message}`);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
