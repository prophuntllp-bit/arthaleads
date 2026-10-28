// utils/dialNumbers.js - the numbers a lead's phone field holds, ready to dial
// (28 Oct 2026). A phone field sometimes holds two numbers ("7020074316/
// 8958108809") or a foreign one (+971 UAE); company calling through Plivo's
// India account can only reach Indian numbers, and Plivo refuses anything
// else only after the agent's phone has already rung. These helpers let the
// call start pick the right number, or say why it can't, before that.
// Mirrored in frontend/src/utils/dialNumbers.js.

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

/** One number as dialling digits: Indian ones with 91, others as written. */
function classify(part) {
  let d = String(part || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^[6-9]\d{9}$/.test(d) || /^[1-5]\d{9}$/.test(d)) d = `91${d}`;          // Indian mobile or landline
  else if (/^0[1-9]\d{9}$/.test(d)) d = `91${d.slice(1)}`;                     // 0 + 10 digits
  const indian = /^91\d{10}$/.test(d);
  const valid = indian || (d.length >= 8 && d.length <= 15 && !d.startsWith("91") && !!countryOf(d));
  return { e164: d, indian, valid, country: indian ? "India" : countryOf(d) };
}

/** Every number in a phone field, in the order written; duplicates dropped. */
function dialOptions(raw) {
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

/**
 * The number company calling should dial, or why there is none.
 * @returns {{ number?: string, reason?: "international"|"invalid"|"none", country?: string, options: object[] }}
 */
function pickIndianNumber(raw, wanted) {
  const options = dialOptions(raw);
  if (wanted) {
    const w = classify(wanted).e164;
    const hit = options.find((o) => o.e164 === w);
    if (hit?.indian) return { number: hit.e164, options };
  }
  const indian = options.find((o) => o.indian);
  if (indian) return { number: indian.e164, options };
  if (!options.length) return { reason: "none", options };
  const foreign = options.find((o) => o.valid && !o.indian);
  if (foreign) return { reason: "international", country: foreign.country, options };
  return { reason: "invalid", options };
}

module.exports = { dialOptions, pickIndianNumber, classify };
