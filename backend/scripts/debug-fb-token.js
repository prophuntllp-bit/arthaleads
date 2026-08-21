/**
 * Diagnostic: interrogate the most recent Facebook OAuth token we were issued.
 *
 * Mayuresh's connect flow completes successfully (Page explicitly selected in
 * the picker, all 3 permissions approved, Facebook confirms "connected"), yet
 * /me/accounts returns a clean, error-free 0 pages every time. Guessing at the
 * cause has been wrong twice, so this asks Graph API directly:
 *
 *   /me                  - who does Facebook think this token belongs to?
 *   /me/permissions      - which scopes are actually granted vs declined?
 *   debug_token          - token type, app, expiry, granular scopes
 *   /me/accounts         - the exact call that keeps returning empty
 *
 * The screenshots show the Facebook Login FOR BUSINESS dialog ("Choose the
 * Pages you want...", "Review access request", "go to Business integrations"),
 * which issues a different token shape than classic Login - that is the
 * leading suspicion this is built to confirm or kill.
 *
 * Reads the freshToken out of the most recent OAuthSession (TTL'd, so run this
 * shortly after a connect attempt). Prints only a masked token.
 *
 * Run: node backend/scripts/debug-fb-token.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const V = "v23.0";
const mask = (t) => (t ? `${t.slice(0, 12)}…${t.slice(-6)} (len ${t.length})` : "(none)");

async function get(path, params) {
  const url = `https://graph.facebook.com/${V}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url);
  return { ok: r.ok, status: r.status, body: await r.json() };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const sessions = mongoose.connection.db.collection("oauthsessions");

  const recent = await sessions.find({}).sort({ _id: -1 }).limit(5).toArray();
  if (!recent.length) {
    console.log("No OAuth sessions found (they TTL out) - run a connect attempt, then re-run this.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${recent.length} recent session(s):`);
  recent.forEach((s, i) => {
    console.log(`  [${i}] type=${s.data?.type} pages=${s.data?.pages?.length ?? "-"} token=${s.data?.freshToken ? "yes" : "no"} expiresAt=${s.expiresAt?.toISOString()}`);
  });

  const withToken = recent.find((s) => s.data?.freshToken);
  if (!withToken) {
    console.log("\nNo session carried a freshToken - cannot probe.");
    await mongoose.disconnect();
    return;
  }

  const token = withToken.data.freshToken;
  console.log(`\nProbing with token: ${mask(token)}\n${"=".repeat(60)}`);

  const me = await get("me", { access_token: token, fields: "id,name" });
  console.log("\n/me →", JSON.stringify(me.body));

  const perms = await get("me/permissions", { access_token: token });
  console.log("\n/me/permissions →", JSON.stringify(perms.body, null, 2));

  const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;
  const dbg = await get("debug_token", { input_token: token, access_token: appToken });
  console.log("\ndebug_token →", JSON.stringify(dbg.body, null, 2));

  const accounts = await get("me/accounts", { access_token: token, fields: "id,name,access_token,tasks", limit: "200" });
  console.log("\n/me/accounts →", JSON.stringify({ ...accounts.body, data: accounts.body.data?.map((p) => ({ id: p.id, name: p.name, tasks: p.tasks })) }, null, 2));

  // The Business-Login token shape exposes granted assets here instead.
  const businesses = await get("me/businesses", { access_token: token, fields: "id,name" });
  console.log("\n/me/businesses →", JSON.stringify(businesses.body, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
