// middlewares/planGate.js
// Gate a route to orgs on a minimum plan level.
//
// Plan hierarchy:
//   starter(1) < trial/growth/pro(2) < enterprise(3)
//
// trial = Growth features for 14 days
// pro   = legacy name for growth
//
// Usage:  router.use(planGate("growth"))
//         router.post("/", planGate("enterprise"), handler)

const { AppError } = require("./errorHandler");

const PLAN_LEVEL = {
  starter:    1,
  trial:      2,  // trial gives growth access
  growth:     2,
  pro:        2,  // legacy — same as growth
  enterprise: 3,
};

// Returns the numeric level for a plan string
function levelOf(plan) {
  return PLAN_LEVEL[plan] ?? 1;
}

// planGate("growth")       — allows growth, pro, trial, enterprise
// planGate("enterprise")   — allows enterprise only
function planGate(minPlan) {
  const required = PLAN_LEVEL[minPlan];
  if (required === undefined) throw new Error(`planGate: unknown plan "${minPlan}"`);

  return (req, res, next) => {
    // super_admin bypasses everything
    if (req.user?.role === "super_admin") return next();

    const org = req.org;
    if (!org) return next(new AppError("Organisation not found.", 403));

    if (levelOf(org.plan) >= required) return next();

    return next(
      new AppError(
        `Your current plan (${org.plan}) does not include this feature. Upgrade to ${minPlan} or higher.`,
        403
      )
    );
  };
}

module.exports = { planGate, levelOf, PLAN_LEVEL };
