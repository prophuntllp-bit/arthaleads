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
  buildSendComponents, countBodyVariables, APPROVED,
};
