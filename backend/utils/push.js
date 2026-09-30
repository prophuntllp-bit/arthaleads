// utils/push.js — unified push: Web Push (browser/PWA) + FCM (Capacitor Android APK)
const webPush = require("web-push");
const PushSubscription = require("../models/PushSubscription");
const User = require("../models/User");
const Organization = require("../models/Organization");
const logger = require("../config/logger");

// A PushSubscription row is created on login and only ever deleted by an
// explicit client-side unsubscribe call (logout, or an expired token
// bouncing) — nothing removes it when the user is deactivated or the org's
// plan lapses. Without this, a deactivated user (or an entire org whose
// renewal expired) keeps getting every notification indefinitely, on
// whatever device they were last logged into, for as long as that device
// keeps running — the actual reported bug. Checked at send time, every
// time, rather than trusting cleanup to have happened somewhere upstream.
async function _filterActive(subs) {
  if (!subs.length) return [];
  const userIds = [...new Set(subs.map((s) => String(s.userId)).filter(Boolean))];
  const orgIds  = [...new Set(subs.map((s) => String(s.orgId)).filter(Boolean))];
  const [activeUsers, activeOrgs] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds }, isActive: { $ne: false } }).select("_id").lean() : [],
    orgIds.length  ? Organization.find({ _id: { $in: orgIds }, isActive: { $ne: false } }).select("_id").lean() : [],
  ]);
  const activeUserSet = new Set(activeUsers.map((u) => String(u._id)));
  const activeOrgSet  = new Set(activeOrgs.map((o) => String(o._id)));
  return subs.filter((s) =>
    activeUserSet.has(String(s.userId)) && (!s.orgId || activeOrgSet.has(String(s.orgId)))
  );
}

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
        // Android strips all colour from a small icon and tints the silhouette
        // instead. With no colour supplied it uses its own grey, which is why
        // the status-bar icon looked like a dull grey "A" rather than ours.
        color:     "#FF6B00",
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
 * Send push to every active subscriber in an org.
 * Sends to both Web Push (browser/PWA) and FCM (Capacitor APK) subscribers.
 */
async function sendPushToAll(payload, orgId) {
  // orgId is not optional — every caller in this codebase already passes
  // one, and dropping it used to mean "broadcast to literally every org on
  // the platform," a footgun nothing was actually using but that a single
  // future forgotten argument would have silently triggered.
  if (!orgId) { logger.warn("[push] sendPushToAll called without an orgId — refusing to broadcast platform-wide"); return; }
  const subs = await _filterActive(await PushSubscription.find({ orgId }));

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
  const subs = await _filterActive(await PushSubscription.find({ userId }));
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
