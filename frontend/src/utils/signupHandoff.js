// utils/signupHandoff.js
//
// The emailed verification link is usually opened on a different device from
// the one holding the signup form — you start on the laptop, the mail arrives
// on your phone. These helpers are what let the laptop tab notice and carry on
// by itself instead of stranding you in front of a code box.
//
// The tab that starts a signup mints a random secret, keeps it here, and sends
// only its SHA-256 to the server. When it polls for the result it presents the
// secret, so knowing somebody's email address is not enough to collect their
// signup token.
//
// sessionStorage rather than localStorage: this is scoped to one signup in one
// tab, and it should not outlive the tab. Every access is wrapped because
// storage throws outright in some privacy modes rather than returning null.

const SECRET_KEY = "arthaleads.signup.handoff";
const TOKEN_KEY  = "arthaleads.signup.token";
const EMAIL_KEY  = "arthaleads.signup.email";

function read(k)     { try { return sessionStorage.getItem(k) || ""; } catch { return ""; } }
function write(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } }
function drop(k)     { try { sessionStorage.removeItem(k); } catch { /* private mode */ } }

const toHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Mints a fresh secret for this tab and returns it. */
export function newHandoff() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = toHex(bytes);
  write(SECRET_KEY, secret);
  return secret;
}

export function getHandoff() { return read(SECRET_KEY); }
export function clearHandoff() { drop(SECRET_KEY); }

/** SHA-256 as lowercase hex. Needs a secure context, which localhost counts as. */
export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

// The verify-email page hands the proof-of-ownership token to the signup form
// when the two are in the same browser, so continuing there skips the code box.
export function stashVerified(signupToken, email) {
  write(TOKEN_KEY, signupToken);
  write(EMAIL_KEY, email || "");
}

/** Reads and immediately clears the handover, so a refresh cannot replay it. */
export function takeVerified() {
  const signupToken = read(TOKEN_KEY);
  const email = read(EMAIL_KEY);
  drop(TOKEN_KEY); drop(EMAIL_KEY);
  return signupToken ? { signupToken, email } : null;
}
