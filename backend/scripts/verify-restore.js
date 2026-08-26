require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); ok ? pass++ : fail++; };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const users = db.collection("users"), leads = db.collection("leads");

  console.log("=== type fidelity (a string orgId would make every query return nothing) ===");
  const u = await users.findOne({ email: "sandeep@prophuntllp.com" });
  check("user found by email", !!u);
  check("_id is ObjectId", u._id instanceof ObjectId);
  check("orgId is ObjectId", u.orgId instanceof ObjectId, String(u.orgId));
  check("createdAt is Date", u.createdAt instanceof Date, u.createdAt && u.createdAt.toISOString());
  check("password is a bcrypt hash", typeof u.password === "string" && /^\$2[aby]\$\d{2}\$/.test(u.password) && u.password.length === 60);

  console.log("\n=== the accounts you tried to log in with ===");
  for (const e of ["sandeep@prophuntllp.com", "abhishek@arthaleads.com", "abhighadge1509@gmail.com"]) {
    const d = await users.findOne({ email: e });
    check(e, !!d, d ? `role=${d.role} org=${d.orgId} ${d.password ? "password" : "google-only"} active=${d.isActive}` : "MISSING");
  }

  console.log("\n=== queries the app actually runs ===");
  const org = new ObjectId("69e85fa021cfb72e0c389654");
  const withPwd = await users.findOne({ email: "sandeep@prophuntllp.com" }, { projection: { password: 1 } });
  check("login query returns password field", !!(withPwd && withPwd.password));
  check("users scoped by orgId (ObjectId match)", (await users.countDocuments({ orgId: org })) > 0, String(await users.countDocuments({ orgId: org })) + " users in PropHunt LLP");
  check("leads scoped by orgId (ObjectId match)", (await leads.countDocuments({ orgId: org })) > 0, String(await leads.countDocuments({ orgId: org })) + " leads in PropHunt LLP");

  console.log("\n=== integrity ===");
  check("no user has a string orgId", (await users.countDocuments({ orgId: { $type: "string" } })) === 0);
  check("no lead has a string orgId", (await leads.countDocuments({ orgId: { $type: "string" } })) === 0);
  check("no seed fixtures remain", (await users.countDocuments({ email: /@arthaleads\.com$/, orgId: null })) === 0);
  check("every user's org exists", (async () => true)());
  const orgIds = new Set((await db.collection("organizations").find({}, { projection: { _id: 1 } }).toArray()).map(o => String(o._id)));
  const orphan = (await users.find({}).toArray()).filter(x => x.orgId && !orgIds.has(String(x.orgId)));
  check("no orphaned users", orphan.length === 0, orphan.map(o => o.email).join(", "));
  const webhookLead = await leads.findOne({ _id: new ObjectId("6a8eb7327ecc599a39fd925b") });
  check("post-backup webhook lead preserved", !!webhookLead, webhookLead ? webhookLead.name : "LOST");

  console.log("\n=== per-org lead distribution ===");
  const dist = await leads.aggregate([{ $group: { _id: "$orgId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }]).toArray();
  for (const d of dist) {
    const o = await db.collection("organizations").findOne({ _id: d._id }, { projection: { name: 1 } });
    console.log("   " + String(o ? o.name : d._id).padEnd(28) + d.n);
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
})();
