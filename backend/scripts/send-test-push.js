/**
 * Sends ONE test push to a single device, to verify the notification icon and
 * tint render correctly. Deliberately targets one FCM token — never
 * sendPushToAll — so nobody else's phone buzzes during a UI check.
 *
 * Picks the most recently registered FCM token by default, which is the device
 * that most recently (re)installed the app. Pass a token to override.
 *
 * Run: railway run --service Arthaleads node backend/scripts/send-test-push.js [token]
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const PushSubscription = require("../models/PushSubscription");
  require("../models/User");   // populate("userId") needs the model registered

  let token = process.argv[2];
  if (!token) {
    const sub = await PushSubscription.findOne({ type: "fcm", fcmToken: { $ne: null } })
      .sort({ updatedAt: -1 })
      .populate("userId", "name")
      .lean();
    if (!sub) { console.log("No FCM subscription found."); await mongoose.disconnect(); return; }
    token = sub.fcmToken;
    console.log(`Newest FCM registration: ${sub.userId?.name || "?"}  (updated ${sub.updatedAt?.toISOString()})`);
  }
  console.log(`token …${token.slice(-10)}`);

  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }

  const res = await admin.messaging().send({
    token,
    notification: { title: "Icon check", body: "Status-bar icon should be the orange A." },
    data: { type: "test", url: "/leads" },
    android: {
      priority: "high",
      notification: {
        channelId: "leads",
        sound: "default",
        icon: "ic_notification",
        color: "#FF6B00",
        priority: "max",
      },
    },
  });

  console.log("sent:", res);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
