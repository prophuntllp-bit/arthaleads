#!/usr/bin/env node
/**
 * migrate-cloudinary-to-b2.js
 *
 * Copies every asset still referenced on res.cloudinary.com into the B2 bucket
 * and rewrites the reference in Mongo. Idempotent: a document whose URL no
 * longer points at Cloudinary is skipped, so it is safe to re-run after a
 * partial failure.
 *
 *   node scripts/migrate-cloudinary-to-b2.js --dry     # report only
 *   node scripts/migrate-cloudinary-to-b2.js           # do it
 *
 * Needs the B2_* env vars (see utils/storage.js) plus MONGO_URI. Cloudinary
 * credentials are NOT needed — the stored URLs are public, so the bytes are
 * fetched over plain HTTPS.
 *
 * Nothing is deleted from Cloudinary. Verify the app first, then remove the
 * assets from the Cloudinary console by hand; a script that deletes the only
 * copy of a file it has just moved is one bug away from losing all of them.
 */

require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const axios = require("axios");
const storage = require("../utils/storage");

const DRY = process.argv.includes("--dry");
const IS_CLOUDINARY = /^https?:\/\/res\.cloudinary\.com\//i;

// The bucket is public, so anything sensitive needs a key nobody can guess.
// Must match the scheme in utils/upload.js -- a migrated selfie and a newly
// uploaded one should not be reachable by different rules.
const token = () => crypto.randomBytes(12).toString("hex");

const stats = { scanned: 0, moved: 0, skipped: 0, failed: 0 };

/** Fetch a Cloudinary asset and put it in B2 under `key`. Returns the new URL. */
async function move(url, key) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 120000 });
  const contentType = res.headers["content-type"] || "application/octet-stream";
  const newUrl = await storage.put(key, Buffer.from(res.data), contentType);
  // ?v= so a browser holding the old bytes for this path cannot serve them.
  return `${newUrl}?v=${Date.now()}`;
}

/** Walk one string field on one collection. */
async function migrateField(col, field, keyFor) {
  const db = mongoose.connection.db;
  const docs = await db.collection(col).find({ [field]: IS_CLOUDINARY }).toArray();
  for (const doc of docs) {
    stats.scanned++;
    const url = doc[field];
    try {
      const key = keyFor(doc, url);
      if (DRY) { console.log(`  would move ${col}.${field} ${doc._id} -> ${key}`); stats.skipped++; continue; }
      const newUrl = await move(url, key);
      await db.collection(col).updateOne({ _id: doc._id }, { $set: { [field]: newUrl } });
      console.log(`  ${col}.${field} ${doc._id} -> ${newUrl}`);
      stats.moved++;
    } catch (err) {
      console.error(`  FAILED ${col}.${field} ${doc._id}: ${err.message}`);
      stats.failed++;
    }
  }
}

/** activities[].meta.recordingUrl lives inside an array, so it needs its own pass. */
async function migrateRecordings(col) {
  const db = mongoose.connection.db;
  const docs = await db.collection(col)
    .find({ "activities.meta.recordingUrl": IS_CLOUDINARY })
    .project({ activities: 1 })
    .toArray();

  for (const doc of docs) {
    for (let i = 0; i < (doc.activities || []).length; i++) {
      const url = doc.activities[i]?.meta?.recordingUrl;
      if (!url || !IS_CLOUDINARY.test(url)) continue;
      stats.scanned++;
      const name = url.split("/").pop().split("?")[0];
      const key = `arthaleads/recordings/${doc._id}-${i}-${token()}-${name}`;
      try {
        if (DRY) { console.log(`  would move ${col} ${doc._id} activity ${i} -> ${key}`); stats.skipped++; continue; }
        const newUrl = await move(url, key);
        await db.collection(col).updateOne(
          { _id: doc._id },
          { $set: { [`activities.${i}.meta.recordingUrl`]: newUrl } }
        );
        console.log(`  ${col} ${doc._id} activity ${i} -> ${newUrl}`);
        stats.moved++;
      } catch (err) {
        console.error(`  FAILED ${col} ${doc._id} activity ${i}: ${err.message}`);
        stats.failed++;
      }
    }
  }
}

(async () => {
  const missing = storage.missingConfig();
  if (missing.length) {
    console.error("Object storage is not configured — missing:", missing.join(", "));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log(DRY ? "DRY RUN — nothing will be written\n" : "Migrating Cloudinary assets to B2\n");

  console.log("organizations.logo");
  await migrateField("organizations", "logo", (d) => `arthaleads/logos/org-${d._id}`);

  console.log("blogposts.featuredImage");
  await migrateField("blogposts", "featuredImage",
    (d, url) => `arthaleads/blog/${d._id}-${url.split("/").pop().split("?")[0]}`);

  console.log("attendances.clockInSelfie");
  await migrateField("attendances", "clockInSelfie", (d) => `arthaleads/attendance/att-${d._id}-in-${token()}`);

  console.log("attendances.clockOutSelfie");
  await migrateField("attendances", "clockOutSelfie", (d) => `arthaleads/attendance/att-${d._id}-out-${token()}`);

  console.log("leads activity recordings");
  await migrateRecordings("leads");

  console.log("projectleads activity recordings");
  await migrateRecordings("projectleads");

  console.log("\n%s", JSON.stringify(stats));
  if (stats.failed) console.log("Re-run to retry the failures — the script skips what it already moved.");
  await mongoose.disconnect();
})().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
