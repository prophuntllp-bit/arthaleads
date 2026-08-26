// Restore `users` and `leads` from a nightly backup dump.
//
// Deliberately narrow. Organizations, projects, projectleads, attendances and
// pushsubscriptions are NOT restored: they survived, and the live copies are
// newer than the backup, so writing the backup over them would silently revert
// real changes (a renewal date, a deleted test org).
//
// Writes go through the raw driver, never the Mongoose model. User has a
// pre("save") hook that bcrypt-hashes `password`, and these passwords are
// already hashes — saving through the model would hash the hash and lock every
// account out.
//
// Dry run by default. Pass --commit to write.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const zlib = require("zlib");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

const SEED_EMAILS = ["admin@arthaleads.com", "manager@arthaleads.com", "ravi@arthaleads.com", "pooja@arthaleads.com"];
const DELETED_ON_PURPOSE = ["6a8d792131277eeb28b4fe14", "6a8e9007ae36f912ac06ac30"];

const OID_KEY = /(^_id$|Id$|By$|^assignedTo$|^project$|^user$|^lead$|^targetOrg$|^targetUser$)/;
const HEX24 = /^[0-9a-f]{24}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// JSON.stringify flattened ObjectIds and Dates to strings. Put them back, or
// every reference between documents breaks and every date sorts as text.
function revive(value, key) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => revive(v, key));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = revive(v, k);
    return out;
  }
  if (typeof value === "string") {
    if (OID_KEY.test(key) && HEX24.test(value)) return new ObjectId(value);
    if (ISO_DATE.test(value)) return new Date(value);
  }
  return value;
}

(async () => {
  const file = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!file) { console.error("usage: node scripts/restore-from-backup.js <file.json.gz> [--commit]"); process.exit(1); }

  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  console.log("backup taken:", data._meta?.createdAt);
  console.log(commit ? "MODE: COMMIT (writing)\n" : "MODE: DRY RUN (no writes)\n");

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const liveOrgIds = new Set((await db.collection("organizations").find({}, { projection: { _id: 1 } }).toArray()).map((o) => String(o._id)));

  // ── users ────────────────────────────────────────────────────────────────
  const liveUserIds = new Set((await db.collection("users").find({}, { projection: { _id: 1 } }).toArray()).map((u) => String(u._id)));
  const users = (data.users || []).filter((u) => {
    const id = String(u._id);
    if (DELETED_ON_PURPOSE.includes(id)) return false;
    if (liveUserIds.has(id)) return false;
    if (u.orgId && !liveOrgIds.has(String(u.orgId))) return false;
    return true;
  }).map((u) => revive(u, "root"));

  const withPwd = users.filter((u) => typeof u.password === "string" && u.password.startsWith("$2")).length;
  console.log("users to insert:", users.length, "| intact bcrypt hashes:", withPwd, "| google-only:", users.filter((u) => !u.password).length);

  // ── leads ────────────────────────────────────────────────────────────────
  const liveLeadIds = new Set((await db.collection("leads").find({}, { projection: { _id: 1 } }).toArray()).map((l) => String(l._id)));
  const leads = (data.leads || [])
    .filter((l) => !liveLeadIds.has(String(l._id)))
    .map((l) => revive(l, "root"));
  console.log("leads to insert:", leads.length, "| live leads preserved:", liveLeadIds.size);

  const seedCount = await db.collection("users").countDocuments({ email: { $in: SEED_EMAILS }, orgId: null });
  console.log("seed fixtures to remove:", seedCount);

  if (!commit) { console.log("\nDry run complete. Re-run with --commit to apply."); await mongoose.disconnect(); return; }

  // ── write ────────────────────────────────────────────────────────────────
  if (users.length) {
    const r = await db.collection("users").insertMany(users, { ordered: false });
    console.log("\ninserted users:", r.insertedCount);
  }
  if (leads.length) {
    let done = 0;
    for (let i = 0; i < leads.length; i += 500) {
      const r = await db.collection("leads").insertMany(leads.slice(i, i + 500), { ordered: false });
      done += r.insertedCount;
    }
    console.log("inserted leads:", done);
  }
  // Only the orphan fixtures (orgId null) — never a real account.
  const del = await db.collection("users").deleteMany({ email: { $in: SEED_EMAILS }, orgId: null });
  console.log("removed seed fixtures:", del.deletedCount);

  console.log("\n=== final state ===");
  for (const c of ["users", "leads", "organizations", "projectleads", "projects"]) {
    console.log("  " + c.padEnd(16) + (await db.collection(c).countDocuments()));
  }
  await mongoose.disconnect();
})();
