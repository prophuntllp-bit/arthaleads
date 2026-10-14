// utils/ai/provider.js: the request Artha sends, the cost it records, and the
// monthly usage it adds up. No network: the model client is never called here.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`);
  if (!ok) failures++;
};

(async () => {
  const p = require("../utils/ai/provider");
  console.log("\nArtha AI provider\n");

  check(p.DEFAULT_MODEL === (process.env.COPILOT_MODEL || "gpt-5-mini"), "default model is gpt-5-mini unless COPILOT_MODEL says otherwise", p.DEFAULT_MODEL);
  check(p.modelFor({ copilot: { model: "gpt-5-nano" } }) === "gpt-5-nano", "a company can be pinned to a pilot model");
  check(p.modelFor({ copilot: { model: "" } }) === p.DEFAULT_MODEL && p.modelFor(null) === p.DEFAULT_MODEL, "an empty pin falls back to the default");

  const tools = [{ type: "function", function: { name: "x", parameters: { type: "object", properties: {} } } }];
  const r5 = p.requestFor("gpt-5-mini", { messages: [], tools });
  check(r5.reasoning_effort === (process.env.COPILOT_REASONING_EFFORT || "low") && r5.temperature === undefined, "gpt-5 models get the tested reasoning effort and no temperature");
  check(r5.tool_choice === "auto" && r5.parallel_tool_calls === true, "tools are offered with auto choice and parallel calls");
  const r4 = p.requestFor("gpt-4o-mini", { messages: [] });
  check(r4.temperature === 0.2 && r4.reasoning_effort === undefined && r4.tools === undefined, "older chat models get a temperature and no tools when none are passed");

  const usage = { prompt_tokens: 10_000, completion_tokens: 1_000, prompt_tokens_details: { cached_tokens: 8_000 } };
  const want = (2_000 * 0.25 + 8_000 * 0.025 + 1_000 * 2.0) / 1e6;
  check(Math.abs(p.costOf("gpt-5-mini", usage) - want) < 1e-12, "cost splits cached and new input at their own prices", `${p.costOf("gpt-5-mini", usage)} vs ${want}`);
  check(p.costOf("unknown-model", usage) === 0, "an unpriced model costs 0 rather than throwing");
  check(p.istMonth(new Date("2026-10-31T19:00:00Z")) === "2026-11", "the month rolls over at IST midnight, not UTC");

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const AiUsage = require("../models/AiUsage");
  const orgId = new mongoose.Types.ObjectId();
  await p.recordUsage(orgId, "gpt-5-mini", usage);
  await p.recordUsage(orgId, "gpt-5-mini", usage);
  const row = await AiUsage.findOne({ orgId }).lean();
  check(row?.arthaCalls === 2 && row.arthaInputTokens === 20_000 && row.arthaCachedTokens === 16_000 && row.arthaOutputTokens === 2_000, "usage adds up per company per month", JSON.stringify(row));
  check(row?.arthaCostMicroUsd === Math.round(want * 1e6) * 2, "cost is stored in millionths of a dollar", `${row?.arthaCostMicroUsd}`);
  await p.recordUsage(null, "gpt-5-mini", usage);
  check(true, "recording without a company is ignored, never thrown");

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all provider checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
