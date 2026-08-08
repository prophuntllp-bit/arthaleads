/**
 * One-time rename: the Vistrow Voice quick-connect wizard always suffixed a
 * number onto the connection name (`Vistrow Voice 1`), even for the first and
 * only connection — where there's nothing to disambiguate. Fixed going
 * forward in Automation.jsx's VoiceWizard (bare "Vistrow Voice" until a
 * second connection exists), but this backfills the org's existing
 * connection and every already-created lead's `leadSourceLabel` so the "1"
 * disappears immediately instead of only on new leads.
 *
 * Only touches automations/leads literally named "Vistrow Voice 1" — if a
 * second connection is ever added, later ones keep their number.
 *
 * Dry-run by default — logs what it would change without writing anything.
 * Run: node backend/scripts/fix-vistrow-voice-name.js
 * Apply for real: node backend/scripts/fix-vistrow-voice-name.js --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Automation = require("../models/Automation");
const Lead = require("../models/Lead");

const APPLY = process.argv.includes("--apply");
const OLD_NAME = "Vistrow Voice 1";
const NEW_NAME = "Vistrow Voice";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${APPLY ? "APPLY" : "DRY RUN"} mode)`);

  const automations = await Automation.find({ platform: "Vistrow Voice", name: OLD_NAME }).select("_id orgId name");
  console.log(`Found ${automations.length} automation(s) named "${OLD_NAME}"`);
  for (const a of automations) {
    console.log(`${APPLY ? "Renaming" : "Would rename"}: automation ${a._id} (org ${a.orgId}) -> "${NEW_NAME}"`);
  }
  if (APPLY && automations.length) {
    await Automation.updateMany({ _id: { $in: automations.map((a) => a._id) } }, { $set: { name: NEW_NAME } });
  }

  const leads = await Lead.find({ source: "Vistrow Voice", leadSourceLabel: OLD_NAME }).select("_id name leadSourceLabel");
  console.log(`\nFound ${leads.length} lead(s) with leadSourceLabel "${OLD_NAME}"`);
  for (const l of leads) {
    console.log(`${APPLY ? "Updating" : "Would update"}: lead "${l.name}" (${l._id}) -> leadSourceLabel "${NEW_NAME}"`);
  }
  if (APPLY && leads.length) {
    await Lead.updateMany({ _id: { $in: leads.map((l) => l._id) } }, { $set: { leadSourceLabel: NEW_NAME } });
  }

  console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${automations.length} automation(s), ${leads.length} lead(s)`);
  if (!APPLY) console.log("\nDry run only — re-run with --apply to write these changes.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
