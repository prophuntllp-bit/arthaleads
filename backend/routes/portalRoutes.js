// routes/portalRoutes.js - leads from 99acres, Housing.com and MagicBricks (27 Oct 2026, Growth).
//   GET|POST /api/portal-leads/in/:portal/:token   a portal delivers enquiries (JSON, form, link values or XML)
//   GET      /api/portal-leads/settings            the company's links, Housing.com fetch status, counts
//   POST     /api/portal-leads/settings/new-link   replace the private link (the old one stops working)
//   PUT      /api/portal-leads/settings/housing    save the Housing.com ID and key, fetching on/off
//   POST     /api/portal-leads/settings/housing/pull  fetch Housing.com leads now

const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const { planGate, levelOf } = require("../middlewares/planGate");
const Organization = require("../models/Organization");
const Lead = require("../models/Lead");
const logger = require("../config/logger");
const { encryptField } = require("../utils/fieldCrypto");
const { publicBase } = require("../services/plivo");
const { PORTALS, rawRecords, readFields, savePortalLead } = require("../utils/portalLead");
const housing = require("../services/housingPull");

const newToken = () => crypto.randomBytes(18).toString("base64url");

const intakeLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

// ── Intake ────────────────────────────────────────────────────────────────────
// Answers 200 for anything that isn't our fault, so a portal doesn't keep
// retrying or switch the link off; 500 only when saving failed, so it retries.
router.all("/in/:portal/:token",
  intakeLimiter,
  express.text({ type: ["text/*", "application/xml", "application/*+xml"], limit: "1mb" }),
  async (req, res) => {
    const portal = String(req.params.portal || "").toLowerCase();
    if (!PORTALS[portal]) return res.status(404).json({ success: false, message: "Unknown portal" });
    if (!["GET", "POST", "PUT"].includes(req.method)) return res.status(405).end();
    try {
      const token = String(req.params.token || "").slice(0, 100);
      const org = token.length >= 16 ? await Organization.findOne({ "portals.token": token }).select("_id plan autoAssign").lean() : null;
      if (!org) return res.status(401).json({ success: false, message: "This link is not valid. Copy the current one from ArthaLeads Integrations." });

      const rawText = typeof req.body === "string" ? req.body : "";
      const records = rawRecords({ body: rawText ? null : req.body, query: req.query, rawText });
      // A GET with nothing in it is a portal (or a person) checking the link.
      if (req.method === "GET" && !Object.keys(req.query || {}).length) {
        return res.json({ success: true, message: `ArthaLeads ${PORTALS[portal].label} link is working.` });
      }
      if (levelOf(org.plan) < levelOf("growth")) {
        logger.warn(`[portal ${portal}] org ${org._id} is on ${org.plan}: portal leads need Growth, not saved`);
        return res.json({ success: true, message: "Portal leads are part of the Growth plan; this enquiry was not saved." });
      }

      const results = [];
      for (const raw of records.slice(0, 200)) {
        const fields = readFields(raw);
        results.push(await savePortalLead(org, portal, fields, { via: "push" }));
      }
      const saved = results.filter((r) => r.result === "created" || r.result === "added").length;
      if (saved) await Organization.updateOne({ _id: org._id }, { $set: { [`portals.lastLeadAt.${PORTALS[portal].key}`]: new Date() } });
      const skipped = results.filter((r) => r.result === "skipped");
      if (skipped.length && !saved) {
        // Field names only, never values, to learn a portal's format from the logs.
        logger.warn(`[portal ${portal}] org ${org._id}: enquiry without a phone number, fields: ${Object.keys(records[0] || {}).join(",").slice(0, 300)}`);
      }
      res.json({
        success: true,
        message: saved ? "Lead received" : skipped.length ? "No phone number in the enquiry, not saved" : "Already received",
        received: records.length, created: results.filter((r) => r.result === "created").length,
        addedToExisting: results.filter((r) => r.result === "added").length,
      });
    } catch (err) {
      logger.error(`[portal ${portal}] intake failed: ${err.message}`);
      res.status(500).json({ success: false, message: "Could not save the lead, please send it again." });
    }
  });

// ── Settings (admins, Growth) ─────────────────────────────────────────────────
router.use("/settings", protect, authorize("admin", "super_admin"), planGate("growth"));

async function ensureToken(orgId) {
  const org = await Organization.findById(orgId).select("portals.token").lean();
  if (org?.portals?.token) return org.portals.token;
  const token = newToken();
  await Organization.updateOne({ _id: orgId, $or: [{ "portals.token": { $exists: false } }, { "portals.token": null }] }, { $set: { "portals.token": token } });
  return (await Organization.findById(orgId).select("portals.token").lean()).portals.token;
}

async function settingsView(req) {
  const token = await ensureToken(req.orgId);
  const org = await Organization.findById(req.orgId).select("portals").lean();
  const p = org.portals || {};
  const h = p.housing || {};
  const base = `${publicBase(req)}/api/portal-leads/in`;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const counts = await Lead.aggregate([
    { $match: { orgId: org._id, source: { $in: Object.values(PORTALS).map((m) => m.source) }, createdAt: { $gte: since } } },
    { $group: { _id: "$source", n: { $sum: 1 } } },
  ]);
  const n = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  return {
    portals: Object.entries(PORTALS).map(([slug, m]) => ({
      slug, label: m.label, link: `${base}/${slug}/${token}`,
      lastLeadAt: p.lastLeadAt?.[m.key] || null, leads30d: n[m.source] || 0,
    })),
    housing: {
      enabled: !!h.enabled, profileId: h.profileId || "", keySet: !!h.secretKey,
      lastPullAt: h.lastPullAt || null, lastError: h.lastError || "",
    },
  };
}

router.get("/settings", async (req, res) => {
  try { res.json(await settingsView(req)); }
  catch (err) { logger.error(`[portal settings] ${err.message}`); res.status(500).json({ message: "Could not load portal settings." }); }
});

router.post("/settings/new-link", async (req, res) => {
  try {
    await Organization.updateOne({ _id: req.orgId }, { $set: { "portals.token": newToken() } });
    res.json(await settingsView(req));
  } catch (err) { res.status(500).json({ message: "Could not make a new link." }); }
});

router.put("/settings/housing", async (req, res) => {
  try {
    const { profileId, secretKey, enabled } = req.body || {};
    const set = {};
    if (typeof profileId === "string") set["portals.housing.profileId"] = profileId.trim().slice(0, 60);
    if (typeof secretKey === "string" && secretKey.trim()) set["portals.housing.secretKey"] = encryptField(secretKey.trim().slice(0, 300));
    if (typeof enabled === "boolean") set["portals.housing.enabled"] = enabled;
    // Saving new credentials starts from the last 24 hours again.
    if (set["portals.housing.profileId"] !== undefined || set["portals.housing.secretKey"]) { set["portals.housing.lastPulledTo"] = null; set["portals.housing.lastError"] = ""; }
    if (set["portals.housing.enabled"]) {
      const org = await Organization.findById(req.orgId).select("portals.housing").lean();
      const id = set["portals.housing.profileId"] ?? org?.portals?.housing?.profileId;
      const key = set["portals.housing.secretKey"] || org?.portals?.housing?.secretKey;
      if (!id || !key) return res.status(400).json({ message: "Add the Housing.com ID and key first." });
    }
    await Organization.updateOne({ _id: req.orgId }, { $set: set });
    res.json(await settingsView(req));
  } catch (err) { res.status(500).json({ message: "Could not save the Housing.com settings." }); }
});

router.post("/settings/housing/pull", async (req, res) => {
  try {
    const r = await housing.pullOrg(req.orgId);
    if (!r.ok) return res.status(400).json({ message: r.error });
    res.json({ ...r, settings: await settingsView(req) });
  } catch (err) { res.status(500).json({ message: "Could not fetch from Housing.com." }); }
});

module.exports = router;
