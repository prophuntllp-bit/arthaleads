// Owner-facing controls for the outbound Vistrow Voice integration.
// Mounted at /api/integrations/vistrow-outbound. Admin only throughout.
//
// Nothing here ever returns the saved credential: the API reports only whether
// one exists and when it was last changed.

const express = require("express");
const rateLimit = require("express-rate-limit");
const OutboundIntegration = require("../models/OutboundIntegration");
const OutboundDelivery = require("../models/OutboundDelivery");
const { protect, authorize } = require("../middlewares/auth");
const logger = require("../config/logger");
const Project = require("../models/Project");
const { validateConfigInput, sensitiveChanges } = require("../services/vistrowOutbound/config");
const T = require("../services/vistrowOutbound/transport");
const { maskPhone } = require("../services/vistrowOutbound/phone");
const R = require("../services/vistrowOutbound/routing");
const agentsLib = require("../services/vistrowOutbound/agents");
const { service } = require("../services/vistrowOutbound");
const { mongoStore, toConfig } = require("../services/vistrowOutbound/store.mongo");

const router = express.Router();
router.use(protect, authorize("admin"));

const testLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many test requests - wait a minute." } });

const agentsLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many requests - wait a minute." } });

const fail = (res, err, where) => {
  logger.error(`[vistrow-outbound] ${where} failed: ${err?.name || "Error"}${err?.code ? `:${err.code}` : ""}`);
  return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
};

const load = (orgId) => OutboundIntegration.findOne({ orgId, provider: "vistrow" }).select("+secretEnc");

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null);

async function buildStatus(orgId, doc) {
  let secret = "";
  try { secret = doc?.secretEnc ? doc.getSecret() : ""; } catch { secret = ""; }
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = { orgId, isTest: false, createdAt: { $gte: since } };
  const [grouped, callsAsked, callsDeclined, delivered] = await Promise.all([
    OutboundDelivery.aggregate([{ $match: recent }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    OutboundDelivery.countDocuments({ ...recent, autoCall: true, status: { $in: ["pending", "sending", "delivered"] } }),
    OutboundDelivery.countDocuments({ ...recent, autoCall: true, callQueued: false }),
    OutboundDelivery.find({ orgId, isTest: false, status: "delivered", createdAt: { $gte: since }, endToEndMs: { $ne: null } }).select("endToEndMs").limit(1000).lean(),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n]));
  const ms = delivered.map((d) => d.endToEndMs).sort((a, b) => a - b);

  return {
    configured: !!(doc && doc.baseUrl && doc.accountId && doc.secretEnc),
    enabled: !!doc?.enabled,
    enabledAt: doc?.enabledAt || null,
    enabledByName: doc?.enabledByName || "",
    config: {
      baseUrl: doc?.baseUrl || "",
      accountId: doc?.accountId || "",
      authMode: doc?.authMode || "header",
      defaultCountryCode: doc?.defaultCountryCode || "91",
      dedupeWindowHours: doc?.dedupeWindowHours ?? 24,
      maxLeadAgeMinutes: doc?.maxLeadAgeMinutes ?? 15,
      emitImports: !!doc?.emitImports,
      hasSecret: !!doc?.secretEnc,
      secretUpdatedAt: doc?.secretUpdatedAt || null,
    },
    // Per source: the opt-in switch and the route rows (what matches -> which agent).
    routing: Object.fromEntries(R.SOURCE_KEYS.map((k) => {
      const src = doc?.routing?.[k];
      return [k, {
        enabled: src?.enabled === true,
        enabledAt: src?.enabledAt || null,
        allowedKinds: R.KINDS_BY_SOURCE[k],
        routes: (src?.routes || []).map((r) => ({
          id: String(r._id), label: R.routeLabel(r), customLabel: r.label || "", matchKind: r.matchKind, matchValue: r.matchValue,
          projectId: r.projectId ? String(r.projectId) : "", projectName: r.projectName || "",
          agentRef: r.agentId && secret ? agentsLib.refFor(secret, r.agentId) : "", agentLabel: r.agentLabel || "", agentKb: r.agentKb || "", unassigned: !r.agentId,
        })),
      }];
    })),
    health: {
      lastSuccessAt: doc?.lastSuccessAt || null, lastFailureAt: doc?.lastFailureAt || null,
      lastError: doc?.lastError || null, lastWarning: doc?.lastWarning || null,
    },
    stats24h: {
      counts,
      delivered: ms.length,
      p50EndToEndMs: percentile(ms, 50),
      p95EndToEndMs: percentile(ms, 95),
      within30sPct: ms.length ? Math.round((ms.filter((m) => m <= 30000).length / ms.length) * 100) : null,
      callsRequested: callsAsked,       // deliveries that asked Vistrow to call
      callsDeclinedByVistrow: callsDeclined, // accepted as a Contact, but Vistrow did not queue the call
    },
    server: { testSendAllowed: process.env.VISTROW_OUTBOUND_ALLOW_TEST_SEND === "1", killSwitch: process.env.VISTROW_OUTBOUND_DISABLED === "1", allowedHosts: T.allowedHosts() },
  };
}

// GET /api/integrations/vistrow-outbound
router.get("/", async (req, res) => {
  try {
    const doc = await load(req.user.orgId);
    res.json({ success: true, status: await buildStatus(req.user.orgId, doc) });
  } catch (err) { fail(res, err, "status"); }
});

// PUT /api/integrations/vistrow-outbound/config  -- saves settings; never enables.
router.put("/config", async (req, res) => {
  try {
    const { errors, value } = validateConfigInput(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors[0], errors });

    let doc = await load(req.user.orgId);
    if (!doc) doc = new OutboundIntegration({ orgId: req.user.orgId, provider: "vistrow", createdBy: req.user._id });

    const changed = sensitiveChanges(value, doc);
    const { secret, ...rest } = value;
    if (secret) {
      try { doc.setSecret(secret); }
      catch { return res.status(500).json({ success: false, message: "This server has no encryption key configured, so the credential cannot be stored safely." }); }
    }
    Object.assign(doc, rest);
    doc.updatedBy = req.user._id;

    // Re-pointing a live integration switches it off until the owner turns it on again.
    let disabledByChange = false;
    if (doc.enabled && changed.length) {
      doc.enabled = false;
      disabledByChange = true;
    }
    await doc.save();
    if (disabledByChange) {
      await mongoStore.cancelPending(req.user.orgId, new Date(), "config_changed");
      logger.warn(`[vistrow-outbound] switched off by settings change org=${req.user.orgId} by=${req.user._id} changed=${changed.join(",")}`);
    }
    res.json({ success: true, disabledByChange, status: await buildStatus(req.user.orgId, doc) });
  } catch (err) { fail(res, err, "save config"); }
});

// POST /api/integrations/vistrow-outbound/enable  { confirm: true }
// The only way the integration is switched on. enabledAt is the watermark:
// only leads created after this instant are ever sent.
router.post("/enable", async (req, res) => {
  try {
    if (req.body?.confirm !== true) return res.status(400).json({ success: false, message: "Confirmation required." });
    const doc = await load(req.user.orgId);
    if (!doc) return res.status(400).json({ success: false, message: "Save the connection details first." });
    const problems = service.configProblems(toConfig(doc));
    if (problems.length) return res.status(400).json({ success: false, message: problems[0], problems });
    if (!doc.enabled) {
      doc.enabled = true;
      doc.enabledAt = new Date();
      doc.enabledBy = req.user._id;
      doc.enabledByName = req.user.name || "";
      doc.updatedBy = req.user._id;
      await doc.save();
      logger.warn(`[vistrow-outbound] ENABLED org=${req.user.orgId} by=${req.user._id}`);
    }
    res.json({ success: true, status: await buildStatus(req.user.orgId, doc) });
  } catch (err) { fail(res, err, "enable"); }
});

// POST /api/integrations/vistrow-outbound/disable
router.post("/disable", async (req, res) => {
  try {
    const doc = await load(req.user.orgId);
    if (!doc) return res.json({ success: true, status: await buildStatus(req.user.orgId, null) });
    if (doc.enabled) {
      doc.enabled = false;
      doc.updatedBy = req.user._id;
      await doc.save();
      logger.warn(`[vistrow-outbound] disabled org=${req.user.orgId} by=${req.user._id}`);
    }
    const cancelled = await mongoStore.cancelPending(req.user.orgId, new Date(), "integration_disabled");
    res.json({ success: true, cancelled, status: await buildStatus(req.user.orgId, doc) });
  } catch (err) { fail(res, err, "disable"); }
});

// PUT /api/integrations/vistrow-outbound/routing
// { website|facebook|whatsapp: { enabled?, routes?: [{ matchKind, matchValue|projectId, label?, agentId, agentLabel }] }, confirm }
// Replaces the given sources' route rows and/or flips their switch. Every
// source is OFF until switched on here, and turning one ON needs confirm:true.
// There is no default agent: a row with no agent resolves to no call.
router.put("/routing", async (req, res) => {
  try {
    const { errors, value } = R.validateRoutingInput(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors[0], errors });
    const doc = await load(req.user.orgId);
    if (!doc) return res.status(400).json({ success: false, message: "Save the connection details first." });

    const turningOn = R.SOURCE_KEYS.filter((k) => value[k]?.enabled === true && doc.routing?.[k]?.enabled !== true);
    if (turningOn.length && req.body?.confirm !== true) {
      return res.status(400).json({ success: false, message: `Confirmation required to turn on calls for: ${turningOn.join(", ")}.` });
    }

    const wanted = new Set();
    for (const k of R.SOURCE_KEYS) for (const r of value[k]?.routes || []) if (r.projectId) wanted.add(r.projectId);
    const found = wanted.size
      ? await Project.find({ _id: { $in: [...wanted] }, orgId: req.user.orgId, isArchived: { $ne: true } }).select("_id name").lean()
      : [];
    const names = new Map(found.map((p) => [String(p._id), p.name]));
    for (const id of wanted) if (!names.has(id)) return res.status(400).json({ success: false, message: "One of the chosen projects no longer exists." });

    // Agents are chosen by name; map each chosen ref back to Vistrow's id using the live list.
    const refs = new Set();
    for (const k of R.SOURCE_KEYS) for (const r of value[k]?.routes || []) if (r.agentRef) refs.add(r.agentRef);
    const byRef = new Map();
    if (refs.size) {
      const listed = await agentsLib.listAgents({ baseUrl: doc.baseUrl, accountId: doc.accountId, authMode: doc.authMode, secret: doc.getSecret() });
      if (!listed.ok) return res.status(400).json({ success: false, message: listed.message, code: listed.code });
      listed.agents.forEach((a) => byRef.set(a.ref, a));
      for (const ref of refs) if (!byRef.has(ref)) return res.status(400).json({ success: false, message: "That agent is no longer available in Vistrow. Refresh the list and choose again." });
    }

    const now = new Date();
    for (const k of R.SOURCE_KEYS) {
      const incoming = value[k];
      if (!incoming) continue;
      const cur = doc.routing[k];
      if (incoming.enabled !== undefined) {
        if (incoming.enabled && !cur.enabled) { cur.enabledAt = now; }
        cur.enabled = incoming.enabled;
      }
      if (incoming.routes) {
        const before = new Map((cur.routes || []).map((r) => [String(r._id), r]));
        cur.routes = incoming.routes.map((r) => {
          const prev = r._id ? before.get(r._id) : null;
          const pick = r.agentRef ? byRef.get(r.agentRef) : null;
          const agent = pick ? { agentId: pick.id, agentLabel: pick.name, agentKb: pick.knowledgeBase }
            : r.keepAgent && prev ? { agentId: prev.agentId, agentLabel: prev.agentLabel, agentKb: prev.agentKb }
            : r.agentRef === undefined && r.agentId ? { agentId: r.agentId, agentLabel: r.agentLabel, agentKb: "" }
            : { agentId: "", agentLabel: "", agentKb: "" };
          return {
            ...(prev ? { _id: r._id } : {}),
            label: r.label, matchKind: r.matchKind, matchValue: r.matchValue,
            projectId: r.projectId || null, projectName: r.projectId ? names.get(r.projectId) : "",
            ...agent,
          };
        });
      }
    }
    doc.updatedBy = req.user._id;
    doc.markModified("routing");
    await doc.save();
    for (const k of R.SOURCE_KEYS) if (value[k]?.enabled !== undefined) logger.warn(`[vistrow-outbound] source ${k} calls ${value[k].enabled ? "ENABLED" : "disabled"} org=${req.user.orgId} by=${req.user._id}`);
    res.json({ success: true, status: await buildStatus(req.user.orgId, doc) });
  } catch (err) { fail(res, err, "save routing"); }
});

// GET /api/integrations/vistrow-outbound/agents
// The agents (with their knowledge base) the owner may choose from. Ids are never returned:
// each entry has a name, a knowledge-base name and an opaque ref. Failures come back as a
// plain-language `problem`, not an HTTP error, so the setup screen can explain them inline.
router.get("/agents", agentsLimiter, async (req, res) => {
  try {
    const doc = await load(req.user.orgId);
    if (!doc || !doc.secretEnc) return res.json({ success: true, agents: [], problem: { code: "not_ready", message: agentsLib.PROBLEMS.not_ready } });
    const r = await agentsLib.listAgents({ baseUrl: doc.baseUrl, accountId: doc.accountId, authMode: doc.authMode, secret: doc.getSecret() });
    if (!r.ok) return res.json({ success: true, agents: [], problem: { code: r.code, message: r.message } });
    res.json({ success: true, agents: r.agents.map((a) => ({ ref: a.ref, name: a.name, knowledgeBase: a.knowledgeBase })) });
  } catch (err) { fail(res, err, "agents"); }
});

// POST /api/integrations/vistrow-outbound/simulate  { source, pageUrl?, projectId?, adId? }
// "Which agent would a lead like this get?" Pure read of the saved settings:
// sends nothing and touches no lead.
router.post("/simulate", async (req, res) => {
  try {
    const doc = await load(req.user.orgId);
    if (!doc) return res.status(400).json({ success: false, message: "Save the connection details first." });
    const b = req.body || {};
    const inputs = { routeSource: String(b.source || ""), sourcePage: String(b.pageUrl || ""), projectId: String(b.projectId || ""), adId: String(b.adId || "") };
    const { agentId, ...decision } = R.resolveRouting(toConfig(doc), inputs); // the raw agent id stays on the server
    res.json({ success: true, decision });
  } catch (err) { fail(res, err, "simulate"); }
});

// POST /api/integrations/vistrow-outbound/test  { mode: "dry_run" | "send", confirm }
// Always a synthetic lead. dry_run sends nothing; send also needs the server
// operator to have allowed it, and an explicit confirm.
router.post("/test", testLimiter, async (req, res) => {
  try {
    const mode = req.body?.mode === "send" ? "send" : "dry_run";
    if (mode === "send" && req.body?.confirm !== true) return res.status(400).json({ success: false, message: "Confirmation required to send a test event." });
    const doc = await load(req.user.orgId);
    if (!doc) return res.status(400).json({ success: false, message: "Save the connection details first." });
    const result = await service.runTest(toConfig(doc), { mode });
    res.json({ success: true, result });
  } catch (err) { fail(res, err, "test"); }
});

// GET /api/integrations/vistrow-outbound/deliveries?status=&limit=&before=
// Redacted: no name, email, payload or credential; phone is masked.
router.get("/deliveries", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const q = { orgId: req.user.orgId };
    if (req.query.status) q.status = String(req.query.status);
    if (req.query.before && !Number.isNaN(Date.parse(req.query.before))) q.createdAt = { $lt: new Date(req.query.before) };
    const rows = await OutboundDelivery.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({
      success: true,
      deliveries: rows.map((d) => ({
        id: d._id, eventId: d.eventId, leadId: d.leadId, status: d.status, skipReason: d.skipReason, origin: d.origin, isTest: d.isTest,
        autoCall: d.autoCall, autoCallReason: d.autoCallReason, routeSource: d.routeSource, routeLabel: d.routeLabel,
        agentLabel: d.agentLabel, callQueued: d.callQueued, callReason: d.callReason,
        phone: maskPhone(d.phoneKey), attempts: d.attempts, nextAttemptAt: d.nextAttemptAt, lastHttpStatus: d.lastHttpStatus,
        lastErrorCode: d.lastErrorCode, lastErrorMessage: d.lastErrorMessage, lastLatencyMs: d.lastLatencyMs, endToEndMs: d.endToEndMs,
        deduped: d.deduped, createdAt: d.createdAt, deliveredAt: d.deliveredAt,
      })),
    });
  } catch (err) { fail(res, err, "deliveries"); }
});

module.exports = router;
