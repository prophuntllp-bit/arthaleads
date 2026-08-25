/**
 * Creates a throwaway, pre-approved test organisation + admin so the Razorpay
 * checkout flow can be exercised end to end through the real UI in a browser,
 * without going through the pending-approval signup queue.
 *
 * Prints the login email/password to stdout. Nothing else reads this org, and
 * it is meant to be deleted afterwards with delete-billing-test-org.js.
 *
 * Run: railway run --service Arthaleads node backend/scripts/create-billing-test-org.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");

  const stamp = Date.now().toString(36);
  const email = `billing-test-${stamp}@arthaleads.com`;
  const password = "TestPass!" + stamp;

  const org = await Organization.create({
    name: `Billing Test ${stamp}`,
    slug: `billing-test-${stamp}`,
    approvalStatus: "approved",
    isActive: true,
    plan: "trial",
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  const user = await User.create({
    name: "Billing Test Admin",
    email,
    password,
    phone: "9999999999",
    orgId: org._id,
    role: "admin",
    isActive: true,
  });

  console.log(JSON.stringify({ orgId: String(org._id), userId: String(user._id), email, password }, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
