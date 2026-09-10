const express = require("express");
const axios   = require("axios");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const Organization   = require("../models/Organization");
const WaConversation = require("../models/WaConversation");
const WaMessage      = require("../models/WaMessage");
const Lead           = require("../models/Lead");
const credits        = require("../services/creditService");

// ── Provider: send message ────────────────────────────────────────────────────

/**
 * Send a WhatsApp message.
 *
 * `template` turns this into a business-initiated send:
 *   { name, language, components }  per Meta's template message schema.
 *
 * Without it every send is free-form, which Meta only accepts inside an open
 * 24-hour customer service window. That is why first contact and any
 * re-engagement has to be a template — and why campaigns were impossible
 * until this branch existed.
 */
async function sendProviderMessage(org, to, body, template = null) {
  const { provider = "aisensy", apiKey, accountEndpoint, phoneNumberId } = org.whatsapp || {};

  switch (provider) {
    case "aisensy": {
      const r = await axios.post(
        "https://backend.aisensy.com/direct-apis/t1/messages",
        { apiKey, campaignName: "direct_reply", destination: to, userName: org.name,
          source: "Arthaleads CRM", message: body, templateParams: [] },
        { headers: { "Content-Type": "application/json" } }
      );
      return r.data?.msgId || null;
    }
    case "wati": {
      const base = (accountEndpoint || "https://live-mt-server.wati.io").replace(/\/$/, "");
      const r = await axios.post(
        `${base}/api/v1/sendSessionMessage/${to}`,
        { messageText: body },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return r.data?.result?.id || r.data?.id || null;
    }
    case "interakt": {
      const r = await axios.post(
        "https://api.interakt.ai/v1/public/message/",
        { fullPhoneNumber: to, callbackData: "crm_reply", type: "Text", data: { message: body } },
        { headers: { Authorization: `Basic ${apiKey}`, "Content-Type": "application/json" } }
      );
      return r.data?.messageId || null;
    }
    case "meta": {
      const payload = template
        ? {
            messaging_product: "whatsapp", recipient_type: "individual", to,
            type: "template",
            template: {
              name: template.name,
              language: { code: template.language || "en_US" },
              ...(template.components?.length ? { components: template.components } : {}),
            },
          }
        : {
            messaging_product: "whatsapp", recipient_type: "individual", to,
            type: "text", text: { preview_url: false, body },
          };
      const r = await axios.post(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
      );
      return r.data?.messages?.[0]?.id || null;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Provider: parse inbound webhook payload ───────────────────────────────────

function parseWebhookPayload(provider, payload, headers) {
  switch (provider) {
    case "aisensy": {
      const phone = payload.phone || payload.waId;
      if (!phone) return null;
      return {
        phone, name: payload.name || phone,
        msgId: payload.msgId || payload.id,
        msgText: payload.message || "",
        msgType: payload.type || "text",
      };
    }
    case "wati": {
      const phone = payload.waId;
      if (!phone || payload.eventType !== "RECEIVED") return null;
      return {
        phone, name: payload.senderName || phone,
        msgId: payload.id,
        msgText: payload.text || "",
        msgType: payload.type || "text",
      };
    }
    case "interakt": {
      const customer = payload.data?.customer || {};
      const msg      = payload.data?.message  || {};
      const phone    = customer.phone_number || customer.id;
      if (!phone) return null;
      const msgText  = msg.text?.body || msg.button?.text
        || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
      return {
        phone, name: customer.name || phone,
        msgId: msg.id,
        msgText,
        msgType: msg.type || "text",
      };
    }
    case "meta": {
      const value   = payload.entry?.[0]?.changes?.[0]?.value;
      const msg     = value?.messages?.[0];
      const contact = value?.contacts?.[0];
      if (!msg || !["text", "button", "interactive"].includes(msg.type)) return null;
      const msgText = msg.text?.body || msg.button?.text
        || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
      return {
        phone: msg.from,
        name: contact?.profile?.name || msg.from,
        msgId: msg.id,
        msgText,
        msgType: msg.type || "text",
      };
    }
    default:
      return null;
  }
}

// ── Provider: parse inbound webhook status updates (delivered/read ticks) ─────
// Meta batches a message's lifecycle as separate "statuses" webhook calls —
// sent, then delivered, then read — keyed by the same message id we stored
// as waMsgId when we sent it. Only "meta" carries this; the other providers
// have no equivalent event, so status here just stays whatever sendProviderMessage
// set at send time.

const STATUS_RANK = { sent: 1, delivered: 2, read: 3, failed: 4 };

// Walks every entry/change instead of assuming entry[0].changes[0] — Meta can
// batch more than one into a single call, and a narrower read would silently
// drop whatever wasn't first.
function parseStatusUpdates(provider, payload) {
  if (provider !== "meta") return [];
  const updates = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const statuses = change.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const s of statuses) {
        if (s.id && STATUS_RANK[s.status]) {
          // pricing is what we bill against — it carries Meta's own verdict on
          // category and whether the message was billable at all. Passing it
          // through here is what lets applyStatusUpdates settle the hold.
          updates.push({ msgId: s.id, status: s.status, pricing: s.pricing || null });
        }
      }
    }
  }
  return updates;
}

async function applyStatusUpdates(org, updates) {
  for (const { msgId, status, pricing } of updates) {
    const existing = await WaMessage.findOne({ orgId: org._id, waMsgId: msgId })
      .select("status reservedPaise creditCategory freeTierApplied creditSettled conversationId").lean();
    if (!existing) continue; // status event for a message we don't have (or dup) — nothing to update

    // ── Settle the credit hold ────────────────────────────────────────────
    // Meta only reveals the real price here, after the send. Settle once, on
    // whichever status first carries a pricing object (normally "sent"), and
    // on "failed" hand the hold back — a message that never went out must not
    // cost the tenant anything.
    if (!existing.creditSettled) {
      try {
        if (status === "failed") {
          await credits.release(org._id, existing.reservedPaise || 0);
          await WaMessage.updateOne({ _id: existing._id }, { $set: { creditSettled: true } });
        } else if (pricing) {
          await credits.settle(org._id, {
            reservedPaise: existing.reservedPaise || 0,
            category: existing.creditCategory || "service",
            waMsgId: msgId,
            conversationId: existing.conversationId,
            metaPricing: pricing,
            freeTierApplied: existing.freeTierApplied,
          });
          await WaMessage.updateOne({ _id: existing._id }, { $set: { creditSettled: true } });
        }
      } catch (err) {
        // Never let a billing problem drop the status update itself — the tick
        // in the UI is independent of whether we managed to bill for it.
        console.error("[WhatsApp Credits] settle failed for", msgId, err.message);
      }
    }

    // Never let a late/out-of-order webhook (e.g. "sent" arriving after "read") move status backwards.
    if (STATUS_RANK[status] <= (STATUS_RANK[existing.status] || 0)) continue;
    await WaMessage.updateOne({ _id: existing._id }, { $set: { status } });
  }
}

// ── Shared inbound handler ────────────────────────────────────────────────────

async function handleInbound(org, parsed) {
  const { phone, name, msgId, msgText, msgType } = parsed;
  if (!phone || !msgText) return;

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

  if (msgId && await WaMessage.findOne({ waMsgId: msgId })) return; // dedup

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
      // The bot spends real money on every reply. Hold the credit before the
      // send, not after — an unfunded org must go quiet rather than run up a
      // bill on our Meta credit line.
      const q = await credits.quote(org._id, "service", 1);
      let held = 0;
      try {
        held = await credits.reserve(org._id, { category: "service", count: 1 });
      } catch (err) {
        if (err instanceof credits.InsufficientCreditsError) {
          console.warn(`[WhatsApp Bot] org ${org._id} out of credits — auto-reply suppressed`);
          return;
        }
        throw err;
      }

      let msgId;
      try {
        msgId = await sendProviderMessage(org, conversation.contactPhone, reply);
      } catch (err) {
        await credits.release(org._id, held);
        throw err;
      }

      await WaMessage.create({
        orgId: org._id, conversationId: conversation._id, waMsgId: msgId,
        direction: "outbound", sender: "bot", senderName: botName,
        body: reply, status: "sent", timestamp: new Date(),
        reservedPaise: held, creditCategory: "service",
        freeTierApplied: q.freeCount > 0,
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

// ── Per-org webhook: all providers ───────────────────────────────────────────
// Webhook URL to configure in your provider dashboard:
//   https://yourapp.com/api/whatsapp/webhook/<orgId>

// Meta Cloud API: GET for webhook verification challenge
router.get("/webhook/:orgId", async (req, res) => {
  try {
    const org = await Organization.findById(req.params.orgId).select("whatsapp").lean();
    if (!org) return res.sendStatus(404);
    const mode      = req.query["hub.mode"];
    const token     = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === org.whatsapp?.webhookVerifyToken) {
      return res.send(challenge);
    }
    res.sendStatus(403);
  } catch { res.sendStatus(500); }
});

router.post("/webhook/:orgId", async (req, res) => {
  res.sendStatus(200);
  try {
    const org = await Organization.findById(req.params.orgId).lean();
    if (!org || !org.whatsapp?.enabled) return;
    const provider = org.whatsapp.provider || "aisensy";

    // Evidence, not a guess: logs exactly what Meta actually sent for this
    // call, so a missing "read" receipt can be told apart from "Meta never
    // sent it" vs. "Meta sent it and something here dropped it." Remove once
    // the read-receipt gap is confirmed one way or the other.
    if (provider === "meta") {
      try {
        const changes = (req.body?.entry || []).flatMap((e) => e.changes || []);
        console.log("[WhatsApp Webhook] statuses:",
          JSON.stringify(changes.flatMap((c) => c.value?.statuses || [])),
          "| messageIds:", JSON.stringify(changes.flatMap((c) => (c.value?.messages || []).map((m) => m.id))));
      } catch {}
    }

    const statusUpdates = parseStatusUpdates(provider, req.body);
    if (statusUpdates.length) await applyStatusUpdates(org, statusUpdates);

    const parsed = parseWebhookPayload(provider, req.body, req.headers);
    if (!parsed) return;
    await handleInbound(org, parsed);
  } catch (err) {
    console.error("[WhatsApp Webhook/:orgId] error:", err.message);
  }
});

// ── Legacy AiSensy webhook (backward compat) ──────────────────────────────────

router.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const payload  = req.body;
    const inApiKey = payload.apiKey || req.headers["x-aisensy-api-key"] || "";
    if (!inApiKey) return;
    const org = await Organization.findOne({ "whatsapp.apiKey": inApiKey }).lean();
    if (!org || !org.whatsapp?.enabled) return;
    const parsed = parseWebhookPayload("aisensy", payload, req.headers);
    if (!parsed) return;
    await handleInbound(org, parsed);
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
    orgId: req.orgId,
  });
});

router.patch("/settings", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const {
      apiKey, provider, accountEndpoint, phoneNumberId, wabaId, webhookVerifyToken,
      botEnabled, botName, botSystemPrompt, enabled,
    } = req.body;
    const update = {};
    if (provider            !== undefined) update["whatsapp.provider"]            = provider;
    if (accountEndpoint     !== undefined) update["whatsapp.accountEndpoint"]     = accountEndpoint;
    if (phoneNumberId       !== undefined) update["whatsapp.phoneNumberId"]       = phoneNumberId;
    if (wabaId              !== undefined) update["whatsapp.wabaId"]              = wabaId;
    if (webhookVerifyToken  !== undefined) update["whatsapp.webhookVerifyToken"]  = webhookVerifyToken;
    if (botEnabled          !== undefined) update["whatsapp.botEnabled"]          = botEnabled;
    if (botName             !== undefined) update["whatsapp.botName"]             = botName;
    if (botSystemPrompt     !== undefined) update["whatsapp.botSystemPrompt"]     = botSystemPrompt;
    if (enabled             !== undefined) update["whatsapp.enabled"]             = enabled;
    if (apiKey)                            update["whatsapp.apiKey"]              = apiKey;

    const org = await Organization.findByIdAndUpdate(req.orgId, { $set: update }, { new: true }).select("whatsapp");
    const { apiKey: _k, ...safe } = org.whatsapp.toObject();
    res.json({ whatsapp: { ...safe, hasApiKey: !!_k } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/settings/test", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp name").lean();
    if (!org?.whatsapp?.apiKey) return res.status(400).json({ message: "API key required" });
    const testTo = req.body.testPhone;
    if (!testTo) return res.status(400).json({ message: "Provide testPhone" });

    await sendProviderMessage(
      { ...org, whatsapp: { ...org.whatsapp } },
      testTo,
      `Hi! This is a test message from ${org.name} CRM. Your WhatsApp is now connected successfully!`
    );
    await Organization.findByIdAndUpdate(req.orgId, { "whatsapp.enabled": true });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: "Test failed. Check your credentials.", detail: err?.response?.data?.message || err.message });
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
    // Hard cap: hold the credit before the send. A tenant can never spend past
    // what they have already paid for, because Meta bills us, not them.
    const q = await credits.quote(req.orgId, "service", 1);
    let held;
    try {
      held = await credits.reserve(req.orgId, { category: "service", count: 1 });
    } catch (err) {
      if (err instanceof credits.InsufficientCreditsError) {
        return res.status(402).json({
          message: "Out of WhatsApp credits. Top up to keep replying.",
          code: "INSUFFICIENT_CREDITS",
          needPaise: err.needPaise,
          availablePaise: err.availablePaise,
        });
      }
      throw err;
    }

    let msgId;
    try {
      msgId = await sendProviderMessage(org, conv.contactPhone, msgBody.trim());
    } catch (err) {
      await credits.release(req.orgId, held);
      throw err;
    }

    const message = await WaMessage.create({
      orgId: req.orgId, conversationId: conv._id, waMsgId: msgId || undefined,
      direction: "outbound", sender: "agent", senderName: req.user.name,
      body: msgBody.trim(), status: "sent", timestamp: new Date(),
      reservedPaise: held, creditCategory: "service",
      freeTierApplied: q.freeCount > 0,
    });
    await WaConversation.findByIdAndUpdate(conv._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: msgBody.trim().slice(0, 80),
      // Derive from the conversation's own botEnabled instead of hardcoding
      // "open" — this used to force every agent-sent message to "open" even
      // when the bot was still on (and kept auto-replying right after), so a
      // conversation showing "Bot ON" in the header could vanish from the
      // Bot tab and sit under Open instead. botEnabled is the source of
      // truth here; it's changed explicitly via the Bot ON/Manual toggle,
      // not implied by who sent the last message.
      status: conv.botEnabled ? "bot" : "open",
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
