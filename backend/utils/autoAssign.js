// Whether new leads are handed out by round-robin for this company.
//
// "Auto round-robin lead assignment" is a Growth feature (pricing). Until the
// 24 Oct 2026 sweep every lead path checked only `autoAssign !== false`, and
// autoAssign defaults to true, so Starter companies got it too while the
// switch to turn it off was Growth-only. One rule for every path now.
// The org passed in must include `autoAssign` and `plan`.
const { levelOf } = require("../middlewares/planGate");

function shouldAutoAssign(org) {
  return !!org && org.autoAssign !== false && levelOf(org.plan) >= levelOf("growth");
}

module.exports = { shouldAutoAssign };
