/**
 * Read-only audit of every Facebook connection: does its stored token carry
 * the scopes the integration actually needs, and is its Page really subscribed?
 *
 * Motivated by a silent failure: subscribePageWebhook needs leads_retrieval,
 * which was missing from the OAuth scope, yet the connection still saved and
 * reported "connected" while receiving zero leads. A source looking healthy in
 * the UI proves nothing — only subscribed_apps does.
 *
 * GET only. Nothing is written, subscribed, or re-granted.
 *
 * Run: railway run --service Arthaleads node backend/scripts/audit-fb-connections.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const V = "v23.0";
const NEEDED = ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "leads_retrieval"];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");

  const autos = await Automation.find({ platform: "Facebook" });
  console.log(`${autos.length} Facebook connection(s)\n${"=".repeat(64)}`);

  const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;

  for (const a of autos) {
    console.log(`\n"${a.name}"  page=${a.pageId}  active=${a.isActive}  status=${a.status}`);

    const token = a.userToken || a.accessToken;
    if (!token) { console.log("  no stored token — cannot audit"); continue; }

    // 1. What scopes does the stored token actually carry?
    try {
      const r = await fetch(`https://graph.facebook.com/${V}/debug_token?${new URLSearchParams({ input_token: token, access_token: appToken })}`);
      const j = await r.json();
      if (j.error) {
        console.log(`  debug_token error: ${j.error.message}`);
      } else {
        const scopes = j.data?.scopes || [];
        const missing = NEEDED.filter((s) => !scopes.includes(s));
        console.log(`  token scopes: ${scopes.join(", ") || "(none)"}`);
        console.log(`  missing     : ${missing.length ? missing.join(", ") + "  ⚠️" : "none ✅"}`);
        if (j.data?.expires_at) {
          const exp = j.data.expires_at === 0 ? "never" : new Date(j.data.expires_at * 1000).toISOString();
          console.log(`  expires     : ${exp}`);
        }
      }
    } catch (e) { console.log(`  debug_token threw: ${e.message}`); }

    // 2. Is the Page actually subscribed? This is what governs lead delivery.
    if (!a.pageId) { console.log("  no pageId — skipping subscription check"); continue; }
    try {
      const pageToken = a.accessToken || token;
      const r = await fetch(`https://graph.facebook.com/${V}/${a.pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`);
      const j = await r.json();
      if (j.error) {
        console.log(`  subscribed_apps: ERROR — ${j.error.message}`);
      } else {
        const mine = (j.data || []).find((d) => String(d.id) === String(process.env.FB_APP_ID));
        const fields = mine?.subscribed_fields || [];
        console.log(`  subscribed  : ${mine ? (fields.includes("leadgen") ? "YES, leadgen ✅" : `app present but fields=[${fields}] ⚠️`) : "NO ❌ — this Page delivers no leads"}`);
      }
    } catch (e) { console.log(`  subscribed_apps threw: ${e.message}`); }
  }

  console.log(`\n${"=".repeat(64)}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
