// Safety net (29 Oct 2026, owner): an AI vendor's own error text, such as
// "429 You have no credits remaining ... platform.openai.com", must never reach
// a person, on the website or in the CRM. Routes already turn AI failures into
// plain words (utils/ai/gateway.js); this catches any reply that still carries
// vendor text in a message field and swaps it for the plain sentence.
const { PUBLIC_MESSAGE } = require("../utils/ai/gateway");

const VENDOR_TEXT = /platform\.openai\.com|api\.openai\.com|api\.anthropic\.com|console\.anthropic\.com|insufficient_quota|You have no credits|exceeded your current quota|credit balance is too low|Incorrect API key|invalid x-api-key|OPENAI_API_KEY|ANTHROPIC_API_KEY|\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{8,}/i;
const FIELDS = ["message", "error", "detail", "answer", "reply"];

function scrub(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  let out = body;
  for (const f of FIELDS) {
    if (typeof body[f] === "string" && VENDOR_TEXT.test(body[f])) {
      if (out === body) out = { ...body };
      out[f] = PUBLIC_MESSAGE;
    }
  }
  return out;
}

function hideAiErrors(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => json(scrub(body));
  next();
}

module.exports = { hideAiErrors, scrub, VENDOR_TEXT };
