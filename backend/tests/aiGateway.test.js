// AI gateway (29 Oct 2026): OpenAI first, Claude Haiku only when OpenAI cannot
// serve (credits used up, key rejected, outage), and no vendor error text ever
// reaches a person. Both vendors are faked; nothing leaves the machine.
process.env.OPENAI_API_KEY = "sk-test-openai";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
const { test, run, assert } = require("./helpers/harness");

const calls = [];
let openai = { status: 200 };
let claude = { status: 200 };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
global.fetch = async (url, opts = {}) => {
  url = String(url);
  const body = opts.body ? JSON.parse(opts.body) : {};
  if (url.includes("api.openai.com")) {
    calls.push({ to: "openai", body });
    if (openai.status === 400) return json({ error: { message: "Invalid parameter: messages", type: "invalid_request_error", code: "invalid_request" } }, 400);
    if (openai.status !== 200) return json({ error: { message: "You have no credits remaining. Add credits at https://platform.openai.com/settings/organization", type: "insufficient_quota", code: openai.code || "insufficient_quota" } }, openai.status);
    return json({ id: "c1", object: "chat.completion", model: "gpt-4o-mini", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "from openai" } }], usage: { prompt_tokens: 5, completion_tokens: 2 } });
  }
  if (url.includes("api.anthropic.com")) {
    calls.push({ to: "claude", body });
    if (claude.status !== 200) return json({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }, claude.status);
    return json(claude.reply || { id: "msg_1", type: "message", role: "assistant", model: "claude-haiku-5-5", stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: "from claude" }], usage: { input_tokens: 7, output_tokens: 3 } });
  }
  throw new Error(`unexpected ${url}`);
};

const gw = require("../utils/ai/gateway");
const fresh = () => { gw._test.reset(); calls.length = 0; openai = { status: 200 }; claude = { status: 200 }; };

test("OpenAI answers normally; Claude is not touched", async () => {
  fresh();
  const r = await gw.createChatCompletion({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] });
  assert.equal(r.choices[0].message.content, "from openai");
  assert.deepEqual(calls.map((c) => c.to), ["openai"]);
});

test("OpenAI out of credits: Claude Haiku answers in the OpenAI shape, then OpenAI rests 15 min", async () => {
  fresh(); openai.status = 429;
  const r = await gw.createChatCompletion({ model: "gpt-4o-mini", temperature: 0.7, max_tokens: 200, messages: [{ role: "system", content: "Be brief." }, { role: "user", content: "hi" }] });
  assert.equal(r.choices[0].message.content, "from claude");
  assert.equal(r.provider, "anthropic");
  assert.equal(r.usage.prompt_tokens, 7);
  const sent = calls.find((c) => c.to === "claude").body;
  assert.equal(sent.model, "claude-haiku-5-5");
  assert.equal(sent.system, "Be brief.");
  assert.equal(sent.temperature, undefined, "no temperature: current Claude models reject it");
  calls.length = 0;
  await gw.createChatCompletion({ model: "gpt-4o-mini", messages: [{ role: "user", content: "again" }] });
  assert.deepEqual(calls.map((c) => c.to), ["claude"], "OpenAI not retried during the cool-down");
});

test("tools: OpenAI tool history goes over as tool_use/tool_result, Claude's call comes back as tool_calls", async () => {
  fresh(); openai.status = 401; openai.code = "invalid_api_key";
  claude.reply = { id: "msg_2", type: "message", role: "assistant", model: "claude-haiku-5-5", stop_reason: "tool_use",
    content: [{ type: "text", text: "Looking." }, { type: "tool_use", id: "toolu_9", name: "search_leads", input: { text: "Rahul" } }], usage: { input_tokens: 1, output_tokens: 1 } };
  const r = await gw.createChatCompletion({
    model: "gpt-5-mini", max_completion_tokens: 3000, tool_choice: "auto", parallel_tool_calls: true,
    tools: [{ type: "function", function: { name: "search_leads", description: "Find leads", parameters: { type: "object", properties: { text: { type: "string" } } } } }],
    messages: [
      { role: "system", content: "You are Artha." },
      { role: "user", content: "find priya" },
      { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "search_leads", arguments: "{\"text\":\"Priya\"}" } }] },
      { role: "tool", tool_call_id: "call_1", content: "{\"rows\":[]}" },
      { role: "user", content: "and rahul" },
    ],
  });
  const sent = calls.find((c) => c.to === "claude").body;
  assert.equal(sent.tools[0].name, "search_leads");
  assert.deepEqual(sent.tools[0].input_schema.properties.text, { type: "string" });
  assert.deepEqual(sent.messages[1].content[0], { type: "tool_use", id: "call_1", name: "search_leads", input: { text: "Priya" } });
  assert.equal(sent.messages[2].content[0].type, "tool_result");
  assert.equal(sent.messages[2].content[0].tool_use_id, "call_1");
  assert.equal(r.choices[0].finish_reason, "tool_calls");
  assert.deepEqual(r.choices[0].message.tool_calls[0], { id: "toolu_9", type: "function", function: { name: "search_leads", arguments: "{\"text\":\"Rahul\"}" } });
});

test("JSON answers: asked for in words, code fences stripped", async () => {
  fresh(); openai.status = 429;
  claude.reply = { id: "m", type: "message", role: "assistant", model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "```json\n{\"agent\":1}\n```" }], usage: { input_tokens: 1, output_tokens: 1 } };
  const r = await gw.createChatCompletion({ model: "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: "x" }] });
  assert.match(calls.find((c) => c.to === "claude").body.system, /one JSON object only/);
  assert.deepEqual(JSON.parse(r.choices[0].message.content), { agent: 1 });
});

test("streaming callers get OpenAI-style chunks from a Claude answer", async () => {
  fresh(); openai.status = 503;
  const stream = await gw.createChatCompletion({ model: "gpt-5-mini", stream: true, messages: [{ role: "user", content: "hi" }] });
  let text = ""; let usage = null;
  for await (const chunk of stream) { if (chunk.usage) usage = chunk.usage; text += chunk.choices?.[0]?.delta?.content || ""; }
  assert.equal(text, "from claude");
  assert.equal(usage.completion_tokens, 3);
});

test("both out of credits: a plain sentence, never the vendor's text", async () => {
  fresh(); openai.status = 429; claude.status = 400;
  await assert.rejects(gw.createChatCompletion({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] }), (err) => {
    assert.equal(err.statusCode, 503);
    assert.equal(err.message, gw.PUBLIC_MESSAGE);
    assert.doesNotMatch(err.message, /credit|openai|anthropic|429/i);
    return true;
  });
});

test("a bad request to OpenAI (our bug) is not hidden behind the fallback", async () => {
  fresh(); openai.status = 400; openai.code = "invalid_request";
  await assert.rejects(gw.createChatCompletion({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] }));
  assert.deepEqual(calls.map((c) => c.to), ["openai"]);
});

test("the server never sends vendor text: error handler and reply safety net", async () => {
  const { errorHandler } = require("../middlewares/errorHandler");
  const OpenAI = require("openai");
  const raw = new OpenAI.APIError(429, { message: "You have no credits remaining" }, "429 You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization", new Headers());
  let sent;
  const res = { status(c) { this.code = c; return this; }, json(b) { sent = b; return this; } };
  errorHandler(raw, {}, res, () => {});
  assert.equal(res.code, 503);
  assert.equal(sent.message, gw.PUBLIC_MESSAGE);

  const { scrub } = require("../middlewares/hideAiErrors");
  assert.equal(scrub({ success: false, message: "429 You have no credits remaining ... platform.openai.com" }).message, gw.PUBLIC_MESSAGE);
  assert.equal(scrub({ answer: "Your credit balance is too low to access the Anthropic API." }).answer, gw.PUBLIC_MESSAGE);
  assert.equal(scrub({ message: "Lead saved" }).message, "Lead saved", "normal replies untouched");
});

run("AI gateway: OpenAI first, Claude fallback, no vendor errors shown");
