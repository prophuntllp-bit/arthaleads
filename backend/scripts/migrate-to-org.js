/**
 * One-time migration: create PropHunt LLP organization and assign all existing
 * Users, Leads, Automations, and RoutingRules to it.
 *
 * Run ONCE from the backend directory:
 *   node scripts/migrate-to-org.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const Organization = require("../models/Organization");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Automation = require("../models/Automation");
const RoutingRule = require("../models/RoutingRule");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // 1. Create (or find existing) PropHunt org
  let org = await Organization.findOne({ slug: "prophunt-llp" });
  if (org) {
    console.log(`Org already exists: ${org.name} (${org._id})`);
  } else {
    org = await Organization.create({
      name: "PropHunt LLP",
      slug: "prophunt-llp",
      plan: "pro",
      industry: "Real Estate",
    });
    console.log(`Created org: ${org.name} (${org._id})`);
  }

  const orgId = org._id;

  // 2. Backfill Users (skip any already assigned)
  const userResult = await User.updateMany(
    { orgId: { $exists: false } },
    { $set: { orgId } }
  );
  console.log(`Users updated: ${userResult.modifiedCount}`);

  // 3. Backfill Leads
  const leadResult = await Lead.updateMany(
    { orgId: { $exists: false } },
    { $set: { orgId } }
  );
  console.log(`Leads updated: ${leadResult.modifiedCount}`);

  // 4. Backfill Automations
  const autoResult = await Automation.updateMany(
    { orgId: { $exists: false } },
    { $set: { orgId } }
  );
  console.log(`Automations updated: ${autoResult.modifiedCount}`);

  // 5. Backfill RoutingRules
  const ruleResult = await RoutingRule.updateMany(
    { orgId: { $exists: false } },
    { $set: { orgId } }
  );
  console.log(`RoutingRules updated: ${ruleResult.modifiedCount}`);

  console.log("\n✅ Migration complete. All existing data is now assigned to PropHunt LLP.");
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
