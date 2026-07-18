/**
 * One-time backfill: fixes leads whose `requirements` field was accidentally
 * filled with the raw call transcript instead of the extracted summary.
 *
 * Root cause (fixed in routes/webhookRoutes.js): when a Vistrow Voice call
 * arrived without `extracted_data` (or with an empty one), the old code fell
 * back to putting the flattened transcript into `requirements` — which then
 * showed up as a wall of transcript text in the Leads table's Requirements
 * column and tooltip. The transcript already lives in its own tab
 * (lead.voiceCall.transcript), so it should never have been duplicated there.
 *
 * This script re-derives `requirements` for every affected lead:
 *   - if lead.voiceCall.extractedData has entries -> concise "Key: value · …" summary
 *   - otherwise -> "" (cleared, matching the new ingestion behaviour)
 * Only touches leads with source "Vistrow Voice" or "Google" that have a
 * voiceCall and whose requirements currently equals their own requirements
 * field's flattened message (i.e. looks like transcript dump, not already
 * a clean summary) — guarded further below by only running on leads whose
 * requirements is unusually long (a real summary is always short).
 *
 * Dry-run by default — logs what it would change without writing anything.
 * Run: node backend/scripts/backfill-vistrow-requirements.js
 * Apply for real: node backend/scripts/backfill-vistrow-requirements.js --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");

const APPLY = process.argv.includes("--apply");
// A genuine extracted-summary line is short; anything past this length on a
// voice lead is almost certainly the old transcript-dump bug, not a real summary.
const SUSPICIOUSLY_LONG = 300;

function buildSummary(extractedData) {
  if (!extractedData || typeof extractedData !== "object") return "";
  const entries = Object.entries(extractedData).filter(([, v]) => v !== "" && v != null);
  return entries
    .map(([k, v]) => `${k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${v}`)
    .join(" · ");
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${APPLY ? "APPLY" : "DRY RUN"} mode)`);

  const targets = await Lead.find({
    source: { $in: ["Vistrow Voice", "Google"] },
    voiceCall: { $exists: true },
    requirements: { $exists: true, $ne: "" },
  }).select("_id name requirements voiceCall.extractedData").lean();

  const affected = targets.filter((l) => (l.requirements || "").length > SUSPICIOUSLY_LONG);

  console.log(`Found ${targets.length} voice lead(s) with non-empty requirements`);
  console.log(`${affected.length} look like the transcript-dump bug (requirements > ${SUSPICIOUSLY_LONG} chars)\n`);

  const ops = [];
  for (const lead of affected) {
    const newReq = buildSummary(lead.voiceCall?.extractedData);
    console.log(`${APPLY ? "Updating" : "Would update"}: "${lead.name}" — requirements (${lead.requirements.length} chars) -> ${newReq ? `"${newReq}"` : "(cleared)"}`);
    ops.push({ updateOne: { filter: { _id: lead._id }, update: { $set: { requirements: newReq } } } });
  }

  if (APPLY && ops.length) await Lead.bulkWrite(ops);

  console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${ops.length} lead(s)`);
  if (!APPLY) console.log("\nDry run only — re-run with --apply to write these changes.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
