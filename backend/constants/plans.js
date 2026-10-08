// constants/plans.js
// What each plan includes, beyond price and seats (see planPricing.js for those).
// frontend/src/utils/plan.js mirrors the numbers the customer sees.

const GB = 1024 * 1024 * 1024;

// Files a customer stores with us: project photos, brochures, floor plans,
// videos, logo, attendance selfies, call recordings. Database rows (leads,
// notes) are not counted.
const PLAN_STORAGE = {
  trial:      { bytes: 1 * GB,   recordingDays: 30 },
  starter:    { bytes: 2 * GB,   recordingDays: 30 },
  growth:     { bytes: 15 * GB,  recordingDays: 90 },
  pro:        { bytes: 15 * GB,  recordingDays: 90 },   // legacy name for growth
  enterprise: { bytes: 100 * GB, recordingDays: 365 },  // negotiable, super admin can grant more
};

// Extra space is sold in blocks.
// Priced per block per month, ex-GST. `months` are the terms a customer can pick.
const STORAGE_ADDON = { gb: 10, pricePerMonth: 99, months: [1, 3, 12], maxPacks: 50 };

// Warn the customer from this share of their limit. New uploads are blocked
// only at 100%, and nothing already stored is ever deleted because of size.
const STORAGE_WARN_AT = 0.8;

// Projects a Starter org may keep. Growth and above are unlimited.
const STARTER_PROJECT_CAP = 2;

/** Space from bought packs that have not run out yet. */
function activePackBytes(org, now = Date.now()) {
  return (org?.storage?.packs || []).reduce(
    (n, p) => (p.expiresAt && new Date(p.expiresAt).getTime() > now ? n + (p.bytes || 0) : n), 0);
}

function storageFor(plan) {
  return PLAN_STORAGE[plan] || PLAN_STORAGE.starter;
}

/**
 * The byte limit that applies to an org: its plan's allowance, plus any extra
 * the super admin granted or the customer bought.
 */
function storageLimitBytes(org) {
  const base = org?.storage?.limitBytes ?? storageFor(org?.plan).bytes;
  return base + (org?.storage?.extraBytes || 0) + activePackBytes(org);
}

module.exports = { GB, PLAN_STORAGE, STORAGE_ADDON, STORAGE_WARN_AT, STARTER_PROJECT_CAP, storageFor, storageLimitBytes, activePackBytes };
