// Daily database backup: every collection goes to file storage in a format that
// restores with the same types, old copies are pruned only after the new one is
// confirmed, backups are never served by /api/media, and the restore script
// refuses incomplete copies, non-empty targets and the live database.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
const zlib = require("zlib");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { agent: false }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); }).on("error", reject);
  });
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  const base = mongod.getUri();
  const liveUri = `${base}live`;
  await mongoose.connect(liveUri);
  const db = mongoose.connection.db;

  // In-memory stand-in for the bucket.
  const storage = require("../utils/storage");
  const bucket = new Map();
  let reportWrongSize = false;
  storage.isConfigured = () => true;
  storage.put = async (key, buffer) => { bucket.set(key, Buffer.from(buffer)); return key; };
  storage.list = async (prefix) => [...bucket.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, size: reportWrongSize ? 1 : bucket.get(k).length, lastModified: new Date() }));
  storage.removeStrict = async (key) => { bucket.delete(key); };
  storage.getObject = async (key) => { if (!bucket.has(key)) { const e = new Error("NoSuchKey"); e.name = "NoSuchKey"; throw e; } return { body: require("stream").Readable.from([bucket.get(key)]) }; };

  const backup = require("../utils/backup");
  console.log("\nDaily database backup\n");

  const orgId = new mongoose.Types.ObjectId();
  const when = new Date("2026-10-17T06:30:00Z");
  await db.collection("organizations").insertOne({ _id: orgId, name: "Prophunt LLP", createdAt: when, credits: 1250, rate: 0.75 });
  await db.collection("leads").insertMany(Array.from({ length: 1200 }, (_, i) => ({ orgId, name: `Lead ${i}`, phone: `9${String(i).padStart(9, "0")}`, createdAt: when, tags: ["a", "b"], meta: { score: i } })));
  await db.collection("wamessages").insertOne({ orgId, direction: "inbound", body: "Namaste <b>hi</b>", createdAt: when });
  await db.createCollection("emptyones");

  // Old copies: 40 consecutive days before today plus one in each of the 14 earlier months.
  const today = require("../utils/datetime").istDateKey();
  const day = (n) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  for (let n = 1; n <= 40; n++) bucket.set(backup.keyFor(day(n)), Buffer.from("old"));
  for (let m = 2; m <= 15; m++) { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m); bucket.set(backup.keyFor(d.toISOString().slice(0, 10)), Buffer.from("old")); }
  bucket.set("arthaleads/avatars/someone.jpg", Buffer.from("photo"));

  const result = await backup.runBackup();
  const key = backup.keyFor(today);
  check(result.success && bucket.has(key) && result.key === key, "today's copy is stored under arthaleads/backups/db/<IST date>", result.key);
  const names = result.stats.map((s) => s.name);
  check(["emptyones", "leads", "organizations", "wamessages"].every((n) => names.includes(n)) && result.totalDocs === 1202, "every collection is included, empty ones too", JSON.stringify(result.stats));

  const left = [...bucket.keys()].filter((k) => k.startsWith(backup.PREFIX)).map(backup.dateOf).sort().reverse();
  const daily = left.filter((d) => d >= day(29));
  check(daily.length === 30 && left.includes(today), "the newest 30 daily copies are kept", `${daily.length}`);
  const months = new Set(left.map((d) => d.slice(0, 7)));
  check(months.size >= 12 && months.size <= 13, "one copy per month is kept for a year", `${months.size} months: ${[...months].sort().join(",")}`);
  const oldest = left[left.length - 1];
  const yearAgo = new Date(`${today}T00:00:00Z`); yearAgo.setUTCMonth(yearAgo.getUTCMonth() - 12);
  check(oldest.slice(0, 7) > yearAgo.toISOString().slice(0, 7), "copies older than 12 months are deleted", oldest);
  check(bucket.has("arthaleads/avatars/someone.jpg"), "nothing outside the backup folder is touched");

  // The stored copy must not be deleted or replaced by pruning when the upload can't be confirmed.
  const before = new Set(bucket.keys());
  reportWrongSize = true;
  let threw = false;
  try { await backup.runBackup(); } catch { threw = true; }
  reportWrongSize = false;
  check(threw && [...before].every((k) => bucket.has(k)), "if the new copy can't be confirmed, the run fails and no old copy is deleted");

  // /api/media never serves a backup.
  const express = require("express");
  let mediaReads = 0;
  const realGet = storage.getObject;
  storage.getObject = async (...a) => { mediaReads++; return realGet(...a); };
  const app = express();
  app.use("/api/media", require("../routes/mediaRoutes"));
  const server = app.listen(0);
  const port = server.address().port;
  const s1 = await get(`http://127.0.0.1:${port}/api/media/${key}`);
  const s2 = await get(`http://127.0.0.1:${port}/api/media/arthaleads%2Fbackups%2Fdb%2F${today}.ndjson.gz`);
  check(s1 === 404 && s2 === 404 && mediaReads === 0, "the media link answers 404 for backups without reading them", `${s1} ${s2} reads=${mediaReads}`);
  server.closeAllConnections?.(); await new Promise((r) => server.close(r));
  storage.getObject = realGet;

  // Restore with the script, from a downloaded file, into a fresh database.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "artha-backup-"));
  const file = path.join(tmp, `${today}.ndjson.gz`);
  fs.writeFileSync(file, bucket.get(key));
  const script = path.join(__dirname, "..", "scripts", "restore-backup.js");
  const run = (args) => {
    try { return { ok: true, out: execFileSync(process.execPath, [script, ...args], { env: { ...process.env, MONGO_URI: liveUri }, encoding: "utf8", stdio: "pipe" }) }; }
    catch (e) { return { ok: false, out: String(e.stdout) + String(e.stderr) }; }
  };

  const look = run([file]);
  check(look.ok && /complete, 1202 documents/.test(look.out), "checking a copy reports it complete with its counts and writes nothing", look.out.slice(0, 120));

  const restoredUri = `${base}restored`;
  const dry = run([file, "--into", restoredUri]);
  const restoredDb = mongoose.connection.client.db("restored");
  check(dry.ok && (await restoredDb.collection("leads").countDocuments()) === 0, "--into without --apply writes nothing");

  const done = run([file, "--into", restoredUri, "--apply"]);
  check(done.ok && /restored 1202 documents/.test(done.out), "--apply loads the copy into an empty database", done.out.slice(-200));
  const org = await restoredDb.collection("organizations").findOne({ _id: orgId });
  check(org && org._id instanceof mongoose.Types.ObjectId && org.createdAt instanceof Date && org.createdAt.getTime() === when.getTime(), "ids and dates come back as ids and dates, not text", JSON.stringify(org));
  check(org && org.credits === 1250 && org.rate === 0.75, "numbers come back as numbers");
  const lead = await restoredDb.collection("leads").findOne({ name: "Lead 7" });
  check(lead && lead.orgId.equals(orgId) && lead.meta.score === 7 && lead.tags.length === 2, "nested fields and links between records survive");
  const msg = await restoredDb.collection("wamessages").findOne({});
  check(msg && msg.body === "Namaste <b>hi</b>", "text is kept exactly");

  const again = run([file, "--into", restoredUri, "--apply"]);
  check(!again.ok && /already has/.test(again.out), "a target that already has data is refused", again.out.slice(0, 160));
  const replace = run([file, "--into", restoredUri, "--apply", "--replace"]);
  check(replace.ok && (await restoredDb.collection("leads").countDocuments()) === 1200, "--replace empties and reloads the collections");

  const live = run([file, "--into", liveUri, "--apply", "--replace"]);
  check(!live.ok && /live database/.test(live.out), "restoring over the live database is refused", live.out.slice(0, 160));

  // A copy that was cut short is refused before anything is written.
  const lines = zlib.gunzipSync(bucket.get(key)).toString().trim().split("\n");
  const cut = path.join(tmp, "cut.ndjson.gz");
  fs.writeFileSync(cut, zlib.gzipSync(lines.slice(0, -1).join("\n") + "\n"));
  const emptyUri = `${base}empty2`;
  const bad = run([cut, "--into", emptyUri, "--apply"]);
  check(!bad.ok && /incomplete/.test(bad.out) && (await mongoose.connection.client.db("empty2").collection("leads").countDocuments()) === 0, "an incomplete copy is refused and nothing is written", bad.out.slice(0, 160));

  // Not configured: skipped, not crashed.
  storage.isConfigured = () => false;
  const skipped = await backup.runBackup();
  check(skipped.skipped === true, "without file storage settings the backup is skipped with a reason");

  fs.rmSync(tmp, { recursive: true, force: true });
  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all backup checks passed\n");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
