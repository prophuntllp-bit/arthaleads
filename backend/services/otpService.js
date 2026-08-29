// services/otpService.js
// Email OTP — generates a 6-digit code, stores it in MongoDB with a 5-min TTL,
// sends it to the user's registered email, and verifies on submission.
// No SMS, no DLT registration, no reCAPTCHA required.

const crypto = require("crypto");
const User   = require("../models/User");
const { sendOtpEmail } = require("../utils/email");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Normalise phone to bare 10-digit string for DB lookup
function normalisePhone(raw) {
  return String(raw).replace(/\D/g, "").replace(/^91(\d{10})$/, "$1").replace(/^0(\d{10})$/, "$1").slice(-10);
}

function buildVariants(norm) {
  return [norm, `+91${norm}`, `91${norm}`, `0${norm}`];
}

// Generate a cryptographically random 6-digit OTP
function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

// Send OTP to the email linked to the phone number.
// Returns { email } (masked) so the frontend can show "OTP sent to r***@gmail.com"
async function sendOtp(phone) {
  const norm = normalisePhone(phone);
  const user = await User.findOne({ phone: { $in: buildVariants(norm) } }).select("email name otpCode otpExpiresAt");

  if (!user) {
    throw new Error("No account found with this phone number. Please sign up first or ask your admin to add your number.");
  }

  const otp     = generateOtp();
  const expires = new Date(Date.now() + OTP_TTL_MS);

  // Persist hashed OTP — never store plain text
  user.otpCode      = crypto.createHash("sha256").update(otp).digest("hex");
  user.otpExpiresAt = expires;
  await user.save({ validateBeforeSave: false });

  // One template for every Arthaleads email — see utils/emailLayout.js. This
  // used to carry its own copy of the markup, which is why the login code and
  // the signup code arrived looking like two different products.
  // Minutes come from the TTL constant rather than a literal, so the email
  // cannot promise a window the code does not actually have.
  await sendOtpEmail(user.email, otp, OTP_TTL_MS / 60000);

  // Return masked email for frontend display
  const [localPart, domain] = user.email.split("@");
  const masked = localPart.length <= 2
    ? `${localPart[0]}***@${domain}`
    : `${localPart[0]}${localPart[1]}***@${domain}`;

  return { email: masked };
}

// Verify OTP submitted by user. Throws on failure.
async function verifyOtp(phone, otp) {
  const norm = normalisePhone(phone);
  const user = await User.findOne({ phone: { $in: buildVariants(norm) } }).select("otpCode otpExpiresAt");

  if (!user || !user.otpCode) throw new Error("OTP not found. Please request a new one.");
  if (Date.now() > new Date(user.otpExpiresAt).getTime()) throw new Error("OTP has expired. Please request a new one.");

  const hash = crypto.createHash("sha256").update(String(otp)).digest("hex");
  if (hash !== user.otpCode) throw new Error("Invalid OTP. Please check and try again.");

  // Clear OTP after successful verification
  user.otpCode      = undefined;
  user.otpExpiresAt = undefined;
  await user.save({ validateBeforeSave: false });

  return true;
}

module.exports = { sendOtp, verifyOtp };
