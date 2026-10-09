// The Vistrow agents an owner may pick from, fetched live from
//   GET {address}/leads/inbound/{account_id}/agents
// authenticated with the same connection key (header only, never the URL).
//
// Vistrow's raw agent id never reaches the browser. The list handed to the UI
// carries an opaque `ref` (a keyed hash of the id); when the owner picks one the
// server re-fetches the list and maps the ref back to the id. Only the id is
// stored and sent in lead.created payloads.

const crypto = require("crypto");
const T = require("./transport");
const { AGENT_ID_RE } = require("./routing");

const CTRL = new RegExp("[\\x00-\\x1F\\x7F" + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + "]", "g");
const clean = (v, n) => String(v === undefined || v === null ? "" : v).replace(CTRL, " ").replace(/\s+/g, " ").trim().slice(0, n);

// Stable for one connection key; changes if the key changes (refs are then re-issued).
const refFor = (secret, id) => crypto.createHmac("sha256", String(secret)).update(`agent:${id}`).digest("hex").slice(0, 24);

const PROBLEMS = {
  not_ready: "Finish step 1 (account number and connection key) to see your agents.",
  key_rejected: "Vistrow did not accept the connection key. Check the account number and key in step 1.",
  not_found: "Vistrow could not find that account number (or its agent list is not available yet). Check step 1.",
  unreachable: "Could not reach Vistrow just now. Try again in a minute.",
  bad_response: "Vistrow sent an answer we could not read. Try again, and tell support if it keeps happening.",
  no_agents: "No agents with a knowledge base were found in your Vistrow account. Finish setting up an agent in Vistrow, then refresh this list.",
};
const problem = (code) => ({ ok: false, code, message: PROBLEMS[code] });

function buildAgentsRequest({ baseUrl, accountId, authMode = "header", secret }) {
  const headers = { Accept: "application/json", "User-Agent": "ArthaLeads-Webhook/1" };
  if (authMode === "bearer") headers.Authorization = `Bearer ${secret}`;
  else headers["X-Vistrow-Webhook-Token"] = secret;
  return { url: `${baseUrl.replace(/\/+$/, "")}/leads/inbound/${encodeURIComponent(accountId)}/agents`, headers };
}

/** cfg: { baseUrl, accountId, authMode, secret }. Never throws. */
async function listAgents(cfg, { send = T.httpSend } = {}) {
  if (!cfg?.baseUrl || !cfg.accountId || !cfg.secret) return problem("not_ready");
  const base = T.validateBaseUrl(cfg.baseUrl);
  if (!base.ok || !T.validateAccountId(cfg.accountId)) return problem("not_ready");
  const { url, headers } = buildAgentsRequest({ ...cfg, baseUrl: base.origin });
  const res = await send({ url, headers, method: "GET" });
  if (res.httpStatus === 401 || res.httpStatus === 403) return problem("key_rejected");
  if (res.httpStatus === 404) return problem("not_found");
  if (res.httpStatus === 0 || res.httpStatus >= 500 || res.httpStatus === 408 || res.httpStatus === 429) return problem("unreachable");
  const list = res.httpStatus >= 200 && res.httpStatus < 300 && res.json && Array.isArray(res.json.agents) ? res.json.agents : null;
  if (!list) return problem("bad_response");

  const seen = new Set();
  const agents = [];
  for (const a of list) {
    const id = String(a?.id ?? "");
    const name = clean(a?.name, 120);
    // Only agents Vistrow says have a knowledge base can be offered.
    const knowledgeBase = clean(typeof a?.knowledge_base === "object" && a?.knowledge_base ? a.knowledge_base.name : a?.knowledge_base, 120);
    if (!AGENT_ID_RE.test(id) || !name || !knowledgeBase || seen.has(id)) continue;
    seen.add(id);
    agents.push({ id, name, knowledgeBase, ref: refFor(cfg.secret, id) });
  }
  agents.sort((x, y) => x.name.localeCompare(y.name));
  return agents.length ? { ok: true, agents } : problem("no_agents");
}

module.exports = { listAgents, refFor, buildAgentsRequest, PROBLEMS };
