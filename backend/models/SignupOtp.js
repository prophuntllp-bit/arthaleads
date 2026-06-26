// models/SignupOtp.js
// Temporary OTP record used only during the signup phone-verification step.
// MongoDB TTL index auto-deletes the document once expiresAt is reached.

const mongoose = require("mongoose");

const signupOtpSchema = new mongoose.Schema(
  {
    phone:    { type: String, required: true, index: true },
    email:    { type: String, required: true },
    otpHash:  { type: String, required: true },
    attempts: { type: Number, default: 0 }, // failed verification attempts — capped to limit brute force
    expiresAt:{ type: Date,   required: true, expires: 0 }, // TTL: auto-delete at expiresAt
  },
  { timestamps: true }
);

module.exports = mongoose.model("SignupOtp", signupOtpSchema);
