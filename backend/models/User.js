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
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
    // Phone OTP (sent via email)
    otpCode:      { type: String, select: false },
    otpExpiresAt: { type: Date,   select: false },
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
  next();
});

// Compare plain password with hashed
userSchema.methods.comparePassword = async function (plain) {
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
