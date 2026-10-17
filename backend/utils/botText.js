// utils/botText.js - last clean-up of anything the WhatsApp bot says.
//
// Owner rule: no em dashes (or en dashes) in customer-facing bot text. The
// prompt says so, but the model still slips one in now and then (1 of 470 bot
// messages in the week to 17 Oct 2026), so every bot send passes through here.
//   "1–3 months", "₹45 — 60 lakh"  ->  "1 to 3 months", "₹45 to 60 lakh"
//   "checking in—are you"          ->  "checking in, are you"
//   "— Floor plan" at a line start ->  "- Floor plan"
// Messages typed by people in the Inbox are never changed.

function noDashes(text) {
  let s = String(text ?? "");
  if (!/[–—]/.test(s)) return s;
  s = s.replace(/(\d)\s*[–—]\s*(?=[₹$]?\d)/g, "$1 to ");     // number ranges
  s = s.replace(/^([ \t]*)[–—][ \t]*/gm, "$1- ");          // used as a bullet
  s = s.replace(/[ \t]*[–—]+[ \t]*/g, ", ");               // between words
  s = s.replace(/,\s*([,.!?;:])/g, "$1");                            // ", ." -> "."
  s = s.replace(/,[ \t]*$/gm, "");                                   // dash at a line end
  return s;
}

module.exports = { noDashes };
