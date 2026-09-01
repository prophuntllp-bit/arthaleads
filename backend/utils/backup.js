// utils/backup.js - Daily MongoDB backup → gzip → email via Resend
const zlib     = require("zlib");
const mongoose = require("mongoose");
const { Resend } = require("resend");
const logger   = require("../config/logger");
const { istDateKey } = require("./datetime");
const { layout, panel, row, paragraph, HEADING } = require("./emailLayout");

// Collections to back up (in order)
const COLLECTIONS = [
  "organizations",
  "users",
  "leads",
  "projects",
  "projectleads",
  "routingrules",
  "pushsubscriptions",
  "attendances",
];

// ── gzip helper (promisified) ─────────────────────────────────────────────────
function gzip(str) {
  return new Promise((resolve, reject) => {
    zlib.gzip(Buffer.from(str, "utf8"), (err, buf) => {
      if (err) reject(err); else resolve(buf);
    });
  });
}

// ── Format bytes nicely ───────────────────────────────────────────────────────
function fmtBytes(n) {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Build the backup email HTML ───────────────────────────────────────────────
function buildEmail(date, stats, rawSize, gzipSize) {
  const total = stats.reduce((sum, c) => sum + c.count, 0);
  const rows  = stats.map(({ name, count }) => row(name, count.toLocaleString())).join("");

  return layout({
    preheader: `${total.toLocaleString()} documents, ${fmtBytes(gzipSize)} compressed.`,
    eyebrow: "Daily backup",
    title: `Backup for ${date}`,
    bodyHtml: `
      ${paragraph(`${strongDocs(total)} across ${stats.length} collections. The archive is attached.`)}
      ${panel(
        row("Uncompressed", fmtBytes(rawSize)) +
        row("Compressed", fmtBytes(gzipSize)) +
        row("Saving", `${Math.round((1 - gzipSize / rawSize) * 100)}%`, true)
      )}
      ${panel(rows)}`,
    footerNote: "Sent to Arthaleads platform administrators.",
  });
}

const strongDocs = (n) =>
  `<strong style="color:${HEADING};">${n.toLocaleString()} documents</strong>`;

// ── Main backup function ──────────────────────────────────────────────────────
async function runBackup() {
  const BACKUP_EMAIL = process.env.BACKUP_EMAIL;
  if (!BACKUP_EMAIL) {
    logger.warn("[backup] BACKUP_EMAIL not set - skipping backup");
    return { skipped: true, reason: "BACKUP_EMAIL not configured" };
  }
  if (!process.env.RESEND_API_KEY) {
    logger.warn("[backup] RESEND_API_KEY not set - skipping backup");
    return { skipped: true, reason: "RESEND_API_KEY not configured" };
  }

  const db     = mongoose.connection.db;
  const date   = istDateKey(); // YYYY-MM-DD in IST
  const backup = { _meta: { createdAt: new Date().toISOString(), version: "1.0" } };
  const stats  = [];

  logger.info("[backup] Starting daily backup…");

  // Export each collection
  for (const name of COLLECTIONS) {
    try {
      const docs = await db.collection(name).find({}).toArray();
      backup[name] = docs;
      stats.push({ name, count: docs.length });
      logger.info(`[backup] ${name}: ${docs.length} docs`);
    } catch (err) {
      // Collection may not exist yet - skip gracefully
      logger.warn(`[backup] skipping ${name}: ${err.message}`);
      stats.push({ name, count: 0 });
    }
  }

  // Serialize + compress
  const json      = JSON.stringify(backup);
  const rawSize   = Buffer.byteLength(json, "utf8");
  const compressed = await gzip(json);
  const gzipSize  = compressed.length;

  logger.info(`[backup] Raw: ${fmtBytes(rawSize)} → Compressed: ${fmtBytes(gzipSize)}`);

  // Send email with attachment
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from:    fromAddress,
    to:      BACKUP_EMAIL,
    subject: `[Arthaleads Backup] ${date} - ${stats.reduce((s, c) => s + c.count, 0).toLocaleString()} total docs`,
    html:    buildEmail(date, stats, rawSize, gzipSize),
    attachments: [
      {
        filename: `arthaleads-backup-${date}.json.gz`,
        content:  compressed.toString("base64"),
      },
    ],
  });

  if (error) {
    logger.error(`[backup] ❌ email failed: ${error.message}`);
    throw new Error(error.message);
  }

  const totalDocs = stats.reduce((s, c) => s + c.count, 0);
  logger.info(`[backup] ✅ backup sent to ${BACKUP_EMAIL} - ${totalDocs} docs, ${fmtBytes(gzipSize)}`);

  return { success: true, date, totalDocs, rawSize, gzipSize, stats };
}

module.exports = { runBackup, buildEmail };
