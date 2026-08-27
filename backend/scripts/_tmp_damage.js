require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  for (const c of ["users", "leads", "organizations", "projectleads", "projects", "payments"]) {
    let n = "n/a";
    try { n = await db.collection(c).countDocuments(); } catch (e) { n = "ERR " + e.message; }
    console.log("  " + c.padEnd(16) + n);
  }
  const u = await db.collection("users").find({}, { projection: { email: 1, role: 1, createdAt: 1 } }).limit(6).toArray();
  console.log("\n  sample users:");
  u.forEach(x => console.log("    " + (x.email||"?") + " | " + (x.role||"?") + " | " + (x.createdAt||"?")));
  await mongoose.disconnect();
})();
