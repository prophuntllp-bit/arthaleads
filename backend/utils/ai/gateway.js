// The one door every chat-model call goes through (29 Oct 2026, owner).
//
// OpenAI stays the main model. Claude Haiku 5.5 (cheapest Claude) is a strict
// fallback: used only when OpenAI cannot serve at all (credits used up, key
// rejected, OpenAI down), then OpenAI is tried again after COOLDOWN_MS.
// Callers keep writing OpenAI Chat Completions requests; a fallback answer is
// translated back into the same shape, tool calls and streaming included.
//
// Errors: nothing from either vendor ever reaches a person. When no model can
// answer, the error thrown is AiUnavailableError with a plain message (and the
// vendor detail only in the server log). Speech-to-text is not here: Claude has
// no transcription, so utils/transcribe.js and callTranscript.js stay on OpenAI.
const OpenAI = require("openai");
const anthropicSdk = require("@anthropic-ai/sdk");
const logger = require("../../config/logger");

const Anthropic = anthropicSdk.default || anthropicSdk.Anthropic || anthropicSdk;
const FALLBACK_MODEL = process.env.FALLBACK_AI_MODEL || "claude-haiku-5-5";
const COOLDOWN_MS = 15 * 60 * 1000;
const PUBLIC_MESSAGE = "Our AI assistant is unavailable for a moment. Please try again shortly.";

class AiUnavailableError extends Error {
  constructor(cause) {
    super(PUBLIC_MESSAGE);
    this.name = "AiUnavailableError";
    this.statusCode = 503;
    this.isOperational = true;
    this.aiUnavailable = true;
    this.detail = cause?.message || "";
  }
}

let openaiClients = new Map(); // timeout -> client
let anthropicClient = null;
let openaiDownUntil = 0;

function openaiClient(timeout = 30000) {
  if (!openaiClients.has(timeout)) openaiClients.set(timeout, new OpenAI({ timeout, maxRetries: 1 }));
  return openaiClients.get(timeout);
}
function claudeClient() {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45000, maxRetries: 1 });
  return anthropicClient;
}

const hasOpenAI = () => !!process.env.OPENAI_API_KEY;
const hasClaude = () => !!process.env.ANTHROPIC_API_KEY;
const isAvailable = () => hasOpenAI() || hasClaude();

// OpenAI cannot serve: out of credits / billing, key rejected, or OpenAI itself failing.
// A bad request (400) is our bug and is not hidden behind a fallback.
function openaiCannotServe(err) {
  const status = err?.status || err?.response?.status;
  const code = err?.code || err?.error?.code || err?.response?.data?.error?.code || "";
  const text = `${err?.message || ""} ${code}`.toLowerCase();
  if (/insufficient_quota|billing|credit|quota/.test(text)) return true;
  if (status === 401 || status === 403) return true;
  if (status >= 500 || status === 429) return true; // rate limit after the SDK's own retry, or outage
  if (!status && /timeout|timed out|econn|enotfound|network|fetch failed/.test(text)) return true;
  return false;
}

// ── OpenAI request -> Claude request ─────────────────────────────────────────
function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => (p?.type === "text" ? p.text : "")).filter(Boolean).join("\n");
  return content == null ? "" : String(content);
}

function partsToClaude(content) {
  if (!Array.isArray(content)) return textOf(content) || " ";
  const out = [];
  for (const p of content) {
    if (p?.type === "text" && p.text) out.push({ type: "text", text: p.text });
    if (p?.type === "image_url") {
      const url = typeof p.image_url === "string" ? p.image_url : p.image_url?.url;
      const m = /^data:([^;]+);base64,(.+)$/.exec(url || "");
      if (m) out.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
      else if (url) out.push({ type: "image", source: { type: "url", url } });
    }
  }
  return out.length ? out : " ";
}

function toClaudeRequest(body) {
  const system = [];
  const messages = [];
  for (const m of body.messages || []) {
    if (m.role === "system" || m.role === "developer") { system.push(textOf(m.content)); continue; }
    if (m.role === "tool") {
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: textOf(m.content) || "(empty)" }] });
      continue;
    }
    if (m.role === "assistant") {
      const blocks = [];
      const text = textOf(m.content);
      if (text) blocks.push({ type: "text", text });
      for (const tc of m.tool_calls || []) {
        let input = {};
        try { input = JSON.parse(tc.function?.arguments || "{}"); } catch { input = {}; }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function?.name, input });
      }
      messages.push({ role: "assistant", content: blocks.length ? blocks : " " });
      continue;
    }
    messages.push({ role: "user", content: partsToClaude(m.content) });
  }
  if (!messages.length || messages[0].role !== "user") messages.unshift({ role: "user", content: "(conversation start)" });

  const fmt = body.response_format?.type;
  if (fmt === "json_object" || fmt === "json_schema") {
    const schema = body.response_format?.json_schema?.schema;
    system.push(`Reply with one JSON object only: no code fences, no other text.${schema ? ` It must match this JSON schema: ${JSON.stringify(schema)}` : ""}`);
  }

  const req = {
    model: FALLBACK_MODEL,
    max_tokens: Math.min(Math.max(Number(body.max_completion_tokens || body.max_tokens) || 1024, 256), 16000),
    messages,
    output_config: { effort: "low" },
  };
  if (system.length) req.system = system.join("\n\n");
  if (Array.isArray(body.tools) && body.tools.length) {
    req.tools = body.tools.filter((t) => t.type === "function" && t.function?.name).map((t) => ({
      name: t.function.name,
      description: t.function.description || "",
      input_schema: t.function.parameters || { type: "object", properties: {} },
    }));
    // Forced tool use is not accepted on current Claude models: ask for it instead.
    const choice = body.tool_choice;
    if (choice && typeof choice === "object" && choice.function?.name) {
      req.system = `${req.system ? `${req.system}\n\n` : ""}Answer by calling the ${choice.function.name} tool.`;
    } else if (choice === "required") {
      req.system = `${req.system ? `${req.system}\n\n` : ""}Answer by calling one of the tools.`;
    }
    req.tool_choice = choice === "none" ? { type: "none" } : { type: "auto", ...(body.parallel_tool_calls === false ? { disable_parallel_tool_use: true } : {}) };
  }
  return req;
}

// ── Claude response -> OpenAI response ───────────────────────────────────────
const stripFences = (s) => s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

function toOpenAIResponse(msg, body) {
  let text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const fmt = body.response_format?.type;
  if (fmt === "json_object" || fmt === "json_schema") text = stripFences(text);
  const toolCalls = (msg.content || []).filter((b) => b.type === "tool_use").map((b) => ({
    id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
  }));
  const finish = toolCalls.length ? "tool_calls" : msg.stop_reason === "max_tokens" ? "length" : "stop";
  const cached = msg.usage?.cache_read_input_tokens || 0;
  return {
    id: msg.id,
    object: "chat.completion",
    model: msg.model || FALLBACK_MODEL,
    provider: "anthropic",
    choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) } }],
    usage: {
      prompt_tokens: (msg.usage?.input_tokens || 0) + cached + (msg.usage?.cache_creation_input_tokens || 0),
      completion_tokens: msg.usage?.output_tokens || 0,
      prompt_tokens_details: { cached_tokens: cached },
    },
  };
}

// A finished Claude answer replayed as an OpenAI stream (text first, then tool calls, then usage).
async function* asStream(res) {
  const m = res.choices[0].message;
  if (m.content) yield { id: res.id, model: res.model, choices: [{ index: 0, delta: { role: "assistant", content: m.content }, finish_reason: null }] };
  if (m.tool_calls) {
    yield { id: res.id, model: res.model, choices: [{ index: 0, delta: { tool_calls: m.tool_calls.map((tc, i) => ({ index: i, ...tc })) }, finish_reason: null }] };
  }
  yield { id: res.id, model: res.model, choices: [{ index: 0, delta: {}, finish_reason: res.choices[0].finish_reason }] };
  yield { id: res.id, model: res.model, choices: [], usage: res.usage };
}

async function viaClaude(body, signal) {
  const msg = await claudeClient().messages.create(toClaudeRequest(body), signal ? { signal } : undefined);
  if (msg.stop_reason === "refusal") throw new Error("fallback model declined");
  return toOpenAIResponse(msg, body);
}

/**
 * Drop-in for openai.chat.completions.create(body, { signal }). Falls back to
 * Claude only when OpenAI cannot serve; otherwise behaves exactly like OpenAI.
 */
async function createChatCompletion(body, { signal, timeout } = {}) {
  if (!isAvailable()) throw new AiUnavailableError(new Error("no AI key configured"));
  let openaiErr = null;
  if (hasOpenAI() && Date.now() >= openaiDownUntil) {
    try {
      return await openaiClient(timeout).chat.completions.create(body, signal ? { signal } : undefined);
    } catch (err) {
      if (err?.name === "AbortError" || signal?.aborted) throw err;
      if (!openaiCannotServe(err) || !hasClaude()) {
        logger.error(`[ai] OpenAI failed: ${err.message}`);
        throw openaiCannotServe(err) ? new AiUnavailableError(err) : err;
      }
      openaiErr = err;
      openaiDownUntil = Date.now() + COOLDOWN_MS;
      logger.warn(`[ai] OpenAI cannot serve (${err.status || ""} ${err.code || err.message}); using ${FALLBACK_MODEL} for the next ${COOLDOWN_MS / 60000} min`);
    }
  }
  if (!hasClaude()) throw new AiUnavailableError(openaiErr || new Error("OpenAI cooling down"));
  try {
    const res = await viaClaude(body, signal);
    return body.stream ? asStream(res) : res;
  } catch (err) {
    if (err?.name === "AbortError" || signal?.aborted) throw err;
    logger.error(`[ai] fallback ${FALLBACK_MODEL} failed: ${err.message}`);
    throw new AiUnavailableError(err);
  }
}

/** An object shaped like the OpenAI client for chat calls, so existing code changes one line. */
function chatClient({ timeout } = {}) {
  return { chat: { completions: { create: (body, opts = {}) => createChatCompletion(body, { ...opts, timeout }) } } };
}

// True for an error that came from an AI vendor (OpenAI or Anthropic SDK, or a raw
// OpenAI HTTP call): its text is never shown to a person.
function isVendorError(err) {
  if (!err) return false;
  if (err.aiUnavailable) return true;
  if (err instanceof OpenAI.APIError) return true;
  if (anthropicSdk.APIError && err instanceof anthropicSdk.APIError) return true;
  const url = String(err.config?.url || "");
  if (/api\.openai\.com|api\.anthropic\.com/.test(url)) return true;
  return /platform\.openai\.com|insufficient_quota|You have no credits|credit balance|OPENAI_API_KEY|ANTHROPIC_API_KEY/i.test(String(err.message || ""));
}

module.exports = {
  createChatCompletion, chatClient, isAvailable, isVendorError, AiUnavailableError,
  PUBLIC_MESSAGE, FALLBACK_MODEL,
  _test: { toClaudeRequest, toOpenAIResponse, openaiCannotServe, reset: () => { openaiDownUntil = 0; openaiClients = new Map(); anthropicClient = null; } },
};
