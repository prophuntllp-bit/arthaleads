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
  return /[a-zA-Zऀ-ॿ]/.test(String(name || ""));
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
  if (!looksLikeRealName(s) || s.replace(/[^\p{L}]/gu, "").length < 2) return false;
  const words = s.toLowerCase().split(/[\s.,!?-]+/).filter(Boolean);
  return !words.every((w) => FILLER.has(w));
}

module.exports = { looksLikeRealName, looksLikeCallerName };
