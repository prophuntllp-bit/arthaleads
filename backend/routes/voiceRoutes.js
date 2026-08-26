// routes/voiceRoutes.js
// External API for AI voice platform integration
// Auth: X-Api-Key header or ?api_key= query param (set VOICE_API_KEY in Railway)
// Org scope: set VOICE_ORG_ID in Railway env, or pass ?org_id= / X-Org-Id header

const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const { findLeadById, searchBothLeadTypes } = require("../utils/leadLookup");
const apiKeyAuth = require("../middlewares/apiKey");

router.use(apiKeyAuth);

// ── Org-scope middleware ───────────────────────────────────────────────────────
// Which organisation's leads this request may read is decided here, and only
// ever from something the caller cannot choose.
//
// A per-org key identifies its own org through the key lookup. The legacy
// global key does not, so it falls back to VOICE_ORG_ID — a server-side
// environment variable — and nothing else.
//
// It previously also accepted X-Org-Id and ?org_id, which meant any holder of
// the global key could read every tenant's leads by changing one header.
router.use((req, res, next) => {
  if (req.orgId) {
    // Per-org key path: org comes from the key lookup.
    req.voiceOrgId = req.orgId;
    return next();
  }

  // Legacy global key path. Deprecated — issue per-org keys and unset
  // VOICE_API_KEY to remove this branch entirely.
  const orgId = process.env.VOICE_ORG_ID;
  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: "Generate a per-org API key via Arthaleads Settings → Voice Integration.",
    });
  }

  if (req.headers["x-org-id"] || req.query.org_id) {
    console.warn("[voice] ignoring caller-supplied org id on the legacy global-key path");
  }

  req.voiceOrgId = orgId;
  next();
});

// GET /api/voice/leads?campaign_id=joyville&limit=5
// campaign_id maps to leadSourceLabel or source field
router.get("/leads", async (req, res) => {
  try {
    const { campaign_id, limit = 20, page = 1, status, phone } = req.query;

    const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = { orgId: req.voiceOrgId, isDeleted: { $ne: true }, isArchived: { $ne: true } };

    if (campaign_id && campaign_id !== "preview") {
      const safe = escRx(campaign_id);
      filter.$or = [
        { leadSourceLabel: { $regex: safe, $options: "i" } },
        { source: { $regex: safe, $options: "i" } },
      ];
    }

    if (status) filter.status = status;
    if (phone) filter.phone = { $regex: escRx(phone.replace(/\D/g, "")), $options: "i" };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("name phone email status source leadSourceLabel priority assignedToName createdAt followUpDate notes"),
      Lead.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      leads,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/voice/leads/search?phone=9876543210
router.get("/leads/search", async (req, res) => {
  try {
    const { phone, name, email } = req.query;

    if (!phone && !name && !email) {
      return res.status(400).json({ success: false, message: "Provide at least one of: phone, name, email" });
    }

    const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = { orgId: req.voiceOrgId, isDeleted: { $ne: true } };
    const orConditions = [];

    if (phone) {
      const digits = escRx(phone.replace(/\D/g, ""));
      orConditions.push({ phone: { $regex: digits, $options: "i" } });
    }
    if (name) orConditions.push({ name: { $regex: escRx(name), $options: "i" } });
    if (email) orConditions.push({ email: { $regex: escRx(email), $options: "i" } });

    if (orConditions.length) filter.$or = orConditions;

    // Searches project leads too. This endpoint only IDENTIFIES an existing
    // contact (e.g. matching an inbound caller), so widening it places no calls
    // — unlike GET /leads above, which feeds the outbound call list and is
    // deliberately left to regular Leads.
    const SELECT = "name phone email status source leadSourceLabel priority assignedToName createdAt followUpDate remark notes";
    const leads = (await searchBothLeadTypes(filter, { select: SELECT, limit: 10 }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PATCH /api/voice/leads/:id
// Update lead fields (status, remark, followUpDate, etc.)
router.patch("/leads/:id", async (req, res) => {
  try {
    const allowed = ["status", "remark", "remark1", "remark2", "priority", "followUpDate", "booking", "assignedToName"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    // Resolve which collection this id belongs to first — /leads/search can now
    // return a project lead, so updating one must not 404.
    const { Model } = await findLeadById(req.params.id, req.voiceOrgId, { lean: true, select: "_id" });
    if (!Model) return res.status(404).json({ success: false, message: "Lead not found" });

    // Scope update to org so the voice platform can't mutate other tenants' leads
    const lead = await Model.findOneAndUpdate(
      { _id: req.params.id, orgId: req.voiceOrgId },
      { $set: update },
      { new: true, runValidators: true }
    ).select("name phone email status remark priority followUpDate assignedToName updatedAt");

    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
