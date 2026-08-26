/**
 * Shows exactly which organisations the daily expiry sweep would downgrade,
 * WITHOUT changing anything.
 *
 * Worth running before the job goes live: a bug here silently strips paid
 * features from real customers, and that is not something to discover from a
 * support ticket.
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/dry-run-expiry-sweep.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const { GRACE_DAYS, LAPSED_PLAN, subscriptionState } = require("../constants/planPricing");

  const cutoff = new Date(Date.now() - GRACE_DAYS * 86400000);
  console.log(`grace: ${GRACE_DAYS} days · lapses to: ${LAPSED_PLAN}`);
  console.log(`cutoff: anything paid-until before ${cutoff.toISOString().slice(0, 10)}\n`);

  const all = await Organization.find({})
    .select("name plan seats paidUntil cancelAtPeriodEnd")
    .lean();

  const withTerm = all.filter((o) => o.paidUntil);
  console.log(`organisations: ${all.length}  ·  with a paid term: ${withTerm.length}\n`);

  if (withTerm.length) {
    console.log("org".padEnd(28) + "plan".padEnd(12) + "status".padEnd(9) + "paidUntil");
    console.log("-".repeat(70));
    for (const o of withTerm) {
      const s = subscriptionState(o);
      console.log(
        String(o.name).slice(0, 26).padEnd(28) +
        String(o.plan).padEnd(12) +
        String(s.status).padEnd(9) +
        new Date(o.paidUntil).toISOString().slice(0, 10)
      );
    }
    console.log();
  }

  // Exactly the query the sweep uses.
  const wouldDowngrade = await Organization.find({
    paidUntil: { $ne: null, $lt: cutoff },
    plan: { $in: ["starter", "growth", "pro"] },
  }).select("name plan").lean();

  const affected = wouldDowngrade.filter((o) => o.plan !== LAPSED_PLAN);
  console.log(`WOULD DOWNGRADE: ${affected.length}`);
  for (const o of affected) console.log(`  - ${o.name} (${o.plan} -> ${LAPSED_PLAN})`);
  if (!affected.length) console.log("  (none — no org would be affected right now)");

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
