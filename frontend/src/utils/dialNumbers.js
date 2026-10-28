// dialNumbers.js — the numbers a lead's phone field holds, ready to dial
// (28 Oct 2026). Mirrors backend/utils/dialNumbers.js: a field can hold two
// numbers ("7020074316/8958108809") or a foreign one (+971 UAE), and company
// calling through Plivo's India account only reaches Indian numbers.

const COUNTRIES = {
  971: "UAE", 966: "Saudi Arabia", 974: "Qatar", 968: "Oman", 973: "Bahrain", 965: "Kuwait",
  1: "US / Canada", 44: "UK", 61: "Australia", 64: "New Zealand", 65: "Singapore", 60: "Malaysia",
  49: "Germany", 33: "France", 31: "Netherlands", 41: "Switzerland", 353: "Ireland", 977: "Nepal", 880: "Bangladesh",
};

function countryOf(digits) {
  for (const len of [3, 2, 1]) {
    const c = COUNTRIES[digits.slice(0, len)];
    if (c) return c;
  }
  return "";
}

function classify(part) {
  let d = String(part || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^[6-9]\d{9}$/.test(d) || /^[1-5]\d{9}$/.test(d)) d = `91${d}`;
  else if (/^0[1-9]\d{9}$/.test(d)) d = `91${d.slice(1)}`;
  const indian = /^91\d{10}$/.test(d);
  const valid = indian || (d.length >= 8 && d.length <= 15 && !d.startsWith("91") && !!countryOf(d));
  return { e164: d, indian, valid, country: indian ? "India" : countryOf(d) };
}

/** Every number in a phone field, in the order written; duplicates dropped. */
export function dialOptions(raw) {
  const parts = String(raw || "").split(/[/,;|]|\bor\b|\band\b/i).map((p) => p.trim()).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts.length ? parts : [String(raw || "")]) {
    const o = classify(p);
    if (!o.e164 || seen.has(o.e164)) continue;
    seen.add(o.e164);
    out.push(o);
  }
  return out;
}

/** "917020074316" reads as "+91 70200 74316"; others as "+<digits>". */
export function showDialNumber(e164) {
  return /^91\d{10}$/.test(e164) ? `+91 ${e164.slice(2, 7)} ${e164.slice(7)}` : `+${e164}`;
}

/** Why a call failed, in words, from what Plivo or EnableX reported. Empty when unknown. */
export function missedReason(meta = {}) {
  const cause = String(meta.cause || meta.bLegHangupCause || "").toLowerCase();
  if (cause.includes("country barred")) return "International number";
  if (cause.includes("invalid destination") || cause.includes("unallocated")) return "Invalid number";
  if (cause.includes("busy")) return "Busy";
  if (cause.includes("reject") || cause.includes("declin")) return "Declined";
  if (cause.includes("no answer") || cause.includes("not answered") || cause.includes("timeout")) return "No answer";
  if (meta.agentAnswered === false || meta.agentLegStatus === "no-answer") return "Agent didn't answer";
  if (meta.customerAnswered) return "Picked up briefly or voicemail";
  return "";
}
