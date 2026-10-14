// One Artha turn: the model looks things up with tools (in parallel), streams
// its answer, and may propose changes. Events go to `send` as they happen:
//   { type: "step", id, label, status: "running" | "done" | "error", count? }
//   { type: "text", delta }
//   { type: "proposal", proposal: { type, params } }
//   { type: "records", records }
//   { type: "done", text, steps, records, proposals }
// Changes are never made here; proposals go to the existing preview/apply flow.
const provider = require("../utils/ai/provider");
const { SYSTEM, contextMessage } = require("./prompt");
const { toolsFor, runTool, stepLabel } = require("./tools");

const MAX_ROUNDS = 8;

// The house style has no em dashes; the model still uses them now and then.
const plain = (t) => t.replace(/—/g, ",");
// Pieces arrive separately, so spacing around a replaced dash is tidied once at the end
// (the web panel applies the same tidy while text is still streaming).
const tidy = (t) => t.replace(/[ 	]+,/g, ",").replace(/,[ 	]{2,}/g, ", ");
const HISTORY_TURNS = 12;
const TURN_DEADLINE_MS = 60_000;

// Earlier turns as model messages. Assistant turns carry the ids of the
// records they showed, so "these leads" in a follow-up can be resolved.
function historyMessages(turns) {
  return turns.slice(-HISTORY_TURNS).map((t) => {
    if (t.role === "user") return { role: "user", content: t.text };
    const refs = (t.records || []).slice(0, 30).map((r) => `${r.name} (${r.kind} ${r.id})`).join("; ");
    return { role: "assistant", content: `${t.text}${refs ? `\n\n[Records in this answer: ${refs}]` : ""}` };
  });
}

function countOf(result) {
  if (!result || typeof result !== "object") return undefined;
  if (Number.isFinite(result.total)) return result.total;
  for (const k of ["leads", "followUps", "tasks", "team", "projects", "messages", "sections", "groups"]) {
    if (Array.isArray(result[k])) return result[k].length;
  }
  return undefined;
}

async function runTurn({ user, org, turns, question, page, focus, send, signal }) {
  const tools = toolsFor(user, org);
  const messages = [
    { role: "system", content: SYSTEM },
    ...historyMessages(turns),
    { role: "system", content: contextMessage({ user, page, focus }) },
    { role: "user", content: question },
  ];
  const ctx = { user, org, proposals: [], choices: [] };
  const steps = []; const records = new Map(); let finalText = "";
  const deadline = Date.now() + TURN_DEADLINE_MS;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (signal?.aborted) break;
    const { stream, model } = await provider.chatStream({ org, messages, tools, maxOutputTokens: 1500, signal });
    let text = ""; const calls = []; let usage = null;
    for await (const chunk of stream) {
      if (chunk.usage) usage = chunk.usage;
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) { const piece = plain(delta.content); text += piece; send({ type: "text", delta: piece }); }
      for (const tc of delta.tool_calls || []) {
        const slot = calls[tc.index] || (calls[tc.index] = { id: "", name: "", args: "" });
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name += tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
    }
    provider.recordUsage(org?._id, model, usage);

    const toolCalls = calls.filter(Boolean);
    if (!toolCalls.length) { finalText += text; break; }
    if (text) { finalText += text; send({ type: "text", delta: "\n\n" }); finalText += "\n\n"; }

    messages.push({ role: "assistant", content: text || null, tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });

    // Run this round's tools together; each shows as a step while it works.
    const results = await Promise.all(toolCalls.map(async (c, i) => {
      let args = {};
      try { args = JSON.parse(c.args || "{}"); } catch { return { c, result: { error: "The tool input was not valid JSON. Try again." } }; }
      const id = `${round}-${i}`; const label = stepLabel(c.name, args);
      send({ type: "step", id, label, status: "running" });
      try {
        const { result, records: found = [] } = await runTool(c.name, args, ctx);
        for (const r of found) if (!records.has(r.id)) records.set(r.id, r);
        const n = countOf(result);
        steps.push(n === undefined ? label : `${label} · ${n}`);
        send({ type: "step", id, label, status: result?.error ? "error" : "done", count: n });
        if (ctx.proposals.length && result?.status === "proposed") send({ type: "proposal", proposal: ctx.proposals[ctx.proposals.length - 1] });
        if (c.name === "ask_user_to_choose" && result?.status === "shown") send({ type: "choice", choice: ctx.choices[ctx.choices.length - 1] });
        return { c, result };
      } catch (err) {
        send({ type: "step", id, label, status: "error" });
        return { c, result: { error: err.statusCode === 403 ? "Not allowed for this user." : "That lookup failed. Tell the user briefly and continue." } };
      }
    }));
    for (const { c, result } of results) {
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 24_000) });
    }
    if (Date.now() > deadline) {
      messages.push({ role: "system", content: "Time is nearly up: answer now with what you have, without more tools." });
    }
  }

  const shown = [...records.values()];
  send({ type: "records", records: shown });
  return { text: tidy(finalText).trim(), steps, records: shown, proposals: ctx.proposals, choices: ctx.choices };
}

module.exports = { runTurn, historyMessages };
