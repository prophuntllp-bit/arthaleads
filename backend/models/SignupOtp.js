// models/SignupOtp.js
// Temporary OTP record used only during the signup email-verification step.
// Keyed by email: proving control of the inbox is the whole point of the step,
// so the address being verified is the natural unique key (it was previously
// keyed by phone, back when this claimed to verify a phone number but actually
// mailed the code — see the signup flow in controllers/authController.js).
// MongoDB TTL index auto-deletes the document once expiresAt is reached.

const mongoose = require("mongoose");

const signupOtpSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    otpHash:  { type: String, required: true },
    attempts: { type: Number, default: 0 }, // failed verification attempts — capped to limit brute force
    sendCount:{ type: Number, default: 1 }, // resends for this address — capped to limit mail-bombing
    ip:       { type: String, default: "" }, // recorded for abuse review
    expiresAt:{ type: Date,   required: true, expires: 0 }, // TTL: auto-delete at expiresAt
  },
  { timestamps: true }
);

module.exports = mongoose.model("SignupOtp", signupOtpSchema);
