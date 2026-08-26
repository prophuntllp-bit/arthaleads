// services/subscriptionExpiry.js
// Downgrades organisations whose paid term ran out more than GRACE_DAYS ago.
//
// This runs once a day from the scheduler rather than on the request path.
// Checking on every request would mean a write inside auth middleware, and the
// commercial difference between downgrading at 03:45 and downgrading at the
// exact minute of expiry is nil.

const Organization = require("../models/Organization");
const logger = require("../config/logger");
const { GRACE_DAYS, LAPSED_PLAN } = require("../constants/planPricing");

async function downgradeLapsedSubscriptions() {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86400000);

  // Only orgs that actually bought something and are still on a paid plan.
  // Enterprise is invoiced manually and negotiated, so it is never swept up by
  // an automated downgrade — a missed invoice there is a conversation, not a
  // switch to flip.
  const lapsed = await Organization.find({
    paidUntil: { $ne: null, $lt: cutoff },
    plan: { $in: ["starter", "growth", "pro"] },
  }).select("name plan seats paidUntil").lean();

  if (!lapsed.length) return { checked: 0, downgraded: 0 };

  let downgraded = 0;
  for (const org of lapsed) {
    if (org.plan === LAPSED_PLAN) continue;   // already there, nothing to do

    await Organization.findByIdAndUpdate(org._id, {
      $set: { plan: LAPSED_PLAN, lapsedAt: new Date() },
      // Purchased seats no longer apply once the term has lapsed; clearing it
      // makes seatLimitFor fall back to the plan's own cap.
      $unset: { seats: "", billingCycle: "" },
    });

    downgraded++;
    logger.info(
      `[billing] ${org.name} lapsed — paid until ${new Date(org.paidUntil).toISOString().slice(0, 10)}, ` +
      `${org.plan} -> ${LAPSED_PLAN}`
    );
  }

  return { checked: lapsed.length, downgraded };
}

module.exports = { downgradeLapsedSubscriptions };
