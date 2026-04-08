// utils/push.js — Web Push helper
const webPush = require("web-push");
const PushSubscription = require("../models/PushSubscription");
const logger = require("../config/logger");

webPush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:info@prophuntllp.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send push notification to all stored subscriptions.
 * Silently removes expired/invalid subscriptions (410 Gone).
 */
async function sendPushToAll(payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const subs = await PushSubscription.find({});
  const results = await Promise.allSettled(
    subs.map((sub) =>
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
  logger.info(`Push sent to ${sent}/${subs.length} subscribers`);
}

/**
 * Send push notification to a specific user only.
 */
async function sendPushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const subs = await PushSubscription.find({ userId });
  if (!subs.length) return;

  await Promise.allSettled(
    subs.map((sub) =>
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

module.exports = { sendPushToAll, sendPushToUser };
