// GET /webhook/lead/projects: the read-only project list for Vistrow's picker.
// Tenant from the connection token (header only), Vistrow Voice token only,
// Enterprise only, active projects only, nothing written. All models are mocked;
// no database, no network, no calls.

const { test, run, assert } = require("./helpers/harness");
const http = require("http");
const express = require("express");

const stub = (rel, exports) => { const id = require.resolve(rel); require.cache[id] = { id, filename: id, loaded: true, exports }; };
const ORG_A = "64b0000000000000000000a1";
const ORG_B = "64b0000000000000000000b2";
const world = { autos: [], projects: [], plan: "enterprise", queries: [], writes: 0, postHits: 0 };

stub("../models/Automation", {
  findOne: (q) => { world.queries.push(["automation", q]); return { select: () => ({ lean: async () => world.autos.find((a) => a.platform === q.platform && a.verifyToken === q.verifyToken && q.isActive === true && a.isActive) || null }) }; },
  create: () => { world.writes++; }, updateOne: () => { world.writes++; }, findOneAndUpdate: () => { world.writes++; },
});
stub("../models/Project", {
  find: (q) => { world.queries.push(["project", q]); return { select: () => ({ sort: () => ({ limit: () => ({ lean: async () => world.projects.filter((p) => String(p.orgId) === String(q.orgId) && (q.isArchived?.$ne === undefined || p.isArchived !== q.isArchived.$ne)).sort((a, b) => a.name.localeCompare(b.name)) }) }) }) }; },
  create: () => { world.writes++; }, updateOne: () => { world.writes++; },
});
stub("../models/Organization", { findById: () => ({ select: () => ({ lean: async () => ({ plan: world.plan }) }) }) });
stub("../middlewares/planGate", { levelOf: (p) => (p === "enterprise" ? 3 : 1) });

const reset = () => {
  world.autos = [
    { platform: "Vistrow Voice", verifyToken: "tok-vistrow-A", orgId: ORG_A, isActive: true },
    { platform: "Vistrow Voice", verifyToken: "tok-vistrow-B", orgId: ORG_B, isActive: true },
    { platform: "Website Form", verifyToken: "tok-website-A", orgId: ORG_A, isActive: true },
    { platform: "Custom", verifyToken: "tok-custom-A", orgId: ORG_A, isActive: true },
    { platform: "Vistrow Voice", verifyToken: "tok-off", orgId: ORG_A, isActive: false },
  ];
  world.projects = [
    { _id: "64b0000000000000000000e2", name: "Treetopia", orgId: ORG_A, isArchived: false, location: "secret-location", description: "internal notes" },
    { _id: "64b0000000000000000000e1", name: "SP Khopoli", orgId: ORG_A, isArchived: false },
    { _id: "64b0000000000000000000e4", name: "Old Project", orgId: ORG_A, isArchived: true },
    { _id: "64b0000000000000000000e5", name: "Never archived field", orgId: ORG_A },
    { _id: "64b0000000000000000000e3", name: "Other Org Tower", orgId: ORG_B, isArchived: false },
  ];
  world.plan = "enterprise"; world.queries = []; world.writes = 0; world.postHits = 0;
};

const app = express();
app.use("/webhook/lead", require("../routes/vistrowPickerRoutes"));
// stands in for the existing POST /webhook/lead handler, to prove it is not shadowed
app.post("/webhook/lead", (_req, res) => { world.postHits++; res.json({ ok: "existing-handler" }); });
let base;
const H = "x-arthaleads-connection-token";
const get = async (headers = {}, qs = "") => { const r = await fetch(`${base}/webhook/lead/projects${qs}`, { headers }); const text = await r.text(); return { status: r.status, text, json: JSON.parse(text), headers: r.headers }; };

test("response shape is exactly { ok:true, projects:[{id,name}] }", async () => {
  reset();
  const r = await get({ [H]: "tok-vistrow-A" });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json).sort(), ["ok", "projects"]);
  assert.equal(r.json.ok, true);
  for (const p of r.json.projects) assert.deepEqual(Object.keys(p).sort(), ["id", "name"]);
});
test("only active projects, A-Z, with a stable id and display name; archived and other orgs never appear", async () => {
  reset();
  const r = await get({ [H]: "tok-vistrow-A" });
  assert.deepEqual(r.json.projects, [
    { id: "64b0000000000000000000e5", name: "Never archived field" },
    { id: "64b0000000000000000000e1", name: "SP Khopoli" },
    { id: "64b0000000000000000000e2", name: "Treetopia" },
  ]);
  assert.ok(!r.text.includes("Old Project") && !r.text.includes("Other Org Tower"));
  const q = world.queries.find(([k]) => k === "project")[1];
  assert.deepEqual(q, { orgId: ORG_A, isArchived: { $ne: true } }, "same filter as the CRM's active-project source");
});
test("nothing beyond id and name leaks (no location, description, org id or token)", async () => {
  reset();
  const r = await get({ [H]: "tok-vistrow-A" });
  assert.ok(!/secret-location|internal notes|tok-vistrow|org_id|orgId/.test(r.text));
});
test("tenant comes from the token: org B's token returns only org B's projects", async () => {
  reset();
  const r = await get({ [H]: "tok-vistrow-B" });
  assert.deepEqual(r.json.projects, [{ id: "64b0000000000000000000e3", name: "Other Org Tower" }]);
});
test("auth: missing, unknown and inactive tokens are 401 and reveal nothing", async () => {
  reset();
  for (const [h, reason] of [[{}, "missing_token"], [{ [H]: "nope" }, "invalid_token"], [{ [H]: "tok-off" }, "invalid_token"]]) {
    const r = await get(h);
    assert.equal(r.status, 401); assert.equal(r.json.reason, reason); assert.equal(r.json.ok, false);
    assert.equal(r.json.projects, undefined);
  }
});
test("auth: a wrong-platform token (Website Form, Custom) is refused", async () => {
  reset();
  for (const t of ["tok-website-A", "tok-custom-A"]) { const r = await get({ [H]: t }); assert.equal(r.status, 401); assert.equal(r.json.reason, "invalid_token"); }
});
test("auth: the token is never accepted in the URL (and not echoed); Authorization/Bearer is not accepted either", async () => {
  reset();
  for (const qs of ["?token=tok-vistrow-A", "?connection_token=tok-vistrow-A"]) {
    const r = await get({}, qs);
    assert.equal(r.status, 400); assert.equal(r.json.reason, "token_in_url"); assert.ok(!r.text.includes("tok-vistrow-A"));
  }
  assert.equal((await get({ [H]: "tok-vistrow-A" }, "?token=tok-vistrow-A")).status, 400, "even alongside a valid header");
  assert.equal((await get({ authorization: "Bearer tok-vistrow-A" })).status, 401);
});
test("Enterprise only, like /webhook/lead", async () => {
  reset(); world.plan = "pro";
  const r = await get({ [H]: "tok-vistrow-A" });
  assert.equal(r.status, 403); assert.equal(r.json.reason, "plan"); assert.equal(r.json.projects, undefined);
});
test("read-only: nothing is written, nothing is cached, and the route is GET-only", async () => {
  reset();
  const r = await get({ [H]: "tok-vistrow-A" });
  assert.equal(world.writes, 0);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const post = await fetch(`${base}/webhook/lead/projects`, { method: "POST", headers: { [H]: "tok-vistrow-A" } });
  assert.equal(post.status, 404);
});
test("the existing POST /webhook/lead is untouched: it still reaches its own handler", async () => {
  reset();
  const r = await fetch(`${base}/webhook/lead`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal((await r.json()).ok, "existing-handler");
  assert.equal(world.postHits, 1);
});
test("it only reads projects and the connection: no auto-call switch or integration setting is touched", async () => {
  reset();
  await get({ [H]: "tok-vistrow-A" });
  assert.deepEqual([...new Set(world.queries.map(([k]) => k))].sort(), ["automation", "project"]);
  assert.equal(world.writes, 0);
});

const server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; run("GET /webhook/lead/projects (tenant-scoped, read-only, project-only)"); });
