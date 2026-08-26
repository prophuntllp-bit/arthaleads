/**
 * Shows what the onboarding flow actually persisted for one org, so the UI's
 * success screen can be checked against the database rather than trusted.
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/check-onboarding-result.js <orgId>
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  const orgId = process.argv[2];
  if (!orgId) { console.error("usage: node check-onboarding-result.js <orgId>"); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");

  const org = await Organization.findById(orgId)
    .select("name phone companySize onboardingCompletedAt plan").lean();
  const admin = await User.findOne({ orgId, role: "admin" }).select("name phone").lean();

  console.log("ORG");
  console.log("  name        :", org?.name);
  console.log("  phone       :", org?.phone);
  console.log("  companySize :", org?.companySize ?? "(not set)");
  console.log("  onboarded   :", org?.onboardingCompletedAt ? "yes" : "NO");
  console.log("  plan        :", org?.plan);
  console.log("ADMIN");
  console.log("  name        :", admin?.name);
  console.log("  phone       :", admin?.phone);

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
