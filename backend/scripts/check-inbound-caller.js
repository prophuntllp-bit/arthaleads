/**
 * Diagnoses a misrouted inbound call.
 *
 * The inbound handler logged "(unknown caller)" for 918767290536 and fell back
 * to an arbitrary agent. Two different bugs produce that line, and they need
 * different fixes, so establish which one applies before changing anything:
 *
 *   a) the number IS in the DB but as a ProjectLead — the handler only queries
 *      Lead, so project leads can never match; or
 *   b) the number genuinely isn't stored anywhere — then only the fallback
 *      choice is at fault.
 *
 * Also prints who the fallback actually selects, since it sorts by createdAt
 * ascending (oldest user in the org) rather than by who does the calling.
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/check-inbound-caller.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const ORG_ID = "69e85fa021cfb72e0c389654";
const CALLER = "918767290536";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Lead = require("../models/Lead");
  const ProjectLead = require("../models/ProjectLead");
  const User = require("../models/User");

  const last10 = CALLER.replace(/\D/g, "").slice(-10);
  const q = {
    orgId: new mongoose.Types.ObjectId(ORG_ID),
    phone: { $regex: last10 + "$", $options: "i" },
  };

  console.log(`Caller ${CALLER} → matching on last10 "${last10}"\n${"=".repeat(64)}`);

  const inLead = await Lead.find({ ...q, isDeleted: { $ne: true } })
    .select("name phone assignedToName").lean();
  console.log(`\nLead collection      : ${inLead.length} match(es)`);
  inLead.forEach((l) => console.log(`   ${l.name} · ${l.phone} · assigned ${l.assignedToName || "-"}`));

  const inProject = await ProjectLead.find(q).select("name phone assignedToName projectId").lean();
  console.log(`\nProjectLead collection: ${inProject.length} match(es)`);
  inProject.forEach((l) => console.log(`   ${l.name} · ${l.phone} · assigned ${l.assignedToName || "-"} · project ${l.projectId}`));

  // Who last called this person, if anyone — this is what routing SHOULD use.
  for (const [label, doc] of [...inLead.map((d) => ["Lead", d]), ...inProject.map((d) => ["ProjectLead", d])]) {
    const Model = label === "Lead" ? Lead : ProjectLead;
    const full = await Model.findById(doc._id).select("activities").lean();
    const outbound = (full?.activities || [])
      .filter((a) => a.type === "called" && a.meta?.direction === "outbound" && a.meta?.agentPhone)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log(`\n${label} ${doc.name}: ${outbound.length} outbound call activity(ies)`);
    outbound.slice(0, 3).forEach((a) =>
      console.log(`   ${a.createdAt} by ${a.performedByName} (${a.meta.agentPhone})`));
  }

  console.log(`\n${"=".repeat(64)}\nFallback the handler currently picks (oldest active user with a phone):`);
  const fallback = await User.findOne({
    orgId: ORG_ID,
    isActive: true,
    phone: { $exists: true, $ne: "" },
    role: { $in: ["admin", "manager", "agent"] },
  }).sort({ createdAt: 1 }).select("name phone role createdAt").lean();
  console.log(`   ${fallback?.name} · ${fallback?.phone} · ${fallback?.role} · created ${fallback?.createdAt}`);

  console.log(`\nAll active users with phones in this org (creation order):`);
  const users = await User.find({
    orgId: ORG_ID, isActive: true, phone: { $exists: true, $ne: "" },
    role: { $in: ["admin", "manager", "agent"] },
  }).sort({ createdAt: 1 }).select("name phone role").lean();
  users.forEach((u, i) => console.log(`   ${i + 1}. ${u.name} · ${u.phone} · ${u.role}`));

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
