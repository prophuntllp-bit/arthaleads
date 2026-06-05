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
    // Set when the org owner completes the first-run onboarding wizard.
    // While null, the frontend shows a blocking onboarding gate to the admin.
    onboardingCompletedAt: { type: Date, default: null },
    companySize: { type: String, default: "" }, // e.g. "1-5", "6-20", "21-50", "50+"
    city:        { type: String, default: "" },
    logo:       { type: String, default: "" },  // base64 data-URI or hosted URL
    brandColor: { type: String, default: "" },  // hex accent colour e.g. "#2563eb"
    autoAssign: { type: Boolean, default: true }, // round-robin auto-assign new leads to agents
    monthlyClosingGoal: { type: Number, default: 0, min: 0 },
    attendanceSettings: {
      shiftStartTime: { type: String, default: "09:30" }, // "HH:MM" 24-hour
      shiftEndTime:   { type: String, default: "19:00" }, // expected clock-out time
      bufferMinutes:  { type: Number, default: 15 },      // grace period before marked late
      halfDayMinutes: { type: Number, default: 240 },     // min minutes for half-day (4h)
      fullDayMinutes: { type: Number, default: 480 },     // min minutes for full-day (8h)
    },
    // ── Billing / Invoice letterhead details ───────────────────────────────────
    address:         { type: String, default: "" },
    phone:           { type: String, default: "" },
    email:           { type: String, default: "" },
    gstNo:           { type: String, default: "" },
    pan:             { type: String, default: "" },
    cin:             { type: String, default: "" },
    rera:            { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
    bankAccountNo:   { type: String, default: "" },
    bankIfsc:        { type: String, default: "" },
    bankName:        { type: String, default: "" },
    bankBranch:      { type: String, default: "" },

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
