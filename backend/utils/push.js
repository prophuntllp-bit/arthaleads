// utils/push.js — unified push: Web Push (browser/PWA) + FCM (Capacitor Android APK)
const webPush = require("web-push");
const PushSubscription = require("../models/PushSubscription");
const logger = require("../config/logger");

// ── Web Push (VAPID) ──────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:info@arthaleads.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── Firebase Admin (FCM) ──────────────────────────────────────────────────────
let _fcmReady = false;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(svc) });
    }
    _fcmReady = true;
    logger.info("[push] Firebase Admin SDK ready — FCM enabled");
  } catch (e) {
    logger.warn("[push] Firebase Admin init failed:", e.message);
  }
}

// Build one FCM message object for a single device token
function _fcmMessage(token, payload) {
  return {
    token,
    notification: {
      title: payload.title || "Arthaleads",
      body:  payload.body  || "",
    },
    // All data values must be strings for FCM
    data: Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: "high",   // wakes the screen immediately
      notification: {
        channelId: "leads",   // must match channel created in capacitorPush.js
        sound:     "default",
        icon:      "ic_notification",
        priority:  "max",
      },
    },
  };
}

// Send FCM to a list of tokens; automatically prunes expired tokens
async function _sendFcm(tokens, payload) {
  if (!_fcmReady || !tokens.length) return;
  const admin = require("firebase-admin");
  try {
    const resp = await admin.messaging().sendEach(tokens.map((t) => _fcmMessage(t, payload)));
    const expired = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          expired.push(tokens[i]);
        } else {
          logger.warn(`[push] FCM error for token …${tokens[i].slice(-8)}: ${code}`);
        }
      }
    });
    if (expired.length) {
      await PushSubscription.deleteMany({ fcmToken: { $in: expired } });
      logger.info(`[push] FCM pruned ${expired.length} expired token(s)`);
    }
    const sent = resp.responses.filter((r) => r.success).length;
    logger.info(`[push] FCM sent ${sent}/${tokens.length}`);
  } catch (err) {
    logger.warn("[push] FCM sendEach failed:", err.message);
  }
}

/**
 * Send push to every subscriber in an org (or all orgs if orgId omitted).
 * Sends to both Web Push (browser/PWA) and FCM (Capacitor APK) subscribers.
 */
async function sendPushToAll(payload, orgId) {
  const filter = orgId ? { orgId } : {};
  const subs = await PushSubscription.find(filter);

  const webSubs = subs.filter((s) => s.type !== "fcm" && s.endpoint);
  const fcmSubs = subs.filter((s) => s.type === "fcm" && s.fcmToken);

  // ── Web Push ────────────────────────────────────────────────────────────────
  if (process.env.VAPID_PUBLIC_KEY && webSubs.length) {
    const results = await Promise.allSettled(
      webSubs.map((sub) =>
        webPush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        ).catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
          throw err;
        })
      )
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    logger.info(`[push] WebPush sent ${sent}/${webSubs.length}${orgId ? ` (org: ${orgId})` : ""}`);
  }

  // ── FCM ─────────────────────────────────────────────────────────────────────
  await _sendFcm(fcmSubs.map((s) => s.fcmToken), payload);
}

/**
 * Send push to a specific user only (all their registered devices/browsers).
 */
async function sendPushToUser(userId, payload) {
  const subs = await PushSubscription.find({ userId });
  if (!subs.length) return;

  const webSubs = subs.filter((s) => s.type !== "fcm" && s.endpoint);
  const fcmSubs = subs.filter((s) => s.type === "fcm" && s.fcmToken);

  // ── Web Push ────────────────────────────────────────────────────────────────
  if (process.env.VAPID_PUBLIC_KEY && webSubs.length) {
    await Promise.allSettled(
      webSubs.map((sub) =>
        webPush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        ).catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
          throw err;
        })
      )
    );
  }

  // ── FCM ─────────────────────────────────────────────────────────────────────
  await _sendFcm(fcmSubs.map((s) => s.fcmToken), payload);
}

module.exports = { sendPushToAll, sendPushToUser };
