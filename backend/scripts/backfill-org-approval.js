/**
 * One-time backfill for the trial approval gate (see models/Organization.js
 * approvalStatus, added when self-serve signup moved behind manual review).
 *
 * Every org that existed BEFORE the gate has no approvalStatus field at all.
 * The runtime checks only block an explicit "pending"/"rejected", so those orgs
 * already work — but the field is stamped "approved" here so the admin UI and
 * any future query filters see a consistent value rather than undefined.
 *
 * Deliberately does NOT touch isActive, plan, or trialEndsAt: this is purely
 * about labelling existing orgs as already-approved. Deactivating junk orgs is
 * a separate, reviewed decision — see deactivate-junk-orgs.js.
 *
 * Dry-run by default — logs what it would change without writing anything.
 * Run:             node backend/scripts/backfill-org-approval.js
 * Apply for real:  node backend/scripts/backfill-org-approval.js --apply
 */
require("dotenv").config();
const dns = require("dns");
// Some Windows machines report a broken/stale resolver that breaks the
// mongodb+srv:// lookup — force known-good public resolvers.
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const orgs = mongoose.connection.collection("organizations");

  const missing = await orgs
    .find({ approvalStatus: { $exists: false } }, { projection: { name: 1, createdAt: 1 } })
    .toArray();

  if (!missing.length) {
    console.log("Nothing to backfill — every org already has approvalStatus.");
    await mongoose.disconnect();
    return;
  }

  console.log(`${missing.length} org(s) missing approvalStatus — will mark "approved":\n`);
  for (const o of missing) {
    console.log(`  · ${o.name}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to commit.`);
    await mongoose.disconnect();
    return;
  }

  const res = await orgs.updateMany(
    { approvalStatus: { $exists: false } },
    { $set: { approvalStatus: "approved", approvedAt: new Date() } }
  );
  console.log(`\n✅ Updated ${res.modifiedCount} org(s).`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
