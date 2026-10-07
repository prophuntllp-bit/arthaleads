// Run the whole backend with NO real secrets and NO real database.
//
//   cd backend && npm run sandbox
//
// For Codex and any other agent (or person) that has no .env. It starts an
// in-memory MongoDB, forces every secret to a harmless fake value, seeds one
// Enterprise org with an admin, manager and agent plus a few projects and leads,
// then boots the real server on http://localhost:5000.
//
// Everything is overwritten on purpose, so a stray .env that points at
// production can never be picked up here. Third-party services (WhatsApp, Meta,
// OpenAI, Razorpay, object storage, email) are not configured, so calls to them
// fail or are skipped exactly as they do for an org with nothing connected.
//
// Sandbox logins (fake, local only):
//   sandbox-admin@example.com   / Sandbox#12345
//   sandbox-manager@example.com / Sandbox#12345
//   sandbox-agent@example.com   / Sandbox#12345

const crypto = require("crypto");
const path = require("path");

const FAKE = {
  NODE_ENV: "development",
  PORT: process.env.PORT || "5000",
  JWT_SECRET: "sandbox-jwt-secret-not-real",
  JWT_EXPIRES_IN: "7d",
  CRYPTO_KEY: crypto.randomBytes(32).toString("hex"),
  CLIENT_URLS: "http://localhost:3000,http://localhost:3001,http://localhost:5173",
  FRONTEND_URL: "http://localhost:3000",
  OPENAI_API_KEY: "sk-sandbox-not-real",
  RECAPTCHA_SECRET_KEY: "sandbox",
  FB_VERIFY_TOKEN: "sandbox", FB_APP_ID: "0", FB_APP_SECRET: "sandbox",
  RESEND_API_KEY: "re_sandbox_not_real",
};

(async () => {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  Object.assign(process.env, FAKE, { MONGO_URI: mem.getUri("sandbox") });
  // Never talk to real services from here.
  for (const k of ["B2_KEY_ID", "B2_APP_KEY", "B2_BUCKET", "B2_ENDPOINT", "SENTRY_DSN", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "WA_APP_ID", "WA_APP_SECRET"]) delete process.env[k];

  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI);
  const Organization = require("../models/Organization");
  const User = require("../models/User");
  const Project = require("../models/Project");
  const Lead = require("../models/Lead");

  const org = await Organization.create({
    name: "Sandbox Realty", slug: "sandbox-realty", plan: "enterprise", isActive: true,
    approvalStatus: "approved", onboardingCompletedAt: new Date(),
  });
  const mk = (name, role) => User.create({
    name, email: `sandbox-${role}@example.com`, password: "Sandbox#12345", role, orgId: org._id,
    isActive: true, phone: "9000000000",
  });
  const admin = await mk("Sandbox Admin", "admin");
  const manager = await mk("Sandbox Manager", "manager");
  const agent = await mk("Sandbox Agent", "agent");

  const projects = await Project.insertMany([
    { name: "Sandbox Heights", location: "Pune", orgId: org._id, createdBy: admin._id, assignedTo: [agent._id] },
    { name: "Sandbox Plots", location: "Khopoli", orgId: org._id, createdBy: admin._id, assignedTo: [agent._id] },
  ]);
  const sources = ["Facebook", "Website", "WhatsApp", "Manual", "Referral"];
  for (let i = 1; i <= 12; i++) {
    await Lead.create({
      name: `Sandbox Lead ${i}`, phone: `90000000${String(i).padStart(2, "0")}`, source: sources[i % sources.length],
      status: "New", orgId: org._id, createdBy: admin._id, assignedTo: agent._id, assignedToName: agent.name,
    });
  }
  await mongoose.disconnect();

  console.log("\n[sandbox] in-memory database ready, seeded 1 org, 3 users, 2 projects, 12 leads");
  console.log("[sandbox] logins: sandbox-admin@example.com / sandbox-manager@example.com / sandbox-agent@example.com, password Sandbox#12345\n");
  require(path.join(__dirname, "..", "server.js"));
})().catch((e) => { console.error("[sandbox] failed:", e); process.exit(1); });
