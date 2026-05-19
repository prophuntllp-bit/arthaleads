const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const PushSubscription = require("../models/PushSubscription");

// GET /api/push/vapid-public-key - requires auth; VAPID key is fetched after login
router.get("/vapid-public-key", protect, (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || "" });
});

// POST /api/push/subscribe - save a browser push subscription
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

// DELETE /api/push/subscribe - remove a subscription (scoped to current user)
router.delete("/subscribe", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    // Include userId so a user can only delete their own subscriptions
    await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
