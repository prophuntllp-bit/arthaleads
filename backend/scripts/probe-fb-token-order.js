/**
 * Reproduces the "App Token failed" warning the Facebook webhook logs on every
 * incoming lead, to establish whether it is a real fault or expected noise.
 *
 * fetchLeadWithFallback (routes/webhookRoutes.js) tries the App Access Token
 * first, on the stated reasoning that it never expires and therefore scales
 * across tenants. If Graph rejects app tokens for leadgen reads outright, that
 * first attempt can never succeed — it just costs a round trip and a warning
 * per lead, and the stored page token does the real work.
 *
 * Read-only.
 * Run: railway run --service Arthaleads node backend/scripts/probe-fb-token-order.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const V = "v23.0";
const LEAD = "1374032788266073";   // a lead that was genuinely delivered

async function tryToken(label, token) {
  const t0 = Date.now();
  const r = await fetch(`https://graph.facebook.com/${V}/${LEAD}?fields=field_data&access_token=${encodeURIComponent(token)}`);
  const j = await r.json();
  const ms = Date.now() - t0;
  if (j.error) console.log(`  ${label.padEnd(12)} ${r.status}  ${ms}ms  ERROR: ${j.error.message}`);
  else console.log(`  ${label.padEnd(12)} ${r.status}  ${ms}ms  OK: ${(j.field_data || []).length} fields`);
  return { ok: !j.error, ms };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");
  const auto = await Automation.findOne({ platform: "Facebook", pageId: "560297671017098" });

  console.log(`Fetching lead ${LEAD} the same way the webhook does:\n`);
  const app = await tryToken("App Token", `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`);
  const page = await tryToken("Page Token", auto.accessToken);

  console.log("\nverdict:");
  if (!app.ok && page.ok) {
    console.log(`  The App Token attempt cannot succeed for leadgen reads.`);
    console.log(`  It is pure overhead: ~${app.ms}ms and one warning line on EVERY lead,`);
    console.log(`  before the page token does the actual work.`);
  } else if (app.ok) {
    console.log("  App Token works — the ordering is correct, warning was transient.");
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
