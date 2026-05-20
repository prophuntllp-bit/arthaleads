/**
 * One-time script: Remove Saurabh as super_admin, make Abhishek super_admin
 * Run: railway run node scripts/update-super-admin.js
 */
const mongoose = require("mongoose");
const User = require("../models/User");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // Show current super admins
  const currentSuperAdmins = await User.find({ role: "super_admin" }).select("name email role");
  console.log("\nCurrent super_admins:");
  currentSuperAdmins.forEach(u => console.log(`  - ${u.name} (${u.email})`));

  // Demote Saurabh from super_admin → admin
  const saurabh = await User.findOne({ name: /saurabh/i });
  if (saurabh) {
    const oldRole = saurabh.role;
    saurabh.role = "admin";
    await saurabh.save();
    console.log(`\n✅ ${saurabh.name} (${saurabh.email}): ${oldRole} → admin`);
  } else {
    console.log("\n⚠️  No user named Saurabh found");
  }

  // Promote Abhishek to super_admin
  const abhishek = await User.findOne({ name: /abhishek/i });
  if (abhishek) {
    const oldRole = abhishek.role;
    abhishek.role = "super_admin";
    await abhishek.save();
    console.log(`✅ ${abhishek.name} (${abhishek.email}): ${oldRole} → super_admin`);
  } else {
    console.log("⚠️  No user named Abhishek found");
  }

  // Confirm final state
  const finalAdmins = await User.find({ role: "super_admin" }).select("name email role");
  console.log("\nFinal super_admins:");
  finalAdmins.forEach(u => console.log(`  - ${u.name} (${u.email})`));

  await mongoose.disconnect();
  console.log("\nDone.");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
