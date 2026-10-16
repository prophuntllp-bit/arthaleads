// GET /api/leads/campaign-options → ads.all (16 Oct 2026): one de-duplicated
// list of every ad the org knows, for the Vistrow step 3 ad pickers:
//   - Click-to-WhatsApp ads from leads (Lead.campaignRef.adId, label = headline)
//   - ads routed to an AI agent (WaAgent.adIds), admins/managers only
//   - Facebook lead-form ads (created activity meta.adId, label = adName)
// whatsapp.ad_id also gains agent-routed ads that have no lead yet (count 0).
// Agents only see ads from their own leads. Real in-memory MongoDB + the real
// leadRoutes.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CRYPTO_KEY = process.env.CRYPTO_KEY || "a".repeat(64);
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");

const oid = () => new mongoose.Types.ObjectId();
const CTWA_A = "120252500096330201"; // CTWA ad with 2 leads, also routed to an AI agent
const CTWA_B = "120252500096330202"; // CTWA ad with 1 lead (assigned to the agent user)
const ROUTED_ONLY = "120252500096330286"; // routed to an AI agent, no lead yet
const FORM_AD = "120252242040050286"; // lead-form ad, 1 lead, with adName
const FORM_AD_NONAME = "120252242040050287"; // lead-form ad, older lead without adName
let base, mongod, server, ORG, admin, manager, agentUser, Lead, WaAgent;

const tokenFor = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function options(u) {
  const res = await fetch(`${base}/api/leads/campaign-options`, { headers: { Authorization: `Bearer ${tokenFor(u)}` } });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body.options;
}
const byValue = (list) => Object.fromEntries(list.map((a) => [a.value, a]));

test("admin: ads.all lists CTWA, agent-routed and lead-form ads once each, with kinds, labels, counts and agent names", async () => {
  const all = (await options(admin)).ads.all;
  assert.ok(Array.isArray(all), "ads.all is a list");
  const values = all.map((a) => a.value);
  assert.equal(new Set(values).size, values.length, `no duplicates: ${values}`);
  assert.deepEqual([...values].sort(), [CTWA_A, CTWA_B, ROUTED_ONLY, FORM_AD, FORM_AD_NONAME].sort());
  const m = byValue(all);

  assert.equal(m[CTWA_A].kind, "ctwa");
  assert.equal(m[CTWA_A].label, "Khopoli 2BHK chat ad");
  assert.equal(m[CTWA_A].count, 2);
  assert.equal(m[CTWA_A].agentName, "Khopoli Advisor");
  assert.deepEqual([...m[CTWA_A].sources].sort(), ["wa_agent", "whatsapp_lead"]);

  assert.equal(m[CTWA_B].kind, "ctwa");
  assert.equal(m[CTWA_B].count, 1);
  assert.equal(m[CTWA_B].agentName, undefined, "not routed to any agent");

  assert.equal(m[ROUTED_ONLY].kind, "ctwa", "an agent-routed ad is a WhatsApp ad");
  assert.equal(m[ROUTED_ONLY].count, 0);
  assert.equal(m[ROUTED_ONLY].lastSeenAt, null);
  assert.equal(m[ROUTED_ONLY].agentName, "Khopoli Advisor, Treetopia Bot", "both agents routing it are named");
  assert.deepEqual(m[ROUTED_ONLY].sources, ["wa_agent"]);

  assert.equal(m[FORM_AD].kind, "leadform");
  assert.equal(m[FORM_AD].label, "Everglades lead form ad");
  assert.equal(m[FORM_AD].count, 1);
  assert.deepEqual(m[FORM_AD].sources, ["facebook_lead"]);
  assert.equal(m[FORM_AD_NONAME].kind, "leadform");
  assert.equal(m[FORM_AD_NONAME].label, FORM_AD_NONAME, "no Meta name: the id stands in");

  for (const a of all.filter((x) => x.count)) assert.ok(!Number.isNaN(Date.parse(a.lastSeenAt)), `${a.value} lastSeenAt is a date`);
  const seen = all.filter((a) => a.lastSeenAt).map((a) => Date.parse(a.lastSeenAt));
  assert.deepEqual(seen, [...seen].sort((x, y) => y - x), "newest first");
  assert.equal(all[all.length - 1].value, ROUTED_ONLY, "never-seen ads go last");
  assert.ok(!values.includes("999000"), "another org's ads are not listed");
});

test("admin: whatsapp.ad_id also lists the agent-routed ad with no lead yet (count 0); existing keys unchanged", async () => {
  const o = await options(admin);
  const wa = o.whatsapp.ad_id;
  assert.deepEqual(wa.map((a) => [a.value, a.count]), [[CTWA_B, 1], [CTWA_A, 2], [ROUTED_ONLY, 0]], JSON.stringify(wa));
  assert.equal(wa[0].label, "Treetopia chat ad");
  assert.deepEqual(o.facebook.ad_id.map((a) => [a.value, a.label, a.count]), [[FORM_AD, "Everglades lead form ad", 1], [FORM_AD_NONAME, "Facebook Lead Ads · Old form", 1]]);
  assert.deepEqual(Object.keys(o).sort(), ["ads", "facebook", "google", "whatsapp"]);
  assert.deepEqual(Object.keys(o.facebook).sort(), ["ad_id", "adset_id", "campaign_id", "form_id"]);
  assert.deepEqual(Object.keys(o.whatsapp).sort(), ["ad_id", "no_ad"]);
});

test("manager: sees the agent-routed ads too", async () => {
  const m = byValue((await options(manager)).ads.all);
  assert.ok(m[ROUTED_ONLY], "manager sees the routed-only ad");
  assert.equal(m[CTWA_A].agentName, "Khopoli Advisor");
});

test("agent role: only ads from their own leads, no AI-agent routing config", async () => {
  const o = await options(agentUser);
  assert.deepEqual(o.ads.all.map((a) => [a.value, a.count, a.kind]), [[CTWA_B, 1, "ctwa"]], JSON.stringify(o.ads.all));
  assert.equal(o.ads.all[0].agentName, undefined, "routing config is hidden from agents");
  assert.deepEqual(o.whatsapp.ad_id.map((a) => a.value), [CTWA_B], "no count-0 routed ads for agents");
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require("../models/Lead");
  WaAgent = require("../models/WaAgent");
  const User = require("../models/User");
  ORG = oid();
  const OTHER_ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false, isActive: true, approvalStatus: "approved" });
  admin = { _id: oid(), orgId: ORG, role: "admin", name: "Admin A", email: "admin@example.com", isActive: true };
  manager = { _id: oid(), orgId: ORG, role: "manager", name: "Manager M", email: "manager@example.com", isActive: true };
  agentUser = { _id: oid(), orgId: ORG, role: "agent", name: "Agent G", email: "agent@example.com", isActive: true };
  await User.collection.insertMany([admin, manager, agentUser]);

  const ago = (days) => new Date(Date.now() - days * 86400 * 1000);
  const waLead = (orgId, phone, adId, headline, daysAgo, extra = {}) => ({
    orgId, name: "WA lead", phone, source: "WhatsApp", createdAt: ago(daysAgo),
    campaignRef: { adId, headline }, ...extra,
  });
  const fbLead = (orgId, phone, meta, daysAgo, leadSourceLabel) => ({
    orgId, name: "FB lead", phone, source: "Facebook", leadSourceLabel, createdAt: ago(daysAgo),
    activities: [{ type: "created", description: "Lead received from Meta Lead Ads webhook", meta }],
  });
  await Lead.create([
    waLead(ORG, "9000000001", CTWA_A, "Khopoli 2BHK chat ad", 3),
    waLead(ORG, "9000000002", CTWA_A, "Khopoli 2BHK chat ad", 2),
    waLead(ORG, "9000000003", CTWA_B, "Treetopia chat ad", 1, { assignedTo: agentUser._id }),
    fbLead(ORG, "9000000004", { formId: "f1", adId: FORM_AD, adName: "Everglades lead form ad" }, 2.5, "PropHunt LLP - Lead Ads · Everglades"),
    fbLead(ORG, "9000000005", { formId: "f2", adId: FORM_AD_NONAME }, 4, "Facebook Lead Ads · Old form"),
    waLead(OTHER_ORG, "9000000006", "999000", "Other org ad", 1),
  ]);
  await WaAgent.create([
    { orgId: ORG, name: "Khopoli Advisor", status: "active", adIds: [CTWA_A, ROUTED_ONLY] },
    { orgId: ORG, name: "Treetopia Bot", status: "paused", adIds: [ROUTED_ONLY, " "] },
    { orgId: ORG, name: "General", status: "active", isDefault: true, adIds: [] },
    { orgId: OTHER_ORG, name: "Other org bot", status: "active", adIds: ["999001"] },
  ]);

  const app = express();
  app.use(express.json());
  app.use("/api/leads", require("../routes/leadRoutes"));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message })); // eslint-disable-line no-unused-vars
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow ad pickers: ads.all = every ad the org knows (CTWA leads, AI-agent routes, lead-form ads)");
})();
