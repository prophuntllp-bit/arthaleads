// utils/storage.js — object storage on Backblaze B2, via its S3-compatible API.
//
// Replaces Cloudinary. B2 is dumb storage: it stores bytes and serves them
// back, with no transformation pipeline. That is fine here because every
// upload path already constrains its own size before sending —
//   * logos and developer logos: compressImage() in the browser, 400px / q0.82
//   * attendance selfies: ResolutionPreset.medium on the phone (~480x720)
//   * call recordings: mono 8kHz, written by callStreamRecorder
// so there is nothing left for a server-side resize to do. If an upload path
// is ever added that takes raw camera output, resize it before it gets here
// rather than reaching for a transformation service again.
//
// Uses the AWS S3 client rather than Backblaze's own SDK: B2 speaks S3, and
// that keeps a future move to any other S3 provider a config change.
//
// Configuration (Railway env):
//   B2_KEY_ID          application key id
//   B2_APP_KEY         application key
//   B2_BUCKET          bucket name, e.g. arthaleads-media
//   B2_ENDPOINT        e.g. https://s3.us-east-005.backblazeb2.com
//   B2_REGION          e.g. us-east-005  (the middle part of the endpoint)
//
// The bucket is PRIVATE. Nothing here returns a Backblaze URL: uploads return a
// key, and routes/mediaRoutes.js streams the bytes back through our own domain
// (see APP_URL). That keeps the credentials on the server, keeps third-party
// hosts out of the page entirely, and avoids Backblaze's payment requirement
// for public buckets.

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const logger = require("../config/logger");

const REQUIRED = ["B2_KEY_ID", "B2_APP_KEY", "B2_BUCKET", "B2_ENDPOINT"];

function missingConfig() {
  return REQUIRED.filter((k) => !process.env[k]);
}

let _client = null;
function client() {
  if (_client) return _client;
  const missing = missingConfig();
  if (missing.length) {
    throw new Error(`Object storage is not configured — missing ${missing.join(", ")}`);
  }
  _client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    // B2 derives the region from the endpoint host; the SDK still insists on
    // one being set, so read it back off the endpoint when it is not given.
    region: process.env.B2_REGION || (process.env.B2_ENDPOINT.match(/s3\.([a-z0-9-]+)\./) || [])[1] || "us-east-005",
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APP_KEY,
    },
  });
  return _client;
}

/** Where this API is reachable from a browser. */
function apiBase() {
  return (process.env.APP_URL || "https://api.arthaleads.com").replace(/\/+$/, "");
}

/**
 * The URL an <img> or <audio> should point at for a stored key. Served by
 * routes/mediaRoutes.js, on our own domain, from the private bucket.
 */
function publicUrl(key) {
  return `${apiBase()}/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Split a data URI into its mime type and bytes.
 * Throws on anything that is not a base64 data URI, because every caller
 * builds one and a silent pass-through would store the string itself.
 */
function decodeDataUri(dataUri) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUri || ""));
  if (!m) throw new Error("Expected a base64 data URI");
  return { contentType: m[1], buffer: Buffer.from(m[2], "base64") };
}

const EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/**
 * Store bytes and return the public URL.
 *
 * `key` is the full path inside the bucket and doubles as the identity of the
 * object: re-uploading the same key overwrites, which is what the callers that
 * pass a stable key (org logos, attendance selfies) rely on.
 */
async function put(key, buffer, contentType, { cacheSeconds = 31536000 } = {}) {
  await client().send(new PutObjectCommand({
    Bucket: process.env.B2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // A year. Every key that can change carries its own version in the path,
    // so a stale cache can only ever serve the bytes that key was created for.
    // Only reaches a browser via mediaRoutes, which sets its own copy of this.
    CacheControl: `public, max-age=${cacheSeconds}, immutable`,
  }));
  return publicUrl(key);
}

/**
 * Read an object back. Returns the raw stream plus the bits mediaRoutes needs
 * to describe it; the caller is responsible for piping and for errors on the
 * stream itself.
 */
async function getObject(key) {
  const out = await client().send(new GetObjectCommand({
    Bucket: process.env.B2_BUCKET,
    Key: key,
  }));
  return {
    body: out.Body,
    contentType: out.ContentType,
    contentLength: out.ContentLength,
    etag: out.ETag,
  };
}

async function putDataUri(key, dataUri, opts) {
  const { contentType, buffer } = decodeDataUri(dataUri);
  const ext = EXT[contentType] || "bin";
  return put(`${key}.${ext}`, buffer, contentType, opts);
}

async function remove(key) {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: process.env.B2_BUCKET, Key: key }));
  } catch (err) {
    // Deleting media is never worth failing the request that triggered it.
    logger.warn(`[storage] delete failed for ${key}: ${err.message}`);
  }
}

/** True when the env is complete enough to upload. Callers use this to fail
 *  with a clear message instead of an SDK error from three layers down. */
function isConfigured() {
  return missingConfig().length === 0;
}

module.exports = {
  put,
  putDataUri,
  remove,
  getObject,
  publicUrl,
  decodeDataUri,
  isConfigured,
  missingConfig,
};
