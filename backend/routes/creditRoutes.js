// routes/creditRoutes.js — WhatsApp credit balance, top-ups and statement.

const express = require("express");
const mongoose = require("mongoose");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const credits    = require("../services/creditService");
const topUp      = require("../services/creditTopUpService");
const rzp        = require("../services/razorpayService");
const CreditLedger = require("../models/CreditLedger");
const WaMessage    = require("../models/WaMessage");
const Organization = require("../models/Organization");
require("../models/WaConversation"); // registered for the statement populate below
const logger     = require("../config/logger");

router.use(protect);

// ── Balance ───────────────────────────────────────────────────────────────────
// Any signed-in member can read it: an agent needs to know why the composer is
// disabled, even though only an admin can top up.
router.get("/balance", async (req, res) => {
  try {
    const [bal, org] = await Promise.all([
      credits.getBalance(req.orgId),
      Organization.findById(req.orgId).select("credits whatsapp.billedDirectlyByMeta").lean(),
    ]);

    const rates = credits.ratesFor(org);
    const fs = org?.credits?.freeService || {};
    const now = new Date();
    const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const freeUsed = fs.yyyymm === yyyymm ? (fs.used || 0) : 0;

    res.json({
      ...bal,
      ratesPaise: rates,
      billedDirectlyByMeta: !!org?.whatsapp?.billedDirectlyByMeta,
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
        // Who each charge was for, so the statement reads as a statement.
        .populate("conversationId", "contactName contactPhone")
        .lean(),
      CreditLedger.countDocuments(filter),
    ]);

    res.json({ rows, total, page: +page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Utilization: where the messages and the money actually went ──────────────
// The statement lists charges one by one; this answers "what am I spending on?".
// Counts come from the messages themselves (so free replies, which never get a
// ledger row, are included), money comes from the ledger.
//
// META_RATE_PAISE is Meta's own published India rate per delivered message, ex
// GST. It is shown only as an ESTIMATE for orgs that pay Meta directly, whose
// wallet rates are 0 and whose real bill arrives on Meta's invoice.
const META_RATE_PAISE = { marketing: 86.31, utility: 11.5, authentication: 11.5, service: 11.5 };
const UTIL_CATEGORIES = [
  ["marketing", "Marketing messages"],
  ["service", "Replies"],
  ["utility", "Utility messages"],
  ["authentication", "Authentication messages"],
  ["other", "Not categorised"],
];
const DAY_MS = 86400000;
const IST_MS = 5.5 * 3600000;

router.get("/utilization", async (req, res) => {
  try {
    const range = ["7", "30", "month"].includes(String(req.query.range)) ? String(req.query.range) : "30";
    const istNow = Date.now() + IST_MS;
    const startOfIstDay = Math.floor(istNow / DAY_MS) * DAY_MS - IST_MS;
    const monthStart = (() => { const d = new Date(istNow); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - IST_MS; })();
    const since = new Date(range === "month" ? monthStart : startOfIstDay - (Number(range) - 1) * DAY_MS);
    const orgId = new mongoose.Types.ObjectId(String(req.orgId));
    const dayOf = { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "Asia/Kolkata" } };

    const [org, msgAgg, ledgerAgg] = await Promise.all([
      Organization.findById(orgId).select("credits whatsapp.billedDirectlyByMeta").lean(),
      WaMessage.aggregate([
        { $match: { orgId, direction: "outbound", status: { $ne: "failed" }, timestamp: { $gte: since } } },
        { $facet: {
          byCategory: [{ $group: { _id: { c: "$creditCategory", free: "$freeTierApplied" }, n: { $sum: 1 } } }],
          bySource: [{ $group: {
            _id: { s: "$sender", campaign: { $cond: [{ $regexMatch: { input: { $ifNull: ["$senderName", ""] }, regex: "^Campaign:" } }, "$senderName", null] } },
            n: { $sum: 1 },
          } }],
          byDay: [{ $group: { _id: { d: dayOf, c: "$creditCategory" }, n: { $sum: 1 } } }],
        } },
      ]),
      CreditLedger.aggregate([
        { $match: { orgId, type: "debit", createdAt: { $gte: since } } },
        { $group: { _id: "$category", spentPaise: { $sum: { $multiply: ["$amountPaise", -1] } } } },
      ]),
    ]);

    const m = msgAgg[0] || { byCategory: [], bySource: [], byDay: [] };
    const key = (c) => (UTIL_CATEGORIES.some(([k]) => k === c) && c !== "other" ? c : "other");
    const spentBy = Object.fromEntries(ledgerAgg.map((r) => [key(r._id), r.spentPaise]));

    const categories = UTIL_CATEGORIES.map(([cat, label]) => {
      const rows = m.byCategory.filter((r) => key(r._id.c) === cat);
      const messages = rows.reduce((a, r) => a + r.n, 0);
      const free = rows.filter((r) => r._id.free).reduce((a, r) => a + r.n, 0);
      const paid = messages - free;
      return {
        category: cat, label, messages, free, paid,
        ratePaise: cat === "other" ? 0 : credits.rateFor(org, cat),
        spentPaise: spentBy[cat] || 0,
        estMetaPaise: Math.round(paid * (META_RATE_PAISE[cat] || 0)),
      };
    }).filter((c) => c.messages > 0 || c.spentPaise > 0);

    const campaigns = {};
    let bot = 0, team = 0;
    for (const r of m.bySource) {
      if (r._id.campaign) {
        const name = r._id.campaign.replace(/^Campaign:\s*/, "");
        campaigns[name] = (campaigns[name] || 0) + r.n;
      } else if (r._id.s === "agent") team += r.n;
      else bot += r.n;
    }
    const campaignList = Object.entries(campaigns).map(([name, messages]) => ({ name, messages })).sort((a, b) => b.messages - a.messages);

    // One entry per IST day in the window, so a quiet day shows as a gap, not a missing bar.
    const days = [];
    const first = Math.floor((since.getTime() + IST_MS) / DAY_MS) * DAY_MS;
    for (let t = first; t <= istNow; t += DAY_MS) {
      days.push({ date: new Date(t).toISOString().slice(0, 10), marketing: 0, service: 0, other: 0 });
    }
    const dayIdx = Object.fromEntries(days.map((d, i) => [d.date, i]));
    for (const r of m.byDay) {
      const i = dayIdx[r._id.d];
      if (i === undefined) continue;
      const k = key(r._id.c);
      days[i][k === "marketing" || k === "service" ? k : "other"] += r.n;
    }

    const messages = categories.reduce((a, c) => a + c.messages, 0);
    const free = categories.reduce((a, c) => a + c.free, 0);
    res.json({
      range, since,
      billedDirectlyByMeta: !!org?.whatsapp?.billedDirectlyByMeta,
      totals: {
        messages, free, paid: messages - free,
        spentPaise: categories.reduce((a, c) => a + c.spentPaise, 0),
        estMetaPaise: categories.reduce((a, c) => a + c.estMetaPaise, 0),
      },
      categories,
      sources: { bot, team, campaigns: campaignList },
      days,
    });
  } catch (err) {
    logger.error(`[credits] utilization failed: ${err.message}`);
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
