const express = require("express");
const axios   = require("axios");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const Organization   = require("../models/Organization");
const WaConversation = require("../models/WaConversation");
const WaMessage      = require("../models/WaMessage");
const Lead           = require("../models/Lead");

// Same rule as the frontend's toWaNumber() in components/UI.jsx — kept in
// sync by hand since one is browser code and the other server code.
function toWaId(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
}
const credits        = require("../services/creditService");
const templates      = require("../services/whatsappTemplateService");
const campaignSvc    = require("../services/waCampaignService");
const WaCampaign     = require("../models/WaCampaign");
const Project        = require("../models/Project");
const AiUsage        = require("../models/AiUsage");
const { planGate }   = require("../middlewares/planGate");
const rateLimit      = require("express-rate-limit");
const { generateWhatsAppTemplate } = require("../utils/openai");
const { getNextAssignee } = require("../utils/assignLead");
const { sendPushToAll, sendPushToUser } = require("../utils/push");
const OPTS = require("../constants/leadOptions");

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

// ── Lead auto-capture from WhatsApp (source: "WhatsApp") ─────────────────────
// A brand-new contact who messages in with no matching existing lead becomes
// a real Lead right away — same as any other channel — rather than sitting
// only as a conversation thread. Auto-assigned the same way QR/webhook leads
// are. Never invents propertyType/purpose/bhk/budget: those start at the
// schema's neutral "N/A"/blank and are only ever filled in later by
// enrichExistingWhatsAppLead(), which applies the exact same
// never-overwrite-a-real-value discipline as mapVistrowExtractedFields.
async function autoCaptureWhatsAppLead(org, phone, name) {
  let assignee = null;
  if (org.autoAssign !== false) {
    try { assignee = await getNextAssignee(org._id); } catch { /* no active agents */ }
  }
  const lead = await Lead.create({
    name: name || phone,
    phone,
    source: "WhatsApp",
    status: "New",
    orgId: org._id,
    createdBy: assignee?._id || null,
    assignedTo: assignee?._id || null,
    assignedToName: assignee?.name || "",
    propertyType: "N/A",
    purpose: "N/A",
    bhk: "N/A",
    budget: { min: null, max: null, currency: "INR" },
    activities: [{
      type: "created",
      description: assignee
        ? `Lead started a WhatsApp conversation — auto-assigned to ${assignee.name}`
        : "Lead started a WhatsApp conversation — unassigned (auto-assignment disabled)",
      performedBy: assignee?._id || null,
      performedByName: assignee?.name || "",
      meta: {},
    }],
  });
  if (assignee?._id) {
    sendPushToUser(assignee._id, {
      type: "lead_assigned",
      title: `New Lead: ${lead.name}`,
      body: `${phone} · WhatsApp`,
      data: { url: "/leads" },
    }).catch(() => {});
  } else {
    sendPushToAll({
      type: "new_lead",
      title: "New Lead 📥",
      body: `${lead.name} messaged in on WhatsApp`,
      data: { url: "/leads", leadName: lead.name, source: "WhatsApp" },
    }, org._id).catch(() => {});
  }
  return lead;
}

// ── Shared inbound handler ────────────────────────────────────────────────────

async function handleInbound(org, parsed) {
  const { phone, name, msgId, msgText, msgType } = parsed;
  if (!phone || !msgText) return;

  let conv = await WaConversation.findOne({ orgId: org._id, contactPhone: phone });
  const isNewConversation = !conv;
  if (!conv) {
    const cleaned = phone.replace(/^91/, "");
    let lead = await Lead.findOne({
      orgId: org._id,
      phone: { $in: [phone, `+${phone}`, cleaned, `0${cleaned}`] },
    }).lean();
    if (!lead) {
      try {
        lead = await autoCaptureWhatsAppLead(org, phone, name);
      } catch (err) {
        console.error("[WhatsApp Lead Capture] auto-create failed:", err.message);
      }
    }
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
    if (isNewConversation && org.whatsapp?.botGreeting?.trim()) {
      await sendBotGreeting(org, conv);
    }
    await triggerBotReply(org, conv, msgText);
  }
}

// Sent once, as the very first outbound message on a brand-new conversation —
// before the AI's contextual reply to whatever the customer actually wrote.
// Failure here must never block the real reply that follows.
async function sendBotGreeting(org, conversation) {
  try {
    const greeting = org.whatsapp.botGreeting.trim();
    const botName = org.whatsapp?.botName || "Artha Assistant";
    let held = 0;
    try {
      held = await credits.reserve(org._id, { category: "service", count: 1 });
    } catch (err) {
      if (err instanceof credits.InsufficientCreditsError) return;
      throw err;
    }
    let msgId;
    try {
      msgId = await sendProviderMessage(org, conversation.contactPhone, greeting);
    } catch (err) {
      await credits.release(org._id, held);
      throw err;
    }
    await WaMessage.create({
      orgId: org._id, conversationId: conversation._id, waMsgId: msgId,
      direction: "outbound", sender: "bot", senderName: botName,
      body: greeting, status: "sent", timestamp: new Date(),
      reservedPaise: held, creditCategory: "service",
    });
    await WaConversation.findByIdAndUpdate(conversation._id, {
      lastMessageAt: new Date(), lastMessagePreview: greeting.slice(0, 80),
    });
  } catch (err) {
    console.error("[WhatsApp Bot] greeting send failed:", err?.response?.data || err.message);
  }
}

// ── Agent Studio: project-grounded system prompt ─────────────────────────────
// Queries live Project documents on every single call — deliberately never a
// cached/frozen snapshot, so a price edit or a newly-archived project on the
// Projects page is reflected on the very next reply with nothing to re-sync.
// An org that already wrote a full custom prompt (the old free-text-only way
// of configuring the bot) keeps getting exactly that, untouched — Agent
// Studio only applies when botSystemPrompt is empty.
async function buildProjectGroundedPrompt(org, leadContext) {
  const wa = org.whatsapp || {};
  const botName = wa.botName || "Artha Assistant";

  if (wa.botSystemPrompt?.trim()) {
    return wa.botSystemPrompt.trim() + (leadContext ? `\n\nCustomer context: ${leadContext}` : "");
  }

  const projectFilter = { orgId: org._id, isArchived: { $ne: true } };
  if (Array.isArray(wa.botProjectIds) && wa.botProjectIds.length) {
    projectFilter._id = { $in: wa.botProjectIds };
  }
  const projects = await Project.find(projectFilter)
    .select("name description location priceMin priceMax bhkTypes area amenities possessionDate reraNumber")
    .sort({ createdAt: -1 }).limit(20).lean();

  const fmtPrice = (n) => (n ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : null);
  const projectLines = projects.map((p) => {
    const bits = [
      p.location && `Location: ${p.location}`,
      (p.priceMin || p.priceMax) && `Price: ${fmtPrice(p.priceMin) || "?"} - ${fmtPrice(p.priceMax) || "?"}`,
      p.bhkTypes?.length && `Configurations: ${p.bhkTypes.join(", ")}`,
      p.area && `Area: ${p.area}`,
      p.amenities?.length && `Amenities: ${p.amenities.slice(0, 8).join(", ")}`,
      p.possessionDate && `Possession: ${new Date(p.possessionDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`,
      p.reraNumber && `RERA: ${p.reraNumber}`,
      p.description && `Notes: ${p.description.slice(0, 200)}`,
    ].filter(Boolean).join(" | ");
    return `- ${p.name}${bits ? ` — ${bits}` : ""}`;
  });

  const knowledge = projectLines.length
    ? `Projects you can discuss (this is the ONLY inventory you know about — never mention or invent any other project):\n${projectLines.join("\n")}`
    : "No active projects are configured yet — if asked about specific properties, say the team will follow up with details shortly.";

  const rules    = wa.botGroundRules?.trim()     ? `\nAdditional rules from the team:\n${wa.botGroundRules.trim()}\n`   : "";
  const business = wa.botBusinessContext?.trim() ? `\nAbout us: ${wa.botBusinessContext.trim()}\n` : "";

  return `You are ${botName}, a friendly real estate assistant for ${org.name} (India). Reply via WhatsApp.
${business}
${knowledge}

Rules:
- Keep replies SHORT — 1 to 3 sentences maximum
- Be warm and professional
- Only mention prices, availability, or specs listed above — never invent or guess. If asked about something not listed, say our team will confirm shortly.
- Do not use markdown or bullet points
- If the customer asks to speak to a human or agent, reply briefly then add [HUMAN_TAKEOVER] at the very end
${rules}${leadContext ? `\nCustomer context: ${leadContext}` : ""}`;
}

// ── Lead enrichment from AI WhatsApp conversations ───────────────────────────
// Mirrors the "never fabricate" discipline mapVistrowExtractedFields already
// established for Vistrow Voice calls: only a value the model explicitly saw
// the CUSTOMER state, matched against a real enum, is ever written — and only
// onto a field that is still at its untouched "N/A"/blank default, so a value
// an agent already edited (or a fuller answer already captured) is never
// silently overwritten by a sparser later read.
function mapWhatsAppExtractedFields(extracted) {
  if (!extracted || typeof extracted !== "object") return {};
  const out = {};
  if (extracted.property_type) {
    const match = OPTS.PROPERTY_TYPE.find((o) => o.toLowerCase() === String(extracted.property_type).toLowerCase());
    if (match && match !== "N/A") out.propertyType = match;
  }
  if (extracted.purpose) {
    const match = OPTS.PURPOSE.find((o) => o.toLowerCase() === String(extracted.purpose).toLowerCase());
    if (match && match !== "N/A") out.purpose = match;
  }
  if (extracted.bhk) {
    const match = OPTS.BHK.find((o) => o.toLowerCase() === String(extracted.bhk).toLowerCase());
    if (match && match !== "N/A") out.bhk = match;
  }
  if (extracted.location && String(extracted.location).trim()) out.preferredLocation = String(extracted.location).trim();
  // Number(null) is 0, not NaN — the model can return an explicit null for a
  // key it didn't extract despite the "omit it" instruction, so an absent
  // value must never be fed straight into Number() (see the identical fix in
  // mapVistrowExtractedFields, webhookRoutes.js — same bug class).
  const min = extracted.budget_min != null ? Number(extracted.budget_min) : NaN;
  const max = extracted.budget_max != null ? Number(extracted.budget_max) : NaN;
  if (Number.isFinite(min) || Number.isFinite(max)) {
    out.budget = {
      min: Number.isFinite(min) ? min : (Number.isFinite(max) ? max : null),
      max: Number.isFinite(max) ? max : (Number.isFinite(min) ? min : null),
      currency: "INR",
    };
  }
  return out;
}

// Only ever called for a lead this bot itself auto-captured (source
// "WhatsApp"), and short-circuits once every field is already filled in — so
// a fully-enriched lead never triggers another billed extraction call.
async function enrichWhatsAppLead(conversation, recentMsgs) {
  if (!conversation.leadId) return;
  try {
    const lead = await Lead.findById(conversation.leadId)
      .select("source propertyType purpose bhk budget preferredLocation").lean();
    if (!lead || lead.source !== "WhatsApp") return;
    const alreadyComplete = lead.propertyType !== "N/A" && lead.purpose !== "N/A" && lead.bhk !== "N/A"
      && lead.preferredLocation && (lead.budget?.min || lead.budget?.max);
    if (alreadyComplete) return;

    const transcript = recentMsgs
      .map((m) => `${m.direction === "inbound" ? "Customer" : "Assistant"}: ${m.body}`)
      .join("\n").slice(0, 4000);
    if (!transcript.trim()) return;

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content:
            "Extract real-estate lead details the CUSTOMER explicitly stated in this WhatsApp chat. " +
            "Return ONLY compact JSON with keys you are confident about — omit any key not clearly and explicitly stated by the customer, never guess or infer: " +
            '{"property_type": one of Apartment/Villa/Plot/Commercial/Office/Penthouse/Other, ' +
            '"purpose": one of Buy/Rent/Invest, "bhk": one of 1BHK/2BHK/3BHK/4BHK/5BHK+/Studio, ' +
            '"budget_min": number, "budget_max": number, "location": string}. ' +
            "If nothing is clearly stated, return {}." },
          { role: "user", content: transcript },
        ],
        max_tokens: 150, temperature: 0,
        response_format: { type: "json_object" },
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" } }
    );
    const parsed = JSON.parse(aiRes.data?.choices?.[0]?.message?.content || "{}");
    const mapped = mapWhatsAppExtractedFields(parsed);

    // Only fill fields still at their neutral default — never overwrite a
    // real value, whichever earlier message or agent edit put it there.
    const setOps = {};
    if (mapped.propertyType && lead.propertyType === "N/A")     setOps.propertyType = mapped.propertyType;
    if (mapped.purpose && lead.purpose === "N/A")               setOps.purpose = mapped.purpose;
    if (mapped.bhk && lead.bhk === "N/A")                       setOps.bhk = mapped.bhk;
    if (mapped.preferredLocation && !lead.preferredLocation)    setOps.preferredLocation = mapped.preferredLocation;
    if (mapped.budget && !lead.budget?.min && !lead.budget?.max) setOps.budget = mapped.budget;

    if (Object.keys(setOps).length) {
      await Lead.updateOne({ _id: conversation.leadId }, { $set: setOps });
    }
  } catch (err) {
    console.error("[WhatsApp Lead Capture] enrichment failed:", err?.response?.data || err.message);
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

    const botName = org.whatsapp?.botName || "Artha Assistant";
    const systemPrompt = await buildProjectGroundedPrompt(org, leadContext);

    // Fire-and-forget: never let enrichment delay or fail the actual reply.
    enrichWhatsAppLead(conversation, recentMsgs).catch(() => {});

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

// Lightweight connection check any signed-in member can call. /settings is
// admin/manager-only and carries configuration, so using it to decide whether
// to show the inbox locked agents out completely: their 403 read as not
// connected, and they were handed a setup form they could not save either.
router.get("/status", async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId)
      .select("whatsapp.enabled whatsapp.provider whatsapp.apiKey whatsapp.displayPhoneNumber whatsapp.qualityRating whatsapp.wabaId")
      .lean();
    const wa = org?.whatsapp || {};
    res.json({
      connected: !!(wa.apiKey && wa.enabled),
      provider: wa.provider || null,
      displayPhoneNumber: wa.displayPhoneNumber || "",
      qualityRating: wa.qualityRating || "",
      hasWabaId: !!wa.wabaId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
      botProjectIds, botGroundRules, botBusinessContext, botGreeting,
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
    // Agent Studio — live-linked project knowledge base. Only IDs that are
    // actually this org's own projects are kept, so one tenant can never
    // point their bot's prompt at another tenant's project data by pasting
    // an ID that isn't theirs.
    if (botProjectIds !== undefined) {
      const ids = Array.isArray(botProjectIds) ? botProjectIds.filter(Boolean) : [];
      update["whatsapp.botProjectIds"] = ids.length
        ? (await Project.find({ _id: { $in: ids }, orgId: req.orgId }).select("_id").lean()).map((p) => p._id)
        : [];
    }
    if (botGroundRules      !== undefined) update["whatsapp.botGroundRules"]      = botGroundRules;
    if (botBusinessContext  !== undefined) update["whatsapp.botBusinessContext"]  = botBusinessContext;
    if (botGreeting         !== undefined) update["whatsapp.botGreeting"]         = botGreeting;

    const org = await Organization.findByIdAndUpdate(req.orgId, { $set: update }, { new: true }).select("whatsapp");
    const { apiKey: _k, ...safe } = org.whatsapp.toObject();
    res.json({ whatsapp: { ...safe, hasApiKey: !!_k } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Checks the saved credentials without sending anything.
//
// Worth having as its own endpoint because the three ways this breaks are
// indistinguishable from the outside: Meta answers an expired token, a WABA id
// that is really a phone number id, and a genuinely missing object all with
// HTTP 400. Probing each piece separately is the only way to say which it is.
router.get("/settings/diagnose", authorize("admin", "manager", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp").lean();
    const wa = org?.whatsapp || {};
    if ((wa.provider || "aisensy") !== "meta") {
      return res.json({ applicable: false, message: "Diagnostics only apply to the Meta Cloud API provider." });
    }
    if (!wa.apiKey) return res.json({ applicable: true, ok: false, token: { ok: false, message: "No access token saved." } });

    const G = "https://graph.facebook.com/v21.0";
    const probe = async (id, fields) => {
      if (!id) return { ok: false, missing: true, message: "Not saved." };
      try {
        const { data } = await axios.get(`${G}/${id}`, { params: { access_token: wa.apiKey, fields } });
        return { ok: true, data };
      } catch (err) {
        const e = err?.response?.data?.error || {};
        return { ok: false, code: e.code, subcode: e.error_subcode, message: e.error_user_msg || e.message || err.message };
      }
    };

    // `currency` exists on a WABA and not on a phone number; `display_phone_number`
    // the other way round. That asymmetry is what tells the two IDs apart when
    // someone has pasted one into the other's box.
    const [waba, phone] = await Promise.all([
      probe(wa.wabaId, "id,name,currency"),
      probe(wa.phoneNumberId, "id,display_phone_number,verified_name,quality_rating"),
    ]);

    const tokenDead = [waba, phone].some((r) => r.code === 190);
    const warnings = [];
    if (wa.wabaId && wa.wabaId === wa.phoneNumberId) {
      warnings.push("The Business Account ID and Phone Number ID are the same value. They are always two different IDs — check both in Meta's dashboard.");
    }
    if (!tokenDead && !waba.ok && !waba.missing && waba.code === 100) {
      warnings.push("That Business Account ID does not look like a WABA. It may be a phone number ID or a business portfolio ID.");
    }

    res.json({
      applicable: true,
      ok: !tokenDead && waba.ok && phone.ok && !warnings.length,
      token: tokenDead
        ? { ok: false, expired: true, message: "The access token has expired or been revoked. Generate a new permanent token in Meta and save it here." }
        : { ok: true },
      waba: tokenDead ? { ok: false, message: "Cannot check until the token is valid." }
        : waba.ok ? { ok: true, id: waba.data.id, name: waba.data.name || "", currency: waba.data.currency || "" }
        : { ok: false, message: waba.message },
      phone: tokenDead ? { ok: false, message: "Cannot check until the token is valid." }
        : phone.ok ? { ok: true, id: phone.data.id, displayPhoneNumber: phone.data.display_phone_number || "", verifiedName: phone.data.verified_name || "", qualityRating: phone.data.quality_rating || "" }
        : { ok: false, message: phone.message },
      warnings,
    });
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
    // A fresh Meta connection receives nothing until its app is subscribed to
    // the WABA. Do it now; never fail the connect itself over it.
    const webhook = await subscribeAndVerify(org.whatsapp || {})
      .catch((e) => ({ applicable: true, subscribed: false, error: e.message }));
    res.json({ ok: true, webhook });
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
        .populate("leadId", "name status priority propertyType bhk preferredLocation budget")
        .populate("assignedTo", "name avatar")
        .lean(),
      WaConversation.countDocuments(filter),
    ]);
    res.json({ conversations, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Opens a thread with a lead who has never written in — the button on the
// Leads page and lead detail that used to only offer a wa.me link. Creates
// nothing on WhatsApp itself: no message goes out here. The frontend then
// either sends a template (Meta, cold) or opens the composer (BSPs, which
// are not window-gated) — same as it already does for an existing thread.
router.post("/conversations/start", async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp").lean();
    if (!org?.whatsapp?.enabled || !org?.whatsapp?.apiKey) {
      return res.status(400).json({ message: "WhatsApp is not connected yet." });
    }
    const { leadId } = req.body || {};
    const lead = leadId ? await Lead.findOne({ _id: leadId, orgId: req.orgId }).lean() : null;
    if (leadId && !lead) return res.status(404).json({ message: "Lead not found" });
    const phone = toWaId(lead?.phone || req.body?.phone);
    if (!phone || phone.length < 10) return res.status(400).json({ message: "This lead has no usable phone number." });

    let conv = await WaConversation.findOne({ orgId: req.orgId, contactPhone: phone });
    if (!conv) {
      // Agent-initiated, not the bot's to answer — a customer replying to
      // an outreach an agent started should reach that agent, not the AI.
      conv = await WaConversation.create({
        orgId: req.orgId, leadId: lead?._id || null,
        contactPhone: phone, contactName: lead?.name || req.body?.name || "",
        waContactId: phone, botEnabled: false, status: "open",
        assignedTo: req.user._id, assignedToName: req.user.name,
      });
      if (lead?._id) await Lead.findByIdAndUpdate(lead._id, { whatsappConversationId: conv._id });
    }
    res.json({
      conversation: conv,
      consent: lead?.whatsappConsent?.status || "unknown",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const conv = await WaConversation.findOne({ _id: req.params.id, orgId: req.orgId })
      .populate("leadId", "name status source phone priority")
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
    const lastIn = await WaMessage.findOne({ conversationId: req.params.id, direction: "inbound" })
      .sort({ timestamp: -1 }).select("timestamp").lean();
    res.json({ messages, lastInboundAt: lastIn?.timestamp || null });
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
    ).populate("leadId", "name status priority propertyType bhk preferredLocation budget").populate("assignedTo", "name avatar");
    if (!conv) return res.status(404).json({ message: "Not found" });
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Webhook subscription ──────────────────────────────────────────────────────
// Meta only delivers a WABA's messages to apps SUBSCRIBED to that WABA, and the
// dashboard's webhook form does not do that step. On 9 Sep 2026 PropHunt's
// webhook verified perfectly and still received nothing until subscribed_apps
// was called by hand. This does it, then checks it actually took.
async function subscribeAndVerify(wa) {
  if ((wa.provider || "aisensy") !== "meta") return { applicable: false };
  if (!wa.wabaId || !wa.apiKey) {
    const e = new Error("Save your WhatsApp Business Account ID and access token first.");
    e.status = 400;
    throw e;
  }
  const G = "https://graph.facebook.com/v21.0";
  const auth = { params: { access_token: wa.apiKey } };
  try {
    await axios.post(G + "/" + wa.wabaId + "/subscribed_apps", null, auth);
    const [appRes, subRes] = await Promise.all([
      axios.get(G + "/app", { params: { access_token: wa.apiKey, fields: "id,name" } }).catch(() => ({ data: null })),
      axios.get(G + "/" + wa.wabaId + "/subscribed_apps", auth),
    ]);
    const apps = (subRes.data?.data || []).map((a) => a.whatsapp_business_api_data || a);
    const myId = appRes.data?.id;
    const mine = myId ? apps.find((a) => String(a.id) === String(myId)) : null;
    return {
      applicable: true,
      // If Meta will not say which app the token belongs to, the POST above
      // still subscribed it — any subscriber at all is then the best evidence.
      subscribed: myId ? !!mine : apps.length > 0,
      appName: appRes.data?.name || mine?.name || null,
    };
  } catch (err) {
    const me = err?.response?.data?.error;
    const e = new Error(me?.error_user_msg || me?.message || err.message);
    e.status = 400;
    throw e;
  }
}

// ── Message templates ─────────────────────────────────────────────────────────
// Templates live on the tenant's own WABA and Meta reviews each one, so these
// are thin proxies — we hold no local copy that could drift out of sync with
// what Meta actually has.

// Generation is a billed LLM call and the prompt is user-supplied, so this is
// capped per org rather than per IP — a whole sales team shares one office IP.
const templateGenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => String(req.orgId || req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "That's a lot of generating. Try again in an hour." },
});

// A message alone cannot be acted on. `reconnect` and `settingsFix` are what let
// the page offer the right button, instead of regexing English prose to guess
// whether the failure was the tenant's to fix.
const sendErr = (res, err) => res.status(err.status || 500).json({
  message: err.message,
  ...(err.metaCode    != null && { metaCode: err.metaCode }),
  ...(err.metaSubcode != null && { metaSubcode: err.metaSubcode }),
  ...(err.reconnect   && { reconnect: true }),
  ...(err.settingsFix && { settingsFix: true }),
});

router.get("/templates", async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp").lean();
    const list = await templates.listTemplates({ ...org, _id: req.orgId });
    res.json({ templates: list });
  } catch (err) {
    sendErr(res, err);
  }
});

router.post("/templates", authorize("admin", "manager", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp name").lean();
    const created = await templates.createTemplate({ ...org, _id: req.orgId }, req.body || {});
    res.status(201).json({ template: created });
  } catch (err) {
    sendErr(res, err);
  }
});

// Three drafts from a plain-English brief, grounded in the org's real projects.
//
// Nothing is submitted here — the variants come back as editable drafts. Any
// variant the model gets structurally wrong is dropped rather than shown,
// because a draft that cannot be submitted wastes more time than it saves.
router.post("/templates/generate",
  authorize("admin", "manager", "super_admin"),
  planGate("growth"),
  templateGenLimiter,
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ message: "AI generation is not configured. Ask your admin to set the OPENAI_API_KEY." });
      }
      const { prompt, category, tone, optimizeFor } = req.body || {};
      if (!String(prompt || "").trim()) return res.status(400).json({ message: "Describe what the message should say." });

      const [org, projects] = await Promise.all([
        Organization.findById(req.orgId).select("name").lean(),
        Project.find({ orgId: req.orgId, isArchived: { $ne: true } })
          .select("name location priceMin priceMax bhkTypes area possessionDate")
          .sort({ createdAt: -1 }).limit(12).lean(),
      ]);

      const { variants, _usage } = await generateWhatsAppTemplate({
        prompt, category, tone, optimizeFor,
        orgName: org?.name || "", projects,
      });

      const clean = variants.map(templates.normaliseGeneratedVariant).filter(Boolean);
      if (!clean.length) {
        return res.status(502).json({ message: "The generated templates came back malformed. Try rephrasing your brief." });
      }

      if (_usage) {
        const month = new Date().toISOString().slice(0, 7);
        AiUsage.updateOne(
          { orgId: req.orgId, month },
          { $inc: {
            calls: 1, promptTokens: _usage.prompt_tokens || 0,
            completionTokens: _usage.completion_tokens || 0, totalTokens: _usage.total_tokens || 0,
            templateGenCalls: 1, templateGenTokens: _usage.total_tokens || 0,
          } },
          { upsert: true }
        ).catch(() => {});
      }

      res.json({ variants: clean, projectsUsed: projects.length });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

router.delete("/templates/:name", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp").lean();
    await templates.deleteTemplate({ ...org, _id: req.orgId }, req.params.name);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

// ── Campaigns ─────────────────────────────────────────────────────────────────

router.get("/campaigns", async (req, res) => {
  try {
    const list = await WaCampaign.find({ orgId: req.orgId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ campaigns: list });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Everything needed to decide whether to press send: audience size, who was
// excluded and why, the cost, and anything blocking it. No side effects.
router.post("/campaigns/preview", authorize("admin", "manager", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).lean();
    const out = await campaignSvc.preview({ ...org, _id: req.orgId }, req.body || {});
    res.json(out);
  } catch (err) { sendErr(res, err); }
});

router.post("/campaigns", authorize("admin", "manager", "super_admin"), async (req, res) => {
  try {
    const { name, templateName, templateLanguage, templateCategory, variableMapping, audienceFilter } = req.body || {};
    if (!name?.trim())     return res.status(400).json({ message: "Give the campaign a name" });
    if (!templateName)     return res.status(400).json({ message: "Pick a template" });
    const c = await WaCampaign.create({
      orgId: req.orgId, createdBy: req.user._id, createdByName: req.user.name,
      name: name.trim(), templateName, templateLanguage, templateCategory,
      variableMapping: variableMapping || [], audienceFilter: audienceFilter || {},
    });
    res.status(201).json({ campaign: c });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/campaigns/:id/send", authorize("admin", "manager", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).lean();
    // Responds once the run finishes. Fine at the volumes a single number is
    // allowed to send; a tier above TIER_1K wants this on the scheduler.
    const c = await campaignSvc.run({ ...org, _id: req.orgId }, req.params.id, sendProviderMessage);
    res.json({ campaign: c });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

router.post("/settings/webhook-check", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("whatsapp").lean();
    res.json(await subscribeAndVerify(org?.whatsapp || {}));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// Lead counts per status and source, so the campaign audience pickers can say
// how many people each choice reaches before anyone commits to a filter.
router.get("/campaigns/audience-counts", authorize("admin", "manager", "super_admin"), async (req, res) => {
  try {
    // Same scope as the campaign audience itself, so the number beside an option
    // is the number that option would actually send to — dump leads included.
    const match = { orgId: req.orgId };
    const [byStatus, bySource, consented] = await Promise.all([
      Lead.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: match }, { $group: { _id: "$source", n: { $sum: 1 } } }]),
      Lead.countDocuments({ ...match, "whatsappConsent.status": "granted" }),
    ]);
    const toMap = (rows) => Object.fromEntries(rows.filter((r) => r._id).map((r) => [r._id, r.n]));
    res.json({ status: toMap(byStatus), source: toMap(bySource), consented });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send an approved template into one conversation. This is the only way to
// reach someone once WhatsApp's 24-hour reply window has closed.
router.post("/send-template", async (req, res) => {
  try {
    const { conversationId, templateName, values = [] } = req.body || {};
    if (!templateName) return res.status(400).json({ message: "Pick a template" });
    const conv = await WaConversation.findOne({ _id: conversationId, orgId: req.orgId });
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    const org = await Organization.findById(req.orgId).select("whatsapp name").lean();
    if (!org?.whatsapp?.enabled || !org?.whatsapp?.apiKey) {
      return res.status(400).json({ message: "WhatsApp not connected" });
    }

    // The price depends on the category, so it comes from Meta — never from
    // whatever the browser claims the template is.
    const approved = await templates.listApproved({ ...org, _id: req.orgId });
    const tpl = approved.find((t) => t.name === templateName);
    if (!tpl) return res.status(400).json({ message: "That template is not approved, or no longer exists." });

    const category = campaignSvc.categoryToCredit(tpl.category);
    const expected = templates.countBodyVariables(tpl);
    const vals = Array.from({ length: expected }, (_, i) => String(values[i] ?? "").trim());
    if (vals.some((v) => !v)) return res.status(400).json({ message: "Fill in every value in the template." });

    const bodyText = ((tpl.components || []).find((c) => c.type === "BODY") || {}).text || "";
    const rendered = bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => vals[Number(n) - 1] ?? "");

    let held;
    try {
      held = await credits.reserve(req.orgId, { category, count: 1 });
    } catch (err) {
      if (err instanceof credits.InsufficientCreditsError) {
        return res.status(402).json({ message: "Out of WhatsApp credits. Top up to send templates.", code: "INSUFFICIENT_CREDITS" });
      }
      throw err;
    }

    let msgId;
    try {
      msgId = await sendProviderMessage(org, conv.contactPhone, "", {
        name: tpl.name, language: tpl.language,
        components: templates.buildSendComponents(tpl, vals),
      });
    } catch (err) {
      await credits.release(req.orgId, held);
      const me = err?.response?.data?.error;
      return res.status(502).json({ message: me?.error_user_msg || me?.message || err.message });
    }

    const message = await WaMessage.create({
      orgId: req.orgId, conversationId: conv._id, waMsgId: msgId || undefined,
      direction: "outbound", sender: "agent", senderName: req.user.name,
      body: rendered, status: "sent", timestamp: new Date(),
      reservedPaise: held, creditCategory: category,
    });
    await WaConversation.findByIdAndUpdate(conv._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: rendered.slice(0, 80),
      status: conv.botEnabled ? "bot" : "open",
    });
    res.json({ message });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
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
    if ((org.whatsapp.provider || "aisensy") === "meta") {
      const lastIn = await WaMessage.findOne({ conversationId: conv._id, direction: "inbound" })
        .sort({ timestamp: -1 }).select("timestamp").lean();
      if (!lastIn || Date.now() - new Date(lastIn.timestamp).getTime() > 24 * 60 * 60 * 1000) {
        return res.status(409).json({
          code: "WINDOW_CLOSED",
          message: "It has been more than 24 hours since this person last wrote. WhatsApp only allows an approved template until they reply.",
        });
      }
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
