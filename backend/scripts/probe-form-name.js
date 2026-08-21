/**
 * Confirms exactly what is required to read a lead form's NAME, before
 * committing to an App Review submission.
 *
 * The earlier probe used a form id taken from the manual Form Names mapping,
 * which could be stale or deleted — and Graph reports "does not exist" and
 * "no permission" with the SAME message, so that result was ambiguous.
 *
 * This retests with form 1695488028223531, which a real lead was verifiably
 * delivered from, so a failure cannot be blamed on a dead object. Also checks
 * whether the form is reachable as an edge of the Page, and what the parent
 * ad/adset expose, to be sure pages_manage_ads is the ONLY thing missing.
 *
 * Read-only. Run:
 *   railway run --service Arthaleads node backend/scripts/probe-form-name.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const V = "v23.0";
const LIVE_FORM = "1695488028223531"; // referenced by a real delivered lead
const LIVE_AD   = "120251585505050286";

async function probe(label, path, params) {
  const r = await fetch(`https://graph.facebook.com/${V}/${path}?${new URLSearchParams(params)}`);
  const j = await r.json();
  if (j.error) {
    console.log(`  ${label}\n     ❌ [code ${j.error.code}] ${j.error.message}`);
    return null;
  }
  console.log(`  ${label}\n     ✅ ${JSON.stringify(j).slice(0, 250)}`);
  return j;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");
  const auto = await Automation.findOne({ platform: "Facebook", pageId: "560297671017098" });
  const pageToken = auto.accessToken;
  const userToken = auto.userToken;
  const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;

  console.log(`Known-live form ${LIVE_FORM}\n${"=".repeat(70)}`);

  console.log("\n[1] Read the form object directly");
  await probe("page token → /{form}?fields=id,name", LIVE_FORM, { access_token: pageToken, fields: "id,name" });
  await probe("user token → /{form}?fields=id,name", LIVE_FORM, { access_token: userToken, fields: "id,name" });
  await probe("app  token → /{form}?fields=id,name", LIVE_FORM, { access_token: appToken, fields: "id,name" });

  console.log("\n[2] Reach the form via the Page edge");
  await probe("page token → /{page}/leadgen_forms", `${auto.pageId}/leadgen_forms`, { access_token: pageToken, fields: "id,name", limit: "3" });

  console.log("\n[3] Does the parent AD expose the form name? (would avoid App Review)");
  await probe("page token → /{ad}?fields=name,creative", LIVE_AD, { access_token: pageToken, fields: "id,name" });

  console.log(`\n${"=".repeat(70)}`);
  console.log("If [1] and [2] both fail with code 200 'Requires pages_manage_ads',");
  console.log("then pages_manage_ads is the single missing permission for form names.");

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
