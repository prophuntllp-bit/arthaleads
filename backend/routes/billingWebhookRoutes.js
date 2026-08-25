// routes/billingWebhookRoutes.js — Razorpay server-to-server webhook.
//
// Mounted in server.js BEFORE express.json(), because the signature is computed
// over the raw request bytes. Re-serialising a parsed object changes key order
// and whitespace, and the digest stops matching — the same reason the Facebook
// webhook is mounted early.
//
// This is the authoritative path to entitlement. The browser callback in
// billingRoutes.js is a convenience so the user sees an immediate result; a
// browser can be closed between paying and calling back, and this still lands.

const express = require("express");
const router = express.Router();
const logger = require("../config/logger");
const rzp = require("../services/razorpayService");
const { applyPayment, markFailed } = require("../services/billingService");

// Capture the untouched bytes for signature verification. express.json's verify
// hook runs before parsing, so req.rawBody is the exact payload Razorpay signed.
router.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => { req.rawBody = buf; },
  })
);

router.post("/", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!rzp.verifyWebhookSignature(req.rawBody, signature)) {
    logger.warn("[billing webhook] invalid signature — rejected");
    return res.status(400).json({ success: false });
  }

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity;

  // Acknowledge fast and unconditionally for events we do not act on. Razorpay
  // retries anything that is not 2xx, and retrying an event we will never
  // handle achieves nothing.
  if (!entity) {
    logger.info(`[billing webhook] ${event} — no payment entity, acknowledged`);
    return res.json({ success: true });
  }

  const orderId = entity.order_id;
  const paymentId = entity.id;

  try {
    if (event === "payment.captured") {
      const result = await applyPayment(orderId, paymentId);
      logger.info(
        `[billing webhook] payment.captured ${paymentId} for order ${orderId} — ` +
        (result.unknown ? "unknown order" : result.applied ? "term granted" : "already applied")
      );
    } else if (event === "payment.failed") {
      await markFailed(orderId, entity.error_description || entity.error_reason);
      logger.info(`[billing webhook] payment.failed for order ${orderId}: ${entity.error_description || "no reason given"}`);
    } else {
      logger.info(`[billing webhook] ${event} — acknowledged, no action`);
    }

    res.json({ success: true });
  } catch (err) {
    // 500 asks Razorpay to retry, which is what we want for a transient
    // database failure — applyPayment is idempotent, so a retry is safe.
    logger.error(`[billing webhook] handling ${event} failed: ${err.message}`);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
