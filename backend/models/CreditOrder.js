const mongoose = require("mongoose");

/**
 * A WhatsApp credit purchase, from Razorpay order creation through to capture.
 *
 * Deliberately separate from Payment (which sells plan terms): a credit top-up
 * has no plan, seats or cycle, and conflating the two would mean a nullable
 * mess in both. Same shape and same guarantees though — this is the audit trail
 * for the money, and `appliedAt` is what makes granting the credit idempotent
 * when Razorpay retries a webhook.
 *
 * Amounts are paise. `creditPaise` is what the tenant actually receives and is
 * ex-GST; `amountPaise` is what their card is charged, GST included.
 */
const creditOrderSchema = new mongoose.Schema(
  {
    orgId:     { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    creditPaise: { type: Number, required: true },  // credit granted, ex-GST
    gstPaise:    { type: Number, required: true },  // tax collected
    gstRate:     { type: Number, default: 18 },     // stored so a rate change never rewrites history
    amountPaise: { type: Number, required: true },  // creditPaise + gstPaise, what Razorpay charges
    currency:    { type: String, default: "INR" },

    razorpayOrderId:   { type: String, required: true, unique: true, index: true },
    // Only set once a payment actually happens. Sparse so the many orders that
    // are created and abandoned do not collide on null.
    razorpayPaymentId: { type: String, unique: true, sparse: true, index: true },

    status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },

    // Set when the credit is actually granted, so a retried webhook can tell
    // "already applied" from "not yet applied".
    appliedAt:     { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditOrder", creditOrderSchema);
