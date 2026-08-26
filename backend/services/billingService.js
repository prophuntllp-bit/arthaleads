// services/billingService.js
// Turning a successful payment into entitlement.
//
// Both the browser callback and the Razorpay webhook funnel through
// applyPayment, so a term is granted the same way regardless of which arrives
// first — and, because Razorpay retries webhooks, exactly once.

const Payment = require("../models/Payment");
const Organization = require("../models/Organization");
const logger = require("../config/logger");
const { termEnd } = require("../constants/planPricing");
const { istDateKey } = require("../utils/datetime");

/**
 * Grant the purchased term to the organisation.
 *
 * Idempotent by construction: the update that stamps appliedAt is conditional
 * on appliedAt still being null, so only the first caller to win that race
 * does the entitlement work. A retried webhook takes the already-applied
 * branch and returns without extending the term a second time.
 *
 * Returns { applied, payment } — applied:false means "already done", which is
 * a success case, not an error.
 */
async function applyPayment(razorpayOrderId, razorpayPaymentId) {
  const claimed = await Payment.findOneAndUpdate(
    { razorpayOrderId, appliedAt: null },
    { $set: { appliedAt: new Date(), razorpayPaymentId, status: "paid" } },
    { new: true }
  );

  if (!claimed) {
    const existing = await Payment.findOne({ razorpayOrderId }).lean();
    if (!existing) {
      logger.warn(`[billing] payment for unknown order ${razorpayOrderId} — ignoring`);
      return { applied: false, payment: null, unknown: true };
    }
    logger.info(`[billing] order ${razorpayOrderId} already applied — no double credit`);
    return { applied: false, payment: existing };
  }

  // Extend from whichever is later: today, or an existing paid-through date.
  // Renewing early should add to the term, not truncate it.
  const org = await Organization.findById(claimed.orgId).select("paidUntil").lean();
  const startFrom = org?.paidUntil && new Date(org.paidUntil) > new Date()
    ? new Date(org.paidUntil)
    : new Date();
  const paidUntil = termEnd(claimed.cycle, startFrom);

  await Organization.findByIdAndUpdate(claimed.orgId, {
    $set: {
      plan: claimed.plan,
      seats: claimed.seats,
      billingCycle: claimed.cycle,
      paidUntil,
      // A paid org is no longer on a trial clock. Left set, the auth
      // middleware's trial-expiry check would still be evaluating a stale date.
      trialEndsAt: null,
    },
  });

  await Payment.findByIdAndUpdate(claimed._id, { $set: { paidUntil } });

  logger.info(
    `[billing] org ${claimed.orgId} → ${claimed.plan}, ${claimed.seats} seats, ` +
    `${claimed.cycle}, paid until ${istDateKey(paidUntil)}`
  );

  return { applied: true, payment: { ...claimed.toObject(), paidUntil } };
}

async function markFailed(razorpayOrderId, reason) {
  await Payment.findOneAndUpdate(
    { razorpayOrderId, status: "created" },
    { $set: { status: "failed", failureReason: String(reason || "").slice(0, 300) } }
  );
}

module.exports = { applyPayment, markFailed };
