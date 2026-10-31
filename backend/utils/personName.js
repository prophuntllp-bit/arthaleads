// Is this a person's name, or a WhatsApp profile placeholder / a word a voice
// call heard as one? Shared by the WhatsApp chat reader (routes/whatsappRoutes.js)
// and the Vistrow Voice call result (routes/webhookRoutes.js).

// A WhatsApp contact's display name is whatever they set on their own
// phone — sometimes an emoji, a nickname, or blank, none of which is
// something worth keeping once the customer actually introduces themselves
// in the chat (see enrichWhatsAppLead). "Real" here just means it has
// at least one letter — good enough to tell "😊" or a bare phone number
// apart from an actual name, in any script.
function looksLikeRealName(name) {
  return /[a-zA-Zऀ-ॿ]/.test(String(name || "")) && !isPlaceholderName(name);
}

// What a sender puts in the name field when it has no name (Vistrow sent
// "not provided" for calls 1702/1703 on 31 Oct 2026). Never a person's name,
// so it never replaces one and a real name may replace it.
const PLACEHOLDERS = new Set([
  "not provided", "notprovided", "not available", "not given", "not known", "not specified", "not mentioned",
  "unknown", "unknown caller", "unknown user", "unknown customer", "unknown lead", "no name", "noname", "name",
  "n/a", "na", "n.a.", "nil", "none", "null", "undefined", "nan", "-", "--", "?", "anonymous", "test",
  "caller", "customer", "user", "lead", "visitor", "website visitor", "guest",
]);

// A placeholder, or the phone number itself (or any text without letters).
function isPlaceholderName(name, phone) {
  const s = String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!s || PLACEHOLDERS.has(s) || PLACEHOLDERS.has(s.replace(/[.\s]+$/, ""))) return true;
  if (!/[\p{L}]/u.test(s)) return true;
  const digits = s.replace(/\D/g, "");
  const phoneDigits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 7 && phoneDigits.length >= 7 && digits.slice(-10) === phoneDigits.slice(-10);
}

// Words a call can return as the "name" when the caller only said a greeting
// or a yes ("ji", "hello", "haan ji"). A name made only of these is not one.
const FILLER = new Set([
  "ji", "jee", "haan", "han", "haa", "ha", "hello", "helo", "hallo", "hi", "hey", "namaste", "namaskar",
  "sir", "madam", "mam", "maam", "ma'am", "ok", "okay", "theek", "thik", "hai", "nahi", "na", "yes", "no",
  "bhai", "bhaiya", "didi", "aap", "main", "mera", "naam", "name", "unknown", "customer", "caller", "user",
  "जी", "हाँ", "हां", "हैलो", "नमस्ते",
]);

// Stricter rule for a name heard on a call: a real name, at least two
// letters, and not just greeting/filler words.
function looksLikeCallerName(name) {
  const s = String(name || "").trim();
  if (!looksLikeRealName(s) || isPlaceholderName(s) || s.replace(/[^\p{L}]/gu, "").length < 2) return false;
  const words = s.toLowerCase().split(/[\s.,!?-]+/).filter(Boolean);
  return !words.every((w) => FILLER.has(w));
}

module.exports = { looksLikeRealName, looksLikeCallerName, isPlaceholderName };
