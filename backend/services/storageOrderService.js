// services/storageOrderService.js
//
// Buying extra file space. Same pattern as creditTopUpService: the webhook is
// the source of truth, the browser callback is a convenience, and appliedAt is
// claimed once so a retry never grants twice.

const StorageOrder = require("../models/StorageOrder");
const Organization = require("../models/Organization");
const rzp          = require("./razorpayService");
const { GB, STORAGE_ADDON } = require("../constants/plans");
const logger       = require("../config/logger");

const GST_RATE = 18;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function quote(packs, months) {
  if (!Number.isInteger(packs) || packs < 1 || packs > STORAGE_ADDON.maxPacks) {
    throw badRequest(`Choose between 1 and ${STORAGE_ADDON.maxPacks} blocks of ${STORAGE_ADDON.gb} GB.`);
  }
  if (!STORAGE_ADDON.months.includes(months)) throw badRequest("Choose a valid duration.");
  const basePaise = packs * STORAGE_ADDON.pricePerMonth * months * 100;
  const gstPaise = Math.round(basePaise * (GST_RATE / 100));
  return { packs, months, gb: packs * STORAGE_ADDON.gb, basePaise, gstPaise, gstRate: GST_RATE, amountPaise: basePaise + gstPaise };
}

async function createOrder({ orgId, userId, packs, months }) {
  const q = quote(packs, months);
  const org = await Organization.findById(orgId).select("name").lean();
  if (!org) throw badRequest("Organisation not found");

  const rzpOrder = await rzp.createOrder({
    amountPaise: q.amountPaise,
    currency: "INR",
    receipt: `st_${String(orgId).slice(-8)}_${Date.now().toString(36)}`,
    notes: { kind: "storage", orgId: String(orgId), orgName: org.name, gb: String(q.gb), months: String(q.months) },
  });
  const order = await StorageOrder.create({
    orgId, createdBy: userId, ...q, razorpayOrderId: rzpOrder.id,
  });
  logger.info(`[storage] org ${orgId} started a ${q.gb} GB x ${q.months} month purchase, order ${rzpOrder.id}`);
  return {
    orderId: rzpOrder.id, keyId: process.env.RAZORPAY_KEY_ID, testMode: rzp.isTestMode(),
    orgName: org.name, storageOrderId: order._id, ...q,
  };
}

/** Add the pack to the org for a captured payment. Idempotent. */
async function applyOrder(razorpayOrderId, razorpayPaymentId) {
  const now = new Date();
  const pending = await StorageOrder.findOne({ razorpayOrderId, appliedAt: null }).lean();
  const expiresAt = new Date(now.getTime());
  if (pending) expiresAt.setUTCMonth(expiresAt.getUTCMonth() + pending.months);
  const claimed = await StorageOrder.findOneAndUpdate(
    { razorpayOrderId, appliedAt: null },
    { $set: { appliedAt: now, razorpayPaymentId, status: "paid", expiresAt } },
    { new: true }
  );
  if (!claimed) {
    const existing = await StorageOrder.findOne({ razorpayOrderId }).lean();
    if (!existing) return { applied: false, unknown: true, order: null };
    return { applied: false, order: existing };
  }
  // If granting fails, release the claim so the retry can grant it. Without
  // this, the retry would see "already applied" for space never given.
  try {
    await Organization.updateOne(
      { _id: claimed.orgId },
      { $push: { "storage.packs": { orderId: claimed._id, bytes: claimed.gb * GB, expiresAt } }, $set: { "storage.alertLevel": 0 } }
    );
  } catch (err) {
    await StorageOrder.updateOne({ _id: claimed._id }, { $set: { appliedAt: null, status: "created" }, $unset: { razorpayPaymentId: "", expiresAt: "" } }).catch(() => {});
    logger.error(`[storage] could not grant order ${razorpayOrderId}, released for retry: ${err.message}`);
    throw err;
  }
  logger.info(`[storage] granted ${claimed.gb} GB to org ${claimed.orgId} until ${expiresAt.toISOString()}`);
  return { applied: true, order: claimed.toObject() };
}

async function markFailed(razorpayOrderId, reason) {
  await StorageOrder.findOneAndUpdate(
    { razorpayOrderId, appliedAt: null },
    { $set: { status: "failed", failureReason: reason || "unknown" } }
  );
}

async function isStorageOrder(razorpayOrderId) {
  return Boolean(await StorageOrder.exists({ razorpayOrderId }));
}

/** Drop packs that have run out, so the org document does not collect them forever. */
async function pruneExpiredPacks() {
  const r = await Organization.updateMany(
    { "storage.packs.expiresAt": { $lte: new Date() } },
    { $pull: { "storage.packs": { expiresAt: { $lte: new Date() } } } }
  );
  return r.modifiedCount || 0;
}

module.exports = { GST_RATE, quote, createOrder, applyOrder, markFailed, isStorageOrder, pruneExpiredPacks };
