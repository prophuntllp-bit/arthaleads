const express = require("express");
const axios   = require("axios");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const Organization   = require("../models/Organization");
const WaConversation = require("../models/WaConversation");
const WaMessage      = require("../models/WaMessage");
const Lead           = require("../models/Lead");

// ── AiSensy send helper ───────────────────────────────────────────────────────

async function sendAiSensyMessage(apiKey, orgName, to, body) {
  const res = await axios.post(
    "https://backend.aisensy.com/direct-apis/t1/messages",
    {
      apiKey,
      campaignName: "direct_reply",
      destination:  to,
      userName:     orgName,
      source:       "Arthaleads CRM",
      message:      body,
      templateParams: [],
    },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data?.msgId || null;
}

// ── AI bot reply ──────────────────────────────────────────────────────────────

async function triggerBotReply(org, conversation, inboundText) {
  try {
    const recentMsgs = await WaMessage.find({ conversationId: conversation._id })
      .sort({ timestamp: -1 }).limit(12).lean();
    recentMsgs.reverse();

    let leadContext = "";
    if (conversation.leadId) {
      const lead = await Lead.findById(conversation.leadId)
        .select("name status source budget preferredLocation").lean();
      if (lead) leadContext = `Customer name: ${lead.name}. Status: ${lead.status}. Source: ${lead.source || "N/A"}. Budget: ${lead.budget || "N/A"}. Preferred location: ${lead.preferredLocation || "N/A"}.`;
    }

    const botName      = org.whatsapp?.botName      || "Artha Assistant";
    const customPrompt = org.whatsapp?.botSystemPrompt || "";
    const systemPrompt = customPrompt ||
      `You are ${botName}, a friendly real estate assistant for ${org.name} (India). Reply via WhatsApp.\n\nRules:\n- Keep replies SHORT — 1 to 3 sentences maximum\n- Be warm and professional\n- Never invent prices or availability — say our team will confirm shortly\n- Do not use markdown or bullet points\n- If the customer asks to speak to a human or agent, reply briefly then add [HUMAN_TAKEOVER] at the very end\n${leadContext ? `\nCustomer context: ${leadContext}` : ""}`;

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
      const msgId = await sendAiSensyMessage(org.whatsapp.apiKey, org.name, conversation.contactPhone, reply);
      await WaMessage.create({
        orgId: org._id, conversationId: conversation._id, waMsgId: msgId,
        direction: "outbound", sender: "bot", senderName: botName,
        body: reply, status: "sent", timestamp: new Date(),
      });
      await WaConversation.findByIdAndUpdate(conversation._id, {
        lastMessageAt: new Date(), lastMessagePreview: reply.slice(0, 80),
      });
    }

    if (takeover) {
      await WaConversation.findByIdAndUpdate(conversation._id, { botEnabled: false, status: "open" });
    }
  } catch (err) {
    console.error("[WhatsApp Bot] error:", err?.response?.data || err.message);
  }
}

// ── Public: AiSensy Webhook receiver ─────────────────────────────────────────
// Configure this URL in your AiSensy dashboard → API → Webhook:
//   https://yourapp.com/api/whatsapp/webhook

router.post("/webhook", async (req, res) => {
  res.sendStatus(200); // always respond immediately

  try {
    const payload = req.body;

    // AiSensy webhook payload shape:
    // { waId, phone, name, message, type, msgId, timeStamp, source, apiKey }
    const phone    = payload.phone  || payload.waId;
    const name     = payload.name   || phone;
    const msgText  = payload.message || "";
    const msgId    = payload.msgId  || payload.id;
    const msgType  = payload.type   || "text";
    const inApiKey = payload.apiKey || req.headers["x-aisensy-api-key"] || "";

    if (!phone || !msgText) return;

    // Find the org by API key
    const org = await Organization.findOne({ "whatsapp.apiKey": inApiKey }).lean();
    if (!org || !org.whatsapp?.enabled) return;

    // Find or create conversation
    let conv = await WaConversation.findOne({ orgId: org._id, contactPhone: phone });
    if (!conv) {
      const cleaned = phone.replace(/^91/, "");
      const lead = await Lead.findOne({
        orgId: org._id,
        phone: { $in: [phone, `+${phone}`, cleaned, `0${cleaned}`] },
      }).lean();

      conv = await WaConversation.create({
        orgId: org._id, leadId: lead?._id || null,
        contactPhone: phone, contactName: lead?.name || name,
        waContactId: phone,
        botEnabled: org.whatsapp?.botEnabled ?? true,
        status: org.whatsapp?.botEnabled ? "bot" : "open",
      });

      if (lead?._id) {
        await Lead.findByIdAndUpdate(lead._id, { whatsappConversationId: conv._id });
      }
    }

    // Dedup
    if (msgId && await WaMessage.findOne({ waMsgId: msgId })) return;

    await WaMessage.create({
      orgId: org._id, conversationId: conv._id, waMsgId: msgId || undefined,
      direction: "inbound", sender: "customer", senderName: name,
      body: msgText, mediaType: msgType === "text" ? "text" : msgType,
      status: "delivered", timestamp: new Date(),
    });

    await WaConversation.findByIdAndUpdate(conv._id, {
      lastMessageAt: new Date(), lastMessagePreview: msgText.slice(0, 80),
      contactName: conv.contactName || name,
      $inc: { unreadCount: 1 },
    });

    if (conv.botEnabled) {
      await triggerBotReply(org, conv, msgText);
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] error:", err.message);
  }
});

// ── All routes below require authentication ───────────────────────────────────
router.use(protect);

// ── Settings ──────────────────────────────────────────────────────────────────

router.get("/settings", authorize("admin", "manager", "super_admin"), async (req, res) => {
  const org = await Organization.findById(req.orgId).select("whatsapp name").lean();
  if (!org) return res.status(404).json({ message: "Org not found" });
  const { apiKey, ...safe } = org.whatsapp || {};
  res.json({
    whatsapp: { ...safe, hasApiKey: !!apiKey },
    connected: !!(apiKey && org.whatsapp?.enabled),
  });
});

router.patch("/settings", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const { apiKey, botEnabled, botName, botSystemPrompt, enabled } = req.body;
    const update = {};
    if (botEnabled        !== undefined) update["whatsapp.botEnabled"]        = botEnabled;
    if (botName           !== undefined) update["whatsapp.botName"]           = botName;
    if (botSystemPrompt   !== undefined) update["whatsapp.botSystemPrompt"]   = botSystemPrompt;
    if (enabled           !== undefined) update["whatsapp.enabled"]           = enabled;
    if (apiKey)                          update["whatsapp.apiKey"]            = apiKey;

    const org = await Organization.findByIdAndUpdate(req.orgId, { $set: update }, { new: true }).select("whatsapp");
    const { apiKey: _k, ...safe } = org.whatsapp.toObject();
    res.json({ whatsapp: { ...safe, hasApiKey: !!_k } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify the API key works by sending a test message to a provided number
router.post("/settings/test", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp name").lean();
    if (!org?.whatsapp?.apiKey) return res.status(400).json({ message: "API key required" });

    const testTo = req.body.testPhone;
    if (!testTo) return res.status(400).json({ message: "Provide a testPhone number to send a test message to" });

    await sendAiSensyMessage(
      org.whatsapp.apiKey, org.name, testTo,
      `Hi! This is a test message from ${org.name} CRM. Your WhatsApp is now connected successfully! 🎉`
    );
    await Organization.findByIdAndUpdate(req.orgId, { "whatsapp.enabled": true });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: "Test failed. Check your API key.", detail: err?.response?.data?.message || err.message });
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
        .skip((page - 1) * limit).limit(+limit)
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
      .populate("assignedTo", "name avatar").lean();
    if (!conv) return res.status(404).json({ message: "Not found" });
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
      .sort({ timestamp: -1 }).skip((page - 1) * limit).limit(+limit).lean();
    messages.reverse();

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
    if (botEnabled !== undefined) { update.botEnabled = botEnabled; update.status = botEnabled ? "bot" : "open"; }
    if (status)     update.status     = status;
    if (assignedTo) update.assignedTo = assignedTo;

    const conv = await WaConversation.findOneAndUpdate(
      { _id: req.params.id, orgId: req.orgId }, update, { new: true }
    ).populate("leadId", "name status").populate("assignedTo", "name avatar");
    if (!conv) return res.status(404).json({ message: "Not found" });
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Send message ──────────────────────────────────────────────────────────────

router.post("/send", async (req, res) => {
  try {
    const { conversationId, body: msgBody } = req.body;
    if (!msgBody?.trim()) return res.status(400).json({ message: "Message body required" });

    const conv = await WaConversation.findOne({ _id: conversationId, orgId: req.orgId });
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    const org = await Organization.findById(req.orgId).select("whatsapp name").lean();
    if (!org?.whatsapp?.enabled || !org?.whatsapp?.apiKey) {
      return res.status(400).json({ message: "WhatsApp not connected" });
    }

    const msgId = await sendAiSensyMessage(org.whatsapp.apiKey, org.name, conv.contactPhone, msgBody.trim());

    const message = await WaMessage.create({
      orgId: req.orgId, conversationId: conv._id, waMsgId: msgId || undefined,
      direction: "outbound", sender: "agent", senderName: req.user.name,
      body: msgBody.trim(), status: "sent", timestamp: new Date(),
    });

    await WaConversation.findByIdAndUpdate(conv._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: msgBody.trim().slice(0, 80),
      status: "open",
    });

    res.json({ message });
  } catch (err) {
    res.status(500).json({ message: err?.response?.data?.message || err.message });
  }
});

// ── Unread count ──────────────────────────────────────────────────────────────

router.get("/unread", async (req, res) => {
  try {
    const result = await WaConversation.aggregate([
      { $match: { orgId: req.user.orgId } },
      { $group: { _id: null, total: { $sum: "$unreadCount" } } },
    ]);
    res.json({ unread: result[0]?.total || 0 });
  } catch {
    res.json({ unread: 0 });
  }
});

module.exports = router;
