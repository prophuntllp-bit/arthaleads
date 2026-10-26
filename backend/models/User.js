// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = ["super_admin", "admin", "manager", "agent"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name too long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: false, // optional for Google OAuth users
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never returned in queries by default
    },
    googleId: {
      type: String,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: { values: ROLES, message: "Role must be admin, manager, or agent" },
      default: "agent",
    },
    phone: { type: String, trim: true, default: "" },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    // When this person hid the dashboard's "Get started" checklist. Kept on
    // the account, not in the browser, so it stays hidden after logging in
    // again, on another browser or on another device.
    checklistDismissedAt: { type: Date, default: null },
    // The dashboard's "Welcome, take the tour" card was skipped or taken.
    tourOfferDismissedAt: { type: Date, default: null },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: false, default: null, index: true },
    // Set whenever the password changes. Sessions signed in before this moment
    // are no longer accepted (middlewares/auth.js), so a reset or change really
    // does sign out whoever else was holding the old password or a stolen session.
    passwordChangedAt:    { type: Date, default: null },
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
    // Phone OTP (sent via email)
    // Brute-force lockout
    loginAttempts: { type: Number, default: 0,    select: false },
    lockoutUntil:  { type: Date,   default: null,  select: false },
  },
  { timestamps: true }
);

// Hash password before saving (skip for Google-only accounts)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

// A profile photo arrives as a data URI (Settings compresses it in the
// browser). Stored inline it made the user record megabytes long, and the
// whole record is read on every request that person makes (middlewares/auth)
// and sent in every team list. So it goes to file storage (Backblaze, served
// via /api/media) and only the link stays here. Without storage configured
// (local sandbox) the data URI is kept as before.
userSchema.pre("save", async function storeAvatarInFiles() {
  if (!this.isModified("avatar") || !/^data:image\//i.test(this.avatar || "")) return;
  const storage = require("../utils/storage");
  require("../utils/upload").imageOnly(this.avatar); // PNG/JPG/WebP/GIF only
  if (!storage.isConfigured()) return;
  // New key per upload, so a changed photo is never served from an old cache.
  this.avatar = await storage.putDataUri(`arthaleads/avatars/${this.orgId || "platform"}/${this._id}-${Date.now()}-${require("crypto").randomBytes(6).toString("hex")}`, this.avatar, { orgId: this.orgId || undefined });
});

// Compare plain password with hashed.
// Returns false when no password is set (Google-only accounts) or the password
// field wasn't selected — bcrypt.compare would otherwise throw
// "Illegal arguments: string, undefined" and surface as a raw 500 to the user.
userSchema.methods.comparePassword = async function (plain) {
  if (!plain || !this.password) return false;
  return bcrypt.compare(plain, this.password);
};

// Never expose password in JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
