/**
 * Prints the most recent Facebook lead exactly as it was stored, to confirm the
 * webhook path end-to-end: field capture, form-name resolution, and assignment.
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/check-latest-fb-lead.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  require("../models/User");
  const Lead = require("../models/Lead");

  const lead = await Lead.findOne({ source: /facebook/i })
    .sort({ createdAt: -1 })
    .populate("assignedTo", "name")
    .lean();

  if (!lead) { console.log("no facebook leads found"); await mongoose.disconnect(); return; }

  console.log(`name        : ${lead.name}`);
  console.log(`phone       : ${lead.phone}`);
  console.log(`email       : ${lead.email || "(none)"}`);
  console.log(`source      : ${lead.source}`);
  console.log(`campaign    : ${lead.campaign || "(none)"}`);
  console.log(`formName    : ${lead.formName || lead.adFormName || "(none)"}`);
  console.log(`assignedTo  : ${lead.assignedTo ? lead.assignedTo.name : "(unassigned)"}`);
  console.log(`createdAt   : ${new Date(lead.createdAt).toISOString()}`);
  console.log(`status      : ${lead.status}`);
  console.log(`\n-- all non-empty top-level fields --`);
  for (const [k, v] of Object.entries(lead)) {
    if (v === null || v === undefined || v === "" ) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (k === "activities" || k === "__v") continue;
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(`  ${k.padEnd(20)} ${s.slice(0, 160)}`);
  }
  console.log(`\nactivities  : ${(lead.activities || []).length}`);
  for (const a of (lead.activities || []).slice(0, 5)) {
    console.log(`  - ${a.type || "?"}: ${(a.note || a.description || "").slice(0, 120)}`);
  }

  await mongoose.disconnect();
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
