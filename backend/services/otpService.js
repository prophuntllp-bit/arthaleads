// services/otpService.js
// MSG91 OTP — send and verify via their v5 API.
// Docs: https://docs.msg91.com/reference/send-otp
const axios = require("axios");

const AUTH_KEY   = process.env.MSG91_AUTH_KEY;
const TEMPLATE   = process.env.MSG91_TEMPLATE_ID || "";  // optional — needed for DLT

// Normalise any Indian phone input → "91XXXXXXXXXX" (no +)
function toMsg91Mobile(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("091")) return digits.slice(1);
  return digits; // pass through for non-Indian numbers
}

async function sendOtp(phone) {
  if (!AUTH_KEY) throw new Error("MSG91_AUTH_KEY not configured");

  const mobile = toMsg91Mobile(phone);

  const params = {
    authkey:    AUTH_KEY,
    mobile,
    otp_length: 6,
    otp_expiry: 5,   // minutes
  };
  if (TEMPLATE) params.template_id = TEMPLATE;

  const { data } = await axios.post(
    "https://api.msg91.com/api/v5/otp",
    null,
    { params, timeout: 10_000 }
  );

  // MSG91 returns { type: "success", message: "... sent successfully." }
  if (data?.type !== "success") {
    throw new Error(data?.message || "Failed to send OTP");
  }

  return { mobile };
}

async function verifyOtp(phone, otp) {
  if (!AUTH_KEY) throw new Error("MSG91_AUTH_KEY not configured");

  const mobile = toMsg91Mobile(phone);

  const { data } = await axios.get(
    "https://api.msg91.com/api/v5/otp/verify",
    {
      params: { authkey: AUTH_KEY, mobile, otp: String(otp) },
      timeout: 10_000,
    }
  );

  // MSG91 returns { type: "success", message: "OTP verified successfully" }
  //           or  { type: "error",   message: "OTP not matched" }
  if (data?.type !== "success") {
    throw new Error(data?.message || "OTP verification failed");
  }

  return true;
}

module.exports = { sendOtp, verifyOtp, toMsg91Mobile };
