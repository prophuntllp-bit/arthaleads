// services/storageCleanup.js
//
// Lets an admin free up space on purpose: remove call recordings or attendance
// selfies older than a chosen number of days. Project photos and brochures are
// removed from the project they belong to, so they are not offered here.
//
// The lead, the call, its transcript and summary stay; only the audio file or
// the photo goes, and the record is marked so the app shows "removed" instead
// of a broken player or image.

const StorageObject = require("../models/StorageObject");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Attendance = require("../models/Attendance");
const storage = require("../utils/storage");
const logger = require("../config/logger");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mediaMatch = (key) => new RegExp(`/api/media/${esc(key.split("/").map(encodeURIComponent).join("/"))}`);

const CATEGORIES = ["recordings", "attendance"];
const BATCH = 300;

async function clearRecording(orgId, key) {
  const match = mediaMatch(key);
  for (const Model of [Lead, ProjectLead]) {
    await Model.updateMany(
      { orgId, "activities.meta.recordingUrl": match },
      { $set: { "activities.$[a].meta.recordingUrl": "", "activities.$[a].meta.recordingExpired": true } },
      { arrayFilters: [{ "a.meta.recordingUrl": match }] }
    );
  }
}

async function clearSelfie(orgId, key) {
  const match = mediaMatch(key);
  await Attendance.updateMany({ orgId, clockInSelfie: match }, { $set: { clockInSelfie: "" } });
  await Attendance.updateMany({ orgId, clockOutSelfie: match }, { $set: { clockOutSelfie: "" } });
}

/** How much would go if everything of `category` older than `olderThanDays` were removed. */
async function preview(orgId, category, olderThanDays) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000);
  const [r] = await StorageObject.aggregate([
    { $match: { orgId, category, createdAt: { $lt: cutoff } } },
    { $group: { _id: null, bytes: { $sum: "$bytes" }, files: { $sum: 1 } } },
  ]);
  return { files: r?.files || 0, bytes: r?.bytes || 0 };
}

async function freeUp(orgId, category, olderThanDays) {
  if (!CATEGORIES.includes(category)) throw Object.assign(new Error("That kind of file can't be cleared here."), { status: 400 });
  if (!storage.isConfigured()) throw Object.assign(new Error("File storage is not available right now."), { status: 503 });
  const cutoff = new Date(Date.now() - olderThanDays * 86400000);
  let files = 0, bytes = 0;
  const failed = [];   // keys that would not delete: skipped, never counted, not retried this run
  // Bounded so one request cannot run forever on a very large org.
  for (let round = 0; round < 10; round++) {
    const batch = await StorageObject.find({ orgId, category, createdAt: { $lt: cutoff }, key: { $nin: failed } }).select("key bytes").limit(BATCH).lean();
    if (!batch.length) break;
    for (const obj of batch) {
      // Delete the file first. Only a file that is really gone is counted as freed,
      // and the records are marked afterwards, so a failed delete never leaves a
      // lead pointing at a recording that still exists but is flagged as removed.
      try {
        await storage.removeStrict(obj.key);
      } catch (err) {
        failed.push(obj.key);
        logger.warn(`[storage] could not remove ${obj.key}: ${err.message}`);
        continue;
      }
      files++; bytes += obj.bytes;
      try {
        if (category === "recordings") await clearRecording(orgId, obj.key);
        else await clearSelfie(orgId, obj.key);
      } catch (err) {
        logger.warn(`[storage] removed ${obj.key} but could not mark its record: ${err.message}`);
      }
    }
    if (batch.length < BATCH) break;
  }
  if (failed.length) logger.warn(`[storage] org ${orgId}: ${failed.length} ${category} file(s) could not be removed`);
  logger.info(`[storage] org ${orgId} freed ${files} ${category} file(s), ${(bytes / 1048576).toFixed(1)} MB`);
  return { files, bytes, failed: failed.length };
}

module.exports = { CATEGORIES, preview, freeUp };
