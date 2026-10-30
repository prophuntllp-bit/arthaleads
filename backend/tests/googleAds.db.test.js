// Google Ads "Sign in with Google" (29 Oct 2026), Google itself faked: the
// account list resolves a manager account into its client accounts, every
// call is on v26 with the manager's login-customer-id, no developer token is
// needed, and the poller reads both question lists, pages through results and
// takes the campaign from its resource name.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.GOOGLE_CLIENT_ID = "client";
process.env.GOOGLE_CLIENT_SECRET = "secret";
delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const calls = [];
let pages = {};
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
global.fetch = async (url, opts = {}) => {
  url = String(url);
  const h = opts.headers || {};
  const body = opts.body && opts.body.startsWith?.("{") ? JSON.parse(opts.body) : {};
  calls.push({ url, login: h["login-customer-id"] || "", devToken: h["developer-token"], body });
  if (url === "https://oauth2.googleapis.com/token") return reply({ access_token: "fresh" });
  if (url.endsWith("/v26/customers:listAccessibleCustomers")) return reply({ resourceNames: ["customers/111", "customers/999"] });
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
  if (/FROM lead_form_submission_data/.test(q)) {
    if (h["login-customer-id"] !== "999") {
      return reply({ error: { message: "x", details: [{ errors: [{ errorCode: { authorizationError: "USER_PERMISSION_DENIED" }, message: "x" }] }] } }, 403);
    }
    return reply(pages[body.pageToken || "first"]);
  }
  return reply({ error: { message: `unexpected query ${q}` } }, 400);
};
require("../utils/push").sendPushToUser = async () => {};
require("../utils/push").sendPushToAll = async () => {};

const oid = () => new mongoose.Types.ObjectId();
const ORG = oid();
let automationService, pollOne, Automation, Lead;

const submission = (n, extra = {}) => ({
  leadFormSubmissionData: {
    resourceName: `customers/222/leadFormSubmissionData/${n}`,
    campaign: "customers/222/campaigns/5551",
    gclid: `g${n}`,
    submissionDateTime: `2026-10-28 1${n}:00:00+05:30`,
    leadFormSubmissionFields: [
      { fieldType: "FULL_NAME", fieldValue: `Buyer ${n}` },
      { fieldType: "PHONE_NUMBER", fieldValue: `+91 98220 1000${n}` },
    ],
    customLeadFormSubmissionFields: [{ questionText: "Which configuration?", fieldValue: "2 BHK" }],
    ...extra,
  },
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
  const a = await Automation.create({ orgId: ORG, name: "Prophunt Ads", platform: "Google", mode: "oauth", isActive: true, userToken: "refresh", googleCustomerId: "222", googleLoginCustomerId: "999", createdBy: oid(), updatedBy: oid() });
  assert.equal(a.googleLoginCustomerId, "999");
});

test("poll: both question lists, campaign from the resource name, every page", async () => {
  pages = {
    first: { results: [submission(1), submission(2)], nextPageToken: "p2" },
    p2: { results: [submission(3), { leadFormSubmissionData: { resourceName: "customers/222/leadFormSubmissionData/4", submissionDateTime: "2026-10-28 14:00:00+05:30", leadFormSubmissionFields: [{ fieldType: "FULL_NAME", fieldValue: "No Phone" }] } }] },
  };
  calls.length = 0;
  const automation = await Automation.findOne({ orgId: ORG });
  const result = await pollOne(automation);
  assert.deepEqual(result, { created: 3, skipped: 1 });
  const search = calls.filter((c) => /lead_form_submission_data/.test(c.body.query || ""));
  assert.equal(search.length, 2, "followed next_page_token");
  assert.ok(search.every((c) => c.login === "999" && !("pageSize" in c.body)));
  assert.doesNotMatch(search[0].body.query, /campaign_id|asset_id|is_test_lead/);
  const lead = await Lead.findOne({ orgId: ORG, externalId: "customers/222/leadFormSubmissionData/2" }).lean();
  assert.equal(lead.name, "Buyer 2");
  assert.equal(lead.source, "Google");
  assert.match(lead.requirements, /Which configuration\?: 2 BHK/);
  assert.equal(lead.activities[0].meta.campaignId, "5551");
  const after = await Automation.findById(automation._id).lean();
  assert.equal(after.lastSyncAt.toISOString(), "2026-10-28T08:30:00.000Z", "cursor at the last handled submission (14:00 IST)");
});

test("poll again: nothing duplicated", async () => {
  const automation = await Automation.findOne({ orgId: ORG });
  const result = await pollOne(automation);
  assert.equal(result.created, 0);
  assert.equal(await Lead.countDocuments({ orgId: ORG }), 3);
});

test("a connection missing its manager gets Google's error in plain words", async () => {
  const automation = await Automation.findOne({ orgId: ORG });
  automation.googleLoginCustomerId = "";
  const result = await pollOne(automation);
  assert.match(result.error, /can't open that Google Ads account/);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.connection.db.collection("organizations").insertOne({ _id: ORG, name: "Prophunt LLP", slug: `p-${ORG}`, plan: "enterprise", isActive: true, approvalStatus: "approved", autoAssign: false });
  automationService = require("../services/automationService");
  ({ pollOneGoogleAdsConnection: pollOne } = require("../utils/googleAdsPoller"));
  Automation = require("../models/Automation");
  Lead = require("../models/Lead");
  await run("Google Ads lead sync");
})();
