/**
 * Removes a throwaway org created by create-billing-test-org.js, and any
 * Payment records it generated during a manual checkout test.
 *
 * Run: railway run --service Arthaleads node backend/scripts/delete-billing-test-org.js <orgId>
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  const orgId = process.argv[2];
  if (!orgId) { console.error("usage: node delete-billing-test-org.js <orgId>"); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");
  const Payment = require("../models/Payment");

  const org = await Organization.findById(orgId).select("name slug").lean();
  if (!org || !org.slug?.startsWith("billing-test-")) {
    console.error(`refusing: ${orgId} is not a billing-test- org (found: ${org?.slug || "none"})`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const users = await User.deleteMany({ orgId });
  const payments = await Payment.deleteMany({ orgId });
  await Organization.deleteOne({ _id: orgId });

  console.log(`deleted org "${org.name}", ${users.deletedCount} user(s), ${payments.deletedCount} payment(s)`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
