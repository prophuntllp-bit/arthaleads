// AES-256-GCM field-level encryption for sensitive values stored in MongoDB.
// Set CRYPTO_KEY to a 64-hex-character string (32 bytes) in the environment.
// Values encrypted by this module are prefixed with "enc1:" to distinguish
// them from plaintext, enabling safe migration of existing records.
const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const PREFIX = "enc1:"; // version prefix allows future algorithm changes

function _getKey() {
  const hex = process.env.CRYPTO_KEY;
  if (!hex || hex.length !== 64) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRYPTO_KEY must be a 64-hex-character string in production");
    }
    return null; // dev/test: passthrough (no encryption)
  }
  return Buffer.from(hex, "hex");
}

function encryptField(value) {
  if (!value) return value;
  if (value.startsWith(PREFIX)) return value; // already encrypted
  const key = _getKey();
  if (!key) return value; // dev passthrough
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16-byte auth tag
  // Layout: enc1: + iv(24 hex) + tag(32 hex) + ciphertext(hex)
  return PREFIX + iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

function decryptField(value) {
  if (!value) return value;
  if (!value.startsWith(PREFIX)) return value; // plaintext passthrough (migration safety)
  const key = _getKey();
  if (!key) return value;
  try {
    const hex = value.slice(PREFIX.length);
    const iv        = Buffer.from(hex.slice(0, 24), "hex");
    const tag       = Buffer.from(hex.slice(24, 56), "hex");
    const encrypted = Buffer.from(hex.slice(56), "hex");
    const decipher  = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    return value; // tampered or wrong key — return as-is rather than crashing
  }
}

module.exports = { encryptField, decryptField };
