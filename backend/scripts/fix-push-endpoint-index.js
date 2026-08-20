/**
 * Fixes the root cause of mobile push notifications silently failing since
 * FCM support was added: models/PushSubscription.js changed `endpoint` from
 * `{ required: true, unique: true }` to a separate sparse unique index back
 * in commit b365d51, but Mongoose never alters an existing index — the OLD
 * non-sparse unique index on `endpoint` stayed live in Atlas.
 *
 * Every FCM subscription document has no `endpoint` field at all, so after
 * the first device ever registered, every subsequent POST /push/fcm-token
 * collided on `endpoint: null` under that stale index and failed with
 * E11000 (surfaced to the app as a 500). Confirmed live: 1 of 38 push
 * subscriptions was FCM.
 *
 * This drops the stale `endpoint_1` (unique, non-sparse) index and recreates
 * it matching the current schema (unique + sparse) — no documents touched.
 *
 * Run:             node backend/scripts/fix-push-endpoint-index.js
 * Apply for real:  node backend/scripts/fix-push-endpoint-index.js --apply
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const coll = mongoose.connection.db.collection("pushsubscriptions");

  const before = await coll.indexes();
  const stale = before.find((i) => i.name === "endpoint_1" && !i.sparse);

  if (!stale) {
    console.log("No stale non-sparse endpoint_1 index found — nothing to fix.");
    await mongoose.disconnect();
    return;
  }

  console.log("Found stale index:", JSON.stringify(stale));

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing changed. Re-run with --apply to drop + recreate it as sparse.`);
    await mongoose.disconnect();
    return;
  }

  await coll.dropIndex("endpoint_1");
  console.log("Dropped stale endpoint_1 index.");

  await coll.createIndex({ endpoint: 1 }, { unique: true, sparse: true });
  console.log("Recreated endpoint_1 as unique + sparse.");

  const after = await coll.indexes();
  console.log("\nIndexes now:", JSON.stringify(after, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
