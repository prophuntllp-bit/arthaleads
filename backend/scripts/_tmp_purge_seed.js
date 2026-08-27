require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const SEED_EMAILS = ["admin@arthaleads.com","manager@arthaleads.com","ravi@arthaleads.com","pooja@arthaleads.com"];
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.db.collection("users");
  const found = await users.find({ email: { $in: SEED_EMAILS } }).toArray();
  console.log("  matching seed fixtures:", found.length);
  found.forEach(u => console.log("    " + u.email + " | orgId: " + (u.orgId || "NONE") + " | created " + u.createdAt.toISOString()));
  if (process.argv[2] === "--delete") {
    const r = await users.deleteMany({ email: { $in: SEED_EMAILS } });
    console.log("\n  DELETED:", r.deletedCount);
    console.log("  users remaining:", await users.countDocuments());
  } else {
    console.log("\n  (dry run — pass --delete to remove)");
  }
  await mongoose.disconnect();
})();
