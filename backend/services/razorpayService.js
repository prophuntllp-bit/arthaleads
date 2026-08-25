// services/razorpayService.js
// Thin wrapper over the Razorpay SDK plus the two signature checks that keep
// the money path honest. Everything security-relevant lives here so there is
// one place to audit.

const crypto = require("crypto");
const Razorpay = require("razorpay");
const logger = require("../config/logger");

let client = null;

function getClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    const err = new Error("Online payment is not configured.");
    err.status = 503;
    throw err;
  }
  if (!client) client = new Razorpay({ key_id, key_secret });
  return client;
}

const isConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/** True while the account is on test keys — surfaced in the UI so nobody
 *  mistakes a test payment for a real one. */
const isTestMode = () => String(process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_");

async function createOrder({ amountPaise, currency = "INR", receipt, notes }) {
  const rzp = getClient();
  return rzp.orders.create({
    amount: amountPaise,   // Razorpay works in paise, never rupees
    currency,
    receipt,
    notes,
    payment_capture: 1,    // capture immediately; no manual capture step
  });
}

/**
 * Verify the handshake the browser hands back after Checkout succeeds.
 * Signature is HMAC-SHA256 of "<order_id>|<payment_id>" keyed with the API
 * secret. This proves the browser is not making the success up.
 *
 * It is NOT the source of truth for granting a term — the webhook is. A
 * browser can always close before this fires.
 */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

/**
 * Verify a webhook. Different key from the checkout signature — this one is
 * HMAC-SHA256 of the RAW request body keyed with the webhook secret set in the
 * Razorpay dashboard. The body must be the untouched bytes; re-serialising a
 * parsed object changes key order and whitespace and the digest will not match.
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[billing] RAZORPAY_WEBHOOK_SECRET is not set — webhooks cannot be verified and are being rejected.");
      return false;
    }
    logger.warn("[billing] RAZORPAY_WEBHOOK_SECRET not set — webhook signature check skipped (dev only).");
    return true;
  }
  if (!signature || !rawBody) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

// Constant-time compare, length-guarded — timingSafeEqual throws on a length
// mismatch, which would itself leak information through the error path.
function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

module.exports = {
  getClient, isConfigured, isTestMode,
  createOrder, verifyCheckoutSignature, verifyWebhookSignature,
};
