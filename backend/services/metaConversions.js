// services/metaConversions.js
//
// Tells Meta what happened to the people its ads brought in, using the
// Conversions API. Meta can then aim ads at people who look like the ones who
// visited and bought, not just the ones who filled a form.
//
// Two kinds of lead can be matched:
//   - Facebook/Instagram lead-form leads, by Meta's own lead id (Lead.metaLeadId)
//   - Click-to-WhatsApp leads, by the ad click id (Lead.campaignRef.ctwaClid)
// Website, manual and other leads carry nothing Meta can match, so they are not sent.
//
// The org supplies its dataset id and a Conversions API access token (Events
// Manager > Data sources > Settings). Nothing is sent unless that is set up.

const crypto = require("crypto");
const Organization = require("../models/Organization");
const Lead = require("../models/Lead");
const MetaEvent = require("../models/MetaEvent");
const { encryptField, decryptField } = require("../utils/fieldCrypto");
const { levelOf } = require("../middlewares/planGate");
const logger = require("../config/logger");

const GRAPH = "https://graph.facebook.com/v23.0";
const MAX_ATTEMPTS = 5;
const PARTNER_AGENT = "arthaleads";   // attribution string Meta asks partners to send
const SEVEN_DAYS = 7 * 86400000;     // Meta rejects events older than this

// "New" is the raw lead event: Meta needs it to know the lead was received, and
// will not open the sales-funnel step without it.
const DEFAULT_EVENTS = [
  { stage: "New",         eventName: "Lead",          enabled: true },
  { stage: "Contacted",   eventName: "Contacted",     enabled: false },
  { stage: "Site Visit",  eventName: "Schedule",      enabled: true },
  { stage: "Negotiation", eventName: "QualifiedLead", enabled: false },
  { stage: "Closed Won",  eventName: "Purchase",      enabled: true },
];

const sha = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");
const normEmail = (e) => String(e || "").trim().toLowerCase();
function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;        // Indian numbers without a country code
  return d.length >= 11 && d.length <= 15 ? d : "";
}

function eventsFor(org) {
  const saved = org?.metaCapi?.events;
  return saved && saved.length ? saved : DEFAULT_EVENTS;
}

function isReady(org) {
  const c = org?.metaCapi;
  return Boolean(c?.enabled && c.datasetId && c.accessToken && levelOf(org.plan) >= 2);
}

/** Which kind of Meta match this lead has, if any. */
function channelOf(lead) {
  if (lead?.metaLeadId) return "lead_ads";
  if (lead?.campaignRef?.ctwaClid) return "whatsapp_ctwa";
  return null;
}

function buildEvent(lead, org, doc) {
  const base = {
    event_name: doc.eventName,
    event_time: Math.floor(new Date(doc.eventTime).getTime() / 1000),
    event_id: `${doc._id}`,
  };
  if (doc.channel === "lead_ads") {
    const ph = normPhone(lead.phone), em = normEmail(lead.email);
    return {
      ...base,
      action_source: "system_generated",
      user_data: { lead_id: String(lead.metaLeadId), ...(em ? { em: [sha(em)] } : {}), ...(ph ? { ph: [sha(ph)] } : {}) },
      custom_data: { event_source: "crm", lead_event_source: "ArthaLeads" },
      partner_agent: PARTNER_AGENT,
    };
  }
  const waba = org?.whatsapp?.wabaId;
  return {
    ...base,
    action_source: "business_messaging",
    messaging_channel: "whatsapp",
    user_data: { ctwa_clid: lead.campaignRef.ctwaClid, ...(waba ? { whatsapp_business_account_id: waba } : {}) },
  };
}

async function post(org, events, { testCode } = {}) {
  const token = decryptField(org.metaCapi.accessToken);
  const body = { data: events, ...(testCode ? { test_event_code: testCode } : {}) };
  const res = await fetch(`${GRAPH}/${encodeURIComponent(org.metaCapi.datasetId)}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error || {};
    throw new Error(e.error_user_msg || e.message || `Meta returned ${res.status}`);
  }
  return json;
}

async function sendDoc(org, doc) {
  const lead = await Lead.findById(doc.leadId).select("phone email metaLeadId campaignRef").lean();
  try {
    if (!lead || channelOf(lead) !== doc.channel) throw Object.assign(new Error("Lead has no Meta match."), { skip: true });
    if (Date.now() - new Date(doc.eventTime).getTime() > SEVEN_DAYS) throw Object.assign(new Error("Older than 7 days, Meta no longer accepts it."), { skip: true });
    const out = await post(org, [buildEvent(lead, org, doc)]);
    await MetaEvent.updateOne({ _id: doc._id }, { $set: { status: "sent", sentAt: new Date(), error: "", fbTraceId: out.fbtrace_id || "" }, $inc: { attempts: 1 } });
    await Organization.updateOne({ _id: org._id }, { $set: { "metaCapi.lastError": "", "metaCapi.lastSentAt": new Date() } });
    return true;
  } catch (err) {
    const attempts = (doc.attempts || 0) + 1;
    const status = err.skip || attempts >= MAX_ATTEMPTS ? (err.skip ? "skipped" : "failed") : "failed";
    await MetaEvent.updateOne({ _id: doc._id }, { $set: { status, error: String(err.message).slice(0, 300) }, $inc: { attempts: 1 } });
    if (!err.skip) await Organization.updateOne({ _id: org._id }, { $set: { "metaCapi.lastError": String(err.message).slice(0, 300) } });
    logger.warn(`[meta-capi] org ${org._id} lead ${doc.leadId} ${doc.eventName}: ${err.message}`);
    return false;
  }
}

/**
 * A lead reached `status`. Queue and send the matching event if the org has
 * Conversions API on. Never throws: this runs beside the real save.
 */
async function track(leadOrId, status, at = new Date()) {
  try {
    const lead = leadOrId?.orgId ? leadOrId : await Lead.findById(leadOrId).select("orgId phone email metaLeadId campaignRef createdAt").lean();
    if (!lead) return;
    // Meta discards an event dated before its lead was generated.
    if (lead.createdAt && new Date(at) < new Date(lead.createdAt)) at = lead.createdAt;
    const channel = channelOf(lead);
    if (!channel) return;
    const org = await Organization.findById(lead.orgId).select("plan metaCapi whatsapp.wabaId").lean();
    if (!isReady(org)) return;
    const rule = eventsFor(org).find((e) => e.stage === status && e.enabled);
    if (!rule) return;
    let doc;
    try {
      doc = await MetaEvent.create({ orgId: lead.orgId, leadId: lead._id, stage: status, eventName: rule.eventName, eventTime: at, channel });
    } catch (err) {
      if (err.code === 11000) return;     // already queued or sent
      throw err;
    }
    await sendDoc(org, doc.toObject());
  } catch (err) {
    logger.warn(`[meta-capi] track failed: ${err.message}`);
  }
}

/**
 * Safety net: retries failures, and picks up status changes that came through a
 * path that did not call track() (AI call outcomes, imports, and so on).
 */
async function sweep() {
  const orgs = await Organization.find({ "metaCapi.enabled": true }).select("plan metaCapi whatsapp.wabaId").lean();
  let sent = 0;
  for (const org of orgs) {
    if (!isReady(org)) continue;
    const retry = await MetaEvent.find({ orgId: org._id, status: "failed", attempts: { $lt: MAX_ATTEMPTS }, updatedAt: { $lt: new Date(Date.now() - 4 * 60000) } }).limit(100).lean();
    for (const doc of retry) if (await sendDoc(org, doc)) sent++;

    const stages = eventsFor(org).filter((e) => e.enabled).map((e) => e.stage);
    if (!stages.length) continue;
    const since = new Date(Date.now() - 3 * 3600000);
    const leads = await Lead.find({ orgId: org._id, status: { $in: stages }, updatedAt: { $gte: since }, $or: [{ metaLeadId: { $nin: ["", null] } }, { "campaignRef.ctwaClid": { $nin: ["", null] } }] })
      .select("orgId status phone email metaLeadId campaignRef updatedAt createdAt").limit(300).lean();
    for (const l of leads) await track(l, l.status, l.status === "New" ? l.createdAt : l.updatedAt);
  }
  return sent;
}

/** Check the credentials by sending a clearly-fake event to Meta's Test Events. */
async function sendTest(org) {
  const test = org.metaCapi.testEventCode;
  const out = await post(org, [{
    event_name: "Lead", event_time: Math.floor(Date.now() / 1000), event_id: `test_${Date.now()}`,
    action_source: "system_generated",
    user_data: { em: [sha("test@arthaleads.com")] },
    custom_data: { event_source: "crm", lead_event_source: "ArthaLeads" },
    partner_agent: PARTNER_AGENT,
  }], { testCode: test || undefined });
  return { received: out.events_received ?? 0, usedTestCode: Boolean(test) };
}

module.exports = { DEFAULT_EVENTS, eventsFor, isReady, channelOf, track, sweep, sendTest, encryptField, decryptField };
