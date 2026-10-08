const mongoose = require("mongoose");

/**
 * A purchase of extra file space, from Razorpay order creation through capture.
 * Same shape and guarantees as CreditOrder: `appliedAt` makes granting the pack
 * idempotent when Razorpay retries a webhook. Amounts are paise.
 */
const storageOrderSchema = new mongoose.Schema(
  {
    orgId:     { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    packs:       { type: Number, required: true },   // blocks of STORAGE_ADDON.gb
    gb:          { type: Number, required: true },   // total GB granted
    months:      { type: Number, required: true },   // how long the space lasts
    basePaise:   { type: Number, required: true },   // ex-GST
    gstPaise:    { type: Number, required: true },
    gstRate:     { type: Number, default: 18 },
    amountPaise: { type: Number, required: true },   // what Razorpay charges

    razorpayOrderId:   { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true, index: true },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },

    appliedAt:     { type: Date },
    expiresAt:     { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.StorageOrder || mongoose.model("StorageOrder", storageOrderSchema);
