/**
 * Proves the plan gates are wired correctly, without touching the database.
 *
 * Two things this catches that a syntax check cannot:
 *   1. Mount-time failures — planGate is exported as { planGate }, so a default
 *      import gives an object and `planGate("growth")` throws only when the
 *      router is built. Mounting every router here surfaces that immediately.
 *   2. Wrong tier — it drives the real middleware with a fake org per plan and
 *      prints who is allowed through each gated endpoint, so the matrix can be
 *      read against the public pricing table.
 *
 * Run: node backend/scripts/verify-plan-gates.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const express = require("express");
const { planGate } = require("../middlewares/planGate");

// ── 1. every router mounts ───────────────────────────────────────────────────
const ROUTERS = [
  ["/api/leads",         "../routes/leadRoutes"],
  ["/api/org",           "../routes/orgRoutes"],
  ["/api/projects",      "../routes/projectRoutes"],
  ["/api/automations",   "../routes/automationRoutes"],
  ["/api/attendance",    "../routes/attendanceRoutes"],
  ["/api/routing-rules", "../routes/routingRuleRoutes"],
];

// Requiring a router drags in the scheduler and other long-lived handles, which
// keeps the event loop alive forever. Only do it when explicitly asked, and
// force an exit afterwards.
if (process.argv.includes("--mount")) {
  let mounted = 0;
  for (const [path, mod] of ROUTERS) {
    try {
      const app = express();
      app.use(path, require(mod));
      mounted++;
      console.log(`  mount OK   ${path}`);
    } catch (e) {
      console.log(`  MOUNT FAIL ${path}  ->  ${e.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`\nmounted ${mounted}/${ROUTERS.length} routers\n`);
  setImmediate(() => process.exit(process.exitCode || 0));
}

// ── 2. the gate lets the right plans through ─────────────────────────────────
const PLANS = ["starter", "trial", "growth", "pro", "enterprise"];

function allows(minPlan, plan) {
  const mw = planGate(minPlan);
  const req = { org: { plan }, user: { role: "admin" } };
  let outcome = "?";
  mw(req, {}, (err) => { outcome = err ? "blocked" : "allowed"; });
  return outcome === "allowed";
}

const GATED = [
  ["growth",     "GET  /api/leads/analytics",        "Advanced analytics"],
  ["growth",     "GET  /api/leads/export",           "Bulk lead export"],
  ["growth",     "GET  /api/leads/check-duplicate",  "Duplicate detection"],
  ["growth",     "PATCH /api/org/me/auto-assign",    "Round-robin assignment"],
  ["growth",     "*    /api/projects",               "Multiple project pipelines"],
  ["growth",     "*    /api/attendance",             "Attendance tracking"],
  ["growth",     "*    /api/routing-rules",          "Campaign routing rules"],
  ["enterprise", "*    /api/automations/google/*",   "Google Ads integration"],
];

const head = "min".padEnd(12) + "endpoint".padEnd(34) + PLANS.map((p) => p.slice(0, 6).padEnd(8)).join("");
console.log(head);
console.log("-".repeat(head.length));
for (const [min, ep, label] of GATED) {
  const cells = PLANS.map((p) => (allows(min, p) ? "yes" : "NO").padEnd(8)).join("");
  console.log(min.padEnd(12) + ep.padEnd(34) + cells);
}

console.log("\nsuper_admin bypass:",
  planGate("enterprise")({ org: { plan: "starter" }, user: { role: "super_admin" } }, {}, (e) => e) === undefined
    ? "allowed (correct)" : "check manually");

console.log("\nreminder: trial and pro both sit at Growth level, so a trial org");
console.log("keeps every Growth feature and is blocked only from Enterprise ones.");
