// MongoDB implementation of the store contract described in service.js.
//
// Kept deliberately thin: all decisions live in service.js and are tested
// against an in-memory twin of this file. What only a real database can
// confirm is concentrated here -- the unique (orgId,eventId) upsert that makes
// enqueueing idempotent, and the single-document findOneAndUpdate that makes
// claiming a job atomic across several server instances.

const mongoose = require("mongoose");
const OutboundIntegration = require("../../models/OutboundIntegration");
const OutboundDelivery = require("../../models/OutboundDelivery");
const { RETENTION_DAYS } = OutboundDelivery;

const toId = (v) => (v && typeof v === "object" && v._bsontype ? v : new mongoose.Types.ObjectId(String(v)));
const expiry = (terminalAt) => new Date(new Date(terminalAt).getTime() + RETENTION_DAYS * 86400000);

function toConfig(doc) {
  if (!doc) return null;
  return {
    id: doc._id, orgId: doc.orgId, enabled: !!doc.enabled, enabledAt: doc.enabledAt,
    baseUrl: doc.baseUrl, accountId: doc.accountId, authMode: doc.authMode || "header",
    secret: doc.getSecret(),
    defaultCountryCode: doc.defaultCountryCode || "91",
    dedupeWindowHours: doc.dedupeWindowHours ?? 24,
    maxLeadAgeMinutes: doc.maxLeadAgeMinutes || 15,
    emitImports: !!doc.emitImports,
    routing: Object.fromEntries(["website", "facebook", "whatsapp"].map((k) => {
      const src = doc.routing?.[k];
      return [k, {
        enabled: src?.enabled === true,
        routes: (src?.routes || []).map((r) => ({
          id: String(r._id), label: r.label, matchKind: r.matchKind, matchValue: r.matchValue,
          projectId: r.projectId ? String(r.projectId) : "", projectName: r.projectName, agentId: r.agentId, agentLabel: r.agentLabel,
        })),
      }];
    })),
  };
}

const mongoStore = {
  async getIntegration(orgId) {
    const doc = await OutboundIntegration.findOne({ orgId: toId(orgId), provider: "vistrow" }).select("+secretEnc");
    return toConfig(doc);
  },

  // Idempotent: the upsert only inserts when no (orgId,eventId) row exists.
  // Two simultaneous callers can both pass the existence check and race to
  // insert; the loser gets E11000 from the unique index and is told "not inserted".
  async insertDelivery(doc) {
    const { orgId, eventId, ...rest } = doc;
    const fields = { ...rest, provider: "vistrow", ...(rest.terminalAt ? { expireAt: expiry(rest.terminalAt) } : {}) };
    try {
      const res = await OutboundDelivery.updateOne({ orgId: toId(orgId), eventId }, { $setOnInsert: fields }, { upsert: true });
      const inserted = res.upsertedCount === 1;
      const delivery = await OutboundDelivery.findOne({ orgId: toId(orgId), eventId }).select("_id status");
      return { inserted, delivery };
    } catch (err) {
      if (err?.code === 11000) {
        const delivery = await OutboundDelivery.findOne({ orgId: toId(orgId), eventId }).select("_id status");
        return { inserted: false, delivery };
      }
      throw err;
    }
  },

  // autoCallOnly: the repeat-phone window guards against phoning someone twice,
  // so only an earlier delivery that actually asked for a call counts.
  async findRecentDeliveryForPhone({ orgId, phoneKey, since, excludeEventId, autoCallOnly = false }) {
    return OutboundDelivery.findOne({
      orgId: toId(orgId), phoneKey, isTest: false,
      status: { $in: ["pending", "sending", "delivered"] },
      createdAt: { $gte: since },
      eventId: { $ne: excludeEventId },
      ...(autoCallOnly ? { autoCall: true } : {}),
    }).select("_id").lean();
  },

  // Atomically moves ONE due job to "sending" with a lease. A job is due when
  // it is pending and its time has come, or is "sending" with an expired lease
  // (its worker died mid-send). attempts is bumped here, so a crash mid-send
  // still counts against the retry budget.
  async claimById(id, { now, leaseMs }) {
    return OutboundDelivery.findOneAndUpdate(
      { _id: toId(id), status: "pending", nextAttemptAt: { $lte: now } },
      { $set: { status: "sending", lockedUntil: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 } },
      { new: true }
    ).select("+payload").lean();
  },

  async claimDue({ now, leaseMs, limit }) {
    const jobs = [];
    for (let i = 0; i < limit; i++) {
      const job = await OutboundDelivery.findOneAndUpdate(
        { $or: [{ status: "pending", nextAttemptAt: { $lte: now } }, { status: "sending", lockedUntil: { $lt: now } }] },
        { $set: { status: "sending", lockedUntil: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 } },
        { new: true, sort: { nextAttemptAt: 1 } }
      ).select("+payload").lean();
      if (!job) break;
      jobs.push(job);
    }
    return jobs;
  },

  async update(id, patch) {
    const { appendAttempt, ...set } = patch;
    for (const k of Object.keys(set)) if (set[k] === undefined) delete set[k];
    if (set.terminalAt) set.expireAt = expiry(set.terminalAt);
    const update = { $set: set };
    if (appendAttempt) update.$push = { attemptLog: { $each: [appendAttempt], $slice: -12 } };
    await OutboundDelivery.updateOne({ _id: toId(id) }, update);
  },

  async recordIntegrationOutcome(orgId, patch) {
    const { clearError, clearWarning, ...fields } = patch;
    const update = { $set: fields };
    if (clearError || clearWarning) update.$unset = { ...(clearError ? { lastError: "" } : {}), ...(clearWarning ? { lastWarning: "" } : {}) };
    await OutboundIntegration.updateOne({ orgId: toId(orgId), provider: "vistrow" }, update);
  },

  // At most one failure alert per gap, even with several instances failing at once.
  async throttleAlert(orgId, now, gapMs) {
    const res = await OutboundIntegration.updateOne(
      { orgId: toId(orgId), provider: "vistrow", $or: [{ lastAlertAt: null }, { lastAlertAt: { $lt: new Date(now.getTime() - gapMs) } }] },
      { $set: { lastAlertAt: now } }
    );
    return res.modifiedCount === 1;
  },

  async cancelPending(orgId, now, reason) {
    const res = await OutboundDelivery.updateMany(
      { orgId: toId(orgId), status: "pending" },
      { $set: { status: "cancelled", skipReason: reason, terminalAt: now, expireAt: expiry(now), lockedUntil: null } }
    );
    return res.modifiedCount || 0;
  },
};

module.exports = { mongoStore, toConfig };
