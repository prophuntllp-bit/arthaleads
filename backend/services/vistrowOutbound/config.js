// Validation for the owner-facing settings. Pure, so it is tested without a server.

const T = require("./transport");

// Changing any of these re-points where lead data goes or how it authenticates.
// While the integration is on, doing so switches it OFF and requires the owner
// to enable it again: a typo in a live endpoint must not silently redirect
// leads' contact details somewhere else.
const SENSITIVE_KEYS = ["baseUrl", "accountId", "secret", "authMode"];

function validateConfigInput(body = {}) {
  const errors = [];
  const value = {};

  if (body.baseUrl !== undefined) {
    const r = T.validateBaseUrl(body.baseUrl);
    if (!r.ok) errors.push(`baseUrl: ${r.reason}`);
    else value.baseUrl = r.origin;
  }
  if (body.accountId !== undefined) {
    if (!T.validateAccountId(body.accountId)) errors.push("accountId: use 1-64 letters, numbers, dashes or underscores.");
    else value.accountId = String(body.accountId).trim();
  }
  if (body.secret !== undefined && body.secret !== "") {
    const s = String(body.secret);
    // eslint-disable-next-line no-control-regex
    if (s.length < 16 || s.length > 256 || /[\s\u0000-\u001F\u007F]/.test(s)) errors.push("secret: expected 16-256 characters with no spaces.");
    else value.secret = s;
  }
  if (body.authMode !== undefined) {
    if (!["header", "bearer"].includes(body.authMode)) errors.push("authMode: must be header or bearer.");
    else value.authMode = body.authMode;
  }
  if (body.defaultCountryCode !== undefined) {
    if (!/^\d{1,4}$/.test(String(body.defaultCountryCode))) errors.push("defaultCountryCode: digits only, e.g. 91.");
    else value.defaultCountryCode = String(body.defaultCountryCode);
  }
  if (body.dedupeWindowHours !== undefined) {
    const n = Number(body.dedupeWindowHours);
    if (!Number.isInteger(n) || n < 0 || n > 720) errors.push("dedupeWindowHours: whole number from 0 to 720.");
    else value.dedupeWindowHours = n;
  }
  if (body.maxLeadAgeMinutes !== undefined) {
    const n = Number(body.maxLeadAgeMinutes);
    if (!Number.isInteger(n) || n < 1 || n > 180) errors.push("maxLeadAgeMinutes: whole number from 1 to 180.");
    else value.maxLeadAgeMinutes = n;
  }
  if (body.emitImports !== undefined) {
    if (typeof body.emitImports !== "boolean") errors.push("emitImports: must be true or false.");
    else value.emitImports = body.emitImports;
  }
  return { errors, value };
}

// Which saved fields would actually change, among the sensitive ones.
function sensitiveChanges(value, current) {
  return SENSITIVE_KEYS.filter((k) => value[k] !== undefined && (k === "secret" ? true : value[k] !== current?.[k]));
}

module.exports = { validateConfigInput, sensitiveChanges, SENSITIVE_KEYS };
