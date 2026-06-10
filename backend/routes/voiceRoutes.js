// routes/voiceRoutes.js
// External API for AI voice platform integration
// Auth: X-Api-Key header or ?api_key= query param (set VOICE_API_KEY in Railway)
// Org scope: set VOICE_ORG_ID in Railway env, or pass ?org_id= / X-Org-Id header

const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const apiKeyAuth = require("../middlewares/apiKey");

router.use(apiKeyAuth);

// ── Org-scope middleware ───────────────────────────────────────────────────────
// Every voice route must be scoped to a single org to prevent cross-tenant leaks.
// Priority: X-Org-Id header > ?org_id param > VOICE_ORG_ID env var
router.use((req, res, next) => {
  const orgId = req.headers["x-org-id"] || req.query.org_id || process.env.VOICE_ORG_ID;
  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: "org_id is required. Pass X-Org-Id header, ?org_id= param, or set VOICE_ORG_ID env var.",
    });
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

    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name phone email status source leadSourceLabel priority assignedToName createdAt followUpDate remark notes");

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

    // Scope update to org so the voice platform can't mutate other tenants' leads
    const lead = await Lead.findOneAndUpdate(
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
