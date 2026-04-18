const express = require("express");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Automation = require("../models/Automation");
const logger = require("../config/logger");
const { sendPushToAll } = require("../utils/push");
const { getNextAssignee } = require("../utils/assignLead");

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

  return candidates.find((item) => {
    const pageMatch = !item.pageId || item.pageId === String(leadData.page_id || "");
    const formMatch = !item.formId || item.formId === String(leadData.form_id || "");
    return pageMatch && formMatch;
  });
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
          try {
            leadDetails = await getFacebookLeadFields(leadData.leadgen_id, accessToken);
            logger.info(`Facebook webhook: fetched lead fields for ${leadData.leadgen_id} — fields: ${(leadDetails.field_data || []).map(f => f.name).join(", ")}`);
          } catch (fetchErr) {
            fetchError = fetchErr.message;
            if (fetchErr.isAuthError) {
              isAuthError = true;
              logger.error(`Facebook webhook: ACCESS TOKEN EXPIRED/INVALID for ${leadData.leadgen_id}. Reconnect Facebook in Automation settings. Error: ${fetchErr.message}`);
            } else {
              // For test tool leads: real leadgen_id IS created, so this shouldn't fail with valid token
              // If it fails with "unsupported get request" or "no lead" → it IS a fake test ID
              isTestLead = true;
              logger.warn(`Facebook webhook: lead fetch failed for ${leadData.leadgen_id} (likely test/fake ID): ${fetchErr.message}`);
            }
          }
        }

        const fieldMap = Object.fromEntries((leadDetails.field_data || []).map((item) => [item.name, item.values?.[0] || ""]));

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

        const assignee = await getNextAssignee();
        logger.info(`Facebook webhook: assigning lead "${name}" to ${assignee.name}`);

        await Lead.create({
          name,
          phone: fieldMap.phone_number || fieldMap.phone || (isTestLead ? "N/A (test)" : "N/A"),
          email: fieldMap.email || "",
          source: "Facebook",
          status: "New",
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
