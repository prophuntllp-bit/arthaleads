// scripts/move-avatars-to-storage.js - one-off: move profile photos stored
// inline in user records (data URIs, up to 2.5 MB each) to file storage, so
// the database holds only a link. New photos already go there on save
// (models/User.js storeAvatarInFiles).
//
// Run from the Railway console of the service whose database it should fix:
//   node scripts/move-avatars-to-storage.js           (preview, changes nothing)
//   node scripts/move-avatars-to-storage.js --apply   (moves them)
// Needs the B2_* storage settings, so it does nothing useful on staging.
const apply = process.argv.includes("--apply");

(async () => {
  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI);
  const storage = require("../utils/storage");
  const User = require("../models/User");
  if (!storage.isConfigured()) {
    console.log("[move-avatars] file storage is not configured here (B2_*); nothing to do.");
    await mongoose.disconnect(); process.exit(0);
  }
  const users = await User.find({ avatar: /^data:image\//i }).select("name orgId avatar").lean();
  console.log(`[move-avatars] ${users.length} photo(s) stored inline${apply ? "" : " (preview only, add --apply to move them)"}`);
  let moved = 0;
  for (const u of users) {
    const kb = Math.round(Buffer.byteLength(u.avatar) / 1024);
    if (!apply) { console.log(`  would move: ${u.name} (${kb} KB)`); continue; }
    try {
      const url = await storage.putDataUri(`arthaleads/avatars/${u.orgId || "platform"}/${u._id}-${Date.now()}-${require("crypto").randomBytes(6).toString("hex")}`, u.avatar, { orgId: u.orgId || undefined });
      // Only replace the photo if it is still the one we read.
      const r = await User.updateOne({ _id: u._id, avatar: u.avatar }, { $set: { avatar: url } });
      if (r.modifiedCount) { moved++; console.log(`  moved: ${u.name} (${kb} KB) -> ${url}`); }
      else console.log(`  skipped: ${u.name} (photo changed meanwhile)`);
    } catch (e) { console.log(`  FAILED: ${u.name}: ${e.message}`); }
  }
  if (apply) console.log(`[move-avatars] moved ${moved} of ${users.length}.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error("[move-avatars] failed:", e.message); process.exit(1); });
