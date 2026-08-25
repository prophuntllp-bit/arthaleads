// constants/planPricing.js
// ── The server-side source of truth for money ────────────────────────────────
//
// Every amount charged is computed here, from the plan and seat count, and
// NEVER from anything the client sends. A checkout request says "Growth, 5
// seats, annual"; it does not get to say what that costs.
//
// These figures must match frontend/src/utils/plan.js, which is what the
// website and the in-app Plans page display. A mismatch between the displayed
// price and the charged price is a serious bug — scripts/check-price-parity.js
// compares the two files and fails if they drift.

const PLAN_PRICING = {
  starter: { monthly: 599, annual: 5990, minSeats: 5, maxSeats: 10 },
  growth:  { monthly: 999, annual: 9990, minSeats: 5, maxSeats: 30 },
  // Enterprise is negotiated and invoiced manually — deliberately not
  // purchasable through checkout.
};

// GST is OFF until the GST registration number is confirmed and configured.
// Charging GST when not registered to collect it is worse than not charging
// it, so this fails closed. Set BILLING_GST_RATE=0.18 once GSTIN is in place.
const GST_RATE = Number(process.env.BILLING_GST_RATE || 0);

const BILLABLE_PLANS = Object.keys(PLAN_PRICING);
const CYCLES = ["monthly", "annual"];

/**
 * Compute what a checkout should cost, in paise.
 *
 * Razorpay works in the smallest currency unit, so every amount crossing the
 * API boundary is paise — multiplying at the last moment and rounding once
 * avoids the float drift that comes from carrying rupees around.
 *
 * Throws on anything invalid rather than silently clamping: a bad seat count
 * should fail the request, not quietly charge for a different quantity.
 */
function quote(planId, seats, cycle) {
  const plan = PLAN_PRICING[planId];
  if (!plan) throw new Error(`Plan "${planId}" cannot be purchased online.`);
  if (!CYCLES.includes(cycle)) throw new Error(`Billing cycle must be monthly or annual.`);

  const n = Number(seats);
  if (!Number.isInteger(n)) throw new Error("Seat count must be a whole number.");
  if (n < plan.minSeats) throw new Error(`${planId} has a minimum of ${plan.minSeats} seats.`);
  if (n > plan.maxSeats) throw new Error(`${planId} supports at most ${plan.maxSeats} seats. The next plan up applies beyond that.`);

  const rate     = cycle === "annual" ? plan.annual : plan.monthly;
  const subtotal = rate * n;
  const gst      = Math.round(subtotal * GST_RATE);
  const total    = subtotal + gst;

  return {
    planId, seats: n, cycle,
    rate,                        // rupees per seat per period
    subtotal,                    // rupees
    gstRate: GST_RATE,
    gst,                         // rupees
    total,                       // rupees
    amountPaise: total * 100,    // what Razorpay is actually asked to charge
    currency: "INR",
  };
}

/** How long a paid term runs, used to set paidUntil on success. */
function termEnd(cycle, from = new Date()) {
  const d = new Date(from);
  if (cycle === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

module.exports = { PLAN_PRICING, GST_RATE, BILLABLE_PLANS, CYCLES, quote, termEnd };
