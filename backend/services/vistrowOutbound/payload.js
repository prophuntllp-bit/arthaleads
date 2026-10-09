// Builds the lead.created body sent to Vistrow Voice.
//
// Contract (Vistrow, docs/vistrow-outbound-lead-created.md):
//   required: event, source = "arthaleads", org_id, lead_id, name, phone (E.164)
//   idempotency: org_id + lead_id (also sent as id / event_id)
//   accepted top-level: project, property_type, bhk, purpose, requirements,
//     budget, priority, preferred_location, street_address, city, timeline,
//     remark / remark_1 / remark_2, assigned_to, follow_up_date, lead_outcome,
//     lead_source / source_detail, campaign|ad|form ids and names, email,
//     whatsapp, language, preferred_callback_time, consent_basis, opt_out,
//     do_not_call, plus custom_fields for anything else.
//
// Rules:
//  * Only data ArthaLeads actually holds. Absent -> the key is omitted.
//    ArthaLeads has NO language, preferred-callback-time, lead_outcome or
//    do-not-call field, so those are never sent.
//  * A value that merely equals a schema default (a lead whose source never
//    mentioned property type still carries "Apartment") is treated as not
//    provided: an agent opening with "you wanted to buy an apartment" to
//    someone who never said so is worse than asking an open question.
//  * Everything here is loaded into an LLM prompt on the far side, and most of
//    it was typed by the public into a web form. Values are length-capped and
//    stripped of control characters; they are still untrusted text and Vistrow
//    must treat them as data, not instructions.

const { toE164 } = require("./phone");
const { normalizeSourceLabel } = require("./routing");

const EVENT_TYPE = "lead.created";
// Every value is length-capped above, which bounds the whole body (asserted in tests).
const MAX_PAYLOAD_BYTES = 60 * 1024;
const SCHEMA_DEFAULT = { propertyType: "Apartment", purpose: "Buy", bhk: "N/A" };

// Control characters (keeping tab/newline) plus the Unicode line/paragraph
// separators, which are line terminators to JS and can break prompts and logs.
const CONTROL_CHARS = new RegExp(
  "[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F" + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + "]",
  "g"
);

function eventIdForLead(leadId) {
  return `evt_lc_${String(leadId)}`;
}

function str(v, max = 500) {
  if (v === undefined || v === null) return "";
  const s = String(v).replace(CONTROL_CHARS, "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function put(target, key, value, max) {
  const s = typeof value === "string" || typeof value === "number" ? str(value, max) : "";
  if (s) target[key] = s;
}

const plain = (lead) => (lead && typeof lead.toObject === "function" ? lead.toObject() : (lead || {}));

function formatBudget(b) {
  if (!b) return "";
  const min = Number(b.min) > 0 ? Number(b.min) : 0;
  const max = Number(b.max) > 0 ? Number(b.max) : 0;
  if (!min && !max) return "";
  const cur = str(b.currency || "INR", 10) || "INR";
  const f = (n) => new Intl.NumberFormat("en-IN").format(n);
  return min && max && min !== max ? `${cur} ${f(min)} - ${f(max)}` : `${cur} ${f(max || min)}`;
}

// What WhatsApp consent ArthaLeads has recorded, and nothing it does not.
// This is consent to receive WhatsApp MARKETING messages. It is not consent to
// be phoned and is labelled as such, so a policy engine matching on
// consent_basis cannot mistake it for call permission.
function consentSignals(l) {
  const wc = l.whatsappConsent;
  const out = { top: {}, custom: undefined };
  if (!wc || (wc.status !== "granted" && wc.status !== "denied")) return out;
  out.custom = {
    status: wc.status,
    scope: "whatsapp_marketing",
    ...(wc.source ? { source: str(wc.source, 50) } : {}),
    ...(wc.capturedAt ? { captured_at: new Date(wc.capturedAt).toISOString() } : {}),
  };
  if (wc.status === "granted") out.top.consent_basis = `whatsapp_marketing_opt_in${wc.source ? `:${str(wc.source, 50)}` : ""}`;
  // The only opt-out signal ArthaLeads has. Narrower than a call opt-out, but
  // for something that dials people, erring towards "do not" is the safe side.
  if (wc.status === "denied") out.top.opt_out = true;
  return out;
}

function buildCustomFields(l, ctx = {}) {
  const cf = {};
  const a = ctx.attribution || {};

  // Attribution that has no dedicated top-level key on the Vistrow side.
  for (const k of ["page_id", "adset_id", "adset_name", "adgroup_id", "adgroup_name"]) put(cf, k, a[k], 200);
  put(cf, "source_page", l.sourcePage, 500);
  put(cf, "source_domain", l.sourceDomain, 200);
  put(cf, "form_plugin", l.formPlugin, 100);
  put(cf, "arthaleads_source", l.source, 50);
  put(cf, "meta_lead_id", l.metaLeadId, 100);
  if (l.campaignRef) {
    put(cf, "ad_headline", l.campaignRef.headline, 300);
    put(cf, "ad_body", l.campaignRef.body, 500);
    put(cf, "ad_source_url", l.campaignRef.sourceUrl, 500);
  }
  if (ctx.project?.id) put(cf, "project_id", String(ctx.project.id), 40);

  put(cf, "status", l.status, 50);
  put(cf, "remark_3", l.remark3, 500);
  put(cf, "remark_4", l.remark4, 500);
  put(cf, "remark_note", l.remarkNote, 500);

  const b = l.budget || {};
  if (Number(b.min) > 0) cf.budget_min = Number(b.min);
  if (Number(b.max) > 0) cf.budget_max = Number(b.max);
  if (cf.budget_min || cf.budget_max) put(cf, "budget_currency", b.currency || "INR", 10);

  if (Array.isArray(l.tags) && l.tags.length) cf.tags = l.tags.map((t) => str(t, 50)).filter(Boolean).slice(0, 20);

  // Anything the lead answered on a form (this is where a stated language or
  // preferred call time would appear, if the form asked).
  if (Array.isArray(l.formResponses) && l.formResponses.length) {
    const fr = l.formResponses
      .map((r) => ({ key: str(r.fieldKey, 100), label: str(r.label, 200), value: str(r.value, 500) }))
      .filter((r) => r.value)
      .slice(0, 30);
    if (fr.length) cf.form_responses = fr;
  }

  const consent = consentSignals(l);
  if (consent.custom) cf.whatsapp_consent = consent.custom;
  return cf;
}

/**
 * @returns {{ payload, eventId, phone }|{ error: "invalid_phone" }}
 */
function buildLeadCreatedPayload(lead, ctx = {}, { orgId, defaultCountryCode = "91", now = new Date(), routing = { autoCall: false, reason: "not_auto_source" } } = {}) {
  const l = plain(lead);
  const phone = toE164(l.phone, defaultCountryCode);
  if (!phone) return { error: "invalid_phone" };

  const eventId = ctx.eventId || eventIdForLead(l._id);
  const createdAt = l.createdAt ? new Date(l.createdAt) : now;
  const a = ctx.attribution || {};
  const ref = l.campaignRef || {};

  const payload = {
    event: EVENT_TYPE,
    id: eventId,
    event_id: eventId,
    source: "arthaleads",
    org_id: String(orgId || l.orgId),
    lead_id: String(l._id),
    created_at: createdAt.toISOString(),
    name: str(l.name, 100),
    phone,
  };

  put(payload, "email", l.email, 200);
  if (l.source === "WhatsApp") payload.whatsapp = phone; // for a WhatsApp lead the phone IS the WhatsApp number

  // Facebook -> "Facebook Ad"; the CRM's own value is kept in custom_fields.
  put(payload, "lead_source", normalizeSourceLabel(l.source), 50);
  put(payload, "source_detail", l.leadSourceLabel, 200);
  // The lead's own project (the Lead Routing rule that filed it) wins; failing that, the
  // project the matched route stands for - so a page rule can say "this page is SP Khopoli".
  const project = ctx.project?.name ? ctx.project : routing.route?.projectName ? { id: routing.route.projectId, name: routing.route.projectName } : undefined;
  put(payload, "project", project?.name, 200);

  // Campaign / ad / form identity: what the webhook extracted for routing, plus
  // what is stored on the lead (WhatsApp click-to-chat ads keep theirs there).
  put(payload, "campaign_id", a.campaign_id, 200);
  put(payload, "campaign_name", a.campaign_name, 200);
  put(payload, "ad_id", a.ad_id || ref.adId, 200);
  put(payload, "ad_name", a.ad_name, 200);
  put(payload, "form_id", a.form_id, 200);
  put(payload, "form_name", a.form_name, 200);

  put(payload, "requirements", l.requirements, 2000);
  put(payload, "priority", l.priority, 50);
  put(payload, "timeline", l.timeline, 200);
  put(payload, "preferred_location", l.preferredLocation, 200);
  put(payload, "street_address", l.streetAddress, 300);
  put(payload, "city", l.city, 100);
  if (l.propertyType && l.propertyType !== SCHEMA_DEFAULT.propertyType && l.propertyType !== "N/A") put(payload, "property_type", l.propertyType, 100);
  if (l.purpose && l.purpose !== SCHEMA_DEFAULT.purpose && l.purpose !== "N/A") put(payload, "purpose", l.purpose, 100);
  if (l.bhk && l.bhk !== SCHEMA_DEFAULT.bhk) put(payload, "bhk", l.bhk, 50);
  put(payload, "budget", formatBudget(l.budget), 100);

  put(payload, "remark", l.remark, 500);
  put(payload, "remark_1", l.remark1, 500);
  put(payload, "remark_2", l.remark2, 500);
  put(payload, "assigned_to", l.assignedToName, 100);
  if (l.followUpDate) payload.follow_up_date = new Date(l.followUpDate).toISOString();

  Object.assign(payload, consentSignals(l).top);

  // The call decision, explicit either way. Vistrow imports and tags the
  // Contact regardless; it may only queue a call when auto_call is true, and
  // then only for agent_id. There is no default agent: when no route chose
  // one, the key is absent and the reason says why.
  payload.auto_call = routing.autoCall === true;
  if (payload.auto_call) {
    payload.agent_id = routing.agentId;
    put(payload, "route_label", routing.route?.label, 200);
  } else {
    payload.auto_call_reason = routing.reason || "not_auto_source";
  }

  payload.custom_fields = buildCustomFields(l, { ...ctx, project });

  return { payload, eventId, phone };
}

// Synthetic lead for the owner's dry-run / test send. Never stored as a Lead.
// Carries one of every top-level field type on purpose, so a type mismatch
// (say, Vistrow expecting a numeric budget) shows up in a test, not on the
// first real lead. +1 555 01XX is the North American range reserved for
// fiction, so a test body cannot reach a real person even if dialled.
function buildTestPayload({ orgId, eventId }) {
  return {
    event: EVENT_TYPE,
    id: eventId,
    event_id: eventId,
    source: "arthaleads",
    test: true,
    org_id: String(orgId),
    lead_id: `test_${eventId}`,
    created_at: new Date().toISOString(),
    name: "ArthaLeads Test Lead",
    phone: "+15555550100",
    email: "test-lead@example.invalid",
    lead_source: "Test",
    source_detail: "ArthaLeads integration test",
    auto_call: false,
    auto_call_reason: "test_event",
    project: "Test Project",
    campaign_id: "test-campaign-id", campaign_name: "Test Campaign",
    ad_id: "test-ad-id", ad_name: "Test Ad",
    form_id: "test-form-id", form_name: "Test Form",
    requirements: "Synthetic test event - do not call.",
    priority: "Medium",
    timeline: "Test",
    preferred_location: "Test",
    city: "Test",
    street_address: "Test",
    property_type: "Plot", purpose: "Invest", bhk: "2 BHK",
    budget: "INR 50,00,000 - 80,00,000",
    remark: "test", remark_1: "test", remark_2: "test",
    assigned_to: "Test Agent",
    custom_fields: { is_test: true, status: "New", budget_min: 5000000, budget_max: 8000000, budget_currency: "INR" },
  };
}

module.exports = { MAX_PAYLOAD_BYTES, EVENT_TYPE, eventIdForLead, buildLeadCreatedPayload, buildTestPayload, buildCustomFields, consentSignals, formatBudget };
