// models/StorageObject.js
// One row per file we hold for an organisation in object storage. The sum of
// `bytes` is what the org's storage limit is measured against, and `category`
// is what lets the customer and the super admin see where the space went.

const mongoose = require("mongoose");

const storageObjectSchema = new mongoose.Schema(
  {
    orgId:    { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    key:      { type: String, required: true, unique: true },
    bytes:    { type: Number, required: true, min: 0 },
    category: { type: String, enum: ["project_media", "recordings", "attendance", "logo", "other"], default: "other" },
  },
  { timestamps: true }
);

storageObjectSchema.index({ orgId: 1, category: 1 });

module.exports = mongoose.models.StorageObject || mongoose.model("StorageObject", storageObjectSchema);
