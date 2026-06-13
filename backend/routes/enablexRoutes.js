const express = require("express");
const axios   = require("axios");
const router  = express.Router(); // v2 — bridge call, all authenticated users can initiate

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

// ── Public webhook (EnableX + recording server post here, no JWT) ─────────────
// Must be registered BEFORE the protect middleware below.
router.post("/webhook/:orgId", express.json(), async (req, res) => {
  res.sendStatus(200); // acknowledge immediately

  try {
    const { orgId } = req.params;
    const event     = req.body;
    // custom_data is echoed by EnableX from outbound call payload;
    // recording server sends it back when pushing the Cloudinary URL.
    const ownerRef  = event?.custom_data || event?.owner_ref || event?.data?.owner_ref;
    const eventType = event?.type || event?.event_type || event?.voice_event || "";

    if (!ownerRef?.startsWith("lead_")) return;

    const leadId = ownerRef.split("_")[1];
    const lead   = await Lead.findOne({ _id: leadId, orgId });
    if (!lead) return;

    const actIdx = lead.activities.findIndex(a => a.meta?.ownerRef === ownerRef);
    if (actIdx < 0) return;

    let dirty = false;

    // ── Recording push from our Cloudinary recording server ─────────────────
    // Payload: { custom_data, recording_url, duration?, transcript? }
    const recordingUrl = event?.recording_url
      ?? event?.data?.recording_url
      ?? event?.data?.recording_link
      ?? event?.recording_link
      ?? null;

    if (recordingUrl && !lead.activities[actIdx].meta?.recordingUrl) {
      lead.activities[actIdx].meta = {
        ...lead.activities[actIdx].meta,
        recordingUrl,
      };
      dirty = true;

      // Start AI transcription if transcript not already present
      if (!lead.activities[actIdx].meta?.transcript && process.env.OPENAI_API_KEY) {
        const dur = Number(event?.duration ?? lead.activities[actIdx].meta?.duration ?? 0);
        if (dur > 10) {
          transcribeAndSummarize(String(lead._id), actIdx, recordingUrl).catch(() => {});
        }
      }
    }

    // ── Call hangup / completion event (duration + status) ──────────────────
    if (/hangup|completed|disconnected/i.test(eventType)) {
      const dur        = Number(event?.data?.duration ?? event?.duration ?? 0);
      const callStatus = dur > 5 ? "answered" : "missed";

      lead.activities[actIdx].description = callStatus === "missed"
        ? `Missed call to ${lead.name}`
        : `Call with ${lead.name} · ${Math.floor(dur / 60)}m ${dur % 60}s`;

      lead.activities[actIdx].meta = {
        ...lead.activities[actIdx].meta,
        status: callStatus,
        duration: dur,
      };
      dirty = true;
    }

    if (dirty) {
      lead.markModified("activities");
      await lead.save();
    }
  } catch (err) {
    console.error("[enablex webhook]", err.message);
  }
});

// ── Authenticated routes ─────────────────────────────────────────────────────
router.use(protect);

// GET /api/calls — paginated list of all call activities across all leads
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 30, status } = req.query;
    const skip   = (Number(page) - 1) * Number(limit);
    const orgId  = req.user.orgId;

    const mongoose = require("mongoose");
    const matchActivity = { "activities.type": "called" };
    if (status && status !== "all") matchActivity["activities.meta.status"] = status;

    const [rows, total] = await Promise.all([
      Lead.aggregate([
        { $match: { orgId: new mongoose.Types.ObjectId(String(orgId)) } },
        { $unwind: "$activities" },
        { $match: { "activities.type": "called", ...(status && status !== "all" ? { "activities.meta.status": status } : {}) } },
        { $sort:  { "activities.createdAt": -1 } },
        { $skip:  skip },
        { $limit: Number(limit) },
        { $project: {
          _id:         0,
          leadId:      "$_id",
          leadName:    "$name",
          leadPhone:   "$phone",
          activityId:  "$activities._id",
          description: "$activities.description",
          performedBy: "$activities.performedByName",
          createdAt:   "$activities.createdAt",
          meta:        "$activities.meta",
        }},
      ]),
      Lead.aggregate([
        { $match: { orgId: new mongoose.Types.ObjectId(String(orgId)) } },
        { $unwind: "$activities" },
        { $match: { "activities.type": "called", ...(status && status !== "all" ? { "activities.meta.status": status } : {}) } },
        { $count: "total" },
      ]),
    ]);

    res.json({
      success: true,
      calls:   rows,
      total:   total[0]?.total || 0,
      page:    Number(page),
      pages:   Math.ceil((total[0]?.total || 0) / Number(limit)),
    });
  } catch (err) { next(err); }
});

// GET /api/calls/settings
router.get("/settings", authorize("admin", "manager", "super_admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.user.orgId).select("enablex").lean();
    const { apiKey, ...safe } = org?.enablex || {};
    res.json({
      enablex:   { ...safe, apiKey: apiKey || "", hasApiKey: !!apiKey },
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
    // EnableX has no lightweight ping endpoint — just verify credentials are
    // present and enable the integration. Real validation happens on first call.
    await Organization.findByIdAndUpdate(req.user.orgId, { $set: { "enablex.enabled": true } });
    res.json({ success: true, message: "EnableX credentials saved and enabled." });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ success: false, message: `Verification failed: ${msg}` });
  }
});

// POST /api/calls/initiate
router.post("/initiate", protect, async (req, res, next) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ success: false, message: "leadId is required." });

    const [org, lead] = await Promise.all([
      Organization.findById(req.user.orgId).select("enablex name").lean(),
      Lead.findOne({ _id: leadId, orgId: req.user.orgId }),
    ]);

    if (!org?.enablex?.enabled || !org.enablex.appId || !org.enablex.apiKey) {
      return res.status(400).json({ success: false, message: "EnableX telephony is not configured. Go to Settings → Organization → Telephony." });
    }
    if (!lead)       return res.status(404).json({ success: false, message: "Lead not found." });
    if (!lead.phone) return res.status(400).json({ success: false, message: "This lead has no phone number." });

    const agentPhone = req.user.phone ? normalizePhone(req.user.phone) : null;
    if (!agentPhone) {
      return res.status(400).json({ success: false, message: "Add your phone number in Settings → My Profile before making calls." });
    }

    const ownerRef   = `lead_${leadId}_${Date.now()}`;
    const webhookUrl = `${process.env.APP_URL || "https://arthaleads.com"}/api/calls/webhook/${req.user.orgId}`;
    const leadPhone  = normalizePhone(lead.phone);   // digits only, e.g. "917020950304"
    const confRoom   = `crm_${Date.now()}`;

    if (!org.enablex.virtualNumber) {
      return res.status(400).json({
        success: false,
        message: "No virtual number configured. In Settings → Telephony, enter the DID number you purchased from EnableX portal (portal.enablex.io → Phone Numbers) and linked to your Voice API app.",
      });
    }
    // EnableX requires "from" without the + prefix (their portal shows +91... but API uses digits only)
    const fromNumber = normalizePhone(org.enablex.virtualNumber); // e.g. "911169040027"
    console.info("[enablex /initiate] appId prefix:", String(org.enablex.appId).slice(0, 6), "from:", fromNumber);

    // Bridge call: ring agent's phone + lead's phone simultaneously — both join same conference room.
    // "from" must be a DID purchased from EnableX and linked to a Voice API service in their portal.
    const makePayload = (to) => ({
      from: fromNumber,
      to,
      action_on_connect: { conference: { name: confRoom } },
      custom_data: ownerRef,
      event_url:   webhookUrl,
    });

    let voiceId;
    try {
      const [agentResp, leadResp] = await Promise.all([
        axios.post(`${ENABLEX_BASE}/call`, makePayload(agentPhone), basicAuth(org)),
        axios.post(`${ENABLEX_BASE}/call`, makePayload(leadPhone),  basicAuth(org)),
      ]);
      voiceId = leadResp.data?.voice_id ?? leadResp.data?.id ?? null;
      console.info("[enablex /initiate] Bridge call OK — agent:", agentPhone, "lead:", leadPhone, "conf:", confRoom);
    } catch (enablexErr) {
      const status  = enablexErr.response?.status;
      const errBody = enablexErr.response?.data;
      const errCode = errBody?.event_code;
      console.error("[enablex /initiate] EnableX rejected:", status, JSON.stringify(errBody));
      console.error("[enablex /initiate] from:", fromNumber, "agent:", agentPhone, "lead:", leadPhone);
      if (errCode === "6133" || errBody?.event_name === "service_not_associated_with_number") {
        enablexErr.friendlyMessage =
          `The virtual number ${fromNumber} is not linked to a Voice API service in your EnableX account. ` +
          "Please log into portal.enablex.io → Phone Numbers → select the number → assign it to your Voice API app. " +
          "If you don't have an EnableX DID yet, you need to purchase one from their portal first.";
      }
      throw enablexErr;
    }

    lead.activities.push({
      type:            "called",
      description:     `Call initiated to ${lead.name}`,
      performedBy:     req.user._id,
      performedByName: req.user.name,
      meta: {
        voiceId, ownerRef,
        direction:   "outbound",
        status:      "initiated",
        phone:       lead.phone,
        agentPhone:  req.user.phone,
        confRoom,
      },
    });
    await lead.save();

    res.json({ success: true, voiceId, message: `Calling ${lead.name}… Your phone (${req.user.phone}) will ring shortly.` });
  } catch (err) {
    const msg = err.friendlyMessage
      || err.response?.data?.description
      || err.response?.data?.msg
      || err.response?.data?.message
      || err.message;
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
