// Read-only project list for Vistrow Voice's Integrations screen, so an admin
// picks a project from a list instead of typing it.
//
//   GET /webhook/lead/projects
//   X-ArthaLeads-Connection-Token: <the organisation's Vistrow Voice connection token>
//   -> 200 { ok: true, projects: [{ id, name }] }
//
// The token is the existing "Vistrow Voice" connection token (the one already
// used for POST /webhook/lead). It identifies the organisation, so no org id is
// passed and none can be spoofed. It is accepted in the header only, never in
// the URL. Only an active Vistrow Voice connection works (Website/Custom/etc.
// tokens are refused); Enterprise only, like /webhook/lead. Nothing is written
// and no integration setting or auto-call switch is read or changed.
//
// Mounted at /webhook/lead BEFORE webhookRoutes; it handles only GET /projects,
// so POST /webhook/lead still falls through to the existing handler untouched.

const express = require("express");
const rateLimit = require("express-rate-limit");
const Automation = require("../models/Automation");
const Project = require("../models/Project");
const logger = require("../config/logger");

const router = express.Router();

const MAX_PROJECTS = 200;
const tokenFrom = (req) => String(req.get("x-arthaleads-connection-token") || "").trim();

const limiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => tokenFrom(req) || req.ip,
  message: { ok: false, reason: "rate_limited" },
});

router.get("/projects", limiter, async (req, res) => {
  try {
    if (req.query.token || req.query.connection_token) return res.status(400).json({ ok: false, reason: "token_in_url", message: "Send the token in the X-ArthaLeads-Connection-Token header, not the URL." });
    const token = tokenFrom(req);
    if (!token) return res.status(401).json({ ok: false, reason: "missing_token" });

    const automation = await Automation.findOne({ platform: "Vistrow Voice", verifyToken: token, isActive: true }).select("orgId").lean();
    if (!automation) return res.status(401).json({ ok: false, reason: "invalid_token" });

    const Organization = require("../models/Organization");
    const { levelOf } = require("../middlewares/planGate");
    const org = await Organization.findById(automation.orgId).select("plan").lean();
    if (!org || levelOf(org.plan) < levelOf("enterprise")) return res.status(403).json({ ok: false, reason: "plan" });

    const rows = await Project.find({ orgId: automation.orgId, isArchived: { $ne: true } }).select("name").sort({ name: 1 }).limit(MAX_PROJECTS).lean();
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, projects: rows.map((p) => ({ id: String(p._id), name: String(p.name || "").replace(/\s+/g, " ").trim().slice(0, 120) })) });
  } catch (err) {
    logger.error(`[vistrow-projects] failed: ${err?.name || "Error"}`);
    res.status(500).json({ ok: false, reason: "server_error" });
  }
});

module.exports = router;
