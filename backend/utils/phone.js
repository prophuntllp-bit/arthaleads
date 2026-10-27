// utils/phone.js - one way to tell whether two phone numbers are the same person.
//
// Leads arrive with the same number written several ways: "+919876543210",
// "919876543210", "09876543210", "9876543210", "+91 9876543210". They are the
// same person when their last 10 digits match. Every duplicate check should use
// these helpers instead of comparing the stored text (17 Oct 2026: exact-text
// checks in the website, custom and Google webhooks let the same person in twice).

/** Last 10 digits, or "" when the number has fewer than 10 digits (too short to match safely). */
function phoneKey(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/**
 * Condition for a `phone` field that matches any stored format of this number,
 * e.g. { orgId, phone: samePhone(p) }. Null when the number is too short to
 * match safely; callers then fall back to the exact text.
 */
function samePhone(raw) {
  const key = phoneKey(raw);
  // Spaces, dashes or brackets may sit between the stored digits ("+91 744 743
  // 0431" missed an incoming call's lookup, 27 Oct 2026), so any non-digits
  // are allowed between them.
  return key ? { $regex: `${key.split("").join("\\D*")}\\D*$` } : null;
}

/**
 * A number as WhatsApp sends it (country code, digits only), for lists the
 * owner types in, such as an agent's test numbers: "70209 50304" and
 * "07020950304" become "917020950304". A 10-digit Indian mobile gets its 91;
 * anything else keeps its own digits.
 */
function normalizeTestPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  return digits;
}

module.exports = { phoneKey, samePhone, normalizeTestPhone };
