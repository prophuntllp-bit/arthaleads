// utils/waInboundMedia.js — photos, voice notes, videos and documents a
// customer sends on WhatsApp, copied into our own storage.
//
// Meta's webhook carries only a media id; the file has to be fetched with the
// business token (Graph API: the id gives a short-lived URL, the URL gives the
// bytes). Until 22 Oct 2026 nothing fetched it, so every customer photo showed
// as an empty bubble with "[Image]" saved and nothing else; and since Meta
// sends the id only once, those files can't be recovered later.
//
// Saved privately in the media bucket (served through /api/media like every
// other file), counted against the company's storage. Meta direct only: the
// other providers deliver media differently.
const axios = require("axios");
const crypto = require("crypto");
const storage = require("./storage");

const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_BYTES = 16 * 1024 * 1024; // WhatsApp's own limit for most media
const EXT = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

/**
 * Fetch one inbound media file and store it. Returns
 * { url, buffer, contentType, size } or null (not Meta, no id, too big, or
 * Meta refused). Never throws.
 */
async function fetchAndStore(org, { mediaId, mimeType, filename } = {}) {
  const wa = org?.whatsapp || {};
  if (!mediaId || (wa.provider && wa.provider !== "meta") || !wa.apiKey) return null;
  const auth = { Authorization: `Bearer ${wa.apiKey}` };
  try {
    const { data: info } = await axios.get(`${GRAPH}/${encodeURIComponent(mediaId)}`, { headers: auth, timeout: 10000 });
    if (!info?.url || (info.file_size && info.file_size > MAX_BYTES)) return null;
    const res = await axios.get(info.url, { headers: auth, responseType: "arraybuffer", timeout: 20000, maxContentLength: MAX_BYTES });
    const buffer = Buffer.from(res.data);
    if (!buffer.length || buffer.length > MAX_BYTES) return null;
    const contentType = String(info.mime_type || mimeType || res.headers?.["content-type"] || "application/octet-stream").split(";")[0].trim();
    const fromName = /\.([a-z0-9]{2,5})$/i.exec(String(filename || ""))?.[1]?.toLowerCase();
    const ext = EXT[contentType] || fromName || "bin";
    const month = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);
    // Random part: these are private customer files behind an unauthenticated route.
    const key = `arthaleads/wa-inbound/${org._id}/${month}/${crypto.randomBytes(12).toString("hex")}.${ext}`;
    const url = await storage.put(key, buffer, contentType, { orgId: org._id });
    return { url, buffer, contentType, size: buffer.length };
  } catch (err) {
    console.error("[WhatsApp] inbound media fetch failed:", err.response?.status || "", err.message);
    return null;
  }
}

module.exports = { fetchAndStore, MAX_BYTES };
