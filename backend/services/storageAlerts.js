// services/storageAlerts.js
// Tells an org's admins when its file space reaches 80% and again when it is
// full, by push notification and email. Each level is sent once: the level
// reached is remembered on the org (storage.alertLevel) and clears when usage
// drops back under 80%, so a customer sitting at 85% is not nagged every day.
// The in-app card and warning popup are driven by GET /org/storage instead.

const Organization = require("../models/Organization");
const User = require("../models/User");
const logger = require("../config/logger");
const { summaryFor } = require("../utils/storageLedger");
const { sendPushToUser } = require("../utils/push");
const { sendStorageWarningEmail } = require("../utils/email");

const levelOf = (s) => (s.full ? 100 : s.warn ? 80 : 0);

async function checkOrg(orgId) {
  const org = await Organization.findById(orgId).select("name plan storage isActive").lean();
  if (!org || org.isActive === false) return null;
  const s = await summaryFor(org);
  const level = levelOf(s);
  const sent = org.storage?.alertLevel || 0;

  if (level === sent) return { level, notified: false };
  // Claim the level first so two uploads finishing together send one message.
  const claimed = await Organization.updateOne(
    { _id: org._id, "storage.alertLevel": sent === 0 ? { $in: [0, null] } : sent },
    { $set: { "storage.alertLevel": level } }
  );
  if (!claimed.modifiedCount) return { level, notified: false };
  if (level < sent || level === 0) return { level, notified: false };   // usage fell: remembered, nothing to say

  const admins = await User.find({ orgId: org._id, role: "admin", isActive: true }).select("name email").lean();
  const pct = Math.round(s.percent);
  const body = level === 100
    ? "Your file space is full. New photos, PDFs and videos can't be uploaded until you free space or add more."
    : `You've used ${pct}% of your file space. Free some up or add more before it fills.`;
  for (const a of admins) {
    sendPushToUser(a._id, { title: level === 100 ? "File space is full" : "File space almost full", body, data: { url: "/plans" } }).catch(() => {});
    sendStorageWarningEmail(a.email, a.name, { orgName: org.name, percent: pct, full: level === 100, usedBytes: s.usedBytes, limitBytes: s.limitBytes }).catch(() => {});
  }
  logger.info(`[storage] ${org.name} reached ${level}% level, notified ${admins.length} admin(s)`);
  return { level, notified: true };
}

/** Daily: catches orgs whose usage changed without an upload (removals, plan changes, extra space). */
async function sweep() {
  const orgs = await Organization.find({ isActive: { $ne: false } }).select("_id").lean();
  let notified = 0;
  for (const o of orgs) {
    try { if ((await checkOrg(o._id))?.notified) notified++; }
    catch (err) { logger.warn(`[storage] alert check failed for ${o._id}: ${err.message}`); }
  }
  return { checked: orgs.length, notified };
}

module.exports = { checkOrg, sweep };
