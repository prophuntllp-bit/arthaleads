// Google Ads "Sign in with Google" (29-30 Oct 2026), Google itself faked: the
// account list resolves a manager account into its client accounts, every
// call is on v26 with the manager's login-customer-id, no developer token is
// needed, and the poller reads both question lists, pages through results and
// names the campaign, ad group, ad and lead form. Instant delivery puts our
// webhook on lead forms that have none, a lead is saved once whichever way it
// arrives, and a removed connection takes its webhook off again.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.GOOGLE_CLIENT_ID = "client";
process.env.GOOGLE_CLIENT_SECRET = "secret";
process.env.GOOGLE_REDIRECT_URI = "https://api-test.example.com/api/automations/google/callback";
delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const WEBHOOK = "https://api-test.example.com/webhook/google";
const calls = [];
const mutations = [];
let pages = {};
let forms = [];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const realFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("http://127.0.0.1")) return realFetch(url, opts);
  const h = opts.headers || {};
  const body = opts.body && opts.body.startsWith?.("{") ? JSON.parse(opts.body) : {};
  calls.push({ url, login: h["login-customer-id"] || "", devToken: h["developer-token"], body });
  if (url === "https://oauth2.googleapis.com/token") return reply({ access_token: "fresh" });
  if (url.endsWith("/v26/customers:listAccessibleCustomers")) return reply({ resourceNames: ["customers/111", "customers/999"] });
  if (/\/v26\/customers\/\d+\/assets:mutate$/.test(url)) {
    mutations.push(...body.operations);
    return reply({ results: body.operations.map((o) => ({ resourceName: o.update.resourceName })) });
  }
  const m = url.match(/\/v26\/customers\/(\d+)\/googleAds:search$/);
  if (!m) return reply({ error: { message: `unexpected ${url}` } }, 404);
  const id = m[1], q = body.query;
  if (/FROM customer_client/.test(q)) {
    if (id !== "999" || h["login-customer-id"] !== "999") return reply({ error: { message: "denied" } }, 403);
    return reply({ results: [
      { customerClient: { id: "222", descriptiveName: "Prophunt Ads" } },
      { customerClient: { id: "111", descriptiveName: "Direct Too" } },
      { customerClient: { id: "333", descriptiveName: "Old Closed", status: "CLOSED" } },
      { customerClient: { id: "444", descriptiveName: "Sandbox", status: "CLOSED", testAccount: true } },
    ] });
  }
  if (/FROM customer /.test(q + " ")) {
    return reply({ results: [{ customer: (id === "999" || id === "6989269947") ? { id, descriptiveName: "Arthaleads MCC", manager: true } : { id, descriptiveName: "Own Account" } }] });
  }
  if (/FROM asset\b/.test(q)) {
    return reply({ results: forms.map((f) => ({ asset: { resourceName: `customers/222/assets/${f.id}`, id: f.id, name: f.name, leadFormAsset: { deliveryMethods: f.url ? [{ webhook: { advertiserWebhookUrl: f.url } }] : [] } } })) });
  }
  if (/FROM lead_form_submission_data/.test(q)) {
    if (h["login-customer-id"] !== "999") {
      return reply({ error: { message: "x", details: [{ errors: [{ errorCode: { authorizationError: "USER_PERMISSION_DENIED" }, message: "x" }] }] } }, 403);
    }
    return reply(pages[body.pageToken || "first"] || { results: [] });
  }
  return reply({ error: { message: `unexpected query ${q}` } }, 400);
};
require("../utils/push").sendPushToUser = async () => {};
require("../utils/push").sendPushToAll = async () => {};

const oid = () => new mongoose.Types.ObjectId();
const ORG = oid();
let automationService, poller, Automation, Lead, base;

const submission = (n, extra = {}) => ({
  leadFormSubmissionData: {
    resourceName: `customers/222/leadFormSubmissionData/${n}`,
    id: String(n),
    campaign: "customers/222/campaigns/5551",
    asset: "customers/222/assets/9001",
    gclid: `g${n}`,
    submissionDateTime: `2026-10-28 1${n}:00:00+05:30`,
    leadFormSubmissionFields: [
      { fieldType: "FULL_NAME", fieldValue: `Buyer ${n}` },
      { fieldType: "PHONE_NUMBER", fieldValue: `+91 98220 1000${n}` },
    ],
    customLeadFormSubmissionFields: [{ questionText: "Which configuration?", fieldValue: "2 BHK" }],
    ...extra,
  },
  campaign: { id: "5551", name: "Baner 2BHK Search" },
  adGroup: { id: "7001", name: "Baner flats" },
  adGroupAd: { ad: { id: "8001", name: "2BHK from 82L" } },
  asset: { id: "9001", name: "Site visit form" },
});

test("account list: a manager is replaced by its clients, each remembering the manager", async () => {
  const accounts = await automationService.fetchGoogleAdsAccounts("tok");
  assert.deepEqual(accounts.map((a) => [a.id, a.name, a.loginCustomerId]), [
    ["111", "Own Account", ""],
    ["222", "Prophunt Ads", "999"],
    ["444", "Sandbox", "999"],
  ]);
  assert.equal(accounts[1].managerName, "Arthaleads MCC");
  assert.ok(calls.every((c) => c.url.includes("/v26/") || c.url.includes("oauth2")), "every call on v26");
  assert.ok(calls.every((c) => c.devToken === undefined), "no developer token needed");
});

test("a manager with no ad accounts under it says so", async () => {
  const realClients = global.fetch;
  global.fetch = async (url, opts) => (/FROM customer_client/.test(opts?.body || "") ? reply({ results: [] }) : realClients(url, opts));
  const realList = global.fetch;
  global.fetch = async (url, opts) => (String(url).endsWith(":listAccessibleCustomers") ? reply({ resourceNames: ["customers/6989269947"] }) : realList(url, opts));
  try {
    await assert.rejects(automationService.fetchGoogleAdsAccounts("tok"), /manager account Arthaleads MCC \(698-926-9947\) has no ad accounts under it yet/);
  } finally { global.fetch = realClients; }
});

test("connect saves the manager it goes through", async () => {
  const a = await Automation.create({ orgId: ORG, name: "Prophunt Ads", platform: "Google", mode: "oauth", isActive: true, userToken: "refresh", googleCustomerId: "222", googleLoginCustomerId: "999", verifyToken: "key-prophunt-1234567890", createdBy: oid(), updatedBy: oid() });
  assert.equal(a.googleLoginCustomerId, "999");
});

test("instant delivery: our webhook goes on forms without one; ours and other tools' are left alone", async () => {
  forms = [
    { id: "9001", name: "Site visit form" },
    { id: "9002", name: "Brochure form", url: WEBHOOK },
    { id: "9003", name: "Zapier form", url: "https://hooks.zapier.com/abc" },
  ];
  mutations.length = 0;
  pages = {};
  const automation = await Automation.findOne({ orgId: ORG });
  await poller.pollOneGoogleAdsConnection(automation);
  assert.equal(mutations.length, 1, "only the form with no webhook is changed");
  assert.equal(mutations[0].update.resourceName, "customers/222/assets/9001");
  assert.equal(mutations[0].updateMask, "leadFormAsset.deliveryMethods");
  assert.deepEqual(mutations[0].update.leadFormAsset.deliveryMethods, [{ webhook: { advertiserWebhookUrl: WEBHOOK, googleSecret: "key-prophunt-1234567890" } }]);
  const after = await Automation.findById(automation._id).lean();
  assert.deepEqual([after.googleDelivery.total, after.googleDelivery.ours, after.googleDelivery.other, after.googleDelivery.failed], [3, 2, 1, 0]);
  assert.ok(after.googlePolledAt, "the check time is kept");
  forms = [];
});

test("poll: names the campaign, ad group, ad and form; both question lists; every page", async () => {
  pages = {
    first: { results: [submission(1), submission(2)], nextPageToken: "p2" },
    p2: { results: [submission(3), { leadFormSubmissionData: { resourceName: "customers/222/leadFormSubmissionData/4", id: "4", submissionDateTime: "2026-10-28 14:00:00+05:30", leadFormSubmissionFields: [{ fieldType: "FULL_NAME", fieldValue: "No Phone" }] } }] },
  };
  calls.length = 0;
  const automation = await Automation.findOne({ orgId: ORG });
  automation.lastSyncAt = null;
  const result = await poller.pollOneGoogleAdsConnection(automation);
  assert.deepEqual(result, { created: 3, skipped: 1 });
  const search = calls.filter((c) => /FROM lead_form_submission_data/.test(c.body.query || ""));
  assert.equal(search.length, 2, "followed next_page_token");
  assert.ok(search.every((c) => c.login === "999" && !("pageSize" in c.body)));
  assert.doesNotMatch(search[0].body.query, /campaign_id|asset_id|is_test_lead/);
  assert.match(search[0].body.query, /campaign\.name[\s\S]*ad_group\.name[\s\S]*ad_group_ad\.ad\.id[\s\S]*asset\.name/);
  const lead = await Lead.findOne({ orgId: ORG, externalId: "customers/222/leadFormSubmissionData/2" }).lean();
  assert.equal(lead.name, "Buyer 2");
  assert.equal(lead.leadSourceLabel, "Prophunt Ads · Baner 2BHK Search");
  assert.deepEqual(
    [lead.adRef.campaignId, lead.adRef.campaignName, lead.adRef.adGroupName, lead.adRef.adId, lead.adRef.formName, lead.adRef.gclid],
    ["5551", "Baner 2BHK Search", "Baner flats", "8001", "Site visit form", "g2"],
  );
  assert.match(lead.notes[0].text, /Campaign: Baner 2BHK Search \(5551\)\nAd group: Baner flats \(7001\)\nAd: 2BHK from 82L \(8001\)\nLead form: Site visit form \(9001\)/);
  assert.match(lead.requirements, /Which configuration\?: 2 BHK/);
  const after = await Automation.findById(automation._id).lean();
  assert.equal(after.lastSyncAt.toISOString(), "2026-10-28T08:30:00.000Z", "cursor at the last handled submission (14:00 IST)");
});

test("the sync asks Google a day further back (account time zone), duplicates still skipped", async () => {
  calls.length = 0;
  const automation = await Automation.findOne({ orgId: ORG });
  const result = await poller.pollOneGoogleAdsConnection(automation);
  assert.equal(result.created, 0);
  assert.equal(await Lead.countDocuments({ orgId: ORG }), 3);
  const q = calls.find((c) => /FROM lead_form_submission_data/.test(c.body.query || "")).body.query;
  assert.match(q, /submission_date_time > '2026-10-27 08:30:00'/, "cursor minus 24 hours");
});

test("a lead the webhook already saved is not saved again by the sync", async () => {
  await Lead.create({ orgId: ORG, name: "Pushed", phone: "+91 98220 20005", source: "Google", status: "New", externalId: "google:5", createdBy: oid() });
  await Lead.create({ orgId: ORG, name: "Pushed other id", phone: "+91 98220 20006", source: "Google", status: "New", externalId: "google:999999", createdBy: oid() });
  const s5 = submission(5); s5.leadFormSubmissionData.leadFormSubmissionFields[1].fieldValue = "+91 98220 20005";
  const s6 = submission(6); s6.leadFormSubmissionData.leadFormSubmissionFields[1].fieldValue = "9822020006";
  pages = { first: { results: [s5, s6] } };
  const before = await Lead.countDocuments({ orgId: ORG });
  const automation = await Automation.findOne({ orgId: ORG });
  const result = await poller.pollOneGoogleAdsConnection(automation);
  assert.deepEqual(result, { created: 0, skipped: 2 }, "same lead id, and same phone within two days");
  assert.equal(await Lead.countDocuments({ orgId: ORG }), before);
});

test("the webhook names the campaign and form, and leaves the sync's cursor alone", async () => {
  const automation = await Automation.findOne({ orgId: ORG });
  const cursor = automation.lastSyncAt.toISOString();
  const res = await realFetch(`${base}/webhook/google`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      google_key: "key-prophunt-1234567890", lead_id: "77", campaign_id: 5551, campaign_name: "Baner 2BHK Search", form_id: 9001, gcl_id: "gx",
      user_column_data: [{ column_id: "FULL_NAME", string_value: "Webhook Buyer" }, { column_id: "PHONE_NUMBER", string_value: "+91 98220 30007" }],
    }),
  });
  assert.ok(res.ok, `webhook answered ${res.status}`);
  const lead = await Lead.findOne({ orgId: ORG, externalId: "google:77" }).lean();
  assert.equal(lead.leadSourceLabel, "Prophunt Ads · Baner 2BHK Search");
  assert.deepEqual([lead.adRef.campaignId, lead.adRef.formId, lead.adRef.gclid], ["5551", "9001", "gx"]);
  assert.match(lead.notes[0].text, /Campaign: Baner 2BHK Search \(5551\)/);
  const after = await Automation.findById(automation._id).lean();
  assert.equal(after.lastSyncAt.toISOString(), cursor, "the account sync's cursor did not move");

  // The same lead arriving later through the sync (by its API id) is skipped.
  pages = { first: { results: [submission(77, { leadFormSubmissionFields: [{ fieldType: "FULL_NAME", fieldValue: "x" }, { fieldType: "PHONE_NUMBER", fieldValue: "+91 98220 30007" }] })] } };
  const r = await poller.pollOneGoogleAdsConnection(await Automation.findOne({ orgId: ORG }));
  assert.equal(r.created, 0);
});

test("cron: a connection whose forms all push is only checked every 30 minutes", async () => {
  await Automation.updateOne({ orgId: ORG }, { $set: { googleDelivery: { total: 2, ours: 2, other: 0, failed: 0, checkedAt: new Date() }, googlePolledAt: new Date(), googleLoginCustomerId: "999" } });
  calls.length = 0;
  await poller.pollGoogleAdsLeads();
  assert.equal(calls.length, 0, "skipped: checked a moment ago and every form pushes");
  await Automation.updateOne({ orgId: ORG }, { $set: { googlePolledAt: new Date(Date.now() - 31 * 60 * 1000) } });
  await poller.pollGoogleAdsLeads();
  assert.ok(calls.some((c) => /FROM lead_form_submission_data/.test(c.body.query || "")), "checked again after 30 minutes");
});

test("removing the connection takes only our webhook off the lead forms", async () => {
  forms = [
    { id: "9001", name: "Site visit form", url: WEBHOOK },
    { id: "9003", name: "Zapier form", url: "https://hooks.zapier.com/abc" },
  ];
  mutations.length = 0;
  const automation = await Automation.findOne({ orgId: ORG });
  await automationService.remove(automation._id, ORG);
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].update.resourceName, "customers/222/assets/9001");
  assert.deepEqual(mutations[0].update.leadFormAsset.deliveryMethods, []);
  assert.equal(await Automation.countDocuments({ orgId: ORG }), 0);
});

test("a connection missing its manager gets Google's error in plain words", async () => {
  const a = await Automation.create({ orgId: ORG, name: "No manager", platform: "Google", mode: "oauth", isActive: true, userToken: "refresh", googleCustomerId: "222", createdBy: oid(), updatedBy: oid() });
  const result = await poller.pollOneGoogleAdsConnection(a);
  assert.match(result.error, /can't open that Google Ads account/);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.connection.db.collection("organizations").insertOne({ _id: ORG, name: "Prophunt LLP", slug: `p-${ORG}`, plan: "enterprise", isActive: true, approvalStatus: "approved", autoAssign: false });
  automationService = require("../services/automationService");
  poller = require("../utils/googleAdsPoller");
  Automation = require("../models/Automation");
  Lead = require("../models/Lead");
  const app = express();
  app.use("/webhook", require("../routes/webhookRoutes"));
  const server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  await run("Google Ads lead sync");
})();
