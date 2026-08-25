// utils/plan.js — plan feature gates (mirrors backend planGate.js)
// trial = growth access for 14 days

export const PLAN_LEVEL = {
  starter:    1,
  trial:      2,
  growth:     2,
  pro:        2,
  enterprise: 3,
};

export function planLevel(plan) {
  return PLAN_LEVEL[plan] ?? 1;
}

// Check if org's plan meets the minimum required plan
export function canAccess(org, minPlan) {
  if (!org) return false;
  return planLevel(org.plan) >= planLevel(minPlan);
}

export const PLAN_LABELS = {
  starter:    "Starter",
  trial:      "Free Trial",
  growth:     "Growth",
  pro:        "Growth",
  enterprise: "Enterprise",
};

export function planLabel(plan) {
  return PLAN_LABELS[plan] ?? "Starter";
}

// ── Per-seat pricing (INR) ──────────────────────────────────────────────────
// Transparent per-team-member pricing. No setup fee.
//
// Annual is exactly ten months' rate, so the discount is 2/12 = 16.7% — "pay
// for ten months, get twelve". At the five-seat minimum that saving works out
// to precisely one free user-year on either plan, which is the line to use in
// a quotation.
//
// `minSeats` is a commercial floor, not a technical one: five seats is the
// smallest team the role model is built for (one admin, one manager, three
// agents), since routing, attendance and the performance dashboard all assume
// someone assigns work and someone does it. Nothing in the API enforces it —
// it is held at quotation time.
//
// `maxSeats` IS enforced, by createUser in backend/services/authService.js.
// Keep the two in sync: if a cap moves here it must move there, or the website
// promises a team size the API refuses to create.
export const PLAN_PRICING = {
  starter:    { monthly: 499, annual: 4990, custom: false, minSeats: 5,  maxSeats: 10 },
  growth:     { monthly: 799, annual: 7990, custom: false, minSeats: 5,  maxSeats: 30 },
  enterprise: { monthly: null, annual: null, custom: true, minSeats: 25, maxSeats: Infinity },
};

// GST is charged on top of every published price, never baked in.
export const GST_RATE = 0.18;

export const withGST = (n) => Math.round(n * (1 + GST_RATE));

// Months of an annual term that are effectively free, derived rather than
// hard-coded so it stays true if a rate changes.
export function freeMonths(planId) {
  const p = PLAN_PRICING[planId];
  if (!p?.monthly || !p?.annual) return null;
  return Math.round(((p.monthly * 12 - p.annual) / p.monthly) * 10) / 10;
}

// What a mid-term seat addition costs. Monthly plans simply bill the new seats
// on the next invoice; annual plans charge pro-rata for the whole months left
// so the added seats co-terminate with the existing renewal date.
export function seatAdditionCost(planId, seats, { annual = false, monthsRemaining = 12 } = {}) {
  const p = PLAN_PRICING[planId];
  if (!p || p.custom) return null;
  const amount = annual
    ? Math.round((p.annual / 12) * Math.max(0, monthsRemaining) * seats)
    : p.monthly * seats;
  return { amount, withGST: withGST(amount) };
}

export const formatINR = (n) => "₹" + Number(n).toLocaleString("en-IN");

// Effective per-seat monthly price when billed annually (annual ÷ 12, rounded).
export function annualMonthly(planId) {
  const p = PLAN_PRICING[planId];
  return p?.annual ? Math.round(p.annual / 12) : null;
}

// Human-readable upgrade target.
// A trial user is trialing Growth-level features — the right next step is to
// subscribe to Growth (the plan they're already using), NOT jump to Enterprise.
export function upgradeTarget(plan) {
  if (plan === "trial") return "Growth";
  if (planLevel(plan) === 1) return "Growth";   // starter -> Growth
  if (planLevel(plan) === 2) return "Enterprise"; // growth/pro -> Enterprise
  return null;                                     // enterprise -> nothing higher
}
