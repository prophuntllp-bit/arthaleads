// Phase 2 verification: the registry's gates, and the per-request prompt.
// Pure logic — no database, no network, no writes.
const assert = require("assert");
const actions = require("../actions");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};
function expectThrow(name, fn, wantStatus, wantFlag) {
  try {
    fn();
    check(name, false, "did NOT throw — gate is open");
  } catch (err) {
    const okStatus = err.statusCode === wantStatus;
    const okFlag = wantFlag ? Boolean(err[wantFlag]) : true;
    check(name, okStatus && okFlag, `${err.statusCode} ${err.message}`);
  }
}

const LEAD = "6a16aa89dfb452ddd538f553";
const AGENT = "69e1caa21aecbc5b4aece516";

console.log("=== G2 role gate ===");
expectThrow("agent cannot assign_lead",
  () => actions.authorise({ id: "assign_lead", params: { leadId: LEAD, agentId: AGENT }, role: "agent", page: "/leads" }), 403);
check("manager can assign_lead",
  Boolean(actions.authorise({ id: "assign_lead", params: { leadId: LEAD, agentId: AGENT }, role: "manager", page: "/leads" }).action));
check("agent CAN add a note",
  Boolean(actions.authorise({ id: "add_lead_note", params: { leadId: LEAD, note: "hi" }, role: "agent", page: "/leads" }).action));

console.log("\n=== G3 page gate ===");
expectThrow("assign_lead refused from /tasks",
  () => actions.authorise({ id: "assign_lead", params: { leadId: LEAD, agentId: AGENT }, role: "admin", page: "/tasks" }), 409, "needsScapeChangeTypo" && "needsScopeChange");
check("same action allowed once scope confirmed",
  Boolean(actions.authorise({ id: "assign_lead", params: { leadId: LEAD, agentId: AGENT }, role: "admin", page: "/tasks", scopeConfirmed: true }).action));
expectThrow("complete_task refused from /leads",
  () => actions.authorise({ id: "complete_task", params: { taskId: LEAD }, role: "admin", page: "/leads" }), 409, "needsScopeChange");
check("query string on page does not defeat the gate",
  Boolean(actions.authorise({ id: "add_lead_note", params: { leadId: LEAD, note: "x" }, role: "agent", page: "/leads?tab=all" }).action));
check("trailing slash normalised",
  Boolean(actions.authorise({ id: "add_lead_note", params: { leadId: LEAD, note: "x" }, role: "agent", page: "/leads/" }).action));

console.log("\n=== param validation ===");
expectThrow("bad status rejected",
  () => actions.authorise({ id: "update_lead_status", params: { leadId: LEAD, status: "Nonsense" }, role: "admin", page: "/leads" }), 400);
expectThrow("non-objectid leadId rejected",
  () => actions.authorise({ id: "add_lead_note", params: { leadId: "abc", note: "x" }, role: "admin", page: "/leads" }), 400);
expectThrow("empty note rejected",
  () => actions.authorise({ id: "add_lead_note", params: { leadId: LEAD, note: "   " }, role: "admin", page: "/leads" }), 400);
expectThrow("unknown action rejected",
  () => actions.authorise({ id: "delete_everything", params: {}, role: "admin", page: "/leads" }), 400);

const stripped = actions.authorise({
  id: "add_lead_note",
  params: { leadId: LEAD, note: "keep", orgId: "SMUGGLED", isAdmin: true },
  role: "admin", page: "/leads",
});
check("unknown params stripped", !("orgId" in stripped.params) && !("isAdmin" in stripped.params),
  JSON.stringify(stripped.params));

console.log("\n=== catalogue is filtered per role + page ===");
const adminLeads = actions.catalogueFor({ role: "admin", page: "/leads" });
const agentLeads = actions.catalogueFor({ role: "agent", page: "/leads" });
const adminTasks = actions.catalogueFor({ role: "admin", page: "/tasks" });
check("admin on /leads sees assign_lead", adminLeads.includes("assign_lead"));
check("agent on /leads does NOT see assign_lead", !agentLeads.includes("assign_lead"));
check("admin on /tasks sees only complete_task",
  adminTasks.includes("complete_task") && !adminTasks.includes("assign_lead"));
check("catalogue lists valid statuses", adminLeads.includes("Closed Won"));

const none = actions.catalogueFor({ role: "agent", page: "/billing" });
check("unknown page yields no actions", none === "", JSON.stringify(none));

console.log("\n=== the generated prompt actually replaces the static block ===");
const { __test } = require("../utils/openai");
if (!__test || !__test.buildSystemPrompt) {
  check("buildSystemPrompt exported for testing", false, "not exported");
} else {
  const base = __test.HELP_SYSTEM_PROMPT;
  const built = __test.buildSystemPrompt(agentLeads);
  check("prompt changed (regex matched — not a silent no-op)", built !== base);
  check("old hardcoded assign_lead line is gone for an agent", !built.includes("3. assign_lead"));
  check("agent's catalogue is present", built.includes("add_lead_note"));
  check("RESPONSE RULES survived the splice", built.includes("RESPONSE RULES"));
  check("knowledge base survived the splice", built.includes("PIPELINE / KANBAN"));

  const empty = __test.buildSystemPrompt("");
  check("no-actions case says so explicitly", empty.includes("NO write actions"));

  const untouched = __test.buildSystemPrompt(null);
  check("null catalogue leaves prompt unchanged", untouched === base);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
