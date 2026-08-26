// Read-only: computes exactly what a restore would change. Writes nothing.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs"), zlib = require("zlib"), mongoose = require("mongoose");

const SEED_EMAILS = ["admin@arthaleads.com","manager@arthaleads.com","ravi@arthaleads.com","pooja@arthaleads.com"];
// Deliberately deleted at 07:11 today (the test orgs you asked me to remove).
const DELETED_ON_PURPOSE = ["6a8d792131277eeb28b4fe14", "6a8e9007ae36f912ac06ac30"];

(async () => {
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const liveOrgIds = new Set((await db.collection("organizations").find({}, { projection: { _id: 1 } }).toArray()).map(o => String(o._id)));
  const liveUserIds = new Set((await db.collection("users").find({}, { projection: { _id: 1 } }).toArray()).map(u => String(u._id)));
  const liveLeadIds = new Set((await db.collection("leads").find({}, { projection: { _id: 1 } }).toArray()).map(l => String(l._id)));

  console.log("=== ORGANIZATIONS: not restoring (live data is newer) ===");
  const backupOrgs = (data.organizations || []).map(o => String(o._id));
  const orgsGone = backupOrgs.filter(id => !liveOrgIds.has(id));
  console.log("  backup:", backupOrgs.length, " live:", liveOrgIds.size);
  console.log("  in backup but not live (deleted since):", orgsGone.length);
  orgsGone.forEach(id => {
    const o = data.organizations.find(x => String(x._id) === id);
    console.log("     " + id + "  " + o.name);
  });

  console.log("\n=== USERS ===");
  let restore = 0, skipOrphan = 0, skipPurposeful = 0, alreadyThere = 0;
  const orphans = [];
  for (const u of data.users || []) {
    const id = String(u._id);
    if (DELETED_ON_PURPOSE.includes(id)) { skipPurposeful++; continue; }
    if (liveUserIds.has(id)) { alreadyThere++; continue; }
    if (u.orgId && !liveOrgIds.has(String(u.orgId))) { skipOrphan++; orphans.push(u.email); continue; }
    restore++;
  }
  console.log("  would INSERT:", restore);
  console.log("  skip (already present):", alreadyThere);
  console.log("  skip (belonged to a deleted org):", skipOrphan, orphans.length ? "-> " + orphans.join(", ") : "");
  console.log("  skip (you deleted these on purpose):", skipPurposeful);
  console.log("  would DELETE my seed fixtures:", (await db.collection("users").countDocuments({ email: { $in: SEED_EMAILS } })));

  console.log("\n=== LEADS ===");
  const backupLeads = data.leads || [];
  const newSince = [...liveLeadIds].filter(id => !backupLeads.some(l => String(l._id) === id));
  console.log("  backup:", backupLeads.length, " live:", liveLeadIds.size);
  console.log("  would INSERT:", backupLeads.filter(l => !liveLeadIds.has(String(l._id))).length);
  console.log("  live leads NOT in backup (arrived after — will be preserved):", newSince.length);
  for (const id of newSince) {
    const l = await db.collection("leads").findOne({ _id: new mongoose.Types.ObjectId(id) });
    console.log("     " + id + "  " + l.name + "  " + l.phone + "  created " + new Date(l.createdAt).toISOString());
  }

  console.log("\n=== UNTOUCHED: projects, projectleads, attendances, pushsubscriptions, organizations ===");
  await mongoose.disconnect();
})();
