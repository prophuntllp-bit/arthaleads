const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const PushSubscription = require("../models/PushSubscription");

// GET /api/push/vapid-public-key — used by frontend to subscribe
router.get("/vapid-public-key", (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || "" });
});

// POST /api/push/subscribe — save a browser push subscription
router.post("/subscribe", protect, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: "Invalid subscription object" });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user._id, orgId: req.user.orgId, endpoint, keys },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/push/subscribe — remove a subscription
router.delete("/subscribe", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
