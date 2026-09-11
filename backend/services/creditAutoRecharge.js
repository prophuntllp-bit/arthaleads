// services/creditAutoRecharge.js
//
// Warns an org before its WhatsApp credits run out.
//
// A note on what this deliberately does NOT do: it does not charge anyone's
// card. Auto-debiting in India needs a saved Razorpay mandate (UPI Autopay or
// an e-mandate), which carries its own RBI rules — explicit authorisation,
// a pre-debit notification 24 hours ahead, and additional-factor auth above
// ₹15,000. That is a separate build with real compliance surface, and
// pretending to have it would be worse than not having it: a tenant who
// believes their balance tops itself up will find out otherwise mid-campaign.
//
// So the setting is honest about being an alert, and the charge step is left
// as a clearly marked hole rather than a half-working shortcut.

const Organization = require("../models/Organization");
const User         = require("../models/User");
const credits      = require("./creditService");
const { sendLowCreditEmail } = require("../utils/email");
const logger       = require("../config/logger");

// Do not mail the same org more often than this. A tenant sitting just under
// their threshold for a week should get one nudge, not seven.
const RENOTIFY_AFTER_MS = 24 * 60 * 60 * 1000;

async function runLowCreditSweep() {
  const orgs = await Organization.find({
    "whatsapp.enabled": true,
    "credits.autoRecharge.enabled": true,
    isActive: true,
  }).select("name credits whatsapp.notifyOn.lowCredits").lean();

  let notified = 0, cleared = 0, skipped = 0;

  for (const org of orgs) {
    const c = org.credits || {};
    const available = Math.max(0, (c.balancePaise || 0) - (c.reservedPaise || 0));
    const threshold = c.autoRecharge?.thresholdPaise || 0;

    // Back above the line — clear the marker so the next dip alerts again
    // rather than being swallowed by the 24h debounce.
    if (available > threshold) {
      if (c.lowBalanceNotifiedAt) {
        await Organization.updateOne({ _id: org._id }, { $unset: { "credits.lowBalanceNotifiedAt": "" } });
        cleared++;
      }
      continue;
    }

    const lastAt = c.lowBalanceNotifiedAt ? new Date(c.lowBalanceNotifiedAt).getTime() : 0;
    if (Date.now() - lastAt < RENOTIFY_AFTER_MS) { skipped++; continue; }

    // Only admins can top up, so only admins get told — notifyOn.lowCredits
    // can narrow that to specific admins, never widen it past that role.
    const notifyIds = (org.whatsapp?.notifyOn?.lowCredits || []).map(String);
    const adminQuery = { orgId: org._id, role: "admin", isActive: true };
    if (notifyIds.length) adminQuery._id = { $in: notifyIds };
    const admins = await User.find(adminQuery).select("name email").lean();
    if (!admins.length) { skipped++; continue; }

    const serviceRate = credits.rateFor(org, "service");
    const freeLeft = freeRepliesLeft(c);
    const repliesLeft = serviceRate > 0
      ? Math.floor(available / serviceRate) + freeLeft
      : freeLeft;

    const payload = {
      orgName: org.name,
      balanceRupees: (available / 100).toFixed(2),
      thresholdRupees: (threshold / 100).toFixed(2),
      repliesLeft: repliesLeft.toLocaleString("en-IN"),
    };

    let sentAny = false;
    for (const admin of admins) {
      if (!admin.email) continue;
      try {
        await sendLowCreditEmail(admin.email, admin.name, payload);
        sentAny = true;
      } catch (err) {
        logger.error(`[credits] low-balance email to ${admin.email} failed: ${err.message}`);
      }
    }

    // Only stamp the marker when something actually went out, otherwise a
    // mail outage silently costs the org its one warning.
    if (sentAny) {
      await Organization.updateOne(
        { _id: org._id },
        { $set: { "credits.lowBalanceNotifiedAt": new Date() } }
      );
      notified++;
      logger.info(`[credits] low-balance warning sent to ${org.name} — ${payload.balanceRupees} left`);
    }
  }

  return { checked: orgs.length, notified, cleared, skipped };
}

/** Meta's free service allowance still unused this calendar month (UTC). */
function freeRepliesLeft(c) {
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const fs = c.freeService || {};
  const used = fs.yyyymm === yyyymm ? (fs.used || 0) : 0;
  return Math.max(0, credits.FREE_SERVICE_PER_MONTH - used);
}

module.exports = { runLowCreditSweep, RENOTIFY_AFTER_MS };
