// utils/publicOrg.js
//
// What an organisation looks like when it is sent to a browser or the app.
// The record holds integration credentials (WhatsApp token, telephony keys,
// the Meta Conversions API token, the voice and QR tokens). Settings screens
// that need them have their own admin-only endpoints, so no organisation
// response should carry them. Replaced by booleans so a screen can still show
// "connected" without ever holding the secret.

const SECRET_PATHS = [
  ["whatsapp", "apiKey"],
  ["whatsapp", "webhookVerifyToken"],
  ["whatsapp", "registrationPin"],
  ["enablex", "apiKey"],
  ["enablex", "webrtc", "videoAppKey"],
  ["metaCapi", "accessToken"],
  ["voiceApiKey"],
  ["qrToken"],
];

function publicOrg(org) {
  if (!org) return org;
  const o = typeof org.toObject === "function" ? org.toObject() : { ...org };
  for (const path of SECRET_PATHS) {
    let parent = o;
    for (let i = 0; i < path.length - 1 && parent; i++) parent = parent[path[i]];
    const leaf = path[path.length - 1];
    if (parent && leaf in parent) {
      const had = !!parent[leaf];
      delete parent[leaf];
      parent[`${leaf}Set`] = had;
    }
  }
  return o;
}

// What an agent gets: no bank, tax or company registration details (those
// are for invoices and billing, which agents can't use), no record of who
// signed the company up from where, no approval/deletion bookkeeping, no
// referral code, and not the WhatsApp assistant's instructions.
// 24 Oct 2026 sweep: every agent could read the bank account and PAN.
const ADMIN_ONLY_PATHS = [
  ["gstNo"], ["pan"], ["cin"], ["bankAccountName"], ["bankAccountNo"], ["bankIfsc"], ["bankName"], ["bankBranch"],
  ["signupIp"], ["signupUserAgent"], ["approvedBy"], ["rejectedReason"],
  ["deletionScheduledAt"], ["deletionRequestedBy"], ["deletionRequestedAt"], ["referralCode"],
  ["whatsapp", "botSystemPrompt"], ["whatsapp", "botGroundRules"], ["whatsapp", "botBusinessContext"],
];

/** publicOrg(), slimmer for an agent. */
function orgForRole(org, role) {
  const o = publicOrg(org);
  if (!o || role !== "agent") return o;
  for (const path of ADMIN_ONLY_PATHS) {
    let parent = o;
    for (let i = 0; i < path.length - 1 && parent; i++) parent = parent[path[i]];
    if (parent) delete parent[path[path.length - 1]];
  }
  return o;
}

module.exports = { publicOrg, orgForRole, SECRET_PATHS, ADMIN_ONLY_PATHS };
