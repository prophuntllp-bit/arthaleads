/**
 * Shows what GET /api/org/support-access will actually return.
 *
 * The mobile Settings > Security tab called that endpoint, which did not
 * exist — the 404 was swallowed by a bare catch and the section sat blank
 * forever. It is now backed by the impersonate entries AuditLog already
 * writes, so this confirms there is real data behind it rather than another
 * empty screen.
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/check-support-access.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require("../models/AuditLog");

  const total = await AuditLog.countDocuments({ action: "impersonate" });
  console.log(`impersonate entries across all orgs: ${total}`);

  const rows = await AuditLog.find({ action: "impersonate" })
    .sort({ createdAt: -1 })
    .limit(8)
    .select("performedByName targetOrg targetOrgName targetUserName createdAt")
    .lean();

  console.log("\nmost recent:");
  for (const r of rows) {
    console.log(`  ${r.createdAt.toISOString()}  ${r.performedByName || "?"}`
      + `  -> ${r.targetOrgName || r.targetOrg}  (as ${r.targetUserName || "?"})`);
  }

  // Per-org counts: what each org would see in its own Security tab.
  const byOrg = await AuditLog.aggregate([
    { $match: { action: "impersonate" } },
    { $group: { _id: "$targetOrgName", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  console.log("\nper-org (what each org sees in Settings > Security):");
  byOrg.forEach((o) => console.log(`  ${o.n.toString().padStart(3)}  ${o._id || "(unnamed)"}`));

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
