/**
 * What plan is every live organisation actually on, and how much would a
 * stricter paywall bite?
 *
 * Gating routes that orgs already use would break them mid-subscription, so
 * this runs BEFORE any planGate is added: it shows the plan distribution, trial
 * status, and — for orgs that would drop to Starter-level access — whether they
 * have data in the Growth-only surfaces (projects, attendance, routing rules,
 * bookings/invoices).
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/check-org-plans.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");

  const orgs = await Organization.find({})
    .select("name plan trialEndsAt isActive approvalStatus createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const now = new Date();
  const byPlan = {};
  for (const o of orgs) byPlan[o.plan] = (byPlan[o.plan] || 0) + 1;

  console.log(`organisations: ${orgs.length}`);
  console.log(`plan distribution: ${JSON.stringify(byPlan)}\n`);

  // Growth-only surfaces, per the public pricing table.
  const Project = require("../models/Project");
  const Attendance = require("../models/Attendance");
  const RoutingRule = require("../models/RoutingRule");
  const Lead = require("../models/Lead");

  const hdr = "org".padEnd(28) + "plan".padEnd(12) + "trial".padEnd(14) + "users".padEnd(7) +
              "leads".padEnd(8) + "projects".padEnd(10) + "attend".padEnd(8) + "rules";
  console.log(hdr);
  console.log("-".repeat(hdr.length));

  for (const o of orgs) {
    const [users, leads, projects, attendance, rules] = await Promise.all([
      User.countDocuments({ orgId: o._id, isActive: true }),
      Lead.countDocuments({ orgId: o._id }),
      Project.countDocuments({ orgId: o._id }),
      Attendance.countDocuments({ orgId: o._id }),
      RoutingRule.countDocuments({ orgId: o._id }),
    ]);

    let trial = "-";
    if (o.plan === "trial") {
      trial = o.trialEndsAt
        ? (new Date(o.trialEndsAt) > now
            ? `${Math.ceil((new Date(o.trialEndsAt) - now) / 86400000)}d left`
            : "EXPIRED")
        : "no clock";
    }

    console.log(
      String(o.name || "?").slice(0, 26).padEnd(28) +
      String(o.plan).padEnd(12) +
      trial.padEnd(14) +
      String(users).padEnd(7) +
      String(leads).padEnd(8) +
      String(projects).padEnd(10) +
      String(attendance).padEnd(8) +
      String(rules)
    );
  }

  // The orgs a stricter gate would actually affect.
  const starterOrgs = orgs.filter((o) => o.plan === "starter");
  console.log(`\nstarter-level orgs (would lose Growth features): ${starterOrgs.length}`);
  for (const o of starterOrgs) console.log(`  - ${o.name}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
