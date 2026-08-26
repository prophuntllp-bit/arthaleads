/**
 * Sets an organisation's paid-through date.
 *
 * The same thing the admin panel's renewal date picker does, available from the
 * command line for orgs invoiced offline. Prints before and after so the change
 * is visible rather than assumed.
 *
 * Deliberately does NOT create a Payment record: those are the audit trail for
 * money that actually moved through Razorpay, and writing a fake one would put
 * a settlement in the books that never happened. An offline bank transfer or a
 * negotiated Enterprise invoice is recorded by the term, not by a gateway
 * receipt.
 *
 * Run: railway run --service Arthaleads node backend/scripts/set-renewal-date.js <orgId> <YYYY-MM-DD>
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

// Render in IST explicitly — the server runs in UTC, so a bare toLocaleDateString
// would print a different day to the one the customer sees.
const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
      })
    : "(none)";

async function main() {
  const [orgId, dateStr] = process.argv.slice(2);
  if (!orgId || !dateStr) {
    console.error("usage: node set-renewal-date.js <orgId> <YYYY-MM-DD>");
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.error("date must be YYYY-MM-DD");
    process.exit(1);
  }

  // End of day IST, not UTC. Customers and dates on invoices are Indian, and
  // 23:59 UTC on the 26th is 05:29 IST on the 27th — which is what a renewal
  // banner would then display. The 18:29:59.999Z below is 23:59:59.999 +05:30.
  const paidUntil = new Date(`${dateStr}T18:29:59.999Z`);
  if (Number.isNaN(paidUntil.getTime())) { console.error("invalid date"); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const { subscriptionState } = require("../constants/planPricing");

  const before = await Organization.findById(orgId).select("name plan paidUntil cancelAtPeriodEnd").lean();
  if (!before) { console.error(`org ${orgId} not found`); await mongoose.disconnect(); process.exit(1); }

  console.log("BEFORE");
  console.log(`  org       : ${before.name}`);
  console.log(`  plan      : ${before.plan}`);
  console.log(`  paidUntil : ${fmt(before.paidUntil)}`);
  console.log(`  status    : ${subscriptionState(before).status}`);

  await Organization.findByIdAndUpdate(orgId, {
    $set: { paidUntil, cancelAtPeriodEnd: false },
    $unset: { lapsedAt: "" },
  });

  const after = await Organization.findById(orgId).select("name plan paidUntil cancelAtPeriodEnd").lean();
  const state = subscriptionState(after);

  console.log("\nAFTER");
  console.log(`  paidUntil : ${fmt(after.paidUntil)}`);
  console.log(`  status    : ${state.status}`);
  console.log(`  daysLeft  : ${state.daysLeft}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
