/**
 * One-time backfill: restore sourceDomain/sourcePage/leadSourceLabel on
 * ProjectLead docs that lost it when transferToProject/bulkTransferToProject
 * moved them out of the Lead collection (before those functions copied this
 * data — see leadService.js).
 *
 * The original Lead document isn't deleted on transfer, only archived
 * (isArchived: true), and Lead.isArchived is set nowhere else in the
 * codebase — so it's a safe signal that a given Lead is the transfer-source
 * for some ProjectLead. We pair them up by orgId + phone (exact match, since
 * transfer copies phone verbatim) and copy the domain fields across.
 *
 * Dry-run by default — logs what it would change without writing anything.
 * Run: node backend/scripts/backfill-projectlead-domain.js
 * Apply for real: node backend/scripts/backfill-projectlead-domain.js --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");

const APPLY = process.argv.includes("--apply");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${APPLY ? "APPLY" : "DRY RUN"} mode)`);

  const targets = await ProjectLead.find({
    sourceDomain: { $in: ["", null] },
  }).select("_id orgId phone name createdAt").lean();

  console.log(`Found ${targets.length} ProjectLead doc(s) with no domain info\n`);

  let matched = 0, ambiguous = 0, noMatch = 0;
  const ops = [];

  for (const pl of targets) {
    const candidates = await Lead.find({
      orgId: pl.orgId,
      phone: pl.phone,
      isArchived: true,
      sourceDomain: { $nin: ["", null] },
    }).select("_id name sourceDomain sourcePage leadSourceLabel updatedAt").lean();

    if (!candidates.length) { noMatch++; continue; }

    let best = candidates[0];
    if (candidates.length > 1) {
      ambiguous++;
      // Tie-break: the archived Lead whose archival (updatedAt) sits closest
      // to when this ProjectLead was created — transfer archives the source
      // Lead in the same request that creates the ProjectLead.
      best = candidates.reduce((a, b) =>
        Math.abs(new Date(a.updatedAt) - new Date(pl.createdAt)) <=
        Math.abs(new Date(b.updatedAt) - new Date(pl.createdAt)) ? a : b
      );
      console.log(`[ambiguous] "${pl.name}" (${pl.phone}) matched ${candidates.length} archived leads — picked ${best._id} by closest archival time`);
    }

    console.log(`${APPLY ? "Updating" : "Would update"}: "${pl.name}" (${pl.phone}) -> domain "${best.sourceDomain}"`);
    matched++;

    ops.push({
      updateOne: {
        filter: { _id: pl._id },
        update: {
          $set: {
            sourceDomain:    best.sourceDomain    || "",
            sourcePage:      best.sourcePage      || "",
            leadSourceLabel: best.leadSourceLabel || "",
          },
        },
      },
    });
  }

  if (APPLY && ops.length) await ProjectLead.bulkWrite(ops);

  console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${matched} (${ambiguous} ambiguous, resolved by best guess)`);
  console.log(`No matching archived lead found: ${noMatch}`);
  if (!APPLY) console.log("\nDry run only — re-run with --apply to write these changes.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
