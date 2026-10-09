// Phone normalisation for the outbound Vistrow integration.
//
// ArthaLeads stores phone as free text ("919149677787", "+91 98918 70274",
// "09876543210", "N/A", "N/A (test)") because every source formats it its own
// way. A voice agent dials whatever it is given, so unlike the rest of the CRM
// this must be strict: anything that is not unambiguously a dialable number
// returns null and the lead is NOT sent (recorded as skipped: invalid_phone).
//
// Deliberately dependency-free. Indian mobile numbers (the overwhelming case
// here) are validated exactly; other countries are accepted only when written
// with an explicit "+" / "00" prefix and a plausible E.164 length.

const DIGITS_E164_MIN = 8;
const DIGITS_E164_MAX = 15;

function toE164(raw, defaultCountryCode = "91") {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s || /^n\s*\/\s*a/i.test(s)) return null;

  let explicit = false;
  let t = s.replace(/[^\d+]/g, "");
  if (t.startsWith("00")) { t = "+" + t.slice(2); }
  if (t.startsWith("+")) { explicit = true; }
  // A "+" anywhere but the front means the text was not a single number.
  if (t.indexOf("+") > 0 || t.lastIndexOf("+") > 0) return null;
  const d = t.replace(/\D/g, "");
  if (!d) return null;

  if (explicit) {
    if (d.length < DIGITS_E164_MIN || d.length > DIGITS_E164_MAX || d.startsWith("0")) return null;
    // +91 must be a real Indian mobile; a malformed +91 is more likely a typo
    // than an NRI number, and dialling a wrong number is the expensive failure.
    if (d.startsWith("91") && !/^91[6-9]\d{9}$/.test(d)) return null;
    return "+" + d;
  }

  const cc = String(defaultCountryCode || "91").replace(/\D/g, "") || "91";
  if (cc === "91") {
    if (/^[6-9]\d{9}$/.test(d)) return "+91" + d;           // 9876543210
    if (/^0[6-9]\d{9}$/.test(d)) return "+91" + d.slice(1);  // 09876543210
    if (/^91[6-9]\d{9}$/.test(d)) return "+" + d;            // 919876543210 (wa_id style)
    return null;
  }
  // Other default countries: national number with no trunk prefix, bounded length.
  if (d.startsWith(cc) && d.length >= DIGITS_E164_MIN && d.length <= DIGITS_E164_MAX) return "+" + d;
  const national = d.replace(/^0+/, "");
  const full = cc + national;
  if (national.length >= 6 && full.length <= DIGITS_E164_MAX) return "+" + full;
  return null;
}

// "+919149677787" -> "+91••••••7787": enough for an admin to recognise a row in
// the delivery log without the log itself becoming a phone-number list.
function maskPhone(e164) {
  if (!e164 || typeof e164 !== "string") return "";
  const tail = e164.slice(-4);
  const head = e164.startsWith("+91") ? "+91" : e164.slice(0, 3);
  return `${head}${"•".repeat(Math.max(e164.length - head.length - 4, 2))}${tail}`;
}

module.exports = { toE164, maskPhone };
