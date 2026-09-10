// services/creditTopUpService.js
//
// Buying WhatsApp credits. Mirrors services/billingService.js deliberately —
// same claim-then-act idempotency, same "the webhook is the source of truth,
// the browser callback is a convenience" rule. A browser can always be closed
// between paying and calling back.
//
// GST is charged once, here, on the purchase — never per message. Buying
// ₹1,000 of credit charges ₹1,180 and grants 100000 paise of balance. See
// docs/whatsapp-embedded-signup-plan.md Part 2.

const CreditOrder  = require("../models/CreditOrder");
const Organization = require("../models/Organization");
const rzp          = require("./razorpayService");
const credits      = require("./creditService");
const logger       = require("../config/logger");

const GST_RATE = 18;

// Minimum is deliberately low compared to the competitor's ₹1,500 — the point
// of the first top-up is to get a tenant sending, not to maximise float.
const MIN_TOPUP_PAISE = 50_000;      // ₹500
const MAX_TOPUP_PAISE = 5_000_000;   // ₹50,000 — above this, talk to sales

/** GST breakdown for a credit amount. All paise. */
function quoteTopUp(creditPaise) {
  const gstPaise = Math.round(creditPaise * (GST_RATE / 100));
  return {
    creditPaise,
    gstPaise,
    gstRate: GST_RATE,
    amountPaise: creditPaise + gstPaise,
  };
}

/**
 * Create a Razorpay order for a credit purchase.
 * Returns what the browser needs to open Checkout.
 */
async function createTopUpOrder({ orgId, userId, creditPaise }) {
  if (!Number.isInteger(creditPaise)) throw badRequest("Credit amount must be a whole number of paise");
  if (creditPaise < MIN_TOPUP_PAISE) throw badRequest(`Minimum top-up is ₹${MIN_TOPUP_PAISE / 100}`);
  if (creditPaise > MAX_TOPUP_PAISE) throw badRequest(`Maximum top-up is ₹${MAX_TOPUP_PAISE / 100}. Contact us for larger amounts.`);

  const q = quoteTopUp(creditPaise);
  const org = await Organization.findById(orgId).select("name").lean();
  if (!org) throw badRequest("Organisation not found");

  const rzpOrder = await rzp.createOrder({
    amountPaise: q.amountPaise,
    currency: "INR",
    // Razorpay caps receipt at 40 chars.
    receipt: `wac_${String(orgId).slice(-8)}_${Date.now().toString(36)}`,
    notes: {
      kind: "whatsapp_credits",
      orgId: String(orgId),
      orgName: org.name,
      creditPaise: String(q.creditPaise),
    },
  });

  const order = await CreditOrder.create({
    orgId,
    createdBy: userId,
    creditPaise: q.creditPaise,
    gstPaise: q.gstPaise,
    gstRate: q.gstRate,
    amountPaise: q.amountPaise,
    razorpayOrderId: rzpOrder.id,
  });

  logger.info(`[credits] org ${orgId} started top-up of ${q.creditPaise}p (charge ${q.amountPaise}p) order ${rzpOrder.id}`);

  return {
    orderId: rzpOrder.id,
    keyId: process.env.RAZORPAY_KEY_ID,
    testMode: rzp.isTestMode(),
    orgName: org.name,
    ...q,
    creditOrderId: order._id,
  };
}

/**
 * Grant the credit for a captured payment.
 *
 * Claim-then-act: the findOneAndUpdate only matches while appliedAt is still
 * null, so exactly one caller ever proceeds to grant — whether that is the
 * webhook, the browser callback, or a webhook retry racing both.
 *
 * Returns { applied } — applied:false means "already done", a success case.
 */
async function applyTopUp(razorpayOrderId, razorpayPaymentId) {
  const claimed = await CreditOrder.findOneAndUpdate(
    { razorpayOrderId, appliedAt: null },
    { $set: { appliedAt: new Date(), razorpayPaymentId, status: "paid" } },
    { new: true }
  );

  if (!claimed) {
    const existing = await CreditOrder.findOne({ razorpayOrderId }).lean();
    if (!existing) return { applied: false, unknown: true, order: null };
    logger.info(`[credits] order ${razorpayOrderId} already applied — no double credit`);
    return { applied: false, order: existing };
  }

  const newBalance = await credits.topUp(claimed.orgId, {
    amountPaise: claimed.creditPaise,
    gstPaise: claimed.gstPaise,
    razorpayPaymentId,
    note: `Top-up via Razorpay ${razorpayOrderId}`,
  });

  logger.info(`[credits] granted ${claimed.creditPaise}p to org ${claimed.orgId} — balance now ${newBalance}p`);
  return { applied: true, order: claimed, balancePaise: newBalance };
}

async function markFailed(razorpayOrderId, reason) {
  await CreditOrder.findOneAndUpdate(
    { razorpayOrderId, appliedAt: null },
    { $set: { status: "failed", failureReason: reason || "unknown" } }
  );
}

/** Is this Razorpay order one of ours? Lets the shared webhook dispatch. */
async function isCreditOrder(razorpayOrderId) {
  return Boolean(await CreditOrder.exists({ razorpayOrderId }));
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

module.exports = {
  GST_RATE,
  MIN_TOPUP_PAISE,
  MAX_TOPUP_PAISE,
  quoteTopUp,
  createTopUpOrder,
  applyTopUp,
  markFailed,
  isCreditOrder,
};
