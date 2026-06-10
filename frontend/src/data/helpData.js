// Quick answers + guided tours for the in-app HelpBot.
// Quick answers are instant & free (no AI call). Each can navigate the user to a
// page and/or launch a guided tour. Every quick answer maps to its OWN focused
// tour so "Start tour" always matches the question that was asked.

export const QUICK_ANSWERS = [
  {
    id: "add-lead",
    q: "How do I add a new lead?",
    a: "Go to the Leads page and click the '+ Add Lead' button at the top right. You can also import leads in bulk from a CSV, or connect Facebook so they arrive automatically.",
    goto: "/leads",
    tour: "addLead",
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
    tour: "facebook",
  },
  {
    id: "assign",
    q: "How do I assign leads to my team?",
    a: "On the Leads page, open a lead and use the Assign field. Or tick several leads and use the bulk Assign action in the bar that appears. Agents get an instant notification.",
    goto: "/leads",
    tour: "assignLead",
  },
  {
    id: "followup",
    q: "How do I set and track follow-ups?",
    a: "Open any lead and pick a follow-up date. All your reminders (overdue in red, due today in amber) live on the Follow-ups page with quick Call and WhatsApp buttons.",
    goto: "/followups",
    tour: "followups",
  },
  {
    id: "pipeline",
    q: "What is the Pipeline / Kanban board?",
    a: "The Pipeline page is a visual board. Drag a lead card from one column to the next (New, Contacted, Site Visit, Negotiation, Closed) to update its status. Great for spotting stuck deals.",
    goto: "/pipeline",
    tour: "pipeline",
  },
  {
    id: "hot",
    q: "What is the 'Hot Today' widget?",
    a: "On the Dashboard, Hot Today ranks your highest-scoring leads (0-100) based on status, budget, urgency and engagement so you call the most likely-to-close leads first. Each has one-tap Call and WhatsApp.",
    goto: "/dashboard",
    tour: "hotToday",
  },
  {
    id: "ai-draft",
    q: "How do I use AI to write a WhatsApp message?",
    a: "Open any lead and click the 'AI Draft' button next to WhatsApp. It writes a personalized message using the lead's details. Edit it if you like, then send.",
    goto: "/leads",
    tour: "aiDraft",
  },
  {
    id: "report",
    q: "How do I export reports?",
    a: "On the Leads page you can export to CSV/Excel. For attendance, the Attendance page has a Download Report button (Admin). Performance metrics per agent are on the Performance page.",
    goto: "/leads",
    tour: "exportLeads",
  },
  {
    id: "team",
    q: "How do I add team members?",
    a: "Admins go to the Team page to invite agents, managers or admins. Each person gets their own role-based login.",
    goto: "/team",
    tour: "team",
  },
  {
    id: "qr-lead",
    q: "How does QR code lead capture work?",
    a: "Every org and project has its own QR code. Click the QR icon on the Leads or Projects page to view it. When a prospect scans it, they fill a public form that drops straight into your CRM — no manual entry needed. You can download, print or regenerate the QR any time.",
    goto: "/leads",
    tour: "qrLead",
  },
  {
    id: "attendance",
    q: "How do I clock in and out?",
    a: "Open the Attendance page and tap Clock In — you may need to take a selfie if your admin requires it. Tap Clock Out when you're done. Your shift hours are tracked automatically. Admins can view the full team's daily log and download reports.",
    goto: "/attendance",
    tour: "attendance",
  },
  {
    id: "bookings",
    q: "How do I create a booking and generate an invoice?",
    a: "Go to the Bookings page and click 'New Booking'. Fill in the project, unit, customer details and payment plan. Once created, open the booking and click 'Generate Invoice' to produce a PDF letterhead with your org's branding.",
    goto: "/bookings",
    tour: "bookings",
  },
  {
    id: "projects",
    q: "How do I manage projects and link leads to them?",
    a: "The Projects page lists all your real-estate projects. Open a project to see its own lead pipeline. You can add leads directly from a project, or assign a lead to a project from the lead detail panel.",
    goto: "/projects",
    tour: "projects",
  },
];

// Guided tours. Each step targets an element by data-tour attribute (preferred)
// or a CSS selector. If a target is not found on the page, that step is skipped.
//
// Tours flagged `primary: true` are the broad page walkthroughs shown as chips on
// the HelpBot welcome screen. The rest are focused, single-topic tours launched
// from a specific common question so "Start tour" always matches what was asked.
export const TOURS = {
  // ── Primary page walkthroughs (shown as welcome-screen chips) ───────────────
  dashboard: {
    label: "Dashboard tour",
    path: "/dashboard",
    primary: true,
    steps: [
      { target: '[data-tour="new-lead"]',   title: "Add a lead",            body: "Click here any time to add a new lead manually." },
      { target: '[data-tour="date-range"]', title: "Change the time range", body: "Filter every stat and chart by date - today, last 30 days, and more." },
      { target: '[data-tour="hot-today"]',  title: "Hot Today",             body: "Your highest-scoring leads to call first, with one-tap Call and WhatsApp." },
      { target: '[data-tour="stat-cards"]', title: "Your key numbers",      body: "Total leads, new, closed won, and follow-ups due - click any card to drill in." },
    ],
  },
  leads: {
    label: "Leads tour",
    path: "/leads",
    primary: true,
    steps: [
      { target: '[data-tour="add-lead-btn"]', title: "Add a lead",        body: "Create a single lead, or use Import to upload many at once." },
      { target: '[data-tour="leads-search"]', title: "Find anything fast", body: "Search by name, phone or email, and filter by status, source or agent." },
      { target: '[data-tour="leads-table"]',  title: "Your leads",        body: "Click a lead to open its details. Tick the checkboxes to assign, message or update many at once." },
    ],
  },
  pipeline: {
    label: "Pipeline tour",
    path: "/pipeline",
    primary: true,
    steps: [
      { target: '[data-tour="pipeline-board"]', title: "Your Pipeline board", body: "Each column is a stage in your sales process. Drag cards left or right to move a lead forward. Great for spotting stuck deals at a glance." },
    ],
  },
  followups: {
    label: "Follow-ups tour",
    path: "/followups",
    primary: true,
    steps: [
      { target: '[data-tour="followup-tabs"]',  title: "Overdue and Upcoming", body: "Switch between Overdue (missed follow-ups) and Upcoming (scheduled calls). Red means urgent." },
      { target: '[data-tour="followup-table"]', title: "Follow-up list",       body: "Each row shows the lead, follow-up date, and quick Call and WhatsApp buttons - act without leaving this page." },
    ],
  },

  // ── Focused, single-topic tours (launched from a common question) ───────────
  addLead: {
    label: "Add a lead tour",
    path: "/leads",
    steps: [
      { target: '[data-tour="add-lead-btn"]', title: "Add a lead", body: "Click here to add a single lead. To upload many at once, use the Import icon just to the left and pick a CSV or Excel file." },
    ],
  },
  assignLead: {
    label: "Assign leads tour",
    path: "/leads",
    steps: [
      { target: '[data-tour="leads-table"]', title: "Assign leads", body: "Tick the checkboxes on the left of any leads, then use the bulk Assign action in the bar that appears. Or click a single lead to open it and use the Assign field inside. The agent gets an instant notification." },
    ],
  },
  aiDraft: {
    label: "AI WhatsApp tour",
    path: "/leads",
    steps: [
      { target: '[data-tour="leads-table"]', title: "AI WhatsApp draft", body: "Click any lead to open its detail panel, then tap the 'AI Draft' button next to WhatsApp. Artha writes a personalized message from the lead's details - edit it if you like, then send." },
    ],
  },
  exportLeads: {
    label: "Export tour",
    path: "/leads",
    steps: [
      { target: '[data-tour="export-btn"]', title: "Export your leads", body: "Click here to export to CSV or Excel. Any filters you've set apply to the export, so you can download just the leads you need." },
    ],
  },
  hotToday: {
    label: "Hot Today tour",
    path: "/dashboard",
    steps: [
      { target: '[data-tour="hot-today"]', title: "Hot Today", body: "These are your highest-scoring leads (0-100), ranked by status, budget, urgency and engagement. Call these first - each row has one-tap Call and WhatsApp." },
    ],
  },
  facebook: {
    label: "Facebook tour",
    path: "/automation",
    steps: [
      { target: '[data-tour="fb-connect"]', title: "Connect Facebook Lead Ads", body: "Click the Facebook tile, connect your Meta account and pick your lead form. Every new submission then imports into the CRM automatically and can be auto-assigned." },
    ],
  },
  team: {
    label: "Team tour",
    path: "/team",
    steps: [
      { target: '[data-tour="invite-btn"]', title: "Add team members", body: "Click 'Add Team Member' to invite an agent, manager or admin. Each person gets their own role-based login and can start handling leads right away." },
    ],
  },
  qrLead: {
    label: "QR Lead Capture tour",
    path: "/leads",
    steps: [
      { target: '[data-tour="add-lead-btn"]', title: "QR Code lead capture", body: "Click the QR icon near the top of the Leads page to open your org QR code. Print or share it — when a prospect scans it they fill a public form that lands straight in your CRM." },
    ],
  },
  attendance: {
    label: "Attendance tour",
    path: "/attendance",
    steps: [
      { target: '[data-tour="clock-in-btn"]', title: "Clock in", body: "Tap Clock In to start your shift. If your admin requires it, take a quick selfie to confirm your identity. Clock Out the same way when you're done." },
    ],
  },
  bookings: {
    label: "Bookings tour",
    path: "/bookings",
    steps: [
      { target: '[data-tour="new-booking-btn"]', title: "Create a booking", body: "Click 'New Booking' to record a sale. Fill in the project, unit, customer and payment schedule. You can then generate a branded PDF invoice straight from the booking detail." },
    ],
  },
  projects: {
    label: "Projects tour",
    path: "/projects",
    steps: [
      { target: '[data-tour="add-project-btn"]', title: "Add a project", body: "Click 'New Project' to create a property project. Each project gets its own lead pipeline, QR code and booking list so you can track every unit separately." },
    ],
  },
};
