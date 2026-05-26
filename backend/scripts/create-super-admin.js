#!/usr/bin/env node
// scripts/create-super-admin.js
// Creates a standalone super_admin account with no org (orgId = null).
// Usage: node scripts/create-super-admin.js
// Or with env: EMAIL=x@y.com PASSWORD=secret node scripts/create-super-admin.js

require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, ans => { rl.close(); res(ans.trim()); }));
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require("../models/User");

  const email    = process.env.EMAIL    || await prompt("Email: ");
  const password = process.env.PASSWORD || await prompt("Password: ");
  const name     = process.env.NAME     || await prompt("Name (default: Super Admin): ") || "Super Admin";

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role === "super_admin") {
      console.log("✓ Super admin already exists:", existing.email);
    } else {
      console.error("✗ Email already registered as:", existing.role);
    }
    await mongoose.disconnect();
    return;
  }

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    password,
    role:   "super_admin",
    orgId:  null,
    isActive: true,
  });

  console.log("✓ Super admin created:", user.email, "| ID:", user._id.toString());
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
