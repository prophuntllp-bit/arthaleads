/**
 * Exercises the live billing API as a real org admin.
 *
 * Checks that Razorpay is configured on the server, that a quote comes back at
 * the price the pricing module says, and — crucially — that the server refuses
 * to be told what something costs. Read-only apart from creating a Razorpay
 * TEST order, which moves no money and is never captured.
 *
 * Run: railway run --service Arthaleads node backend/scripts/verify-billing-endpoint.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const BASE = process.env.APP_URL || "https://api.arthaleads.com";

async function call(path, token, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON error page */ }
  return { status: res.status, json };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require("../models/User");
  const Organization = require("../models/Organization");

  // Use a real admin so the auth + org-scoping paths are genuinely exercised.
  const admin = await User.findOne({ role: "admin", isActive: true }).select("_id name orgId").lean();
  if (!admin) { console.log("no active admin found"); await mongoose.disconnect(); return; }
  const org = await Organization.findById(admin.orgId).select("name plan seats paidUntil").lean();

  console.log(`as    : ${admin.name} (admin)`);
  console.log(`org   : ${org?.name}  plan=${org?.plan} seats=${org?.seats ?? "-"}\n`);

  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "3m" });

  const plans = await call("/api/billing/plans", token);
  console.log(`GET  /billing/plans   ${plans.status}`);
  if (plans.json) {
    console.log(`  configured=${plans.json.configured}  testMode=${plans.json.testMode}  keyId=${plans.json.keyId}`);
    for (const p of plans.json.plans || []) {
      console.log(`  ${p.id.padEnd(8)} monthly ₹${p.monthly}  annual ₹${p.annual}  seats ${p.minSeats}-${p.maxSeats}`);
    }
  }

  const me = await call("/api/billing/me", token);
  console.log(`\nGET  /billing/me      ${me.status}  ${JSON.stringify(me.json?.billing || me.json)}`);

  // A valid order. Creates a TEST-mode Razorpay order; no money moves.
  const good = await call("/api/billing/order", token, {
    body: { plan: "growth", seats: 5, cycle: "monthly" },
  });
  console.log(`\nPOST /billing/order   ${good.status}`);
  if (good.json?.quote) {
    const q = good.json.quote;
    console.log(`  quoted ₹${q.total} (${q.amountPaise} paise) for ${q.planId} x${q.seats} ${q.cycle}`);
    console.log(`  order  ${good.json.order?.id}  amount=${good.json.order?.amount}`);
    console.log(`  amount matches quote: ${good.json.order?.amount === q.amountPaise}`);
  } else {
    console.log(`  ${JSON.stringify(good.json)}`);
  }

  // The important negative tests: the client must not be able to set the price,
  // buy below the minimum, exceed the cap, or purchase Enterprise.
  console.log("\nrejections:");
  const bad = [
    { label: "below minimum seats", body: { plan: "growth", seats: 2, cycle: "monthly" } },
    { label: "above plan cap",      body: { plan: "starter", seats: 40, cycle: "annual" } },
    { label: "enterprise online",   body: { plan: "enterprise", seats: 30, cycle: "annual" } },
    { label: "bad cycle",           body: { plan: "growth", seats: 5, cycle: "weekly" } },
    { label: "client-set amount",   body: { plan: "growth", seats: 5, cycle: "monthly", amount: 1, amountPaise: 100, total: 1 } },
  ];
  for (const t of bad) {
    const r = await call("/api/billing/order", token, { body: t.body });
    const quoted = r.json?.quote ? `₹${r.json.quote.total}` : "";
    console.log(`  ${t.label.padEnd(22)} ${r.status}  ${r.json?.message || quoted}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
