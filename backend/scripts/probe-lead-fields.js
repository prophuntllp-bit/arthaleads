/**
 * Can we label an incoming lead with its campaign/ad/form context using the
 * PAGE token we already hold — i.e. without pages_manage_ads and without an
 * App Review round?
 *
 * Listing or reading leadgen forms requires pages_manage_ads (confirmed by
 * probe-fb-capabilities.js), which is testers-only. But the leadgen object
 * itself may expose ad_name / adset_name / campaign_name / form_id. If those
 * come back with the page token, agents can be told which campaign a lead came
 * from with the permissions we already have approved.
 *
 * The webhook already fetches leads successfully with the page token, so this
 * is testing extra FIELDS on a call we make anyway. Read-only.
 *
 * Run: railway run --service Arthaleads node backend/scripts/probe-lead-fields.js
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");

const V = "v23.0";

async function tryFields(label, gid, token, fields) {
  const r = await fetch(`https://graph.facebook.com/${V}/${gid}?${new URLSearchParams({ access_token: token, fields })}`);
  const j = await r.json();
  if (j.error) { console.log(`  ${label} [${fields}]\n     ❌ ${j.error.message}`); return null; }
  console.log(`  ${label} [${fields}]\n     ✅ ${JSON.stringify(j)}`);
  return j;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Automation = require("../models/Automation");
  const Lead = require("../models/Lead");

  const auto = await Automation.findOne({ platform: "Facebook", pageId: "560297671017098" });
  const pageToken = auto.accessToken;
  const userToken = auto.userToken;

  // Most recent Facebook leads — try several, older ones may have aged out.
  const recent = await Lead.find({ source: "Facebook", orgId: auto.orgId }).sort({ createdAt: -1 }).limit(6).lean();
  const gids = [];
  for (const l of recent) {
    for (const n of l.notes || []) {
      const m = /Lead ID:\s*(\d+)/.exec(n.text || "");
      if (m) { gids.push(m[1]); break; }
    }
  }
  if (!gids.length) { console.log("No leadgen ids found."); await mongoose.disconnect(); return; }

  console.log(`Trying ${gids.length} recent leadgen id(s)\n${"=".repeat(70)}`);

  for (const gid of gids) {
    console.log(`\nleadgen_id ${gid}`);
    // Baseline: the call the webhook already makes today.
    const base = await tryFields("page token", gid, pageToken, "field_data");
    if (!base) continue; // lead aged out or not readable — try the next one

    // The question: do campaign/ad fields come back on the same token?
    await tryFields("page token", gid, pageToken, "ad_id,ad_name,adset_name,campaign_name,form_id,created_time,platform");
    await tryFields("user token", gid, userToken, "ad_name,campaign_name,form_id");
    break; // one readable lead is enough
  }

  console.log(`\n${"=".repeat(70)}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
