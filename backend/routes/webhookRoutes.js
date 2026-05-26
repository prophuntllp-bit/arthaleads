const express = require("express");
const crypto  = require("crypto");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Automation = require("../models/Automation");
const logger = require("../config/logger");
const { sendPushToAll, sendPushToUser } = require("../utils/push");
const { getNextAssignee } = require("../utils/assignLead");
const RoutingRule     = require("../models/RoutingRule");
const Organization    = require("../models/Organization");

const router = express.Router();

// ── Facebook signature verification ──────────────────────────────────────────
// Uses the `verify` callback of express.json() to access the raw buffer
// before parsing. Throws 403 if the signature doesn't match FB_APP_SECRET.
function verifyFbSignature(req, res, buf) {
  const sig = req.headers["x-hub-signature-256"];
  if (!process.env.FB_APP_SECRET) {
    logger.warn("Facebook webhook: FB_APP_SECRET not configured - webhook signature verification disabled");
    return; // allow in dev; configure FB_APP_SECRET in prod
  }
  if (!sig) {
    const err = new Error("Missing X-Hub-Signature-256 header");
    err.status = 403;
    throw err;
  }
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.FB_APP_SECRET)
    .update(buf)
    .digest("hex");
  // constant-time compare to prevent timing attacks
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.warn("Facebook webhook: invalid X-Hub-Signature-256 - request rejected");
    const err = new Error("Invalid Facebook webhook signature");
    err.status = 403;
    throw err;
  }
}

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

  // Priority 3 (wildcard catch-all) intentionally removed - it could capture
  // leads from other orgs when a pageId is absent (e.g. test payloads).
  logger.warn(`Facebook webhook: no matching automation found for page_id="${leadData.page_id || ""}" form_id="${leadData.form_id || ""}"`);
  return null;
}

// ── Auto-refresh a page token using the stored long-lived user token ──────────
// Returns the new page access token string, or null if it can't refresh.
// Saves the new page token to the DB so the next webhook call succeeds.
const META_GRAPH_VERSION = "v23.0";
async function autoRefreshPageToken(auto) {
  if (!auto.userToken || !auto.pageId) return null;
  try {
    const params = new URLSearchParams({ access_token: auto.userToken, fields: "access_token" });
    const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${auto.pageId}?${params.toString()}`);
    const json = await resp.json();
    if (json.access_token) {
      await Automation.findByIdAndUpdate(auto._id, { accessToken: json.access_token });
      logger.info(`Facebook webhook: silently refreshed page token for automation "${auto.name}" - no reconnection needed`);
      return json.access_token;
    }
    logger.warn(`Facebook webhook: auto-refresh for "${auto.name}" returned no token: ${JSON.stringify(json)}`);
  } catch (e) {
    logger.warn(`Facebook webhook: auto-refresh failed for "${auto.name}": ${e.message}`);
  }
  return null;
}

// Try all active Facebook tokens until one successfully fetches the lead.
// If all page tokens fail with auth errors, auto-refresh them using stored userToken
// before giving up - this makes the system self-healing without manual reconnection.
async function fetchLeadWithFallback(leadgenId, primaryToken, primaryAutomation, orgId) {
  const primaryAutomationId = primaryAutomation?._id;

  // 1️⃣ Try the primary token first
  try {
    const result = await getFacebookLeadFields(leadgenId, primaryToken);
    return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
  } catch (err) {
    if (err.isAuthError) {
      logger.warn(`Facebook webhook: primary token expired for lead ${leadgenId}, trying auto-refresh then fallbacks`);
    } else {
      logger.warn(`Facebook webhook: primary token failed for lead ${leadgenId} (${err.message}), trying fallback tokens`);
    }
  }

  // 2️⃣ Auto-refresh primary automation's page token using its userToken
  if (primaryAutomation?.userToken && primaryAutomation?.pageId) {
    const refreshed = await autoRefreshPageToken(primaryAutomation);
    if (refreshed) {
      try {
        const result = await getFacebookLeadFields(leadgenId, refreshed);
        logger.info(`Facebook webhook: auto-refreshed primary token succeeded for lead ${leadgenId}`);
        return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
      } catch (e) {
        logger.warn(`Facebook webhook: auto-refreshed primary token also failed for lead ${leadgenId}: ${e.message}`);
      }
    }
  }

  // 3️⃣ Try all other active automation tokens from the SAME ORG
  const allAutomations = await Automation.find({
    orgId,
    platform: "Facebook",
    isActive: true,
    accessToken: { $exists: true, $ne: "" },
    _id: { $ne: primaryAutomationId },
  });

  const errors = [];
  for (const auto of allAutomations) {
    try {
      const result = await getFacebookLeadFields(leadgenId, auto.accessToken);
      logger.info(`Facebook webhook: fallback token from automation "${auto.name}" succeeded for lead ${leadgenId}`);
      return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
    } catch (e) {
      if (e.isAuthError) {
        errors.push({ type: "auth", message: e.message, automation: auto.name, doc: auto });
        continue;
      }
      errors.push({ type: "other", message: e.message, automation: auto.name });
      logger.debug(`Facebook webhook: fallback token from automation "${auto.name}" failed: ${e.message}`);
    }
  }

  // 4️⃣ Auto-refresh all fallback automations that had auth errors and have a userToken
  for (const errEntry of errors.filter(e => e.type === "auth" && e.doc?.userToken)) {
    const refreshed = await autoRefreshPageToken(errEntry.doc);
    if (refreshed) {
      try {
        const result = await getFacebookLeadFields(leadgenId, refreshed);
        logger.info(`Facebook webhook: auto-refreshed fallback "${errEntry.automation}" succeeded for lead ${leadgenId}`);
        return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
      } catch (e) {
        logger.warn(`Facebook webhook: auto-refreshed fallback "${errEntry.automation}" also failed: ${e.message}`);
      }
    }
  }

  // 5️⃣ All tokens exhausted - check if it's just a test lead
  const hasNoLeadErrors = errors.some(e => e.message?.includes("No lead with leadgen id"));
  if (hasNoLeadErrors && errors.every(e => e.message?.includes("No lead with leadgen id"))) {
    return {
      leadDetails: null,
      isAuthError: false,
      isTestLead: true,
      fetchError: "No lead with leadgen id - appears to be a test/simulated ID",
    };
  }

  const errorSummary = errors.map(e => `${e.automation}: ${e.message}`).join("; ");
  logger.warn(`Facebook webhook: all tokens failed for lead ${leadgenId} - errors: ${errorSummary}`);

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

router.post("/", express.json({ verify: verifyFbSignature }), async (req, res) => {
  console.log("[webhook] POST received:", JSON.stringify(req.body).slice(0, 500));
  try {
    const entries = req.body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const leadData = change.value || {};
        // findFacebookAutomationByPayload already scopes by page_id / form_id.
        // Removed the cross-org catch-all fallback - it could route leads to the
        // wrong tenant's pipeline when page_id is absent (e.g. test payloads).
        const automation = await findFacebookAutomationByPayload(leadData);

        if (!automation) {
          logger.warn(`Facebook webhook skipped lead ${leadData.leadgen_id || "unknown"}: no matching active Facebook automation found`);
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
          const fetchResult = await fetchLeadWithFallback(leadData.leadgen_id, accessToken, automation, automation.orgId);
          if (fetchResult.leadDetails) {
            leadDetails = fetchResult.leadDetails;
            logger.info(`Facebook webhook: fetched lead fields for ${leadData.leadgen_id} - fields: ${(leadDetails.field_data || []).map(f => f.name).join(", ")}`);
          } else {
            isTestLead  = fetchResult.isTestLead;
            isAuthError = fetchResult.isAuthError;
            fetchError  = fetchResult.fetchError;
            if (isAuthError) logger.error(`Facebook webhook: all tokens failed for lead ${leadData.leadgen_id}: ${fetchError}`);
            if (isTestLead)  logger.warn(`Facebook webhook: lead ${leadData.leadgen_id} is a test/fake ID: ${fetchError}`);
          }
        }

        const fieldMap = Object.fromEntries((leadDetails.field_data || []).map((item) => [item.name, item.values?.[0] || ""]));

        // Extract custom form answers (exclude standard contact fields)
        const STANDARD_FIELDS = new Set(["full_name", "first_name", "last_name", "email", "phone_number", "phone", "name"]);
        const customFields = (leadDetails.field_data || []).filter((f) => !STANDARD_FIELDS.has(f.name) && f.values?.[0]);
        const requirements = customFields.map((f) => `${f.name.replace(/_/g, " ")}: ${f.values?.[0]}`).join(" · ");

        // Build formResponses for Info tab "Form Questions" section
        const formResponses = customFields.map((f) => ({
          fieldKey: f.name,
          label:    f.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          value:    f.values?.[0] || "",
        }));

        const name = isTestLead
          ? "Test Lead (Facebook)"
          : (fieldMap.full_name ||
             [fieldMap.first_name, fieldMap.last_name].filter(Boolean).join(" ").trim() ||
             "Facebook Lead");

        // Build success note with all form answers clearly listed
        const customLines = customFields.map((f) =>
          `${f.name.replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase())}: ${f.values?.[0]}`
        ).join("\n");

        const noteText = isTestLead
          ? `⚠️ Facebook Test Lead - Sent via Meta's testing tool. The lead ID is simulated and cannot be retrieved from the Graph API. Real leads from your Facebook ad form will include name, phone, email, and all form fields.\n\nLead ID: ${leadData.leadgen_id || "unknown"}`
          : isAuthError
          ? `⚠️ Facebook lead received but field data could not be fetched - the page access token has expired or been revoked.\n\nAction required: Go to CRM → Automation → Facebook and reconnect your Facebook account to refresh the token.\n\nLead ID: ${leadData.leadgen_id || "unknown"}\nError: ${fetchError}`
          : [
              `✅ Facebook lead imported from Meta Lead Ads.`,
              `Name: ${name || "-"}`,
              `Phone: ${fieldMap.phone_number || fieldMap.phone || "N/A"}`,
              `Email: ${fieldMap.email || "-"}`,
              customLines ? `\nForm Answers:\n${customLines}` : "",
              `Lead ID: ${leadData.leadgen_id || "unknown"}`,
            ].filter(Boolean).join("\n");

        // Check campaign routing rules first (form_id, campaign_id, adset_id, ad_id)
        const orgId = automation.orgId;

        const ruleMatch = await RoutingRule.findOne({
          orgId,
          isActive: true,
          $or: [
            { matchField: "form_id",     matchValue: String(leadData.form_id     || leadDetails.form_id     || "") },
            { matchField: "campaign_id", matchValue: String(leadData.campaign_id || "") },
            { matchField: "adset_id",    matchValue: String(leadData.adset_id    || "") },
            { matchField: "ad_id",       matchValue: String(leadData.ad_id       || leadDetails.ad_id       || "") },
          ].filter((c) => c.matchValue),
        });

        // Routing rules always assign regardless of autoAssign (they are explicit overrides).
        // Round-robin fallback only runs when autoAssign is enabled.
        let assignee = null;
        if (ruleMatch) {
          assignee = { _id: ruleMatch.assignTo, name: ruleMatch.assignToName };
          logger.info(`Facebook webhook: rule "${ruleMatch.label}" matched - assigning "${name}" to ${assignee.name}`);
        } else {
          const fbOrg = await Organization.findById(orgId).select("autoAssign").lean();
          if (fbOrg?.autoAssign !== false) {
            try {
              assignee = await getNextAssignee(orgId);
              logger.info(`Facebook webhook: no rule matched - round-robin assigning "${name}" to ${assignee.name}`);
            } catch { /* no active agents */ }
          } else {
            logger.info(`Facebook webhook: auto-assignment disabled - "${name}" left unassigned`);
          }
        }

        await Lead.create({
          name,
          phone: fieldMap.phone_number || fieldMap.phone || (isTestLead ? "N/A (test)" : "N/A"),
          email: fieldMap.email || "",
          source: "Facebook",
          status: "New",
          requirements: isTestLead ? "" : requirements,
          formResponses: isTestLead ? [] : formResponses,
          orgId,
          createdBy: assignee?._id || null,
          assignedTo: assignee?._id || null,
          assignedToName: assignee?.name || "",
          leadSourceLabel: isTestLead
            ? `${automation?.name || "Facebook Lead Ads"} - Test`
            : (automation?.name || "Facebook Lead Ads"),
          notes: [
            {
              text: noteText,
              addedBy: assignee?._id || null,
              addedByName: assignee?.name || "",
            },
          ],
          activities: [
            {
              type: "created",
              description: assignee
                ? `Lead received from Meta Lead Ads webhook - auto-assigned to ${assignee.name}`
                : "Lead received from Meta Lead Ads webhook - unassigned (auto-assignment disabled)",
              performedBy: assignee?._id || null,
              performedByName: assignee?.name || "",
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

        // Send push notification — targeted to assignee if assigned, broadcast otherwise
        if (assignee?._id) {
          const phone = fieldMap.phone_number || fieldMap.phone || "";
          sendPushToUser(assignee._id, {
            type: "lead_assigned",
            title: `New Facebook Lead: ${name}`,
            body: [phone, "Facebook"].filter(Boolean).join(" · "),
            data: { url: "/leads" },
          }).catch((e) => logger.warn("Push notification failed:", e.message));
        } else {
          sendPushToAll({
            type: "new_lead",
            title: "New Facebook Lead 🏠",
            body: `${name} just submitted a lead from Facebook`,
            data: { url: "/leads", leadName: name, source: "Facebook" },
          }, orgId).catch((e) => logger.warn("Push notification failed:", e.message));
        }
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

    const orgId = automation.orgId;

    // Respect the org's Auto Lead Assignment setting
    const org = await Organization.findById(orgId).select("autoAssign").lean();
    let assignee = null;
    if (org?.autoAssign !== false) {
      try { assignee = await getNextAssignee(orgId); } catch { /* no active agents */ }
    }

    // Always use the automation connection name as the primary source label
    // (this is the name the admin gave when creating the connection, e.g. "Shapoorjipallonji.com")
    // form_name is kept in notes for context but should not override the website identity
    const pluginLabels = {
      metform: "MetForm", elementor_form: "Elementor Pro Forms", cf7: "Contact Form 7",
      wpforms: "WPForms", gravity_form: "Gravity Forms", ninja_form: "Ninja Forms",
      forminator_form: "Forminator", fluent_form: "Fluent Forms", manual_test: "Test Lead",
    };
    const pluginLabel = pluginLabels[form_plugin] || form_plugin || "";
    // Priority: automation.name (user-defined connection name) > source_name > automation.siteName
    const siteName = automation.name || source_name || automation.siteName || "Website";
    // Always show the connection/website name — form_name goes into notes only
    const sourceLabel = siteName;

    const lead = await Lead.create({
      name: name || "Website Lead",
      phone: phone || "N/A",
      email: email || "",
      source: "Website",
      status: "New",
      requirements: message || "",
      orgId,
      createdBy: assignee?._id || automation.createdBy || null,
      assignedTo: assignee?._id || null,
      assignedToName: assignee?.name || "",
      leadSourceLabel: sourceLabel,
      formPlugin: form_plugin || "",
      notes: [
        {
          text: [
            message ? `Message: ${message}` : null,
            form_name ? `Form: ${form_name}` : null,
            form_plugin ? `Form plugin: ${pluginLabel || form_plugin}` : null,
            page_url ? `Page: ${page_url}` : null,
          ].filter(Boolean).join("\n") || "Lead received from website contact form",
          addedBy: assignee?._id || null,
          addedByName: assignee?.name || "",
        },
      ],
      activities: [
        {
          type: "created",
          description: assignee
            ? `Lead received from website contact form - auto-assigned to ${assignee.name}`
            : "Lead received from website contact form - unassigned (auto-assignment disabled)",
          performedBy: assignee?._id || null,
          performedByName: assignee?.name || "",
          meta: { formPlugin: form_plugin || "", pageUrl: page_url || "", automationId: automation._id?.toString() },
        },
      ],
    });

    automation.status = "connected";
    automation.lastSyncAt = new Date();
    await automation.save();

    // Send push notification — targeted to assignee if assigned, broadcast otherwise
    if (assignee?._id) {
      sendPushToUser(assignee._id, {
        type: "lead_assigned",
        title: `New Website Lead: ${lead.name}`,
        body: [phone, sourceLabel].filter(Boolean).join(" · "),
        data: { url: "/leads" },
      }).catch(() => {});
    } else {
      sendPushToAll({
        type: "new_lead",
        title: "New Website Lead 🌐",
        body: `${lead.name} submitted a form on your website`,
        data: { url: "/leads", leadName: lead.name, source: "Website" },
      }, orgId).catch(() => {});
    }

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
