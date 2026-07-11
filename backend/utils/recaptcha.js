// Server-side verification for Google reCAPTCHA v3 tokens.
// v3 is score-based (0.0 = likely bot, 1.0 = likely human) — no user
// interaction/challenge, so it doesn't add friction to signup/OTP forms.
const MIN_SCORE = 0.5;

async function verifyRecaptcha(token, expectedAction) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    // Not configured — fail closed in production so a missing env var can't
    // silently disable this protection; fail open in dev so it's not a
    // blocker before the key exists locally.
    return process.env.NODE_ENV !== "production";
  }
  if (!token) return false;

  try {
    const params = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: token,
    });
    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = await resp.json();
    if (!json.success) return false;
    if (expectedAction && json.action !== expectedAction) return false;
    return (json.score ?? 0) >= MIN_SCORE;
  } catch {
    // Couldn't reach Google — fail closed rather than let a network issue
    // (or someone blocking outbound calls to google.com) bypass this check.
    return false;
  }
}

module.exports = { verifyRecaptcha };
