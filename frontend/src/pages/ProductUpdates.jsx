// pages/ProductUpdates.jsx - /product-updates on the shared marketing theme
// (components/site/*). Newest first; add new entries to the top of `updates`.
import { SitePage, Section, Container, Card } from "../components/site/Site";
import { PageHero, ClosingCta } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";
import { CRM_SIGNUP_URL } from "../utils/crmLinks";

const updates = [
  {
    date: "October 2026",
    title: "Edit routing rules and send conversions to Meta",
    desc: "Change the name, agent or project of a lead routing rule after you save it. Growth plans can also send lead stages (site visit, closed deal) back to Meta so your ads learn which leads become buyers. It is off until you switch it on.",
    tags: ["Integrations", "New feature"],
  },
  {
    date: "October 2026",
    title: "WhatsApp chat on project leads",
    desc: "A lead moved into a project keeps its WhatsApp conversation, so the team can read the full chat from the project.",
    tags: ["WhatsApp", "Projects"],
  },
  {
    date: "August 2026",
    title: "Arthaleads is now a native Android app",
    desc: "Get the full CRM (leads, pipeline, calls, attendance, and AI copilot) in a fast, native Android app built for the field. Push notifications the moment a lead is assigned to you, and the same real-time data as the web app, wherever you are. Ask your admin for the install link.",
    tags: ["Mobile App", "New feature"],
  },
  {
    date: "August 2026",
    title: "Capture leads directly from WhatsApp",
    desc: "Connect WhatsApp as a lead source alongside Facebook and Google. Incoming enquiries on your business WhatsApp number are automatically captured as leads in your CRM: no manual copy-paste from chat threads, no leads lost in a busy inbox.",
    tags: ["WhatsApp", "Lead Capture", "New feature"],
  },
  {
    date: "August 2026",
    title: "Dedicated app subdomain, faster and more secure",
    desc: "The CRM now runs on its own address, app.arthaleads.com, fully separated from the marketing site for better security and reliability. Also new: rename your organisation any time from Settings, and a one-click 'Forgot your password?' shortcut right from the Change Password screen, no need to log out first.",
    tags: ["Platform", "Security", "Improvement"],
  },
  {
    date: "July 2026",
    title: "In-browser calling: no phone required",
    desc: "Make and receive calls directly from your browser with the new WebRTC soft phone, no physical handset needed. Full EnableX calling parity has also been extended to Project leads, so every lead in every project gets the same one-tap call, recording, and AI analysis experience.",
    tags: ["Calls", "New feature"],
  },
  {
    date: "July 2026",
    title: "Facebook lead form mapping and unmapped-form alerts",
    desc: "See exactly which Facebook form each lead came from, right in the lead's Source and Notes. Map form IDs to human-readable names once, and get alerted automatically if a new lead arrives from a form you haven't mapped yet, so nothing silently falls through.",
    tags: ["Facebook", "Automation", "Improvement"],
  },
  {
    date: "June 2026",
    title: "QR code lead capture: org and project level",
    desc: "Every organisation and every project now has its own unique QR code. Put it on site hoardings, brochures, visiting cards, or property expo stalls. When a prospect scans it, they fill a short form on their phone and the lead lands directly in your CRM with source tagged. Download, print, or regenerate the QR from the Leads or Projects page.",
    tags: ["Lead Capture", "New feature"],
  },
  {
    date: "June 2026",
    title: "AI lead scoring and Hot Today widget",
    desc: "Every lead is now automatically scored 0 to 100 by AI based on pipeline stage, budget match, urgency, response speed, follow-up count, and engagement history. The Hot Today widget on your dashboard surfaces your top leads to call each morning, so agents always start with the highest-conversion opportunities. No more guessing who to call first.",
    tags: ["AI", "New feature"],
  },
  {
    date: "June 2026",
    title: "AI WhatsApp Draft",
    desc: "Agents can now generate a personalised WhatsApp message for any lead in one click. The AI uses the lead's name, property interest, budget, and last interaction to write a context-aware message. Review, edit if needed, and send. Saves 10 to 15 minutes per agent per day and improves response quality.",
    tags: ["AI", "WhatsApp", "New feature"],
  },
  {
    date: "June 2026",
    title: "AI call intelligence: transcription, insights and auto-status",
    desc: "Every recorded call is now automatically transcribed and analysed by AI: intent (Interested / Site Visit / Negotiating / Not Interested), sentiment, a summary, key points, and a recommended next action. Turn on AI Auto-Status and the lead's pipeline stage advances automatically the moment the AI hears 'site visit' or 'negotiating'. No manual updates needed.",
    tags: ["AI", "Calls", "New feature"],
  },
  {
    date: "May 2026",
    title: "Booking and invoice engine",
    desc: "Close a deal and convert it to a formal booking in one click. The booking engine auto-calculates brokerage and GST (CGST/SGST/IGST split). Generate a fully branded PDF invoice with your company logo, address, RERA number, PAN, GST number, and bank details, all pulled from your Settings. Invoice is ready in under 2 minutes. No Excel, no manual calculation.",
    tags: ["Bookings", "Invoices", "New feature"],
  },
  {
    date: "May 2026",
    title: "Attendance with selfie verification",
    desc: "Field agents clock in and clock out directly from their phone. Admins can require a selfie on clock-in to confirm location presence. The admin dashboard shows real-time team attendance: who is in, who is out, total hours worked. Download a full monthly attendance report as CSV in one click. No paper registers, no WhatsApp check-ins.",
    tags: ["Attendance", "Team", "New feature"],
  },
  {
    date: "May 2026",
    title: "AI Copilot: live CRM assistant",
    desc: "Every page now has an AI Copilot button. Ask it live questions like 'How many overdue follow-ups do I have?', 'Who are my hottest leads right now?', or 'What is our conversion rate this month?' and get instant answers pulled from your actual CRM data. It also offers guided tours for every feature, so new team members can get up to speed without training.",
    tags: ["AI", "New feature"],
  },
  {
    date: "May 2026",
    title: "Invoice letterhead: logo, billing and bank details",
    desc: "Admins can now upload their company logo and fill in full billing details (address, phone, email, GST number, PAN, CIN, RERA number, bank account name, account number, IFSC, bank name, and branch) from the Settings page. Every invoice generated automatically uses this letterhead, giving clients a professional, branded document.",
    tags: ["Invoices", "Settings", "Improvement"],
  },
  {
    date: "May 2026",
    title: "WordPress plugin v1.0.2: 8 form builders supported",
    desc: "The Arthaleads WordPress plugin now captures leads from MetForm, Contact Form 7, WPForms, Elementor Forms, Gravity Forms, Ninja Forms, Forminator, and Fluent Forms. All custom form fields are captured automatically: name, phone, project interest, and any field you add.",
    tags: ["WordPress", "Integrations"],
  },
  {
    date: "April 2026",
    title: "Arthaleads Blog",
    desc: "Guides, market insights and product news now live on the Arthaleads blog at arthaleads.com/blog, written with a rich-text editor, image support and SEO-friendly addresses.",
    tags: ["Content", "New feature"],
  },
  {
    date: "April 2026",
    title: "Not Reachable lead status",
    desc: "A dedicated pipeline stage for leads that couldn't be contacted: number not reachable, switched off, or out of coverage. Telecallers can now accurately track this state separately from other non-contact outcomes, giving managers clearer pipeline data.",
    tags: ["Pipeline", "Improvement"],
  },
  {
    date: "March 2026",
    title: "Paste-and-import: instant lead list import",
    desc: "Import lead lists by pasting markdown or CSV data directly into the CRM. No file upload required. The system parses the content, extracts fields, detects duplicates, and loads the leads into your project in seconds.",
    tags: ["Imports", "New feature"],
  },
  {
    date: "March 2026",
    title: "Facebook leads integration: auto pull from Meta campaigns",
    desc: "Connect your Facebook Ad account and Arthaleads will automatically pull new leads from your Meta campaigns in real time. No manual export from Meta's Leads Centre. Leads arrive in your CRM within seconds of a form submission.",
    tags: ["Facebook", "Integrations"],
  },
  {
    date: "February 2026",
    title: "WhatsApp source tracking",
    desc: "Leads that originate from WhatsApp chats are automatically tagged with a WhatsApp source label and tracked separately in your analytics dashboard. Filter your pipeline by source to see exactly how much pipeline WhatsApp is generating vs. other channels.",
    tags: ["WhatsApp", "Analytics"],
  },
];

function ProductUpdatesInner() {
  useSEO({
    title: "Product Updates: New Arthaleads CRM Features",
    description: "See the latest features, improvements, and updates to Arthaleads CRM. Stay up to date with India’s top real estate lead management platform.",
    canonical: "https://www.arthaleads.com/product-updates",
  });

  return (
    <SitePage>
      <PageHero
        eyebrow="Product updates"
        title={<>What's new in <span className="site-dim">Arthaleads</span></>}
        lede="We ship improvements every week. Here's what's changed."
        actions={[
          { label: "See the latest", href: "#updates" },
          { label: "Try them free", href: CRM_SIGNUP_URL, external: true },
        ]}
      />

      {/* Timeline */}
      {/* Signature band. The timeline stays at reading width (880px): it is a single
          column of text cards, not a grid. */}
      <Section tone="sand" id="updates" className="!pt-12 sm:!pt-16">
        <Container narrow>
          <div className="relative">
            <div aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-px ml-[7px] hidden sm:block" style={{ background: "var(--site-line-strong)" }} />
            <ol className="space-y-8 sm:space-y-10">
              {updates.map(({ date, title, desc, tags }, i) => (
                <Reveal as="li" key={i} delay={Math.min(i, 3) * 60} className="sm:pl-10 relative">
                  <span aria-hidden="true" className="hidden sm:block absolute left-0 top-1 w-[15px] h-[15px] rounded-full"
                    style={{ background: "var(--site-brand)", boxShadow: "0 0 0 3px var(--site-sand), 0 6px 14px -4px rgba(255,107,0,0.55)" }} />
                  <p className="site-eyebrow !text-xs mb-2.5">{date}</p>
                  <Card glow className="p-6 sm:p-7">
                    <h2 className="site-h3 mb-3">{title}</h2>
                    <p className="text-[15px] leading-relaxed mb-5">{desc}</p>
                    <ul className="flex flex-wrap gap-2" aria-label="Tags">
                      {tags.map((tag) => (
                        <li key={tag} className="site-chip px-2.5 py-1 rounded-lg text-xs font-medium">{tag}</li>
                      ))}
                    </ul>
                  </Card>
                </Reveal>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      <ClosingCta title="Try the latest features" dim="today"
        body="Every update goes live for all users the day it ships. See them on your own leads in a demo or the free trial." />
    </SitePage>
  );
}

export default function ProductUpdates() {
  return <ProductUpdatesInner />;
}
