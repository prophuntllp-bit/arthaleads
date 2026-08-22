/**
 * Exercises utils/leadLookup.js against live data, using a contact that is
 * known to exist ONLY as a ProjectLead (GOEL GANGA DEVELOPERS, the caller whose
 * inbound call was misrouted). Every helper must resolve it; a Lead-only query
 * returns nothing, which is the failure mode this util exists to prevent.
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/verify-lead-lookup.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const ORG_ID = "69e85fa021cfb72e0c389654";
const PHONE = "918767290536";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const { findLeadById, findLeadByPhone, searchBothLeadTypes } = require("../utils/leadLookup");
  const Lead = require("../models/Lead");

  console.log(`${"=".repeat(62)}\nfindLeadByPhone("${PHONE}")`);
  const byPhone = await findLeadByPhone(PHONE, ORG_ID, { select: "name phone" });
  console.log(`  → ${byPhone.doc ? `${byPhone.doc.name} (isProject=${byPhone.isProject})` : "NOT FOUND ❌"}`);

  // Control: the old Lead-only query, to show what the bug looked like.
  const last10 = PHONE.slice(-10);
  const leadOnly = await Lead.findOne({
    orgId: new mongoose.Types.ObjectId(ORG_ID),
    phone: { $regex: last10 + "$", $options: "i" },
  }).lean();
  console.log(`  Lead-only control → ${leadOnly ? leadOnly.name : "NOT FOUND (this was the bug)"}`);

  if (!byPhone.doc) { await mongoose.disconnect(); return; }

  console.log(`\nfindLeadById("${byPhone.doc._id}")`);
  const byId = await findLeadById(byPhone.doc._id, ORG_ID, { lean: true, select: "name" });
  console.log(`  → ${byId.doc ? `${byId.doc.name} (isProject=${byId.isProject})` : "NOT FOUND ❌"}`);

  console.log(`\nsearchBothLeadTypes by name regex "GOEL"`);
  const found = await searchBothLeadTypes(
    { orgId: new mongoose.Types.ObjectId(ORG_ID), name: { $regex: "GOEL", $options: "i" }, isDeleted: { $ne: true } },
    { select: "name", limit: 5 }
  );
  console.log(`  → ${found.length} row(s)`);
  found.forEach((r) => console.log(`     ${r.name} [_type=${r._type}]`));

  console.log(`\n${"=".repeat(62)}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
