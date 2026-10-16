// Default agent per source and Facebook ad/campaign rules (16 Oct 2026),
// against a real in-memory MongoDB and the real routes:
//   PUT  /api/integrations/vistrow-outbound/routing   (one "any" row per source)
//   POST /api/integrations/vistrow-outbound/simulate  (facebook + adId / campaignId)
//   GET  /api/leads/campaign-options                  (facebook.ad_id / campaign_id with names)
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
const FB_AD = "120252242040050286";
const FB_AD_2 = "120252242040050287";
const FB_CAMPAIGN = "120252242040050200";
let base, mongod, server, ORG, admin, PROJECT, OutboundIntegration, Lead;

const auth = () => ({ Authorization: `Bearer ${jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "1h" })}`, "Content-Type": "application/json" });
async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: auth(), body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}
const putRouting = (routes) => call("PUT", "/api/integrations/vistrow-outbound/routing", { facebook: { routes } });
const simulate = (inputs) => call("POST", "/api/integrations/vistrow-outbound/simulate", { source: "facebook", ...inputs });
// Server-side callers may name the agent by id (the browser uses agentRef).
const row = (matchKind, matchValue, agentId, extra = {}) => ({ matchKind, matchValue, agentId, agentLabel: `Agent ${agentId}`, ...extra });

test("PUT /routing: two 'any' rows for one source are rejected", async () => {
  const r = await putRouting([row("any", "*", "fb_default"), row("any", "*", "fb_other")]);
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.match(r.body.message, /only one default agent per source/);
  assert.equal((await OutboundIntegration.findOne({ orgId: ORG })).routing.facebook.routes.length, 0, "nothing saved");
});

test("PUT /routing: a default plus ad, campaign and project rules are saved; status lists the kinds", async () => {
  const r = await putRouting([
    row("any", "", "fb_default"),
    row("ad_id", FB_AD, "fb_ad"),
    row("campaign_id", FB_CAMPAIGN, "fb_campaign"),
    { matchKind: "project", projectId: String(PROJECT), agentId: "fb_project", agentLabel: "Agent fb_project" },
  ]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const fb = r.body.status.routing.facebook;
  assert.deepEqual(fb.allowedKinds, ["ad_id", "campaign_id", "project", "any"]);
  assert.deepEqual(fb.routes.map((x) => [x.matchKind, x.matchValue, x.label]), [
    ["any", "*", "Default agent"], ["ad_id", FB_AD, `Ad ${FB_AD}`], ["campaign_id", FB_CAMPAIGN, `Campaign ${FB_CAMPAIGN}`], ["project", String(PROJECT), "Project: SP Khopoli"],
  ]);
  const saved = (await OutboundIntegration.findOne({ orgId: ORG })).routing.facebook.routes;
  assert.equal(saved.find((x) => x.matchKind === "any").matchValue, "*");
});

test("simulate facebook: the ad rule wins; the campaign rule beats the project rule", async () => {
  let r = await simulate({ adId: FB_AD, campaignId: FB_CAMPAIGN, projectId: String(PROJECT) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.decision.autoCall, true);
  assert.equal(r.body.decision.agentLabel, "Agent fb_ad");
  assert.equal(r.body.decision.route.kind, "ad_id");
  assert.equal("agentId" in r.body.decision, false, "raw agent id stays on the server");
  r = await simulate({ campaignId: FB_CAMPAIGN, projectId: String(PROJECT) });
  assert.equal(r.body.decision.agentLabel, "Agent fb_campaign");
  r = await simulate({ projectId: String(PROJECT) });
  assert.equal(r.body.decision.agentLabel, "Agent fb_project");
});

test("simulate facebook: the default agent is used when no rule matches", async () => {
  const r = await simulate({ adId: "999", campaignId: "999" });
  assert.equal(r.body.decision.autoCall, true);
  assert.equal(r.body.decision.agentLabel, "Agent fb_default");
  assert.equal(r.body.decision.route.kind, "any");
  assert.equal(r.body.decision.route.label, "Default agent");
});

test("without a default row an unmatched facebook lead is a contact only (no_route)", async () => {
  const r = await putRouting([row("ad_id", FB_AD, "fb_ad")]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const s = await simulate({ adId: "999" });
  assert.equal(s.body.decision.autoCall, false);
  assert.equal(s.body.decision.reason, "no_route");
});

test("GET /leads/campaign-options: facebook ads and campaigns seen on this org's leads, with their Meta names", async () => {
  const r = await call("GET", "/api/leads/campaign-options");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const ads = r.body.options.facebook.ad_id;
  assert.deepEqual(ads.map((a) => [a.value, a.label, a.count]), [[FB_AD_2, "Treetopia villas", 1], [FB_AD, "Khopoli 2BHK launch", 2]], JSON.stringify(ads));
  for (const a of ads) assert.ok(!Number.isNaN(Date.parse(a.lastSeenAt)), "lastSeenAt is a date");
  const campaigns = r.body.options.facebook.campaign_id;
  assert.deepEqual(campaigns.map((c) => [c.value, c.label, c.count]), [[FB_CAMPAIGN, "Khopoli October", 3]]);
  // An old lead that stored only the id falls back to the lead's source label.
  assert.equal(r.body.options.facebook.form_id[0].label, "Facebook Lead Ads · Khopoli October");
  assert.equal(r.body.options.whatsapp.ad_id.length, 0, "other org / source untouched");
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  OutboundIntegration = require("../models/OutboundIntegration");
  Lead = require("../models/Lead");
  await OutboundIntegration.init();
  const User = require("../models/User");
  ORG = oid(); PROJECT = oid();
  const OTHER_ORG = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: ORG, name: "Prophunt LLP", slug: `t-${ORG}`, plan: "enterprise", autoAssign: false, isActive: true, approvalStatus: "approved" });
  await mongoose.connection.collection("projects").insertOne({ _id: PROJECT, orgId: ORG, name: "SP Khopoli", isArchived: false });
  admin = { _id: oid(), orgId: ORG, role: "admin", name: "Admin A", email: "admin@example.com", isActive: true };
  await User.collection.insertOne(admin);
  const doc = new OutboundIntegration({ orgId: ORG, provider: "vistrow", baseUrl: "https://api.vistrowvoice.com", accountId: "2", authMode: "header", routing: { facebook: { enabled: true, routes: [] } } });
  doc.setSecret("test-secret-0123456789");
  await doc.save();

  // Facebook leads as the webhook stores them: ids and names on the "created" activity's meta.
  const fbLead = (orgId, phone, meta, daysAgo) => ({
    orgId, name: "Lead", phone, source: "Facebook", leadSourceLabel: "Facebook Lead Ads · Khopoli October",
    createdAt: new Date(Date.now() - daysAgo * 86400 * 1000),
    activities: [{ type: "created", description: "Lead received from Meta Lead Ads webhook", meta }],
  });
  await Lead.create([
    fbLead(ORG, "9000000001", { formId: "f1", campaignId: FB_CAMPAIGN, campaignName: "Khopoli October", adId: FB_AD, adName: "Khopoli 2BHK launch" }, 3),
    fbLead(ORG, "9000000002", { formId: "f1", campaignId: FB_CAMPAIGN, campaignName: "Khopoli October", adId: FB_AD, adName: "Khopoli 2BHK launch" }, 2),
    fbLead(ORG, "9000000003", { formId: "f1", campaignId: FB_CAMPAIGN, campaignName: "Khopoli October", adId: FB_AD_2, adName: "Treetopia villas" }, 1),
    fbLead(OTHER_ORG, "9000000004", { formId: "f9", campaignId: "777", campaignName: "Other org", adId: "888", adName: "Other org ad" }, 1),
  ]);

  const app = express();
  app.use(express.json());
  app.use("/api/integrations/vistrow-outbound", require("../routes/vistrowOutboundRoutes"));
  app.use("/api/leads", require("../routes/leadRoutes"));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message })); // eslint-disable-line no-unused-vars
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Vistrow Voice routing: default agent per source + Facebook ad/campaign rules");
})();
