// routes/metaConversionRoutes.js — set up and watch Meta Conversions API.
//   GET  /api/meta-conversions        settings (token never returned), stats, recent events
//   PUT  /api/meta-conversions        save settings
//   POST /api/meta-conversions/test   send a test event to check the credentials
//   POST /api/meta-conversions/retry  re-queue failed events

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const Organization = require("../models/Organization");
const MetaEvent = require("../models/MetaEvent");
const Lead = require("../models/Lead");
const OPTS = require("../constants/leadOptions");
const capi = require("../services/metaConversions");
const logger = require("../config/logger");

router.use(protect, authorize("admin", "super_admin"), planGate("growth"));

const last4 = (enc) => { const t = capi.decryptField(enc) || ""; return t ? t.slice(-4) : ""; };

router.get("/", async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("metaCapi plan").lean();
    const c = org?.metaCapi || {};
    const [recent, counts, matchable] = await Promise.all([
      MetaEvent.find({ orgId: req.orgId }).sort({ createdAt: -1 }).limit(20).populate("leadId", "name").lean(),
      MetaEvent.aggregate([{ $match: { orgId: org._id } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      Lead.countDocuments({ orgId: req.orgId, $or: [{ metaLeadId: { $nin: ["", null] } }, { "campaignRef.ctwaClid": { $nin: ["", null] } }] }),
    ]);
    res.json({
      enabled: !!c.enabled,
      datasetId: c.datasetId || "",
      tokenSet: !!c.accessToken,
      tokenLast4: last4(c.accessToken),
      testEventCode: c.testEventCode || "",
      events: capi.eventsFor(org),
      stages: OPTS.STATUS,
      lastSentAt: c.lastSentAt || null,
      lastError: c.lastError || "",
      stats: Object.fromEntries(counts.map((r) => [r._id, r.n])),
      matchableLeads: matchable,
      recent: recent.map((e) => ({
        _id: e._id, leadName: e.leadId?.name || "Lead", stage: e.stage, eventName: e.eventName,
        channel: e.channel, status: e.status, error: e.error, at: e.sentAt || e.createdAt,
      })),
    });
  } catch (err) {
    logger.error(`[meta-capi] load failed: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

router.put("/", async (req, res) => {
  try {
    const { enabled, datasetId, accessToken, testEventCode, events } = req.body || {};
    const set = {};
    if (datasetId !== undefined) {
      const id = String(datasetId).trim();
      if (id && !/^\d{8,20}$/.test(id)) return res.status(400).json({ message: "The dataset ID is a number of 15 or 16 digits, from Events Manager." });
      set["metaCapi.datasetId"] = id;
    }
    if (typeof accessToken === "string" && accessToken.trim()) {
      const t = accessToken.trim();
      if (t.length < 20 || /\s/.test(t)) return res.status(400).json({ message: "That does not look like an access token." });
      set["metaCapi.accessToken"] = capi.encryptField(t);
    }
    if (testEventCode !== undefined) set["metaCapi.testEventCode"] = String(testEventCode).trim().slice(0, 30);
    if (Array.isArray(events)) {
      const seen = new Set();
      const clean = [];
      for (const e of events) {
        if (!OPTS.STATUS.includes(e?.stage) || seen.has(e.stage)) continue;
        const name = String(e.eventName || "").trim();
        if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) return res.status(400).json({ message: `"${e.eventName}" is not a valid event name. Use letters, numbers and underscores.` });
        seen.add(e.stage);
        clean.push({ stage: e.stage, eventName: name, enabled: !!e.enabled });
      }
      set["metaCapi.events"] = clean;
    }
    if (enabled !== undefined) set["metaCapi.enabled"] = !!enabled;

    if (set["metaCapi.enabled"]) {
      const cur = (await Organization.findById(req.orgId).select("metaCapi").lean())?.metaCapi || {};
      const ds = set["metaCapi.datasetId"] ?? cur.datasetId;
      const tok = set["metaCapi.accessToken"] ?? cur.accessToken;
      if (!ds || !tok) return res.status(400).json({ message: "Add the dataset ID and access token before turning this on." });
    }
    if (Object.keys(set).length) await Organization.updateOne({ _id: req.orgId }, { $set: set });
    res.json({ success: true });
  } catch (err) {
    logger.error(`[meta-capi] save failed: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

router.post("/test", async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("metaCapi").lean();
    if (!org?.metaCapi?.datasetId || !org.metaCapi.accessToken) return res.status(400).json({ message: "Save the dataset ID and access token first." });
    res.json(await capi.sendTest(org));
  } catch (err) {
    res.status(400).json({ message: /^Add a test event code/.test(err.message) ? err.message : `Meta said: ${err.message}` });
  }
});

router.post("/retry", async (req, res) => {
  try {
    const r = await MetaEvent.updateMany({ orgId: req.orgId, status: "failed" }, { $set: { attempts: 0, updatedAt: new Date(0) } }, { timestamps: false });
    capi.sweep().catch(() => {});
    res.json({ queued: r.modifiedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
