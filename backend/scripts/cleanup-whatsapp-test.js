/**
 * One-time cleanup: removes the test lead and test automation connection
 * created while verifying the WhatsApp integration fix end-to-end
 * (name: "Test WhatsApp Verify" / lead phone 9999900001).
 *
 * Dry-run by default — logs what it would delete without writing anything.
 * Run: node backend/scripts/cleanup-whatsapp-test.js
 * Apply for real: node backend/scripts/cleanup-whatsapp-test.js --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Automation = require("../models/Automation");
const Lead = require("../models/Lead");

const APPLY = process.argv.includes("--apply");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${APPLY ? "APPLY" : "DRY RUN"} mode)`);

  const automations = await Automation.find({ platform: "WhatsApp", name: "Test WhatsApp Verify" }).select("_id orgId name");
  console.log(`Found ${automations.length} automation(s) named "Test WhatsApp Verify"`);
  for (const a of automations) {
    console.log(`${APPLY ? "Deleting" : "Would delete"}: automation ${a._id} (org ${a.orgId})`);
  }
  if (APPLY && automations.length) {
    await Automation.deleteMany({ _id: { $in: automations.map((a) => a._id) } });
  }

  const leads = await Lead.find({ phone: "9999900001", source: "WhatsApp" }).select("_id name phone");
  console.log(`\nFound ${leads.length} lead(s) with phone 9999900001`);
  for (const l of leads) {
    console.log(`${APPLY ? "Deleting" : "Would delete"}: lead "${l.name}" (${l._id})`);
  }
  if (APPLY && leads.length) {
    await Lead.deleteMany({ _id: { $in: leads.map((l) => l._id) } });
  }

  console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${automations.length} automation(s), ${leads.length} lead(s)`);
  if (!APPLY) console.log("\nDry run only — re-run with --apply to write these changes.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
