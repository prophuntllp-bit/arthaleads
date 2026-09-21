// utils/pdfCompress.js
//
// Prepares a brochure / floor-plan PDF for WhatsApp. Policy (agreed with the team):
//   - up to 10MB → stored untouched
//   - 10MB to 15MB → re-rendered with Ghostscript to fit 10MB
//   - over 15MB → refused before any work is done
//
// Ghostscript is a system binary (installed on Railway through railpack.json).
// When it isn't there, a 10 to 15MB file is refused with an honest message
// instead of being stored oversized.
const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const MB = 1024 * 1024;
const MAX_UPLOAD_BYTES = 15 * MB;
const TARGET_MAX_BYTES = 10 * MB;
const GS = process.platform === "win32" ? "gswin64c" : "gs";
const GS_TIMEOUT_MS = 90 * 1000;

class PdfError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}

function runGs(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(GS, args, { windowsHide: true });
    let err = "";
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new PdfError("Compressing this PDF took too long. Please shrink it and try again.", 422)); }, GS_TIMEOUT_MS);
    p.stderr.on("data", (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(-10000); });
    p.on("error", (e) => { clearTimeout(timer); reject(e.code === "ENOENT" ? new PdfError("Automatic PDF compression isn't available right now. Please upload a PDF under 10MB.", 422) : e); });
    p.on("close", (code) => { clearTimeout(timer); resolve({ code, stderr: err }); });
  });
}

// One compression at a time: it is CPU heavy and the API also serves webhooks.
let chain = Promise.resolve();
const exclusive = (fn) => { const next = chain.then(fn, fn); chain = next.catch(() => {}); return next; };

async function shrink(inFile, outFile, preset) {
  const { code } = await runGs([
    "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5",
    `-dPDFSETTINGS=${preset}`, "-dDetectDuplicateImages=true", "-dCompressFonts=true",
    `-sOutputFile=${outFile}`, inFile,
  ]);
  if (code !== 0) throw new PdfError("That PDF couldn't be compressed. Try re-saving it from the original and uploading again.", 422);
  return (await fs.stat(outFile)).size;
}

/**
 * @param {Buffer} buffer raw uploaded bytes
 * @returns {Promise<{buffer: Buffer, sizeBytes: number, originalBytes: number, compressed: boolean}>}
 */
function preparePdf(buffer) {
  if (!buffer?.length) throw new PdfError("No file received.");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new PdfError(`This PDF is ${(buffer.length / MB).toFixed(1)}MB. PDFs over 15MB can't be uploaded, please shrink it first.`, 413);
  }
  if (buffer.subarray(0, 1024).toString("latin1").indexOf("%PDF-") === -1) {
    throw new PdfError("That file isn't a valid PDF.", 422);
  }
  if (buffer.length <= TARGET_MAX_BYTES) {
    return Promise.resolve({ buffer, sizeBytes: buffer.length, originalBytes: buffer.length, compressed: false });
  }
  return exclusive(async () => {
    const id = crypto.randomBytes(6).toString("hex");
    const inFile = path.join(os.tmpdir(), `pp-in-${id}.pdf`);
    const outFile = path.join(os.tmpdir(), `pp-out-${id}.pdf`);
    try {
      await fs.writeFile(inFile, buffer);
      let size = await shrink(inFile, outFile, "/ebook");
      if (size > TARGET_MAX_BYTES) size = await shrink(inFile, outFile, "/screen");
      if (size > TARGET_MAX_BYTES) throw new PdfError("Couldn't shrink this PDF under 10MB. Please upload a smaller version.", 422);
      // Never hand back something bigger than what came in.
      if (size >= buffer.length) throw new PdfError("This PDF can't be made smaller. Please upload a version under 10MB.", 422);
      return { buffer: await fs.readFile(outFile), sizeBytes: size, originalBytes: buffer.length, compressed: true };
    } finally {
      fs.rm(inFile, { force: true }).catch(() => {});
      fs.rm(outFile, { force: true }).catch(() => {});
    }
  });
}

module.exports = { preparePdf, PdfError, MAX_UPLOAD_BYTES, TARGET_MAX_BYTES };
