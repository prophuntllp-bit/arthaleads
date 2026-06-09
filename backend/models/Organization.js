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
    attendanceSettings: {
      shiftStartTime: { type: String, default: "09:30" }, // "HH:MM" 24-hour
      bufferMinutes:  { type: Number, default: 15 },      // grace period before marked late
      halfDayMinutes: { type: Number, default: 240 },     // min minutes for half-day (4h)
      fullDayMinutes: { type: Number, default: 480 },     // min minutes for full-day (8h)
    },
    // ── QR Code lead capture ───────────────────────────────────────────────────
    qrToken:         { type: String, default: "", index: true, sparse: true },
    // ── Referral tracking ──────────────────────────────────────────────────────
    referralCode:    { type: String, uppercase: true, sparse: true, index: true },
    referredBy:      { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    referralRewardAt: { type: Date, default: null }, // set 7 days after referred org subscribes
  },
  { timestamps: true }
);

// Auto-generate referralCode from _id on first save
orgSchema.pre("save", function (next) {
  if (this.isNew && !this.referralCode) {
    this.referralCode = String(this._id).slice(-6).toUpperCase();
  }
  next();
});

// Generate slug from name
orgSchema.statics.generateSlug = function (name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
};

module.exports = mongoose.model("Organization", orgSchema);
