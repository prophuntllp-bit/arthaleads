/**
 * Diagnostic: dump the live MongoDB indexes on pushsubscriptions.
 *
 * models/PushSubscription.js changed `endpoint` from
 * `{ required: true, unique: true }` (April) to a separate sparse unique
 * index (June, commit b365d51) when FCM support was added — but Mongoose
 * never drops/alters an existing index automatically, so if the OLD
 * non-sparse unique index on `endpoint` is still live in Atlas, every FCM
 * subscription document (which has no `endpoint` field at all) collides on
 * `endpoint: null` after the first one, causing E11000 on every subsequent
 * POST /push/fcm-token.
 *
 * Run: node backend/scripts/check-push-indexes.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const idx = await mongoose.connection.db.collection("pushsubscriptions").indexes();
  console.log(JSON.stringify(idx, null, 2));

  const count = await mongoose.connection.db.collection("pushsubscriptions").countDocuments();
  const fcmCount = await mongoose.connection.db.collection("pushsubscriptions").countDocuments({ type: "fcm" });
  console.log(`\nTotal subscriptions: ${count}, FCM subscriptions: ${fcmCount}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
