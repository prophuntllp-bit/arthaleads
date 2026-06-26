// services/otpService.js
// Email OTP — generates a 6-digit code, stores it in MongoDB with a 5-min TTL,
// sends it to the user's registered email, and verifies on submission.
// No SMS, no DLT registration, no reCAPTCHA required.

const crypto = require("crypto");
const User   = require("../models/User");
const { Resend } = require("resend");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  return new Resend(process.env.RESEND_API_KEY);
}

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

  // Send email via Resend
  const resend = getResend();
  const from   = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";

  await resend.emails.send({
    from,
    to:      user.email,
    subject: `${otp} — Your Arthaleads login OTP`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <img src="https://www.arthaleads.com/logo.png" alt="Arthaleads" width="48" height="48"
            style="display:inline-block;border-radius:14px;border:0;" />
          <br/>
          <span style="display:inline-block;margin-top:10px;color:#111113;font-weight:800;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Artha<span style="color:#ff6b00;">leads</span></span>
        </td></tr>
        <tr><td style="background:#1e1d20;border-radius:24px;border:1px solid rgba(255,107,0,0.18);box-shadow:0 0 0 1px rgba(255,107,0,0.06),0 20px 60px rgba(0,0,0,0.22),0 0 40px rgba(255,107,0,0.06);overflow:hidden;padding:40px 36px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#ff6b00;letter-spacing:.08em;text-transform:uppercase;">One-Time Password</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#ededed;">Your login OTP</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#969696;line-height:1.6;">
            Hi ${user.name || "there"}, use the code below to sign in to Arthaleads. It expires in <strong style="color:#ededed;">5 minutes</strong>.
          </p>
          <div style="background:rgba(255,107,0,0.08);border:1px solid rgba(255,107,0,0.22);border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
            <span style="font-size:40px;font-weight:900;letter-spacing:.25em;color:#ff6b00;">${otp}</span>
          </div>
          <p style="margin:0;font-size:13px;color:#666;">Never share this OTP with anyone. Arthaleads will never ask for your OTP.</p>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#a8a29e;">© ${new Date().getFullYear()} Arthaleads. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

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
