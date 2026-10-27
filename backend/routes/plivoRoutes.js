// routes/plivoRoutes.js — Plivo telephony (27 Oct 2026). Settings for admins, and
// the callbacks Plivo makes during a click-to-call (see services/plivo.js):
//
//   POST /api/plivo/answer/:orgId     agent answered: reply with Record + Dial XML
//   POST /api/plivo/dial/:orgId       customer leg events (answer / connected / hangup)
//   POST /api/plivo/hangup/:orgId     agent leg ended (also when it was never answered)
//   POST /api/plivo/recording/:orgId  stereo recording ready
//
// Every callback carries ?ref=<ownerRef>, the same key EnableX calls use, so the
// call shows in the Calls page and the lead's timeline exactly like before.
// Signatures (X-Plivo-Signature-V3) are checked and logged; calls are only
// refused once PLIVO_WEBHOOK_ENFORCE=true, after real calls have proved the
// check (same rollout as the WhatsApp webhook).
const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const { protect, authorize } = require("../middlewares/auth");
const plivo = require("../services/plivo");
const { activityMatch, updateCallActivity } = require("../services/callActivityStore");
const { uploadCallRecording } = require("../utils/upload");
const { sendPushToUser } = require("../utils/push");

const form = express.urlencoded({ extended: false });
const callEvents = () => require("./enablexRoutes")._callEvents;

// ── Settings (admins) ─────────────────────────────────────────────────────────
router.get("/settings", protect, authorize("admin", "manager", "super_admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.user.orgId).select("plivo telephony").lean();
    const p = org?.plivo || {};
    res.json({
      provider: org?.telephony?.provider || "enablex",
      plivo: { enabled: !!p.enabled, authId: p.authId || "", hasAuthToken: !!p.authToken, number: p.number || "", agentChannel: p.agentChannel || "" },
    });
  } catch (err) { next(err); }
});

router.patch("/settings", protect, authorize("admin", "super_admin"), async (req, res, next) => {
  try {
    const { authId, authToken, number, agentChannel, provider } = req.body || {};
    const set = {};
    if (authId !== undefined) {
      const v = String(authId).trim();
      if (v && !/^[A-Z0-9]{16,40}$/i.test(v)) return res.status(400).json({ message: "That doesn't look like a Plivo Auth ID." });
      set["plivo.authId"] = v;
    }
    if (typeof authToken === "string" && authToken.trim()) {
      const t = authToken.trim();
      if (t.length < 20 || /\s/.test(t)) return res.status(400).json({ message: "That doesn't look like a Plivo Auth Token." });
      set["plivo.authToken"] = plivo.encryptField(t);
    }
    if (number !== undefined) {
      const n = plivo.e164(number);
      if (n && !/^91\d{10}$/.test(n)) return res.status(400).json({ message: "Enter the Plivo Indian number, e.g. 91 22 4012 3456." });
      set["plivo.number"] = n;
    }
    if (agentChannel !== undefined) set["plivo.agentChannel"] = ["left", "right"].includes(agentChannel) ? agentChannel : "";
    if (provider !== undefined) {
      if (!["enablex", "plivo"].includes(provider)) return res.status(400).json({ message: "Unknown phone service." });
      if (provider === "plivo") {
        const cur = await Organization.findById(req.user.orgId).select("plivo").lean();
        const merged = { plivo: { ...(cur?.plivo || {}), ...Object.fromEntries(Object.entries(set).map(([k, v]) => [k.replace("plivo.", ""), v])), enabled: true } };
        if (!plivo.isReady(merged)) return res.status(400).json({ message: "Save the Plivo Auth ID, Auth Token and number before switching calls to Plivo." });
        set["plivo.enabled"] = true;
      }
      set["telephony.provider"] = provider;
    }
    await Organization.updateOne({ _id: req.user.orgId }, { $set: set });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/settings/test", protect, authorize("admin", "super_admin"), async (req, res) => {
  try {
    const org = await Organization.findById(req.user.orgId).select("plivo").lean();
    const out = await plivo.testConnection(org);
    if (out.numberOk === false) return res.status(400).json({ success: false, message: `Connected, but ${org.plivo.number} is not a number on this Plivo account.` });
    res.json({ success: true, message: `Connected to Plivo${out.name ? ` (${out.name})` : ""}.`, ...out });
  } catch (err) {
    res.status(400).json({ success: false, message: `Plivo said: ${err.message}` });
  }
});

// ── Callbacks from Plivo ──────────────────────────────────────────────────────
async function verify(req, orgId, label) {
  const org = await Organization.findById(orgId).select("name plivo").lean();
  const creds = plivo.credentials(org);
  const result = creds ? plivo.checkSignature({
    url: `${plivo.publicBase(req)}${req.originalUrl}`,
    params: req.body || {},
    nonce: req.get("X-Plivo-Signature-V3-Nonce"),
    signature: req.get("X-Plivo-Signature-V3"),
    authToken: creds.authToken,
  }) : "unconfigured";
  if (result !== "ok") {
    const enforce = process.env.PLIVO_WEBHOOK_ENFORCE === "true";
    console.warn(`[plivo ${label}] signature ${result}${enforce ? " - refused" : " - allowed (enforcement off)"}`);
    if (enforce) return { org, ok: false };
  }
  return { org, ok: true };
}

/** The lead and the call activity for ?ref=, from either collection. */
async function findCall(orgId, ref) {
  const [kind, id] = String(ref || "").split("_");
  const Model = kind === "projectlead" ? ProjectLead : kind === "lead" ? Lead : null;
  if (!Model || !id) return null;
  const lead = await Model.findOne({ _id: id, orgId }).lean().catch(() => null);
  const act = lead?.activities?.find((a) => a.meta?.ownerRef === ref);
  return act ? { Model, lead, act, match: activityMatch(act) } : null;
}

const xml = (res, body) => res.type("application/xml").send(body);

router.post("/answer/:orgId", form, async (req, res) => {
  try {
    const { org, ok } = await verify(req, req.params.orgId, "answer");
    if (!ok) return xml(res, plivo.hangupXml());
    const call = await findCall(req.params.orgId, req.query.ref);
    if (!call || !plivo.isReady(org)) return xml(res, plivo.hangupXml("Sorry, this call could not be connected."));
    const { Model, lead, match } = call;
    await updateCallActivity(Model, lead._id, match, { set: {
      "meta.agentAnswered": true,
      "meta.callUuid": String(req.body.CallUUID || ""),
    } });
    xml(res, plivo.answerXml({ number: org.plivo.number, leadPhone: lead.phone, base: plivo.publicBase(req), orgId: req.params.orgId, ref: req.query.ref }));
  } catch (err) {
    console.error("[plivo answer] error:", err.message);
    xml(res, plivo.hangupXml("Sorry, this call could not be connected."));
  }
});

// Customer leg. DialAction "answer"/"connected" when they pick up, "hangup" with
// DialBLegDuration (talk time) when the bridged call ends.
router.post("/dial/:orgId", form, async (req, res) => {
  res.sendStatus(200);
  try {
    const { ok } = await verify(req, req.params.orgId, "dial");
    if (!ok) return;
    const call = await findCall(req.params.orgId, req.query.ref);
    if (!call) return;
    const b = req.body || {};
    const action = String(b.DialAction || "").toLowerCase();
    const { Model, lead, act, match } = call;
    if (action === "answer" || action === "connected") {
      await updateCallActivity(Model, lead._id, match, { set: { "meta.customerAnswered": true, "meta.bLegUuid": String(b.DialBLegUUID || "") } });
    }
    if (action === "hangup") {
      const talk = Math.round(Number(b.DialBLegDuration || 0));
      await updateCallActivity(Model, lead._id, match, { set: {
        "meta.bLegDuration": talk,
        "meta.bLegHangupCause": String(b.DialBLegHangupCauseName || ""),
        "meta.hangupSource": String(b.DialBLegHangupSource || ""),
      } });
      await finish(req.params.orgId, Model, lead, act, talk);
    }
  } catch (err) {
    console.error("[plivo dial] error:", err.message);
  }
});

// Agent leg ended. If the customer leg already reported talk time, that wins;
// otherwise (agent never answered, customer never answered) it's a missed call.
router.post("/hangup/:orgId", form, async (req, res) => {
  res.sendStatus(200);
  try {
    const { ok } = await verify(req, req.params.orgId, "hangup");
    if (!ok) return;
    const b = req.body || {};
    const call = await findCall(req.params.orgId, req.query.ref);
    if (!call) return;
    const { Model, lead, match } = call;
    await updateCallActivity(Model, lead._id, match, { set: {
      "meta.callUuid": String(b.CallUUID || call.act.meta?.callUuid || ""),
      "meta.agentLegStatus": String(b.CallStatus || ""),
      "meta.hangupCause": String(b.HangupCauseName || b.HangupCause || ""),
    } });
    // The customer leg's own hangup carries the talk time; give it a moment.
    setTimeout(async () => {
      const fresh = await findCall(req.params.orgId, req.query.ref);
      if (fresh) await finish(req.params.orgId, fresh.Model, fresh.lead, fresh.act, Number(fresh.act.meta?.bLegDuration || 0));
    }, Number(process.env.PLIVO_HANGUP_WAIT_MS || 6000));
  } catch (err) {
    console.error("[plivo hangup] error:", err.message);
  }
});

/** Writes the call's outcome once; "answered" also moves a New lead to Contacted. */
async function finish(orgId, Model, lead, act, talkSeconds) {
  const { finalizeCallActivity, changeLeadStatus } = callEvents();
  const status = await finalizeCallActivity(Model, lead, act, talkSeconds);
  if (status === "answered") {
    await changeLeadStatus(Model, lead._id, "New", "Contacted", {
      type: "status_changed",
      description: "Status automatically changed to Contacted after answered call",
      meta: { from: "New", to: "Contacted", auto: true },
    });
  }
  if (status === "missed" && act.performedBy) {
    const who = act.meta?.agentAnswered ? `${lead.name} didn't answer` : "You didn't pick up";
    sendPushToUser(String(act.performedBy), {
      title: "Missed Call",
      body: `${who} (${lead.phone})`,
      data: { type: "missed_call", leadId: String(lead._id) },
    }).catch(() => {});
  }
  return status;
}

// Stereo recording ready: copy it into our storage, then transcribe by speaker.
router.post("/recording/:orgId", form, async (req, res) => {
  res.sendStatus(200);
  try {
    const { org, ok } = await verify(req, req.params.orgId, "recording");
    if (!ok) return;
    const b = req.body || {};
    const url = String(b.RecordUrl || b.record_url || "");
    if (!/^https:\/\/([a-z0-9-]+\.)*plivo\.com\//i.test(url)) {
      if (url) console.warn("[plivo recording] ignored recording URL on unexpected host");
      return;
    }
    const call = await findCall(req.params.orgId, req.query.ref);
    if (!call) return;
    const { Model, lead, match } = call;
    const claimed = await updateCallActivity(Model, lead._id, match, {
      set: { "meta.recordingSaveRequested": true },
      where: { "meta.recordingUrl": { $in: [null, ""] }, "meta.recordingSaveRequested": { $ne: true } },
    });
    if (!claimed) return;
    // Our own storage when it's set up (production). Where it isn't (staging),
    // keep Plivo's link: recordings there are public unless the account turned
    // on Basic auth, and Plivo keeps them (free for 90 days).
    let recordingUrl = url;
    if (require("../utils/storage").isConfigured()) {
      const buf = await plivo.downloadRecording(org, url);
      recordingUrl = await uploadCallRecording(buf, `call-plivo-${String(b.RecordingID || call.act.meta?.callUuid || lead._id)}.wav`, "audio/wav", req.params.orgId);
    } else {
      console.warn("[plivo recording] storage not configured; keeping Plivo's recording URL");
    }
    const duration = Math.round(Number(b.RecordingDuration || 0));
    await updateCallActivity(Model, lead._id, match, { set: {
      "meta.recordingUrl": recordingUrl,
      "meta.recordingId": String(b.RecordingID || ""),
      "meta.recordingChannels": 2,
      ...(duration > 0 ? { "meta.recordingDuration": duration } : {}),
    } });
    console.info("[plivo recording] saved:", recordingUrl);
    if (process.env.OPENAI_API_KEY && duration > 5) {
      callEvents().transcribeAndSummarize(String(lead._id), match, recordingUrl, Model)
        .catch((err) => console.error("[plivo transcript] failed:", err.message));
    }
  } catch (err) {
    console.error("[plivo recording] error:", err.message);
  }
});

router._internals = { findCall, finish };
module.exports = router;
