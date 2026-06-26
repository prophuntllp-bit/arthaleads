const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orgId:    { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },

  // "webpush" = browser Web Push (VAPID), "fcm" = Firebase Cloud Messaging (Capacitor APK)
  type:     { type: String, enum: ["webpush", "fcm"], default: "webpush" },

  // ── Web Push fields (type = "webpush") ──────────────────────────────────────
  endpoint: { type: String },
  keys: {
    p256dh: { type: String },
    auth:   { type: String },
  },

  // ── FCM fields (type = "fcm") ────────────────────────────────────────────────
  fcmToken: { type: String },
  platform: { type: String, default: "android" }, // "android" | "ios"

}, { timestamps: true });

// Sparse unique indexes — one record per endpoint (webpush) or fcmToken (fcm)
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true, sparse: true });
pushSubscriptionSchema.index({ fcmToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
