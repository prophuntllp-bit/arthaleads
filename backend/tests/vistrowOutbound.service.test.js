// The delivery state machine, end to end, against an in-memory store and a fake
// Vistrow. No database, no network: nothing here can place a call or contact
// anyone. Covers gating, the owner's call rules, idempotency, no replay,
// loop prevention, retries, failure surfacing, send-time recheck, test/dry-run,
// and that no PII or credential reaches logs.

const { test, run, assert } = require("./helpers/harness");
const { createService, CALLABLE_ORIGINS } = require("../services/vistrowOutbound/service");
const { createMemoryStore } = require("./helpers/vistrowMemoryStore");

const ORG = "64b0000000000000000000a1";
const KHOPOLI = "64b0000000000000000000e1";
const OTHER_PROJECT = "64b0000000000000000000e2";
const SECRET = "s3cr3t-token-value-0123456789";
const AD = "120252242040050286";
const KHOPOLI_PAGE = "https://shaporjipallonji.com/shapoorji-pallonji-khopoli/";

let idSeq = 0;
let phoneSeq = 0;
const newId = () => `64b${String(++idSeq).padStart(21, "0")}`;
const newPhone = () => `9876${String(500000 + ++phoneSeq).padStart(6, "0")}`;

const ROUTES = {
  website: [{ id: "w1", matchKind: "url_contains", matchValue: "/shapoorji-pallonji-khopoli/", agentId: "agent_khopoli", agentLabel: "Siya KHOPOLI" }],
  facebook: [{ id: "f1", matchKind: "project", matchValue: KHOPOLI, projectName: "SP Khopoli", agentId: "agent_khopoli", agentLabel: "Siya KHOPOLI" }],
  whatsapp: [
    { id: "a1", matchKind: "ad_id", matchValue: AD, agentId: "agent_ad", agentLabel: "Ad agent" },
    { id: "p1", matchKind: "project", matchValue: KHOPOLI, projectName: "SP Khopoli", agentId: "agent_proj", agentLabel: "Project agent" },
  ],
};
const routingOn = (on = []) => Object.fromEntries(Object.keys(ROUTES).map((k) => [k, { enabled: on.includes(k), routes: ROUTES[k] }]));

const baseCfg = (over = {}) => ({
  enabled: true, enabledAt: new Date("2026-10-09T09:00:00Z"),
  baseUrl: "https://api.vistrowvoice.com", accountId: "acct_1", authMode: "header", secret: SECRET,
  defaultCountryCode: "91", dedupeWindowHours: 24, maxLeadAgeMinutes: 15, emitImports: false,
  routing: routingOn([]), ...over,
});

function env({ cfg = {}, respond, allowTest = false, autoKick = false, kill = false } = {}) {
  const clock = { t: new Date("2026-10-09T10:00:00Z") };
  const now = () => new Date(clock.t);
  const store = createMemoryStore({ clock: now });
  const sent = [];
  const logs = [];
  const notified = [];
  let responder = respond || (() => ({ httpStatus: 200, json: { ok: true }, latencyMs: 40 }));
  const send = async ({ url, headers, body }) => {
    const rec = { url, headers, rawBody: body, body: JSON.parse(body) };
    sent.push(rec);
    const r = await responder(sent.length, rec);
    clock.t = new Date(clock.t.getTime() + (r.latencyMs || 0));
    return r;
  };
  const logger = { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) };
  const svc = createService({
    store, send, now, logger, autoKick, rand: () => 0.5, killSwitch: () => kill, testSendAllowed: () => allowTest,
    notifyFailure: async (c, info) => { notified.push(info); },
  });
  store.setIntegration(ORG, baseCfg(cfg));
  return {
    clock, store, sent, logs, notified, svc,
    setRespond: (f) => { responder = f; },
    advance: (ms) => { clock.t = new Date(clock.t.getTime() + ms); },
    cfg: (over) => store.setIntegration(ORG, baseCfg({ ...(store.integrations.get(ORG) || {}), ...over })),
    process: () => svc.processDue({ limit: 50 }),
    d: (i = 0) => store.deliveries[i],
  };
}

const lead = (e, over = {}) => ({
  _id: newId(), orgId: ORG, name: "Asha Menon", phone: newPhone(), email: "asha@example.com", source: "Website",
  sourcePage: KHOPOLI_PAGE, requirements: "Wants a plot near the lake", createdAt: new Date(e.clock.t), ...over,
});
const WEB = { origin: "webhook-website", routeSource: "website" };
const FB = (project = { id: KHOPOLI, name: "SP Khopoli" }) => ({ origin: "webhook-facebook", routeSource: "facebook", project, attribution: { campaign_id: "C1", campaign_name: "Khopoli", form_id: "F1", form_name: "Khopoli form" } });
const WA = { origin: "whatsapp-ctwa", routeSource: "whatsapp" };
const fbLead = (e, over) => lead(e, { source: "Facebook", sourcePage: "", ...over });
const waLead = (e, over) => lead(e, { source: "WhatsApp", sourcePage: "", campaignRef: { adId: AD, headline: "900+ Acre Launch" }, ...over });

// ═══ the owner's call rules ═══════════════════════════════════════════════
test("nothing is sent for an organisation with no integration", async () => {
  const e = env(); e.store.integrations.clear();
  const r = await e.svc.enqueueLeadCreated(lead(e), WEB);
  assert.deepEqual([r.queued, r.reason], [false, "disabled"]);
  assert.equal(e.store.deliveries.length, 0);
  await e.process(); assert.equal(e.sent.length, 0);
});
test("a disabled integration sends nothing, not even a Contact", async () => {
  const e = env({ cfg: { enabled: false, routing: routingOn(["website"]) } });
  assert.equal((await e.svc.enqueueLeadCreated(lead(e), WEB)).reason, "disabled");
  await e.process(); assert.equal(e.sent.length, 0);
});
test("integration on but the source OFF: the lead is sent as a Contact, no call, no agent", async () => {
  const e = env({ cfg: { routing: routingOn([]) } });
  const r = await e.svc.enqueueLeadCreated(lead(e), WEB);
  assert.equal(r.queued, true); assert.equal(r.autoCall, false); assert.equal(r.reason, "source_disabled");
  await e.process();
  assert.equal(e.sent.length, 1);
  const b = e.sent[0].body;
  assert.equal(b.auto_call, false); assert.equal(b.auto_call_reason, "source_disabled");
  assert.ok(!("agent_id" in b));
  assert.equal(b.lead_source, "Website");
  assert.equal(e.d().status, "delivered"); assert.equal(e.d().autoCall, false);
});
test("website source ON + matching page: the call is requested for the configured agent", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  await e.process();
  const b = e.sent[0].body;
  assert.equal(b.auto_call, true); assert.equal(b.agent_id, "agent_khopoli");
  assert.equal(b.route_label, "Page contains /shapoorji-pallonji-khopoli/");
  assert.ok(!("auto_call_reason" in b));
  assert.deepEqual([e.d().autoCall, e.d().agentId, e.d().routeSource, e.d().routeLabel], [true, "agent_khopoli", "website", "Page contains /shapoorji-pallonji-khopoli/"]);
});
test("website source ON but the page matches no route: Contact only, and NO default agent", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e, { sourcePage: "https://shaporjipallonji.com/something-else/" }), WEB);
  await e.process();
  const b = e.sent[0].body;
  assert.equal(b.auto_call, false); assert.equal(b.auto_call_reason, "no_route");
  assert.ok(!("agent_id" in b), "must not fall back to another source's or any default agent");
});
test("a lead from another source never borrows a route from a source that is on", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(fbLead(e), FB());
  await e.process();
  assert.equal(e.sent[0].body.auto_call, false);
  assert.equal(e.sent[0].body.auto_call_reason, "source_disabled");
});
test("facebook: a lead tied to a mapped project goes to that project's agent", async () => {
  const e = env({ cfg: { routing: routingOn(["facebook"]) } });
  await e.svc.enqueueLeadCreated(fbLead(e), FB());
  await e.process();
  const b = e.sent[0].body;
  assert.deepEqual([b.auto_call, b.agent_id, b.lead_source, b.project, b.campaign_id, b.form_name], [true, "agent_khopoli", "Facebook Ad", "SP Khopoli", "C1", "Khopoli form"]);
});
test("facebook: an unmapped project is imported with its project, but not called", async () => {
  const e = env({ cfg: { routing: routingOn(["facebook"]) } });
  await e.svc.enqueueLeadCreated(fbLead(e), FB({ id: OTHER_PROJECT, name: "Other" }));
  await e.process();
  const b = e.sent[0].body;
  assert.deepEqual([b.auto_call, b.auto_call_reason, b.project, b.lead_source], [false, "no_route", "Other", "Facebook Ad"]);
  assert.ok(!("agent_id" in b));
});
test("facebook: a lead with no project is a Contact only", async () => {
  const e = env({ cfg: { routing: routingOn(["facebook"]) } });
  await e.svc.enqueueLeadCreated(fbLead(e), FB(null));
  await e.process();
  assert.equal(e.sent[0].body.auto_call, false);
  assert.ok(!("project" in e.sent[0].body));
});
test("whatsapp: ad id route, then project route, then Contact only", async () => {
  const e = env({ cfg: { routing: routingOn(["whatsapp"]) } });
  await e.svc.enqueueLeadCreated(waLead(e), WA);
  await e.svc.enqueueLeadCreated(waLead(e, { campaignRef: { adId: "unknown-ad" } }), { ...WA, project: { id: KHOPOLI, name: "SP Khopoli" } });
  await e.svc.enqueueLeadCreated(waLead(e, { campaignRef: undefined }), { origin: "whatsapp-inbound", routeSource: "whatsapp" });
  await e.process();
  const by = (i) => e.sent[i].body;
  assert.deepEqual([by(0).auto_call, by(0).agent_id, by(0).whatsapp !== undefined], [true, "agent_ad", true]);
  assert.deepEqual([by(1).auto_call, by(1).agent_id], [true, "agent_proj"]);
  assert.deepEqual([by(2).auto_call, by(2).auto_call_reason], [false, "no_route"]);
  assert.ok(!("agent_id" in by(2)));
});
test("a route row with no agent selected is not called", async () => {
  const e = env({ cfg: { routing: { ...routingOn(["website"]), website: { enabled: true, routes: [{ ...ROUTES.website[0], agentId: "", agentLabel: "" }] } } } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  await e.process();
  assert.deepEqual([e.sent[0].body.auto_call, e.sent[0].body.auto_call_reason], [false, "agent_missing"]);
  assert.ok(!("agent_id" in e.sent[0].body));
});
test("leads that are not from Website/Facebook/WhatsApp are Contacts only", async () => {
  const e = env({ cfg: { routing: routingOn(["website", "facebook", "whatsapp"]) } });
  await e.svc.enqueueLeadCreated(lead(e, { source: "Google" }), { origin: "webhook-google" });
  await e.svc.enqueueLeadCreated(lead(e, { source: "QR Code" }), { origin: "qr" });
  await e.svc.enqueueLeadCreated(lead(e, { source: "Custom" }), { origin: "webhook-custom" });
  await e.process();
  assert.equal(e.sent.length, 3);
  for (const s of e.sent) { assert.equal(s.body.auto_call, false); assert.equal(s.body.auto_call_reason, "not_auto_source"); assert.ok(!("agent_id" in s.body)); }
});
test("only automated creation paths can ever be called, whatever source label a lead carries", async () => {
  const e = env({ cfg: { routing: routingOn(["website", "facebook", "whatsapp"]) } });
  for (const origin of ["manual", "import", "qr", "poller-google", "webhook-google", "unknown"]) {
    await e.svc.enqueueLeadCreated(lead(e, { source: "Website" }), { origin, routeSource: "website", project: { id: KHOPOLI, name: "x" } });
  }
  e.cfg({ emitImports: true });
  await e.process();
  for (const s of e.sent) assert.equal(s.body.auto_call, false);
  assert.ok(["webhook-website", "webhook-facebook", "webhook-custom", "whatsapp-ctwa", "whatsapp-inbound"].every((o) => CALLABLE_ORIGINS.has(o)));
  assert.ok(!["manual", "import", "qr", "poller-google", "webhook-google"].some((o) => CALLABLE_ORIGINS.has(o)));
});
test("a WhatsApp-provider token source can be called; a Custom one cannot", async () => {
  const e = env({ cfg: { routing: routingOn(["whatsapp"]) } });
  await e.svc.enqueueLeadCreated(waLead(e), { origin: "webhook-custom", routeSource: "whatsapp" });
  await e.svc.enqueueLeadCreated(lead(e, { source: "Custom" }), { origin: "webhook-custom" });
  await e.process();
  assert.equal(e.sent[0].body.auto_call, true);
  assert.equal(e.sent[1].body.auto_call, false);
});

// ═══ imports ══════════════════════════════════════════════════════════════
test("imports send nothing by default", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const r = await e.svc.enqueueLeadsCreated([lead(e), lead(e)], { origin: "import" });
  assert.deepEqual([r.queued, r.reason], [0, "imports_off"]);
  assert.equal(e.store.deliveries.length, 0);
});
test("opted-in imports are Contacts only and never call, even for a matching Website lead", async () => {
  const e = env({ cfg: { emitImports: true, routing: routingOn(["website", "facebook", "whatsapp"]) } });
  const r = await e.svc.enqueueLeadsCreated([lead(e), fbLead(e), waLead(e)], { origin: "import", routeSource: "website" });
  assert.equal(r.queued, 3);
  await e.process();
  for (const s of e.sent) assert.equal(s.body.auto_call, false);
});
test("a large import is a list upload and sends nothing at all", async () => {
  const e = env({ cfg: { emitImports: true } });
  const r = await e.svc.enqueueLeadsCreated(Array.from({ length: e.svc.IMPORT_EMIT_CAP + 1 }, () => lead(e)), { origin: "import" });
  assert.deepEqual([r.queued, r.reason], [0, "import_too_large"]);
  assert.equal(e.store.deliveries.length, 0);
});

// ═══ no replay, loop prevention, freshness ════════════════════════════════
test("a lead created before the integration was switched on is never sent", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const r = await e.svc.enqueueLeadCreated(lead(e, { createdAt: new Date("2026-10-09T08:00:00Z") }), WEB);
  assert.equal(r.reason, "pre_enable");
  assert.equal(e.store.deliveries.length, 0);
  await e.process(); assert.equal(e.sent.length, 0);
});
test("leads that arrive FROM Vistrow are never sent back (no loop)", async () => {
  const e = env({ cfg: { routing: routingOn(["website", "facebook", "whatsapp"]) } });
  const cases = [
    [lead(e, { source: "Vistrow Voice" }), WEB],
    [lead(e, { source: "Custom", voiceCalls: [{ externalCallId: 1090 }] }), { origin: "webhook-custom" }],
    [lead(e, { source: "Website" }), { ...WEB, vistrowOrigin: true }],
  ];
  for (const [l, ctx] of cases) assert.equal((await e.svc.enqueueLeadCreated(l, ctx)).reason, "vistrow_origin");
  await e.process();
  assert.equal(e.sent.length, 0); assert.equal(e.store.deliveries.length, 0);
});
test("test leads and deleted leads are ignored", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  assert.equal((await e.svc.enqueueLeadCreated(lead(e), { ...WEB, isTest: true })).reason, "test_lead");
  assert.equal((await e.svc.enqueueLeadCreated(lead(e, { isDeleted: true }), WEB)).reason, "deleted");
  assert.equal(e.store.deliveries.length, 0);
});
test("an old enquiry is neither imported nor called (e.g. a Google poller's 7-day catch-up)", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const r = await e.svc.enqueueLeadCreated(lead(e), { ...WEB, submittedAt: new Date(e.clock.t.getTime() - 16 * 60000) });
  assert.equal(r.reason, "stale_lead");
  await e.process(); assert.equal(e.sent.length, 0);
  assert.equal(e.d().status, "skipped");
});
test("a recent enquiry is accepted", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  assert.equal((await e.svc.enqueueLeadCreated(lead(e), { ...WEB, submittedAt: new Date(e.clock.t.getTime() - 14 * 60000) })).queued, true);
});
test("a lead with no dialable phone is skipped, not guessed", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  for (const phone of ["N/A", "N/A (test)", "12345", ""]) assert.equal((await e.svc.enqueueLeadCreated(lead(e, { phone }), WEB)).reason, "invalid_phone");
  await e.process(); assert.equal(e.sent.length, 0);
});
test("the global kill switch stops everything", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, kill: true });
  assert.equal((await e.svc.enqueueLeadCreated(lead(e), WEB)).reason, "kill_switch");
  assert.equal(e.store.deliveries.length, 0);
});

// ═══ idempotency and repeat enquiries ═════════════════════════════════════
test("the same lead enqueued twice is one delivery and one send", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const l = lead(e);
  assert.equal((await e.svc.enqueueLeadCreated(l, WEB)).queued, true);
  assert.equal((await e.svc.enqueueLeadCreated(l, WEB)).reason, "already_queued");
  await e.process();
  assert.equal((await e.svc.enqueueLeadCreated(l, WEB)).reason, "already_queued");
  await e.process();
  assert.equal(e.store.deliveries.length, 1); assert.equal(e.sent.length, 1);
});
test("two instances racing to enqueue the same lead still produce one job", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const l = lead(e);
  const rs = await Promise.all([e.svc.enqueueLeadCreated(l, WEB), e.svc.enqueueLeadCreated(l, WEB), e.svc.enqueueLeadCreated(l, WEB)]);
  assert.equal(rs.filter((r) => r.queued).length, 1);
  assert.equal(e.store.deliveries.length, 1);
});
test("the body is a snapshot: editing the lead after queueing does not change what is sent", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const l = lead(e, { name: "Original Name" });
  await e.svc.enqueueLeadCreated(l, WEB);
  l.name = "Changed Name"; l.phone = "9000000000";
  await e.process();
  assert.equal(e.sent[0].body.name, "Original Name");
  assert.notEqual(e.sent[0].body.phone, "+919000000000");
});
test("repeat enquiry within the window is not phoned twice, but is still sent as a Contact", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const phone = newPhone();
  await e.svc.enqueueLeadCreated(lead(e, { phone }), WEB);
  await e.process();
  await e.svc.enqueueLeadCreated(lead(e, { phone: `+91 ${phone}` }), WEB);
  await e.process();
  assert.deepEqual(e.sent.map((s) => s.body.auto_call), [true, false]);
  assert.equal(e.sent[1].body.auto_call_reason, "recent_duplicate_phone");
  e.advance(25 * 3600 * 1000);
  await e.svc.enqueueLeadCreated(lead(e, { phone }), WEB);
  await e.process();
  assert.equal(e.sent[2].body.auto_call, true, "after the window the person can be called again");
});
test("an earlier Contact-only record does not stop a later eligible lead being called", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const phone = newPhone();
  await e.svc.enqueueLeadCreated(fbLead(e, { phone }), FB());   // facebook is off: Contact only
  await e.process();
  await e.svc.enqueueLeadCreated(lead(e, { phone }), WEB);
  await e.process();
  assert.deepEqual(e.sent.map((s) => s.body.auto_call), [false, true]);
});

// ═══ delivery, retry, failure ═════════════════════════════════════════════
test("success records status, attempts, latency and end-to-end time", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const l = lead(e);
  await e.svc.enqueueLeadCreated(l, WEB);
  e.advance(2000);
  await e.process();
  const d = e.d();
  assert.equal(d.status, "delivered"); assert.equal(d.attempts, 1);
  assert.equal(d.lastLatencyMs, 40); assert.equal(d.lastHttpStatus, 200);
  assert.equal(d.endToEndMs, 2040);
  assert.equal(d.attemptLog.length, 1);
  assert.ok(e.store.integrations.get(ORG).lastSuccessAt);
});
test("deduped:true is a successful delivery", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, respond: () => ({ httpStatus: 200, json: { ok: true, deduped: true }, latencyMs: 5 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.deepEqual([e.d().status, e.d().deduped], ["delivered", true]);
});
test("2xx ok:false is a permanent failure that is shown, never marked delivered, and is not retried", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, respond: () => ({ httpStatus: 200, json: { ok: false, reason: "account_not_found" }, latencyMs: 9 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.equal(e.d().status, "failed"); assert.equal(e.d().lastErrorCode, "OK_FALSE"); assert.equal(e.d().lastErrorMessage, "account_not_found");
  const integ = e.store.integrations.get(ORG);
  assert.equal(integ.lastError.code, "OK_FALSE"); assert.ok(integ.lastFailureAt);
  assert.equal(integ.lastSuccessAt, undefined);
  e.advance(3600e3); await e.process();
  assert.equal(e.sent.length, 1, "permanent failures are not retried");
});
test("admins are alerted on a failure, at most once per hour", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, respond: () => ({ httpStatus: 401, json: null, latencyMs: 5 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.equal(e.notified.length, 1);
  e.advance(61 * 60e3);
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.equal(e.notified.length, 2);
});
test("a transient failure is retried with backoff, with an identical body and idempotency key", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, respond: (n) => (n === 1 ? { httpStatus: 503, json: null, latencyMs: 30 } : { httpStatus: 200, json: { ok: true }, latencyMs: 30 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  await e.process();
  assert.equal(e.d().status, "pending"); assert.equal(e.d().attempts, 1); assert.equal(e.d().lastErrorCode, "HTTP_503");
  assert.ok(e.d().nextAttemptAt > e.clock.t);
  await e.process(); assert.equal(e.sent.length, 1, "not retried before it is due");
  e.advance(3500); await e.process();
  assert.equal(e.sent.length, 2); assert.equal(e.d().status, "delivered"); assert.equal(e.d().attempts, 2);
  assert.equal(e.sent[0].rawBody, e.sent[1].rawBody);
  assert.equal(e.sent[0].headers["Idempotency-Key"], e.sent[1].headers["Idempotency-Key"]);
});
test("retries give up after the budget and are marked dead and surfaced", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, respond: () => ({ httpStatus: 503, json: null, latencyMs: 10 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  for (let i = 0; i < 12; i++) {
    await e.process();
    if (e.d().status !== "pending") break;
    e.clock.t = new Date(e.d().nextAttemptAt);
  }
  assert.equal(e.d().status, "dead"); assert.equal(e.d().attempts, 8); assert.equal(e.d().lastErrorCode, "HTTP_503");
  assert.equal(e.sent.length, 8);
  assert.equal(e.notified.length, 1);
  assert.equal(e.store.integrations.get(ORG).lastError.code, "HTTP_503");
});
test("network errors and non-acceptance 2xx are retried; 4xx is not", async () => {
  const cases = [
    [{ httpStatus: 0, json: null, errorCode: "TIMEOUT", latencyMs: 8000 }, "pending", "TIMEOUT"],
    [{ httpStatus: 200, json: {}, latencyMs: 5 }, "pending", "BAD_2XX_BODY"],
    [{ httpStatus: 200, json: null, latencyMs: 5 }, "pending", "BAD_2XX_BODY"],
    [{ httpStatus: 404, json: { ok: false, reason: "no_such_account" }, latencyMs: 5 }, "failed", "HTTP_404"],
    [{ httpStatus: 302, json: null, latencyMs: 5 }, "failed", "REDIRECT"],
  ];
  for (const [resp, status, code] of cases) {
    const e = env({ cfg: { routing: routingOn(["website"]) }, respond: () => resp });
    await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
    assert.deepEqual([e.d().status, e.d().lastErrorCode], [status, code], code);
  }
});
test("Retry-After longer than the backoff is honoured", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, respond: () => ({ httpStatus: 429, json: null, retryAfterMs: 120000, latencyMs: 5 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.ok(e.d().nextAttemptAt.getTime() - e.clock.t.getTime() >= 119000);
});
test("a worker that died mid-send is recovered after its lease, and never double-sent while the lease holds", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  const claimed = await e.store.claimDue({ now: e.clock.t, leaseMs: 45000, limit: 5 });
  assert.equal(claimed.length, 1);                      // ...then the process "crashes"
  await e.process(); assert.equal(e.sent.length, 0);     // lease still held
  e.advance(46000); await e.process();
  assert.equal(e.sent.length, 1); assert.equal(e.d().attempts, 2); assert.equal(e.d().status, "delivered");
});
test("two workers racing for the same job send it once", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  await Promise.all([e.process(), e.process(), e.svc.processById(e.d()._id)]);
  assert.equal(e.sent.length, 1);
});
test("switching the integration off cancels what is still queued and sends nothing", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  e.cfg({ enabled: false });
  await e.process();
  assert.equal(e.sent.length, 0); assert.equal(e.d().status, "cancelled");
});
test("a missing credential, or a bad endpoint, fails visibly and sends nothing", async () => {
  let e = env({ cfg: { routing: routingOn(["website"]), secret: "" } });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.deepEqual([e.d().status, e.d().lastErrorCode, e.sent.length], ["failed", "NO_SECRET", 0]);
  e = env({ cfg: { routing: routingOn(["website"]), secret: "enc1:deadbeef" } });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.equal(e.d().lastErrorCode, "NO_SECRET");
  e = env({ cfg: { routing: routingOn(["website"]), baseUrl: "https://evil.example.com" } });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.deepEqual([e.d().lastErrorCode, e.sent.length], ["BAD_ENDPOINT", 0]);
});
test("a job that could not be delivered for hours is not sent late", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  e.advance(7 * 3600e3);
  await e.process();
  assert.equal(e.sent.length, 0); assert.equal(e.d().status, "dead"); assert.equal(e.d().lastErrorCode, "EXPIRED");
});

// ═══ send-time recheck: switching a source off stops calls not yet sent ═══
test("turning the source OFF after a lead was queued sends the Contact but not the call", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  assert.equal(e.d().autoCall, true);
  e.cfg({ routing: routingOn([]) });
  await e.process();
  const b = e.sent[0].body;
  assert.deepEqual([b.auto_call, b.auto_call_reason], [false, "changed_before_send"]);
  assert.ok(!("agent_id" in b) && !("route_label" in b));
  assert.deepEqual([e.d().autoCall, e.d().agentId], [false, ""]);
  assert.equal(e.d().status, "delivered");
});
test("changing the route's agent, or deleting the route, before send withdraws the call", async () => {
  let e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  e.cfg({ routing: { ...routingOn(["website"]), website: { enabled: true, routes: [{ ...ROUTES.website[0], agentId: "someone_else" }] } } });
  await e.process();
  assert.equal(e.sent[0].body.auto_call, false);
  e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  e.cfg({ routing: { ...routingOn(["website"]), website: { enabled: true, routes: [] } } });
  await e.process();
  assert.equal(e.sent[0].body.auto_call, false);
});
test("a lead queued without a call is never upgraded into one", async () => {
  const e = env({ cfg: { routing: routingOn([]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  e.cfg({ routing: routingOn(["website"]) });
  await e.process();
  assert.equal(e.sent[0].body.auto_call, false);
  assert.ok(!("agent_id" in e.sent[0].body));
});
test("an unchanged route still calls at send time", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.deepEqual([e.sent[0].body.auto_call, e.sent[0].body.agent_id], [true, "agent_khopoli"]);
});

// ═══ Vistrow accepts the Contact but declines the call ════════════════════
test("ok:true with queued:false is delivered (retry-safe) but flagged, for a lead we asked to call", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, respond: () => ({ httpStatus: 200, json: { ok: true, queued: false, reason: "no_caller_number" }, latencyMs: 5 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.deepEqual([e.d().status, e.d().callQueued], ["delivered", false]);
  assert.equal(e.d().callReason, "no_caller_number");
  const integ = e.store.integrations.get(ORG);
  assert.equal(integ.lastWarning.code, "CALL_NOT_QUEUED");
  assert.deepEqual(e.notified.map((n) => n.code), ["CALL_NOT_QUEUED"]);
  assert.equal(e.sent.length, 1, "no retry: it was accepted");
});
test("a later queued call clears the warning", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  e.setRespond(() => ({ httpStatus: 200, json: { ok: true, queued: false, reason: "x" }, latencyMs: 5 }));
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.ok(e.store.integrations.get(ORG).lastWarning);
  e.setRespond(() => ({ httpStatus: 200, json: { ok: true, queued: true }, latencyMs: 5 }));
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.equal(e.store.integrations.get(ORG).lastWarning, undefined);
});
test("queued:false for a Contact-only lead is expected and raises nothing", async () => {
  const e = env({ cfg: { routing: routingOn([]) }, respond: () => ({ httpStatus: 200, json: { ok: true, queued: false, reason: "contact_only" }, latencyMs: 5 }) });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.equal(e.d().status, "delivered");
  assert.equal(e.store.integrations.get(ORG).lastWarning, undefined);
  assert.equal(e.notified.length, 0);
});

// ═══ never blocks lead creation ═══════════════════════════════════════════
test("enqueue never throws, even if the store is down, and reports only an error class", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  e.store.getIntegration = async () => { const x = new Error("connect ECONNREFUSED 10.0.0.5:27017 for asha@example.com"); x.code = "ECONNREFUSED"; throw x; };
  const r = await e.svc.enqueueLeadCreated(lead(e), WEB);
  assert.deepEqual([r.queued, r.reason], [false, "error"]);
  const text = e.logs.join("\n");
  assert.ok(text.includes("Error:ECONNREFUSED"));
  assert.ok(!text.includes("asha@example.com") && !text.includes("10.0.0.5"));
});
test("a store failure while inserting is contained too", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  e.store.insertDelivery = async () => { throw new Error("disk full"); };
  assert.equal((await e.svc.enqueueLeadCreated(lead(e), WEB)).reason, "error");
});
test("enqueue returns without waiting for the network", async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const e = env({ cfg: { routing: routingOn(["website"]) }, autoKick: true, respond: async () => { await gate; return { httpStatus: 200, json: { ok: true }, latencyMs: 5 }; } });
  const r = await e.svc.enqueueLeadCreated(lead(e), WEB);          // resolves while the send is still held open
  assert.equal(r.queued, true);
  assert.notEqual(e.d().status, "delivered");
  release();
  await e.svc.drain();
  assert.equal(e.d().status, "delivered"); assert.equal(e.sent.length, 1);
});
test("a malformed lead cannot throw out of enqueue", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  for (const bad of [null, undefined, {}, { _id: "x" }, 5]) assert.equal((await e.svc.enqueueLeadCreated(bad, WEB)).queued, false);
});

// ═══ credentials and PII stay out of logs, URLs and stored errors ═════════
test("no name, phone, email, requirements or credential reaches the logs or stored errors", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const secretEcho = `bad token ${SECRET} for Asha Menon asha@example.com`;
  const l1 = lead(e);
  e.setRespond((n) => (n === 1 ? { httpStatus: 200, json: { ok: false, reason: secretEcho }, latencyMs: 5 } : { httpStatus: 503, json: { reason: secretEcho }, latencyMs: 5 }));
  await e.svc.enqueueLeadCreated(l1, WEB);
  await e.svc.enqueueLeadCreated(lead(e), WEB);
  await e.process();
  e.clock.t = new Date(e.d(1).nextAttemptAt); await e.process();
  // Logs, plus every field that records a failure. (phoneKey is deliberately stored: it is how the
  // repeat-phone window matches, and is purged with the job.)
  const errorFields = e.store.deliveries.map((d) => [d.lastErrorCode, d.lastErrorMessage, d.callReason, d.skipReason, d.autoCallReason]);
  const integ = e.store.integrations.get(ORG);
  const haystack = [e.logs.join("\n"), JSON.stringify(errorFields), JSON.stringify(integ.lastError), JSON.stringify(integ.lastWarning || null)].join("\n");
  for (const leak of [SECRET, "Asha Menon", "asha@example.com", l1.phone, "near the lake", "9876"]) assert.ok(!haystack.includes(leak), `leaked: ${leak}`);
  assert.ok(haystack.includes("OK_FALSE"));
});
test("the credential travels in a header only, never in the URL", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  const s = e.sent[0];
  assert.ok(!s.url.includes(SECRET) && !s.url.includes("?"));
  assert.equal(s.headers["X-Vistrow-Webhook-Token"], SECRET);
  assert.equal(s.url, "https://api.vistrowvoice.com/leads/inbound/acct_1");
});
test("bearer mode keeps the credential out of the URL too", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]), authMode: "bearer" } });
  await e.svc.enqueueLeadCreated(lead(e), WEB); await e.process();
  assert.equal(e.sent[0].headers.Authorization, `Bearer ${SECRET}`);
  assert.ok(!e.sent[0].url.includes(SECRET));
});
test("the stored job payload is not the lead's raw document", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  await e.svc.enqueueLeadCreated(lead(e, { notes: [{ text: "internal note" }], activities: [{ description: "x" }], createdBy: "u1" }), WEB);
  const text = JSON.stringify(e.d().payload);
  for (const k of ["internal note", "activities", "createdBy"]) assert.ok(!text.includes(k), k);
});

// ═══ owner test / dry run ═════════════════════════════════════════════════
const cfgFor = (e) => ({ id: "int", orgId: ORG, ...e.store.integrations.get(ORG) });
test("dry run builds and validates the exact request for a synthetic lead and sends nothing", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) } });
  const r = await e.svc.runTest(cfgFor(e), { mode: "dry_run" });
  assert.deepEqual([r.ok, r.sent, r.mode], [true, false, "dry_run"]);
  assert.equal(e.sent.length, 0); assert.equal(e.store.deliveries.length, 0);
  assert.equal(r.request.url, "https://api.vistrowvoice.com/leads/inbound/acct_1");
  assert.equal(r.request.headers["X-Vistrow-Webhook-Token"], "[REDACTED]");
  assert.equal(r.request.headers["X-ArthaLeads-Signature"], "[REDACTED]");
  assert.ok(!JSON.stringify(r).includes(SECRET));
  assert.equal(r.request.body.test, true); assert.equal(r.request.body.auto_call, false); assert.ok(!("agent_id" in r.request.body));
});
test("dry run reports configuration problems instead of building a request", async () => {
  const e = env({ cfg: { baseUrl: "http://api.vistrowvoice.com", accountId: "a b", secret: "" } });
  const r = await e.svc.runTest(cfgFor(e), { mode: "dry_run" });
  assert.equal(r.ok, false); assert.ok(r.problems.length >= 3); assert.equal(e.sent.length, 0);
});
test("sending a test event is refused unless the server operator allowed it", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, allowTest: false });
  const r = await e.svc.runTest(cfgFor(e), { mode: "send" });
  assert.deepEqual([r.ok, r.sent], [false, false]);
  assert.equal(e.sent.length, 0); assert.equal(e.store.deliveries.length, 0);
});
test("an allowed test send transmits only a flagged synthetic event, never asks for a call, and is kept out of health stats", async () => {
  const e = env({ cfg: { routing: routingOn(["website", "facebook", "whatsapp"]) }, allowTest: true });
  const r = await e.svc.runTest(cfgFor(e), { mode: "send" });
  assert.deepEqual([r.ok, r.sent, r.httpStatus], [true, true, 200]);
  assert.equal(e.sent.length, 1);
  const s = e.sent[0];
  assert.equal(s.headers["X-ArthaLeads-Test"], "1");
  assert.equal(s.body.test, true); assert.equal(s.body.phone, "+15555550100");
  assert.equal(s.body.auto_call, false); assert.ok(!("agent_id" in s.body));
  assert.equal(e.store.deliveries.length, 1); assert.equal(e.d().isTest, true);
  const integ = e.store.integrations.get(ORG);
  assert.equal(integ.lastSuccessAt, undefined); assert.equal(integ.lastError, undefined);
  assert.equal(e.notified.length, 0);
});
test("a failed test send reports why, without raising an alert or touching health", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, allowTest: true, respond: () => ({ httpStatus: 200, json: { ok: false, reason: "bad_token" }, latencyMs: 5 }) });
  const r = await e.svc.runTest(cfgFor(e), { mode: "send" });
  assert.deepEqual([r.ok, r.code, r.message], [false, "OK_FALSE", "bad_token"]);
  assert.equal(e.notified.length, 0);
  assert.equal(e.store.integrations.get(ORG).lastFailureAt, undefined);
});
test("test events never suppress a real lead through the repeat-phone window", async () => {
  const e = env({ cfg: { routing: routingOn(["website"]) }, allowTest: true });
  await e.svc.runTest(cfgFor(e), { mode: "send" });
  await e.svc.enqueueLeadCreated(lead(e, { phone: "5555550100" }), WEB);   // not dialable anyway
  const phone = newPhone();
  await e.svc.enqueueLeadCreated(lead(e, { phone }), WEB); await e.process();
  assert.equal(e.sent.at(-1).body.auto_call, true);
});

run("Vistrow outbound - delivery service (routing, idempotency, retry, safety)");
