// services/whatsappTemplateService.js
//
// WhatsApp message templates, proxied to Meta.
//
// Templates live on the tenant's own WABA, not ours — we cannot create one
// centrally and share it. Each org submits its own and Meta reviews each one,
// which is why nothing here is instant and why every list carries a status.
//
// Only the "meta" provider is supported. The BSP providers each have their own
// template API and their own approval flow; adding those without an account to
// test against would be guesswork.

const axios = require("axios");
const logger = require("../config/logger");

const GRAPH = "https://graph.facebook.com/v21.0";

// Meta's own vocabulary, kept verbatim so a status we do not recognise still
// renders rather than silently disappearing from the list.
const APPROVED = "APPROVED";

function assertMeta(org) {
  const wa = org?.whatsapp || {};
  if ((wa.provider || "aisensy") !== "meta") {
    throw badRequest("Templates are only available on the Meta Cloud API provider.", { settingsFix: true });
  }
  if (!wa.wabaId)  throw badRequest("No WhatsApp Business Account ID saved. Add it in Settings.", { settingsFix: true });
  if (!wa.apiKey)  throw badRequest("No access token saved. Reconnect in Settings.", { settingsFix: true });
  return wa;
}

/** Everything on the tenant's WABA, newest first. */
async function listTemplates(org, { limit = 100 } = {}) {
  const wa = assertMeta(org);
  try {
    const { data } = await axios.get(`${GRAPH}/${wa.wabaId}/message_templates`, {
      params: {
        access_token: wa.apiKey,
        limit,
        fields: "id,name,status,category,language,components,quality_score,rejected_reason",
      },
    });
    return data?.data || [];
  } catch (err) {
    // Without this the raw AxiosError escaped and the tenant saw "Request failed
    // with status code 400" — Meta's actual reason (expired token, wrong WABA
    // id) was discarded here and never logged anywhere.
    logger.warn(`[wa-templates] list failed for org ${org._id}: ${JSON.stringify(err?.response?.data?.error || err.message)}`);
    throw fromMeta(err, "Could not load templates from Meta.");
  }
}

/** Approved templates only — what a campaign is allowed to send. */
async function listApproved(org) {
  const all = await listTemplates(org);
  return all.filter(t => t.status === APPROVED);
}

/**
 * Submit a template for review.
 *
 * `components` is passed through to Meta unchanged rather than being rebuilt
 * here: the shape is Meta's and it changes on their schedule, so translating
 * it would only add a layer that goes stale.
 */
async function createTemplate(org, { name, category, language, components }) {
  const wa = assertMeta(org);

  if (!name || !/^[a-z0-9_]+$/.test(name)) {
    throw badRequest("Name must be lowercase letters, numbers and underscores only.");
  }
  if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(category)) {
    throw badRequest("Category must be MARKETING, UTILITY or AUTHENTICATION.");
  }
  if (!Array.isArray(components) || !components.length) {
    throw badRequest("A template needs at least a body.");
  }

  try {
    const { data } = await axios.post(
      `${GRAPH}/${wa.wabaId}/message_templates`,
      { name, category, language: language || "en_US", components },
      { params: { access_token: wa.apiKey } }
    );
    logger.info(`[wa-templates] org ${org._id} submitted "${name}" (${category})`);
    return data;
  } catch (err) {
    throw fromMeta(err, "Could not submit the template.");
  }
}

async function deleteTemplate(org, name) {
  const wa = assertMeta(org);
  try {
    const { data } = await axios.delete(`${GRAPH}/${wa.wabaId}/message_templates`, {
      params: { access_token: wa.apiKey, name },
    });
    return data;
  } catch (err) {
    throw fromMeta(err, "Could not delete the template.");
  }
}

/**
 * Build the `components` array a send needs, filling a template's {{n}}
 * placeholders from an ordered list of values.
 *
 * Meta wants positional parameters per component, which is fiddly enough that
 * doing it at each call site would guarantee inconsistency.
 */
function buildSendComponents(template, bodyValues = [], headerValues = []) {
  const out = [];
  const header = (template.components || []).find(c => c.type === "HEADER");
  if (header && headerValues.length) {
    out.push({ type: "header", parameters: headerValues.map(text => ({ type: "text", text: String(text ?? "") })) });
  }
  if (bodyValues.length) {
    out.push({ type: "body", parameters: bodyValues.map(text => ({ type: "text", text: String(text ?? "") })) });
  }
  return out;
}

/** How many {{n}} placeholders a template's body expects. */
function countBodyVariables(template) {
  const body = (template.components || []).find(c => c.type === "BODY");
  if (!body?.text) return 0;
  const found = body.text.match(/\{\{\s*\d+\s*\}\}/g) || [];
  return new Set(found.map(m => m.replace(/\D/g, ""))).size;
}

// Fields a campaign can actually fill from a lead — must match LEAD_FIELD in
// waCampaignService.js. A generated variable bound to anything else would leave
// a blank somebody has to type for every single send, which is precisely the
// thing that makes generated templates more work than writing one by hand.
const BINDABLE_FIELDS = new Set([
  "name", "location", "city", "bhk", "propertyType", "budget", "visitDate",
]);

/**
 * Accept a generated template variant only if it is actually submittable.
 *
 * The model is good at prose and unreliable about structure — numbering, sample
 * values, which fields exist. Returning a draft Meta would reject, or one whose
 * blanks nothing can fill, costs more time than it saves, so anything that fails
 * here is dropped rather than shown.
 *
 * Returns the cleaned variant, or null to discard it.
 */
function normaliseGeneratedVariant(v) {
  if (!v || typeof v !== "object") return null;
  const body = String(v.body || "").trim();
  if (!body || body.length > 1024) return null;

  const found = body.match(/\{\{\s*\d+\s*\}\}/g) || [];
  const nums = [...new Set(found.map((m) => Number(m.replace(/\D/g, ""))))].sort((a, b) => a - b);
  if (nums.join() !== nums.map((_, i) => i + 1).join()) return null;   // gaps or bad numbering
  if (/^\s*\{\{\s*\d+\s*\}\}/.test(body)) return null;                 // opens on a variable
  if (/\{\{\s*\d+\s*\}\}\s*$/.test(body)) return null;                 // closes on a variable

  const varMap  = Array.isArray(v.varMap)  ? v.varMap.map(String) : [];
  const example = Array.isArray(v.example) ? v.example.map((x) => String(x ?? "").trim()) : [];
  if (varMap.length !== nums.length || example.length !== nums.length) return null;
  if (!varMap.every((f) => BINDABLE_FIELDS.has(f))) return null;
  if (!example.every(Boolean)) return null;

  // Trailing underscores are legal but come from stray punctuation ("Launch
  // Invite!!"), so trim both ends. The builder's own slugify deliberately only
  // trims the front, because trimming the end as someone types stops them ever
  // reaching "site_visit".
  const name = String(v.name || "").toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_").replace(/^_+/, "").slice(0, 60).replace(/_+$/, "");
  if (!/^[a-z0-9][a-z0-9_]*$/.test(name)) return null;

  const buttons = (Array.isArray(v.buttons) ? v.buttons : [])
    .filter((b) => b && String(b.text || "").trim() && String(b.text).trim().length <= 25)
    .slice(0, 3)
    .map((b) => ({ type: "QUICK_REPLY", text: String(b.text).trim() }));

  return { name, body, footer: String(v.footer || "").trim().slice(0, 60), buttons, varMap, example };
}

// Meta's errors are far more useful than a generic 500 — surface the message
// it actually gave, which usually names the offending component.
function fromMeta(err, fallback) {
  const meta = err?.response?.data?.error;
  const e = new Error(meta?.error_user_msg || meta?.message || fallback);
  e.status = err?.response?.status || 500;
  e.metaCode = meta?.code;
  e.metaSubcode = meta?.error_subcode;
  // 190 is Meta's catch-all for an access token that is expired, revoked or
  // simply wrong. They answer it with HTTP 400, so status alone cannot tell it
  // apart from a malformed template — the code can, and the UI needs to know
  // because it is the one failure the tenant fixes by reconnecting.
  if (meta?.code === 190) { e.reconnect = true; e.settingsFix = true; }
  return e;
}

function badRequest(message, { settingsFix = false } = {}) {
  const e = new Error(message);
  e.status = 400;
  if (settingsFix) e.settingsFix = true;
  return e;
}

module.exports = {
  listTemplates, listApproved, createTemplate, deleteTemplate,
  buildSendComponents, countBodyVariables, normaliseGeneratedVariant,
  APPROVED, BINDABLE_FIELDS,
};
