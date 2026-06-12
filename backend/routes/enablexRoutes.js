const express = require("express");
const axios   = require("axios");
const router  = express.Router();

const { protect, authorize } = require("../middlewares/auth");
const Organization = require("../models/Organization");
const Lead         = require("../models/Lead");
const { getClient: getOpenAI } = require("../utils/openai");

const ENABLEX_BASE = "https://api.enablex.io/voice/v1";

function basicAuth(org) {
  return { auth: { username: org.enablex.appId, password: org.enablex.apiKey } };
}

function normalizePhone(phone) {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

// ── Public webhook (EnableX posts here, no JWT) ──────────────────────────────
// Must be registered BEFORE the protect middleware below.
router.post("/webhook/:orgId", express.json(), async (req, res) => {
  res.sendStatus(200); // acknowledge immediately

  try {
    const { orgId } = req.params;
    const event     = req.body;
    const ownerRef  = event?.owner_ref || event?.data?.owner_ref;
    const eventType = event?.type      || event?.event_type || "";

    if (!ownerRef?.startsWith("lead_")) return;

    const leadId = ownerRef.split("_")[1];
    const lead   = await Lead.findOne({ _id: leadId, orgId });
    if (!lead) return;

    const actIdx = lead.activities.findIndex(a => a.meta?.ownerRef === ownerRef);
    if (actIdx < 0) return;

    // ── call.completed / ivr.call.hangup ────────────────────────────────────
    if (/hangup|completed|disconnected/i.test(eventType)) {
      const duration     = Number(event?.data?.duration ?? event?.duration ?? 0);
      const recordingUrl = event?.data?.recording_link ?? event?.recording_link ?? null;
      const callStatus   = duration > 5 ? "answered" : "missed";

      lead.activities[actIdx].description = callStatus === "missed"
        ? `Missed call to ${lead.name}`
        : `Call with ${lead.name} · ${Math.floor(duration / 60)}m ${duration % 60}s`;

      lead.activities[actIdx].meta = {
        ...lead.activities[actIdx].meta,
        status: callStatus,
        duration,
        recordingUrl: recordingUrl || null,
      };
      lead.markModified("activities");
      await lead.save();

      // Kick off async AI transcription (won't block webhook response)
      if (recordingUrl && duration > 10 && process.env.OPENAI_API_KEY) {
        transcribeAndSummarize(String(lead._id), actIdx, recordingUrl).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[enablex webhook]", err.message);
  }
});

// ── Authenticated routes ─────────────────────────────────────────────────────
router.use(protect);

// GET /api/calls/settings
router.get("/settings", authorize("admin", "manager", "super_admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.user.orgId).select("enablex").lean();
    const { apiKey, ...safe } = org?.enablex || {};
    res.json({
      enablex:   { ...safe, hasApiKey: !!apiKey },
      connected: !!(apiKey && org?.enablex?.enabled),
      orgId:     String(req.user.orgId),
    });
  } catch (err) { next(err); }
});

// PATCH /api/calls/settings
router.patch("/settings", authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const { appId, apiKey, virtualNumber, enabled } = req.body;
    const upd = {};
    if (appId         !== undefined) upd["enablex.appId"]         = String(appId).trim();
    if (apiKey        !== undefined && apiKey) upd["enablex.apiKey"] = String(apiKey).trim();
    if (virtualNumber !== undefined) upd["enablex.virtualNumber"] = String(virtualNumber).trim();
    if (enabled       !== undefined) upd["enablex.enabled"]       = Boolean(enabled);

    const org = await Organization.findByIdAndUpdate(
      req.user.orgId, { $set: upd }, { new: true }
    ).select("enablex");
    const { apiKey: _k, ...safe } = org.enablex.toObject();
    res.json({ enablex: { ...safe, hasApiKey: !!_k } });
  } catch (err) { next(err); }
});

// POST /api/calls/settings/test — verify credentials
router.post("/settings/test", authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.user.orgId).select("enablex").lean();
    if (!org?.enablex?.appId || !org?.enablex?.apiKey) {
      return res.status(400).json({ success: false, message: "Save your EnableX credentials first." });
    }
    // Verify credentials: GET a non-existent call ID — EnableX returns 404 for a
    // missing call ID (auth passed) vs 401/403 for wrong credentials.
    try {
      await axios.get(`${ENABLEX_BASE}/call/credential_check`, basicAuth(org));
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        const msg = err.response?.data?.message || "Invalid APP ID or APP KEY.";
        return res.status(400).json({ success: false, message: `Verification failed: ${msg}` });
      }
      // 404 = call not found but auth worked — credentials are valid
    }
    await Organization.findByIdAndUpdate(req.user.orgId, { $set: { "enablex.enabled": true } });
    res.json({ success: true, message: "EnableX credentials verified and enabled." });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ success: false, message: `Verification failed: ${msg}` });
  }
});

// POST /api/calls/initiate
// Body: { leadId, agentPhone? }   agentPhone = who to bridge-call first (optional)
router.post("/initiate", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const { leadId, agentPhone } = req.body;
    if (!leadId) return res.status(400).json({ success: false, message: "leadId is required." });

    const [org, lead] = await Promise.all([
      Organization.findById(req.user.orgId).select("enablex").lean(),
      Lead.findOne({ _id: leadId, orgId: req.user.orgId }),
    ]);

    if (!org?.enablex?.enabled || !org.enablex.appId || !org.enablex.apiKey) {
      return res.status(400).json({ success: false, message: "EnableX telephony is not configured for this organisation." });
    }
    if (!lead)        return res.status(404).json({ success: false, message: "Lead not found." });
    if (!lead.phone)  return res.status(400).json({ success: false, message: "This lead has no phone number." });

    const ownerRef   = `lead_${leadId}_${Date.now()}`;
    const webhookUrl = `${process.env.APP_URL || "https://arthaleads.com"}/api/calls/webhook/${req.user.orgId}`;
    const leadPhone  = normalizePhone(lead.phone);

    // Build recipient list: agent first (bridge), then lead
    const toList = [
      ...(agentPhone
        ? [{ name: req.user.name || "Agent", number: normalizePhone(agentPhone) }]
        : []),
      { name: lead.name || "Lead", number: leadPhone },
    ];

    const payload = {
      name:       `Arthaleads – ${lead.name}`,
      owner_ref:  ownerRef,
      from:       org.enablex.virtualNumber || undefined,
      to:         toList,
      record:     "record-audio",
      webhook:    webhookUrl,
    };

    const { data } = await axios.post(`${ENABLEX_BASE}/call`, payload, basicAuth(org));
    const voiceId  = data?.voice_id ?? data?.id ?? null;

    // Log call initiation in lead timeline immediately
    lead.activities.push({
      type:            "called",
      description:     `Call initiated to ${lead.name}${agentPhone ? " (bridge)" : ""}`,
      performedBy:     req.user._id,
      performedByName: req.user.name,
      meta: {
        voiceId, ownerRef,
        direction:  "outbound",
        status:     "initiated",
        phone:      lead.phone,
        agentPhone: agentPhone || null,
      },
    });
    await lead.save();

    res.json({ success: true, voiceId, message: "Call initiated — check your phone." });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(500).json({ success: false, message: `Call failed: ${msg}` });
  }
});

// ── AI transcription + summarization (runs async after webhook) ──────────────
async function transcribeAndSummarize(leadId, actIdx, recordingUrl) {
  const { Readable } = require("stream");

  const openai = getOpenAI();

  // Download recording as buffer
  const audioResp = await axios.get(recordingUrl, { responseType: "arraybuffer" });
  const buf       = Buffer.from(audioResp.data);

  // Create a readable stream with .name so OpenAI SDK identifies the format
  const stream = Readable.from(buf);
  stream.name  = "recording.mp3";

  const [transcription, lead] = await Promise.all([
    openai.audio.transcriptions.create({ file: stream, model: "whisper-1" }),
    Lead.findById(leadId),
  ]);

  if (!lead || !lead.activities[actIdx]) return;

  const transcript = transcription.text || "";

  // Quick sentiment heuristic before calling GPT (saves token cost)
  const lower    = transcript.toLowerCase();
  const pos      = ["interested", "visit", "book", "confirm", "yes", "sure", "like", "want"].some(w => lower.includes(w));
  const neg      = ["not interested", "busy", "later", "no thanks", "don't call"].some(w => lower.includes(w));
  const sentiment = pos && !neg ? "positive" : neg ? "negative" : "neutral";

  // Summarise with GPT-4o-mini (cheap, fast)
  const gpt = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Summarise this real estate sales call in 2 sentences: what the lead wants, their budget/timeline if mentioned, and the next recommended action.\n\nTranscript:\n${transcript.slice(0, 3000)}`,
    }],
    max_tokens: 120,
  });
  const summary = gpt.choices[0]?.message?.content?.trim() || null;

  lead.activities[actIdx].meta = {
    ...lead.activities[actIdx].meta,
    transcript,
    summary,
    sentiment,
  };
  lead.markModified("activities");
  await lead.save();
}

module.exports = router;
