// An in-memory stand-in for /api/integrations/vistrow-outbound that runs the REAL
// backend routing + validation code, so the UI is exercised against true rules.
import * as R from "../../../backend/services/vistrowOutbound/routing.js";

const PROJECTS = [{ _id: "64b0000000000000000000e1", name: "SP Khopoli" }, { _id: "64b0000000000000000000e2", name: "Treetopia" }];
const st = {
  enabled: false, enabledAt: null,
  config: { baseUrl: "", accountId: "", authMode: "header", defaultCountryCode: "91", dedupeWindowHours: 24, maxLeadAgeMinutes: 15, emitImports: false, hasSecret: false },
  routing: { website: { enabled: false, routes: [] }, facebook: { enabled: false, routes: [] }, whatsapp: { enabled: false, routes: [] } },
  health: { lastSuccessAt: null, lastFailureAt: null, lastError: null, lastWarning: null },
  log: [],
};
// Vistrow's agents. The raw ids exist only here, like on the real server; the browser sees name, knowledge base, ref.
const VISTROW_AGENTS = [
  { id: "ag_khopoli_1", name: "Siya KHOPOLI", knowledge_base: "SP Khopoli KB" },
  { id: "ag_plots_2", name: "Plots agent", knowledge_base: "Plots KB" },
  { id: "ag_treetopia_3", name: "Treetopia agent", knowledge_base: "Treetopia KB" },
];
const refOf = (id) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0").repeat(3);
const PROBLEMS = {
  key: ["key_rejected", "Vistrow did not accept the connection key. Check the account number and key in step 1."],
  none: ["no_agents", "No agents with a knowledge base were found in your Vistrow account. Finish setting up an agent in Vistrow, then refresh this list."],
  down: ["unreachable", "Could not reach Vistrow just now. Try again in a minute."],
};
st.agentsMode = "ok";
st.agentFetches = 0;
window.__fake = st;
let n = 0;
const rows = (k) => st.routing[k].routes.map(({ agentId, ...r }) => ({ ...r, agentRef: agentId ? refOf(agentId) : "", label: R.routeLabel(r), customLabel: r.label || "", unassigned: !agentId }));
const cfgForResolve = () => ({ routing: Object.fromEntries(R.SOURCE_KEYS.map((k) => [k, { enabled: st.routing[k].enabled, routes: st.routing[k].routes }])) });
const status = () => ({
  configured: !!(st.config.baseUrl && st.config.accountId && st.config.hasSecret), enabled: st.enabled, enabledAt: st.enabledAt, enabledByName: "Owner",
  config: { ...st.config, secretUpdatedAt: null },
  routing: Object.fromEntries(R.SOURCE_KEYS.map((k) => [k, { enabled: st.routing[k].enabled, enabledAt: null, allowedKinds: R.KINDS_BY_SOURCE[k], routes: rows(k) }])),
  health: st.health,
  stats24h: { counts: { delivered: 2, failed: 0 }, delivered: 2, p50EndToEndMs: 1900, p95EndToEndMs: 2400, within30sPct: 100, callsRequested: 1, callsDeclinedByVistrow: 0 },
  server: { testSendAllowed: false, killSwitch: false, allowedHosts: ["api.vistrowvoice.com"] },
});
const fail = (message, code = 400) => { const e = new Error(message); e.response = { status: code, data: { success: false, message } }; throw e; };
const ok = (data) => ({ data: { success: true, ...data } });

const deliveries = () => [
  { id: "d1", status: "delivered", phone: "+91••••••3210", autoCall: true, agentLabel: "Siya KHOPOLI", routeLabel: "Page contains /shapoorji-pallonji-khopoli/", createdAt: new Date().toISOString(), endToEndMs: 1900, attempts: 1, callQueued: true },
  { id: "d2", status: "delivered", phone: "+91••••••4455", autoCall: false, autoCallReason: "source_disabled", createdAt: new Date(Date.now() - 60000).toISOString(), endToEndMs: 2400, attempts: 1 },
  { id: "d3", status: "skipped", skipReason: "stale_lead", phone: "", createdAt: new Date(Date.now() - 120000).toISOString(), attempts: 0 },
];

export default {
  async get(url) {
    if (url === "/integrations/vistrow-outbound") return ok({ status: status() });
    if (url.startsWith("/integrations/vistrow-outbound/deliveries")) return ok({ deliveries: deliveries() });
    if (url === "/projects") return { data: { data: PROJECTS } };
    if (url === "/leads/domains") return { data: { pages: [{ domain: "shaporjipallonji.com", path: "/shapoorji-pallonji-khopoli/", count: 12 }, { domain: "shaporjipallonji.com", path: "/treetopia/", count: 3 }] } };
    if (url === "/leads/campaign-options") return { data: { options: { whatsapp: { ad_id: [{ value: "120252242040050286", label: "900+ Acre New Launch", count: 28 }] } } } };
    if (url === "/integrations/vistrow-outbound/agents") {
      st.agentFetches++;
      const pr = PROBLEMS[st.agentsMode];
      if (pr) return ok({ agents: [], problem: { code: pr[0], message: pr[1] } });
      return ok({ agents: VISTROW_AGENTS.map((a) => ({ ref: refOf(a.id), name: a.name, knowledgeBase: a.knowledge_base })) });
    }
    fail("unknown GET " + url, 404);
  },
  async put(url, body) {
    st.log.push(["PUT", url, body]);
    if (url.endsWith("/config")) {
      if (body.baseUrl !== undefined) body = { ...body, baseUrl: String(body.baseUrl).replace(/\/+$/, "") }; // the real route stores the bare origin
      const sens = ["baseUrl", "accountId", "secret", "authMode"].some((k) => body[k] !== undefined && (k === "secret" ? !!body[k] : body[k] !== st.config[k]));
      for (const k of Object.keys(body)) if (k !== "secret") st.config[k] = body[k];
      if (body.secret) st.config.hasSecret = true;
      let disabledByChange = false;
      if (st.enabled && sens) { st.enabled = false; disabledByChange = true; }
      return ok({ disabledByChange, status: status() });
    }
    if (url.endsWith("/routing")) {
      const { errors, value } = R.validateRoutingInput(body);
      if (errors.length) fail(errors[0]);
      const turningOn = R.SOURCE_KEYS.filter((k) => value[k]?.enabled === true && !st.routing[k].enabled);
      if (turningOn.length && body.confirm !== true) fail(`Confirmation required to turn on calls for: ${turningOn.join(", ")}.`);
      for (const k of R.SOURCE_KEYS) {
        if (!value[k]) continue;
        if (value[k].enabled !== undefined) st.routing[k].enabled = value[k].enabled;
        if (value[k].routes) st.routing[k].routes = value[k].routes.map((r) => {
          const prev = st.routing[k].routes.find((x) => x._id === r._id);
          const pick = r.agentRef ? VISTROW_AGENTS.find((a) => refOf(a.id) === r.agentRef) : null;
          if (r.agentRef && !pick) fail("That agent is no longer available in Vistrow. Refresh the list and choose again.");
          const agent = pick ? { agentId: pick.id, agentLabel: pick.name, agentKb: pick.knowledge_base } : r.keepAgent && prev ? { agentId: prev.agentId, agentLabel: prev.agentLabel, agentKb: prev.agentKb } : { agentId: "", agentLabel: "", agentKb: "" };
          const { agentRef, keepAgent, ...rest } = r;
          return { ...rest, ...agent, _id: r._id || `r${++n}`, id: r._id || `r${n}`, projectName: r.projectId ? PROJECTS.find((p) => p._id === r.projectId)?.name : "" };
        });
      }
      return ok({ status: status() });
    }
    fail("unknown PUT " + url, 404);
  },
  async post(url, body) {
    st.log.push(["POST", url, body]);
    if (url.endsWith("/enable")) { if (body?.confirm !== true) fail("Confirmation required."); st.enabled = true; st.enabledAt = new Date().toISOString(); return ok({ status: status() }); }
    if (url.endsWith("/disable")) { st.enabled = false; return ok({ status: status() }); }
    if (url.endsWith("/simulate")) return ok({ decision: (({ agentId, ...d }) => d)(R.resolveRouting(cfgForResolve(), { routeSource: body.source, sourcePage: body.pageUrl, projectId: body.projectId, adId: body.adId })) });
    if (url.endsWith("/test")) return ok({ result: { mode: "dry_run", ok: true, sent: false, problems: [], request: { url: st.config.baseUrl + "/leads/inbound/" + st.config.accountId, headers: { "X-Vistrow-Webhook-Token": "[REDACTED]" }, body: { event: "lead.created", test: true, auto_call: false } } } });
    fail("unknown POST " + url, 404);
  },
};
