// Every way a lead is created, run through the REAL handler, into the REAL
// delivery service, with only the database and Vistrow itself stubbed. Each test
// asserts what Vistrow would actually receive (or that it receives nothing).
//
// Not covered here, honestly: the Facebook webhook (signature check + live Graph
// API calls) and the Google Ads poller (live Google API) can't be driven without
// those services, so they are covered by the static wiring guards at the bottom
// and by the payload/routing unit tests, not by running their handlers.

process.env.NODE_ENV = "test";
const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const { test, run, assert } = require("./helpers/harness");
const { createMemoryStore } = require("./helpers/vistrowMemoryStore");
const { createService } = require("../services/vistrowOutbound/service");

const ROOT = path.join(__dirname, "..");
const ORG = "64b0000000000000000000a1";
const KHOPOLI = "64b0000000000000000000e1";
const SECRET = "s3cr3t-token-value-0123456789";
const AD = "120252242040050286";
const KHOPOLI_URL = "https://shaporjipallonji.com/shapoorji-pallonji-khopoli/";
const oid = () => new mongoose.Types.ObjectId();
let phoneSeq = 0;
const phone10 = () => `9876${String(600000 + ++phoneSeq).padStart(6, "0")}`;

// ── stubs, installed before any application module loads ───────────────────
const world = { svc: null, store: null, sent: [], pending: [], order: [], state: {} };
const stubModule = (rel, exports) => { const id = require.resolve(rel); require.cache[id] = { id, filename: id, loaded: true, exports }; };

stubModule("../services/vistrowOutbound", {
  enqueueLeadCreated: (lead, ctx) => { world.order.push("emit"); const p = world.svc.enqueueLeadCreated(lead, ctx); world.pending.push(p); return p; },
  enqueueLeadsCreated: (leads, ctx) => { world.order.push("emit"); const p = world.svc.enqueueLeadsCreated(leads, ctx); world.pending.push(p); return p; },
  startWorker() {}, stopWorker() {},
});
stubModule("../utils/push", new Proxy({}, { get: () => async () => {} }));

const RR = require("../utils/routingRules");
RR.matchRoutingRule = async () => world.state.rule || null;
RR.matchWebsiteRoutingRule = async () => world.state.websiteRule || null;
RR.fileLeadInRoutedProject = async () => {};

const Lead = require("../models/Lead");
const Automation = require("../models/Automation");
const Organization = require("../models/Organization");
const Project = require("../models/Project");

const chain = (v) => { const c = { select: () => c, lean: () => c, sort: () => c, limit: () => c, populate: () => c, then: (res, rej) => Promise.resolve(v).then(res, rej) }; return c; };
Automation.findOne = () => chain(world.state.automation);
Lead.findOne = (q) => chain(world.state.leadFindOne ? world.state.leadFindOne(q) : null);
Lead.find = () => chain(world.state.existing || []);
Lead.updateOne = async (...a) => { world.state.updates.push(a); return {}; };
Lead.create = async (doc) => { if (world.state.createFails) throw new Error("db down"); const d = { ...doc, _id: oid(), createdAt: new Date() }; world.state.created.push(d); return d; };
Lead.insertMany = async (docs) => { if (world.state.insertFails) throw new Error("db down"); const out = docs.map((d) => ({ ...d, _id: oid(), createdAt: new Date() })); world.state.inserted.push(...out); return out; };
Lead.prototype.save = async function save() { if (world.state.saveFails) throw new Error("db down"); world.order.push("save"); this.createdAt = this.createdAt || new Date(); world.state.saved.push(this); return this; };
Organization.findById = () => chain({ _id: ORG, plan: "enterprise", autoAssign: false, whatsapp: {}, isActive: true });
Organization.findOne = () => chain(world.state.qrOrg || null);
Project.findOne = () => chain(world.state.qrProject || null);

const leadService = require("../services/leadService");
const publicController = require("../controllers/publicController");
const waRoutes = require("../routes/whatsappRoutes");
const webhookRouter = require("../routes/webhookRoutes");

// ── the world each test runs in ────────────────────────────────────────────
const ROUTES = {
  website: [{ id: "w1", matchKind: "url_contains", matchValue: "/shapoorji-pallonji-khopoli/", agentId: "agent_khopoli", agentLabel: "Siya KHOPOLI" }],
  facebook: [{ id: "f1", matchKind: "project", matchValue: KHOPOLI, projectName: "SP Khopoli", agentId: "agent_khopoli", agentLabel: "Siya KHOPOLI" }],
  whatsapp: [
    { id: "a1", matchKind: "ad_id", matchValue: AD, agentId: "agent_ad", agentLabel: "Ad agent" },
    { id: "p1", matchKind: "project", matchValue: KHOPOLI, projectName: "SP Khopoli", agentId: "agent_proj", agentLabel: "Project agent" },
  ],
};
const routingOn = (on = []) => Object.fromEntries(Object.keys(ROUTES).map((k) => [k, { enabled: on.includes(k), routes: ROUTES[k] }]));
const silent = { info() {}, warn() {}, error() {} };

function fresh({ on = [], cfg = {} } = {}) {
  Object.assign(world, { sent: [], pending: [], order: [] });
  world.state = { created: [], inserted: [], saved: [], updates: [], automation: null, rule: null, websiteRule: null, leadFindOne: null, existing: [], qrOrg: null, qrProject: null };
  world.store = createMemoryStore();
  world.store.setIntegration(ORG, {
    enabled: true, enabledAt: new Date(Date.now() - 3600e3), baseUrl: "https://api.vistrowvoice.com", accountId: "acct_1", authMode: "header", secret: SECRET,
    defaultCountryCode: "91", dedupeWindowHours: 24, maxLeadAgeMinutes: 15, emitImports: false, routing: routingOn(on), ...cfg,
  });
  world.svc = createService({
    store: world.store, logger: silent, autoKick: false, notifyFailure: async () => {}, killSwitch: () => false,
    send: async ({ url, headers, body }) => { world.sent.push({ url, headers, body: JSON.parse(body) }); return { httpStatus: 200, json: { ok: true }, latencyMs: 5 }; },
  });
}
const settle = async () => { await Promise.all(world.pending); await world.svc.processDue({ limit: 50 }); };
const bodies = () => world.sent.map((s) => s.body);

const user = () => ({ _id: oid(), orgId: ORG, name: "Priya Agent", role: "agent" });
const automationOf = (platform, over = {}) => ({ _id: oid(), orgId: ORG, platform, verifyToken: "tok-1234567890", isActive: true, name: "Test Source", createdBy: oid(), siteName: "", status: "draft", save: async () => {}, ...over });

// HTTP harness for the webhook router
const app = express();
app.use("/webhook", webhookRouter);
const server = app.listen(0);
const base = () => `http://127.0.0.1:${server.address().port}`;
const post = async (p, body) => {
  const r = await fetch(base() + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const mockRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });

// ═══ manual / mobile app / API (leadService.create) ═══════════════════════
test("manual create: emits once, after the lead is saved, and is never called whatever source it is labelled", async () => {
  fresh({ on: ["website", "facebook", "whatsapp"] });
  const { lead } = await leadService.create({ name: "Asha Menon", phone: phone10(), source: "Facebook", requirements: "plot" }, user());
  await settle();
  assert.deepEqual(world.order, ["save", "emit"], "the lead is committed before anything is queued");
  assert.equal(world.sent.length, 1);
  const b = bodies()[0];
  assert.equal(b.lead_id, String(lead._id));
  assert.deepEqual([b.auto_call, b.auto_call_reason, b.lead_source], [false, "not_auto_source", "Facebook Ad"]);
  assert.ok(!("agent_id" in b));
  assert.ok(!("property_type" in b) && !("purpose" in b), "schema defaults are not presented as the lead's own answers");
});
test("manual create: a failed save emits nothing", async () => {
  fresh({ on: ["website"] });
  world.state.saveFails = true;
  await assert.rejects(() => leadService.create({ name: "Asha Menon", phone: phone10() }, user()));
  await settle();
  assert.ok(!world.order.includes("emit")); assert.equal(world.store.deliveries.length, 0);
});
test("manual create: nothing is sent while the integration is off", async () => {
  fresh({ cfg: { enabled: false } });
  await leadService.create({ name: "Asha Menon", phone: phone10() }, user());
  await settle();
  assert.equal(world.store.deliveries.length, 0); assert.equal(world.sent.length, 0);
});

// ═══ bulk import ══════════════════════════════════════════════════════════
test("import: nothing is sent by default, and duplicates are never emitted", async () => {
  fresh({ on: ["website"] });
  world.state.existing = [{ phone: "9000000001" }];
  const r = await leadService.bulkImport([{ name: "New One", phone: phone10() }, { name: "Dup", phone: "9000000001" }], user());
  await settle();
  assert.equal(r.inserted.length, 1); assert.equal(r.duplicates, 1);
  assert.equal(world.store.deliveries.length, 0, "imports are off unless the owner opted in");
});
test("import: when opted in, new rows become Contacts only - never calls - and duplicates are skipped", async () => {
  fresh({ on: ["website", "facebook", "whatsapp"], cfg: { emitImports: true } });
  world.state.existing = [{ phone: "9000000001" }];
  await leadService.bulkImport([{ name: "A One", phone: phone10(), source: "Website" }, { name: "B Two", phone: phone10(), source: "Facebook" }, { name: "Dup", phone: "9000000001" }], user());
  await settle();
  assert.equal(world.sent.length, 2);
  for (const b of bodies()) { assert.equal(b.auto_call, false); assert.ok(!("agent_id" in b)); }
});
test("import: a failed insert emits nothing", async () => {
  fresh({ cfg: { emitImports: true } });
  world.state.insertFails = true;
  await assert.rejects(() => leadService.bulkImport([{ name: "A One", phone: phone10() }], user()));
  assert.ok(!world.order.includes("emit"));
});

// ═══ QR / public form ═════════════════════════════════════════════════════
test("QR form: sent as a Contact with its project and recorded WhatsApp opt-in; never called", async () => {
  fresh({ on: ["website", "facebook", "whatsapp"] });
  world.state.qrOrg = null;
  world.state.qrProject = { _id: KHOPOLI, name: "SP Khopoli", orgId: ORG };
  const res = mockRes();
  await publicController.submitLead({ params: { token: "qr-token-12345" }, body: { name: "Asha Menon", phone: phone10(), email: "a@x.com", whatsappConsent: "true" } }, res, (e) => { throw e; });
  assert.equal(res.code, 201);
  await settle();
  const b = bodies()[0];
  assert.deepEqual([b.lead_source, b.project, b.auto_call, b.auto_call_reason], ["QR Code", "SP Khopoli", false, "not_auto_source"]);
  assert.equal(b.consent_basis, "whatsapp_marketing_opt_in:qr-form");
  assert.ok(!("opt_out" in b) && !("do_not_call" in b));
});
test("QR form: an org-level QR carries no project", async () => {
  fresh();
  world.state.qrOrg = { _id: ORG, isActive: true, autoAssign: false };
  const res = mockRes();
  await publicController.submitLead({ params: { token: "qr-token-12345" }, body: { name: "Asha Menon", phone: phone10() } }, res, (e) => { throw e; });
  await settle();
  assert.ok(!("project" in bodies()[0]));
});

// ═══ WhatsApp / click-to-WhatsApp ad ═════════════════════════════════════
const waOrg = () => ({ _id: ORG, autoAssign: false });
const campaign = (adId = AD) => ({ adId, headline: "900+ Acre Launch", body: "Hi", sourceUrl: "https://fb.me/x", ctwaClid: "CLICK" });
test("WhatsApp ad lead: goes to the agent mapped to that ad", async () => {
  fresh({ on: ["whatsapp"] });
  const lead = await waRoutes.autoCaptureWhatsAppLead(waOrg(), `91${phone10()}`, "Asha", campaign());
  await settle();
  const b = bodies()[0];
  assert.deepEqual([b.auto_call, b.agent_id, b.lead_source, b.ad_id, b.whatsapp], [true, "agent_ad", "WhatsApp", AD, `+91${lead.phone.slice(2)}`]);
});
test("WhatsApp ad lead: falls back to the project route only when the ad has no route of its own", async () => {
  fresh({ on: ["whatsapp"] });
  world.state.rule = { assignTo: oid(), assignToName: "Sheetal", assignToProject: KHOPOLI, assignToProjectName: "SP Khopoli", label: "Khopoli" };
  await waRoutes.autoCaptureWhatsAppLead(waOrg(), `91${phone10()}`, "Asha", campaign("another-ad-id"));
  await settle();
  const b = bodies()[0];
  assert.deepEqual([b.auto_call, b.agent_id, b.project], [true, "agent_proj", "SP Khopoli"]);
});
test("WhatsApp: an organic chat (no ad, no project) is a Contact only", async () => {
  fresh({ on: ["whatsapp"] });
  await waRoutes.autoCaptureWhatsAppLead(waOrg(), `91${phone10()}`, "Asha", null);
  await settle();
  const b = bodies()[0];
  assert.deepEqual([b.auto_call, b.auto_call_reason], [false, "no_route"]);
  assert.ok(!("agent_id" in b));
});
test("WhatsApp: with the source OFF the lead is still imported, but not called", async () => {
  fresh({ on: [] });
  await waRoutes.autoCaptureWhatsAppLead(waOrg(), `91${phone10()}`, "Asha", campaign());
  await settle();
  assert.deepEqual([bodies()[0].auto_call, bodies()[0].auto_call_reason], [false, "source_disabled"]);
});

// ═══ Website form webhook ═════════════════════════════════════════════════
const siteBody = (over = {}) => ({ token: "tok-1234567890", name: "Asha Menon", phone: phone10(), email: "a@x.com", message: "Interested in plots", form_plugin: "cf7", page_url: `${KHOPOLI_URL}?utm_source=fb`, ...over });
test("website form: a lead from a routed page is requested for that page's agent", async () => {
  fresh({ on: ["website"] });
  world.state.automation = automationOf("Website Form");
  const r = await post("/webhook/website", siteBody());
  assert.equal(r.status, 200);            // the website webhook has always answered 200 on success
  assert.equal(r.json.message, "Lead received");
  assert.equal(world.state.created.length, 1);
  await settle();
  const b = bodies()[0];
  assert.deepEqual([b.auto_call, b.agent_id, b.lead_source, b.source], [true, "agent_khopoli", "Website", "arthaleads"]);
  assert.equal(b.route_label, "Page contains /shapoorji-pallonji-khopoli/");
  assert.equal(world.sent[0].headers["X-Vistrow-Webhook-Token"], SECRET);
});
test("website form: a lead from an unrouted page is imported but not called, and no agent is guessed", async () => {
  fresh({ on: ["website"] });
  world.state.automation = automationOf("Website Form");
  await post("/webhook/website", siteBody({ page_url: "https://shaporjipallonji.com/about-us/" }));
  await settle();
  assert.deepEqual([bodies()[0].auto_call, bodies()[0].auto_call_reason], [false, "no_route"]);
  assert.ok(!("agent_id" in bodies()[0]));
});
test("website form: with the Website switch OFF nothing is called", async () => {
  fresh({ on: ["facebook", "whatsapp"] });
  world.state.automation = automationOf("Website Form");
  await post("/webhook/website", siteBody());
  await settle();
  assert.deepEqual([bodies()[0].auto_call, bodies()[0].auto_call_reason], [false, "source_disabled"]);
});
test("website form: the routing rule's project travels with the lead", async () => {
  fresh({ on: [] });
  world.state.automation = automationOf("Website Form");
  world.state.websiteRule = { assignTo: oid(), assignToName: "Sheetal", assignToProject: KHOPOLI, assignToProjectName: "SP Khopoli", label: "r" };
  await post("/webhook/website", siteBody());
  await settle();
  assert.equal(bodies()[0].project, "SP Khopoli");
});
test("website form: honeypot hits, repeat submissions and plugin test leads are never sent", async () => {
  fresh({ on: ["website"] });
  world.state.automation = automationOf("Website Form");
  await post("/webhook/website", siteBody({ website_url: "http://bot.example" }));
  world.state.leadFindOne = () => ({ _id: oid(), createdAt: new Date() }); // same phone within 2 minutes
  await post("/webhook/website", siteBody());
  world.state.leadFindOne = null;
  await post("/webhook/website", siteBody({ form_plugin: "manual_test" }));
  await settle();
  assert.equal(world.store.deliveries.length, 0); assert.equal(world.sent.length, 0);
});
test("website form: a submission with no usable phone is created but never sent to Vistrow", async () => {
  fresh({ on: ["website"] });
  world.state.automation = automationOf("Website Form");
  await post("/webhook/website", siteBody({ phone: "" }));
  await settle();
  assert.equal(world.sent.length, 0);
  assert.equal(world.store.deliveries[0].skipReason, "invalid_phone");
});

// ═══ /webhook/lead : partner tokens, and Vistrow's own results ═════════════
const customBody = (over = {}) => ({ token: "tok-1234567890", name: "Asha Menon", phone: phone10(), email: "a@x.com", message: "Hello", ...over });
test("custom source: a partner lead is sent as a Contact and never called", async () => {
  fresh({ on: ["website", "facebook", "whatsapp"] });
  world.state.automation = automationOf("Custom");
  const r = await post("/webhook/lead", customBody());
  assert.equal(r.status, 201); assert.equal(r.json.message, "Lead received");
  await settle();
  assert.deepEqual([bodies()[0].lead_source, bodies()[0].auto_call, bodies()[0].auto_call_reason], ["Custom", false, "not_auto_source"]);
});
test("custom source: a WhatsApp-provider token counts as the WhatsApp source", async () => {
  fresh({ on: ["whatsapp"] });
  world.state.automation = automationOf("WhatsApp");
  await post("/webhook/lead", customBody());
  await settle();
  const b = bodies()[0];
  assert.deepEqual([b.lead_source, b.auto_call_reason, b.whatsapp !== undefined], ["WhatsApp", "no_route", true]);
});
test("Vistrow result, new call_id: creates the lead as before and sends NOTHING back to Vistrow", async () => {
  fresh({ on: ["website", "facebook", "whatsapp"] });
  world.state.automation = automationOf("Vistrow Voice");
  const r = await post("/webhook/lead", customBody({ call_id: 1090, transcript: [{ speaker: "Caller", text: "hi" }], sentiment: "neutral", duration_seconds: 30 }));
  assert.equal(r.status, 201);
  assert.equal(world.state.created.length, 1);
  assert.equal(world.state.created[0].source, "Vistrow Voice");
  await settle();
  assert.equal(world.order.filter((o) => o === "emit").length, 0, "the call_id branch has no emit at all");
  assert.equal(world.sent.length, 0);
});
test("Vistrow result, call_id on an existing phone: appends the call as before and sends nothing", async () => {
  fresh({ on: ["website"] });
  world.state.automation = automationOf("Vistrow Voice");
  const existing = { _id: oid() };
  world.state.leadFindOne = (q) => (q["voiceCalls.externalCallId"] ? null : existing);
  const r = await post("/webhook/lead", customBody({ call_id: 1091, transcript: [{ speaker: "Agent", text: "hello" }] }));
  assert.equal(r.status, 200); assert.equal(r.json.message, "Call added to existing lead");
  assert.equal(world.state.updates.length, 1);
  await settle();
  assert.equal(world.order.filter((o) => o === "emit").length, 0); assert.equal(world.sent.length, 0);
});
test("Vistrow result, re-send of a known call_id: updates as before and sends nothing", async () => {
  fresh({ on: ["website"] });
  world.state.automation = automationOf("Vistrow Voice");
  world.state.leadFindOne = () => ({ _id: oid() });
  const r = await post("/webhook/lead", customBody({ call_id: 1092, transcript: [{ speaker: "Agent", text: "hello" }] }));
  assert.equal(r.status, 200); assert.equal(r.json.message, "Call updated");
  await settle();
  assert.equal(world.sent.length, 0);
});
test("Vistrow result without a call_id (legacy path) is also never sent back", async () => {
  fresh({ on: ["website", "facebook", "whatsapp"] });
  world.state.automation = automationOf("Vistrow Voice");
  const withVoice = await post("/webhook/lead", customBody({ transcript: [{ speaker: "Caller", text: "hi" }], sentiment: "positive" }));
  const plain = await post("/webhook/lead", customBody());
  assert.deepEqual([withVoice.status, plain.status], [201, 201]);
  await settle();
  assert.equal(world.state.created.length, 2);
  assert.equal(world.store.deliveries.length, 0, "no job was even queued");
  assert.equal(world.sent.length, 0);
});

// ═══ Google Ads lead-form webhook ═════════════════════════════════════════
const googleBody = (over = {}) => ({
  google_key: "tok-1234567890", is_test: false, lead_id: "L1", campaign_id: "555", campaign_name: "Khopoli Search", adgroup_id: "9", adgroup_name: "Plots",
  user_column_data: [{ column_id: "FULL_NAME", string_value: "Asha Menon" }, { column_id: "PHONE_NUMBER", string_value: `+91${phone10()}` }], ...over,
});
test("google lead form: sent as a Contact with its campaign, never called", async () => {
  fresh({ on: ["website", "facebook", "whatsapp"] });
  world.state.automation = automationOf("Google");
  const r = await post("/webhook/google", googleBody());
  assert.equal(r.status, 201);
  await settle();
  const b = bodies()[0];
  assert.deepEqual([b.lead_source, b.campaign_id, b.campaign_name, b.auto_call, b.auto_call_reason], ["Google", "555", "Khopoli Search", false, "not_auto_source"]);
  assert.equal(b.custom_fields.adgroup_name, "Plots");
});
test("google lead form: Google's own 'send test lead' is never sent", async () => {
  fresh({ on: ["website"] });
  world.state.automation = automationOf("Google");
  await post("/webhook/google", googleBody({ is_test: true }));
  await settle();
  assert.equal(world.store.deliveries.length, 0);
});

// ═══ no replay / no backfill ══════════════════════════════════════════════
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
// Source with full-line and block comments removed, so a comment that merely mentions Lead.create() is not a creation site.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const walk = (dir, out = []) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === "node_modules" || f.name === ".git" || f.name === "logs") continue;
    const p = path.join(dir, f.name);
    f.isDirectory() ? walk(p, out) : f.name.endsWith(".js") && out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

test("the outbound module cannot read existing leads, so it cannot backfill", () => {
  for (const f of walk(path.join(ROOT, "services/vistrowOutbound"))) {
    const src = fs.readFileSync(f, "utf8");
    assert.ok(!/models\/Lead["']/.test(src), `${rel(f)} imports the Lead model`);
    assert.ok(!/\bLead\.(find|aggregate|distinct|countDocuments|cursor)\b/.test(src), `${rel(f)} queries leads`);
  }
  const routes = read("routes/vistrowOutboundRoutes.js");
  assert.ok(!/models\/Lead["']/.test(routes) && !/enqueueLead/.test(routes), "enabling or configuring must never enqueue anything");
});
test("no script replays or backfills leads into the integration", () => {
  for (const f of walk(path.join(ROOT, "scripts"))) {
    assert.ok(!/vistrowOutbound|enqueueLead|emitLeadCreated/.test(fs.readFileSync(f, "utf8")), `${rel(f)} touches the outbound integration`);
  }
});

// ═══ static guard: every creation path has been decided ═══════════════════
// If you add a place that creates a Lead, this fails until you either wire it
// to emitLeadCreated (and add its origin to CALLABLE_ORIGINS only if it is an
// automated inbound channel) or record here WHY it must not emit.
// insertOne: catches a creation hidden inside bulkWrite; a bulkWrite of updateOne ops is an update, not a new lead.
const SITE_RE = /\bLead\.(create|insertMany)\(|\bnew Lead\(|\binsertOne\s*:/g;
const MANIFEST = {
  "controllers/publicController.js": { sites: 1, origins: ["qr"] },
  "services/leadService.js": { sites: 2, origins: ["manual", "import"] },
  "routes/webhookRoutes.js": { sites: 5, origins: ["webhook-facebook", "webhook-website", "webhook-custom", "webhook-google"] },
  "routes/whatsappRoutes.js": { sites: 1, origins: ["whatsapp-ctwa", "whatsapp-inbound"] },
  "utils/googleAdsPoller.js": { sites: 1, origins: ["poller-google"] },
  // An existing person moved between the pipeline and a project, or a soft-delete record: not a new lead.
  "services/projectService.js": { sites: 3, origins: [], why: "moves an existing person between lists" },
  // Developer tooling, never run in production.
  "utils/seed.js": { sites: 1, origins: [], why: "dev seed" },
  "scripts/sandbox.js": { sites: 1, origins: [], why: "dev sandbox" },
};
test("guard: every Lead-creating site is accounted for", () => {
  const found = {};
  for (const f of walk(ROOT)) {
    const r = rel(f);
    if (r.startsWith("tests/")) continue;
    const n = (code(fs.readFileSync(f, "utf8")).match(SITE_RE) || []).length;
    if (n) found[r] = n;
  }
  for (const [file, n] of Object.entries(found)) {
    assert.ok(MANIFEST[file], `${file} creates leads (${n}) but is not in the manifest: decide whether it emits to Vistrow`);
    assert.equal(n, MANIFEST[file].sites, `${file}: expected ${MANIFEST[file].sites} creation site(s), found ${n} - a path was added or removed`);
  }
  for (const file of Object.keys(MANIFEST)) assert.ok(found[file], `${file} is in the manifest but no longer creates leads`);
});
test("guard: each emitting file really wires its origins, and the others emit nothing", () => {
  for (const [file, m] of Object.entries(MANIFEST)) {
    const src = code(read(file));
    const emits = (src.match(/\bemitLeads?Created\(/g) || []).length;
    if (!m.origins.length) { assert.equal(emits, 0, `${file} must not emit: ${m.why}`); continue; }
    assert.ok(emits >= 1, `${file} should emit`);
    for (const o of m.origins) assert.ok(src.includes(`"${o}"`), `${file} is missing origin ${o}`);
  }
});
test("guard: the number of emit call sites is exactly the reviewed set", () => {
  let single = 0, batch = 0;
  for (const f of walk(ROOT)) {
    const r = rel(f);
    if (r.startsWith("tests/") || r === "utils/emitLeadCreated.js" || r.startsWith("services/vistrowOutbound/")) continue;
    const src = code(fs.readFileSync(f, "utf8"));
    single += (src.match(/\bemitLeadCreated\(/g) || []).length;
    batch += (src.match(/\bemitLeadsCreated\(/g) || []).length;
  }
  assert.equal(single, 8, "facebook, website, custom, google webhook, google poller, whatsapp, manual, qr");
  assert.equal(batch, 1, "bulk import");
});
test("guard: the call_id branches of the inbound Vistrow route contain no emit", () => {
  const src = read("routes/webhookRoutes.js");
  const handler = src.slice(src.indexOf('router.post("/lead"'), src.indexOf('router.post("/google"'));
  const creates = [...handler.matchAll(/\bLead\.create\(/g)].map((m) => m.index);
  const emits = [...handler.matchAll(/\bemitLeadCreated\(/g)].map((m) => m.index);
  assert.equal(creates.length, 2, "branch 3 (call_id) and the legacy path");
  assert.equal(emits.length, 1, "exactly one emit in the whole inbound route");
  assert.ok(emits[0] > creates[1], "the only emit sits after the legacy (non-call_id) create, never in the call_id branches");
  // ...and it carries the loop-guard fields, so a Vistrow-platform lead without a call_id is dropped too.
  const callSite = handler.slice(emits[0], emits[0] + 400);
  assert.ok(/vistrowOrigin:\s*automation\.platform === "Vistrow Voice"/.test(callSite));
  assert.ok(/routeSource: automation\.platform === "WhatsApp"/.test(callSite));
});
test("guard: facebook and google-poller hooks carry attribution and the source they represent", () => {
  const wh = read("routes/webhookRoutes.js");
  assert.ok(/origin: "webhook-facebook", routeSource: "facebook"/.test(wh));
  assert.ok(/origin: "webhook-website", routeSource: "website"/.test(wh));
  const poller = read("utils/googleAdsPoller.js");
  assert.ok(/origin: "poller-google"[^}]*submittedAt/.test(poller), "the poller must pass the real enquiry time so old leads are not treated as new");
  assert.ok(!/routeSource/.test(poller), "Google never auto-calls");
});

run("Vistrow outbound - every lead-creation path");
