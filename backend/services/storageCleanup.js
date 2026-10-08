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
  // Bounded so one request cannot run forever on a very large org.
  for (let round = 0; round < 10; round++) {
    const batch = await StorageObject.find({ orgId, category, createdAt: { $lt: cutoff } }).select("key bytes").limit(BATCH).lean();
    if (!batch.length) break;
    let removedThisRound = 0;
    for (const obj of batch) {
      try {
        if (category === "recordings") await clearRecording(orgId, obj.key);
        else await clearSelfie(orgId, obj.key);
        await storage.remove(obj.key);
        files++; bytes += obj.bytes; removedThisRound++;
      } catch (err) {
        logger.warn(`[storage] could not remove ${obj.key}: ${err.message}`);
      }
    }
    if (batch.length < BATCH || removedThisRound === 0) break;
  }
  logger.info(`[storage] org ${orgId} freed ${files} ${category} file(s), ${(bytes / 1048576).toFixed(1)} MB`);
  return { files, bytes };
}

module.exports = { CATEGORIES, preview, freeUp };
