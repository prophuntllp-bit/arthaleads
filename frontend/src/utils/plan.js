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

// Human-readable upgrade target.
// A trial user is trialing Growth-level features — the right next step is to
// subscribe to Growth (the plan they're already using), NOT jump to Enterprise.
export function upgradeTarget(plan) {
  if (plan === "trial") return "Growth";
  if (planLevel(plan) === 1) return "Growth";   // starter -> Growth
  if (planLevel(plan) === 2) return "Enterprise"; // growth/pro -> Enterprise
  return null;                                     // enterprise -> nothing higher
}
