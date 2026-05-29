const mongoose = require("mongoose");

const orgSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      minlength: [2, "Name too short"],
      maxlength: [100, "Name too long"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    plan: {
      type: String,
      enum: ["trial", "starter", "growth", "pro", "enterprise"],
      default: "trial",
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
    },
    isActive: { type: Boolean, default: true },
    industry: { type: String, default: "Real Estate" },
    logo:       { type: String, default: "" },  // base64 data-URI or hosted URL
    brandColor: { type: String, default: "" },  // hex accent colour e.g. "#2563eb"
    autoAssign: { type: Boolean, default: true }, // round-robin auto-assign new leads to agents
    monthlyClosingGoal: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Generate slug from name
orgSchema.statics.generateSlug = function (name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
};

module.exports = mongoose.model("Organization", orgSchema);
