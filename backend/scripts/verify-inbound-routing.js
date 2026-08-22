/**
 * Replays the inbound-routing decision for a caller number against live data,
 * using the SAME logic the handler now uses, to confirm the misrouted call
 * would reach the right agent.
 *
 * The real call from 918767290536 logged "(unknown caller)" and went to the
 * oldest user in the org instead of the agent who had called that person an
 * hour earlier — because the lookup only searched Lead, and the caller exists
 * as a ProjectLead.
 *
 * Read-only. Does not place or modify any call.
 * Run: railway run --service Arthaleads node backend/scripts/verify-inbound-routing.js
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
  const phoneQuery = {
    orgId: new mongoose.Types.ObjectId(ORG_ID),
    phone: { $regex: last10 + "$", $options: "i" },
    isDeleted: { $ne: true },
  };

  // --- mirrors the patched handler ---
  let lead = await Lead.findOne(phoneQuery).select("name phone activities").lean();
  let leadIsProject = false;
  if (!lead) {
    lead = await ProjectLead.findOne(phoneQuery).select("name phone activities").lean();
    leadIsProject = !!lead;
  }

  console.log(`Caller ${CALLER}\n${"=".repeat(60)}`);
  console.log(`Matched: ${lead ? `${lead.name} (${leadIsProject ? "ProjectLead" : "Lead"})` : "NOT FOUND"}`);

  let agentPhone = null, agentName = null;
  if (lead) {
    const lastOutbound = [...(lead.activities || [])]
      .filter((a) => a.type === "called" && a.meta?.direction === "outbound" && a.meta?.agentPhone)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (lastOutbound?.meta?.agentPhone) {
      agentPhone = lastOutbound.meta.agentPhone;
      agentName = lastOutbound.performedByName;
      console.log(`Last outbound call: ${agentName} (${agentPhone}) at ${lastOutbound.createdAt}`);
    } else {
      console.log("Matched, but no outbound call activity — would use fallback.");
    }
  }

  if (!agentPhone) {
    const base = { orgId: ORG_ID, isActive: true, phone: { $exists: true, $ne: "" } };
    const fb =
      (await User.findOne({ ...base, role: "agent" }).sort({ createdAt: 1 }).select("phone name").lean()) ||
      (await User.findOne({ ...base, role: { $in: ["manager", "admin"] } }).sort({ createdAt: 1 }).select("phone name").lean());
    agentPhone = fb?.phone;
    agentName = fb?.name;
    console.log(`Fallback chosen: ${agentName} (${agentPhone})`);
  }

  console.log(`\nownerRef prefix: ${leadIsProject ? "projectlead_" : "lead_"}`);
  console.log(`\n>>> ROUTES TO: ${agentName} (${agentPhone})`);
  console.log(`    Previously went to: Pranav Nair (7020950304)`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
