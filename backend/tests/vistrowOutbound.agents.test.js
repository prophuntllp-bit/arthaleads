// The agent picker: names come from Vistrow's live list, the raw agent id never
// reaches the browser, and nothing here can place a call or contact Vistrow
// (the HTTP transport is replaced by a recording stub).

const { test, run, assert } = require("./helpers/harness");
const http = require("http");
const express = require("express");

const stubModule = (rel, exports) => { const id = require.resolve(rel); require.cache[id] = { id, filename: id, loaded: true, exports }; };
const ORG = "64b0000000000000000000a1";
const KHOPOLI = "64b0000000000000000000e1";

// ── in-memory integration document ──────────────────────────────────────────
const fresh = () => ({
  baseUrl: "https://api.vistrowvoice.com", accountId: "acct_123", authMode: "header", secretEnc: "enc1:x",
  enabled: false, enabledAt: null,
  routing: { website: { enabled: false, routes: [] }, facebook: { enabled: false, routes: [] }, whatsapp: { enabled: false, routes: [] } },
  getSecret() { return "super-secret-connection-key-0001"; }, markModified() {},
  async save() { let n = 0; for (const k of Object.keys(this.routing)) this.routing[k].routes.forEach((r) => { if (!r._id) r._id = `64c00000000000000000${String(++n + Date.now() % 1000).padStart(4, "0")}`.slice(0, 24); }); },
});
const world = { doc: fresh(), calls: [], reply: null };

stubModule("../middlewares/auth", { protect: (req, _res, next) => { req.user = { _id: "u1", orgId: ORG, name: "Owner" }; next(); }, authorize: () => (_q, _s, next) => next() });
stubModule("../models/OutboundIntegration", { findOne: () => ({ select: async () => world.doc }) });
stubModule("../models/OutboundDelivery", { aggregate: async () => [], countDocuments: async () => 0, find: () => ({ select: () => ({ limit: () => ({ lean: async () => [] }) }), sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
stubModule("../models/Project", { find: () => ({ select: () => ({ lean: async () => [{ _id: KHOPOLI, name: "SP Khopoli" }] }) }) });
stubModule("../services/vistrowOutbound", { service: { configProblems: () => [], runTest: async () => ({}) } });
stubModule("../services/vistrowOutbound/store.mongo", { mongoStore: { cancelPending: async () => 0 }, toConfig: (d) => d });

const T = require("../services/vistrowOutbound/transport");
T.httpSend = async (req) => { world.calls.push(req); return world.reply(req); };

const A = [
  { id: "ag_khopoli_1", name: "Siya KHOPOLI", knowledge_base: "SP Khopoli KB" },
  { id: "ag_plots_2", name: "Plots agent", knowledge_base: "Plots KB" },
];
const ok = (agents) => ({ httpStatus: 200, json: { agents }, latencyMs: 5 });

const app = express();
app.use(express.json());
app.use("/v", require("../routes/vistrowOutboundRoutes"));
let base;
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, text, json: JSON.parse(text) };
};
const reset = (reply = () => ok(A)) => { world.doc = fresh(); world.calls = []; world.reply = reply; };
const RAW_IDS = ["ag_khopoli_1", "ag_plots_2"];
const noRawIds = (t) => RAW_IDS.forEach((id) => assert.ok(!t.includes(id), `raw agent id ${id} leaked`));

test("loading: the list is fetched with GET, the key only in a header, and has names + knowledge bases", async () => {
  reset();
  const r = await call("GET", "/v/agents");
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.agents.map((a) => [a.name, a.knowledgeBase]), [["Plots agent", "Plots KB"], ["Siya KHOPOLI", "SP Khopoli KB"]]);
  const c = world.calls[0];
  assert.equal(c.method, "GET");
  assert.equal(c.url, "https://api.vistrowvoice.com/leads/inbound/acct_123/agents");
  assert.ok(!c.url.includes("super-secret") && !c.url.includes("?"));
  assert.equal(c.headers["X-Vistrow-Webhook-Token"], "super-secret-connection-key-0001");
  assert.equal(world.calls.length, 1);
});
test("hidden id: the response carries only name, knowledge base and an opaque ref", async () => {
  reset();
  const r = await call("GET", "/v/agents");
  noRawIds(r.text);
  assert.deepEqual(Object.keys(r.json.agents[0]).sort(), ["knowledgeBase", "name", "ref"]);
  assert.ok(!r.text.includes("super-secret"));
});
test("bearer mode sends Authorization instead; still not in the URL", async () => {
  reset(); world.doc.authMode = "bearer";
  await call("GET", "/v/agents");
  assert.equal(world.calls[0].headers.Authorization, "Bearer super-secret-connection-key-0001");
  assert.ok(!world.calls[0].url.includes("super-secret"));
});
test("agents without a name, a knowledge base, or a safe id are not offered; duplicates collapse", async () => {
  reset(() => ok([...A, { id: "x1", name: "No KB", knowledge_base: "" }, { id: "x2", name: "", knowledge_base: "KB" }, { id: "bad id!", name: "Bad", knowledge_base: "KB" }, A[0], { id: "obj", name: "Obj KB", knowledge_base: { name: "Named KB" } }]));
  const r = await call("GET", "/v/agents");
  assert.deepEqual(r.json.agents.map((a) => a.name), ["Obj KB", "Plots agent", "Siya KHOPOLI"]);
});
test("errors are explained in plain language and never leak the key or ids", async () => {
  const cases = [
    [{ httpStatus: 401, json: { detail: "bad token super-secret-connection-key-0001" } }, "key_rejected", /connection key/],
    [{ httpStatus: 404, json: null }, "not_found", /account number/],
    [{ httpStatus: 503, json: null }, "unreachable", /Could not reach Vistrow/],
    [{ httpStatus: 0, json: null, errorCode: "TIMEOUT" }, "unreachable", /Try again/],
    [{ httpStatus: 200, json: { agents: [] } }, "no_agents", /knowledge base/],
    [{ httpStatus: 200, json: { nope: true } }, "bad_response", /could not read/],
  ];
  for (const [reply, code, text] of cases) {
    reset(() => reply);
    const r = await call("GET", "/v/agents");
    assert.equal(r.status, 200);
    assert.equal(r.json.problem.code, code);
    assert.match(r.json.problem.message, text);
    assert.deepEqual(r.json.agents, []);
    assert.ok(!r.text.includes("super-secret") && !/detail|token/i.test(r.json.problem.message));
  }
});
test("no connection saved yet: explains what to do and contacts nobody", async () => {
  reset(); world.doc.secretEnc = "";
  const r = await call("GET", "/v/agents");
  assert.equal(r.json.problem.code, "not_ready");
  assert.equal(world.calls.length, 0);
});

test("selection: a chosen ref is stored under the hood as the real id, with name and knowledge base", async () => {
  reset();
  const list = (await call("GET", "/v/agents")).json.agents;
  const siya = list.find((a) => a.name === "Siya KHOPOLI");
  const r = await call("PUT", "/v/routing", { website: { enabled: true, routes: [{ matchKind: "url_contains", matchValue: "/shapoorji-pallonji-khopoli/", agentRef: siya.ref }] }, confirm: true });
  assert.equal(r.status, 200, r.text);
  const row = world.doc.routing.website.routes[0];
  assert.equal(row.agentId, "ag_khopoli_1");
  assert.equal(row.agentLabel, "Siya KHOPOLI");
  assert.equal(row.agentKb, "SP Khopoli KB");
  noRawIds(r.text);
  const shown = r.json.status.routing.website.routes[0];
  assert.equal(shown.agentLabel, "Siya KHOPOLI"); assert.equal(shown.agentKb, "SP Khopoli KB"); assert.equal(shown.agentRef, siya.ref); assert.ok(!("agentId" in shown));
});
test("editing a row without touching its agent keeps it; choosing 'no agent' clears it", async () => {
  reset();
  const list = (await call("GET", "/v/agents")).json.agents;
  const plots = list.find((a) => a.name === "Plots agent");
  await call("PUT", "/v/routing", { website: { enabled: true, routes: [{ matchKind: "url_contains", matchValue: "/treetopia/", agentRef: plots.ref }] }, confirm: true });
  const id = world.doc.routing.website.routes[0]._id;
  await call("PUT", "/v/routing", { website: { routes: [{ _id: id, matchKind: "url_contains", matchValue: "/treetopia/" }] } });
  assert.equal(world.doc.routing.website.routes[0].agentId, "ag_plots_2", "kept");
  const r = await call("PUT", "/v/routing", { website: { routes: [{ _id: id, matchKind: "url_contains", matchValue: "/treetopia/", agentRef: "" }] } });
  assert.equal(world.doc.routing.website.routes[0].agentId, "", "cleared");
  assert.equal(r.json.status.routing.website.routes[0].unassigned, true);
});
test("an unknown or stale ref is refused with a plain message and saves nothing", async () => {
  reset();
  const r = await call("PUT", "/v/routing", { website: { routes: [{ matchKind: "url_contains", matchValue: "/treetopia/", agentRef: "a".repeat(24) }] } });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /no longer available.*Refresh/);
  assert.equal(world.doc.routing.website.routes.length, 0);
  const bad = await call("PUT", "/v/routing", { website: { routes: [{ matchKind: "url_contains", matchValue: "/treetopia/", agentRef: "not-a-ref" }] } });
  assert.equal(bad.status, 400); assert.match(bad.json.message, /choose an agent from the list/);
});
test("if Vistrow cannot be reached while saving a choice, the owner is told why and nothing is saved", async () => {
  reset(() => ({ httpStatus: 401, json: null }));
  const r = await call("PUT", "/v/routing", { website: { routes: [{ matchKind: "url_contains", matchValue: "/treetopia/", agentRef: "b".repeat(24) }] } });
  assert.equal(r.status, 400); assert.match(r.json.message, /connection key/);
  assert.equal(world.doc.routing.website.routes.length, 0);
});
test("choosing agents changes no switch: every source stays off and the integration stays off", async () => {
  reset();
  const list = (await call("GET", "/v/agents")).json.agents;
  const r = await call("PUT", "/v/routing", { website: { routes: [{ matchKind: "url_contains", matchValue: "/treetopia/", agentRef: list[0].ref }] } });
  assert.equal(r.status, 200);
  for (const k of ["website", "facebook", "whatsapp"]) assert.equal(r.json.status.routing[k].enabled, false);
  assert.equal(r.json.status.enabled, false);
});
test("'Check a lead' and status never show the raw id", async () => {
  reset();
  const list = (await call("GET", "/v/agents")).json.agents;
  await call("PUT", "/v/routing", { website: { enabled: true, routes: [{ matchKind: "url_contains", matchValue: "/treetopia/", agentRef: list[0].ref }] }, confirm: true });
  const sim = await call("POST", "/v/simulate", { source: "website", pageUrl: "https://x.com/treetopia/" });
  assert.equal(sim.json.decision.autoCall, true);
  noRawIds(sim.text);
  noRawIds((await call("GET", "/v/")).text);
});
test("the agent list request can never be a lead.created or place a call: only GET .../agents is used", async () => {
  reset();
  await call("GET", "/v/agents");
  await call("POST", "/v/simulate", { source: "website", pageUrl: "x" });
  assert.ok(world.calls.every((c) => c.method === "GET" && c.url.endsWith("/agents") && c.body === undefined));
});

const server = http.createServer(app).listen(0, () => {
  base = `http://127.0.0.1:${server.address().port}`;
  const done = run("Vistrow outbound - agent picker (names, hidden ids, errors)");
});
