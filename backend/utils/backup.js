// utils/backup.js - daily copy of the whole database into file storage (Backblaze).
//
// Every collection is written, one document per line, as Extended JSON: ids,
// dates and numbers come back as the same types on restore, which plain JSON
// cannot do. The file is gzipped and stored at
//   arthaleads/backups/db/<YYYY-MM-DD IST>.ndjson.gz
// in the media bucket. /api/media refuses that prefix, so a backup is never
// served to anyone; only scripts/restore-backup.js reads it back.
//
// Before 17 Oct 2026 this emailed 8 of the collections as plain JSON every
// night. Now nothing is emailed when a backup succeeds; BACKUP_EMAIL only gets
// a short alert (no attachment) when one fails, so a copy of every company's
// data no longer sits in a mailbox.
//
// File layout, line by line:
//   {"_meta": {version: 2, createdAt}}
//   {"c": "<collection>", "d": <document>}      (repeated)
//   {"_end": {collections: [{name, count}], totalDocs}}
// A file without the _end line was cut short and must not be restored.
//
// Kept: the newest 30 daily copies, plus the oldest copy of each of the last
// 12 months. Older ones are deleted only after the new copy is confirmed stored.
const zlib     = require("zlib");
const mongoose = require("mongoose");
const logger   = require("../config/logger");
const storage  = require("./storage");
const { istDateKey } = require("./datetime");
const { layout, paragraph } = require("./emailLayout");

const PREFIX = "arthaleads/backups/db/";
const KEEP_DAILY = 30;
const KEEP_MONTHS = 12;
const { EJSON } = mongoose.mongo.BSON;

function fmtBytes(n) {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const keyFor = (date) => `${PREFIX}${date}.ndjson.gz`;
const dateOf = (key) => (String(key).slice(PREFIX.length).match(/^(\d{4}-\d{2}-\d{2})\.ndjson\.gz$/) || [])[1] || null;

/** Write every collection into one gzipped buffer. */
async function dumpDatabase(db) {
  const gz = zlib.createGzip();
  const chunks = [];
  gz.on("data", (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => { gz.on("end", resolve); gz.on("error", reject); });
  let rawSize = 0;
  const write = async (line) => {
    rawSize += Buffer.byteLength(line) + 1;
    if (!gz.write(line + "\n")) await new Promise((r) => gz.once("drain", r));
  };

  await write(JSON.stringify({ _meta: { version: 2, createdAt: new Date().toISOString() } }));
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();
  const stats = [];
  for (const name of names) {
    let count = 0;
    for await (const doc of db.collection(name).find({})) {
      await write(EJSON.stringify({ c: name, d: doc }, { relaxed: false }));
      count++;
    }
    stats.push({ name, count });
  }
  const totalDocs = stats.reduce((s, c) => s + c.count, 0);
  await write(JSON.stringify({ _end: { collections: stats, totalDocs } }));
  gz.end();
  await finished;
  return { buffer: Buffer.concat(chunks), rawSize, stats, totalDocs };
}

/**
 * Backup keys to delete: all but the newest KEEP_DAILY copies and the oldest
 * copy of each of the last KEEP_MONTHS months (today's month included).
 */
function pickExpired(keys, today = istDateKey()) {
  const dated = keys
    .map((key) => ({ key, date: dateOf(key) }))
    .filter((x) => x.date)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  const keep = new Set(dated.slice(0, KEEP_DAILY).map((x) => x.key));
  const [y, m] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1 - KEEP_MONTHS, 1)).toISOString().slice(0, 7); // months after this are kept
  const oldestInMonth = new Map();
  for (const x of dated) {
    const month = x.date.slice(0, 7);
    if (month > cutoff) oldestInMonth.set(month, x.key); // later entries are older, so the last one wins
  }
  for (const key of oldestInMonth.values()) keep.add(key);
  return dated.filter((x) => !keep.has(x.key)).map((x) => x.key);
}

/** Alert email to BACKUP_EMAIL (failures only). */
async function sendReport(subject, bodyHtml, preheader) {
  if (!process.env.BACKUP_EMAIL || !process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = require("resend");
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>",
      to: process.env.BACKUP_EMAIL,
      subject,
      html: layout({ preheader, eyebrow: "Daily backup", title: subject.replace(/^\[Arthaleads Backup\] /, ""), bodyHtml, footerNote: "Sent to Arthaleads platform administrators." }),
    });
    if (error) logger.warn(`[backup] report email failed: ${error.message}`);
  } catch (err) {
    logger.warn(`[backup] report email failed: ${err.message}`);
  }
}

let running = false;

async function runBackup() {
  if (!storage.isConfigured()) {
    logger.warn("[backup] file storage (B2_*) is not configured - skipping backup");
    return { skipped: true, reason: "File storage is not configured" };
  }
  if (running) return { skipped: true, reason: "A backup is already running" };
  running = true;
  const date = istDateKey();
  const key = keyFor(date);
  try {
    logger.info("[backup] starting");
    const { buffer, rawSize, stats, totalDocs } = await dumpDatabase(mongoose.connection.db);
    await storage.put(key, buffer, "application/gzip", { cacheSeconds: 0 });

    // Confirm the copy is really there before anything old is deleted.
    const stored = await storage.list(PREFIX);
    const mine = stored.find((o) => o.key === key);
    if (!mine || Number(mine.size) !== buffer.length) {
      throw new Error(`stored copy not found or wrong size (${mine ? mine.size : "missing"} vs ${buffer.length})`);
    }

    const deleted = [];
    for (const old of pickExpired(stored.map((o) => o.key), date)) {
      try { await storage.removeStrict(old); deleted.push(old); }
      catch (err) { logger.warn(`[backup] could not delete ${old}: ${err.message}`); }
    }
    const kept = stored.length - deleted.length;

    logger.info(`[backup] stored ${key}: ${totalDocs} docs in ${stats.length} collections, ${fmtBytes(rawSize)} -> ${fmtBytes(buffer.length)}, ${kept} copies kept`);
    return { success: true, date, key, totalDocs, rawSize, gzipSize: buffer.length, stats, deleted, kept };
  } catch (err) {
    logger.error(`[backup] FAILED: ${err.message}`);
    await sendReport(
      `[Arthaleads Backup] ${date} - FAILED`,
      paragraph(`Today's database backup did not complete: ${String(err.message).replace(/</g, "&lt;")}. Earlier copies were not touched.`),
      "Today's backup failed.",
    );
    throw err;
  } finally {
    running = false;
  }
}

module.exports = { runBackup, dumpDatabase, pickExpired, PREFIX, keyFor, dateOf };
