// The one door Artha (the copilot) uses to reach an AI model.
//
// Chosen 14 Oct 2026 by a capability test of 11 real CRM tasks, 3 runs each:
// gpt-5-mini at reasoning effort "low" did all 33 correctly; gpt-4o-mini (the
// old helpbot model) 24, gpt-5-nano 23, and gpt-5-mini at "minimal" 29 (it
// guessed which "Rahul" instead of asking). Change the model only by re-running
// that test (backend/tests/copilot/capability.eval.js) and beating it.
//
// Everything model-specific lives here so the rest of the copilot never names
// a model or a vendor: swap COPILOT_MODEL (or one company's
// Organization.copilot.model during a pilot) and nothing else changes.
// Usage and cost are recorded per company per IST month for the allowance.
const OpenAI = require("openai");
const AiUsage = require("../../models/AiUsage");

const DEFAULT_MODEL = process.env.COPILOT_MODEL || "gpt-5-mini";
const REASONING_EFFORT = process.env.COPILOT_REASONING_EFFORT || "low";
const TIMEOUT_MS = 30_000;
// gpt-5 family only. "low" = shorter answers (faster, cheaper); empty = model default.
const VERBOSITY = process.env.COPILOT_VERBOSITY === undefined ? "low" : process.env.COPILOT_VERBOSITY;

// USD per 1M tokens: [input, cached input, output]. OpenAI pricing page, 14 Oct 2026.
const PRICES = {
  "gpt-5-mini":  [0.25, 0.025, 2.00],
  "gpt-5-nano":  [0.05, 0.005, 0.40],
  "gpt-4o-mini": [0.15, 0.075, 0.60],
  "gpt-6-luna":  [0.10, 0.01, 0.50],
};

let client = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error("Artha is not configured on this server (OPENAI_API_KEY is missing).");
    err.statusCode = 503;
    throw err;
  }
  if (!client) client = new OpenAI({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

function modelFor(org) {
  return (org && org.copilot && org.copilot.model) || DEFAULT_MODEL;
}

// Reasoning models (gpt-5 family and later) take an effort setting and reject a
// custom temperature; older chat models are the other way round.
const isReasoningModel = (model) => /^(gpt-5|gpt-6|o\d)/.test(model);

function requestFor(model, { messages, tools, maxOutputTokens = 1200 }) {
  const req = { model, messages };
  if (tools && tools.length) { req.tools = tools; req.tool_choice = "auto"; req.parallel_tool_calls = true; }
  if (isReasoningModel(model)) {
    req.reasoning_effort = REASONING_EFFORT;
    req.max_completion_tokens = maxOutputTokens + 2000;
    if (VERBOSITY) req.verbosity = VERBOSITY;   // shorter answers arrive sooner
  }
  else { req.temperature = 0.2; req.max_tokens = maxOutputTokens; }
  return req;
}

/** Cost in US dollars of one response's usage on a model (0 when the model has no known price). */
function costOf(model, usage) {
  const [pin, pcached, pout] = PRICES[model] || [0, 0, 0];
  const cached = usage?.prompt_tokens_details?.cached_tokens || 0;
  const input = Math.max(0, (usage?.prompt_tokens || 0) - cached);
  return (input * pin + cached * pcached + (usage?.completion_tokens || 0) * pout) / 1e6;
}

// "2026-10" in India time, matching how every other monthly figure is kept.
function istMonth(d = new Date()) {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
}

/** Add one model call to the company's monthly Artha usage. Never throws. */
async function recordUsage(orgId, model, usage) {
  if (!orgId || !usage) return;
  const cached = usage.prompt_tokens_details?.cached_tokens || 0;
  try {
    await AiUsage.updateOne(
      { orgId, month: istMonth() },
      { $inc: {
        arthaCalls: 1,
        arthaInputTokens: usage.prompt_tokens || 0,
        arthaCachedTokens: cached,
        arthaOutputTokens: usage.completion_tokens || 0,
        arthaCostMicroUsd: Math.round(costOf(model, usage) * 1e6),
      } },
      { upsert: true }
    );
  } catch { /* usage accounting must never break an answer */ }
}

/**
 * One model turn. Returns { message, usage, model }. `message` is the
 * assistant message (content and/or tool_calls) to append to the conversation.
 */
async function chat({ org, messages, tools, maxOutputTokens, signal }) {
  const model = modelFor(org);
  const res = await getClient().chat.completions.create(requestFor(model, { messages, tools, maxOutputTokens }), { signal });
  recordUsage(org?._id, model, res.usage);
  return { message: res.choices[0].message, usage: res.usage, model, finishReason: res.choices[0].finish_reason };
}

/**
 * Same as chat(), streamed. Returns the SDK stream; iterate it for deltas.
 * Usage arrives in the last chunk (stream_options.include_usage) and is
 * recorded by the caller through recordUsage.
 */
async function chatStream({ org, messages, tools, maxOutputTokens, signal }) {
  const model = modelFor(org);
  const req = { ...requestFor(model, { messages, tools, maxOutputTokens }), stream: true, stream_options: { include_usage: true } };
  const stream = await getClient().chat.completions.create(req, { signal });
  return { stream, model };
}

module.exports = { chat, chatStream, recordUsage, costOf, modelFor, requestFor, istMonth, DEFAULT_MODEL, PRICES };
