const mongoose = require("mongoose");

/**
 * A record of every Razorpay checkout, from creation through to capture.
 *
 * This is the audit trail for money: what was quoted, what was charged, and
 * which organisation it entitled. It also provides idempotency — Razorpay
 * retries webhooks, and a captured payment must credit a term exactly once.
 */
const paymentSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // What was bought. Stored at quote time so a later price change never
    // rewrites history.
    plan:   { type: String, required: true },
    seats:  { type: Number, required: true },
    cycle:  { type: String, enum: ["monthly", "annual"], required: true },
    rate:   { type: Number, required: true },  // rupees per seat per period
    gstRate:{ type: Number, default: 0 },

    // Money, in paise, exactly as sent to Razorpay.
    amountPaise: { type: Number, required: true },
    currency:    { type: String, default: "INR" },

    razorpayOrderId:   { type: String, required: true, unique: true, index: true },
    // Only set once a payment actually happens. Sparse so the many orders that
    // are created and abandoned do not collide on null.
    razorpayPaymentId: { type: String, unique: true, sparse: true, index: true },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },

    // Set when the term is actually granted, so a retried webhook can tell
    // "already applied" from "not yet applied".
    appliedAt:  { type: Date },
    paidUntil:  { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
