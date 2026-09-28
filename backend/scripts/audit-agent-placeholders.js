/**
 * Read-only audit: finds every WaAgent (across every org) whose
 * tenant-authored message fields contain a "{{...}}"-style placeholder, and
 * reports whether that placeholder is one fillTemplate() actually resolves
 * ("name"/"project" — see utils/formFieldMapper.js) or something else that
 * will silently disappear from the sent message instead of being replaced.
 *
 * Written after fixing the bug where greeting/nudgeText/closingPrompt sent
 * "{{name}}" completely unsubstituted (see git log) — this is the
 * "did any OTHER live agent get bitten by the same thing" check. Read-only:
 * makes no writes, so it's safe to run against production at any time.
 *
 * Checks every field a customer can actually receive verbatim:
 *   - greeting (free-text agent's opening message)
 *   - ctwaFlow.welcomeText, ctwaFlow.nudgeText, ctwaFlow.closingPrompt
 *   - ctwaFlow.qualifyingQuestions[].questionText and [].options[].label
 *   - legacy pre-migration equivalents (menuPrompt, siteVisitPrompt,
 *     purposeQuestion, and their options' labels) — these route through
 *     questionStep()/fill() via ctwaFlowService's legacy-shape fallback, so
 *     they were never actually broken, but are included for completeness in
 *     case any of them still shows a stray/misspelled placeholder.
 *
 * Also scans businessContext/groundRules/systemPrompt (prompt context, never
 * sent verbatim to a customer — GPT reads these, a customer doesn't) purely
 * as a secondary "does this look like a typo" flag, called out separately
 * from the "customer literally sees this text" findings above.
 *
 * Run: node backend/scripts/audit-agent-placeholders.js
 * (reads MONGO_URI from backend/.env same as every other script here)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const WaAgent = require("../models/WaAgent");

const KNOWN_VARS = new Set(["name", "project"]);
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

function findPlaceholders(text) {
  if (!text) return [];
  const found = [];
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text))) found.push(m[1]);
  return found;
}

// path: human label for where this text lives, for the report.
function checkField(path, text, sink) {
  const placeholders = findPlaceholders(text);
  if (!placeholders.length) return;
  for (const key of placeholders) {
    sink.push({ path, key, known: KNOWN_VARS.has(key), text });
  }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  const agents = await WaAgent.find({}).select(
    "orgId name status greeting businessContext groundRules systemPrompt ctwaFlow"
  ).lean();

  console.log(`Scanning ${agents.length} agent(s) across every org...\n`);

  let agentsWithCustomerFacingHits = 0;
  let agentsWithPromptOnlyHits = 0;

  for (const agent of agents) {
    const customerFacing = [];
    const promptOnly = [];

    // ── Fields a customer can actually receive verbatim ──────────────────
    checkField("greeting", agent.greeting, customerFacing);

    const cf = agent.ctwaFlow || {};
    checkField("ctwaFlow.welcomeText", cf.welcomeText, customerFacing);
    checkField("ctwaFlow.nudgeText", cf.nudgeText, customerFacing);
    checkField("ctwaFlow.closingPrompt", cf.closingPrompt, customerFacing);
    checkField("ctwaFlow.menuPrompt (legacy)", cf.menuPrompt, customerFacing);
    checkField("ctwaFlow.siteVisitPrompt (legacy)", cf.siteVisitPrompt, customerFacing);
    checkField("ctwaFlow.purposeQuestion (legacy)", cf.purposeQuestion, customerFacing);

    for (const q of cf.qualifyingQuestions || []) {
      checkField(`ctwaFlow.qualifyingQuestions[${q.id}].questionText`, q.questionText, customerFacing);
      for (const o of q.options || []) {
        checkField(`ctwaFlow.qualifyingQuestions[${q.id}].options[${o.id}].label`, o.label, customerFacing);
      }
    }
    for (const o of cf.menuOptions || []) checkField(`ctwaFlow.menuOptions[${o.id}].label (legacy)`, o.label, customerFacing);
    for (const o of cf.siteVisitSlots || []) checkField(`ctwaFlow.siteVisitSlots[${o.id}].label (legacy)`, o.label, customerFacing);
    for (const o of cf.purposeOptions || []) checkField(`ctwaFlow.purposeOptions[${o.id}].label (legacy)`, o.label, customerFacing);
    for (const o of cf.budgetBrackets || []) checkField(`ctwaFlow.budgetBrackets[${o.id}].label (legacy)`, o.label, customerFacing);
    for (const o of cf.timelineOptions || []) checkField(`ctwaFlow.timelineOptions[${o.id}].label (legacy)`, o.label, customerFacing);

    // ── Prompt-only fields — GPT reads these, a customer never sees the raw text ──
    checkField("businessContext", agent.businessContext, promptOnly);
    checkField("groundRules", agent.groundRules, promptOnly);
    checkField("systemPrompt", agent.systemPrompt, promptOnly);

    if (customerFacing.length) {
      agentsWithCustomerFacingHits++;
      console.log(`⚠️  ${agent.name} (org ${agent.orgId}, ${agent.status}) — CUSTOMER-FACING`);
      for (const hit of customerFacing) {
        const flag = hit.known ? "✅ resolves correctly now" : "❌ UNKNOWN VAR — will silently vanish, not be replaced";
        console.log(`    ${hit.path}: {{${hit.key}}}  ${flag}`);
        console.log(`      "${hit.text.slice(0, 120)}${hit.text.length > 120 ? "…" : ""}"`);
      }
      console.log("");
    }
    if (promptOnly.length) {
      agentsWithPromptOnlyHits++;
      console.log(`ℹ️  ${agent.name} (org ${agent.orgId}) — prompt-only field, not sent to a customer verbatim`);
      for (const hit of promptOnly) {
        console.log(`    ${hit.path}: {{${hit.key}}}`);
      }
      console.log("");
    }
  }

  console.log("─".repeat(60));
  console.log(`${agentsWithCustomerFacingHits} agent(s) have a placeholder in a customer-facing field.`);
  console.log(`${agentsWithPromptOnlyHits} agent(s) have a placeholder in a prompt-only field (informational only).`);
  console.log("Any '✅ resolves correctly now' line is fixed by the recent deploy — no action needed.");
  console.log("Any '❌ UNKNOWN VAR' line needs the tenant to fix the wording themselves (typo, or a variable that doesn't exist).");

  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
