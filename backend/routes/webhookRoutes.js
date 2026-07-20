const express = require("express");
const crypto  = require("crypto");
const rateLimit = require("express-rate-limit");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Automation = require("../models/Automation");
const logger = require("../config/logger");
const { sendPushToAll, sendPushToUser } = require("../utils/push");
const { getNextAssignee } = require("../utils/assignLead");
const RoutingRule     = require("../models/RoutingRule");
const Organization    = require("../models/Organization");
const { mapGoogleLeadFields, fromWebhookColumns } = require("../utils/googleLeadFields");

const router = express.Router();

// One alert per org per hour — prevents push spam when token is dead and leads keep arriving
const tokenAlertCooldown = new Map(); // orgId → lastAlertTimestamp

// Public, unauthenticated lead-capture endpoint used by the WordPress plugin
// and custom website forms. The `token` is embedded in the plugin's own
// config, so it isn't a secret strong enough to stop a scraper who finds it
// from POSTing directly to this endpoint, bypassing the actual site entirely.
// Rate-limit per token (not just per IP) so a single leaked token can't be
// used to flood one org's pipeline from many IPs.
const websiteLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 lead submissions per token per 15 min
  keyGenerator: (req) => req.body?.token || req.ip,
  message: { success: false, message: "Too many submissions, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Facebook signature verification ──────────────────────────────────────────
// Uses the `verify` callback of express.json() to access the raw buffer
// before parsing. Throws 403 if the signature doesn't match FB_APP_SECRET.
function verifyFbSignature(req, res, buf) {
  const sig = req.headers["x-hub-signature-256"];
  if (!process.env.FB_APP_SECRET) {
    // In production a missing secret must NOT silently accept every payload —
    // that would let anyone POST fake leads into any tenant's pipeline.
    if (process.env.NODE_ENV === "production") {
      logger.error("Facebook webhook: FB_APP_SECRET missing in production - rejecting request");
      const err = new Error("Webhook signature verification is not configured");
      err.status = 503;
      throw err;
    }
    logger.warn("Facebook webhook: FB_APP_SECRET not configured - webhook signature verification disabled (dev only)");
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
  // field_data is the only thing genuinely missing from the webhook payload (withheld
  // for privacy - you must fetch it separately). ad_id/form_id/adset_id/page_id/created_time
  // are already present on the raw webhook `leadData` itself, and some of them (e.g. page_id)
  // aren't even valid queryable fields on this Graph API object - requesting them here just
  // risks Graph rejecting the whole call over one bad field name, as page_id and adgroup_id
  // both did.
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "field_data",
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
  // Narrow by pageId at the DB level so MongoDB can use the compound index
  // { platform:1, isActive:1, pageId:1 } rather than scanning every tenant.
  // When page_id is absent the query falls back to a full active-FB scan
  // (rare — only happens for malformed or test payloads).
  const query = { platform: "Facebook", isActive: true };
  if (leadData.page_id) query.pageId = String(leadData.page_id);
  const candidates = await Automation.find(query).sort({ updatedAt: -1 });

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
// App Token (AppId|AppSecret) is tried FIRST — it never expires and works for
// every page that has subscribed the app via subscribePageWebhook. Individual
// user account suspensions, password changes, or token revocations do not affect it.
async function fetchLeadWithFallback(leadgenId, primaryToken, primaryAutomation, orgId) {
  const primaryAutomationId = primaryAutomation?._id;

  // Every attempt below records its failure here (not just the loop in step 4) so the
  // final message reflects the REAL Graph API error instead of a generic guess, and so
  // the "was this just a test lead" check in step 6 works even for orgs with only one
  // Facebook automation (where step 4's loop would otherwise run over zero candidates).
  const errors = [];
  const record = (label, e) => errors.push({ type: e.isAuthError ? "auth" : "other", message: e.message, automation: label });

  // 1️⃣ Try the App Access Token first — permanent, never expires, works for all
  //    pages that called subscribed_apps at connect time. This is the scalable path
  //    for a multi-tenant CRM: no per-user token required after initial setup.
  if (process.env.FB_APP_ID && process.env.FB_APP_SECRET) {
    const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;
    try {
      const result = await getFacebookLeadFields(leadgenId, appToken);
      return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
    } catch (appErr) {
      logger.warn(`Facebook webhook: App Token failed for lead ${leadgenId}: ${appErr.message}`);
      record("App Token", appErr);
    }
  }

  // 2️⃣ Try the stored page access token as first fallback
  if (primaryToken) {
    try {
      const result = await getFacebookLeadFields(leadgenId, primaryToken);
      logger.info(`Facebook webhook: stored page token succeeded for lead ${leadgenId}`);
      return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
    } catch (err) {
      if (err.isAuthError) {
        logger.warn(`Facebook webhook: stored page token expired for lead ${leadgenId}, trying auto-refresh`);
      } else {
        logger.warn(`Facebook webhook: stored page token failed for lead ${leadgenId} (${err.message})`);
      }
      record(primaryAutomation?.name || "Stored page token", err);
    }
  }

  // 3️⃣ Auto-refresh primary automation's page token using its userToken
  if (primaryAutomation?.userToken && primaryAutomation?.pageId) {
    const refreshed = await autoRefreshPageToken(primaryAutomation);
    if (refreshed) {
      try {
        const result = await getFacebookLeadFields(leadgenId, refreshed);
        logger.info(`Facebook webhook: auto-refreshed primary token succeeded for lead ${leadgenId}`);
        return { leadDetails: result, isAuthError: false, isTestLead: false, fetchError: null };
      } catch (e) {
        logger.warn(`Facebook webhook: auto-refreshed primary token also failed for lead ${leadgenId}: ${e.message}`);
        record(`${primaryAutomation?.name || "Primary"} (refreshed)`, e);
      }
    }
  }

  // 4️⃣ Try all other active automation tokens from the SAME ORG
  const allAutomations = await Automation.find({
    orgId,
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
      if (e.isAuthError) {
        errors.push({ type: "auth", message: e.message, automation: auto.name, doc: auto });
        continue;
      }
      errors.push({ type: "other", message: e.message, automation: auto.name });
      logger.debug(`Facebook webhook: fallback token from automation "${auto.name}" failed: ${e.message}`);
    }
  }

  // 5️⃣ Auto-refresh all fallback automations that had auth errors and have a userToken
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

  // 6️⃣ All tokens exhausted - check if it's just a test lead
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
    fetchError: errorSummary || "All access tokens failed. Please reconnect Facebook in Automation settings.",
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
            if (isAuthError) {
              logger.error(`Facebook webhook: all tokens failed for lead ${leadData.leadgen_id}: ${fetchError}`);
              // Push-notify admins — but at most once per org per hour to avoid spam
              const orgKey   = automation.orgId?.toString();
              const lastSent = tokenAlertCooldown.get(orgKey) || 0;
              if (Date.now() - lastSent > 60 * 60 * 1000) {
                tokenAlertCooldown.set(orgKey, Date.now());
                sendPushToAll({
                  type:  "facebook_token_expired",
                  title: "Action Required: Facebook Token Expired",
                  body:  "New leads are arriving but contact data can't be fetched. Go to Automation → Facebook and reconnect your account.",
                  data:  { url: "/automation" },
                }, automation.orgId).catch((e) => logger.warn("Push notification failed:", e.message));
              }
            }
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
            { matchField: "adset_id",    matchValue: String(leadData.adset_id    || leadDetails.adset_id    || "") },
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

        const createdLead = await Lead.create({
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

        // Self-heal: the fetch failure is often transient (e.g. a permission change on
        // Meta's side that hasn't fully propagated yet) rather than a genuinely dead
        // token — retrying once shortly after has repeatedly recovered leads that failed
        // on the first attempt. Runs after the response is sent so it never delays the
        // webhook ack or risks Meta re-delivering (and duplicating) the event.
        if (isAuthError) {
          const leadId = createdLead._id;
          const gid = leadData.leadgen_id;
          setTimeout(async () => {
            try {
              const retryResult = await fetchLeadWithFallback(gid, accessToken, automation, orgId);
              if (!retryResult.leadDetails) {
                logger.warn(`Facebook webhook: auto-retry still failed for lead ${gid}: ${retryResult.fetchError}`);
                return;
              }
              const fm2 = Object.fromEntries((retryResult.leadDetails.field_data || []).map((item) => [item.name, item.values?.[0] || ""]));
              const cf2 = (retryResult.leadDetails.field_data || []).filter((f) => !STANDARD_FIELDS.has(f.name) && f.values?.[0]);
              const req2 = cf2.map((f) => `${f.name.replace(/_/g, " ")}: ${f.values?.[0]}`).join(" · ");
              const fr2 = cf2.map((f) => ({
                fieldKey: f.name,
                label: f.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                value: f.values?.[0] || "",
              }));
              const name2 = fm2.full_name || [fm2.first_name, fm2.last_name].filter(Boolean).join(" ").trim() || "Facebook Lead";
              const lines2 = cf2.map((f) => `${f.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${f.values?.[0]}`).join("\n");
              await Lead.updateOne({ _id: leadId }, {
                $set: {
                  name: name2,
                  phone: fm2.phone_number || fm2.phone || "N/A",
                  email: fm2.email || "",
                  requirements: req2,
                  formResponses: fr2,
                },
                $push: {
                  notes: {
                    text: [
                      `✅ Field data recovered on automatic retry.`,
                      `Name: ${name2 || "-"}`,
                      `Phone: ${fm2.phone_number || fm2.phone || "N/A"}`,
                      `Email: ${fm2.email || "-"}`,
                      lines2 ? `\nForm Answers:\n${lines2}` : "",
                      `Lead ID: ${gid || "unknown"}`,
                    ].filter(Boolean).join("\n"),
                    addedBy: null,
                    addedByName: "System",
                  },
                },
              });
              logger.info(`Facebook webhook: auto-retry recovered field data for lead ${gid} (leadId=${leadId})`);
            } catch (e) {
              logger.error(`Facebook webhook: auto-retry threw for lead ${gid}: ${e.message}`);
            }
          }, 45000);
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
// POST /webhook/website  { token, name, phone, email, message, source_name, form_plugin, form_name, page_url, website_url }
router.post("/website", express.json(), websiteLeadLimiter, async (req, res) => {
  try {
    const { token, name, phone, email, message, source_name, form_plugin, form_name, page_url, website_url } = req.body || {};

    // Honeypot: the plugin always sends this field empty. A generic bot that
    // blindly fills every field it finds in the plugin's public source will
    // often fill it too — silently accept without creating a lead so the
    // bot doesn't learn its submission was rejected.
    if (website_url) {
      logger.info(`[website webhook] honeypot triggered, dropped silently (token=${String(token).slice(0, 8)}…)`);
      return res.status(200).json({ success: true, message: "Lead received" });
    }

    if (!token) return res.status(400).json({ success: false, message: "Missing token" });

    const automation = await Automation.findOne({ platform: "Website Form", verifyToken: token, isActive: true });
    if (!automation) return res.status(401).json({ success: false, message: "Invalid token" });

    const orgId = automation.orgId;

    // Deduplication: if the same phone number already created a lead for this org
    // within the last 2 minutes, it's a plugin double-fire — skip silently.
    if (phone) {
      const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
      const recent = await Lead.findOne({ orgId, phone, createdAt: { $gte: twoMinsAgo } }).lean();
      if (recent) {
        logger.info(`[website webhook] duplicate skipped: ${name} | ${phone} | original: ${recent.createdAt}`);
        return res.status(200).json({ success: true, message: "Duplicate lead ignored" });
      }
    }

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
      sourcePage: page_url || "",
      sourceDomain: (() => { try { return page_url ? new URL(page_url).hostname.replace(/^www\./, "") : ""; } catch { return ""; } })(),
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

// ── Custom source webhook ─────────────────────────────────────────────────────
// POST /webhook/lead  { token, name, phone, email, message }
// Generic token-authenticated lead ingestion for "Custom" sources (partners,
// brokers, vendors, voice-AI bridges, etc). No user JWT — auth is the per-source
// `token` matched against Automation.verifyToken, exactly like /webhook/website.
// `message` is stored in the lead's `requirements` field (call transcript / notes).
const customLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // 60 submissions per token per 15 min
  keyGenerator: (req) => req.body?.token || req.query?.token || req.ip,
  message: { success: false, message: "Too many submissions, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/lead", express.json(), customLeadLimiter, async (req, res) => {
  try {
    // Accept token from body or query string for sender flexibility
    const token = req.body?.token || req.query?.token;
    const {
      name, phone, email, message, source_name,
      // Optional Vistrow Voice enrichment (all backward-compatible — a payload
      // without any of these behaves exactly as before).
      transcript, sentiment, duration_seconds, channel, language, agent_name, extracted_data,
    } = req.body || {};

    if (!token) return res.status(400).json({ success: false, message: "Missing token" });

    // Validate required fields (mirror createLeadSchema: name/phone required, email optional)
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ success: false, message: "Field 'name' is required (min 2 chars)" });
    }
    if (!phone || String(phone).trim().length < 7) {
      return res.status(400).json({ success: false, message: "Field 'phone' is required (min 7 chars)" });
    }

    // Token-ingest platforms (Custom, Vistrow Voice) share this endpoint and are
    // disambiguated purely by their token. Keep in sync with TOKEN_INGEST_PLATFORMS
    // in services/automationService.js.
    const automation = await Automation.findOne({
      platform: { $in: ["Custom", "Vistrow Voice"] },
      verifyToken: token,
      isActive: true,
    });
    if (!automation) return res.status(401).json({ success: false, message: "Invalid token" });

    const orgId = automation.orgId;
    // Stamp the lead's source from the matched connection so a Vistrow Voice
    // token produces "Vistrow Voice" leads and a generic Custom token "Custom".
    const leadSource = automation.platform === "Vistrow Voice" ? "Vistrow Voice" : "Custom";

    // Deduplication: same phone for this org within the last 2 minutes = a
    // double-fire from the sender — skip silently (same guard as website flow).
    const cleanPhone = String(phone).trim();
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recent = await Lead.findOne({ orgId, phone: cleanPhone, createdAt: { $gte: twoMinsAgo } }).lean();
    if (recent) {
      logger.info(`[custom webhook] duplicate skipped: ${name} | ${cleanPhone} | original: ${recent.createdAt}`);
      return res.status(200).json({ success: true, message: "Duplicate lead ignored" });
    }

    // Respect the org's Auto Lead Assignment setting
    const org = await Organization.findById(orgId).select("autoAssign").lean();
    let assignee = null;
    if (org?.autoAssign !== false) {
      try { assignee = await getNextAssignee(orgId); } catch { /* no active agents */ }
    }

    // The connection name the admin gave (e.g. "Shapoorji Pallonji Treetopia")
    // is the primary source label; source_name from the payload is a fallback.
    const sourceLabel = automation.name || source_name || automation.leadSourceLabel || "Custom";
    const msg = message ? String(message).trim() : "";

    // Build the optional Vistrow Voice payload. Everything here is defensive:
    // any missing/malformed field is dropped, and if nothing usable is present
    // `voiceCall` stays undefined so the lead is stored exactly as before.
    const SENTIMENTS = ["positive", "neutral", "negative"];
    const cleanTranscript = Array.isArray(transcript)
      ? transcript
          .filter((t) => t && typeof t === "object")
          .map((t) => ({
            speaker: (t.speaker === "Caller" || t.speaker === "Agent") ? t.speaker : String(t.speaker ?? ""),
            text: typeof t.text === "string" ? t.text : String(t.text ?? ""),
          }))
          .filter((t) => t.text.trim())
      : [];
    const durNum = Number(duration_seconds);
    const hasExtracted = extracted_data && typeof extracted_data === "object"
      && !Array.isArray(extracted_data) && Object.keys(extracted_data).length > 0;

    let voiceCall;
    if (cleanTranscript.length || SENTIMENTS.includes(sentiment) || Number.isFinite(durNum)
        || channel || language || agent_name || hasExtracted) {
      voiceCall = {};
      if (cleanTranscript.length) voiceCall.transcript = cleanTranscript;
      if (SENTIMENTS.includes(sentiment)) voiceCall.sentiment = sentiment;
      if (Number.isFinite(durNum) && durNum > 0) voiceCall.durationSeconds = durNum;
      if (channel && typeof channel === "string") voiceCall.channel = channel.trim();
      if (language && typeof language === "string") voiceCall.language = language.trim();
      if (agent_name && typeof agent_name === "string") voiceCall.agentName = agent_name.trim();
      if (hasExtracted) voiceCall.extractedData = extracted_data;
    }

    // Build the note + requirements.
    // For voice leads (Vistrow) the full transcript already lives in the
    // Transcript tab (lead.voiceCall.transcript), so the note instead carries
    // the useful *extracted* details (budget/location/timeline/…) and call
    // metadata (sentiment/duration/channel/agent/language) — not a copy of the
    // transcript. Non-voice Custom leads keep the plain message behaviour.
    let noteText;
    let reqText;
    if (voiceCall) {
      const vc = voiceCall;
      const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
      const durStr = Number.isFinite(vc.durationSeconds) && vc.durationSeconds > 0
        ? `${Math.floor(vc.durationSeconds / 60)}m ${Math.round(vc.durationSeconds % 60)}s`.replace(/^0m /, "")
        : null;
      const metaBits = [
        vc.sentiment ? `Sentiment: ${cap(vc.sentiment)}` : null,
        durStr ? `Duration: ${durStr}` : null,
        vc.language ? `Language: ${vc.language}` : null,
        vc.channel ? `Channel: ${vc.channel}` : null,
        vc.agentName ? `Agent: ${vc.agentName}` : null,
      ].filter(Boolean);

      const extractedEntries = vc.extractedData && typeof vc.extractedData === "object"
        ? Object.entries(vc.extractedData).filter(([, v]) => v !== "" && v != null)
        : [];
      const extractedLines = extractedEntries.map(([k, v]) =>
        `${k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${v}`);

      noteText = [
        `📞 ${sourceLabel} call summary`,
        metaBits.length ? metaBits.join(" · ") : null,
        extractedLines.length ? `\nCaptured details:\n${extractedLines.join("\n")}` : null,
        cleanTranscript.length ? `\nFull transcript is in the Transcript tab.` : null,
      ].filter(Boolean).join("\n");

      // Requirements = the concise extracted summary (what the caller wants).
      // Never fall back to the raw message/transcript here — it's already
      // fully available in the Transcript tab; dumping it into Requirements
      // just floods the Leads table with a wall of transcript text.
      reqText = extractedLines.length ? extractedLines.join(" · ") : "";
    } else {
      noteText = [
        msg ? `Message: ${msg}` : null,
        `Source: ${sourceLabel}`,
      ].filter(Boolean).join("\n") || "Lead received from custom source";
      reqText = msg;
    }

    const lead = await Lead.create({
      name: String(name).trim(),
      phone: cleanPhone,
      email: (email && String(email).trim()) || "",
      source: leadSource,
      status: "New",
      requirements: reqText,
      orgId,
      createdBy: assignee?._id || automation.createdBy || null,
      assignedTo: assignee?._id || null,
      assignedToName: assignee?.name || "",
      leadSourceLabel: sourceLabel,
      voiceCall, // undefined for non-voice payloads — Mongoose omits it

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
            ? `Lead received from custom source (${sourceLabel}) - auto-assigned to ${assignee.name}`
            : `Lead received from custom source (${sourceLabel}) - unassigned (auto-assignment disabled)`,
          performedBy: assignee?._id || null,
          performedByName: assignee?.name || "",
          meta: { automationId: automation._id?.toString(), sourceName: source_name || "" },
        },
      ],
    });

    automation.status = "connected";
    automation.lastSyncAt = new Date();
    await automation.save();

    // Push notification — targeted to assignee if assigned, broadcast otherwise
    if (assignee?._id) {
      sendPushToUser(assignee._id, {
        type: "lead_assigned",
        title: `New Lead: ${lead.name}`,
        body: [cleanPhone, sourceLabel].filter(Boolean).join(" · "),
        data: { url: "/leads" },
      }).catch(() => {});
    } else {
      sendPushToAll({
        type: "new_lead",
        title: "New Lead 📥",
        body: `${lead.name} came in from ${sourceLabel}`,
        data: { url: "/leads", leadName: lead.name, source: leadSource },
      }, orgId).catch(() => {});
    }

    logger.info(`[custom webhook] lead created: ${lead.name} | ${cleanPhone} | source: ${sourceLabel}`);
    res.status(201).json({ success: true, message: "Lead received", leadId: lead._id });
  } catch (err) {
    logger.error(`[custom webhook] error: ${err.message}`);
    res.status(500).json({ success: false, message: "Failed to process lead" });
  }
});

// ── Google Ads Lead Form Extension webhook ────────────────────────────────────
// POST /webhook/google
// This is Google's own native webhook integration for Lead Form ad extensions
// (Google Ads -> Tools & Settings -> Conversions -> Lead form extension ->
// Webhook integration). No OAuth — the admin pastes a Webhook URL + Key into
// Google's UI, and Google POSTs this shape on every form submission:
//   { google_key, is_test, lead_id, campaign_id, campaign_name, adgroup_id,
//     adgroup_name, creative_id, gcl_id, api_version,
//     user_column_data: [{ column_id, column_name, string_value }, ...] }
// Google expects a fast 200 response; a wrong Key is the one case we still
// reject with 401 since a correctly configured integration never sends one.
const googleLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120, // Lead Form ads can burst harder than a single WordPress site
  keyGenerator: (req) => req.body?.google_key || req.ip,
  message: { success: false, message: "Too many submissions, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/google", express.json(), googleLeadLimiter, async (req, res) => {
  try {
    const {
      google_key, is_test, lead_id, campaign_id, campaign_name,
      adgroup_id, adgroup_name, gcl_id, user_column_data,
    } = req.body || {};

    if (!google_key) return res.status(400).json({ success: false, message: "Missing google_key" });

    const automation = await Automation.findOne({ platform: "Google", verifyToken: google_key, isActive: true });
    if (!automation) return res.status(401).json({ success: false, message: "Invalid google_key" });

    const orgId = automation.orgId;

    const { fullName, phone, email, formResponses, requirements, customFields } =
      mapGoogleLeadFields(fromWebhookColumns(user_column_data));

    const isTestLead = is_test === true || is_test === "true";
    const name = isTestLead
      ? "Test Lead (Google)"
      : (fullName || "Google Lead");

    if (!isTestLead && (!phone || phone.length < 7)) {
      // A real submission with no usable phone isn't actionable as a lead —
      // still return 200 so Google doesn't retry/disable the integration.
      logger.warn(`[google webhook] lead ${lead_id || "unknown"} skipped: no usable phone_number in user_column_data`);
      return res.status(200).json({ success: true, message: "Lead received (no phone — not saved)" });
    }

    // Dedup: same phone for this org within the last 2 minutes = a double-fire.
    const cleanPhone = phone || "N/A (test)";
    if (phone) {
      const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
      const recent = await Lead.findOne({ orgId, phone: cleanPhone, createdAt: { $gte: twoMinsAgo } }).lean();
      if (recent) {
        logger.info(`[google webhook] duplicate skipped: ${name} | ${cleanPhone}`);
        return res.status(200).json({ success: true, message: "Duplicate lead ignored" });
      }
    }

    const org = await Organization.findById(orgId).select("autoAssign").lean();
    let assignee = null;
    if (!isTestLead && org?.autoAssign !== false) {
      try { assignee = await getNextAssignee(orgId); } catch { /* no active agents */ }
    }

    const sourceLabel = isTestLead
      ? `${automation.name || "Google Ads"} - Test`
      : (automation.name || automation.leadSourceLabel || "Google");

    const noteText = isTestLead
      ? `⚠️ Google Test Lead — sent via the "Send test lead" button in Google Ads. Real leads from your Lead Form ad will include name, phone, and any custom question answers.\n\nLead ID: ${lead_id || "unknown"}`
      : [
          `✅ Lead imported from Google Ads Lead Form.`,
          `Name: ${name || "-"}`,
          `Phone: ${cleanPhone}`,
          `Email: ${email || "-"}`,
          requirements ? `\nForm Answers:\n${customFields.map((e) => `${e.label || e.id}: ${e.value}`).join("\n")}` : "",
          `Lead ID: ${lead_id || "unknown"}`,
        ].filter(Boolean).join("\n");

    const lead = await Lead.create({
      name,
      phone: cleanPhone,
      email,
      source: "Google",
      status: "New",
      requirements: isTestLead ? "" : requirements,
      formResponses: isTestLead ? [] : formResponses,
      orgId,
      createdBy: assignee?._id || automation.createdBy || null,
      assignedTo: assignee?._id || null,
      assignedToName: assignee?.name || "",
      leadSourceLabel: sourceLabel,
      notes: [{ text: noteText, addedBy: assignee?._id || null, addedByName: assignee?.name || "" }],
      activities: [
        {
          type: "created",
          description: assignee
            ? `Lead received from Google Ads Lead Form - auto-assigned to ${assignee.name}`
            : "Lead received from Google Ads Lead Form - unassigned",
          performedBy: assignee?._id || null,
          performedByName: assignee?.name || "",
          meta: {
            automationId: automation._id?.toString(),
            campaignId: campaign_id ? String(campaign_id) : "",
            campaignName: campaign_name || "",
            adgroupId: adgroup_id ? String(adgroup_id) : "",
            adgroupName: adgroup_name || "",
            gclId: gcl_id || "",
          },
        },
      ],
    });

    automation.status = "connected";
    automation.lastSyncAt = new Date();
    await automation.save();

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
        body: `${lead.name} submitted a Google Ads lead form`,
        data: { url: "/leads", leadName: lead.name, source: "Google" },
      }, orgId).catch(() => {});
    }

    logger.info(`[google webhook] lead created: ${lead.name} | ${cleanPhone} | test: ${isTestLead}`);
    res.status(201).json({ success: true, message: "Lead received", leadId: lead._id });
  } catch (err) {
    logger.error(`[google webhook] error: ${err.message}`);
    // Still 200 — a malformed request from Google itself shouldn't cause
    // Google to retry/disable the whole integration over one bad payload.
    res.status(200).json({ success: false, message: "Failed to process lead" });
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
