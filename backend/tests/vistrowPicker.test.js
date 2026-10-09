// Read-only picker data for Vistrow: tenant-scoped by token, header-only auth,
// Vistrow-Voice token only, Enterprise only, nothing written, no secrets.

const { test, run, assert } = require("./helpers/harness");
const http = require("http");
const express = require("express");

const stub = (rel, exports) => { const id = require.resolve(rel); require.cache[id] = { id, filename: id, loaded: true, exports }; };
const ORG_A = "64b0000000000000000000a1";
const ORG_B = "64b0000000000000000000b2";
const world = { autos: [], projects: [], plan: "enterprise", queries: [], writes: 0, opts: null };

stub("../models/Automation", { findOne: (q) => { world.queries.push(["automation", q]); return { select: () => ({ lean: async () => world.autos.find((a) => a.platform === q.platform && a.verifyToken === q.verifyToken && q.isActive === true && a.isActive) || null }) }; }, create: () => { world.writes++; }, updateOne: () => { world.writes++; } });
stub("../models/Project", { find: (q) => { world.queries.push(["project", q]); return { select: () => ({ sort: () => ({ limit: () => ({ lean: async () => world.projects.filter((p) => String(p.orgId) === String(q.orgId) && !p.isArchived) }) }) }) }; }, create: () => { world.writes++; } });
stub("../models/Organization", { findById: () => ({ select: () => ({ lean: async () => ({ plan: world.plan }) }) }) });
stub("../middlewares/planGate", { levelOf: (p) => (p === "enterprise" ? 3 : 1) });
stub("../services/leadService", { getCampaignOptions: async (u) => { world.queries.push(["campaigns", u]); return world.opts[String(u.orgId)] || { facebook: {}, whatsapp: {}, google: {} }; } });

const reset = () => {
  world.autos = [
    { platform: "Vistrow Voice", verifyToken: "tok-vistrow-A", orgId: ORG_A, isActive: true },
    { platform: "Vistrow Voice", verifyToken: "tok-vistrow-B", orgId: ORG_B, isActive: true },
    { platform: "Website Form", verifyToken: "tok-website-A", orgId: ORG_A, isActive: true },
    { platform: "Vistrow Voice", verifyToken: "tok-off", orgId: ORG_A, isActive: false },
  ];
  world.projects = [
    { _id: "64b0000000000000000000e1", name: "SP Khopoli", location: "Khopoli", orgId: ORG_A, isArchived: false },
    { _id: "64b0000000000000000000e2", name: "Old Project", orgId: ORG_A, isArchived: true },
    { _id: "64b0000000000000000000e3", name: "Other Org Tower", orgId: ORG_B, isArchived: false },
  ];
  world.opts = {
    [ORG_A]: { facebook: { campaign_id: [{ value: "23851", label: "Khopoli Launch", count: 9 }, { value: "99887766", label: "99887766", count: 2 }] }, whatsapp: { ad_id: [{ value: "1202", label: "900+ Acre New Launch", count: 28 }] }, google: { campaign_id: [{ value: "555", label: "Search - Khopoli", count: 3 }] } },
    [ORG_B]: { facebook: { campaign_id: [{ value: "B-ONLY", label: "Other org campaign", count: 1 }] }, whatsapp: {}, google: {} },
  };
  world.plan = "enterprise"; world.queries = []; world.writes = 0;
};

const app = express();
app.use("/webhook/vistrow", require("../routes/vistrowPickerRoutes"));
let base;
const get = async (headers = {}, qs = "") => { const r = await fetch(`${base}/webhook/vistrow/picker-options${qs}`, { headers }); const text = await r.text(); return { status: r.status, text, json: JSON.parse(text) }; };
const bearer = (t) => ({ authorization: `Bearer ${t}` });

test("projects: only the token's own org, active only, name-sorted shape; archived and other orgs never appear", async () => {
  reset();
  const r = await get(bearer("tok-vistrow-A"));
  assert.equal(r.status, 200); assert.equal(r.json.ok, true); assert.equal(r.json.org_id, ORG_A);
  assert.deepEqual(r.json.projects, [{ id: "64b0000000000000000000e1", name: "SP Khopoli", location: "Khopoli" }]);
  assert.ok(!r.text.includes("Old Project") && !r.text.includes("Other Org Tower") && !r.text.includes("B-ONLY"));
});
test("campaigns: real sources only, named from what ArthaLeads stored, with a readable fallback", async () => {
  reset();
  const r = await get(bearer("tok-vistrow-A"));
  assert.deepEqual(r.json.campaigns.map((c) => [c.source, c.id, c.name, c.leads]), [
    ["facebook_campaign", "23851", "Khopoli Launch", 9],
    ["facebook_campaign", "99887766", "Facebook campaign …7766", 2],
    ["whatsapp_ad", "1202", "900+ Acre New Launch", 28],
    ["google_campaign", "555", "Search - Khopoli", 3],
  ]);
});
test("tenant scope comes from the token: org B's token returns org B's data only", async () => {
  reset();
  const r = await get(bearer("tok-vistrow-B"));
  assert.equal(r.json.org_id, ORG_B);
  assert.deepEqual(r.json.projects.map((p) => p.name), ["Other Org Tower"]);
  assert.deepEqual(r.json.campaigns.map((c) => c.id), ["B-ONLY"]);
  for (const [, q] of world.queries) assert.ok(String(q.orgId ?? ORG_B) === ORG_B || q.platform, "queries are scoped to the token's org");
});
test("the X-ArthaLeads-Token header works too", async () => {
  reset();
  assert.equal((await get({ "x-arthaleads-token": "tok-vistrow-A" })).status, 200);
});
test("a token in the URL is refused (and not echoed); no token, a wrong token and an inactive connection are 401", async () => {
  reset();
  const u = await get({}, "?token=tok-vistrow-A");
  assert.equal(u.status, 400); assert.equal(u.json.reason, "token_in_url"); assert.ok(!u.text.includes("tok-vistrow-A"));
  assert.equal((await get()).status, 401);
  assert.equal((await get(bearer("nope"))).status, 401);
  assert.equal((await get(bearer("tok-off"))).status, 401);
});
test("only the Vistrow Voice connection can read it: a Website Form token is refused", async () => {
  reset();
  const r = await get(bearer("tok-website-A"));
  assert.equal(r.status, 401); assert.equal(r.json.reason, "invalid_token");
});
test("Enterprise only, like /webhook/lead", async () => {
  reset(); world.plan = "pro";
  const r = await get(bearer("tok-vistrow-A"));
  assert.equal(r.status, 403); assert.equal(r.json.reason, "plan");
});
test("read-only and credential-free: nothing is written, and the response holds no token or settings", async () => {
  reset();
  const r = await get(bearer("tok-vistrow-A"));
  assert.equal(world.writes, 0);
  assert.ok(!r.text.includes("tok-vistrow") && !/secret|verifyToken|enabled|agent/i.test(r.text));
  assert.deepEqual(Object.keys(r.json).sort(), ["campaigns", "ok", "org_id", "projects"]);
  assert.equal(r.status, 200);
});
test("responses are not cacheable and the route is GET-only", async () => {
  reset();
  const ok = await fetch(`${base}/webhook/vistrow/picker-options`, { headers: bearer("tok-vistrow-A") });
  assert.equal(ok.headers.get("cache-control"), "no-store");
  const post = await fetch(`${base}/webhook/vistrow/picker-options`, { method: "POST", headers: bearer("tok-vistrow-A") });
  assert.equal(post.status, 404);
});

const server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; run("Vistrow picker options (tenant-scoped, read-only)"); });
