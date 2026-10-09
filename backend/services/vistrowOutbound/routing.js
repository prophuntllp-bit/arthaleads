// Which Vistrow agent (if any) may phone a new lead.
//
// This is deliberately the opposite of "call everyone":
//   * a source (Website / Facebook / WhatsApp) must be switched ON by the owner;
//   * the lead must match a route row -- Website: page URL contains X;
//     Facebook: project; WhatsApp: project or ad id -- and that row must name an
//     agent. Several matches resolve to the most specific one;
//   * anything else (source off, no matching row, an ambiguous tie, a row with
//     no agent, a source that is not one of the three) is still sent to Vistrow
//     so it exists as a tagged Contact, but with auto_call:false and NO agent.
//
// There is no default agent and no fallback of any kind. Pure functions: the
// decision is made once, when the lead is created, from what the lead was at
// that moment, and is never re-derived from later edits.

const SOURCE_KEYS = ["website", "facebook", "whatsapp"];

// What a route row may match on, per source.
const KINDS_BY_SOURCE = {
  website: ["url_contains"],
  facebook: ["project"],
  whatsapp: ["project", "ad_id"],
};

const AGENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_ROUTES_PER_SOURCE = 50;

// Lead.source values as Vistrow should see them.
const SOURCE_LABELS = { Facebook: "Facebook Ad", Website: "Website", WhatsApp: "WhatsApp" };
const normalizeSourceLabel = (raw) => SOURCE_LABELS[raw] || (raw ? String(raw) : "");

// Page URL as matched: lower-case, query string and fragment dropped, so a
// "?utm_campaign=/khopoli/" in the query can never satisfy a path rule.
function pageForMatch(url) {
  return String(url || "").toLowerCase().split("#")[0].split("?")[0];
}

function routeLabel(r) {
  if (r.label && String(r.label).trim()) return String(r.label).trim();
  if (r.matchKind === "url_contains") return `Page contains ${r.matchValue}`;
  if (r.matchKind === "project") return `Project: ${r.projectName || r.matchValue}`;
  if (r.matchKind === "ad_id") return `Ad ${r.matchValue}`;
  return "Route";
}

// Higher = more specific. 0 = does not match. Ad id is the narrowest thing a
// WhatsApp lead can match on, then project, and a longer URL fragment is a more
// specific page than a shorter one.
function specificity(source, route, inputs) {
  if (!(KINDS_BY_SOURCE[source] || []).includes(route.matchKind)) return 0;
  const v = String(route.matchValue || "");
  if (!v) return 0;
  if (route.matchKind === "url_contains") {
    const needle = v.toLowerCase();
    return pageForMatch(inputs.sourcePage).includes(needle) ? needle.length : 0;
  }
  if (route.matchKind === "project") return inputs.projectId && String(inputs.projectId) === v ? 10000 : 0;
  if (route.matchKind === "ad_id") return inputs.adId && String(inputs.adId) === v ? 20000 : 0;
  return 0;
}

// What a matched route says about itself, for the payload and the log. A page
// rule may name the project that page stands for (projectName); a project rule
// always does.
const routeInfo = (route) => ({
  id: route.id, label: routeLabel(route), kind: route.matchKind,
  ...(route.projectName ? { projectId: String(route.projectId || route.matchValue || ""), projectName: route.projectName } : {}),
});

const no = (reason, sourceKey = null, route = null) => ({
  autoCall: false, reason, sourceKey,
  ...(route ? { route: routeInfo(route) } : {}),
});

/**
 * @param cfg    integration config (cfg.routing.<source>.{enabled, routes[]})
 * @param inputs { routeSource, sourcePage, projectId, adId }  (see routingInputsFrom)
 */
function resolveRouting(cfg, inputs = {}) {
  const sourceKey = inputs.routeSource;
  if (!SOURCE_KEYS.includes(sourceKey)) return no("not_auto_source");

  const src = cfg?.routing?.[sourceKey];
  if (!src || src.enabled !== true) return no("source_disabled", sourceKey);

  const hits = (src.routes || [])
    .map((route) => ({ route, score: specificity(sourceKey, route, inputs) }))
    .filter((h) => h.score > 0);
  if (!hits.length) return no("no_route", sourceKey);

  const top = Math.max(...hits.map((h) => h.score));
  const best = hits.filter((h) => h.score === top).map((h) => h.route);
  // Two equally specific rows naming different agents: refuse to choose.
  if (new Set(best.map((r) => r.agentId || "")).size > 1) return no("ambiguous_route", sourceKey);

  const route = best[0];
  if (!AGENT_ID_RE.test(String(route.agentId || ""))) return no("agent_missing", sourceKey, route);

  return {
    autoCall: true, reason: "", sourceKey,
    agentId: route.agentId, agentLabel: route.agentLabel || "",
    route: routeInfo(route),
  };
}

// What the decision is made from, captured at creation and kept on the job so
// the send-time recheck uses exactly the same facts.
function routingInputsFrom(lead, ctx = {}) {
  return {
    routeSource: SOURCE_KEYS.includes(ctx.routeSource) ? ctx.routeSource : "",
    sourcePage: String(lead.sourcePage || ""),
    projectId: ctx.project?.id ? String(ctx.project.id) : "",
    adId: String(ctx.attribution?.ad_id || lead.campaignRef?.adId || ""),
  };
}

// ── Settings validation (shape only; project existence is checked against the
// database by the route) ──────────────────────────────────────────────────────

function validateRoutingInput(body) {
  const errors = [];
  const value = {};
  for (const source of SOURCE_KEYS) {
    const s = body?.[source];
    if (s === undefined) continue;
    if (typeof s !== "object" || s === null) { errors.push(`${source}: invalid`); continue; }
    const out = {};
    if (s.enabled !== undefined) {
      if (typeof s.enabled !== "boolean") errors.push(`${source}.enabled: must be true or false`);
      else out.enabled = s.enabled;
    }
    if (s.routes !== undefined) {
      if (!Array.isArray(s.routes)) { errors.push(`${source}.routes: must be a list`); continue; }
      if (s.routes.length > MAX_ROUTES_PER_SOURCE) { errors.push(`${source}: at most ${MAX_ROUTES_PER_SOURCE} routes`); continue; }
      const seen = new Set();
      const rows = [];
      s.routes.forEach((r, i) => {
        const where = `${source} route ${i + 1}`;
        if (!r || typeof r !== "object") { errors.push(`${where}: invalid`); return; }
        if (!KINDS_BY_SOURCE[source].includes(r.matchKind)) { errors.push(`${where}: ${source} routes cannot match on "${r.matchKind}"`); return; }
        const row = { matchKind: r.matchKind, label: String(r.label || "").trim().slice(0, 120) };
        if (r._id) row._id = String(r._id);

        if (r.matchKind === "url_contains") {
          const v = String(r.matchValue || "").trim();
          // Too short or all slashes would match nearly every page of a site.
          if (v.length < 3 || v.length > 200 || v.replace(/[/.\s]/g, "").length < 2 || /\s/.test(v)) { errors.push(`${where}: enter a specific page path, e.g. /shapoorji-pallonji-khopoli/`); return; }
          row.matchValue = v;
          // Optional: the project this page stands for. Context only - it does not affect matching.
          if (r.projectId) {
            if (!/^[a-f0-9]{24}$/i.test(String(r.projectId))) { errors.push(`${where}: choose a valid project, or leave it blank`); return; }
            row.projectId = String(r.projectId);
          }
        } else if (r.matchKind === "project") {
          if (!/^[a-f0-9]{24}$/i.test(String(r.projectId || r.matchValue || ""))) { errors.push(`${where}: choose a project`); return; }
          row.projectId = String(r.projectId || r.matchValue);
          row.matchValue = row.projectId;
        } else if (r.matchKind === "ad_id") {
          const v = String(r.matchValue || "").trim();
          if (!/^[A-Za-z0-9_-]{4,64}$/.test(v)) { errors.push(`${where}: enter the ad id`); return; }
          row.matchValue = v;
        }

        const agentId = String(r.agentId || "").trim();
        if (agentId && !AGENT_ID_RE.test(agentId)) { errors.push(`${where}: the agent id has unsupported characters`); return; }
        row.agentId = agentId; // empty = "Unassigned": the row resolves to no call
        row.agentLabel = String(r.agentLabel || "").trim().slice(0, 120);

        const key = `${row.matchKind}:${row.matchValue.toLowerCase()}`;
        if (seen.has(key)) { errors.push(`${where}: another route already matches the same thing`); return; }
        seen.add(key);
        rows.push(row);
      });
      out.routes = rows;
    }
    value[source] = out;
  }
  return { errors, value };
}

module.exports = {
  SOURCE_KEYS, KINDS_BY_SOURCE, AGENT_ID_RE, MAX_ROUTES_PER_SOURCE,
  normalizeSourceLabel, pageForMatch, routeLabel, resolveRouting, routingInputsFrom, validateRoutingInput,
};
