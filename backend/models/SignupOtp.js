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
    // The magic-link half. Hashed for the same reason the code is: a leaked
    // database read should not hand anyone a working verification link.
    linkTokenHash: { type: String, default: "", index: true },
    // sha256 of a secret the signup tab generated and kept in sessionStorage.
    // Whoever polls for the result has to present the secret, so knowing the
    // email address is not enough to collect someone else's signup token.
    handoffHash:   { type: String, default: "" },
    // Set when the link is confirmed. The record outlives the click so the tab
    // that started the signup can still pick the result up.
    verified:      { type: Boolean, default: false },
    attempts: { type: Number, default: 0 }, // failed verification attempts — capped to limit brute force
    sendCount:{ type: Number, default: 1 }, // resends for this address — capped to limit mail-bombing
    ip:       { type: String, default: "" }, // recorded for abuse review
    expiresAt:{ type: Date,   required: true, expires: 0 }, // TTL: auto-delete at expiresAt
  },
  { timestamps: true }
);

module.exports = mongoose.model("SignupOtp", signupOtpSchema);
