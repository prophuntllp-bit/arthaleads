// scripts/seed-staging.js - test data for the STAGING environment only.
//
// Run once from the Railway staging service console:  node scripts/seed-staging.js
// Creates a demo company with an admin, manager and agent login, two projects
// and twelve fake leads, so changes can be checked in the staging CRM.
//
// Refuses to run unless every staging switch is on (see docs/STAGING.md), so it
// can never write to production. Does nothing if the demo company already
// exists. The password is random unless STAGING_SEED_PASSWORD is set, and is
// printed once in the console for the owner.
const crypto = require("crypto");

const env = process.env;
const isStaging = env.BACKGROUND_JOBS === "off"
  && env.AUTH_COOKIE_NAME === "crm_token_staging"
  && /railway\.internal/.test(env.MONGO_URI || "");
if (!isStaging) {
  console.error("[seed-staging] refusing to run: this is not the staging environment (BACKGROUND_JOBS=off, AUTH_COOKIE_NAME=crm_token_staging and the Railway-internal staging MongoDB are all required).");
  process.exit(1);
}

(async () => {
  const mongoose = require("mongoose");
  await mongoose.connect(env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");
  const Project = require("../models/Project");
  const Lead = require("../models/Lead");

  if (await Organization.findOne({ slug: "staging-demo" })) {
    console.log("[seed-staging] demo company already exists, nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const password = env.STAGING_SEED_PASSWORD || `Stg-${crypto.randomBytes(9).toString("base64url")}9!`;
  const org = await Organization.create({
    name: "Staging Demo Realty", slug: "staging-demo", plan: "enterprise", isActive: true,
    approvalStatus: "approved", onboardingCompletedAt: new Date(),
  });
  const mk = (name, role) => User.create({
    name, email: `staging-${role}@example.com`, password, role, orgId: org._id, isActive: true, phone: "9000000000",
  });
  const admin = await mk("Staging Admin", "admin");
  await mk("Staging Manager", "manager");
  const agent = await mk("Staging Agent", "agent");

  await Project.insertMany([
    { name: "Staging Heights", location: "Pune", orgId: org._id, createdBy: admin._id, assignedTo: [agent._id] },
    { name: "Staging Plots", location: "Khopoli", orgId: org._id, createdBy: admin._id, assignedTo: [agent._id] },
  ]);
  const sources = ["Facebook", "Website", "WhatsApp", "Manual", "Referral"];
  for (let i = 1; i <= 12; i++) {
    await Lead.create({
      name: `Test Lead ${i}`, phone: `90000000${String(i).padStart(2, "0")}`, source: sources[i % sources.length],
      status: "New", orgId: org._id, createdBy: admin._id, assignedTo: agent._id, assignedToName: agent.name,
    });
  }
  await mongoose.disconnect();
  console.log("[seed-staging] created: 1 company, 3 users, 2 projects, 12 fake leads");
  console.log("[seed-staging] logins: staging-admin@example.com, staging-manager@example.com, staging-agent@example.com");
  console.log(`[seed-staging] password (all three): ${password}`);
})().catch((e) => { console.error("[seed-staging] failed:", e.message); process.exit(1); });
