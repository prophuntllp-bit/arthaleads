// routes/billingRoutes.js — authenticated checkout endpoints.
// The Razorpay webhook lives in billingWebhookRoutes.js instead, because it
// needs the raw request body and so must mount before express.json().

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const logger = require("../config/logger");
const Payment = require("../models/Payment");
const Organization = require("../models/Organization");
const rzp = require("../services/razorpayService");
const { applyPayment } = require("../services/billingService");
const {
  quote, PLAN_PRICING, BILLABLE_PLANS,
  subscriptionState, GRACE_DAYS, LAPSED_PLAN,
} = require("../constants/planPricing");

router.use(protect);

// GET /api/billing/plans — what can be bought, and at what price.
// Serving this from the server keeps the checkout screen honest: the prices
// shown are the prices that will be charged, because both come from
// constants/planPricing.js.
router.get("/plans", async (req, res, next) => {
  try {
    res.json({
      success: true,
      configured: rzp.isConfigured(),
      testMode: rzp.isTestMode(),
      keyId: rzp.isConfigured() ? process.env.RAZORPAY_KEY_ID : null,
      plans: BILLABLE_PLANS.map((id) => ({ id, ...PLAN_PRICING[id] })),
    });
  } catch (err) { next(err); }
});

// GET /api/billing/me — current entitlement for the signed-in org, plus where
// it stands in the billing cycle so the UI can warn before access changes.
router.get("/me", async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId)
      .select("plan seats billingCycle paidUntil trialEndsAt cancelAtPeriodEnd lapsedAt").lean();
    if (!org) return res.status(404).json({ success: false, message: "Organisation not found" });
    res.json({
      success: true,
      billing: org,
      subscription: { ...subscriptionState(org), graceDays: GRACE_DAYS, lapsesTo: LAPSED_PLAN },
    });
  } catch (err) { next(err); }
});

// POST /api/billing/cancel — stop renewal reminders; keep access to term end.
//
// Terms are prepaid rather than a mandate, so there is no charge to stop and
// nothing to refund. Cancelling records the intent and suppresses the renewal
// nudges; the plan then lapses on its own via the daily sweep.
router.post("/cancel", authorize("admin"), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId).select("plan paidUntil").lean();
    if (!org) return res.status(404).json({ success: false, message: "Organisation not found" });
    if (!org.paidUntil) {
      return res.status(400).json({ success: false, message: "There is no active subscription to cancel." });
    }

    await Organization.findByIdAndUpdate(req.orgId, { $set: { cancelAtPeriodEnd: true } });
    logger.info(`[billing] org ${req.orgId} cancelled — access continues to ${new Date(org.paidUntil).toISOString().slice(0, 10)}`);

    const updated = await Organization.findById(req.orgId)
      .select("plan seats billingCycle paidUntil cancelAtPeriodEnd").lean();
    res.json({
      success: true,
      message: `Cancelled. You keep ${org.plan} until ${new Date(org.paidUntil).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`,
      billing: updated,
      subscription: { ...subscriptionState(updated), graceDays: GRACE_DAYS, lapsesTo: LAPSED_PLAN },
    });
  } catch (err) { next(err); }
});

// POST /api/billing/resume — undo a cancellation before the term ends.
router.post("/resume", authorize("admin"), async (req, res, next) => {
  try {
    await Organization.findByIdAndUpdate(req.orgId, { $set: { cancelAtPeriodEnd: false } });
    const updated = await Organization.findById(req.orgId)
      .select("plan seats billingCycle paidUntil cancelAtPeriodEnd").lean();
    res.json({
      success: true,
      message: "Subscription resumed.",
      billing: updated,
      subscription: { ...subscriptionState(updated), graceDays: GRACE_DAYS, lapsesTo: LAPSED_PLAN },
    });
  } catch (err) { next(err); }
});

// POST /api/billing/order — start a checkout.
// Body: { plan, seats, cycle }
//
// The amount is computed here from the plan and seat count and never read from
// the request. A client may say what it wants to buy; it does not get to say
// what that costs.
router.post("/order", authorize("admin"), async (req, res, next) => {
  try {
    if (!rzp.isConfigured()) {
      return res.status(503).json({ success: false, message: "Online payment is not configured yet." });
    }

    const { plan, seats, cycle } = req.body || {};
    let q;
    try {
      q = quote(plan, seats, cycle);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const org = await Organization.findById(req.orgId).select("name").lean();

    // Razorpay caps receipt at 40 characters.
    const receipt = `org_${String(req.orgId).slice(-8)}_${Date.now().toString(36)}`.slice(0, 40);

    const order = await rzp.createOrder({
      amountPaise: q.amountPaise,
      currency: q.currency,
      receipt,
      notes: {
        orgId: String(req.orgId),
        orgName: org?.name || "",
        plan: q.planId,
        seats: String(q.seats),
        cycle: q.cycle,
      },
    });

    await Payment.create({
      orgId: req.orgId,
      createdBy: req.user._id,
      plan: q.planId,
      seats: q.seats,
      cycle: q.cycle,
      rate: q.rate,
      gstRate: q.gstRate,
      amountPaise: q.amountPaise,
      currency: q.currency,
      razorpayOrderId: order.id,
      status: "created",
    });

    logger.info(`[billing] order ${order.id} created — org ${req.orgId}, ${q.planId} x${q.seats} ${q.cycle}, ₹${q.total}`);

    res.json({
      success: true,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      quote: q,
      keyId: process.env.RAZORPAY_KEY_ID,
      testMode: rzp.isTestMode(),
    });
  } catch (err) {
    logger.error(`[billing] order creation failed: ${err.message}`);
    next(err);
  }
});

// POST /api/billing/verify — the browser handing back a successful Checkout.
//
// This exists so the user gets an immediate answer. It is deliberately NOT the
// only path to entitlement: the webhook grants the term too, because a browser
// can be closed between payment and this call. Both are idempotent.
router.post("/verify", authorize("admin"), async (req, res, next) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!rzp.verifyCheckoutSignature({ orderId, paymentId, signature })) {
      logger.warn(`[billing] invalid checkout signature for order ${orderId} — rejected`);
      return res.status(400).json({ success: false, message: "Payment could not be verified." });
    }

    // Confirm the order belongs to the caller's org before granting anything —
    // a valid signature proves Razorpay saw the payment, not that this org owns it.
    const record = await Payment.findOne({ razorpayOrderId: orderId }).lean();
    if (!record) return res.status(404).json({ success: false, message: "Order not found." });
    if (String(record.orgId) !== String(req.orgId)) {
      logger.warn(`[billing] org ${req.orgId} tried to claim order ${orderId} belonging to ${record.orgId}`);
      return res.status(403).json({ success: false, message: "Order does not belong to this organisation." });
    }

    const result = await applyPayment(orderId, paymentId);
    const org = await Organization.findById(req.orgId)
      .select("plan seats billingCycle paidUntil").lean();

    res.json({ success: true, applied: result.applied, billing: org });
  } catch (err) { next(err); }
});

// GET /api/billing/history — past payments for this org.
router.get("/history", authorize("admin"), async (req, res, next) => {
  try {
    const payments = await Payment.find({ orgId: req.orgId, status: { $ne: "created" } })
      .select("plan seats cycle amountPaise currency status paidUntil createdAt razorpayPaymentId")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, payments });
  } catch (err) { next(err); }
});

module.exports = router;
