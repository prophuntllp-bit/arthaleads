/**
 * Deactivates clearly-fake trial orgs left over from before signup was gated
 * (see models/Organization.js approvalStatus).
 *
 * Sets isActive:false only — no data is deleted, and flipping it back in the
 * super-admin panel fully restores the account. Deliberately conservative:
 * only orgs matching one of the explicit signals below are touched, and any
 * org with real usage is force-skipped regardless of what else it matches.
 *
 * Signals:
 *   DISPOSABLE_EMAIL  admin signed up with a throwaway-inbox domain
 *   FAKE_PHONE        admin's phone is a placeholder (repeated digit / 1234567890)
 *   NEVER_LOGGED_IN   account created but the admin has never once signed in
 *
 * Hard skips (never deactivated, whatever else they match):
 *   · any org on a paid plan
 *   · any org with more than one user
 *   · any org whose admin signed in within the last 7 days
 *
 * Dry-run by default — prints the plan without writing anything.
 * Run:            node backend/scripts/deactivate-junk-orgs.js
 * Apply for real: node backend/scripts/deactivate-junk-orgs.js --apply
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");
const { isDisposableEmail } = require("../utils/emailDomains");

const APPLY = process.argv.includes("--apply");
const RECENT_LOGIN_DAYS = 7;

const FAKE_PHONES = new Set(["1234567890", "9876543210", "0000000000", "1111111111", "9999999999"]);
function isFakePhone(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(-10);
  if (!d || d.length < 10) return false;
  if (FAKE_PHONES.has(d)) return true;
  return /^(\d)\1{9}$/.test(d); // all same digit
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;

  const orgs  = await db.collection("organizations").find({}).toArray();
  const users = await db.collection("users").find({}).toArray();
  const leadAgg = await db.collection("leads").aggregate([
    { $group: { _id: "$orgId", c: { $sum: 1 } } },
  ]).toArray();
  const leadMap = Object.fromEntries(leadAgg.map((l) => [String(l._id), l.c]));

  const byOrg = {};
  for (const u of users) (byOrg[String(u.orgId)] ||= []).push(u);

  const toDeactivate = [], skipped = [];

  for (const org of orgs) {
    if (org.isActive === false) continue; // already off

    const key   = String(org._id);
    const mem   = byOrg[key] || [];
    const admin = mem.find((u) => u.role === "admin") || mem[0];
    const leads = leadMap[key] || 0;

    const signals = [];
    if (admin && isDisposableEmail(admin.email)) signals.push("DISPOSABLE_EMAIL");
    if (admin && isFakePhone(admin.phone))       signals.push("FAKE_PHONE");
    if (admin && !admin.lastLogin)               signals.push("NEVER_LOGGED_IN");
    if (!signals.length) continue;

    // ── Hard skips ────────────────────────────────────────────────────────────
    const guards = [];
    if (org.plan && org.plan !== "trial") guards.push(`paid plan (${org.plan})`);
    if (mem.length > 1)                   guards.push(`${mem.length} users`);
    if (admin?.lastLogin) {
      const days = (Date.now() - new Date(admin.lastLogin).getTime()) / 86400000;
      if (days < RECENT_LOGIN_DAYS) guards.push(`signed in ${Math.round(days)}d ago`);
    }

    const row = { org, admin, leads, signals, guards };
    if (guards.length) skipped.push(row); else toDeactivate.push(row);
  }

  const line = (r) =>
    `  ${r.org.name.padEnd(30)} ${String(r.leads).padStart(3)} leads  ` +
    `${(r.admin?.email || "—").padEnd(34)} ${r.signals.join(",")}`;

  console.log(`\nWILL DEACTIVATE (${toDeactivate.length}):`);
  console.log("  " + "-".repeat(110));
  toDeactivate.forEach((r) => console.log(line(r)));
  if (!toDeactivate.length) console.log("  (none)");

  console.log(`\nSKIPPED despite matching (${skipped.length}):`);
  console.log("  " + "-".repeat(110));
  skipped.forEach((r) => console.log(`${line(r)}\n      ↳ kept: ${r.guards.join("; ")}`));
  if (!skipped.length) console.log("  (none)");

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to commit.\n`);
    await mongoose.disconnect();
    return;
  }

  for (const r of toDeactivate) {
    await db.collection("organizations").updateOne(
      { _id: r.org._id },
      { $set: { isActive: false, deactivationReason: `auto: ${r.signals.join(",")}`, deactivatedAt: new Date() } }
    );
    console.log(`  ✓ deactivated ${r.org.name}`);
  }
  console.log(`\n✅ Deactivated ${toDeactivate.length} org(s). Reversible from the super-admin panel.\n`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
