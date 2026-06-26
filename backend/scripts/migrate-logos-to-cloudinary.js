/**
 * migrate-logos-to-cloudinary.js
 *
 * One-time migration: finds all orgs whose logo is stored as a base64
 * data-URI and uploads it to Cloudinary, replacing it with a compact HTTPS URL.
 *
 * Run from the backend directory:
 *   node scripts/migrate-logos-to-cloudinary.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const { uploadOrgLogo } = require("../utils/upload");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const orgs = await Organization.find({
    logo: { $regex: "^data:image/", $options: "i" },
  }).select("_id name logo");

  if (!orgs.length) {
    console.log("✨ No base64 logos found — all orgs already use Cloudinary URLs.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n🔄 Found ${orgs.length} org(s) with base64 logos. Uploading…\n`);

  let ok = 0, failed = 0;

  for (const org of orgs) {
    try {
      const url = await uploadOrgLogo(org.logo, org._id.toString());
      await Organization.findByIdAndUpdate(org._id, { logo: url });
      console.log(`  ✅ ${org.name} (${org._id}) → ${url}`);
      ok++;
    } catch (err) {
      console.error(`  ❌ ${org.name} (${org._id}): ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone — ${ok} migrated, ${failed} failed.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
