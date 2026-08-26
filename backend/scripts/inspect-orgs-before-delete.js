/**
 * Pre-deletion check: prints the slug, user/lead/payment counts and creation
 * date for each org id given, and says whether the delete script's
 * billing-test- slug guard would allow it.
 *
 * Deleting from the production database is irreversible, so this exists to make
 * "is this really a throwaway org" a checked fact rather than an assumption.
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/inspect-orgs-before-delete.js <orgId> [orgId...]
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: node inspect-orgs-before-delete.js <orgId> [orgId...]"); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");
  const Lead = require("../models/Lead");
  const Payment = require("../models/Payment");

  for (const id of ids) {
    const org = await Organization.findById(id).select("name slug createdAt plan").lean();
    if (!org) { console.log(`${id}: NOT FOUND\n`); continue; }

    const [users, leads, payments] = await Promise.all([
      User.countDocuments({ orgId: id }),
      Lead.countDocuments({ orgId: id }),
      Payment.countDocuments({ orgId: id }),
    ]);

    const guardOk = String(org.slug || "").startsWith("billing-test-");
    console.log(org.name);
    console.log(`  id       : ${id}`);
    console.log(`  slug     : ${org.slug}  ${guardOk ? "(guard allows delete)" : "*** GUARD WOULD REFUSE ***"}`);
    console.log(`  created  : ${new Date(org.createdAt).toISOString().slice(0, 16).replace("T", " ")}`);
    console.log(`  users    : ${users}   leads: ${leads}   payments: ${payments}`);
    console.log(`  verdict  : ${guardOk && leads === 0 ? "safe to delete" : "REVIEW BEFORE DELETING"}`);
    console.log();
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
