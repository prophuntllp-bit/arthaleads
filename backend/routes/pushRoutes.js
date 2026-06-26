const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const PushSubscription = require("../models/PushSubscription");

// GET /api/push/vapid-public-key
router.get("/vapid-public-key", protect, (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || "" });
});

// POST /api/push/subscribe — save a browser Web Push subscription (PWA / desktop)
router.post("/subscribe", protect, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: "Invalid subscription object" });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user._id, orgId: req.user.orgId, endpoint, keys, type: "webpush" },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/push/subscribe — remove a Web Push subscription
router.delete("/subscribe", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/push/fcm-token — register an FCM device token (Capacitor Android APK)
// Called automatically on app start after the user is authenticated.
router.post("/fcm-token", protect, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "FCM token required" });

    await PushSubscription.findOneAndUpdate(
      { fcmToken: token },
      {
        userId:   req.user._id,
        orgId:    req.user.orgId,
        fcmToken: token,
        type:     "fcm",
        platform: platform || "android",
      },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/push/fcm-token — unregister an FCM token on logout
router.delete("/fcm-token", protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      await PushSubscription.deleteOne({ fcmToken: token, userId: req.user._id });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
