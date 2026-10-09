// Read-only picker data for Vistrow Voice's Integrations screen: the active
// projects and the real campaigns/ads of ONE ArthaLeads organisation, so an
// admin picks from a list instead of typing.
//
//   GET /webhook/vistrow/picker-options
//   Authorization: Bearer <token>     (or X-ArthaLeads-Token: <token>)
//
// The token is the existing "Vistrow Voice" connection token (the one already
// used for /webhook/lead). It identifies the organisation, so there is no org id
// to pass and nothing to spoof; it is never accepted in the URL. Enterprise-only,
// like /webhook/lead. Nothing is written, no integration setting is read or
// changed, and no call can result from this request.

const express = require("express");
const rateLimit = require("express-rate-limit");
const Automation = require("../models/Automation");
const Project = require("../models/Project");
const logger = require("../config/logger");

const router = express.Router();

const MAX_PROJECTS = 200;

const tokenFrom = (req) => {
  const auth = String(req.get("authorization") || "");
  const bearer = /^Bearer\s+(\S+)$/i.exec(auth);
  return (bearer && bearer[1]) || String(req.get("x-arthaleads-token") || "").trim();
};

const limiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => tokenFrom(req) || req.ip,
  message: { ok: false, reason: "rate_limited" },
});

const clean = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const tail = (id) => String(id).slice(-4);

router.get("/picker-options", limiter, async (req, res) => {
  try {
    if (req.query.token) return res.status(400).json({ ok: false, reason: "token_in_url", message: "Send the token in the Authorization header, not the URL." });
    const token = tokenFrom(req);
    if (!token) return res.status(401).json({ ok: false, reason: "missing_token" });

    // Only the Vistrow Voice connection can read this - not Website/Custom/Facebook tokens.
    const automation = await Automation.findOne({ platform: "Vistrow Voice", verifyToken: token, isActive: true }).select("orgId").lean();
    if (!automation) return res.status(401).json({ ok: false, reason: "invalid_token" });

    const Organization = require("../models/Organization");
    const { levelOf } = require("../middlewares/planGate");
    const org = await Organization.findById(automation.orgId).select("plan").lean();
    if (!org || levelOf(org.plan) < levelOf("enterprise")) return res.status(403).json({ ok: false, reason: "plan" });

    const leadService = require("../services/leadService");
    const [projects, opts] = await Promise.all([
      Project.find({ orgId: automation.orgId, isArchived: { $ne: true } }).select("name location").sort({ name: 1 }).limit(MAX_PROJECTS).lean(),
      leadService.getCampaignOptions({ orgId: automation.orgId }),
    ]);

    // Campaigns come only from leads that actually arrived (Facebook campaign ids, WhatsApp
    // click-to-chat ads, Google campaigns), so every entry is real. A name is the best one
    // ArthaLeads stored; Facebook leads often carry only the form/source label.
    const campaigns = [];
    const add = (source, rows, fallback) => (rows || []).forEach((r) => {
      const id = clean(r.value, 100);
      if (id) campaigns.push({ source, id, name: clean(r.label && r.label !== r.value ? r.label : `${fallback} …${tail(id)}`, 150), leads: r.count || 0 });
    });
    add("facebook_campaign", opts.facebook?.campaign_id, "Facebook campaign");
    add("whatsapp_ad", opts.whatsapp?.ad_id, "WhatsApp ad");
    add("google_campaign", opts.google?.campaign_id, "Google campaign");

    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      org_id: String(automation.orgId),
      projects: projects.map((p) => ({ id: String(p._id), name: clean(p.name, 120), location: clean(p.location, 120) })),
      campaigns,
    });
  } catch (err) {
    logger.error(`[vistrow-picker] failed: ${err?.name || "Error"}`);
    res.status(500).json({ ok: false, reason: "server_error" });
  }
});

module.exports = router;
