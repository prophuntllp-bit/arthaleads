// services/creditService.js
//
// WhatsApp Conversation Credits — strictly prepaid, with a hard cap.
//
// Arthaleads holds the Meta credit line, which means Meta bills *us* for every
// tenant's messages. A tenant must therefore never be able to send a message we
// have not already collected the money for. That is the whole job of this file.
//
// The awkward part: Meta only tells us what a message actually cost in the
// status webhook, which arrives *after* the send. So a naive "check balance,
// then send, then debit" leaks money in two ways — two concurrent sends can
// both pass the same balance check, and a send can succeed while the debit
// never lands. Both were real risks worth designing out rather than patching.
//
// So sending is a two-phase reserve/settle, the same shape as a card auth:
//
//   1. reserve()  — atomically hold the worst-case price. Fails closed if the
//                   available balance does not cover it. Nothing is sent yet.
//   2. send
//   3. settle()   — the status webhook brings Meta's real price; convert the
//                   hold into a debit for the actual amount.
//      release()  — send failed, or Meta says it was not billable; hand the
//                   hold back untouched.
//
// available balance = balancePaise - reservedPaise. A tenant can only ever
// spend what is actually sitting there.
//
// All amounts are integer PAISE, ex-GST. GST is charged once at top-up, never
// per message — see docs/whatsapp-embedded-signup-plan.md Part 2.

const mongoose     = require("mongoose");
const Organization = require("../models/Organization");
const CreditLedger = require("../models/CreditLedger");
const logger       = require("../config/logger");

// Thrown when the available balance cannot cover a send. Callers turn this into
// a 402 so the UI can put up the top-up prompt rather than a generic failure.
class InsufficientCreditsError extends Error {
  constructor(needPaise, availablePaise) {
    super("Not enough WhatsApp credits");
    this.name = "InsufficientCreditsError";
    this.statusCode = 402;
    this.needPaise = needPaise;
    this.availablePaise = availablePaise;
  }
}

const VALID_CATEGORIES = ["marketing", "utility", "authentication", "service"];

// The agreed rate card — must match the defaults declared on
// Organization.credits.sellRatesPaise. Duplicated here on purpose: every read
// in this file goes through .lean(), which does NOT apply Mongoose schema
// defaults for a field that was never actually written to the document — and
// until 11 Sep 2026 nothing ever wrote sellRatesPaise, so every org's real
// rate silently read as 0 (rateFor()'s own `: 0` fallback) no matter what the
// schema said. Caught before any org had topped up or been charged, but it
// means the schema default alone is not a rate card — this constant is.
const DEFAULT_SELL_RATES_PAISE = { marketing: 112, utility: 15, authentication: 15, service: 15 };

// Meta's free allowance: 1,000 service messages per phone number per calendar
// month, from 1 Oct 2026. No rollover.
const FREE_SERVICE_PER_MONTH = 1000;

function currentYyyyMm(d = new Date()) {
  // Billing months follow Meta's UTC calendar month, not IST — using local time
  // here would double-count or skip a day's worth of free messages at every
  // month boundary.
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Our sell rate for a category, in paise, ex-GST. */
function rateFor(org, category) {
  const stored = org?.credits?.sellRatesPaise || {};
  const rate = stored[category];
  // An org that has never had rates written gets the real rate card, not 0.
  // An org with an explicit override (e.g. PropHunt, which pays Meta directly
  // on its own card and would otherwise be billed twice for the same message)
  // keeps whatever it was explicitly set to, including an explicit 0.
  if (Number.isFinite(rate)) return rate;
  return DEFAULT_SELL_RATES_PAISE[category] ?? 0;
}

/** Merged view of an org's rates — real numbers even when nothing is stored. */
function ratesFor(org) {
  const stored = org?.credits?.sellRatesPaise || {};
  return { ...DEFAULT_SELL_RATES_PAISE, ...stored };
}

/** Balance snapshot for the UI and for pre-flight checks. */
async function getBalance(orgId) {
  const org = await Organization.findById(orgId).select("credits").lean();
  const balancePaise  = org?.credits?.balancePaise  || 0;
  const reservedPaise = org?.credits?.reservedPaise || 0;
  return {
    balancePaise,
    reservedPaise,
    availablePaise: Math.max(0, balancePaise - reservedPaise),
  };
}

/**
 * How many of `count` messages in `category` are covered by Meta's free service
 * allowance this month, and what the rest will cost.
 *
 * Read-only — reserve() does the atomic consumption.
 */
async function quote(orgId, category, count = 1) {
  const org = await Organization.findById(orgId).select("credits").lean();
  if (!org) throw new Error("Org not found");

  const rate = rateFor(org, category);
  let free = 0;

  if (category === "service") {
    const fs = org.credits?.freeService || {};
    const used = fs.yyyymm === currentYyyyMm() ? (fs.used || 0) : 0;
    free = Math.max(0, Math.min(count, FREE_SERVICE_PER_MONTH - used));
  }

  const billable = count - free;
  return {
    count,
    freeCount: free,
    billableCount: billable,
    ratePaise: rate,
    totalPaise: billable * rate,
  };
}

/**
 * Atomically hold `count` messages' worth of credit.
 *
 * The guard and the increment are one document update, so two agents hitting
 * send at the same instant cannot both pass — MongoDB serialises them and the
 * second sees the first's reservation. A read-then-write here would be a money
 * leak under any real concurrency.
 *
 * Returns the amount held (0 when fully covered by the free allowance).
 * Throws InsufficientCreditsError and holds nothing if it does not fit.
 */
async function reserve(orgId, { category, count = 1 } = {}) {
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`Unknown credit category: ${category}`);
  }

  const q = await quote(orgId, category, count);

  // Consume the free allowance first. Done as its own atomic bump so a
  // concurrent send cannot claim the same free units.
  if (q.freeCount > 0) {
    const yyyymm = currentYyyyMm();
    await Organization.updateOne(
      { _id: orgId, "credits.freeService.yyyymm": yyyymm },
      { $inc: { "credits.freeService.used": q.freeCount } }
    ).then(async (r) => {
      if (r.matchedCount === 0) {
        // First send of a new month — roll the counter over.
        await Organization.updateOne(
          { _id: orgId },
          { $set: { "credits.freeService": { yyyymm, used: q.freeCount } } }
        );
      }
    });
  }

  if (q.totalPaise <= 0) return 0;

  const updated = await Organization.findOneAndUpdate(
    {
      _id: orgId,
      $expr: {
        $gte: [
          { $subtract: ["$credits.balancePaise", "$credits.reservedPaise"] },
          q.totalPaise,
        ],
      },
    },
    { $inc: { "credits.reservedPaise": q.totalPaise } },
    { new: true, projection: { credits: 1 } }
  );

  if (!updated) {
    const { availablePaise } = await getBalance(orgId);
    throw new InsufficientCreditsError(q.totalPaise, availablePaise);
  }

  return q.totalPaise;
}

/** Hand a hold back untouched — the send failed, or Meta says it was free. */
async function release(orgId, amountPaise) {
  if (!amountPaise || amountPaise <= 0) return;
  await Organization.updateOne(
    { _id: orgId },
    { $inc: { "credits.reservedPaise": -amountPaise } }
  );
  // Reserved should never go negative; if a double-release ever gets through,
  // clamp rather than let the guard in reserve() start passing on bad maths.
  await Organization.updateOne(
    { _id: orgId, "credits.reservedPaise": { $lt: 0 } },
    { $set: { "credits.reservedPaise": 0 } }
  );
}

/**
 * Convert a hold into a real debit once Meta's status webhook brings the price.
 *
 * Idempotent: a repeated webhook for the same waMsgId hits the unique index on
 * CreditLedger and is treated as already settled. Meta does resend these.
 */
async function settle(orgId, {
  reservedPaise = 0,
  category,
  waMsgId,
  conversationId = null,
  campaignId = null,
  metaPricing = null,
  freeTierApplied = false,
} = {}) {
  // Meta told us it is not billable (free-tier service message, or a category
  // that carries no charge) — give the hold straight back.
  if (metaPricing && metaPricing.billable === false) {
    await release(orgId, reservedPaise);
    return { debitedPaise: 0, skipped: "not-billable" };
  }

  const org = await Organization.findById(orgId).select("credits").lean();
  if (!org) return { debitedPaise: 0, skipped: "org-missing" };

  // Charge our sell rate for whatever category Meta actually billed, which is
  // not always the one we guessed at reserve time — a template can be
  // re-categorised between send and delivery.
  const billedCategory = VALID_CATEGORIES.includes(metaPricing?.category)
    ? metaPricing.category
    : category;
  const ratePaise = freeTierApplied ? 0 : rateFor(org, billedCategory);

  const balanceBefore = org.credits?.balancePaise || 0;
  const balanceAfter  = Math.max(0, balanceBefore - ratePaise);

  // Belt and braces on the unique index below. The index is the real guard
  // against a genuine race, but this catches the ordinary repeat-webhook case
  // without depending on the index having been built — which is exactly how
  // duplicates slipped through once already.
  if (waMsgId) {
    const already = await CreditLedger.exists({ waMsgId, type: "debit" });
    if (already) {
      await release(orgId, reservedPaise);
      return { debitedPaise: 0, skipped: "duplicate" };
    }
  }

  try {
    await CreditLedger.create({
      orgId,
      type: "debit",
      amountPaise: -ratePaise,
      balanceAfterPaise: balanceAfter,
      category: billedCategory,
      rateAppliedPaise: ratePaise,
      freeTierApplied,
      waMsgId: waMsgId || null,
      conversationId,
      campaignId,
      metaPricing,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate status webhook — already settled. Release the second hold so
      // it does not sit reserved forever.
      await release(orgId, reservedPaise);
      return { debitedPaise: 0, skipped: "duplicate" };
    }
    throw err;
  }

  await Organization.updateOne(
    { _id: orgId },
    {
      $inc: {
        "credits.balancePaise":  -ratePaise,
        "credits.reservedPaise": -Math.min(reservedPaise, reservedPaise),
      },
    }
  );
  await Organization.updateOne(
    { _id: orgId, "credits.reservedPaise": { $lt: 0 } },
    { $set: { "credits.reservedPaise": 0 } }
  );

  return { debitedPaise: ratePaise, category: billedCategory };
}

/** Add credit after a successful payment. `gstPaise` is recorded, not banked. */
async function topUp(orgId, { amountPaise, gstPaise = 0, razorpayPaymentId = null, note = "" }) {
  if (!amountPaise || amountPaise <= 0) throw new Error("Top-up must be positive");

  const org = await Organization.findByIdAndUpdate(
    orgId,
    { $inc: { "credits.balancePaise": amountPaise } },
    { new: true, projection: { credits: 1 } }
  );
  if (!org) throw new Error("Org not found");

  await CreditLedger.create({
    orgId,
    type: "topup",
    amountPaise,
    balanceAfterPaise: org.credits.balancePaise,
    gstPaise,
    razorpayPaymentId,
    note,
  });

  logger.info(`[credits] org ${orgId} topped up ${amountPaise}p (GST ${gstPaise}p) -> ${org.credits.balancePaise}p`);
  return org.credits.balancePaise;
}

/**
 * Cheap pre-flight for the UI and for the campaign builder: can this org afford
 * `count` messages of `category` right now? Never reserves.
 */
async function canAfford(orgId, category, count = 1) {
  const [q, bal] = await Promise.all([quote(orgId, category, count), getBalance(orgId)]);
  return {
    ok: bal.availablePaise >= q.totalPaise,
    needPaise: q.totalPaise,
    availablePaise: bal.availablePaise,
    ...q,
  };
}

/**
 * Rebuild the cached balance from the ledger. The ledger is the source of
 * truth; this exists for the monthly reconciliation and for repairing drift,
 * not for the hot path.
 */
async function recomputeBalance(orgId) {
  const [agg] = await CreditLedger.aggregate([
    { $match: { orgId: new mongoose.Types.ObjectId(String(orgId)) } },
    { $group: { _id: null, total: { $sum: "$amountPaise" } } },
  ]);
  const total = agg?.total || 0;
  await Organization.updateOne({ _id: orgId }, { $set: { "credits.balancePaise": Math.max(0, total) } });
  return total;
}

module.exports = {
  InsufficientCreditsError,
  FREE_SERVICE_PER_MONTH,
  DEFAULT_SELL_RATES_PAISE,
  rateFor,
  ratesFor,
  getBalance,
  quote,
  reserve,
  release,
  settle,
  topUp,
  canAfford,
  recomputeBalance,
};
