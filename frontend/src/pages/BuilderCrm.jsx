// pages/BuilderCrm.jsx - /builder-crm, "Builder CRM for real estate developers".
//
// Targets "builder crm" (100-1K a month in India), "crm for real estate
// developers" and "crm for builders" (Google Trends scaled to the owner's
// Keyword Planner data, Oct 2026). Keyword plan:
// https://claude.ai/artifact/CuDksmB3zWyQ77fbh5jUdH
//
// Every claim must match the product and its plan (data/plans.js, data/features.js,
// backend planGate, re-checked 23 Oct 2026). Portal leads (99acres, MagicBricks,
// Housing.com) are a sheet import, never "automatic". There is no channel
// partner portal: do not claim one. Google lead forms (Google Ads) are claimed
// as Enterprise only, per owner 23 Oct 2026. Duplicate flagging works on
// every plan; auto-assignment (round-robin, per pricing and the API since
// 24 Oct 2026), routing rules, Hot Today, AI lead scoring, attendance and
// source/team reports are Growth.
import { Building2, QrCode, FileSpreadsheet, Shuffle, MapPin, Camera, BarChart3, CalendarCheck2 } from "lucide-react";
import SolutionPage, { solutionJsonLd } from "../components/SolutionPage";
import { ProjectViz } from "../components/site/HomeVisuals";
import { FacebookLogo } from "../components/site/BrandLogos";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";

const FAQS = [
  ["What is the best CRM for builders in India?",
   "The best one is the one your sales team will actually use. For a builder that means leads kept project by project, automatic capture from Facebook and WhatsApp (Google lead forms on Enterprise), an easy way to bring in portal leads, fair routing to telecallers, site visit tracking and per-project reports. Arthaleads does all of this from ₹599 per user per month."],
  ["Can I manage several projects in one account?",
   "Yes. Starter includes two projects and Growth has no limit. Each project keeps its own leads, team, brochures, floor plans and videos, and you can move a lead from one project to another without losing its notes, follow-up or history."],
  ["Do leads from 99acres, MagicBricks and Housing.com come in automatically?",
   "No. Portal leads come in by import: download them from the portal as a sheet and import the CSV or Excel file into the project. Facebook and Instagram lead ads, WhatsApp chats, your website forms and the project's QR code do come in automatically, and Google lead forms do too on Enterprise."],
  ["How do new leads reach my telecallers?",
   "On Growth, every new lead gets an owner the moment it arrives, shared out to the agent with the fewest open leads, and that person's phone gets a push alert. You can add routing rules, for example by campaign, and Hot Today ranks who to call first using AI lead scoring. On Starter, an admin assigns each new lead. Overdue follow-ups turn red, and agents can call and log outcomes from the Android app."],
  ["Can the WhatsApp AI answer questions about my project?",
   "Yes. On Growth the WhatsApp AI agent answers buyers about your project and its location day and night, sends the brochure, photos and floor plans, asks about budget and timeline, offers a site visit and saves the answers on the lead. Your team can take over any chat."],
  ["How much does a builder CRM cost?",
   `Arthaleads Starter is ₹${PLAN_PRICING.starter.monthly} and Growth is ₹${PLAN_PRICING.growth.monthly} per user per month, plus 18% GST, with a five-seat minimum. Large developers and multi-branch teams get an Enterprise quote with on-site onboarding and training. Every plan starts with a 14-day free trial.`],
];

export default function BuilderCrm() {
  useSEO({
    title: "Builder CRM for Real Estate Developers in India | Arthaleads",
    description: "Builder CRM for developers in India: project-wise leads from Facebook and Google ads, WhatsApp, portals and site QR codes, routed to your telecallers.",
    canonical: "https://www.arthaleads.com/builder-crm",
  });

  return (
    <SolutionPage
      jsonLd={solutionJsonLd({ name: "Builder CRM", path: "/builder-crm", faqs: FAQS })}
      signature={{ tone: "sand", layout: "split-reverse" }}
      hero={{
        lines: ["Builder CRM", "for real estate developers"],
        lede: "Every project's sales in one place. Leads from ads, WhatsApp, portals and the site office land in the right project and reach the right telecaller in seconds.",
        eyebrow: "Builder CRM software",
        actions: [
          { label: "Book a builder demo", to: "/book-demo" },
          { label: "How it works", href: "#how" },
        ],
        trust: ["Leads kept project by project", "Site visits tracked", `From ₹${PLAN_PRICING.starter.monthly} per user`],
        photo: "builder",
        photoAlt: "A sales head explaining a scale model of residential towers to a young couple in a sales gallery",
        cards: [
          { Icon: FacebookLogo, iconColor: "#1877F2", iconBg: "rgba(24,119,242,0.12)", title: "New lead · Riverview Heights", sub: "Facebook ad · sent to Neha", cycle: [{ title: "New lead · Skyline Residency", sub: "Facebook ad · sent to Rohit" }, { title: "New lead · Green Acres", sub: "Facebook ad · sent to Sana" }] },
          { Icon: Building2, title: "3 projects · 412 leads", sub: "Each with its own team" },
          { Icon: CalendarCheck2, iconColor: "#16a34a", iconBg: "rgba(22,163,74,0.12)", title: "Site visit booked", sub: "Saturday · 11:00 AM", cycle: [{ title: "Site visit booked", sub: "Sunday · 4:00 PM" }, { title: "Site visit done", sub: "Feedback logged on the lead" }] },
        ],
      }}
      answer={{
        q: "What is a builder CRM?",
        paras: [
          "A builder CRM is sales software for real estate developers. It collects enquiries for each project from ads, WhatsApp, property portals and the site office, gives every lead an owner, reminds the team to follow up, and tracks each buyer from first call to site visit and booking, project by project.",
          "Excel sheets and WhatsApp groups work for one launch. With several projects and weekly ads, leads get called twice or not at all. Arthaleads keeps each project's leads, team and media together, so the sales head sees every project on one screen.",
        ],
      }}
      steps={{
        title: "How a project runs in Arthaleads",
        intro: "From launch to booking, in four steps.",
        items: [
          { title: "Set up the project", body: "RERA number, location, prices, brochures, floor plans and the sales team." },
          { title: "Leads arrive", body: "Ads and WhatsApp automatically (Google forms on Enterprise), portal sheets by import, walk-ins by QR code." },
          { title: "Telecallers follow up", body: "Each lead gets an owner and an alert; overdue follow-ups turn red and Hot Today ranks who to call." },
          { title: "Visits, bookings, reports", body: "Site Visit, Negotiation, Closed Won, with conversion by project, source and agent." },
        ],
      }}
      features={{
        visual: <ProjectViz />,
        title: "Built for developer sales teams",
        intro: "Each card shows the plan it starts on.",
        items: [
          { icon: Building2, title: "Project-wise leads", body: "Own leads, team and media per project: two on Starter, unlimited on Growth.", plan: "Starter" },
          { icon: QrCode, title: "QR codes for the site office", body: "Visitors scan a project QR code on hoardings or stalls and become tagged leads.", plan: "Starter" },
          { icon: FacebookLogo, title: "Facebook lead ads, automatic", body: "Facebook and Instagram leads arrive in seconds with the campaign (Google forms on Enterprise).", plan: "Starter" },
          { icon: FileSpreadsheet, title: "Portal leads by import", body: "Import 99acres, MagicBricks and Housing.com exports; duplicate numbers are skipped.", plan: "Starter" },
          { icon: Shuffle, title: "Routing to telecallers", body: "Every new lead gets an owner instantly, shared out evenly, with rules by campaign.", plan: "Growth" },
          { icon: MapPin, title: "Site visit tracking", body: "Site Visit is a pipeline stage, counted per project and per agent.", plan: "Starter" },
          { icon: Camera, title: "Selfie attendance", body: "Field staff clock in with a selfie and location; export attendance reports.", plan: "Growth" },
          { icon: BarChart3, title: "Project-wise reports", body: "Conversion by project, leads by source, team performance and stale-lead alerts.", plan: "Growth" },
        ],
      }}
      compare={{
        title: "Spreadsheets and WhatsApp groups vs a builder CRM",
        intro: "What changes once several projects and a telecalling team share one system.",
        cols: ["Sheets and WhatsApp groups", "Arthaleads builder CRM"],
        rows: [
          ["Where leads live", "A sheet per campaign and agents' phones", "One list per project, with the source on every lead"],
          ["A new Facebook lead", "Downloaded and shared hours later", "Imported automatically and assigned in seconds"],
          ["Same buyer enquires twice", "Two agents call the same person", "The repeat number is flagged as a duplicate"],
          ["Site visits", "Counted from memory at the weekly meeting", "A pipeline stage, counted per project and per agent"],
          ["Telecaller attendance", "A register or WhatsApp check-ins", "Selfie clock-in with location (Growth)"],
          ["When a salesperson leaves", "Their leads leave with their phone", "Leads, chats and history stay with the company"],
        ],
      }}
      faqs={{ title: "Builder CRM questions", items: FAQS }}
      related={[
        { to: "/blog/crm-for-builders-and-developers", label: "how builders choose a CRM" },
        { to: "/blog/real-estate-lead-management-enquiry-to-site-visit", label: "lead management from enquiry to site visit" },
        { to: "/blog/measure-real-estate-sales-team-without-micromanaging", label: "measuring a sales team" },
        { to: "/ai-crm", label: "the AI features" },
        { to: "/whatsapp-crm", label: "the WhatsApp CRM" },
        { to: "/features", label: "every feature" },
        { to: "/pricing", label: "plans and pricing" },
        { to: "/compare", label: "how Arthaleads compares with Sell.Do, Leadrat and Kylas" },
      ]}
      close={{
        title: "Put every project's leads",
        dim: "in one place.",
        body: "Book a 30-minute demo and we will set up your first project with you, or start the 14-day free trial yourself.",
      }}
    />
  );
}
