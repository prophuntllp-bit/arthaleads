// HTTP side of the outbound Vistrow integration: where we are allowed to send,
// how the request is built and signed, and how the response is judged.
//
// Two invariants live here because they are easy to break elsewhere:
//   * the credential is only ever in a request header -- never in the URL --
//     and errors are reduced to a short code (a raw fetch error can embed the
//     request URL), so nothing logged or stored can contain it;
//   * redirects are never followed (a 3xx could bounce the token to another host).

const crypto = require("crypto");

const DEFAULT_ALLOWED_HOSTS = ["api.vistrowvoice.com"];
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_CHARS = 64 * 1024;
const RETRY_AFTER_CAP_MS = 15 * 60 * 1000;

// Delay before attempt n+1 once attempt n has failed transiently. The first
// retries are quick on purpose: the point of the integration is a call within
// ~30s of the lead arriving, and a blip should not cost most of that budget.
const BACKOFF_MS = [3000, 10000, 30000, 120000, 600000, 1800000, 3600000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // a call hours late is worse than none

function allowedHosts() {
  const env = (process.env.VISTROW_OUTBOUND_ALLOWED_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return env.length ? env : DEFAULT_ALLOWED_HOSTS;
}

function validateBaseUrl(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return { ok: false, reason: "That is not a valid URL." }; }
  if (u.protocol !== "https:") return { ok: false, reason: "The endpoint must use https." };
  if (u.username || u.password) return { ok: false, reason: "Remove credentials from the URL." };
  if (u.port && u.port !== "443") return { ok: false, reason: "Only the standard https port is allowed." };
  if ((u.pathname && u.pathname !== "/") || u.search || u.hash) return { ok: false, reason: "Enter just the site address (no path or query)." };
  if (!allowedHosts().includes(u.hostname.toLowerCase())) return { ok: false, reason: "That host is not on the allowed list for this integration." };
  return { ok: true, origin: u.origin };
}

function validateAccountId(id) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(String(id || ""));
}

function signBody(secret, timestamp, rawBody) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * Builds the request for one event. The credential travels in a header only --
 * never in the URL, which proxies and access logs record. The URL is therefore
 * safe to log; the headers are not.
 *
 *   authMode "header" -> X-Vistrow-Webhook-Token: <secret>   (default)
 *   authMode "bearer" -> Authorization: Bearer <secret>
 *
 * Idempotency-Key is org_id:lead_id, the key Vistrow dedupes on, so a retry of
 * the same lead is recognised however many times it is sent.
 *
 * X-ArthaLeads-Signature (HMAC-SHA256 over "<timestamp>.<body>") is additive:
 * Vistrow need not verify it, but it lets them detect tampering and replay if
 * they choose to.
 */
function buildRequest({ baseUrl, accountId, authMode = "header", secret, eventId, payload, isTest = false, nowSeconds = Math.floor(Date.now() / 1000) }) {
  const rawBody = JSON.stringify(payload);
  const url = `${baseUrl.replace(/\/+$/, "")}/leads/inbound/${encodeURIComponent(accountId)}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "ArthaLeads-Webhook/1",
    "Idempotency-Key": `${payload.org_id}:${payload.lead_id}`,
    "X-ArthaLeads-Event": payload.event,
    "X-ArthaLeads-Event-Id": eventId,
    "X-ArthaLeads-Timestamp": String(nowSeconds),
    "X-ArthaLeads-Signature": `v1=${signBody(secret, nowSeconds, rawBody)}`,
  };
  if (authMode === "bearer") headers.Authorization = `Bearer ${secret}`;
  else headers["X-Vistrow-Webhook-Token"] = secret;
  if (isTest) headers["X-ArthaLeads-Test"] = "1";
  return { url, headers, rawBody };
}

// Header names whose values must never be shown, logged or stored.
const SECRET_HEADERS = /^(authorization|x-vistrow-webhook-token|x-arthaleads-signature)$/i;
function redactHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, SECRET_HEADERS.test(k) ? "[REDACTED]" : v]));
}

function parseRetryAfter(v) {
  if (!v) return 0;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.min(Math.max(n, 0) * 1000, RETRY_AFTER_CAP_MS);
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.min(Math.max(t - Date.now(), 0), RETRY_AFTER_CAP_MS) : 0;
}

async function httpSend({ url, headers, body, timeoutMs = REQUEST_TIMEOUT_MS, fetchImpl = globalThis.fetch }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetchImpl(url, { method: "POST", headers, body, redirect: "manual", signal: ctrl.signal });
    const text = (await res.text()).slice(0, MAX_RESPONSE_CHARS);
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return { httpStatus: res.status, json, latencyMs: Date.now() - t0, retryAfterMs: parseRetryAfter(res.headers?.get?.("retry-after")) };
  } catch (err) {
    // Only a short code survives: the error object can embed the request URL.
    const raw = err?.name === "AbortError" ? "TIMEOUT" : String(err?.cause?.code || err?.code || "NETWORK");
    return { httpStatus: 0, json: null, latencyMs: Date.now() - t0, errorCode: /^[A-Z0-9_]{1,40}$/.test(raw) ? raw : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}

// Whatever the far end says is untrusted text headed for our database and UI.
function sanitizeMessage(input, secrets = []) {
  let s = String(input === undefined || input === null ? "" : input);
  for (const sec of secrets) if (sec && String(sec).length >= 4) s = s.split(String(sec)).join("[redacted]");
  s = s
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 200);
}

/**
 * Judges one HTTP result against the contract:
 *   2xx + ok:true  -> delivered (deduped:true = already accepted; queued/reason
 *                     describe the call, not the delivery)
 *   2xx + ok:false -> permanent: a validation/config failure, never "delivered"
 *   2xx otherwise  -> retry: a 200 from a proxy or error page is not an acceptance
 *   5xx / 408 / 425 / 429 / network -> retry
 *   other 3xx/4xx  -> permanent
 */
// Far-end text is untrusted and may echo the lead it was rejecting (a name
// cannot be pattern-matched out). So only a machine-readable code is kept --
// "account_not_found", "agent_invalid" -- and anything that reads like prose,
// or contains a long number or the credential, is withheld.
const CODE_LIKE = /^[A-Za-z0-9_.:-]{1,80}$/;
function reasonText(v, secrets = []) {
  const s = String(v === undefined || v === null ? "" : v).trim();
  if (!CODE_LIKE.test(s) || /\d{8,}/.test(s)) return "";
  if (secrets.some((sec) => sec && String(sec).length >= 4 && s.includes(String(sec)))) return "";
  return s;
}

function classifyResult(r, secrets = []) {
  if (r.errorCode) return { outcome: "retry", code: r.errorCode, message: "Network error reaching Vistrow" };
  const s = r.httpStatus;
  // Vistrow sends {ok:false, reason}; the others cover a generic error body.
  const reason = () => [r.json?.reason, r.json?.error, r.json?.message, r.json?.detail].map((v) => reasonText(v, secrets)).find(Boolean) || "";
  if (s >= 200 && s < 300) {
    if (r.json && r.json.ok === true) {
      // ok:true = the event is accepted (and a retry is safe). Whether a CALL was
      // queued is separate: Vistrow may import the Contact yet decline to dial
      // (unknown agent, no caller number), reported as queued:false + reason.
      return {
        outcome: "delivered", code: "OK", deduped: r.json.deduped === true,
        queued: typeof r.json.queued === "boolean" ? r.json.queued : undefined,
        reason: reasonText(r.json.reason, secrets),
      };
    }
    if (r.json && r.json.ok === false) return { outcome: "permanent", code: "OK_FALSE", message: reason() || "Vistrow rejected the event (ok:false)" };
    return { outcome: "retry", code: "BAD_2XX_BODY", message: "2xx response without ok:true or ok:false" };
  }
  if (s >= 300 && s < 400) return { outcome: "permanent", code: "REDIRECT", message: "Vistrow endpoint redirected (not followed)" };
  if (s === 408 || s === 425 || s === 429 || s >= 500) return { outcome: "retry", code: `HTTP_${s}`, message: reason() || `HTTP ${s}`, retryAfterMs: r.retryAfterMs || 0 };
  return { outcome: "permanent", code: `HTTP_${s}`, message: reason() || `HTTP ${s}` };
}

function backoffMs(attempt, rand = Math.random) {
  const base = BACKOFF_MS[Math.min(Math.max(attempt, 1), BACKOFF_MS.length) - 1];
  return Math.round(base * (0.8 + rand() * 0.4));
}

module.exports = {
  MAX_ATTEMPTS, MAX_AGE_MS, BACKOFF_MS, RETRY_AFTER_CAP_MS,
  validateBaseUrl, validateAccountId, buildRequest, redactHeaders, signBody, httpSend, classifyResult,
  sanitizeMessage, reasonText, backoffMs, allowedHosts,
};
