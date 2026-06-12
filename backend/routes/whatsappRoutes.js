const express = require("express");
const axios   = require("axios");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const Organization  = require("../models/Organization");
const WaConversation = require("../models/WaConversation");
const WaMessage      = require("../models/WaMessage");
const Lead           = require("../models/Lead");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendMetaMessage(phoneNumberId, accessToken, to, body) {
  const res = await axios.post(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    { messaging_product: "whatsapp", to, type: "text", text: { body } },
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  );
  return res.data?.messages?.[0]?.id || null;
}

async function triggerBotReply(org, conversation, inboundText) {
  try {
    const recentMsgs = await WaMessage.find({ conversationId: conversation._id })
      .sort({ timestamp: -1 }).limit(12).lean();
    recentMsgs.reverse();

    let leadContext = "";
    if (conversation.leadId) {
      const lead = await Lead.findById(conversation.leadId).select("name status source budget preferredLocation").lean();
      if (lead) leadContext = `Lead name: ${lead.name}. Status: ${lead.status}. Source: ${lead.source || "N/A"}. Budget: ${lead.budget || "N/A"}. Location preference: ${lead.preferredLocation || "N/A"}.`;
    }

    const botName = org.whatsapp?.botName || "Artha Assistant";
    const customPrompt = org.whatsapp?.botSystemPrompt || "";
    const systemPrompt = customPrompt ||
      `You are ${botName}, a helpful real estate assistant for ${org.name}. Your job is to handle customer inquiries via WhatsApp, answer questions about properties, and help schedule viewings.\n\nRules:\n- Keep replies SHORT (2-3 sentences max — this is WhatsApp)\n- Be warm, professional, and helpful in the tone of Indian real estate\n- If the customer asks to speak to a human agent, reply normally then append exactly [HUMAN_TAKEOVER] at the very end\n- Never invent prices or availability — say "our team will confirm shortly"\n- Do not use markdown, bold, or bullet points\n${leadContext ? `\nContext about this customer: ${leadContext}` : ""}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...recentMsgs.map(m => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.body,
      })),
      { role: "user", content: inboundText },
    ];

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      { model: "gpt-4o-mini", messages, max_tokens: 200, temperature: 0.7 },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" } }
    );

    let reply = aiRes.data?.choices?.[0]?.message?.content?.trim() || "";
    const takeover = reply.includes("[HUMAN_TAKEOVER]");
    reply = reply.replace("[HUMAN_TAKEOVER]", "").trim();

    if (reply) {
      const waMsgId = await sendMetaMessage(
        org.whatsapp.phoneNumberId, org.whatsapp.accessToken,
        conversation.contactPhone, reply
      );
      await WaMessage.create({
        orgId: org._id,
        conversationId: conversation._id,
        waMsgId,
        direction: "outbound",
        sender: "bot",
        senderName: botName,
        body: reply,
        status: "sent",
        timestamp: new Date(),
      });
      await WaConversation.findByIdAndUpdate(conversation._id, {
        lastMessageAt: new Date(),
        lastMessagePreview: reply.slice(0, 80),
      });
    }

    if (takeover) {
      await WaConversation.findByIdAndUpdate(conversation._id, {
        botEnabled: false,
        status: "open",
      });
    }
  } catch (err) {
    console.error("[WhatsApp Bot] reply error:", err?.response?.data || err.message);
  }
}

// ── Public: Meta Webhook Verification (GET) ───────────────────────────────────
router.get("/webhook", async (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe") return res.sendStatus(403);

  // Find the org whose verifyToken matches
  const org = await Organization.findOne({ "whatsapp.verifyToken": token }).lean();
  if (!org) return res.sendStatus(403);

  res.status(200).send(challenge);
});

// ── Public: Meta Webhook Receiver (POST) ──────────────────────────────────────
router.post("/webhook", async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return;

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        const val = change.value;
        if (!val || change.field !== "messages") continue;

        const phoneNumberId = val.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const org = await Organization.findOne({ "whatsapp.phoneNumberId": phoneNumberId }).lean();
        if (!org || !org.whatsapp?.enabled) continue;

        // ── Status updates (delivered / read) ──
        for (const status of (val.statuses || [])) {
          await WaMessage.findOneAndUpdate(
            { waMsgId: status.id },
            { status: status.status }
          );
        }

        // ── Incoming messages ──
        for (const msg of (val.messages || [])) {
          const contactWaId = msg.from;
          const contactName = val.contacts?.find(c => c.wa_id === contactWaId)?.profile?.name || contactWaId;
          const msgText = msg.text?.body || msg.caption || `[${msg.type}]`;
          const timestamp = new Date(parseInt(msg.timestamp) * 1000);

          // Find or create conversation
          let conv = await WaConversation.findOne({ orgId: org._id, contactPhone: contactWaId });
          if (!conv) {
            // Try to match with a Lead by phone
            const cleaned = contactWaId.replace(/^91/, "");
            const lead = await Lead.findOne({
              orgId: org._id,
              phone: { $in: [contactWaId, `+${contactWaId}`, cleaned, `0${cleaned}`] },
            }).lean();

            conv = await WaConversation.create({
              orgId: org._id,
              leadId: lead?._id || null,
              contactPhone: contactWaId,
              contactName: lead?.name || contactName,
              waContactId: contactWaId,
              botEnabled: org.whatsapp?.botEnabled ?? true,
              status: org.whatsapp?.botEnabled ? "bot" : "open",
            });

            if (lead && !lead.whatsappConversationId) {
              await Lead.findByIdAndUpdate(lead._id, { whatsappConversationId: conv._id });
            }
          } else if (!conv.contactName && contactName) {
            conv.contactName = contactName;
          }

          // Dedup — skip if waMsgId already stored
          const exists = await WaMessage.findOne({ waMsgId: msg.id });
          if (exists) continue;

          await WaMessage.create({
            orgId: org._id,
            conversationId: conv._id,
            waMsgId: msg.id,
            direction: "inbound",
            sender: "customer",
            senderName: contactName,
            body: msgText,
            mediaType: msg.type === "text" ? "text" : msg.type,
            status: "delivered",
            timestamp,
          });

          await WaConversation.findByIdAndUpdate(conv._id, {
            lastMessageAt: timestamp,
            lastMessagePreview: msgText.slice(0, 80),
            contactName: conv.contactName || contactName,
            $inc: { unreadCount: 1 },
          });

          // Trigger bot if enabled
          if (conv.botEnabled) {
            await triggerBotReply(org, conv, msgText);
          }
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] error:", err.message);
  }
});

// ── All routes below require auth ─────────────────────────────────────────────
router.use(protect);

// ── Settings ─────────────────────────────────────────────────────────────────

router.get("/settings", authorize("admin", "manager", "super_admin"), async (req, res) => {
  const org = await Organization.findById(req.orgId).select("whatsapp name").lean();
  if (!org) return res.status(404).json({ message: "Org not found" });
  // Never return accessToken to frontend
  const { accessToken, ...safe } = org.whatsapp || {};
  res.json({ whatsapp: safe, connected: !!(org.whatsapp?.phoneNumberId && org.whatsapp?.enabled) });
});

router.patch("/settings", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const { phoneNumberId, accessToken, businessAccountId, verifyToken, botEnabled, botName, botSystemPrompt, enabled } = req.body;
    const update = {};
    if (phoneNumberId     !== undefined) update["whatsapp.phoneNumberId"]     = phoneNumberId;
    if (businessAccountId !== undefined) update["whatsapp.businessAccountId"] = businessAccountId;
    if (verifyToken       !== undefined) update["whatsapp.verifyToken"]       = verifyToken;
    if (botEnabled        !== undefined) update["whatsapp.botEnabled"]        = botEnabled;
    if (botName           !== undefined) update["whatsapp.botName"]           = botName;
    if (botSystemPrompt   !== undefined) update["whatsapp.botSystemPrompt"]   = botSystemPrompt;
    if (enabled           !== undefined) update["whatsapp.enabled"]           = enabled;
    // Only update token if provided (non-empty string)
    if (accessToken) update["whatsapp.accessToken"] = accessToken;

    const org = await Organization.findByIdAndUpdate(req.orgId, { $set: update }, { new: true }).select("whatsapp");
    const { accessToken: _t, ...safe } = org.whatsapp.toObject();
    res.json({ whatsapp: safe });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Test the connection by fetching the phone number info from Meta
router.post("/settings/test", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp").lean();
    if (!org?.whatsapp?.phoneNumberId || !org?.whatsapp?.accessToken) {
      return res.status(400).json({ message: "Phone Number ID and Access Token required" });
    }
    const { data } = await axios.get(
      `https://graph.facebook.com/v20.0/${org.whatsapp.phoneNumberId}`,
      { headers: { Authorization: `Bearer ${org.whatsapp.accessToken}` } }
    );
    // Mark webhook as verified
    await Organization.findByIdAndUpdate(req.orgId, { "whatsapp.enabled": true, "whatsapp.webhookVerified": true });
    res.json({ ok: true, displayPhone: data.display_phone_number, name: data.verified_name });
  } catch (err) {
    res.status(400).json({ message: "Connection failed. Check your credentials.", detail: err?.response?.data?.error?.message });
  }
});

// ── Conversations ─────────────────────────────────────────────────────────────

router.get("/conversations", async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = { orgId: req.orgId };
    if (status) filter.status = status;
    if (search) filter.contactName = { $regex: search, $options: "i" };

    const [conversations, total] = await Promise.all([
      WaConversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(+limit)
        .populate("leadId", "name status")
        .populate("assignedTo", "name avatar")
        .lean(),
      WaConversation.countDocuments(filter),
    ]);
    res.json({ conversations, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const conv = await WaConversation.findOne({ _id: req.params.id, orgId: req.orgId })
      .populate("leadId", "name status source phone")
      .populate("assignedTo", "name avatar")
      .lean();
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { page = 1, limit = 60 } = req.query;
    const conv = await WaConversation.findOne({ _id: req.params.id, orgId: req.orgId }).lean();
    if (!conv) return res.status(404).json({ message: "Not found" });

    const messages = await WaMessage.find({ conversationId: req.params.id })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(+limit)
      .lean();

    messages.reverse();

    // Reset unread count
    await WaConversation.findByIdAndUpdate(req.params.id, { unreadCount: 0 });

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/conversations/:id", async (req, res) => {
  try {
    const { botEnabled, status, assignedTo } = req.body;
    const update = {};
    if (botEnabled !== undefined) {
      update.botEnabled = botEnabled;
      update.status = botEnabled ? "bot" : "open";
    }
    if (status)     update.status = status;
    if (assignedTo) update.assignedTo = assignedTo;

    const conv = await WaConversation.findOneAndUpdate(
      { _id: req.params.id, orgId: req.orgId },
      update,
      { new: true }
    ).populate("leadId", "name status").populate("assignedTo", "name avatar");

    if (!conv) return res.status(404).json({ message: "Not found" });
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Send Message ─────────────────────────────────────────────────────────────

router.post("/send", async (req, res) => {
  try {
    const { conversationId, body: msgBody } = req.body;
    if (!msgBody?.trim()) return res.status(400).json({ message: "Message body required" });

    const conv = await WaConversation.findOne({ _id: conversationId, orgId: req.orgId });
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    const org = await Organization.findById(req.orgId).select("whatsapp").lean();
    if (!org?.whatsapp?.enabled) return res.status(400).json({ message: "WhatsApp not connected" });

    const waMsgId = await sendMetaMessage(
      org.whatsapp.phoneNumberId, org.whatsapp.accessToken,
      conv.contactPhone, msgBody.trim()
    );

    const message = await WaMessage.create({
      orgId: req.orgId,
      conversationId: conv._id,
      waMsgId,
      direction: "outbound",
      sender: "agent",
      senderName: req.user.name,
      body: msgBody.trim(),
      status: "sent",
      timestamp: new Date(),
    });

    await WaConversation.findByIdAndUpdate(conv._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: msgBody.trim().slice(0, 80),
      status: "open",
    });

    res.json({ message });
  } catch (err) {
    const detail = err?.response?.data?.error?.message;
    res.status(500).json({ message: detail || err.message });
  }
});

// ── Unread count across all conversations ─────────────────────────────────────

router.get("/unread", async (req, res) => {
  try {
    const result = await WaConversation.aggregate([
      { $match: { orgId: req.user.orgId } },
      { $group: { _id: null, total: { $sum: "$unreadCount" } } },
    ]);
    res.json({ unread: result[0]?.total || 0 });
  } catch (err) {
    res.json({ unread: 0 });
  }
});

module.exports = router;
