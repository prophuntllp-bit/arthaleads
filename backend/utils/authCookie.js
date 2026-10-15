// utils/authCookie.js - name and domain of the login cookie.
//
// Production uses "crm_token" on ".arthaleads.com" (shared by www, app and api).
// Staging runs on other arthaleads.com subdomains, so it must use a different
// cookie name: otherwise the browser would send the production cookie to the
// staging API (and the other way round) and both logins would break.
// Staging sets AUTH_COOKIE_NAME=crm_token_staging. COOKIE_DOMAIN can override
// the domain ("" = host-only). Defaults keep production exactly as before.
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "crm_token";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN !== undefined
  ? (process.env.COOKIE_DOMAIN || undefined)
  : (process.env.NODE_ENV === "production" ? ".arthaleads.com" : undefined);

module.exports = { COOKIE_NAME, COOKIE_DOMAIN };
