// Which Vistrow agent (if any) may call a lead. The owner's rule, as tests:
//   * every source is OFF until switched on;
//   * a call needs a matching route row that names an agent;
//   * the most specific matching row wins; ties between different agents refuse;
//   * no default agent, ever -- an unmatched lead is a Contact only.

const { test, run, assert } = require("./helpers/harness");
const R = require("../services/vistrowOutbound/routing");

const KHOPOLI = "64b0000000000000000000e1";
const OTHER = "64b0000000000000000000e2";

const cfg = (over = {}) => ({
  routing: {
    website: {
      enabled: true,
      routes: [
        { id: "w1", matchKind: "url_contains", matchValue: "/shapoorji-pallonji-khopoli/", agentId: "agent_khopoli", agentLabel: "Siya KHOPOLI" },
        { id: "w2", matchKind: "url_contains", matchValue: "/shapoorji-pallonji-khopoli/plots/", agentId: "agent_plots", agentLabel: "Plots agent" },
        { id: "w3", matchKind: "url_contains", matchValue: "/treetopia/", agentId: "", agentLabel: "" },
      ],
    },
    facebook: { enabled: true, routes: [{ id: "f1", matchKind: "project", matchValue: KHOPOLI, projectName: "SP Khopoli", agentId: "agent_khopoli", agentLabel: "Siya KHOPOLI" }] },
    whatsapp: {
      enabled: true,
      routes: [
        { id: "a1", matchKind: "ad_id", matchValue: "120252242040050286", agentId: "agent_ad", agentLabel: "Ad agent" },
        { id: "p1", matchKind: "project", matchValue: KHOPOLI, projectName: "SP Khopoli", agentId: "agent_proj", agentLabel: "Project agent" },
      ],
    },
    ...over,
  },
});
const off = () => cfg({
  website: { enabled: false, routes: cfg().routing.website.routes },
  facebook: { enabled: false, routes: cfg().routing.facebook.routes },
  whatsapp: { enabled: false, routes: cfg().routing.whatsapp.routes },
});
const web = (page) => ({ routeSource: "website", sourcePage: page, projectId: "", adId: "" });

// ── defaults: nothing calls until the owner opts in ────────────────────────
test("every source is OFF by default, even with matching rows", () => {
  const c = off();
  assert.equal(R.resolveRouting(c, web("https://x.com/shapoorji-pallonji-khopoli/")).reason, "source_disabled");
  assert.equal(R.resolveRouting(c, { routeSource: "facebook", projectId: KHOPOLI }).reason, "source_disabled");
  assert.equal(R.resolveRouting(c, { routeSource: "whatsapp", adId: "120252242040050286" }).reason, "source_disabled");
});
test("a configuration with no routing section at all calls nobody", () => {
  for (const c of [{}, { routing: {} }, null, undefined, { routing: { website: {} } }, { routing: { website: { routes: cfg().routing.website.routes } } }]) {
    const d = R.resolveRouting(c, web("https://x.com/shapoorji-pallonji-khopoli/"));
    assert.equal(d.autoCall, false);
    assert.equal(d.reason, "source_disabled");
  }
});
test("only enabled === true counts as on", () => {
  for (const v of ["true", 1, "yes", null, undefined]) {
    const c = cfg({ website: { enabled: v, routes: cfg().routing.website.routes } });
    assert.equal(R.resolveRouting(c, web("https://x.com/shapoorji-pallonji-khopoli/")).autoCall, false, String(v));
  }
});
test("switching one source on does not switch on the others", () => {
  const c = off();
  c.routing.website.enabled = true;
  assert.equal(R.resolveRouting(c, web("https://x.com/shapoorji-pallonji-khopoli/")).autoCall, true);
  assert.equal(R.resolveRouting(c, { routeSource: "facebook", projectId: KHOPOLI }).autoCall, false);
  assert.equal(R.resolveRouting(c, { routeSource: "whatsapp", adId: "120252242040050286" }).autoCall, false);
});
test("a source that is not Website / Facebook / WhatsApp is never called", () => {
  for (const src of ["", "google", "manual", "qr", "custom", undefined, "Website"]) {
    const d = R.resolveRouting(cfg(), { routeSource: src, sourcePage: "https://x.com/shapoorji-pallonji-khopoli/", projectId: KHOPOLI });
    assert.equal(d.autoCall, false, String(src));
    assert.equal(d.reason, "not_auto_source", String(src));
  }
});

// ── website: page/path match -> agent ──────────────────────────────────────
test("website: a page that contains the route's path goes to that route's agent", () => {
  const d = R.resolveRouting(cfg(), web("https://shaporjipallonji.com/shapoorji-pallonji-khopoli/"));
  assert.equal(d.autoCall, true);
  assert.equal(d.agentId, "agent_khopoli");
  assert.equal(d.agentLabel, "Siya KHOPOLI");
  assert.equal(d.route.label, "Page contains /shapoorji-pallonji-khopoli/");
});
test("website: the most specific (longest) matching path wins", () => {
  const d = R.resolveRouting(cfg(), web("https://x.com/shapoorji-pallonji-khopoli/plots/block-a"));
  assert.equal(d.agentId, "agent_plots");
});
test("website: matching ignores case, query string and fragment", () => {
  assert.equal(R.resolveRouting(cfg(), web("HTTPS://X.COM/Shapoorji-Pallonji-Khopoli/")).agentId, "agent_khopoli");
  assert.equal(R.resolveRouting(cfg(), web("https://x.com/shapoorji-pallonji-khopoli/?utm=1#top")).agentId, "agent_khopoli");
  // a path that only appears in the query string must not trigger a route
  const d = R.resolveRouting(cfg(), web("https://x.com/other/?next=/shapoorji-pallonji-khopoli/"));
  assert.equal(d.autoCall, false);
  assert.equal(d.reason, "no_route");
});
test("website: an unmatched page is a Contact only, with no default agent", () => {
  const d = R.resolveRouting(cfg(), web("https://x.com/some-other-project/"));
  assert.equal(d.autoCall, false);
  assert.equal(d.reason, "no_route");
  assert.ok(!("agentId" in d));
});
test("website: a lead with no page url matches nothing", () => {
  assert.equal(R.resolveRouting(cfg(), web("")).reason, "no_route");
});
test("website: a matching row with no agent ('Unassigned') does not call", () => {
  const d = R.resolveRouting(cfg(), web("https://x.com/treetopia/"));
  assert.equal(d.autoCall, false);
  assert.equal(d.reason, "agent_missing");
  assert.equal(d.route.label, "Page contains /treetopia/");
  assert.ok(!("agentId" in d));
});
test("website: two equally specific rows naming different agents refuse to choose", () => {
  const c = cfg({ website: { enabled: true, routes: [
    { id: "x1", matchKind: "url_contains", matchValue: "/aaa-bbb/", agentId: "agent_a" },
    { id: "x2", matchKind: "url_contains", matchValue: "/ccc-ddd/", agentId: "agent_b" },
  ] } });
  const d = R.resolveRouting(c, web("https://x.com/aaa-bbb/ccc-ddd/"));
  assert.equal(d.autoCall, false);
  assert.equal(d.reason, "ambiguous_route");
});
test("website: an equally specific tie that names the SAME agent is fine", () => {
  const c = cfg({ website: { enabled: true, routes: [
    { id: "x1", matchKind: "url_contains", matchValue: "/aaa-bbb/", agentId: "agent_a" },
    { id: "x2", matchKind: "url_contains", matchValue: "/ccc-ddd/", agentId: "agent_a" },
  ] } });
  assert.equal(R.resolveRouting(c, web("https://x.com/aaa-bbb/ccc-ddd/")).agentId, "agent_a");
});
test("website: a project does not route a website lead (only page rules do)", () => {
  const d = R.resolveRouting(cfg(), { routeSource: "website", sourcePage: "https://x.com/none/", projectId: KHOPOLI });
  assert.equal(d.autoCall, false);
});

// ── facebook: project match -> agent ───────────────────────────────────────
test("facebook: a lead associated with a mapped project goes only to that project's agent", () => {
  const d = R.resolveRouting(cfg(), { routeSource: "facebook", projectId: KHOPOLI });
  assert.equal(d.autoCall, true);
  assert.equal(d.agentId, "agent_khopoli");
});
test("facebook: an unmapped project is a Contact only", () => {
  const d = R.resolveRouting(cfg(), { routeSource: "facebook", projectId: OTHER });
  assert.equal(d.autoCall, false);
  assert.equal(d.reason, "no_route");
});
test("facebook: a lead with no project is a Contact only", () => {
  assert.equal(R.resolveRouting(cfg(), { routeSource: "facebook", projectId: "" }).reason, "no_route");
});
test("facebook: rows of a kind facebook does not support are ignored", () => {
  const c = cfg({ facebook: { enabled: true, routes: [
    { id: "bad1", matchKind: "ad_id", matchValue: "999999", agentId: "agent_x" },
    { id: "bad2", matchKind: "url_contains", matchValue: "/khopoli/", agentId: "agent_y" },
  ] } });
  assert.equal(R.resolveRouting(c, { routeSource: "facebook", projectId: KHOPOLI, adId: "999999", sourcePage: "/khopoli/" }).autoCall, false);
});

// ── whatsapp: project / campaign match -> agent ────────────────────────────
test("whatsapp: an ad id match goes to that ad's agent", () => {
  const d = R.resolveRouting(cfg(), { routeSource: "whatsapp", adId: "120252242040050286" });
  assert.equal(d.agentId, "agent_ad");
});
test("whatsapp: ad id is more specific than project when both match", () => {
  const d = R.resolveRouting(cfg(), { routeSource: "whatsapp", adId: "120252242040050286", projectId: KHOPOLI });
  assert.equal(d.agentId, "agent_ad");
});
test("whatsapp: project matches when the ad does not", () => {
  const d = R.resolveRouting(cfg(), { routeSource: "whatsapp", adId: "other-ad", projectId: KHOPOLI });
  assert.equal(d.agentId, "agent_proj");
});
test("whatsapp: neither ad nor project matches -> Contact only", () => {
  const d = R.resolveRouting(cfg(), { routeSource: "whatsapp", adId: "nope", projectId: OTHER });
  assert.equal(d.autoCall, false);
  assert.equal(d.reason, "no_route");
});
test("whatsapp: ad id must match exactly, not as a substring", () => {
  assert.equal(R.resolveRouting(cfg(), { routeSource: "whatsapp", adId: "120252242040050286999" }).autoCall, false);
  assert.equal(R.resolveRouting(cfg(), { routeSource: "whatsapp", adId: "1202522420400502" }).autoCall, false);
});

// ── an invalid agent never calls ───────────────────────────────────────────
test("a stored agent id that is not valid does not call", () => {
  for (const agentId of ["bad id!", "a/b", "x".repeat(65), " ", "agent id"]) {
    const c = cfg({ facebook: { enabled: true, routes: [{ id: "f1", matchKind: "project", matchValue: KHOPOLI, agentId }] } });
    const d = R.resolveRouting(c, { routeSource: "facebook", projectId: KHOPOLI });
    assert.equal(d.autoCall, false, agentId);
    assert.equal(d.reason, "agent_missing", agentId);
  }
});

// ── what the decision is made from ─────────────────────────────────────────
test("inputs: derived from the lead and context at creation", () => {
  const i = R.routingInputsFrom({ sourcePage: "https://x.com/a/", campaignRef: { adId: "AD1" } }, { routeSource: "whatsapp", project: { id: KHOPOLI } });
  assert.deepEqual(i, { routeSource: "whatsapp", sourcePage: "https://x.com/a/", projectId: KHOPOLI, adId: "AD1" });
});
test("inputs: an ad id from the webhook attribution is used when the lead has none", () => {
  assert.equal(R.routingInputsFrom({}, { routeSource: "facebook", attribution: { ad_id: "FB1" } }).adId, "FB1");
});
test("inputs: an unknown route source is dropped, so it can never be called", () => {
  assert.equal(R.routingInputsFrom({}, { routeSource: "hacker" }).routeSource, "");
  assert.equal(R.routingInputsFrom({}, {}).routeSource, "");
});

// ── settings validation ────────────────────────────────────────────────────
const row = (over) => ({ matchKind: "url_contains", matchValue: "/khopoli-plots/", agentId: "agent_1", agentLabel: "Siya", ...over });
test("validate: good rows are accepted and normalised", () => {
  const { errors, value } = R.validateRoutingInput({
    website: { enabled: true, routes: [row()] },
    facebook: { routes: [{ matchKind: "project", projectId: KHOPOLI, agentId: "a1" }] },
    whatsapp: { routes: [{ matchKind: "ad_id", matchValue: "120252242040050286", agentId: "a2" }, { matchKind: "project", projectId: KHOPOLI, agentId: "a3" }] },
  });
  assert.deepEqual(errors, []);
  assert.equal(value.website.enabled, true);
  assert.equal(value.facebook.routes[0].matchValue, KHOPOLI);
  assert.equal(value.whatsapp.routes.length, 2);
});
test("validate: sources not mentioned are left alone", () => {
  const { value } = R.validateRoutingInput({ website: { enabled: false } });
  assert.deepEqual(Object.keys(value), ["website"]);
  assert.ok(!("routes" in value.website));
});
test("validate: a route kind the source does not support is rejected", () => {
  assert.ok(R.validateRoutingInput({ website: { routes: [{ matchKind: "project", projectId: KHOPOLI, agentId: "a" }] } }).errors.length);
  assert.ok(R.validateRoutingInput({ facebook: { routes: [row()] } }).errors.length);
  assert.ok(R.validateRoutingInput({ facebook: { routes: [{ matchKind: "ad_id", matchValue: "12345678", agentId: "a" }] } }).errors.length);
  assert.ok(R.validateRoutingInput({ whatsapp: { routes: [row()] } }).errors.length);
});
test("validate: a page match that would catch nearly every page is rejected", () => {
  for (const v of ["/", "//", ".", "a", "/a", "ab", "has space/x", ""]) {
    assert.ok(R.validateRoutingInput({ website: { routes: [row({ matchValue: v })] } }).errors.length, JSON.stringify(v));
  }
  assert.deepEqual(R.validateRoutingInput({ website: { routes: [row({ matchValue: "/khopoli/" })] } }).errors, []);
});
test("validate: project and ad id rows need a real value", () => {
  assert.ok(R.validateRoutingInput({ facebook: { routes: [{ matchKind: "project", agentId: "a" }] } }).errors.length);
  assert.ok(R.validateRoutingInput({ facebook: { routes: [{ matchKind: "project", projectId: "not-an-id", agentId: "a" }] } }).errors.length);
  assert.ok(R.validateRoutingInput({ whatsapp: { routes: [{ matchKind: "ad_id", matchValue: "x", agentId: "a" }] } }).errors.length);
});
test("validate: an agent is optional (Unassigned) but, if given, must be a plain id", () => {
  assert.deepEqual(R.validateRoutingInput({ website: { routes: [row({ agentId: "" })] } }).errors, []);
  assert.equal(R.validateRoutingInput({ website: { routes: [row({ agentId: "" })] } }).value.website.routes[0].agentId, "");
  for (const bad of ["a b", "a/b", "../x", "x".repeat(65), "<script>"]) {
    assert.ok(R.validateRoutingInput({ website: { routes: [row({ agentId: bad })] } }).errors.length, bad);
  }
});
test("validate: two rows matching the same thing are rejected", () => {
  assert.ok(R.validateRoutingInput({ website: { routes: [row(), row({ agentId: "other" })] } }).errors.length);
  assert.ok(R.validateRoutingInput({ website: { routes: [row({ matchValue: "/Khopoli-Plots/" }), row({ matchValue: "/khopoli-plots/" })] } }).errors.length);
});
test("validate: row count and types are bounded", () => {
  const many = Array.from({ length: R.MAX_ROUTES_PER_SOURCE + 1 }, (_, i) => row({ matchValue: `/page-${i}/` }));
  assert.ok(R.validateRoutingInput({ website: { routes: many } }).errors.length);
  assert.ok(R.validateRoutingInput({ website: { enabled: "yes" } }).errors.length);
  assert.ok(R.validateRoutingInput({ website: { routes: "nope" } }).errors.length);
  assert.ok(R.validateRoutingInput({ website: 5 }).errors.length);
});
test("validate: labels are optional and capped; effective label is derived when blank", () => {
  assert.equal(R.routeLabel({ matchKind: "url_contains", matchValue: "/x-y/" }), "Page contains /x-y/");
  assert.equal(R.routeLabel({ matchKind: "project", matchValue: "id", projectName: "SP Khopoli" }), "Project: SP Khopoli");
  assert.equal(R.routeLabel({ matchKind: "ad_id", matchValue: "1234" }), "Ad 1234");
  assert.equal(R.routeLabel({ label: "  Khopoli plots  ", matchKind: "ad_id", matchValue: "1" }), "Khopoli plots");
  const long = R.validateRoutingInput({ website: { routes: [row({ label: "L".repeat(500) })] } }).value.website.routes[0].label;
  assert.equal(long.length, 120);
});

test("page rule: optional project is context only - carried on the route, never affects matching", () => {
  const c = cfg();
  c.routing.website.routes[0] = { ...c.routing.website.routes[0], projectId: KHOPOLI, projectName: "SP Khopoli" };
  const d = R.resolveRouting(c, web("https://x.com/shapoorji-pallonji-khopoli/page"));
  assert.equal(d.autoCall, true);
  assert.equal(d.route.projectName, "SP Khopoli");
  assert.equal(d.route.projectId, KHOPOLI);
  assert.equal(R.resolveRouting(c, { ...web("https://x.com/other/"), projectId: KHOPOLI }).autoCall, false);
});
test("validate: website rule accepts a blank or valid projectId, rejects a malformed one", () => {
  const ok = R.validateRoutingInput({ website: { routes: [row({ projectId: KHOPOLI })] } });
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.value.website.routes[0].projectId, KHOPOLI);
  assert.equal(R.validateRoutingInput({ website: { routes: [row({ projectId: "" })] } }).errors.length, 0);
  assert.ok(R.validateRoutingInput({ website: { routes: [row({ projectId: "nope" })] } }).errors.length);
});

run("Vistrow outbound - routing (source toggles and route rows)");
