// routes/mediaRoutes.js — serves stored media through our own domain.
//
// The B2 bucket is PRIVATE. Nothing in the app links to backblazeb2.com; every
// image and recording URL points at api.arthaleads.com/api/media/<key> and this
// route fetches the bytes with the bucket credentials and streams them back.
//
// Three reasons that is better than a public bucket here, beyond avoiding
// Backblaze's payment requirement for public ones:
//
//   * no third-party host appears in the page, so nothing an ad blocker or a
//     privacy extension recognises can refuse to load a company's own logo
//   * the bucket credentials never leave the server, and access can be
//     tightened later in one place -- this handler -- without touching a
//     single stored URL
//   * media stays reachable if the bucket is ever moved to another provider;
//     only storage.js changes
//
// Access model: unauthenticated, but the keys for anything sensitive carry 12
// random bytes (see utils/upload.js). That is the same posture Cloudinary gave
// us and it keeps <img> tags working without cookies or CORS. An <img> cannot
// send an Authorization header, and requiring the session cookie cross-subdomain
// would break the moment a browser tightened SameSite. If attendance selfies
// ever need real access control, this is the function to add it to.
const express = require("express");
const router = express.Router();
const fs = require("fs");
const storage = require("../utils/storage");
const mediaCache = require("../utils/mediaCache");
const logger = require("../config/logger");

// A year. Every key that can change carries a version or a random segment, so
// a cached response can only ever be the bytes that URL was created for.
const CACHE = "public, max-age=31536000, immutable";
// Where utils/backup.js writes the daily database copies (same bucket).
const BACKUP_PREFIX = "arthaleads/backups/";

// Headers every media response carries, whether it comes from the server's
// copy or straight from B2.
function mediaHeaders(res, contentType, etag) {
  res.set("Accept-Ranges", "bytes");
  res.set("Content-Type", contentType || "application/octet-stream");
  if (etag) res.set("ETag", etag);
  res.set("Cache-Control", CACHE);
  // Media is embedded by the app, never navigated to. Stops a stored SVG or
  // HTML masquerading as an image from running on our own origin.
  res.set("X-Content-Type-Options", "nosniff");
  // Belt and braces for files stored before uploads were limited to images:
  // only plain image, audio, video and PDF types render inline. Anything
  // else (HTML, JavaScript, SVG) downloads, and a sandbox policy means it
  // could never run script on this origin (16 Oct 2026 audit).
  const type = String(contentType || "").toLowerCase();
  const inline = /^(image\/(png|jpe?g|webp|gif|avif)|video\/|audio\/|application\/pdf$)/.test(type);
  if (!inline) {
    res.set("Content-Disposition", "attachment");
    res.set("Content-Security-Policy", "default-src 'none'; sandbox");
  }
  // helmet() sets Cross-Origin-Resource-Policy: same-origin across the API,
  // which is right for JSON and wrong for this: app.arthaleads.com embedding
  // an image from api.arthaleads.com is cross-origin, so the browser fetched
  // it, got a 200, and threw the bytes away. Nothing in a request log shows
  // that -- curl and the server both see a perfectly successful response --
  // which is why the logo stayed missing after the URLs were correct.
  //
  // Overridden only on this route. The rest of the API keeps same-origin.
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
}

// The server's own copy (utils/mediaCache.js), whole or one byte range.
function sendCached(req, res, entry, range, key) {
  const size = entry.size;
  let start = 0, end = size - 1;
  if (range) {
    const [, a, b] = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (a === "") { start = Math.max(0, size - Number(b)); }           // "bytes=-500": the last 500
    else { start = Number(a); if (b !== "") end = Math.min(Number(b), size - 1); }
    if (start >= size || start > end) {
      res.set("Content-Range", `bytes */${size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  mediaHeaders(res, entry.contentType, entry.etag);
  res.set("Content-Length", String(end - start + 1));
  const stream = fs.createReadStream(entry.file, size ? { start, end } : {});
  stream.on("error", (err) => {
    logger.warn(`[media] cached read failed for ${key}: ${err.message}`);
    res.destroy();
  });
  stream.pipe(res);
}

router.get("/*", async (req, res) => {
  // Everything after /api/media/ is the object key. Express gives it back
  // percent-encoded exactly as the client sent it.
  // Express has already decoded the path once; a second decode of something
  // like "%E0" throws. Outside a try that rejection used to restart the whole
  // API (16 Oct 2026 audit, P0-1), so a malformed key is simply "not found".
  let key;
  try { key = decodeURIComponent(req.params[0] || ""); } catch { return res.status(404).end(); }

  // A key is built by this codebase, never by a user, so anything trying to
  // climb out of the prefix is someone poking at it.
  // Database backups live in the same bucket and are never served here.
  if (!key || key.includes("..") || !key.startsWith("arthaleads/") || key.startsWith(BACKUP_PREFIX)) {
    return res.status(404).end();
  }

  try {
    // One byte range ("bytes=start-end" or "bytes=start-") is passed through to
    // storage, so videos can be streamed and skipped through, and iPhones play
    // them at all. Anything else is ignored and the whole file is sent.
    const rangeHeader = String(req.headers.range || "");
    const range = /^bytes=\d*-\d*$/.test(rangeHeader) && rangeHeader !== "bytes=-" ? rangeHeader : null;

    // Served from the server's copy when there is one (fetched from B2 once,
    // then reused for every send to Meta, every seek, every new viewer).
    const cached = await mediaCache.obtain(key);
    if (cached) return sendCached(req, res, cached, range, key);

    const obj = await storage.getObject(key, { range });
    if (range && obj.contentRange) {
      res.status(206);
      res.set("Content-Range", obj.contentRange);
    }
    mediaHeaders(res, obj.contentType, obj.etag);
    if (obj.contentLength != null) res.set("Content-Length", String(obj.contentLength));

    obj.body.on("error", (err) => {
      logger.warn(`[media] stream failed for ${key}: ${err.message}`);
      res.destroy();
    });
    obj.body.pipe(res);
  } catch (err) {
    const code = err?.name || err?.Code || "";
    if (code === "NoSuchKey" || code === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return res.status(404).end();
    }
    if (code === "InvalidRange" || err?.$metadata?.httpStatusCode === 416) {
      return res.status(416).end();
    }
    logger.error(`[media] ${key}: ${err.message}`);
    res.status(502).end();
  }
});

module.exports = router;
