// utils/mediaCache.js — a copy on the server's disk of media fetched from B2.
//
// Why (21 Oct 2026): on 17 Oct the bucket hit Backblaze's free daily caps
// (1 GB of downloads, 2,500 Class B calls) and media stopped loading. Browsers
// already cache our files for a year, so the repeats come from elsewhere:
// Meta downloads a photo or video from our URL every time the bot sends it to
// a customer, and every seek in a video is a separate ranged request. With
// this cache each file is fetched from B2 once per server start, then served
// from local disk, ranges included.
//
// Plain files in a temp folder with an in-memory index, least recently used
// dropped first once the total passes the limit. The folder is emptied at
// start, so the index and the disk always agree. Two requests for the same
// missing file share one B2 fetch.
//
// MEDIA_CACHE_MB          total size, default 1024 (0 switches the cache off)
// MEDIA_CACHE_MAX_FILE_MB files larger than this are streamed from B2 as before, default 100
// MEDIA_CACHE_DIR         folder, default <os temp>/arthaleads-media-cache
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const storage = require("./storage");
const logger = require("../config/logger");

const MB = 1024 * 1024;
const LIMIT = Number(process.env.MEDIA_CACHE_MB ?? 1024) * MB;
const MAX_FILE = Number(process.env.MEDIA_CACHE_MAX_FILE_MB ?? 100) * MB;
const DIR = process.env.MEDIA_CACHE_DIR || path.join(os.tmpdir(), "arthaleads-media-cache");

const entries = new Map();   // key -> { file, size, contentType, etag, used }
const filling = new Map();   // key -> Promise of an entry, while B2 is being read
const tooBig = new Set();    // keys known to be over MAX_FILE: never fetched whole again
let total = 0;
let ready = false;
const stats = { hits: 0, misses: 0, bypass: 0 };

function enabled() { return LIMIT > 0; }

function init() {
  if (ready) return;
  ready = true;
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
}

function drop(key) {
  const e = entries.get(key);
  if (!e) return;
  entries.delete(key);
  total -= e.size;
  // A reader that already opened the file keeps reading it (unlink only
  // removes the name), so eviction never cuts a response short.
  fs.rm(e.file, { force: true }, () => {});
}

function evict() {
  if (total <= LIMIT) return;
  const oldest = [...entries].sort((a, b) => a[1].used - b[1].used);
  for (const [key] of oldest) {
    if (total <= LIMIT) break;
    drop(key);
  }
}

// The cached copy of a key, or null.
function get(key) {
  const e = entries.get(key);
  if (!e) return null;
  e.used = Date.now();
  stats.hits++;
  return e;
}

// Fetch the whole object from B2 onto disk. Resolves to the entry, or to null
// when the file is too big to keep (the caller then streams it as before).
// Errors (a missing key, B2 down) reach the caller unchanged.
function fill(key) {
  if (filling.has(key)) return filling.get(key);
  const job = (async () => {
    init();
    stats.misses++;
    const obj = await storage.getObject(key);
    if (obj.contentLength != null && obj.contentLength > MAX_FILE) {
      obj.body.destroy?.();
      tooBig.add(key);
      return null;
    }
    const file = path.join(DIR, crypto.createHash("sha1").update(key).digest("hex"));
    const tmp = `${file}.${process.pid}.${Date.now()}.part`;
    try {
      await pipeline(obj.body, fs.createWriteStream(tmp));
      const size = fs.statSync(tmp).size;
      if (size > MAX_FILE) { fs.rmSync(tmp, { force: true }); tooBig.add(key); return null; }
      fs.renameSync(tmp, file);
      drop(key);
      const e = { file, size, contentType: obj.contentType, etag: obj.etag, used: Date.now() };
      entries.set(key, e);
      total += size;
      evict();
      return entries.get(key) || null; // evicted at once only if bigger than the whole cache
    } catch (err) {
      fs.rm(tmp, { force: true }, () => {});
      throw err;
    }
  })().finally(() => filling.delete(key));
  filling.set(key, job);
  return job;
}

// Cached entry for key, fetching it if needed; null means "don't cache this
// one, stream it from B2".
async function obtain(key) {
  if (!enabled()) return null;
  if (tooBig.has(key)) { stats.bypass++; return null; }
  return get(key) || fill(key);
}

function status() {
  return { enabled: enabled(), files: entries.size, bytes: total, limit: LIMIT, ...stats };
}

// Tests only.
function _reset() {
  for (const k of [...entries.keys()]) drop(k);
  tooBig.clear();
  Object.assign(stats, { hits: 0, misses: 0, bypass: 0 });
}

if (!enabled()) logger.info?.("[media-cache] off (MEDIA_CACHE_MB=0)");

module.exports = { obtain, get, status, enabled, _reset };
