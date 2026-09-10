const mongoose = require("mongoose");

// Append-only record of every credit movement for an org.
//
// The org's cached credits.balancePaise is derived from this, never the other
// way round: if the two ever disagree the ledger wins, because this is what we
// reconcile against Meta's monthly invoice. Nothing in here is ever updated or
// deleted — a correction is a new `adjustment` row.
//
// All amounts are integer PAISE, ex-GST. `amountPaise` is signed: positive adds
// to the balance (topup, refund), negative takes from it (debit).
const creditLedgerSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },

    type: {
      type: String,
      enum: ["topup", "debit", "refund", "adjustment"],
      required: true,
    },

    amountPaise:       { type: Number, required: true },
    balanceAfterPaise: { type: Number, required: true },

    // Which Meta pricing bucket this message fell into. Absent on top-ups.
    category: {
      type: String,
      enum: ["marketing", "utility", "authentication", "service", null],
      default: null,
    },

    // What we charged per message for this row, so a historical entry stays
    // explainable after the org's sell rates change.
    rateAppliedPaise: { type: Number, default: 0 },

    // True when Meta's 1,000-free-service-messages allowance covered this one,
    // so it shows in usage reports as free rather than silently missing.
    freeTierApplied: { type: Boolean, default: false },

    // Links back to what caused the movement.
    // No `index: true` here — the unique partial index at the bottom of this
    // file covers waMsgId lookups, and declaring both makes Mongoose emit two
    // conflicting definitions for the same key.
    waMsgId:        { type: String, default: null },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "WaConversation", default: null },
    campaignId:     { type: mongoose.Schema.Types.ObjectId, ref: "WaCampaign", default: null },

    // The raw `pricing` object off Meta's status webhook, stored verbatim.
    // This is the evidence for the monthly reconciliation — never derive it,
    // never normalise it, just keep what Meta said.
    metaPricing: { type: mongoose.Schema.Types.Mixed, default: null },

    // Top-ups only.
    razorpayPaymentId: { type: String, default: null, index: true },
    gstPaise:          { type: Number, default: 0 },

    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Usage reports and the monthly reconciliation both read "this org, this period".
creditLedgerSchema.index({ orgId: 1, createdAt: -1 });
// A status webhook can arrive more than once for the same message; one debit
// per waMsgId is what keeps the settle path idempotent.
//
// Note `sparse` is deliberately absent — MongoDB rejects an index that sets
// both `sparse` and `partialFilterExpression`, and it rejects it *silently*
// through Mongoose's background index build. The first version of this index
// carried both, was therefore never created, and duplicate webhooks
// double-charged until a test caught it. The partial filter alone gives the
// same "only index debit rows that have a waMsgId" behaviour.
// Explicitly named so it cannot collide with an auto-generated "waMsgId_1"
// left behind by an earlier schema revision — that collision blocks the index
// from being created at all, which is the failure mode this guards against.
creditLedgerSchema.index(
  { waMsgId: 1 },
  {
    name: "waMsgId_debit_unique",
    unique: true,
    partialFilterExpression: { type: "debit", waMsgId: { $type: "string" } },
  }
);

module.exports = mongoose.model("CreditLedger", creditLedgerSchema);
