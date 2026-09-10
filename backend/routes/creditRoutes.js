// routes/creditRoutes.js — WhatsApp credit balance, top-ups and statement.

const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const credits    = require("../services/creditService");
const topUp      = require("../services/creditTopUpService");
const rzp        = require("../services/razorpayService");
const CreditLedger = require("../models/CreditLedger");
const Organization = require("../models/Organization");
const logger     = require("../config/logger");

router.use(protect);

// ── Balance ───────────────────────────────────────────────────────────────────
// Any signed-in member can read it: an agent needs to know why the composer is
// disabled, even though only an admin can top up.
router.get("/balance", async (req, res) => {
  try {
    const [bal, org] = await Promise.all([
      credits.getBalance(req.orgId),
      Organization.findById(req.orgId).select("credits").lean(),
    ]);

    const rates = org?.credits?.sellRatesPaise || {};
    const fs = org?.credits?.freeService || {};
    const now = new Date();
    const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const freeUsed = fs.yyyymm === yyyymm ? (fs.used || 0) : 0;

    res.json({
      ...bal,
      ratesPaise: rates,
      freeService: {
        used: freeUsed,
        limit: credits.FREE_SERVICE_PER_MONTH,
        remaining: Math.max(0, credits.FREE_SERVICE_PER_MONTH - freeUsed),
      },
      autoRecharge: org?.credits?.autoRecharge || { enabled: false },
      // Roughly how many more replies they can send. The composer uses this to
      // warn before it hard-stops, which is friendlier than a 402 mid-sentence.
      serviceMessagesLeft: rates.service > 0
        ? Math.floor(bal.availablePaise / rates.service) + Math.max(0, credits.FREE_SERVICE_PER_MONTH - freeUsed)
        : null,
      paymentsConfigured: rzp.isConfigured(),
      minTopUpPaise: topUp.MIN_TOPUP_PAISE,
      gstRate: topUp.GST_RATE,
    });
  } catch (err) {
    logger.error(`[credits] balance failed: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

// ── Statement / usage ─────────────────────────────────────────────────────────
router.get("/ledger", async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const filter = { orgId: req.orgId };
    if (type) filter.type = type;

    const [rows, total] = await Promise.all([
      CreditLedger.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Math.min(+limit, 200))
        .lean(),
      CreditLedger.countDocuments(filter),
    ]);

    res.json({ rows, total, page: +page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Quote (no side effects) — powers the top-up modal's GST breakdown ────────
router.get("/topup/quote", authorize("admin", "super_admin"), (req, res) => {
  const creditPaise = parseInt(req.query.creditPaise, 10);
  if (!Number.isInteger(creditPaise) || creditPaise <= 0) {
    return res.status(400).json({ message: "creditPaise must be a positive integer" });
  }
  res.json(topUp.quoteTopUp(creditPaise));
});

// ── Start a top-up ────────────────────────────────────────────────────────────
// Admin only: this spends real money.
router.post("/topup/order", authorize("admin", "super_admin"), async (req, res) => {
  try {
    if (!rzp.isConfigured()) {
      return res.status(503).json({ message: "Online payment is not configured." });
    }
    const creditPaise = parseInt(req.body.creditPaise, 10);
    const out = await topUp.createTopUpOrder({
      orgId: req.orgId,
      userId: req.user._id,
      creditPaise,
    });
    res.json(out);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ── Browser callback after Checkout ───────────────────────────────────────────
// A convenience so the balance updates immediately. NOT the source of truth —
// the Razorpay webhook is, because a browser can be closed between paying and
// getting here. Both paths call applyTopUp, which grants exactly once.
router.post("/topup/verify", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!rzp.verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })) {
      logger.warn(`[credits] bad checkout signature for order ${razorpay_order_id}`);
      return res.status(400).json({ message: "Payment could not be verified." });
    }

    const result = await topUp.applyTopUp(razorpay_order_id, razorpay_payment_id);
    if (result.unknown) return res.status(404).json({ message: "Unknown order." });

    const bal = await credits.getBalance(req.orgId);
    res.json({ ok: true, applied: result.applied, ...bal });
  } catch (err) {
    logger.error(`[credits] verify failed: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

// ── Auto-recharge settings ────────────────────────────────────────────────────
router.patch("/auto-recharge", authorize("admin", "super_admin"), async (req, res) => {
  try {
    const { enabled, thresholdPaise, rechargePaise } = req.body || {};
    const update = {};
    if (enabled !== undefined) update["credits.autoRecharge.enabled"] = Boolean(enabled);
    if (thresholdPaise !== undefined) update["credits.autoRecharge.thresholdPaise"] = parseInt(thresholdPaise, 10);
    if (rechargePaise !== undefined) {
      const amount = parseInt(rechargePaise, 10);
      if (amount < topUp.MIN_TOPUP_PAISE) {
        return res.status(400).json({ message: `Recharge amount must be at least ₹${topUp.MIN_TOPUP_PAISE / 100}` });
      }
      update["credits.autoRecharge.rechargePaise"] = amount;
    }

    const org = await Organization.findByIdAndUpdate(
      req.orgId, { $set: update }, { new: true, projection: { credits: 1 } }
    );
    res.json({ autoRecharge: org.credits.autoRecharge });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
