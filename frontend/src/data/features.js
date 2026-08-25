import {
  Layers, Building2, Sparkles, QrCode, MessageCircle, PhoneCall, Headphones,
  BarChart3, Users, Camera, Bell, FileText, Bot, Filter, TrendingUp, Activity, Shield,
} from "lucide-react";

/**
 * Single source of truth for the product feature list.
 *
 * The full catalogue lives on /features. The home page shows only the handful
 * named in HOME_FEATURE_TITLES, using each one's `short` copy — the long `desc`
 * is reference material and reads as wall-of-text above the fold.
 */
export const FEATURES = [
  { cat: "leads",      icon: Layers,     color: "#ff6b00", title: "Unified Lead Inbox",       short: "Facebook, WhatsApp, Google Ads, portals and walk-ins all land in one place.", desc: "Every lead from Facebook, WhatsApp, Google Ads, walk-ins and portals lands in one place. No more juggling spreadsheets or missing follow-ups across platforms." },
  { cat: "leads",      icon: Building2,  color: "#22c55e", title: "Project Management",        desc: "Run multiple real estate projects simultaneously. Import thousands of leads per project, track their status, and assign telecallers - all in one workspace." },
  { cat: "leads",      icon: Sparkles,   color: "#ff6b00", title: "AI Lead Scoring",           short: "Every lead scored 0–100 on budget, urgency and engagement, so agents know who to call first.", desc: "Every lead is automatically scored 0–100 by AI based on budget, urgency, pipeline stage, and engagement. Your Hot Today widget shows agents their top leads to call every morning — no guessing." },
  { cat: "automation", icon: QrCode,     color: "#14b8a6", title: "QR Code Lead Capture",      desc: "Every org and project gets a unique QR code. Put it on site hoardings, brochures, or expo stalls. A prospect scans it, fills a form on their phone, and the lead lands in your CRM instantly — with source tagged." },
  { cat: "automation", icon: MessageCircle, color: "#25D366", title: "AI WhatsApp Draft",      short: "AI drafts a personalised message per lead. Your agent reviews and sends in seconds.", desc: "AI writes a personalized WhatsApp message for any lead using their name, project interest, and budget. Agent reviews and sends in seconds. Saves 10–15 minutes per agent per day." },
  { cat: "team",       icon: PhoneCall,  color: "#3b82f6", title: "Telecaller Workflow",       desc: "Streamline your calling team with remark tracking, booking status, follow-up scheduling, and call outcomes. Never let a hot lead go cold again." },
  { cat: "automation", icon: Headphones, color: "#8b5cf6", title: "AI Call Intelligence",      short: "Calls are transcribed, summarised and scored for intent — and move the lead's stage on their own.", desc: "One-tap click-to-call bridges your phone straight to the lead's number. Every recording is auto-transcribed with AI-detected intent and sentiment, a summary, and next-step suggestions — and can auto-advance the lead's pipeline stage the moment it hears 'site visit' or 'negotiating'." },
  { cat: "analytics",  icon: BarChart3,  color: "#a855f7", title: "Performance Analytics",     desc: "Real-time dashboards showing lead sources, team conversion rates, follow-up completion, and deal pipeline. Make data-driven decisions every day." },
  { cat: "team",       icon: Users,      color: "#f59e0b", title: "Team Management",           desc: "Assign roles - Admin, Manager, Agent - with controlled access. Track attendance, monitor individual performance, and manage the entire sales team from one panel." },
  { cat: "team",       icon: Camera,     color: "#3b82f6", title: "Attendance & Selfie Clock-In", desc: "Field agents clock in and out from their phone with a selfie — no paper registers, no WhatsApp check-ins. Admins see real-time attendance and download monthly reports in one click." },
  { cat: "automation", icon: Bell,       color: "#ec4899", title: "Smart Alerts & Follow-ups", desc: "Color-coded reminders: red for overdue, amber for due today. One-tap call or WhatsApp from the follow-up list. Push notifications for every new lead assignment so nothing slips through." },
  { cat: "leads",      icon: FileText,   color: "#22c55e", title: "Booking & Invoice Engine",  short: "Close a deal, get a branded PDF invoice with brokerage and GST already worked out.", desc: "Convert a closed deal to a booking in one click. Auto-calculates brokerage and GST (CGST/SGST/IGST). Generates a branded PDF invoice with your logo, RERA number, and bank details — ready in 2 minutes." },
  { cat: "automation", icon: Bot,        color: "#a855f7", title: "AI Copilot & Help Bot",     desc: "An AI assistant built into every page. Ask live questions like 'How many overdue follow-ups do I have?' or 'Who are my hottest leads?' — and get instant answers from your own CRM data." },
  { cat: "leads",      icon: Filter,     color: "#14b8a6", title: "Duplicate Prevention",      desc: "Our intelligent import engine detects and skips duplicate phone numbers automatically - even across different formats. Every agent calls a unique lead." },
  { cat: "leads",      icon: TrendingUp, color: "#ff6b00", title: "Lead Pipeline",             short: "Drag leads through New, Contacted, Site Visit, Booked and Closed. See the whole funnel at once.", desc: "Kanban-style pipeline view lets you drag leads through stages - New, Contacted, Site Visit, Booked, Closed. Visualise your entire sales funnel at a glance." },
  { cat: "analytics",  icon: Activity,   color: "#6366f1", title: "Admin Intelligence Dashboard", desc: "Six real-time admin panels in one screen: stale lead alerts (7+ days no touch), revenue forecast vs goal, weekly lead trend chart, live agent clock-in status, automation health, and project-wise conversion breakdown." },
  { cat: "analytics",  icon: Shield,     color: "#22c55e", title: "Secure & Multi-tenant",     desc: "Enterprise-grade data isolation. Every organisation's data is completely separate. Role-based access ensures agents only see what they're supposed to." },
];

export const FEAT_FILTERS = [
  { id: "all",        label: "All Features",    color: "#ff6b00" },
  { id: "leads",      label: "Lead Management", color: "#14b8a6" },
  { id: "team",       label: "Team",            color: "#3b82f6" },
  { id: "analytics",  label: "Analytics",       color: "#a855f7" },
  { id: "automation", label: "Automation",      color: "#ec4899" },
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
