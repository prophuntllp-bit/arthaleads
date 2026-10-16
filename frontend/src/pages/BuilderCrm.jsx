// pages/BuilderCrm.jsx - /builder-crm, "Builder CRM for real estate developers".
//
// Targets "builder crm" (100-1K a month in India), "crm for real estate
// developers" and "crm for builders" (Google Trends scaled to the owner's
// Keyword Planner data, Oct 2026). Keyword plan:
// https://claude.ai/artifact/CuDksmB3zWyQ77fbh5jUdH
//
// Every claim must match the product and its plan (data/plans.js, data/features.js,
// backend planGate, checked 16 Oct 2026). Portal leads (99acres, MagicBricks,
// Housing.com) are a sheet import, never "automatic". There is no channel
// partner portal: do not claim one.
import { Building2, QrCode, Facebook, FileSpreadsheet, Shuffle, MapPin, Camera, BarChart3 } from "lucide-react";
import SolutionPage, { solutionJsonLd } from "../components/SolutionPage";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";

const FAQS = [
  ["What is the best CRM for builders in India?",
   "The best one is the one your sales team will actually use. For a builder that means leads kept project by project, automatic capture from Facebook and WhatsApp, an easy way to bring in portal leads, fair routing to telecallers, site visit tracking and per-project reports. Arthaleads does all of this from ₹599 per user per month."],
  ["Can I manage several projects in one account?",
   "Yes. Starter includes two projects and Growth has no limit. Each project keeps its own leads, team, brochures, floor plans and videos, and you can move a lead from one project to another without losing its notes, follow-up or history."],
  ["Do leads from 99acres, MagicBricks and Housing.com come in automatically?",
   "No. Portal leads come in by import: download them from the portal as a sheet and import the CSV or Excel file into the project. Facebook and Instagram lead ads and WhatsApp chats do come in automatically, and Google Ads leads do on Enterprise."],
  ["How do new leads reach my telecallers?",
   "On Growth, routing rules give each new lead an owner straight away, by round robin or by campaign, and that person's phone gets a push alert. Follow-up reminders turn red when overdue, and agents can call and log outcomes from the Android app."],
  ["Can the WhatsApp AI answer questions about my project?",
   "Yes. On Growth the WhatsApp AI agent answers buyers about your project day and night, shares the brochure and location, asks about budget and timeline, and saves the answers on the lead. Your team can take over any chat."],
  ["How much does a builder CRM cost?",
   `Arthaleads Starter is ₹${PLAN_PRICING.starter.monthly} and Growth is ₹${PLAN_PRICING.growth.monthly} per user per month, plus 18% GST, with a five-seat minimum. Large developers and multi-branch teams get an Enterprise quote with on-site onboarding and training. Every plan starts with a 14-day free trial.`],
];

export default function BuilderCrm() {
  useSEO({
    title: "Builder CRM for Real Estate Developers in India | Arthaleads",
    description: "Builder CRM for developers in India: project-wise leads from Facebook ads, WhatsApp, portals and site QR codes, routed to telecallers, with site visits tracked.",
    canonical: "https://www.arthaleads.com/builder-crm",
  });

  return (
    <SolutionPage
      jsonLd={solutionJsonLd({ name: "Builder CRM", path: "/builder-crm", faqs: FAQS })}
      hero={{
        lines: ["Builder CRM", "for real estate developers"],
        lede: "Run every project's sales in one place. Leads from Facebook ads, WhatsApp, portals and the site office land in the right project, reach the right telecaller in seconds, and are tracked through site visit to booking.",
        image: "/tour/project.webp",
        imageAlt: "A project in Arthaleads with its RERA number, possession date, price range, configurations and assigned sales team",
        chips: ["New lead · Facebook ad", "Site visit booked"],
      }}
      answer={{
        q: "What is a builder CRM?",
        paras: [
          "A builder CRM is sales software for real estate developers. It collects enquiries for each project from ads, WhatsApp, property portals and the site office, gives every lead an owner, reminds the team to follow up, and tracks each buyer from first call to site visit and booking, project by project.",
          "Most developer sales teams in India start with Excel sheets per campaign and WhatsApp groups. That works for one launch. With several projects, a telecalling team and ads running every week, leads get called twice or not at all, site visits are counted from memory, and nobody can say which campaign sold flats.",
          "Arthaleads keeps each project's leads, team and media together, so the sales head sees every project on one screen and every agent sees only what is theirs.",
        ],
      }}
      steps={{
        title: "How a project runs in Arthaleads",
        intro: "From launch to booking, in four steps.",
        items: [
          { title: "Set up the project", body: "Add the project with its RERA number, location, price range and configurations, upload brochures, floor plans and videos, and assign the sales team." },
          { title: "Leads arrive", body: "Facebook and Instagram lead ads and WhatsApp chats come in automatically. Portal sheets are imported, and walk-ins scan the project's QR code at the site office." },
          { title: "Telecallers follow up", body: "Each lead gets an owner and a push alert. Follow-ups are dated, overdue ones turn red, and the WhatsApp AI agent answers buyers at night." },
          { title: "Visits, bookings, reports", body: "Leads move through Site Visit and Negotiation to Closed Won, and managers see conversion by project, by source and by agent." },
        ],
      }}
      features={{
        title: "Built for developer sales teams",
        intro: "The plan each feature starts on is shown on its card.",
        items: [
          { icon: Building2, title: "Project-wise leads", body: "Each project keeps its own leads, team and media. Two projects on Starter, unlimited on Growth. Move leads between projects with their history.", plan: "Starter" },
          { icon: QrCode, title: "QR codes for the site office", body: "Every project gets a QR code for hoardings, brochures and expo stalls. A visitor scans it, fills a short form and becomes a lead, tagged by source.", plan: "Starter" },
          { icon: Facebook, title: "Facebook lead ads, automatic", body: "Leads from Facebook and Instagram lead forms arrive in seconds with the campaign attached. No downloading sheets from Ads Manager.", plan: "Starter" },
          { icon: FileSpreadsheet, title: "Portal leads by import", body: "Bring in leads from 99acres, MagicBricks and Housing.com by importing the CSV or Excel export. Duplicate phone numbers are skipped.", plan: "Starter" },
          { icon: Shuffle, title: "Routing to telecallers", body: "Round-robin or campaign-based rules give every new lead an owner the moment it arrives, so no lead waits and none is called twice.", plan: "Growth" },
          { icon: MapPin, title: "Site visit tracking", body: "Site Visit is a stage in the pipeline, so visits are counted per project and per agent instead of being remembered at the weekly meeting.", plan: "Starter" },
          { icon: Camera, title: "Selfie attendance", body: "Site and field staff clock in from their phone with a selfie and location. Admins see attendance live and download monthly reports.", plan: "Growth" },
          { icon: BarChart3, title: "Project-wise reports", body: "Conversion by project and by source, team performance, follow-up completion and stale-lead alerts on the admin dashboard.", plan: "Growth" },
        ],
      }}
      compare={{
        title: "Spreadsheets and WhatsApp groups vs a builder CRM",
        intro: "What changes once several projects and a telecalling team share one system.",
        cols: ["Sheets and WhatsApp groups", "Arthaleads builder CRM"],
        rows: [
          ["Where leads live", "A sheet per campaign and agents' phones", "One list per project, with the source on every lead"],
          ["A new Facebook lead", "Downloaded and shared hours later", "Imported automatically and assigned in seconds"],
          ["Same buyer enquires twice", "Two agents call the same person", "Duplicate detection flags the repeat number (Growth)"],
          ["Site visits", "Counted from memory at the weekly meeting", "A pipeline stage, counted per project and per agent"],
          ["Telecaller attendance", "A register or WhatsApp check-ins", "Selfie clock-in with location (Growth)"],
          ["When a salesperson leaves", "Their leads leave with their phone", "Leads, chats and history stay with the company"],
        ],
      }}
      faqs={{ title: "Builder CRM questions", items: FAQS }}
      related={[
        { to: "/ai-crm", label: "the AI features" },
        { to: "/whatsapp-crm", label: "the WhatsApp CRM" },
        { to: "/features", label: "every feature" },
        { to: "/pricing", label: "plans and pricing" },
        { to: "/compare", label: "how Arthaleads compares with Sell.Do, Leadrat and Kylas" },
      ]}
      close={{
        title: "Put every project's leads in one place",
        body: "Start the 14-day free trial, or message us on WhatsApp and we will set up your first project with you.",
      }}
    />
  );
}
