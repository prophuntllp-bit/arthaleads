// models/Project.js
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [120, "Name too long"],
    },
    description: { type: String, trim: true, default: "" },
    location:    { type: String, trim: true, default: "" },
    images:      [{ type: String, trim: true }], // array of URLs

    // Pricing & config
    priceMin:       { type: Number, default: 0 },
    priceMax:       { type: Number, default: 0 },
    bhkTypes:       [{ type: String, trim: true }], // ["2BHK","3BHK"]
    area:           { type: String, trim: true, default: "" }, // "1200–1800 sq ft"
    amenities:      [{ type: String, trim: true }],
    possessionDate: { type: Date, default: null },
    reraNumber:     { type: String, trim: true, default: "" },

    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    qrToken:    { type: String, default: "", index: true, sparse: true },

    isArchived: { type: Boolean, default: false },
    orgId:      { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

projectSchema.index({ createdAt: -1 });
projectSchema.index({ createdBy: 1 });
// Note: orgId compound index is defined on the field itself (index: true) - no duplicate needed here

module.exports = mongoose.model("Project", projectSchema);
