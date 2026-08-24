/**
 * Calls the live GET /api/org/support-access as a real admin and prints what
 * the Settings > Security tab will render.
 *
 * The on-device check could not reach that tab: it is admin-only in the UI and
 * the test account is a manager. So verify the endpoint itself, against an
 * organisation that actually has impersonation history.
 *
 * Mints a short-lived token for an existing admin purely to authenticate this
 * read. Read-only — nothing is written.
 *
 * Run: railway run --service Arthaleads node backend/scripts/verify-support-access-endpoint.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const BASE = process.env.APP_URL || "https://api.arthaleads.com";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const AuditLog = require("../models/AuditLog");
  const User = require("../models/User");

  // Pick an org that has impersonation history, so we exercise the populated
  // path rather than the empty state.
  const entry = await AuditLog.findOne({ action: "impersonate" })
    .sort({ createdAt: -1 })
    .select("targetOrg targetOrgName")
    .lean();
  if (!entry) { console.log("No impersonate entries to test against."); await mongoose.disconnect(); return; }

  const admin = await User.findOne({ orgId: entry.targetOrg, role: "admin", isActive: true })
    .select("_id name").lean();
  if (!admin) { console.log(`No active admin in ${entry.targetOrgName}.`); await mongoose.disconnect(); return; }

  console.log(`org   : ${entry.targetOrgName}`);
  console.log(`as    : ${admin.name} (admin)`);

  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "3m" });
  const res = await fetch(`${BASE}/api/org/support-access`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  console.log(`status: ${res.status}`);
  const body = await res.json();

  if (!res.ok) { console.log(JSON.stringify(body)); await mongoose.disconnect(); return; }
  console.log(`records: ${(body.records || []).length}\n`);
  for (const r of body.records || []) {
    console.log(`  ${r.accessedByName}  ·  ${new Date(r.at).toISOString()}  ·  as ${r.accessedAs}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
