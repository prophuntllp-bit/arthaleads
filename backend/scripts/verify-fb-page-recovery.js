/**
 * Verifies the New-Pages-Experience recovery path WITHOUT running another live
 * OAuth attempt against a customer's Facebook account.
 *
 * The recovery path (fetchGrantedPageIds -> fetchPageById) resolves the Page,
 * but the flow only actually works if it ends up holding a PAGE access token:
 * both subscribePageWebhook() and fetchFacebookForms() require one, and a user
 * token silently fails there. fetchPageById may return no access_token, in
 * which case fetchPageToken() is meant to supply it — and if THAT falls back
 * to the user token, the connection saves but never receives leads.
 *
 * This exercises those exact functions against an EXISTING working automation's
 * stored userToken. All calls are read-only (GET); nothing is written, no
 * webhook is subscribed, and no new OAuth grant is requested.
 *
 * Run: node backend/scripts/verify-fb-page-recovery.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");
  const automationService = require("../services/automationService");

  const auto = await Automation.findOne({ platform: "Facebook", isActive: true });
  if (!auto) {
    console.log("No active Facebook automation to test against.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Testing against existing connection: "${auto.name}" (pageId ${auto.pageId})`);

  const userToken = auto.userToken;
  const pageToken = auto.accessToken;
  console.log(`  stored userToken: ${userToken ? "present" : "MISSING"}`);
  console.log(`  stored pageToken: ${pageToken ? "present" : "MISSING"}`);

  const probeToken = userToken || pageToken;
  if (!probeToken) {
    console.log("No usable token stored — cannot verify.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n${"=".repeat(60)}\n1. fetchGrantedPageIds (debug_token granular_scopes)`);
  const ids = await automationService.fetchGrantedPageIds(probeToken);
  console.log(`   → ${ids.length} granted Page id(s): ${ids.join(", ") || "none"}`);

  // Use a granted id if present, else the automation's own known-good pageId.
  const targetId = ids[0] || auto.pageId;
  if (!targetId) {
    console.log("No Page id to probe.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n2. fetchPageById(${targetId})`);
  const page = await automationService.fetchPageById(targetId, probeToken);
  if (!page) {
    console.log("   → NULL (the whole recovery path dies here)");
    await mongoose.disconnect();
    return;
  }
  console.log(`   → id=${page.id} name="${page.name}" access_token=${page.access_token ? "RETURNED ✅" : "absent (falls through to fetchPageToken)"}`);

  console.log(`\n3. fetchPageToken(${targetId}) — the fallback`);
  const recovered = await automationService.fetchPageToken(targetId, probeToken);
  const isUserTokenFallback = recovered === probeToken;
  console.log(`   → ${isUserTokenFallback
    ? "FELL BACK TO USER TOKEN ❌ (webhook subscribe + forms will fail)"
    : "got a distinct PAGE token ✅"}`);

  const effectivePageToken = page.access_token || (isUserTokenFallback ? null : recovered);

  console.log(`\n4. fetchFacebookForms(${targetId}) with the resulting token`);
  if (!effectivePageToken) {
    console.log("   → SKIPPED: no page token available, so this would fail in production.");
  } else {
    const forms = await automationService.fetchFacebookForms(targetId, effectivePageToken);
    console.log(`   → ${forms.length} form(s)`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(effectivePageToken
    ? "VERDICT: recovery path yields a usable Page token — wiring is sound."
    : "VERDICT: recovery path does NOT yield a Page token — needs fixing before retrying.");

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
