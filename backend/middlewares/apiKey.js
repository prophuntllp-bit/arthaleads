// Middleware: per-org API key authentication for the voice integration.
//
// Each organisation generates its own key (stored in Organization.voiceApiKey).
// The key lookup both authenticates the request AND identifies which org it belongs
// to, so callers cannot spoof X-Org-Id to access another tenant's data.
//
// Migration path from the legacy single VOICE_API_KEY env var:
//   Orgs that have not yet generated a per-org key fall back to the global env key.
//   Once all orgs have per-org keys, remove VOICE_API_KEY from the environment.

const Organization = require("../models/Organization");

module.exports = async function apiKeyAuth(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) {
    return res.status(401).json({ success: false, message: "Missing X-Api-Key header" });
  }

  // 1. Per-org key lookup (preferred path — eliminates cross-tenant spoofing)
  const org = await Organization.findOne({ voiceApiKey: key, isActive: true }).lean();
  if (org) {
    req.org   = org;
    req.orgId = org._id;
    return next();
  }

  // 2. Legacy fallback: single global key for orgs not yet migrated
  if (process.env.VOICE_API_KEY && key === process.env.VOICE_API_KEY) {
    // Global key is valid but org is not determined — voiceRoutes will require
    // the X-Org-Id header or VOICE_ORG_ID env var as before.
    req._legacyVoiceKey = true;
    return next();
  }

  return res.status(401).json({ success: false, message: "Invalid API key" });
};
