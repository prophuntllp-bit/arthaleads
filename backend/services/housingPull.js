// services/housingPull.js - fetch builder leads from Housing.com (27 Oct 2026).
//
// Housing.com's "Developer's CRM Integration Document": GET
// https://leads.housing.com/api/v0/get-builder-leads with start_date, end_date
// and current_time (epoch seconds), id (the company's Housing.com ID, not
// secret) and hash = HMAC-SHA256(key, current_time) as hex. A request more
// than 15 minutes off Housing's clock, or with a wrong hash, gets 401.
// Returns lead_name, lead_phone, lead_email, project_id, project_name,
// locality, lead_date (epoch). The document is old; Housing.com issues the ID
// and key and should confirm it is still current.

const crypto = require("crypto");
const Organization = require("../models/Organization");
const logger = require("../config/logger");
const { decryptField } = require("../utils/fieldCrypto");
const { levelOf } = require("../middlewares/planGate");
const { readFields, savePortalLead } = require("../utils/portalLead");

const URL = process.env.HOUSING_LEADS_URL || "https://leads.housing.com/api/v0/get-builder-leads";
const DAY = 24 * 60 * 60;
const MAX_WINDOW = 7 * DAY;

function signedQuery({ profileId, secretKey, from, to, now = Math.floor(Date.now() / 1000) }) {
  const current = String(now);
  const hash = crypto.createHmac("sha256", secretKey).update(current).digest("hex");
  return new URLSearchParams({ start_date: String(from), end_date: String(to), current_time: current, hash, id: String(profileId) });
}

/** The lead list from Housing.com's answer, whatever it is wrapped in. */
function leadList(json) {
  if (Array.isArray(json)) return json;
  for (const k of ["data", "leads", "result", "results"]) {
    if (Array.isArray(json?.[k])) return json[k];
    if (Array.isArray(json?.[k]?.leads)) return json[k].leads;
  }
  return [];
}

/** One request; throws an Error with a reader-friendly message on failure. */
async function fetchLeads({ profileId, secretKey, from, to }) {
  const res = await fetch(`${URL}?${signedQuery({ profileId, secretKey, from, to })}`, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  if (res.status === 401) throw new Error("Housing.com refused the ID or key (401). Check both with your Housing.com account manager.");
  if (res.status === 422) throw new Error("Housing.com said the request was incomplete (422).");
  if (!res.ok) throw new Error(`Housing.com answered ${res.status}.`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Housing.com sent something that is not lead data."); }
  return leadList(json);
}

/**
 * Pull and save new Housing.com leads for one org since its last pull
 * (first time: the last 24 hours). Records the result on the org.
 */
async function pullOrg(orgId) {
  const org = await Organization.findById(orgId).select("plan autoAssign portals").lean();
  const h = org?.portals?.housing;
  if (!h?.profileId || !h?.secretKey) return { ok: false, error: "Housing.com ID and key are not saved." };

  const now = Math.floor(Date.now() / 1000);
  const last = h.lastPulledTo ? Math.floor(new Date(h.lastPulledTo).getTime() / 1000) : now - DAY;
  // 30 minutes of overlap: a lead Housing.com files late is not missed; repeats are skipped.
  const from = Math.max(last - 30 * 60, now - MAX_WINDOW);
  const counts = { created: 0, added: 0, repeat: 0, skipped: 0 };
  try {
    const list = await fetchLeads({ profileId: h.profileId, secretKey: decryptField(h.secretKey), from, to: now });
    for (const raw of list) {
      const f = readFields(raw);
      // Housing.com sends no lead id: phone, project and time stand in for one.
      if (!f.leadId && f.phone) f.leadId = [String(f.phone).replace(/\D/g, "").slice(-10), f.projectId || f.project, raw.lead_date || ""].join("-");
      const r = await savePortalLead(org, "housing", f, { via: "pull" });
      counts[r.result] = (counts[r.result] || 0) + 1;
    }
    await Organization.updateOne({ _id: orgId }, { $set: {
      "portals.housing.lastPulledTo": new Date(now * 1000), "portals.housing.lastPullAt": new Date(), "portals.housing.lastError": "",
      ...(counts.created || counts.added ? { "portals.lastLeadAt.housing": new Date() } : {}),
    } });
    return { ok: true, fetched: list.length, ...counts };
  } catch (err) {
    const msg = err.name === "TimeoutError" ? "Housing.com did not answer in time." : err.message;
    await Organization.updateOne({ _id: orgId }, { $set: { "portals.housing.lastPullAt": new Date(), "portals.housing.lastError": String(msg).slice(0, 300) } });
    logger.warn(`[housing pull] org ${orgId}: ${msg}`);
    return { ok: false, error: msg };
  }
}

/** Every company with Housing.com fetching on and a Growth plan or above. */
async function pullAll() {
  const orgs = await Organization.find({ "portals.housing.enabled": true }).select("_id plan").lean();
  for (const o of orgs) {
    if (levelOf(o.plan) < levelOf("growth")) continue;
    await pullOrg(o._id).catch((e) => logger.error(`[housing pull] org ${o._id} failed: ${e.message}`));
  }
}

module.exports = { pullOrg, pullAll, signedQuery, leadList };
