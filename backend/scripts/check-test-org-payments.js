/**
 * Confirms the stuck checkout attempt (Razorpay's checkout.js blocked in the
 * test browser) left no Payment record behind — order creation happens after
 * loadRazorpay() resolves in CheckoutModal, so a script-load failure should
 * mean nothing was ever POSTed to /api/billing/order.
 *
 * Run: railway run --service Arthaleads node backend/scripts/check-test-org-payments.js <orgId>
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  const orgId = process.argv[2];
  if (!orgId) { console.error("usage: node check-test-org-payments.js <orgId>"); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const Payment = require("../models/Payment");
  const Organization = require("../models/Organization");

  const org = await Organization.findById(orgId).select("name plan seats paidUntil").lean();
  console.log("org:", JSON.stringify(org));

  const rows = await Payment.find({ orgId }).lean();
  console.log(`payments: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.razorpayOrderId}  ${r.status}  ${r.plan} x${r.seats} ${r.cycle}  ₹${r.amountPaise / 100}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
