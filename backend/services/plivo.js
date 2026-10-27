// services/plivo.js — click-to-call through Plivo (27 Oct 2026), beside EnableX.
//
// A call is placed to the agent's phone. When the agent answers, Plivo asks our
// answer URL what to do, and we reply: record (stereo, from the moment the
// customer answers) and dial the customer from the company's Plivo number.
// Stereo puts each party on its own channel, which is what lets the transcript
// say exactly who said what (EnableX only gives one mixed track).
//
// Plivo docs read for this (Oct 2026):
//   Make a call      POST /v1/Account/{auth_id}/Call/   (Basic auth: Auth ID + Auth Token)
//   Record XML       recordChannelType stereo (default), startOnDialAnswer, callbackUrl
//   Dial XML         callerId, timeout, timeLimit, callbackUrl (DialAction answer|connected|hangup)
//   Signatures       X-Plivo-Signature-V3 = base64(HMAC-SHA256(authToken, "{url}.{sorted k+v}.{nonce}"))
//   India rules      caller ID must be a Plivo Indian number; both legs in India; KYC; TRAI series
const crypto = require("crypto");
const { encryptField, decryptField } = require("../utils/fieldCrypto");

const API = "https://api.plivo.com/v1/Account";

/** The company's Plivo credentials, or null when not set up. */
function credentials(org) {
  const p = org?.plivo || {};
  const authToken = p.authToken ? decryptField(p.authToken) : "";
  return p.authId && authToken ? { authId: p.authId, authToken } : null;
}

const isReady = (org) => Boolean(org?.plivo?.enabled && org.plivo.number && credentials(org));

function authHeader({ authId, authToken }) {
  return `Basic ${Buffer.from(`${authId}:${authToken}`).toString("base64")}`;
}

async function api(creds, method, path, body) {
  const res = await fetch(`${API}/${encodeURIComponent(creds.authId)}${path}`, {
    method,
    headers: { Authorization: authHeader(creds), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text.slice(0, 300) }; }
  if (!res.ok) {
    const msg = json.error || json.message || `Plivo returned ${res.status}`;
    throw Object.assign(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)), { status: res.status, body: json });
  }
  return json;
}

/** Plivo wants E.164 digits; Indian 10-digit numbers get 91. */
function e164(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

/** Checks the credentials and that the number is one of the account's own. */
async function testConnection(org) {
  const creds = credentials(org);
  if (!creds) throw new Error("Add the Auth ID and Auth Token first.");
  const account = await api(creds, "GET", "/");
  let numberOk = null;
  if (org.plivo?.number) {
    try {
      await api(creds, "GET", `/Number/${e164(org.plivo.number)}/`);
      numberOk = true;
    } catch (err) {
      numberOk = err.status === 404 ? false : null;
    }
  }
  return { name: account.name || account.account_type || "", cashCredits: account.cash_credits, numberOk };
}

/**
 * Rings the agent; the answer URL then bridges the customer (see answerXml).
 * Returns Plivo's request_uuid (the call's own CallUUID arrives on callbacks).
 */
async function placeBridgeCall(org, { agentPhone, base, orgId, ref }) {
  const creds = credentials(org);
  if (!creds) throw new Error("Plivo is not set up for this company.");
  const q = `ref=${encodeURIComponent(ref)}`;
  const out = await api(creds, "POST", "/Call/", {
    from: e164(org.plivo.number),
    to: e164(agentPhone),
    answer_url: `${base}/api/plivo/answer/${orgId}?${q}`,
    answer_method: "POST",
    hangup_url: `${base}/api/plivo/hangup/${orgId}?${q}`,
    hangup_method: "POST",
    ring_timeout: 30,
    time_limit: 7200,
  });
  return String(Array.isArray(out.request_uuid) ? out.request_uuid[0] : out.request_uuid || "");
}

/**
 * Our public API address for Plivo to call back: the host this request came in
 * on when it is one of ours (so staging calls back staging, not production,
 * whatever APP_URL says), else APP_URL.
 */
function publicBase(req) {
  const host = String(req?.get?.("x-forwarded-host") || req?.get?.("host") || "").split(",")[0].trim().toLowerCase();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.arthaleads\.com$/.test(host)) return `https://${host}`;
  return (process.env.APP_URL || "https://api.arthaleads.com").replace(/\/+$/, "");
}

const xmlEscape = (s) => String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));

/** What Plivo does once the agent answers: record both sides in stereo, dial the customer. */
function answerXml({ number, leadPhone, base, orgId, ref }) {
  const q = `ref=${encodeURIComponent(ref)}`;
  return [
    "<Response>",
    `<Speak language="en-IN" voice="WOMAN">Connecting your call.</Speak>`,
    // startOnDialAnswer: recording starts when the customer picks up, so ringing
    // isn't recorded. redirect=false: carry on to Dial. maxLength: Plivo's
    // Record default is 60 s, far too short for a sales call.
    `<Record startOnDialAnswer="true" redirect="false" recordChannelType="stereo" fileFormat="wav" maxLength="7200" callbackUrl="${xmlEscape(`${base}/api/plivo/recording/${orgId}?${q}`)}" callbackMethod="POST" />`,
    `<Dial callerId="${xmlEscape(e164(number))}" timeout="30" timeLimit="7200" redirect="false" dialMusic="real" callbackUrl="${xmlEscape(`${base}/api/plivo/dial/${orgId}?${q}`)}" callbackMethod="POST">`,
    `<Number>${xmlEscape(e164(leadPhone))}</Number>`,
    "</Dial>",
    "</Response>",
  ].join("");
}

const hangupXml = (say) => `<Response>${say ? `<Speak language="en-IN" voice="WOMAN">${xmlEscape(say)}</Speak>` : ""}<Hangup/></Response>`;

/**
 * V3 webhook signature check (docs: signature-validation). Plivo signs
 * "{full url}.{params sorted by name, each name+value}.{nonce}"; when several
 * Auth Tokens are active the header carries a comma-separated list. The exact
 * URL form (query order) is tried as sent and with the query sorted.
 * Returns "ok" | "missing" | "invalid".
 */
function checkSignature({ url, params = {}, nonce, signature, authToken }) {
  if (!signature || !nonce) return "missing";
  const sorted = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  const urls = [url];
  try {
    const u = new URL(url);
    if (u.search) {
      const qs = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("&");
      urls.push(`${u.origin}${u.pathname}?${qs}`);
    }
  } catch { /* keep the url as given */ }
  const sigs = String(signature).split(",").map((s) => s.trim()).filter(Boolean);
  for (const candidate of urls) {
    const payload = sorted ? `${candidate}.${sorted}.${nonce}` : `${candidate}.${nonce}`;
    const expected = crypto.createHmac("sha256", authToken).update(payload).digest("base64");
    for (const s of sigs) {
      const a = Buffer.from(s), b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return "ok";
    }
  }
  return "invalid";
}

/** Downloads a recording; public by default, Basic auth when the account turned that on. */
async function downloadRecording(org, url) {
  let res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    const creds = credentials(org);
    if (creds) res = await fetch(url, { headers: { Authorization: authHeader(creds) } });
  }
  if (!res.ok) throw new Error(`Recording download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Ends a live call (used if a call must be cut). */
async function hangup(org, callUuid) {
  const creds = credentials(org);
  if (!creds || !callUuid) return;
  await api(creds, "DELETE", `/Call/${encodeURIComponent(callUuid)}/`).catch(() => {});
}

module.exports = {
  credentials, isReady, e164, publicBase, testConnection, placeBridgeCall, answerXml, hangupXml,
  checkSignature, downloadRecording, hangup, encryptField, decryptField,
};
