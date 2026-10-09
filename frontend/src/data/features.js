import {
  Layers, Building2, Sparkles, QrCode, MessageCircle, PhoneCall, Headphones,
  BarChart3, Users, Camera, Bell, FileText, Bot, Filter, TrendingUp, Activity, Shield,
  ShieldCheck, ArrowLeftRight, ArchiveRestore, MessagesSquare, Receipt, Handshake,
  Wallet, Clock, ListChecks, Trash2, UserPlus, PlugZap, Target, LifeBuoy, Search,
} from "lucide-react";

/**
 * Single source of truth for the product feature list.
 *
 * The full catalogue lives on /features, grouped by the job a sales team is
 * doing (capture, prioritise, talk, manage projects, close, run the team,
 * stay in control). The home page shows only the handful named in
 * HOME_FEATURE_TITLES, using each one's `short` copy.
 *
 * Every line here must describe what the product actually does today. If a
 * feature changes, change its copy in the same commit.
 */
export const FEATURE_GROUPS = [
  { id: "capture",    label: "Capture",         title: "Every enquiry lands in one place",
    blurb: "Ads, portals, WhatsApp, your website and walk-ins arrive as leads with their source attached, without copy-paste." },
  { id: "prioritise", label: "Prioritise",      title: "Know who to call first",
    blurb: "Scores, alerts and search point your team at the buyers most likely to move today." },
  { id: "talk",       label: "Talk",            title: "WhatsApp and calls, inside the CRM",
    blurb: "Reply, run campaigns and call from the lead itself, with the history saved where everyone can see it." },
  { id: "projects",   label: "Projects",        title: "Run every project and pipeline",
    blurb: "Keep each project's leads, team and media together, and move people between projects without losing history." },
  { id: "close",      label: "Close",           title: "Close the deal and get paid",
    blurb: "Bookings, brokerage, GST and invoices in the same place as the lead that closed." },
  { id: "team",       label: "Team",            title: "Run the sales team",
    blurb: "Attendance, tasks, roles and performance, so managers see the work without chasing it." },
  { id: "control",    label: "Control",         title: "Stay in control of your workspace",
    blurb: "Secure, separate data for every company, with help one click away." },
];

export const FEATURES = [
  // ── Capture ──
  { group: "capture",    icon: Layers,     color: "#ff6b00", title: "Unified Lead Inbox",       short: "Facebook, WhatsApp, Google Ads, portals and walk-ins all land in one place.", desc: "Every lead from Facebook, WhatsApp, Google Ads, walk-ins and portals lands in one place. No more juggling spreadsheets or missing follow-ups across platforms." },
  { group: "capture",    icon: QrCode,     color: "#14b8a6", title: "QR Code Lead Capture",      desc: "Every org and project gets a unique QR code. Put it on site hoardings, brochures, or expo stalls. A prospect scans it, fills a form on their phone, and the lead lands in your CRM instantly, with the source tagged." },
  { group: "capture",    icon: Filter,     color: "#14b8a6", title: "Duplicate Prevention",      desc: "The import engine detects and skips duplicate phone numbers automatically, even across different formats. Every agent calls a unique lead." },
  { group: "capture",    icon: PlugZap,    color: "#0ea5e9", title: "Connection Health & Repair", desc: "Every integration card shows whether it is live, paused or needs attention. Pause a source, run a diagnosis to see what went wrong, refresh an expiring token or reconnect, all from the same card." },

  // ── Prioritise ──
  { group: "prioritise", icon: Sparkles,   color: "#ff6b00", title: "AI Lead Scoring",           short: "Every lead scored 0–100 on budget, urgency and engagement, so agents know who to call first.", desc: "Every lead is automatically scored 0–100 from signals such as budget, how recently it came in, pipeline stage, follow-ups and activity, using fixed rules you can rely on. Your Hot Today widget shows agents the top-scoring leads to call every morning." },
  { group: "prioritise", icon: Bell,       color: "#ec4899", title: "Smart Alerts & Follow-ups", desc: "Colour-coded reminders: red for overdue, amber for due today. One-tap call or WhatsApp from the follow-up list. Push notifications for every new lead assignment so nothing slips through." },
  { group: "prioritise", icon: Search,     color: "#64748b", title: "Search Everything",         desc: "Press Ctrl+K (Cmd+K on Mac) on any page to find a lead by name or phone number, with live suggestions as you type." },
  { group: "prioritise", icon: Activity,   color: "#6366f1", title: "Admin Intelligence Dashboard", desc: "Admin panels in one screen: stale lead alerts (7+ days without a touch), revenue forecast against goal, weekly lead trend, live agent clock-in status, lead source health and project-wise conversion." },

  // ── Talk ──
  { group: "talk",       icon: MessageCircle, color: "#25D366", title: "AI WhatsApp Draft",      short: "AI drafts a personalised message per lead. Your agent reviews and sends in seconds.", desc: "AI writes a personalised WhatsApp message for any lead using their name, project interest and budget. The agent reviews it and sends in seconds." },
  { group: "talk",       icon: ShieldCheck, color: "#16a34a", title: "WhatsApp Consent",         desc: "Each lead carries a WhatsApp consent status: granted, denied or unknown. Campaigns and marketing templates skip anyone who said no, and you can filter your audience by consent before you send." },
  { group: "talk",       icon: Wallet,     color: "#f59e0b", title: "WhatsApp Credits & Statements", desc: "WhatsApp messages are paid from a prepaid credit balance. Top up online in a few clicks, see a statement of every charge, and use the free monthly allowance of service replies first." },
  { group: "talk",       icon: Clock,      color: "#0891b2", title: "WhatsApp Business Settings", desc: "Set your WhatsApp business profile, business hours with an automatic away message, conversation auto-assignment, and who on the team gets notified for each kind of event." },
  { group: "talk",       icon: Headphones, color: "#8b5cf6", title: "AI Call Intelligence",      short: "Calls are transcribed, summarised and scored for intent, and move the lead's stage on their own.", desc: "One-tap click-to-call bridges your phone straight to the lead's number. Every recording is transcribed with AI-detected intent and sentiment, a summary and next-step suggestions, and can advance the lead's pipeline stage the moment it hears 'site visit' or 'negotiating'." },
  { group: "talk",       icon: PhoneCall,  color: "#3b82f6", title: "Telecaller Workflow",       desc: "Remark tracking, booking status, follow-up scheduling and call outcomes for your calling team. Never let a hot lead go cold again." },

  // ── Projects ──
  { group: "projects",   icon: TrendingUp, color: "#ff6b00", title: "Lead Pipeline",             short: "Drag leads through New, Contacted, Site Visit, Negotiation and Closed Won. See the whole funnel at once.", desc: "A Kanban pipeline lets you drag leads through stages, from New and Contacted to Site Visit, Negotiation and Closed Won. See your entire sales funnel at a glance." },
  { group: "projects",   icon: Building2,  color: "#22c55e", title: "Project Management",        desc: "Run multiple real estate projects at once. Import thousands of leads per project, track their status, share brochures, floor plans and videos, and assign telecallers, all in one workspace." },
  { group: "projects",   icon: ArrowLeftRight, color: "#0ea5e9", title: "Move Leads Between Projects", desc: "Transfer a lead from one project to another, or back to your main list, and it keeps its notes, follow-up, status and history. Nothing is retyped and nothing is lost." },
  { group: "projects",   icon: MessagesSquare, color: "#25D366", title: "Project WhatsApp History", desc: "Open any project lead and read its full WhatsApp conversation right there, without switching to the inbox." },
  { group: "projects",   icon: ArchiveRestore, color: "#a855f7", title: "Project Dump Recovery",   desc: "Leads removed from a project go to that project's dump, not into thin air. Restore any of them to the same project in one click." },
  { group: "projects",   icon: Trash2,     color: "#ef4444", title: "Dump Review & Clean-up",    desc: "Deleted leads wait in the Dump instead of disappearing. Review them, restore them (a lead removed from a project goes back to that project), or remove them for good when you are sure." },

  // ── Close ──
  { group: "close",      icon: FileText,   color: "#22c55e", title: "Booking & Invoice Engine",  short: "Close a deal, get a branded PDF invoice with brokerage and GST already worked out.", desc: "Turn a closed deal into a booking in one click. Brokerage and GST (CGST/SGST/IGST) are calculated for you, and a branded PDF invoice carries your logo, RERA number and bank details." },
  { group: "close",      icon: Receipt,    color: "#16a34a", title: "Invoice Numbers & Status",  desc: "Invoices are numbered in sequence automatically and move through Draft, Sent, Payment pending and Payment received, with totals for every status." },
  { group: "close",      icon: Handshake,  color: "#f97316", title: "Developer Partners",        desc: "Keep a list of the developers you sell for, each with a default brokerage percentage that fills in on every new booking. Zero per cent is allowed." },
  { group: "close",      icon: Target,     color: "#1877F2", title: "Meta Conversions API",      desc: "Send lead outcomes such as a new lead, a site visit and a closed deal back to Meta, so your ads find more buyers like the ones who actually close. Choose the stages, send a test event, and see a log of what was sent." },

  // ── Team ──
  { group: "team",       icon: Users,      color: "#f59e0b", title: "Team Management",           desc: "Admin, Manager and Agent roles with controlled access. Track attendance, monitor individual performance and manage the whole sales team from one panel." },
  { group: "team",       icon: UserPlus,   color: "#0ea5e9", title: "Seat Usage",                desc: "See how many seats you have paid for and how many are in use. Deactivating someone frees their seat for the next person you add." },
  { group: "team",       icon: ListChecks, color: "#8b5cf6", title: "Tasks",                     desc: "Managers assign tasks to anyone on the team, linked to a lead or project, with a due date. People tick them off with a completion note so managers see what was done." },
  { group: "team",       icon: Camera,     color: "#3b82f6", title: "Attendance & Selfie Clock-In", desc: "Field agents clock in and out from their phone with a selfie and location. No paper registers, no WhatsApp check-ins. Admins see attendance live and download monthly reports." },
  { group: "team",       icon: BarChart3,  color: "#a855f7", title: "Performance Analytics",     desc: "Dashboards for lead sources, team conversion rates, follow-up completion and the deal pipeline, with a drill-down for every team member." },

  // ── Control ──
  { group: "control",    icon: Shield,     color: "#22c55e", title: "Secure & Multi-tenant",     desc: "Every company's data is kept completely separate, and role-based access means agents only see the leads and projects assigned to them." },
  { group: "control",    icon: Bot,        color: "#a855f7", title: "AI Copilot & Help Bot",     desc: "An AI assistant on every page. Ask 'How many overdue follow-ups do I have?' or 'Who are my hottest leads?' and get answers from your own CRM data." },
  { group: "control",    icon: LifeBuoy,   color: "#ec4899", title: "Support Tickets",           desc: "Raise a support ticket from inside the CRM, attach screenshots, and follow every reply in one thread." },
];

/** The six shown on the home page, in display order. */
export const HOME_FEATURE_TITLES = [
  "Unified Lead Inbox",
  "AI Lead Scoring",
  "AI Call Intelligence",
  "Lead Pipeline",
  "AI WhatsApp Draft",
  "Booking & Invoice Engine",
];

export const HOME_FEATURES = HOME_FEATURE_TITLES
  .map((t) => FEATURES.find((f) => f.title === t))
  .filter(Boolean);
