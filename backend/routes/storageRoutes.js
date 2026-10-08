// routes/storageRoutes.js — manage and buy file space.
//   GET  /api/storage/overview      usage, what is using it, packs bought, prices
//   GET  /api/storage/quote         price for N blocks and a duration (admin)
//   POST /api/storage/order         start a Razorpay checkout (admin)
//   POST /api/storage/verify        browser callback after checkout (admin)
//   POST /api/storage/free-up/preview | /free-up   remove old recordings/selfies (admin)

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const Organization = require("../models/Organization");
const StorageOrder = require("../models/StorageOrder");
const { summaryFor } = require("../utils/storageLedger");
const { STORAGE_ADDON, storageFor } = require("../constants/plans");
const orders = require("../services/storageOrderService");
const cleanup = require("../services/storageCleanup");
const rzp = require("../services/razorpayService");
const logger = require("../config/logger");

router.use(protect);
const adminOnly = authorize("admin", "super_admin");
const oid = (id) => new mongoose.Types.ObjectId(String(id));

router.get("/overview", async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId).select("plan storage").lean();
    if (!org) return res.status(404).json({ message: "Organisation not found" });
    const [summary, history] = await Promise.all([
      summaryFor(org),
      StorageOrder.find({ orgId: oid(req.orgId), status: "paid" }).sort({ createdAt: -1 }).limit(10)
        .select("gb months amountPaise createdAt expiresAt").lean(),
    ]);
    const now = Date.now();
    res.json({
      ...summary,
      plan: org.plan,
      baseBytes: org.storage?.limitBytes ?? storageFor(org.plan).bytes,
      recordingDays: org.storage?.recordingDays ?? storageFor(org.plan).recordingDays,
      activePacks: (org.storage?.packs || []).filter((p) => p.expiresAt && new Date(p.expiresAt).getTime() > now)
        .map((p) => ({ gb: Math.round(p.bytes / 1073741824), expiresAt: p.expiresAt })),
      history,
      addon: { ...STORAGE_ADDON },
      gstRate: orders.GST_RATE,
      paymentsConfigured: rzp.isConfigured(),
    });
  } catch (err) {
    logger.error(`[storage] overview failed: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

router.get("/quote", adminOnly, (req, res) => {
  try { res.json(orders.quote(parseInt(req.query.packs, 10), parseInt(req.query.months, 10))); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

router.post("/order", adminOnly, async (req, res) => {
  try {
    if (!rzp.isConfigured()) return res.status(503).json({ message: "Online payment is not configured." });
    res.json(await orders.createOrder({
      orgId: req.orgId, userId: req.user._id,
      packs: parseInt(req.body.packs, 10), months: parseInt(req.body.months, 10),
    }));
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

router.post("/verify", adminOnly, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!rzp.verifyCheckoutSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) {
      logger.warn(`[storage] bad checkout signature for order ${razorpay_order_id}`);
      return res.status(400).json({ message: "Payment could not be verified." });
    }
    const result = await orders.applyOrder(razorpay_order_id, razorpay_payment_id);
    if (result.unknown) return res.status(404).json({ message: "Unknown order." });
    res.json({ ok: true, applied: result.applied });
  } catch (err) {
    logger.error(`[storage] verify failed: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

function freeUpArgs(req) {
  const days = parseInt(req.body.olderThanDays, 10);
  if (!cleanup.CATEGORIES.includes(req.body.category)) return { error: "Choose recordings or attendance photos." };
  if (!Number.isInteger(days) || days < 0 || days > 3650) return { error: "Enter how many days old." };
  return { category: req.body.category, days };
}

router.post("/free-up/preview", adminOnly, async (req, res) => {
  const a = freeUpArgs(req);
  if (a.error) return res.status(400).json({ message: a.error });
  try { res.json(await cleanup.preview(oid(req.orgId), a.category, a.days)); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/free-up", adminOnly, async (req, res) => {
  const a = freeUpArgs(req);
  if (a.error) return res.status(400).json({ message: a.error });
  try { res.json(await cleanup.freeUp(oid(req.orgId), a.category, a.days)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

module.exports = router;
