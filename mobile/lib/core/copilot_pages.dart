// GENERATED-EQUIVALENT: mirrors PAGE_COPILOT in
// frontend/src/components/HelpBot.jsx. Keep the two in step -- the chips are
// the same questions, deliberately, so a person who learns the web assistant
// finds the same prompts on their phone.
//
// The `path` is the load-bearing field. backend/utils/copilotContext.js keys
// its live database lookups on the WEB route ("/followups", "/pipeline"), and
// backend/actions scopes which actions may run from it. Sending anything else
// -- the mobile screen name, or the literal string "mobile", which is what this
// app sent until now -- matches no branch, so the assistant is handed no data
// and can only answer with directions to the screen the person is already on.

/// One screen's copilot identity: the route the backend understands, the name
/// shown to the user, and the starter questions for it.
class CopilotPage {
  final String path;
  final String label;
  final List<String> chips;

  const CopilotPage(this.path, this.label, this.chips);
}

/// Keyed by the drawer label in screens/shell.dart, which is the only handle
/// the shell has on "where the user is" -- there is no route table to read.
const Map<String, CopilotPage> copilotPages = {
  "Dashboard": CopilotPage(
    "/dashboard",
    "Dashboard",
    [
      "How many new leads came in today?",
      "Who are my hottest leads right now?",
      "How many overdue follow-ups do I have?",
      "What's our total pipeline value?",
    ],
  ),
  "Leads": CopilotPage(
    "/leads",
    "Lead Management",
    [
      "How many new leads today?",
      "Show me hot leads",
      "Which leads are overdue for follow-up?",
      "How many leads came from Facebook?",
    ],
  ),
  "Follow-ups": CopilotPage(
    "/followups",
    "Follow-ups",
    [
      "How many follow-ups are overdue?",
      "How many are due today?",
      "Who are the most overdue leads?",
      "How do I set a follow-up?",
    ],
  ),
  "Pipeline": CopilotPage(
    "/pipeline",
    "Pipeline",
    [
      "How many leads are in Negotiation?",
      "Which stage has the most leads?",
      "How many were Closed Won this month?",
      "How do I move a lead to Site Visit?",
    ],
  ),
  "Projects": CopilotPage(
    "/projects",
    "Projects",
    [
      "How do I add leads to a project?",
      "Which project has the most leads?",
      "How do I view the project pipeline?",
    ],
  ),
  "Developers": CopilotPage(
    "/developers",
    "Developers",
    [
      "How do I add a developer?",
      "Why doesn't my developer appear in the booking form?",
    ],
  ),
  "Tasks": CopilotPage(
    "/tasks",
    "Tasks",
    [
      "How many tasks are pending?",
      "Which tasks are overdue?",
      "How do I assign a task to a team member?",
      "How do I mark a task as complete?",
    ],
  ),
  "Calls": CopilotPage(
    "/calls",
    "Calls",
    [
      "How do I call a lead?",
      "Why is my call not bridging to the lead?",
      "How does AI call analysis work?",
      "How do I enable AI auto-status updates?",
    ],
  ),
  "Attendance": CopilotPage(
    "/attendance",
    "Attendance",
    [
      "Am I clocked in today?",
      "How many hours have I worked today?",
      "How do I clock out?",
      "How do I edit my attendance?",
    ],
  ),
  "Bookings": CopilotPage(
    "/bookings",
    "Bookings",
    [
      "How many bookings are pending invoices?",
      "How do I create a new booking?",
      "How do I generate an invoice from a booking?",
      "How do I delete a booking?",
    ],
  ),
  "Dump": CopilotPage(
    "/dump-leads",
    "Dump Leads",
    [
      "What are dump leads?",
      "How do I restore a dump lead?",
      "How do I permanently delete a dump lead?",
    ],
  ),
  "Team": CopilotPage(
    "/team",
    "Team",
    [
      "How do I invite a new agent?",
      "What's the difference between roles?",
      "How do I deactivate a team member?",
    ],
  ),
  "Performance": CopilotPage(
    "/performance",
    "Performance",
    [
      "Who is the top performer right now?",
      "How many site visits did the team do?",
      "Which agent has the best conversion rate?",
      "How do I export this report?",
    ],
  ),
  "Invoices": CopilotPage(
    "/invoices",
    "Invoices",
    [
      "How many invoices are awaiting payment?",
      "How do I download an invoice as PDF?",
      "How do I change the invoice status?",
      "Why is my invoice missing company details?",
    ],
  ),
  "Integrations": CopilotPage(
    "/integrations",
    "Integrations",
    [
      "How do I connect Facebook Lead Ads?",
      "How do I set up auto-routing?",
      "How does the WordPress plugin work?",
    ],
  ),
  "Settings": CopilotPage(
    "/settings",
    "Settings",
    [
      "How do I fill in org billing details for invoices?",
      "How do I upload the company logo?",
      "How do I change my password?",
      "What are the required fields for invoice generation?",
    ],
  ),
};

/// The copilot identity for a drawer label, or null for a screen the web has
/// no entry for either. Callers fall back to a generic greeting, exactly as
/// HelpBot.jsx does on an unlisted route.
CopilotPage? copilotPageFor(String? navLabel) =>
    navLabel == null ? null : copilotPages[navLabel];
