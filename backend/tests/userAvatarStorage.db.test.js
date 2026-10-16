// Profile photos go to file storage on save; only the link stays in the user
// record, and the per-request auth lookup no longer reads the photo.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.connection.createCollection("users").catch(() => {});
  const storage = require("../utils/storage");
  const puts = [];
  storage.isConfigured = () => true;
  storage.putDataUri = async (key, dataUri, opts) => { puts.push({ key, len: dataUri.length, opts }); return `https://api.example.com/api/media/${key}.jpg`; };
  const User = require("../models/User");
  console.log("\nProfile photos in file storage\n");

  const orgId = new mongoose.Types.ObjectId();
  const photo = "data:image/jpeg;base64," + "A".repeat(200000);
  const u = await User.create({ name: "Pranav", email: "p@example.com", password: "Secret#123", role: "manager", orgId, avatar: photo });
  let doc = await User.findById(u._id).lean();
  check(/^https:\/\/api\.example\.com\/api\/media\/arthaleads\/avatars\//.test(doc.avatar) && puts.length === 1 && String(puts[0].opts.orgId) === String(orgId), "a new photo is uploaded and only its link is saved", doc.avatar?.slice(0, 60));

  const user = await User.findById(u._id);
  user.name = "Pranav Nair"; await user.save();
  check(puts.length === 1, "saving other fields doesn't upload again");
  user.avatar = "https://lh3.googleusercontent.com/a/photo"; await user.save();
  check(puts.length === 1 && (await User.findById(u._id).lean()).avatar.startsWith("https://lh3"), "a link (e.g. Google photo) is kept as it is");
  user.avatar = ""; await user.save();
  check((await User.findById(u._id).lean()).avatar === "", "removing the photo still works");

  storage.isConfigured = () => false;
  user.avatar = photo; await user.save();
  check((await User.findById(u._id).lean()).avatar === photo, "without file storage (local sandbox) the photo is kept inline as before");

  const fs = require("fs");
  check(/select\("-password -avatar"\)/.test(fs.readFileSync(require.resolve("../middlewares/auth"), "utf8")), "the per-request auth lookup doesn't read the photo");

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all profile photo checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
