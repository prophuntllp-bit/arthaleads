// scripts/restore-backup.js - read back a database copy made by utils/backup.js.
//
//   node scripts/restore-backup.js --list
//       the copies in file storage, newest first
//   node scripts/restore-backup.js 2026-10-17
//   node scripts/restore-backup.js ./2026-10-17.ndjson.gz
//       check a copy (from storage, or a downloaded file): complete or not,
//       and how many documents per collection. Writes nothing.
//   node scripts/restore-backup.js 2026-10-17 --download ./2026-10-17.ndjson.gz
//       save the copy to a local file
//   node scripts/restore-backup.js 2026-10-17 --into "<mongodb uri>" --apply
//       load it into the database at that address. Every collection there
//       must be empty, unless --replace is added (each collection in the copy
//       is then emptied first). The live database (MONGO_URI) is refused
//       unless --overwrite-production is added as well: restoring over live
//       data throws away everything written since the copy was made.
//
// Reads from storage need the B2_* settings (run it from the Railway console,
// or locally with them in .env).
require("dotenv").config();
const fs = require("fs");
const zlib = require("zlib");
const readline = require("readline");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const { EJSON } = mongoose.mongo.BSON;
const { PREFIX, keyFor, dateOf } = require("../utils/backup");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const source = args.find((a, i) => !a.startsWith("--") && !["--into", "--download"].includes(args[i - 1]));

function sameDatabase(a, b) {
  const norm = (uri) => {
    try {
      const u = new URL(uri.replace(/^mongodb\+srv:/, "http:").replace(/^mongodb:/, "http:"));
      return `${u.hostname.toLowerCase()}/${u.pathname.replace(/^\//, "") || "test"}`;
    } catch { return uri; }
  };
  return Boolean(a && b) && norm(a) === norm(b);
}

async function openSource() {
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    const storage = require("../utils/storage");
    if (!storage.isConfigured()) throw new Error("file storage (B2_*) is not configured here");
    const obj = await storage.getObject(keyFor(source));
    return obj.body instanceof Readable ? obj.body : Readable.from(obj.body);
  }
  if (!fs.existsSync(source)) throw new Error(`no such file: ${source}`);
  return fs.createReadStream(source);
}

/** Calls onDoc(collection, doc) for each document; returns { meta, end, counts }. */
async function readCopy(onDoc) {
  const lines = readline.createInterface({ input: (await openSource()).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let meta = null, end = null;
  const counts = {};
  for await (const line of lines) {
    if (!line) continue;
    if (end) throw new Error("data found after the end marker - the file is damaged");
    if (!meta) { meta = JSON.parse(line)._meta; if (!meta) throw new Error("not a backup file (no _meta line)"); continue; }
    if (line.startsWith('{"_end"')) { end = JSON.parse(line)._end; continue; }
    const { c, d } = EJSON.parse(line, { relaxed: false });
    counts[c] = (counts[c] || 0) + 1;
    if (onDoc) await onDoc(c, d);
  }
  if (!end) throw new Error("the copy is incomplete (no end marker) - do not restore it");
  for (const { name, count } of end.collections) {
    if ((counts[name] || 0) !== count) throw new Error(`${name}: file has ${counts[name] || 0} documents, end marker says ${count}`);
  }
  return { meta, end, counts };
}

(async () => {
  if (flag("--list")) {
    const storage = require("../utils/storage");
    const copies = (await storage.list(PREFIX)).filter((o) => dateOf(o.key)).sort((a, b) => b.key.localeCompare(a.key));
    for (const o of copies) console.log(`  ${dateOf(o.key)}  ${(o.size / 1048576).toFixed(2)} MB`);
    console.log(`${copies.length} copies`);
    return;
  }
  if (!source) { console.log("Usage: see the top of scripts/restore-backup.js"); process.exitCode = 1; return; }

  if (option("--download")) {
    const out = option("--download");
    const input = await openSource();
    await new Promise((resolve, reject) => input.pipe(fs.createWriteStream(out)).on("finish", resolve).on("error", reject));
    console.log(`saved to ${out}`);
    return;
  }

  const into = option("--into");
  if (!into || !flag("--apply")) {
    const { meta, end } = await readCopy();
    console.log(`Copy made ${meta.createdAt}: complete, ${end.totalDocs} documents in ${end.collections.length} collections.`);
    for (const { name, count } of end.collections) console.log(`  ${name}: ${count}`);
    if (into) console.log("\nNothing was written. Add --apply to load it into that database.");
    return;
  }

  if (sameDatabase(into, process.env.MONGO_URI || process.env.MONGODB_URI) && !flag("--overwrite-production")) {
    throw new Error("--into is the live database. Restore into a new database first and check it; add --overwrite-production only if you really mean to replace live data.");
  }

  // Check the whole copy before touching the target.
  const { end } = await readCopy();
  const client = await new mongoose.mongo.MongoClient(into).connect();
  try {
    const db = client.db();
    for (const { name } of end.collections) {
      const existing = await db.collection(name).estimatedDocumentCount();
      if (existing && !flag("--replace")) throw new Error(`${name} already has ${existing} documents in the target. Use an empty database, or add --replace.`);
    }
    if (flag("--replace")) for (const { name } of end.collections) await db.collection(name).deleteMany({});

    const batches = {};
    const flush = async (name) => {
      const docs = batches[name];
      if (docs && docs.length) { await db.collection(name).insertMany(docs, { ordered: false }); batches[name] = []; }
    };
    await readCopy(async (name, doc) => {
      (batches[name] ||= []).push(doc);
      if (batches[name].length >= 500) await flush(name);
    });
    for (const name of Object.keys(batches)) await flush(name);

    for (const { name, count } of end.collections) {
      const n = await db.collection(name).countDocuments();
      console.log(`  ${n === count ? "ok  " : "DIFF"}  ${name}: ${n} of ${count}`);
    }
    console.log(`restored ${end.totalDocs} documents into ${db.databaseName}`);
  } finally {
    await client.close();
  }
})().catch((err) => { console.error(`FAILED: ${err.message}`); process.exitCode = 1; });
