/**
 * Determines, empirically, which Facebook permission each capability needs —
 * so App Review can be submitted for exactly the right set and no org ever has
 * to paste a Page ID, Form ID, or System User Token by hand.
 *
 * Tests against PropHunt's live token, which already carries leads_retrieval
 * AND business_management. That makes it the strongest token we have: anything
 * that still fails with it is failing for a reason those two cannot fix, which
 * isolates what genuinely needs to go to App Review.
 *
 * Read-only GETs. Nothing written, granted, or subscribed.
 *
 * Run: railway run --service Arthaleads node backend/scripts/probe-fb-capabilities.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const V = "v23.0";

async function probe(label, path, params) {
  try {
    const r = await fetch(`https://graph.facebook.com/${V}/${path}?${new URLSearchParams(params)}`);
    const j = await r.json();
    if (j.error) {
      console.log(`  ${label}\n     ❌ ${j.error.message}`);
      return null;
    }
    const preview = JSON.stringify(j).slice(0, 300);
    console.log(`  ${label}\n     ✅ ${preview}`);
    return j;
  } catch (e) {
    console.log(`  ${label}\n     ❌ threw: ${e.message}`);
    return null;
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");
  const Lead = require("../models/Lead");

  const auto = await Automation.findOne({ platform: "Facebook", pageId: "560297671017098" });
  const pageToken = auto.accessToken;
  const userToken = auto.userToken;
  const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;
  const pageId = auto.pageId;

  // A real form id from this Page's configured Form Names.
  const formId = (auto.formLabels || [])[0]?.formId || "1579841003752145";

  console.log(`Page ${pageId} · form ${formId}\n${"=".repeat(70)}`);

  console.log("\n[A] LIST LEAD FORMS  — needed so users never type a Form ID");
  await probe("page token → /{page}/leadgen_forms", `${pageId}/leadgen_forms`, { access_token: pageToken, fields: "id,name", limit: "5" });
  await probe("user token → /{page}/leadgen_forms", `${pageId}/leadgen_forms`, { access_token: userToken, fields: "id,name", limit: "5" });
  await probe("app  token → /{page}/leadgen_forms", `${pageId}/leadgen_forms`, { access_token: appToken, fields: "id,name", limit: "5" });

  console.log("\n[B] READ ONE FORM'S NAME  — needed to label incoming leads");
  await probe("page token → /{form}?fields=name", formId, { access_token: pageToken, fields: "name" });
  await probe("user token → /{form}?fields=name", formId, { access_token: userToken, fields: "name" });
  await probe("app  token → /{form}?fields=name", formId, { access_token: appToken, fields: "name" });

  console.log("\n[C] CAMPAIGN CONTEXT ON THE LEAD ITSELF  — possible fallback");
  const lead = await Lead.findOne({ source: "Facebook", orgId: auto.orgId }).sort({ createdAt: -1 }).lean();
  const gid = (lead?.notes || []).map((n) => /Lead ID:\s*(\d+)/.exec(n.text || "")?.[1]).filter(Boolean)[0];
  if (!gid) {
    console.log("  (no recent lead id found in notes — skipping)");
  } else {
    console.log(`  using leadgen_id ${gid}`);
    await probe("app token → /{lead}?fields=ad_name,campaign_name,form_id", gid,
      { access_token: appToken, fields: "id,ad_name,adset_name,campaign_name,form_id" });
  }

  console.log(`\n${"=".repeat(70)}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
