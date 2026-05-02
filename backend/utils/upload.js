// utils/upload.js — Cloudinary helpers for logo storage
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 data-URI to Cloudinary.
 * Uses orgId as a stable public_id so re-uploads overwrite the same asset.
 * Returns the secure HTTPS URL.
 */
async function uploadOrgLogo(dataUri, orgId) {
  const result = await cloudinary.uploader.upload(dataUri, {
    public_id:      `org-${orgId}`,
    folder:         "arthaleads/logos",
    overwrite:      true,
    invalidate:     true,
    resource_type:  "image",
    transformation: [
      { width: 400, height: 400, crop: "limit", quality: "auto:good", fetch_format: "auto" },
    ],
  });
  return result.secure_url;
}

/**
 * Delete an org logo from Cloudinary.
 * Silently swallows errors (e.g. asset already gone).
 */
async function deleteOrgLogo(orgId) {
  try {
    await cloudinary.uploader.destroy(`arthaleads/logos/org-${orgId}`, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (err) {
    console.error(`[cloudinary] deleteOrgLogo failed for org-${orgId}:`, err.message);
  }
}

module.exports = { uploadOrgLogo, deleteOrgLogo };
