// One-time: count the files already in the bucket against the orgs that own them.
//
//   node backend/scripts/backfill-storage-ledger.js          # report only
//   node backend/scripts/backfill-storage-ledger.js --apply  # write the ledger
//
// Safe to re-run: rows are keyed by object key. Files that cannot be tied to an
// org (platform blog images, call diagnostics) are listed and left uncounted.

require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const s3 = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION || (process.env.B2_ENDPOINT.match(/s3\.([a-z0-9-]+)\./) || [])[1] || "us-east-005",
    credentials: { accessKeyId: process.env.B2_KEY_ID, secretAccessKey: process.env.B2_APP_KEY },
  });

  const objects = [];
  let token;
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: process.env.B2_BUCKET, ContinuationToken: token }));
    for (const o of out.Contents || []) objects.push({ key: o.Key, bytes: o.Size, at: o.LastModified });
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);

  const oidOf = (s) => (/^[a-f0-9]{24}$/.test(s || "") ? new mongoose.Types.ObjectId(s) : null);
  const projectOrg = new Map((await db.collection("projects").find({}, { projection: { orgId: 1 } }).toArray()).map((p) => [String(p._id), p.orgId]));
  const userOrg = new Map((await db.collection("users").find({}, { projection: { orgId: 1 } }).toArray()).map((u) => [String(u._id), u.orgId]));

  // recording key -> org, from the recordingUrl stored on lead activities
  const recOrg = new Map();
  for (const coll of ["leads", "projectleads"]) {
    const cur = db.collection(coll).find({ "activities.meta.recordingUrl": { $exists: true } }, { projection: { orgId: 1, "activities.meta.recordingUrl": 1 } });
    for await (const l of cur) {
      for (const a of l.activities || []) {
        const u = a.meta?.recordingUrl;
        if (!u) continue;
        const k = decodeURIComponent(String(u).split("/api/media/")[1] || "").split("?")[0];
        if (k) recOrg.set(k, l.orgId);
      }
    }
  }

  const orgOf = (key) => {
    let m;
    if ((m = key.match(/^arthaleads\/logos\/org-([a-f0-9]{24})/))) return oidOf(m[1]);
    if ((m = key.match(/^arthaleads\/(?:brochures|floorplans)\/project-([a-f0-9]{24})/))) return projectOrg.get(m[1]) || null;
    if ((m = key.match(/^arthaleads\/projects\/([a-f0-9]{24})\//))) return projectOrg.get(m[1]) || null;
    if ((m = key.match(/^arthaleads\/attendance\/att-([a-f0-9]{24})-/))) return userOrg.get(m[1]) || null;
    if (key.startsWith("arthaleads/recordings/")) return recOrg.get(key) || null;
    return null;
  };
  const cat = (k) => k.startsWith("arthaleads/recordings/") ? "recordings" : k.startsWith("arthaleads/attendance/") ? "attendance" : k.startsWith("arthaleads/logos/") ? "logo" : /^arthaleads\/(brochures|floorplans|projects)\//.test(k) ? "project_media" : "other";

  const names = new Map((await db.collection("organizations").find({}, { projection: { name: 1 } }).toArray()).map((o) => [String(o._id), o.name]));
  const perOrg = new Map(); const orphan = [];
  let ops = [];
  for (const o of objects) {
    const org = orgOf(o.key);
    if (!org) { orphan.push(o); continue; }
    const r = perOrg.get(String(org)) || { bytes: 0, files: 0, byCat: {} };
    r.bytes += o.bytes; r.files++; r.byCat[cat(o.key)] = (r.byCat[cat(o.key)] || 0) + o.bytes;
    perOrg.set(String(org), r);
    ops.push({ updateOne: { filter: { key: o.key }, update: { $set: { orgId: org, bytes: o.bytes, category: cat(o.key), updatedAt: new Date() }, $setOnInsert: { createdAt: o.at } }, upsert: true } });
  }

  const mb = (n) => (n / 1048576).toFixed(1) + " MB";
  console.log(`bucket objects: ${objects.length}, total ${mb(objects.reduce((s, o) => s + o.bytes, 0))}`);
  for (const [id, r] of perOrg) console.log(`  ${(names.get(id) || id).padEnd(30)} ${mb(r.bytes).padStart(10)}  ${r.files} files  ${JSON.stringify(Object.fromEntries(Object.entries(r.byCat).map(([k, v]) => [k, mb(v)])))}`);
  console.log(`uncounted (no owner): ${orphan.length} files, ${mb(orphan.reduce((s, o) => s + o.bytes, 0))}`);
  const byPrefix = {};
  for (const o of orphan) { const p = o.key.split("/").slice(0, 2).join("/"); byPrefix[p] = (byPrefix[p] || 0) + 1; }
  console.log("  by prefix:", JSON.stringify(byPrefix));

  if (APPLY && ops.length) {
    const r = await db.collection("storageobjects").bulkWrite(ops, { ordered: false });
    console.log(`ledger written: ${r.upsertedCount} new, ${r.modifiedCount} updated`);
  } else if (!APPLY) console.log("(report only, nothing written. Re-run with --apply to write the ledger.)");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
