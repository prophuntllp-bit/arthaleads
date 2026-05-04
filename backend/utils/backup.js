// utils/backup.js — Daily MongoDB backup → gzip → email via Resend
const zlib     = require("zlib");
const mongoose = require("mongoose");
const { Resend } = require("resend");
const logger   = require("../config/logger");

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
  const rows = stats.map(({ name, count }) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e;color:#d1d0cf;font-family:monospace">${name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e;color:#ff6b00;text-align:right;font-weight:600">${count.toLocaleString()}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Inter,Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:0 16px">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:24px">
    <img src="https://www.arthaleads.com/logo.png" width="48" height="48"
         style="border-radius:12px" alt="Arthaleads"/>
    <div style="font-size:18px;font-weight:800;color:#1e1d20;margin-top:8px">
      Artha<span style="color:#ff6b00">leads</span>
    </div>
  </div>

  <!-- Card -->
  <div style="background:#1e1d20;border-radius:20px;padding:32px;
              border:1px solid rgba(255,107,0,0.18);
              box-shadow:0 0 40px rgba(255,107,0,0.08)">

    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:36px;margin-bottom:8px">🗄️</div>
      <h2 style="margin:0;font-size:20px;font-weight:800;color:#ffffff">
        Daily Backup Complete
      </h2>
      <p style="margin:6px 0 0;font-size:13px;color:#888">${date}</p>
    </div>

    <hr style="border:none;border-top:1px solid #2a2a2e;margin:20px 0"/>

    <!-- Stats table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr>
          <th style="padding:8px 12px;text-align:left;color:#666;font-size:11px;
                     text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2a2a2e">
            Collection
          </th>
          <th style="padding:8px 12px;text-align:right;color:#666;font-size:11px;
                     text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2a2a2e">
            Documents
          </th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Size info -->
    <div style="background:#111113;border-radius:12px;padding:14px 16px;
                display:flex;justify-content:space-between;margin-bottom:24px">
      <div style="text-align:center;flex:1">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Raw size</div>
        <div style="font-size:15px;font-weight:700;color:#d1d0cf">${fmtBytes(rawSize)}</div>
      </div>
      <div style="width:1px;background:#2a2a2e"></div>
      <div style="text-align:center;flex:1">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Compressed</div>
        <div style="font-size:15px;font-weight:700;color:#ff6b00">${fmtBytes(gzipSize)}</div>
      </div>
    </div>

    <p style="font-size:12px;color:#555;text-align:center;margin:0">
      Backup attached as <strong style="color:#888">arthaleads-backup-${date}.json.gz</strong><br/>
      To restore: decompress the file and import using <code style="color:#ff6b00">mongorestore</code> or MongoDB Compass.
    </p>
  </div>

  <p style="text-align:center;font-size:11px;color:#aaa;margin-top:20px">
    © ${new Date().getFullYear()} Arthaleads · Automated backup · Do not reply
  </p>
</div>
</body></html>`;
}

// ── Main backup function ──────────────────────────────────────────────────────
async function runBackup() {
  const BACKUP_EMAIL = process.env.BACKUP_EMAIL;
  if (!BACKUP_EMAIL) {
    logger.warn("[backup] BACKUP_EMAIL not set — skipping backup");
    return { skipped: true, reason: "BACKUP_EMAIL not configured" };
  }
  if (!process.env.RESEND_API_KEY) {
    logger.warn("[backup] RESEND_API_KEY not set — skipping backup");
    return { skipped: true, reason: "RESEND_API_KEY not configured" };
  }

  const db     = mongoose.connection.db;
  const date   = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
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
      // Collection may not exist yet — skip gracefully
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
    subject: `[Arthaleads Backup] ${date} — ${stats.reduce((s, c) => s + c.count, 0).toLocaleString()} total docs`,
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
  logger.info(`[backup] ✅ backup sent to ${BACKUP_EMAIL} — ${totalDocs} docs, ${fmtBytes(gzipSize)}`);

  return { success: true, date, totalDocs, rawSize, gzipSize, stats };
}

module.exports = { runBackup };
