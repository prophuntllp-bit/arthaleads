/**
 * Proves — or disproves — that pages_manage_ads actually yields lead form
 * names, BEFORE committing to a Meta App Review submission.
 *
 * All we have observed so far is Graph naming the permission in an error:
 *   /{page}/leadgen_forms → (#200) Requires pages_manage_ads
 * No token we hold has ever carried it, so the success case is unproven. And
 * Meta's stated allowed usage for the permission talks about creating and
 * managing ads, not reading lead forms — so the error message alone is not
 * proof that the permission is the right ask.
 *
 * pages_manage_ads at Standard Access already works for users holding a role
 * on the app, so an app admin can reconnect and settle this at zero cost.
 *
 * Read-only. Run AFTER an app admin has reconnected their Facebook source:
 *   railway run --service Arthaleads node backend/scripts/verify-manage-ads.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const V = "v23.0";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");

  const autos = await Automation.find({ platform: "Facebook", isActive: true });
  const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;

  for (const auto of autos) {
    console.log(`\n"${auto.name}"  page=${auto.pageId}\n${"-".repeat(60)}`);
    const token = auto.userToken || auto.accessToken;
    if (!token) { console.log("  no token stored"); continue; }

    // 1. Did the reconnect actually pick up the new scope?
    let hasScope = false;
    try {
      const r = await fetch(`https://graph.facebook.com/${V}/debug_token?${new URLSearchParams({ input_token: token, access_token: appToken })}`);
      const j = await r.json();
      const scopes = j.data?.scopes || [];
      hasScope = scopes.includes("pages_manage_ads");
      console.log(`  scopes: ${scopes.join(", ")}`);
      console.log(`  pages_manage_ads granted: ${hasScope ? "YES ✅" : "NO — reconnect needed to pick up the new scope"}`);
    } catch (e) { console.log(`  debug_token failed: ${e.message}`); }

    if (!hasScope) continue;

    // 2. THE question: does the permission actually return form names?
    const pageToken = auto.accessToken || token;
    try {
      const r = await fetch(`https://graph.facebook.com/${V}/${auto.pageId}/leadgen_forms?${new URLSearchParams({
        access_token: pageToken, fields: "id,name", limit: "25",
      })}`);
      const j = await r.json();
      if (j.error) {
        console.log(`  leadgen_forms → ❌ [${j.error.code}] ${j.error.message}`);
        console.log("  VERDICT: pages_manage_ads did NOT unlock form names — do not submit.");
      } else {
        const forms = j.data || [];
        console.log(`  leadgen_forms → ✅ ${forms.length} form(s):`);
        forms.forEach((f) => console.log(`     ${f.id}  ${f.name}`));
        console.log("  VERDICT: pages_manage_ads DOES return form names — safe to submit.");
      }
    } catch (e) { console.log(`  leadgen_forms threw: ${e.message}`); }
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
