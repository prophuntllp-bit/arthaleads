// One row per lead.created event sent (or deliberately not sent) to Vistrow.
//
// Doubles as the job queue and the audit trail: a row is created when a NEW
// lead is committed while the integration is on, then walked through
//   pending -> sending -> delivered
//                      -> pending (transient failure, backoff)  -> dead (gave up)
//                      -> failed  (permanent: Vistrow said no, or bad config)
// or is born terminal: skipped (with a reason) / cancelled (switched off).
//
// (orgId, eventId) is unique and eventId derives from the lead id, so the same
// lead can never be queued twice, however many code paths or retries see it.
//
// `payload` is the exact body to send, snapshotted at creation so every retry
// is byte-identical. It holds the lead's contact details, so it is never
// selected by default, never returned by the API, and is removed by the TTL
// below once the job is finished.

const mongoose = require("mongoose");

const RETENTION_DAYS = 30;

const attemptSchema = new mongoose.Schema(
  {
    at: Date,
    httpStatus: Number,
    code: String,
    latencyMs: Number,
    outcome: { type: String, enum: ["delivered", "retry", "permanent", "dead"] },
  },
  { _id: false }
);

const outboundDeliverySchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    integrationId: { type: mongoose.Schema.Types.ObjectId, ref: "OutboundIntegration", default: null },
    provider: { type: String, default: "vistrow" },
    eventType: { type: String, default: "lead.created" },
    eventId: { type: String, required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null }, // null for test events
    isTest: { type: Boolean, default: false },
    origin: { type: String, default: "unknown" }, // which creation path produced the lead
    // The lead's own creation time: the start of the "call within 30s" clock.
    leadCreatedAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["pending", "sending", "delivered", "failed", "dead", "skipped", "cancelled"],
      required: true,
    },
    skipReason: { type: String, default: "" },

    // The routing decision made when the lead was created (see routing.js).
    // autoCall:false means Vistrow got a Contact only: no agent, no call.
    autoCall: { type: Boolean, default: false },
    autoCallReason: { type: String, default: "" }, // why not: source_disabled, no_route, ...
    routeSource: { type: String, default: "" },    // website | facebook | whatsapp | ""
    routeLabel: { type: String, default: "" },
    agentId: { type: String, default: "" },
    agentLabel: { type: String, default: "" },
    // Facts the decision was made from, kept so the send-time recheck uses the
    // same ones. Not exposed by the API.
    routingInputs: { type: mongoose.Schema.Types.Mixed, select: false },
    // What Vistrow said about the call itself (it may accept the Contact yet
    // decline to queue a call, e.g. unknown agent or no caller number).
    callQueued: { type: Boolean, default: null },
    callReason: { type: String, default: "" },

    payload: { type: mongoose.Schema.Types.Mixed, select: false },
    phoneKey: { type: String, default: "" }, // E.164, for the repeat-phone window

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 8 },
    nextAttemptAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    firstAttemptAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    deduped: { type: Boolean, default: false },

    lastHttpStatus: { type: Number, default: null },
    lastErrorCode: { type: String, default: "" },
    lastErrorMessage: { type: String, default: "" }, // sanitised, <=200 chars, no URLs/PII/credentials
    lastLatencyMs: { type: Number, default: null },
    // leadCreatedAt -> 2xx from Vistrow. The number the 30-second goal is judged by.
    endToEndMs: { type: Number, default: null },
    attemptLog: { type: [attemptSchema], default: [] },

    terminalAt: { type: Date, default: null },
    // Set with terminalAt; Mongo's TTL monitor deletes the row (and its PII).
    expireAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// expireAt is set by the store whenever terminalAt is written (updateOne /
// upsert bypass document hooks, so a schema hook would silently never run).
outboundDeliverySchema.index({ orgId: 1, eventId: 1 }, { unique: true });
outboundDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
outboundDeliverySchema.index({ status: 1, lockedUntil: 1 });
outboundDeliverySchema.index({ orgId: 1, phoneKey: 1, createdAt: -1 });
outboundDeliverySchema.index({ orgId: 1, createdAt: -1 });
outboundDeliverySchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OutboundDelivery", outboundDeliverySchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
