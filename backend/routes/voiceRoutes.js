// routes/voiceRoutes.js
// External API for AI voice platform integration
// Auth: X-Api-Key header or ?api_key= query param (set VOICE_API_KEY in Railway)

const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const apiKeyAuth = require("../middlewares/apiKey");

router.use(apiKeyAuth);

// GET /api/voice/leads?campaign_id=joyville&limit=5
// campaign_id maps to leadSourceLabel or source field
router.get("/leads", async (req, res) => {
  try {
    const { campaign_id, limit = 20, page = 1, status, phone } = req.query;

    const filter = { isDeleted: { $ne: true }, isArchived: false };

    if (campaign_id && campaign_id !== "preview") {
      filter.$or = [
        { leadSourceLabel: { $regex: campaign_id, $options: "i" } },
        { source: { $regex: campaign_id, $options: "i" } },
      ];
    }

    if (status) filter.status = status;
    if (phone) filter.phone = { $regex: phone.replace(/\D/g, ""), $options: "i" };

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
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/voice/leads/search?phone=9876543210
router.get("/leads/search", async (req, res) => {
  try {
    const { phone, name, email } = req.query;

    if (!phone && !name && !email) {
      return res.status(400).json({ success: false, message: "Provide at least one of: phone, name, email" });
    }

    const filter = { isDeleted: { $ne: true } };
    const orConditions = [];

    if (phone) {
      const digits = phone.replace(/\D/g, "");
      orConditions.push({ phone: { $regex: digits, $options: "i" } });
    }
    if (name) orConditions.push({ name: { $regex: name, $options: "i" } });
    if (email) orConditions.push({ email: { $regex: email, $options: "i" } });

    if (orConditions.length) filter.$or = orConditions;

    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name phone email status source leadSourceLabel priority assignedToName createdAt followUpDate remark notes");

    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select("name phone email status remark priority followUpDate assignedToName updatedAt");

    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
