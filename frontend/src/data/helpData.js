// Quick answers + guided tours for the in-app HelpBot.
// Quick answers are instant & free (no AI call). Each can navigate the user to a
// page and/or launch a guided tour.

export const QUICK_ANSWERS = [
  {
    id: "add-lead",
    q: "How do I add a new lead?",
    a: "Go to the Leads page and click the “+ New Lead” button at the top right. You can also import leads in bulk from a CSV, or connect Facebook so they arrive automatically.",
    goto: "/leads",
    tour: "leads",
  },
  {
    id: "find-feature",
    q: "Where do I find everything? (CRM tour)",
    a: "Use the left sidebar to move between Dashboard, Leads, Pipeline, Follow-ups, Projects and more. Let me give you a quick tour of the dashboard.",
    goto: "/dashboard",
    tour: "dashboard",
  },
  {
    id: "facebook",
    q: "How do I connect Facebook lead ads?",
    a: "Open the Automation page (Admin/Manager only), choose Facebook Lead Ads, connect your Meta account and pick your lead form. Every new submission then imports into the CRM automatically.",
    goto: "/automation",
  },
  {
    id: "assign",
    q: "How do I assign leads to my team?",
    a: "On the Leads page, open a lead and use the Assign field — or tick several leads and use the bulk “Assign” action in the bar that appears. Agents get an instant notification.",
    goto: "/leads",
  },
  {
    id: "followup",
    q: "How do I set and track follow-ups?",
    a: "Open any lead and pick a follow-up date. All your reminders — overdue (red) and due today (amber) — live on the Follow-ups page with quick Call & WhatsApp buttons.",
    goto: "/followups",
  },
  {
    id: "pipeline",
    q: "What is the Pipeline / Kanban board?",
    a: "The Pipeline page is a visual board. Drag a lead card from one column to the next (New → Contacted → Site Visit → Negotiation → Closed) to update its status. Great for spotting stuck deals.",
    goto: "/pipeline",
  },
  {
    id: "hot",
    q: "What is the “Hot Today” widget?",
    a: "On the Dashboard, Hot Today ranks your highest-scoring leads (0–100) based on status, budget, urgency and engagement — so you call the most likely-to-close leads first. Each has one-tap Call & WhatsApp.",
    goto: "/dashboard",
  },
  {
    id: "ai-draft",
    q: "How do I use AI to write a WhatsApp message?",
    a: "Open any lead and click the “AI Draft” button next to WhatsApp. It writes a personalized message using the lead’s details. Edit it if you like, then send.",
    goto: "/leads",
  },
  {
    id: "report",
    q: "How do I export reports?",
    a: "On the Leads page you can export to CSV/Excel. For attendance, the Attendance page has a “Download Report” button (Admin). Performance metrics per agent are on the Performance page.",
    goto: "/leads",
  },
  {
    id: "team",
    q: "How do I add team members?",
    a: "Admins go to the Team page to invite agents, managers or admins. Each person gets their own role-based login.",
    goto: "/team",
  },
];

// Guided tours. Each step targets an element by data-tour attribute (preferred)
// or a CSS selector. If a target isn't found on the page, that step is skipped.
export const TOURS = {
  dashboard: {
    label: "Dashboard tour",
    path: "/dashboard",
    steps: [
      { target: '[data-tour="new-lead"]', title: "Add a lead", body: "Click here any time to add a new lead manually." },
      { target: '[data-tour="date-range"]', title: "Change the time range", body: "Filter every stat and chart by date — today, last 30 days, and more." },
      { target: '[data-tour="hot-today"]', title: "Hot Today", body: "Your highest-scoring leads to call first, with one-tap Call & WhatsApp." },
      { target: '[data-tour="stat-cards"]', title: "Your key numbers", body: "Total leads, new, closed won, and follow-ups due — click any card to drill in." },
    ],
  },
  leads: {
    label: "Leads tour",
    path: "/leads",
    steps: [
      { target: '[data-tour="add-lead-btn"]', title: "Add a lead", body: "Create a single lead, or use Import to upload many at once." },
      { target: '[data-tour="leads-search"]', title: "Find anything fast", body: "Search by name, phone or email, and filter by status, source or agent." },
      { target: '[data-tour="leads-table"]', title: "Your leads", body: "Click a lead to open its details. Tick the checkboxes to assign, message or update many at once." },
    ],
  },
};
