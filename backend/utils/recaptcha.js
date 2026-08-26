// Server-side verification for Google reCAPTCHA v3 tokens.
// v3 is score-based (0.0 = likely bot, 1.0 = likely human) — no user
// interaction/challenge, so it doesn't add friction to signup/OTP forms.
//
// This returns a verdict rather than a boolean, because "Google says this is a
// bot" and "we could not reach Google" are different facts and deserve
// different responses. Collapsing them into false is what took production
// down: siteverify became unreachable, every check failed closed, and every
// login and signup was rejected until the check was commented out entirely.
//
// The rule now: a bot verdict blocks, an outage never does. reCAPTCHA is
// defence-in-depth here — account lockout and rate limiting are the controls
// that actually stop brute force, and neither depends on a third party being
// up.

const MIN_SCORE = 0.5;
const TIMEOUT_MS = 4000;

/** @returns {Promise<"human"|"bot"|"missing"|"unavailable">} */
async function checkRecaptcha(token, expectedAction) {
  if (!process.env.RECAPTCHA_SECRET_KEY) return "unavailable";

  // No token is not evidence of a bot — it usually means the widget could not
  // load: a blocked script, an offline moment, a privacy extension. Blocking
  // here is what made signup, login-by-OTP and the contact form all return
  // "Verification failed" in production, because the site CSP did not allow
  // www.google.com and no browser could ever obtain a token.
  if (!token) return "missing";

  try {
    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // 5xx from Google, or anything non-JSON, is an outage on their side —
    // not evidence about this visitor.
    if (!resp.ok) return "unavailable";
    const json = await resp.json();

    const codes = json["error-codes"] || [];
    // These mean our own configuration is wrong. Blocking real users because
    // we misconfigured a key is the outage this module exists to prevent, so
    // treat it as unavailable and let the logs carry the alarm.
    if (codes.includes("invalid-input-secret") || codes.includes("bad-request")) {
      return "unavailable";
    }

    if (!json.success) return "bot";
    if (expectedAction && json.action !== expectedAction) return "bot";
    return (json.score ?? 0) >= MIN_SCORE ? "human" : "bot";
  } catch {
    // Timeout, DNS failure, outbound blocked — all outage, none of it a
    // statement about the visitor.
    return "unavailable";
  }
}

/**
 * Convenience wrapper: true when the request may proceed.
 *
 * Only a scored bot verdict blocks. Missing and unavailable both allow, on the
 * principle that this check may reduce abuse but must never be the reason a
 * paying customer cannot sign in. Volume abuse is contained by authLimiter and
 * contactLimiter, which do not depend on a third party being reachable.
 */
async function verifyRecaptcha(token, expectedAction) {
  const verdict = await checkRecaptcha(token, expectedAction);
  return verdict !== "bot";
}

module.exports = { checkRecaptcha, verifyRecaptcha, MIN_SCORE };
