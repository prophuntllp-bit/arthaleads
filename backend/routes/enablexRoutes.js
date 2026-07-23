const express   = require("express");
const axios     = require("axios");
const mongoose  = require("mongoose");
const router    = express.Router(); // v2 — bridge call, all authenticated users can initiate

const { protect, authorize } = require("../middlewares/auth");
const Organization = require("../models/Organization");
const Lead         = require("../models/Lead");
const ProjectLead  = require("../models/ProjectLead");
const User         = require("../models/User");
const Task         = require("../models/Task");
const { getClient: getOpenAI } = require("../utils/openai");
const { sendPushToUser, sendPushToAll } = require("../utils/push");
const {
  buildCallStreamUrl,
  diagnosticsEnabled,
  stopCallStream,
} = require("../services/callStreamRecorder");

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

// Recording is controlled by EnableX as its own explicit start/stop API, NOT by a
// "record" flag inline on the /call or /connect payload (that field is apparently
// silently ignored - every recording fetch has 404'd regardless of it being set).
// Logging the full response here so we can see the real recording/reference id
// EnableX returns, since their docs site blocks automated fetches and existing
// code guessed at a GET path that doesn't match their documented one
// (GET /voice/v1/recording/{service_id}/{recording_id}, not /recording/{voice_id}).
async function startRecording(org, voiceId, label) {
  try {
    const resp = await axios.put(`${ENABLEX_BASE}/call/${voiceId}/recording`, { start: true }, basicAuth(org));
    console.info(`[enablex recording] start requested (${label}) voice_id=${voiceId}:`, JSON.stringify(resp.data));
    return resp.data;
  } catch (e) {
    console.error(`[enablex recording] start FAILED (${label}) voice_id=${voiceId}:`, e.response?.status, JSON.stringify(e.response?.data));
    return null;
  }
}

// Regular Leads and Project leads (a separate model, see ProjectLead.js) share an
// identically-shaped `activities` array, so every call-history endpoint below
// needs to work against whichever one a given id actually belongs to. ObjectIds
// are globally unique, so trying Lead first and falling back to ProjectLead is
// safe - they'll never collide.
async function findLeadOrProjectLead(id, orgId, { lean = false } = {}) {
  let doc = await (lean ? Lead.findOne({ _id: id, orgId }).lean() : Lead.findOne({ _id: id, orgId }));
  if (doc) return { doc, Model: Lead };
  doc = await (lean ? ProjectLead.findOne({ _id: id, orgId }).lean() : ProjectLead.findOne({ _id: id, orgId }));
  if (doc) return { doc, Model: ProjectLead };
  return { doc: null, Model: null };
}

// ── Public: inbound call answer URL ──────────────────────────────────────────
// EnableX calls this (GET or POST) when someone dials the virtual number.
// We look up who last called that phone number and bridge the inbound call
// to that agent — so the lead always reaches the same person they spoke to.
// Configure in EnableX portal → Phone Numbers → your DID → Answer URL:
//   https://api.arthaleads.com/api/calls/inbound/<orgId>
router.all("/inbound/:orgId", express.json(), express.urlencoded({ extended: true }), async (req, res) => {
  const params    = { ...req.query, ...(req.body || {}) };
  const { orgId } = req.params;
  // EnableX sends caller as "from", some versions use "caller_number"
  const callerRaw = params.from || params.caller_number || params.call_from || "";
  const voiceId    = params.voice_id || params.voiceId || "";

  console.info("[enablex inbound] orgId:", orgId, "from:", callerRaw,
    "voiceId:", voiceId, "params:", JSON.stringify(params));

  // EnableX hits this same Answer URL again for later call-state callbacks
  // (e.g. "disconnected", "recording_complete") on the inbound leg itself, not
  // just the initial "incomingcall" ring - only the initial ring should trigger
  // routing + a connect action (re-running that for every later callback would
  // log a duplicate activity and send a pointless second connect on an already-
  // bridged or ended call). But those later callbacks still need to reach the
  // same processing /webhook/:orgId does for outbound calls - duration tracking
  // and recordings never worked for inbound calls before this, because they
  // were previously just acknowledged and dropped here.
  if (params.state && params.state !== "incomingcall") {
    console.info("[enablex inbound] forwarding state callback to shared handler:", params.state);
    res.json({});
    processCallStateEvent(orgId, params, "[enablex inbound]");
    return;
  }

  try {
    const org = await Organization.findById(orgId).select("enablex").lean();
    if (!org?.enablex?.enabled || !org.enablex.virtualNumber) {
      console.warn("[enablex inbound] org not found or EnableX not enabled");
      return res.json({ message: "Service not available." });
    }

    const fromNumber = normalizePhone(org.enablex.virtualNumber);
    const webhookUrl = `${process.env.APP_URL || "https://api.arthaleads.com"}/api/calls/webhook/${orgId}`;

    // Match lead by last 10 digits of their phone (DB stores numbers in various formats)
    const last10 = callerRaw.replace(/\D/g, "").slice(-10);
    let lead = null;
    if (last10.length >= 8) {
      lead = await Lead.findOne({
        orgId:     new mongoose.Types.ObjectId(orgId),
        phone:     { $regex: last10 + "$", $options: "i" },
        isDeleted: { $ne: true },
      }).select("name phone activities").lean();
    }

    let agentPhone   = null;
    let agentUserId  = null;
    let agentName    = null;

    if (lead) {
      // Route to the agent who most recently called this lead (outbound)
      const lastOutbound = [...lead.activities]
        .filter(a => a.type === "called" && a.meta?.direction === "outbound" && a.meta?.agentPhone)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      if (lastOutbound?.meta?.agentPhone) {
        agentPhone  = normalizePhone(lastOutbound.meta.agentPhone);
        agentUserId = lastOutbound.performedBy;
        agentName   = lastOutbound.performedByName;
      }
    }

    // Fallback: route to any admin/manager/agent in the org who has a phone number
    if (!agentPhone) {
      const fallback = await User.findOne({
        orgId,
        isActive: true,
        phone:    { $exists: true, $ne: "" },
        role:     { $in: ["admin", "manager", "agent"] },
      }).sort({ createdAt: 1 }).select("phone name _id").lean();

      if (fallback?.phone) {
        agentPhone  = normalizePhone(fallback.phone);
        agentUserId = fallback._id;
        agentName   = fallback.name;
      }
    }

    if (!agentPhone) {
      console.warn("[enablex inbound] no agent phone found for org", orgId);
      // Notify all org admins that a call came in but couldn't be routed
      sendPushToAll({
        title: "Missed Inbound Call",
        body:  `A call came in${lead ? ` from ${lead.name}` : ""} but no agent has a phone number configured to receive it.`,
        data:  { type: "missed_call", leadId: lead ? String(lead._id) : null },
      }, orgId).catch(() => {});
      return res.json({ message: "No available agent to route this call." });
    }

    const ownerRef = `lead_${lead?._id || "unknown"}_${Date.now()}`;

    console.info("[enablex inbound] routing", callerRaw, "→ agent", agentPhone,
      lead ? `(lead: ${lead.name})` : "(unknown caller)");

    // Ack the webhook immediately — EnableX has a tight timeout on the answer URL.
    // The actual call control happens via the REST API below, not via this body.
    res.json({});

    // Notify the agent in-app so they know their phone is about to ring. Awaited
    // (rather than fire-and-forget) and given a short head start before the
    // accept/connect calls below actually make the phone ring - push delivery
    // isn't instant, and without this gap the physical ring can beat the
    // notification to the lock screen, defeating the point of sending it.
    if (agentUserId) {
      await sendPushToUser(String(agentUserId), {
        title: "Incoming Call",
        body:  lead ? `${lead.name} is calling — pick up your phone` : `Inbound call — pick up your phone`,
        data:  { type: "inbound_call", leadId: lead ? String(lead._id) : null },
      }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    // EnableX inbound calls aren't auto-answered once a custom Event URL is
    // configured — the call just rings (and eventually drops) unless we
    // explicitly accept it, then bridge it to the agent via the connect API.
    // (Outbound calls use action_on_connect.connect in the /call POST instead —
    // that mechanism doesn't apply here since this call already exists.)
    if (!voiceId) {
      console.error("[enablex inbound] no voice_id in webhook payload — cannot accept/bridge. full params:", JSON.stringify(params));
    } else {
      // Step 1: Accept the inbound call (answers it so caller hears hold instead of ringing)
      try {
        const acceptResp = await axios.put(`${ENABLEX_BASE}/call/${voiceId}/accept`, {}, basicAuth(org));
        console.info("[enablex inbound] accept OK:", voiceId, JSON.stringify(acceptResp.data).slice(0, 200));
      } catch (acceptErr) {
        console.error("[enablex inbound] accept FAILED:", acceptErr.response?.status,
          JSON.stringify(acceptErr.response?.data));
        // Continue anyway — connect may still work
      }

      // Step 2: Bridge to the agent's phone.
      // from MUST be the provisioned virtual DID — EnableX rejects any number
      // not registered in the project (error 6118 "Phone number not found").
      try {
        const connectResp = await axios.put(`${ENABLEX_BASE}/call/${voiceId}/connect`, {
          from:        fromNumber,   // provisioned CLI (virtual DID) — do NOT use callerRaw here
          to:          agentPhone,
          custom_data: ownerRef,
          event_url:   webhookUrl,
          record:      true,         // outbound calls already record via /call - inbound bridges need it here too
        }, basicAuth(org));
        console.info("[enablex inbound] connect OK:", voiceId, "→ agent", agentPhone,
          JSON.stringify(connectResp.data).slice(0, 200));
        // Recording start is handled uniformly in processCallStateEvent's "connected"
        // branch once EnableX's own "connected" callback arrives (forwarded here from
        // below) - not fired directly here, to avoid starting it twice.
      } catch (connectErr) {
        console.error("[enablex inbound] connect FAILED:", connectErr.response?.status,
          JSON.stringify(connectErr.response?.data));
      }
    }

    // Log inbound call activity on the lead (async — after response)
    if (lead) {
      Lead.findById(lead._id).then(async (doc) => {
        if (!doc) return;
        doc.activities.push({
          type:            "called",
          description:     `Inbound call from ${doc.name}`,
          performedBy:     agentUserId || undefined,
          performedByName: agentName   || undefined,
          meta: {
            direction:      "inbound",
            status:         "initiated",
            ownerRef,
            phone:          callerRaw,
            agentPhone:     agentPhone,   // normalized agent phone (used for future inbound routing)
            routedToPhone:  agentPhone,   // actual phone we bridged to (not the virtual DID)
            routedToAgent:  agentName || "",
            voiceId,                     // required so the "disconnected" webhook can fetch this call's recording
          },
        });
        doc.markModified("activities");
        await doc.save();
      }).catch(e => console.error("[enablex inbound] activity log failed:", e.message));
    }
  } catch (err) {
    console.error("[enablex inbound] error:", err.message);
    // Still try to respond so EnableX doesn't hang
    if (!res.headersSent) res.json({ message: "Routing error." });
  }
});

// ── Shared call-state event processing ────────────────────────────────────────
// Used by BOTH /webhook/:orgId (outbound calls - EnableX calls this because we
// pass event_url on the /call API) AND /inbound/:orgId (inbound calls - EnableX
// sends every state callback here too, to whatever URL is configured as the
// number's Event URL, not just the initial ring). Previously /inbound/:orgId
// ignored everything except the first "incomingcall" ring, so inbound calls
// never got duration tracking or a recording - this is what actually processes
// "connected", "disconnected", "recording_complete" etc. for both directions.
async function processCallStateEvent(orgId, event, logPrefix) {
  try {
    // Log every webhook so we can see EnableX's exact event structure
    console.info(`${logPrefix} orgId:`, orgId, "body:", JSON.stringify(event).slice(0, 500));

    // custom_data is echoed by EnableX on outbound call events, but inbound-leg
    // callbacks (bridged/disconnected on the number's Event URL) come back with
    // no custom_data at all - fall back to matching by voice_id (stored in
    // meta.voiceId for both directions) when it's missing.
    let ownerRef = event?.custom_data || event?.owner_ref || event?.data?.owner_ref;
    const eventVoiceId = event?.voice_id || event?.voiceId || event?.data?.voice_id || event?.data?.voiceId;
    // EnableX sends: state="connected"|"disconnected" (not type/event_type/voice_event)
    const eventType = (event?.state || event?.type || event?.event_type || event?.voice_event || event?.name || "").toLowerCase();

    if (eventType === "stream_stopped") {
      if (eventVoiceId) {
        const finalized = await stopCallStream(eventVoiceId);
        console.info("[call-stream] stream_stopped finalized", eventVoiceId, finalized);
      }
      return;
    }

    // EnableX fires "recording_complete" and "disconnected" within the same
    // instant, both trying to save the same lead document - confirmed live via a
    // Mongoose VersionError ("No matching document found... version 5") when both
    // landed concurrently. "disconnected" already carries the same recording_url
    // inline (verified in the same event), so recording_complete is redundant -
    // skip it entirely rather than risk racing the duration/status save that only
    // "disconnected" performs. Same reasoning as the existing bridge_disconnected
    // skip below.
    if (eventType === "recording_complete") {
      console.info(`${logPrefix} skipping recording_complete (redundant with disconnected's inline recording_url)`);
      return;
    }

    // ownerRef's prefix tells us which model this call belongs to - "lead_" for
    // regular Leads, "projectlead_" for Project leads (a separate model with its
    // own _id namespace, see /initiate). Both have an identically-shaped
    // activities array, so the rest of this function treats `lead` generically.
    let lead, actIdx = -1;
    if (ownerRef?.startsWith("projectlead_")) {
      const id = ownerRef.split("_")[1];
      lead = await ProjectLead.findOne({ _id: id, orgId });
      if (lead) actIdx = lead.activities.findIndex(a => a.meta?.ownerRef === ownerRef);
    } else if (ownerRef?.startsWith("lead_")) {
      const id = ownerRef.split("_")[1];
      lead = await Lead.findOne({ _id: id, orgId });
      if (lead) actIdx = lead.activities.findIndex(a => a.meta?.ownerRef === ownerRef);
    }
    if ((!lead || actIdx < 0) && eventVoiceId) {
      lead = await Lead.findOne({ orgId, "activities.meta.voiceId": eventVoiceId });
      if (!lead) lead = await ProjectLead.findOne({ orgId, "activities.meta.voiceId": eventVoiceId });
      if (lead) {
        actIdx = lead.activities.findIndex(a => a.meta?.voiceId === eventVoiceId);
        if (actIdx >= 0) ownerRef = lead.activities[actIdx].meta?.ownerRef || ownerRef;
      }
    }
    if (!lead || actIdx < 0) return;

    let dirty = false;

    // ── Agent or lead connected — bridge is automatic via action_on_connect.connect ─
    // Just log; no second API call needed. The initial call payload wires the bridge.
    if (eventType === "connected") {
      const legVoiceId = event?.voice_id || event?.voiceId || event?.data?.voice_id || event?.data?.voiceId;
      console.info("[enablex webhook] leg connected — voice_id:", legVoiceId,
        "from:", event.from, "to:", event.to);

      // Recording is its own explicit start/stop call, not something the initial
      // /call payload's "record" field actually triggers — see startRecording().
      if (legVoiceId && !lead.activities[actIdx].meta?.recordingStartRequested) {
        const orgForRecording = await Organization.findById(orgId).select("enablex").lean();
        if (orgForRecording?.enablex?.appId && orgForRecording?.enablex?.apiKey) {
          await startRecording(orgForRecording, legVoiceId, lead.activities[actIdx].meta?.direction || "outbound");
          lead.activities[actIdx].meta = { ...lead.activities[actIdx].meta, recordingStartRequested: true };
          lead.markModified("activities");
          await lead.save();
        }
      }

      if (diagnosticsEnabled() && legVoiceId) {
        const currentDiagnostics = lead.activities[actIdx].meta?.recordingDiagnostics || {};
        const attemptedVoiceIds = Array.isArray(currentDiagnostics.attemptedVoiceIds)
          ? currentDiagnostics.attemptedVoiceIds
          : [];

        if (!attemptedVoiceIds.includes(String(legVoiceId))) {
          const org = await Organization.findById(orgId).select("enablex").lean();
          if (org?.enablex?.appId && org?.enablex?.apiKey) {
            const wssHost = buildCallStreamUrl({ orgId, ownerRef, voiceId: String(legVoiceId) });
            lead.activities[actIdx].meta = {
              ...lead.activities[actIdx].meta,
              recordingDiagnostics: {
                ...currentDiagnostics,
                status: "stream_requested",
                attemptedVoiceIds: [...attemptedVoiceIds, String(legVoiceId)],
                lastRequestedAt: new Date().toISOString(),
              },
            };
            lead.markModified("activities");
            await lead.save();

            try {
              await axios.put(`${ENABLEX_BASE}/call/${encodeURIComponent(legVoiceId)}/stream`,
                { wss_host: wssHost }, { ...basicAuth(org), timeout: 10000 });
              console.info("[call-stream] stream requested for bridge leg", legVoiceId);
            } catch (streamError) {
              console.error("[call-stream] stream request failed", legVoiceId,
                streamError.response?.status, streamError.response?.data || streamError.message);
            }
          }
        }
      }
      return;
    }

    // ── Recording ready — EnableX pushes the URL directly in the event body
    // (confirmed live: arrives on a "recording_complete" event and again inline on
    // "disconnected"). No need to poll a separate lookup endpoint - that one needs a
    // service_id we don't have and always 404'd. EnableX's URL itself needs Basic
    // Auth to download though, so re-host it on Cloudinary rather than saving the
    // raw URL directly - the browser's audio player and Whisper can't send those
    // credentials.
    const rawRecordingUrl = event?.recording_url ?? event?.data?.recording_url ?? null;
    const legVoiceIdForRecording = event?.voice_id || event?.voiceId || null;

    if (rawRecordingUrl
      && !lead.activities[actIdx].meta?.recordingUrl
      && !lead.activities[actIdx].meta?.recordingSaveRequested) {
      lead.activities[actIdx].meta = { ...lead.activities[actIdx].meta, recordingSaveRequested: true };
      dirty = true;
      // Delay so this request's own save (below) finishes first - avoids a
      // Mongoose version conflict writing to the same lead document at once.
      setTimeout(() => {
        saveRecordingFromEnablexUrl(orgId, ownerRef, rawRecordingUrl, legVoiceIdForRecording)
          .catch(e => console.error("[enablex recording] save failed:", e.message));
      }, 3000);
    }

    // ── Call hangup / completion event (duration + status) ──────────────────
    // EnableX sends state="disconnected" with call_duration (float, seconds).
    // Ignore bridge_disconnected — it fires simultaneously with disconnected and
    // causes a Mongoose optimistic-concurrency error on the same document version.
    if (eventType !== "bridge_disconnected" && /disconnected|hangup|completed|exit|end/i.test(eventType)) {
      const dur        = Math.round(
        Number(event?.call_duration ?? event?.data?.duration ?? event?.duration ?? 0)
      );
      const callStatus = dur > 5 ? "answered" : "missed";

      const isInbound = lead.activities[actIdx].meta?.direction === "inbound";
      lead.activities[actIdx].description = callStatus === "missed"
        ? (isInbound ? `Missed inbound call from ${lead.name}` : `Missed call to ${lead.name}`)
        : `Call with ${lead.name} · ${Math.floor(dur / 60)}m ${dur % 60}s`;

      lead.activities[actIdx].meta = {
        ...lead.activities[actIdx].meta,
        status: callStatus,
        duration: dur,
      };
      dirty = true;

      // Auto-advance lead status New → Contacted on first answered call
      if (callStatus === "answered" && lead.status === "New") {
        lead.status = "Contacted";
        if (!lead.firstContactedAt) lead.firstContactedAt = new Date();
        lead.activities.push({
          type:        "status_changed",
          description: "Status automatically changed to Contacted after answered call",
          meta:        { from: "New", to: "Contacted", auto: true },
        });
      }

      if (callStatus === "missed") {
        const agentId = lead.activities[actIdx].performedBy;
        if (agentId) {
          sendPushToUser(String(agentId), {
            title: "Missed Call",
            body:  `Missed call to ${lead.name} (${lead.phone})`,
            data:  { type: "missed_call", leadId: String(lead._id) },
          }).catch(() => {});
        }
      }

      // Terminate agent's phone leg so it hangs up when lead disconnects
      const storedVoiceId = lead.activities[actIdx].meta?.voiceId;
      if (storedVoiceId) {
        Organization.findById(orgId).select("enablex").lean()
          .then(org => org?.enablex?.appId
            ? axios.delete(`${ENABLEX_BASE}/call/${storedVoiceId}`, basicAuth(org)) : null)
          .catch(e => console.info("[enablex] terminate agent leg:", e.response?.status || e.message));
      }

    }

    if (dirty) {
      lead.markModified("activities");
      await lead.save();
    }
  } catch (err) {
    console.error(`${logPrefix} error:`, err.message);
  }
}

// ── Public webhook (EnableX + recording server post here, no JWT) ─────────────
// Must be registered BEFORE the protect middleware below.
router.post("/webhook/:orgId", express.json(), async (req, res) => {
  res.sendStatus(200); // acknowledge immediately
  processCallStateEvent(req.params.orgId, req.body, "[enablex webhook]");
});

// ── Authenticated routes ─────────────────────────────────────────────────────
router.use(protect);

// GET /api/calls — one row per lead (grouped), most-recent call shown
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 30, status, search } = req.query;
    // Agents always see only their own calls; managers/admins can filter by any agent
    const agentId = req.user.role === "agent"
      ? String(req.user._id)
      : (req.query.agentId || "");
    const skip  = (Number(page) - 1) * Number(limit);
    const orgId = req.user.orgId;

    const mongoose = require("mongoose");
    const searchCond = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }] }
      : {};
    const actMatch = {
      "activities.type": "called",
      ...(status  && status !== "all" ? { "activities.meta.status": status } : {}),
      ...(agentId ? { "activities.performedBy": new mongoose.Types.ObjectId(agentId) } : {}),
    };

    // Project leads (ProjectLead model) can also be called now, and need to show
    // up in this same list - grouped per-model here, then merged/re-sorted/
    // paginated in JS since Mongo can't do a single aggregation across two
    // different collections.
    const groupCallsByLead = (Model) => Model.aggregate([
      { $match: { orgId: new mongoose.Types.ObjectId(String(orgId)), ...searchCond } },
      { $unwind: "$activities" },
      { $match: actMatch },
      { $sort: { "activities.createdAt": -1 } },
      { $group: {
        _id:             "$_id",
        leadName:        { $first: "$name" },
        leadPhone:       { $first: "$phone" },
        leadStatus:      { $first: "$status" },
        callCount:       { $sum: 1 },
        lastCallAt:      { $first: "$activities.createdAt" },
        lastStatus:      { $first: "$activities.meta.status" },
        lastDuration:    { $first: "$activities.meta.duration" },
        lastPerformedBy: { $first: "$activities.performedByName" },
        lastActivityId:  { $first: "$activities._id" },
      }},
      { $project: {
        _id:             0,
        leadId:          "$_id",
        leadName:        1,
        leadPhone:       1,
        leadStatus:      1,
        callCount:       1,
        lastCallAt:      1,
        lastStatus:      1,
        lastDuration:    1,
        lastPerformedBy: 1,
        lastActivityId:  1,
      }},
    ]);

    const [leadRows, projectLeadRows] = await Promise.all([
      groupCallsByLead(Lead),
      groupCallsByLead(ProjectLead),
    ]);

    // Tag which model each row came from so the frontend knows whether to send
    // leadId or projectLeadId back on actions like "Call back".
    const merged = [
      ...leadRows.map((r) => ({ ...r, isProjectLead: false })),
      ...projectLeadRows.map((r) => ({ ...r, isProjectLead: true })),
    ].sort((a, b) => new Date(b.lastCallAt) - new Date(a.lastCallAt));
    const total = merged.length;
    const rows  = merged.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      calls:   rows,
      total,
      page:    Number(page),
      pages:   Math.ceil(total / Number(limit)),
    });
  } catch (err) { next(err); }
});

// GET /api/calls/stats — call counts by status (for dashboard stats row)
router.get("/stats", async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const orgId    = new mongoose.Types.ObjectId(String(req.user.orgId));
    const countFor = (Model, extraMatch) => Model.aggregate([
      { $match: { orgId } }, { $unwind: "$activities" },
      { $match: { "activities.type": "called", ...extraMatch } },
      { $count: "total" },
    ]);
    const [answered, missed, total, answeredPL, missedPL, totalPL] = await Promise.all([
      countFor(Lead,        { "activities.meta.status": "answered" }),
      countFor(Lead,        { "activities.meta.status": "missed" }),
      countFor(Lead,        {}),
      countFor(ProjectLead, { "activities.meta.status": "answered" }),
      countFor(ProjectLead, { "activities.meta.status": "missed" }),
      countFor(ProjectLead, {}),
    ]);
    res.json({
      success:  true,
      total:    (total[0]?.total    || 0) + (totalPL[0]?.total    || 0),
      answered: (answered[0]?.total || 0) + (answeredPL[0]?.total || 0),
      missed:   (missed[0]?.total   || 0) + (missedPL[0]?.total   || 0),
    });
  } catch (err) { next(err); }
});

// GET /api/calls/lead/:leadId — full call history for one lead
router.get("/lead/:leadId", async (req, res, next) => {
  try {
    const { doc: lead } = await findLeadOrProjectLead(req.params.leadId, req.user.orgId, { lean: true });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const calls = lead.activities
      .filter(a => a.type === "called")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(a => ({
        activityId:  String(a._id),
        description: a.description,
        performedBy: a.performedByName,
        createdAt:   a.createdAt,
        meta:        a.meta || {},
      }));

    res.json({ success: true, leadId: String(lead._id), leadName: lead.name, leadPhone: lead.phone, leadStatus: lead.status, calls });
  } catch (err) { next(err); }
});

// POST /api/calls/lead/:leadId/summary — aggregate AI analysis of all calls for a lead
router.post("/lead/:leadId/summary", async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ success: false, message: "OpenAI not configured." });
    }
    const { doc: lead } = await findLeadOrProjectLead(req.params.leadId, req.user.orgId, { lean: true });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const calls = lead.activities
      .filter(a => a.type === "called")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (calls.length < 2) {
      return res.status(400).json({ success: false, message: "Need at least 2 calls for an aggregate summary." });
    }

    // Build a concise chronological context string for GPT
    const fmt = (s) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
    const callLines = calls.map((c, i) => {
      const m = c.meta || {};
      const parts = [`Call ${i + 1} (${new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`];
      if (m.status)   parts.push(`status: ${m.status}`);
      if (m.duration) parts.push(`duration: ${fmt(m.duration)}`);
      if (m.summary)  parts.push(`summary: "${m.summary}"`);
      else if (m.notes) parts.push(`notes: "${m.notes}"`);
      if (m.intent)   parts.push(`intent: ${m.intent}`);
      return parts.join(" | ");
    }).join("\n");

    const openai = getOpenAI();
    const gpt = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `You are a real estate CRM assistant. A sales agent called the same lead (${lead.name}) ${calls.length} times.
Analyse the call pattern below and return ONLY a valid JSON object with exactly these fields:
- "headline": a short (max 12 words) title explaining the situation (e.g. "Lead keeps rescheduling — needs firm commitment date")
- "summary": 2-3 sentences explaining why so many calls were needed and what happened overall
- "pattern": exactly one of "no_answer" | "follow_up_needed" | "complex_negotiation" | "gradual_progress" | "rescheduling" | "objection_handling" | "other"
- "recommendation": one concrete next action for the agent to close or advance this lead

Return ONLY the JSON, no markdown, no explanation.

Call history:
${callLines}`,
      }],
      max_tokens: 300,
    });

    let parsed = null;
    try { parsed = JSON.parse(gpt.choices[0]?.message?.content || "{}"); } catch {}

    const result = {
      headline:       parsed?.headline       || "Multiple calls — see pattern below",
      summary:        parsed?.summary        || gpt.choices[0]?.message?.content?.trim() || "",
      pattern:        parsed?.pattern        || "other",
      recommendation: parsed?.recommendation || "",
      callCount:      calls.length,
    };

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// GET /api/calls/settings
router.get("/settings", authorize("admin", "manager", "super_admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.user.orgId).select("enablex").lean();
    const { apiKey, ...safe } = org?.enablex || {};
    const orgId = String(req.user.orgId);
    // Inbound answer URL — admins paste this into EnableX portal → Phone Numbers → Answer URL
    const inboundUrl = `${process.env.APP_URL || "https://api.arthaleads.com"}/api/calls/inbound/${orgId}`;
    res.json({
      enablex:    { ...safe, apiKey: apiKey || "", hasApiKey: !!apiKey },
      connected:  !!(apiKey && org?.enablex?.enabled),
      orgId,
      inboundUrl, // shown in Settings → Telephony so admin can copy it
    });
  } catch (err) { next(err); }
});

// PATCH /api/calls/settings
router.patch("/settings", authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const { appId, apiKey, virtualNumber, enabled, aiAutoStatus } = req.body;
    const upd = {};
    if (appId         !== undefined) upd["enablex.appId"]         = String(appId).trim();
    if (apiKey        !== undefined && apiKey) upd["enablex.apiKey"] = String(apiKey).trim();
    if (virtualNumber !== undefined) upd["enablex.virtualNumber"] = String(virtualNumber).trim();
    if (enabled       !== undefined) upd["enablex.enabled"]       = Boolean(enabled);
    if (aiAutoStatus  !== undefined) upd["enablex.aiAutoStatus"]  = Boolean(aiAutoStatus);

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
    const { leadId, projectLeadId } = req.body;
    if (!leadId && !projectLeadId) {
      return res.status(400).json({ success: false, message: "leadId or projectLeadId is required." });
    }

    // Project leads are a separate model (ProjectLead) from regular Leads, with
    // no shared _id - ownerRef's prefix ("lead_" vs "projectlead_") is what tells
    // processCallStateEvent() which collection to update when EnableX's webhook
    // events come back.
    const isProjectLead = !!projectLeadId;
    const targetId = projectLeadId || leadId;
    const Model = isProjectLead ? ProjectLead : Lead;

    const [org, lead] = await Promise.all([
      Organization.findById(req.user.orgId).select("enablex name").lean(),
      Model.findOne({ _id: targetId, orgId: req.user.orgId }),
    ]);

    if (!org?.enablex?.enabled || !org.enablex.appId || !org.enablex.apiKey) {
      return res.status(400).json({ success: false, message: "EnableX telephony is not configured. Go to Settings → Organization → Telephony." });
    }
    if (!lead)       return res.status(404).json({ success: false, message: isProjectLead ? "Project lead not found." : "Lead not found." });
    if (!lead.phone) return res.status(400).json({ success: false, message: "This lead has no phone number." });

    const agentPhone = req.user.phone ? normalizePhone(req.user.phone) : null;
    if (!agentPhone) {
      return res.status(400).json({ success: false, message: "Add your phone number in Settings → My Profile before making calls." });
    }

    const ownerRef   = `${isProjectLead ? "projectlead" : "lead"}_${targetId}_${Date.now()}`;
    // Use api.arthaleads.com — Vercel (www) has no /api proxy, so EnableX webhooks must target Railway directly
    const webhookUrl = `${process.env.APP_URL || "https://api.arthaleads.com"}/api/calls/webhook/${req.user.orgId}`;
    const leadPhone  = normalizePhone(lead.phone);   // digits only, e.g. "917020950304"

    if (!org.enablex.virtualNumber) {
      return res.status(400).json({
        success: false,
        message: "No virtual number configured. In Settings → Telephony, enter the DID number you purchased from EnableX portal (portal.enablex.io → Phone Numbers) and linked to your Voice API app.",
      });
    }
    // EnableX requires "from" without the + prefix (their portal shows +91... but API uses digits only)
    const fromNumber = normalizePhone(org.enablex.virtualNumber); // e.g. "911169040027"
    console.info("[enablex /initiate] appId prefix:", String(org.enablex.appId).slice(0, 6), "from:", fromNumber);

    // EnableX bridge call: action_on_connect.connect tells EnableX to automatically
    // dial the lead and bridge both legs when the agent answers — no second API call needed.
    const payload = {
      from: fromNumber,
      to:   agentPhone,
      action_on_connect: {
        connect: {
          from:    fromNumber,  // caller ID shown to lead (virtual number)
          to:      leadPhone,   // lead's phone (digits only, e.g. "917020950304")
          timeout: 30,          // wait up to 30 s for lead to answer before giving up
        },
      },
      custom_data: ownerRef,
      event_url:   webhookUrl,
      record:      true,
    };

    let voiceId;
    try {
      const resp = await axios.post(`${ENABLEX_BASE}/call`, payload, basicAuth(org));
      voiceId = resp.data?.voice_id ?? resp.data?.id ?? null;
      console.info("[enablex /initiate] Dial-bridge OK — agent:", agentPhone, "→ lead:", leadPhone);
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
        direction:  "outbound",
        status:     "initiated",
        phone:      lead.phone,
        leadPhone,            // normalised digits
        agentPhone: req.user.phone,
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

// GET /api/calls/analytics — call volume + per-agent duration (last 30 days)
router.get("/analytics", async (req, res, next) => {
  try {
    const mongoose    = require("mongoose");
    const orgId       = new mongoose.Types.ObjectId(String(req.user.orgId));
    const thirtyAgo   = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    const volumeByDayFor = (Model) => Model.aggregate([
      { $match: { orgId } },
      { $unwind: "$activities" },
      { $match: { "activities.type": "called", "activities.createdAt": { $gte: thirtyAgo } } },
      { $group: {
        _id:      { y: { $year: "$activities.createdAt" }, m: { $month: "$activities.createdAt" }, d: { $dayOfMonth: "$activities.createdAt" } },
        total:    { $sum: 1 },
        answered: { $sum: { $cond: [{ $eq: ["$activities.meta.status", "answered"] }, 1, 0] } },
        missed:   { $sum: { $cond: [{ $eq: ["$activities.meta.status", "missed"]   }, 1, 0] } },
      }},
    ]);

    const durationByAgentFor = (Model) => Model.aggregate([
      { $match: { orgId } },
      { $unwind: "$activities" },
      { $match: { "activities.type": "called", "activities.meta.status": "answered", "activities.meta.duration": { $gt: 0 } } },
      { $group: {
        _id:          "$activities.performedBy",
        name:         { $first: "$activities.performedByName" },
        totalCalls:   { $sum: 1 },
        totalDuration:{ $sum: "$activities.meta.duration" },
      }},
    ]);

    // Project leads (ProjectLead model) can also be called now - merge their
    // aggregation into the same per-day / per-agent buckets rather than a
    // separate chart, since Mongo can't aggregate across two collections at once.
    const [volLead, volPL, durLead, durPL] = await Promise.all([
      volumeByDayFor(Lead), volumeByDayFor(ProjectLead),
      durationByAgentFor(Lead), durationByAgentFor(ProjectLead),
    ]);

    const volMap = new Map();
    for (const row of [...volLead, ...volPL]) {
      const key = `${row._id.y}-${row._id.m}-${row._id.d}`;
      const existing = volMap.get(key);
      if (existing) {
        existing.total    += row.total;
        existing.answered += row.answered;
        existing.missed   += row.missed;
      } else {
        volMap.set(key, { ...row });
      }
    }
    const volumeByDay = [...volMap.values()].sort((a, b) =>
      a._id.y - b._id.y || a._id.m - b._id.m || a._id.d - b._id.d);

    const durMap = new Map();
    for (const row of [...durLead, ...durPL]) {
      const key = String(row._id);
      const existing = durMap.get(key);
      if (existing) {
        existing.totalCalls    += row.totalCalls;
        existing.totalDuration += row.totalDuration;
      } else {
        durMap.set(key, { ...row });
      }
    }
    const durationByAgent = [...durMap.values()]
      .map((r) => ({ ...r, avgDuration: r.totalDuration / r.totalCalls }))
      .sort((a, b) => b.totalCalls - a.totalCalls);

    res.json({ success: true, volumeByDay, durationByAgent });
  } catch (err) { next(err); }
});

// PATCH /api/calls/:leadId/:activityId/notes — save call notes (all roles)
router.patch("/:leadId/:activityId/notes", async (req, res, next) => {
  try {
    const { notes } = req.body;
    const { doc: lead } = await findLeadOrProjectLead(req.params.leadId, req.user.orgId);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    const idx = lead.activities.findIndex(a => String(a._id) === req.params.activityId);
    if (idx < 0) return res.status(404).json({ success: false, message: "Activity not found" });
    lead.activities[idx].meta = { ...(lead.activities[idx].meta || {}), notes: String(notes || "").trim() };
    lead.markModified("activities");
    await lead.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/calls/:leadId/:activityId/summarize — on-demand AI analysis
router.post("/:leadId/:activityId/summarize", async (req, res, next) => {
  try {
    const { doc: lead, Model } = await findLeadOrProjectLead(req.params.leadId, req.user.orgId);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    const idx = lead.activities.findIndex(a => String(a._id) === req.params.activityId);
    if (idx < 0) return res.status(404).json({ success: false, message: "Activity not found" });
    const recordingUrl = lead.activities[idx].meta?.recordingUrl;
    if (!recordingUrl) return res.status(400).json({ success: false, message: "No recording available for this call." });
    if (!process.env.OPENAI_API_KEY) return res.status(400).json({ success: false, message: "OpenAI not configured on this server." });
    await transcribeAndSummarize(String(lead._id), idx, recordingUrl, Model);
    const updated = await Model.findById(lead._id).lean();
    res.json({ success: true, meta: updated.activities[idx]?.meta || {} });
  } catch (err) { next(err); }
});

// POST /api/calls/:leadId/followup — create a follow-up task (all roles)
router.post("/:leadId/followup", async (req, res, next) => {
  try {
    const { title, dueDate, description } = req.body;
    if (!dueDate) return res.status(400).json({ success: false, message: "dueDate is required" });
    const lead = await Lead.findOne({ _id: req.params.leadId, orgId: req.user.orgId }).select("name").lean();
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    const task = await Task.create({
      orgId:          req.user.orgId,
      title:          title || `Follow up with ${lead.name}`,
      description:    description || "",
      priority:       "medium",
      dueDate:        new Date(dueDate),
      assignedTo:     req.user._id,
      assignedToName: req.user.name,
      assignedBy:     req.user._id,
      assignedByName: req.user.name,
      lead:           lead._id || req.params.leadId,
      leadName:       lead.name,
    });
    res.status(201).json({ success: true, task });
  } catch (err) { next(err); }
});

// ── AI transcription + summarization (runs async after webhook) ──────────────
async function transcribeAndSummarize(leadId, actIdx, recordingUrl, Model = Lead) {
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
    Model.findById(leadId),
  ]);

  if (!lead || !lead.activities[actIdx]) return;

  const transcript = transcription.text || "";

  // Quick sentiment heuristic before calling GPT (saves token cost)
  const lower    = transcript.toLowerCase();
  const pos      = ["interested", "visit", "book", "confirm", "yes", "sure", "like", "want"].some(w => lower.includes(w));
  const neg      = ["not interested", "busy", "later", "no thanks", "don't call"].some(w => lower.includes(w));
  const sentiment = pos && !neg ? "positive" : neg ? "negative" : "neutral";

  // Structured AI analysis — returns JSON with summary, keyPoints, nextAction, intent
  const gpt = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `You are a real estate CRM assistant. Analyse this sales call transcript and return ONLY a valid JSON object with exactly these fields:
- "summary": 1-2 sentence overview of the call
- "keyPoints": array of 2-3 short bullet strings (lead's requirements, budget, timeline if mentioned)
- "nextAction": one specific recommended action for the sales agent
- "intent": exactly one of "interested" | "site_visit" | "negotiation" | "not_interested" | "follow_up" | "unclear"

Return ONLY the JSON, no markdown, no explanation.

Transcript:
${transcript.slice(0, 3000)}`,
    }],
    max_tokens: 300,
  });

  let parsed = null;
  try { parsed = JSON.parse(gpt.choices[0]?.message?.content || "{}"); } catch {}

  const summary    = parsed?.summary    || gpt.choices[0]?.message?.content?.trim() || null;
  const keyPoints  = Array.isArray(parsed?.keyPoints)  ? parsed.keyPoints  : [];
  const nextAction = parsed?.nextAction  || null;
  const intent     = parsed?.intent      || null;

  lead.activities[actIdx].meta = {
    ...lead.activities[actIdx].meta,
    transcript,
    summary,
    keyPoints,
    nextAction,
    intent,
    sentiment,
  };

  // Auto-advance lead status when aiAutoStatus is enabled for this org
  const INTENT_STATUS_MAP = { site_visit: "Site Visit", negotiation: "Negotiation" };
  const targetStatus = intent ? INTENT_STATUS_MAP[intent] : null;
  if (targetStatus && lead.status !== targetStatus) {
    const org = await Organization.findById(lead.orgId).select("enablex.aiAutoStatus").lean();
    if (org?.enablex?.aiAutoStatus) {
      const prev = lead.status;
      lead.status = targetStatus;
      lead.activities.push({
        type:        "status_changed",
        description: `Status changed to ${targetStatus} — AI detected "${intent}" intent from call`,
        meta:        { from: prev, to: targetStatus, auto: true, aiTriggered: true },
      });
    }
  }

  lead.markModified("activities");
  await lead.save();
}

// ── Download EnableX's recording URL (pushed directly on the webhook event) →
// upload to Cloudinary → save URL + auto-transcribe. EnableX's own recording URL
// needs Basic Auth to fetch, so it can't be used directly by the browser player
// or by Whisper - re-hosting on Cloudinary is what makes both work.
async function saveRecordingFromEnablexUrl(orgId, ownerRef, enablexRecordingUrl, voiceId) {
  const { v2: cloudinary } = require("cloudinary");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const org = await Organization.findById(orgId).select("enablex").lean();
  if (!org?.enablex?.appId || !org?.enablex?.apiKey) return;

  const Model = ownerRef?.startsWith("projectlead_") ? ProjectLead : Lead;
  const lead = await Model.findOne({ orgId, "activities.meta.ownerRef": ownerRef });
  if (!lead) return;
  const actIdx = lead.activities.findIndex(a => a.meta?.ownerRef === ownerRef);
  if (actIdx < 0 || lead.activities[actIdx].meta?.recordingUrl) return;

  const audioResp = await axios.get(enablexRecordingUrl, {
    responseType: "arraybuffer",
    timeout:      60000,
    ...basicAuth(org),
  });
  const dataUri = `data:audio/wav;base64,${Buffer.from(audioResp.data).toString("base64")}`;
  const result  = await cloudinary.uploader.upload(dataUri, {
    resource_type: "video",
    folder:        "arthaleads/call-recordings",
    public_id:     `call-${voiceId || ownerRef}`,
    overwrite:     true,
  });
  const recordingUrl = result.secure_url;
  console.info("[enablex recording] saved to Cloudinary:", recordingUrl);

  lead.activities[actIdx].meta = { ...lead.activities[actIdx].meta, recordingUrl };
  lead.markModified("activities");
  await lead.save();

  // Auto-transcribe + AI analysis
  const dur = Number(lead.activities[actIdx].meta?.duration ?? 0);
  if (process.env.OPENAI_API_KEY && dur > 10) {
    transcribeAndSummarize(String(lead._id), actIdx, recordingUrl, Model).catch(() => {});
  }
}

module.exports = router;
