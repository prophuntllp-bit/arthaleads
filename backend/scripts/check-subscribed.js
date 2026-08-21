/**
 * Read-only check: can the Page token we derive actually see/manage the
 * Page's app webhook subscription?
 *
 * This is the step that decides whether leads flow at all. It needs
 * pages_manage_metadata (approved), unlike listing leadgen_forms which needs
 * pages_manage_ads (NOT approved — only "Ready for testing"). Confirming this
 * separately tells us whether an empty Form dropdown is merely cosmetic or
 * actually breaks lead delivery.
 *
 * GET only — does not subscribe or modify anything.
 *
 * Run: railway run --service Arthaleads node backend/scripts/check-subscribed.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");
  const svc = require("../services/automationService");

  const auto = await Automation.findOne({ platform: "Facebook", isActive: true });
  if (!auto) { console.log("No active Facebook automation."); await mongoose.disconnect(); return; }

  console.log(`Page: ${auto.pageId} ("${auto.name}")`);

  const pageToken = await svc.fetchPageToken(auto.pageId, auto.userToken);
  const usable = pageToken && pageToken !== auto.userToken;
  console.log(`Derived page token: ${usable ? "distinct page token" : "fell back to user token"}`);

  const r = await fetch(
    `https://graph.facebook.com/v23.0/${auto.pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`
  );
  const j = await r.json();
  console.log(`\nsubscribed_apps →\n${JSON.stringify(j, null, 2)}`);

  const subscribed = (j.data || []).some((d) => String(d.id) === String(process.env.FB_APP_ID));
  console.log(`\nThis app subscribed to the Page: ${subscribed ? "YES ✅ (leads will be delivered)" : "NO ❌"}`);
  if (subscribed) {
    const fields = (j.data || []).find((d) => String(d.id) === String(process.env.FB_APP_ID))?.subscribed_fields || [];
    console.log(`Subscribed fields: ${fields.join(", ") || "(none)"} — needs "leadgen"`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
