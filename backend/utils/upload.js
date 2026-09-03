// utils/upload.js — media upload helpers, backed by Backblaze B2 (see storage.js).
//
// The exported names and return values are unchanged from the Cloudinary
// version: every caller still hands over a base64 data URI and gets back a
// public HTTPS URL, so nothing outside this file had to change.
//
// Two things Cloudinary did for free and B2 does not:
//
//   Resizing. Not needed — every caller already constrains its own input
//   (compressImage() in the browser at 400px/q0.82, ResolutionPreset.medium on
//   the phone). See the note at the top of storage.js before adding a path
//   that uploads raw camera output.
//
//   Cache invalidation. Cloudinary had `invalidate: true` for the keys that
//   overwrite in place. Here the object is cached for a year, so overwriting a
//   stable key would leave the old bytes in front of every browser that had
//   seen them. The stored URL therefore carries a ?v= stamp: the bytes are
//   immutable per URL, and a re-upload produces a new URL. Nothing needs
//   purging because nothing is ever served stale.

const crypto = require("crypto");
const storage = require("./storage");

/** ?v=<ms> so a re-upload to the same key is a different URL to the browser. */
const versioned = (url) => `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

// Stable keys carry no file extension on purpose: the content type is stored
// with the object and served from it, and a key that does not depend on the
// uploaded format is one a delete can name without guessing.
//
// An org logo is public branding, so a guessable key costs nothing.
const orgLogoKey = (orgId) => `arthaleads/logos/org-${orgId}`;

// Everything else gets a random segment, because the bucket is public and a
// public bucket serves any key somebody can guess.
//
// att-<userId>-<date>-in was guessable in every part: a userId is an ObjectId
// that appears in ordinary API responses and a date is a date, so anyone who
// knew the shape could walk a colleague's clock-in photos day by day. Call
// recordings are worse -- those are customer conversations. Cloudinary hid
// this by accident behind the unguessable version segment in its URLs; here it
// has to be deliberate.
//
// The full URL is stored on the record, so nothing needs to recompute these.
const token = () => crypto.randomBytes(12).toString("hex");
const selfieKey = (userId, date, leg) =>
  `arthaleads/attendance/att-${userId}-${date}-${leg}-${token()}`;

/**
 * Upload an org logo. Overwrites the org's previous logo.
 * Returns the public HTTPS URL.
 */
async function uploadOrgLogo(dataUri, orgId) {
  const { contentType, buffer } = storage.decodeDataUri(dataUri);
  const url = await storage.put(orgLogoKey(orgId), buffer, contentType);
  return versioned(url);
}

/** Delete an org logo. Never throws — see storage.remove. */
async function deleteOrgLogo(orgId) {
  await storage.remove(orgLogoKey(orgId));
}

/**
 * Upload a blog image. Each upload is its own object, so the key carries a
 * timestamp and a real extension — these get linked to from post bodies and a
 * readable filename is worth more here than a tidy key.
 */
async function uploadBlogImage(dataUri) {
  return storage.putDataUri(`arthaleads/blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dataUri);
}

/**
 * Upload a clock-in or clock-out selfie.
 * @param {string} dataUri base64 data URI
 * @param {string} userId
 * @param {string} date    "YYYY-MM-DD"
 * @param {string} leg     "in" | "out"
 */
async function uploadAttendanceSelfie(dataUri, userId, date, leg) {
  const { contentType, buffer } = storage.decodeDataUri(dataUri);
  const url = await storage.put(selfieKey(userId, date, leg), buffer, contentType);
  return versioned(url);
}

/**
 * Upload a call recording. `buffer` is raw audio bytes, not a data URI —
 * recordings arrive as files on disk or as buffers, never base64.
 */
async function uploadCallRecording(buffer, key, contentType = "audio/mpeg") {
  // Same reasoning as the selfies above: a recording of a customer call must
  // not sit at a URL that can be reached by guessing a call id.
  const dot = key.lastIndexOf(".");
  const stamped = dot > 0
    ? `${key.slice(0, dot)}-${token()}${key.slice(dot)}`
    : `${key}-${token()}`;
  return storage.put(`arthaleads/recordings/${stamped}`, buffer, contentType);
}

module.exports = {
  uploadOrgLogo,
  deleteOrgLogo,
  uploadBlogImage,
  uploadAttendanceSelfie,
  uploadCallRecording,
  isConfigured: storage.isConfigured,
};
