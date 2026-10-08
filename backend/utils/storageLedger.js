// utils/storageLedger.js — who owns which stored file, and how much room is left.
//
// storage.put() records every object it is told an org owns; storage.remove()
// forgets it. Usage is the sum of the ledger, so it stays right when a key is
// overwritten (only the difference counts) or deleted.

const mongoose = require("mongoose");
const StorageObject = require("../models/StorageObject");
const Organization = require("../models/Organization");
const { AppError } = require("../middlewares/errorHandler");
const { storageLimitBytes, activePackBytes, STORAGE_WARN_AT } = require("../constants/plans");
const logger = require("../config/logger");

function categoryOf(key) {
  const k = String(key || "");
  if (k.startsWith("arthaleads/recordings/")) return "recordings";
  if (k.startsWith("arthaleads/attendance/")) return "attendance";
  if (k.startsWith("arthaleads/logos/")) return "logo";
  if (k.startsWith("arthaleads/brochures/") || k.startsWith("arthaleads/floorplans/") || k.startsWith("arthaleads/projects/")) return "project_media";
  return "other";
}

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** Remember that `orgId` holds `bytes` at `key`. Never throws: the upload already happened. */
async function record(orgId, key, bytes) {
  if (!orgId) return;
  try {
    await StorageObject.updateOne(
      { key },
      { $set: { orgId: oid(orgId), bytes, category: categoryOf(key) } },
      { upsert: true }
    );
  } catch (err) {
    logger.warn(`[storage-ledger] could not record ${key}: ${err.message}`);
    return;
  }
  require("../services/storageAlerts").checkOrg(orgId).catch(() => {});
}

async function forget(key) {
  try {
    const gone = await StorageObject.findOneAndDelete({ key }).select("orgId").lean();
    if (gone?.orgId) require("../services/storageAlerts").checkOrg(gone.orgId).catch(() => {});
  } catch (err) { logger.warn(`[storage-ledger] could not forget ${key}: ${err.message}`); }
}

/** Bytes used by an org, in total and by category. */
async function usageFor(orgId) {
  const rows = await StorageObject.aggregate([
    { $match: { orgId: oid(orgId) } },
    { $group: { _id: "$category", bytes: { $sum: "$bytes" }, files: { $sum: 1 } } },
  ]);
  const byCategory = {};
  let used = 0, files = 0;
  for (const r of rows) { byCategory[r._id] = { bytes: r.bytes, files: r.files }; used += r.bytes; files += r.files; }
  return { used, files, byCategory };
}

/** Everything the customer sidebar and the super admin panel need in one shape. */
async function summaryFor(org) {
  const [{ used, files, byCategory }] = [await usageFor(org._id)];
  const limit = storageLimitBytes(org);
  const pct = limit > 0 ? used / limit : 0;
  return {
    usedBytes: used,
    limitBytes: limit,
    extraBytes: org.storage?.extraBytes || 0,
    packBytes: activePackBytes(org),
    files,
    byCategory,
    percent: Math.round(pct * 1000) / 10,
    warn: pct >= STORAGE_WARN_AT,
    full: pct >= 1,
  };
}

/**
 * Throw if storing `bytes` more (replacing `replacingKey`, if that key is being
 * overwritten) would take the org past its limit. Only blocks at 100%.
 */
async function assertCanStore(orgId, bytes, replacingKey) {
  const org = await Organization.findById(orgId).select("plan storage").lean();
  if (!org) return;
  const { used } = await usageFor(orgId);
  let existing = 0;
  if (replacingKey) existing = (await StorageObject.findOne({ key: replacingKey }).select("bytes").lean())?.bytes || 0;
  const limit = storageLimitBytes(org);
  if (used - existing + bytes > limit) {
    const e = new AppError(
      "Your storage is full. Remove some files or ask us for more space, then try again.",
      413
    );
    e.code = "STORAGE_FULL";
    throw e;
  }
}

module.exports = { categoryOf, record, forget, usageFor, summaryFor, assertCanStore };
