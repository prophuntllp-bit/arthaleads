// services/recordingRetention.js
// Call recordings are the one thing that grows without anyone uploading it, so
// they are kept for a period set by the plan (constants/plans.js) and then
// removed. Everything else a customer stores stays until they remove it.
//
// What is removed is the audio file only. The call itself, its duration, the
// transcript and the AI summary stay on the lead; the activity is marked
// `recordingExpired` so the app can say so instead of showing a dead player.

const Organization = require("../models/Organization");
const StorageObject = require("../models/StorageObject");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const storage = require("../utils/storage");
const logger = require("../config/logger");
const { storageFor } = require("../constants/plans");

async function purgeExpiredRecordings({ dryRun = false } = {}) {
  if (!storage.isConfigured()) return { orgs: 0, removed: 0, bytes: 0 };
  const orgs = await Organization.find({}).select("plan storage").lean();
  let removed = 0, bytes = 0;

  for (const org of orgs) {
    const days = org.storage?.recordingDays ?? storageFor(org.plan).recordingDays;
    const cutoff = new Date(Date.now() - days * 86400000);
    const old = await StorageObject.find({ orgId: org._id, category: "recordings", createdAt: { $lt: cutoff } })
      .select("key bytes").limit(500).lean();

    for (const obj of old) {
      if (!dryRun) {
        const keyPath = obj.key.split("/").map(encodeURIComponent).join("/");
        const match = new RegExp(`/api/media/${keyPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
        for (const Model of [Lead, ProjectLead]) {
          await Model.updateMany(
            { orgId: org._id, "activities.meta.recordingUrl": match },
            { $set: { "activities.$[a].meta.recordingUrl": "", "activities.$[a].meta.recordingExpired": true } },
            { arrayFilters: [{ "a.meta.recordingUrl": match }] }
          );
        }
        await storage.remove(obj.key);
      }
      removed++; bytes += obj.bytes;
    }
  }
  if (removed) logger.info(`[storage] recording retention ${dryRun ? "(dry run) would remove" : "removed"} ${removed} file(s), ${(bytes / 1048576).toFixed(1)} MB`);
  return { orgs: orgs.length, removed, bytes };
}

module.exports = { purgeExpiredRecordings };
