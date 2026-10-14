// Starter buttons for an empty Artha chat: picked by page and role, no AI call,
// so they appear instantly. At most 4. Every one must be answerable by the tools.
const COMMON_AGENT = ["Who should I call first today?", "Show my overdue follow-ups"];
const COMMON_LEAD = ["Team follow-ups overdue today", "Leads by source this month"];

const BY_PAGE = {
  "/leads": { agent: ["Who should I call first today?", "My new leads not contacted yet", "Leads I got this week"], lead: ["New leads this week by source", "Unassigned leads", "Leads by owner this month"] },
  "/followups": { agent: ["Show my overdue follow-ups", "What's due tomorrow?", "Who should I call first today?"], lead: ["Overdue follow-ups across the team", "Follow-ups due today", "What's due tomorrow?"] },
  "/pipeline": { agent: ["How many of my leads are at each stage?", "My leads in Site Visit"], lead: ["Pipeline by stage this month", "Leads stuck in Contacted", "Site visits this month"] },
  "/tasks": { agent: ["My tasks due today", "My overdue tasks"], lead: ["Overdue tasks across the team", "Tasks due today"] },
  "/projects": { agent: ["My projects", "Leads in my projects by stage"], lead: ["Leads per project", "Projects list"] },
  "/dashboard": { agent: COMMON_AGENT.concat("How many leads did I get this week?"), lead: COMMON_LEAD.concat("Who has the most overdue follow-ups?") },
};
const HELP = ["How do I connect Facebook leads?", "How do I import leads from Excel?"];

function startersFor({ role, page }) {
  const clean = String(page || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const key = Object.keys(BY_PAGE).find((p) => clean === p || clean.startsWith(`${p}/`)) || "/dashboard";
  const set = BY_PAGE[key][role === "agent" ? "agent" : "lead"];
  const extra = role === "agent" ? HELP.slice(1) : HELP.slice(0, 1);
  return [...new Set([...set, ...extra])].slice(0, 4);
}

module.exports = { startersFor };
