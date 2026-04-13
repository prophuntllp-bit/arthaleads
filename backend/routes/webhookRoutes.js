const express = require("express");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Automation = require("../models/Automation");
const logger = require("../config/logger");
const { sendPushToAll } = require("../utils/push");

const router = express.Router();

async function getFacebookLeadFields(leadgenId, accessToken) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "field_data,created_time,ad_id,adgroup_id,form_id,page_id",
  });

  const response = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta lead fetch failed: ${text}`);
  }

  return response.json();
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
    const defaultOwner = await User.findOne({ role: "admin" }).select("_id name");

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const leadData = change.value || {};
        const automation = await findFacebookAutomationByPayload(leadData);

        if (!automation) {
          logger.warn(`Facebook webhook skipped lead ${leadData.leadgen_id || "unknown"}: no matching automation for page ${leadData.page_id || "unknown"}`);
          continue;
        }

        const accessToken = automation.accessToken || process.env.FB_PAGE_ACCESS_TOKEN;

        if (!accessToken) {
          logger.warn(`Facebook webhook skipped lead ${leadData.leadgen_id || "unknown"}: no access token configured`);
          continue;
        }

        const leadDetails = leadData.field_data ? leadData : await getFacebookLeadFields(leadData.leadgen_id, accessToken);
        const fieldMap = Object.fromEntries((leadDetails.field_data || []).map((item) => [item.name, item.values?.[0] || ""]));

        const name =
          fieldMap.full_name ||
          [fieldMap.first_name, fieldMap.last_name].filter(Boolean).join(" ").trim() ||
          "Facebook Lead";

        await Lead.create({
          name,
          phone: fieldMap.phone_number || fieldMap.phone || "N/A",
          email: fieldMap.email || "",
          source: "Facebook",
          status: "New",
          createdBy: defaultOwner?._id,
          assignedTo: defaultOwner?._id || null,
          assignedToName: defaultOwner?.name || "",
          leadSourceLabel: automation?.name || "Facebook Lead Ads",
          notes: [
            {
              text: `Imported from Meta Lead Ads. Lead ID: ${leadData.leadgen_id || "unknown"}`,
              addedBy: defaultOwner?._id,
              addedByName: defaultOwner?.name || "System",
            },
          ],
          activities: [
            {
              type: "created",
              description: "Lead received from Meta Lead Ads webhook",
              performedBy: defaultOwner?._id,
              performedByName: defaultOwner?.name || "System",
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

module.exports = router;
