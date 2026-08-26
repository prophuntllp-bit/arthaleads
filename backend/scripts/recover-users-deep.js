// Exhaustive read-only scan: every collection, every email, every userId
// reference. Writes nothing.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const EMAIL_RX = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
const HEX24 = /^[0-9a-f]{24}$/i;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const cols = (await db.listCollections().toArray()).map((c) => c.name);

  const emailsBySource = new Map(); // email -> Set(collection)
  const userRefs = new Map();       // id -> Set("collection.field")

  const walk = (val, key, col, out) => {
    if (val == null) return;
    if (val instanceof mongoose.Types.ObjectId || (val && val._bsontype === "ObjectID")) {
      if (/user|assignedto|createdby|performedby|targetuser|updatedby|by$|owner/i.test(key)) {
        const k = String(val);
        if (!userRefs.has(k)) userRefs.set(k, new Set());
        userRefs.get(k).add(col + "." + key);
      }
      return;
    }
    if (typeof val === "string") {
      const m = val.match(EMAIL_RX);
      if (m) m.forEach((e) => {
        e = e.toLowerCase();
        if (!emailsBySource.has(e)) emailsBySource.set(e, new Set());
        emailsBySource.get(e).add(col);
      });
      if (HEX24.test(val) && /user|assignedto|createdby|by$/i.test(key)) {
        if (!userRefs.has(val)) userRefs.set(val, new Set());
        userRefs.get(val).add(col + "." + key);
      }
      return;
    }
    if (Array.isArray(val)) { val.forEach((v) => walk(v, key, col, out)); return; }
    if (typeof val === "object") {
      for (const [k, v] of Object.entries(val)) walk(v, k, col, out);
    }
  };

  for (const col of cols) {
    const docs = await db.collection(col).find({}).limit(5000).toArray();
    docs.forEach((d) => walk(d, col, col));
  }

  console.log("=== every email address anywhere in the database ===");
  [...emailsBySource.entries()].sort().forEach(([e, srcs]) =>
    console.log("  " + e.padEnd(38) + [...srcs].join(", ")));

  console.log("\n=== distinct user ids still referenced ===", userRefs.size);
  [...userRefs.entries()].slice(0, 40).forEach(([id, s]) =>
    console.log("  " + id + "  " + [...s].slice(0, 4).join(", ")));

  // Does any trace of the locked-out admin exist?
  console.log("\n=== searching for the locked-out admin ===");
  for (const needle of ["abhighadge", "abhishek"]) {
    const hits = [];
    for (const col of cols) {
      const docs = await db.collection(col).find({}).limit(5000).toArray();
      for (const d of docs) {
        if (JSON.stringify(d).toLowerCase().includes(needle)) { hits.push(col); break; }
      }
    }
    console.log("  '" + needle + "' appears in:", hits.length ? hits.join(", ") : "NOTHING");
  }

  await mongoose.disconnect();
})();
