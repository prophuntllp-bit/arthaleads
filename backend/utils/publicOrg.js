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

module.exports = { publicOrg, SECRET_PATHS };
