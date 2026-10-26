// pages/HelpGuide.jsx - /help-guide on the shared marketing theme (components/site/*).
// The FAQ and HowTo JSON-LD are built from the same arrays the page renders.
import { CRM_SIGNUP_URL } from "../utils/crmLinks";
import { ArrowRight, Mail, LifeBuoy } from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, FaqSection, ClosingCta } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";

const steps = [
  { num: "01", title: "Create your account",  desc: "Request your workspace at arthaleads.com/signup. New workspaces are approved by our team; once yours is approved you can sign in and finish a short setup." },
  { num: "02", title: "Add your team",         desc: "Go to Team settings and invite your telecallers, managers, and admins. Each member gets their own login with role-based access." },
  { num: "03", title: "Connect your forms",    desc: "In Integrations, connect Facebook Leads (Google Ads lead forms on Enterprise), or install the Arthaleads WordPress plugin to capture website form submissions automatically." },
  { num: "04", title: "Import existing leads", desc: "Upload a CSV or paste a lead list directly into a project. The system detects duplicates and normalises phone numbers automatically." },
  { num: "05", title: "Start tracking",        desc: "Assign leads to agents, track call outcomes, set follow-up reminders, and watch your pipeline move through stages toward a closed deal." },
];

const faqs = [
  {
    q: "How do I get leads from Facebook into Arthaleads?",
    a: "Go to Integrations → Facebook Leads in your Arthaleads dashboard. Connect your Facebook Ad account, select your lead form, and Arthaleads will pull every new submission automatically in real time.",
  },
  {
    q: "How do I connect my WordPress contact forms?",
    a: "Install the Arthaleads WordPress plugin from the WordPress plugin directory (search 'Arthaleads'). In the plugin settings, enter your Arthaleads API token - found in your Settings → Integrations page. The plugin supports MetForm, Contact Form 7, WPForms, Elementor Forms, Gravity Forms, Ninja Forms, Forminator, and Fluent Forms.",
  },
  {
    q: "Can multiple team members use the same account?",
    a: "Yes. Each team member gets their own login under your organisation. Go to Settings → Team to add members and assign roles: Admin, Manager, or Agent. Each role has its own permission level.",
  },
  {
    q: "How do I assign leads to my sales team?",
    a: "From the Leads page, open any lead card and use the Assign field to select a team member. You can also bulk-assign leads by selecting multiple rows and using the Assign action. Assigned agents receive an instant push notification.",
  },
  {
    q: "What happens when a lead fills a form on my website?",
    a: "If you have the Arthaleads WordPress plugin installed, the lead is captured instantly via a secure webhook. It appears in your CRM in seconds, is assigned based on your settings, and the relevant agent is notified immediately.",
  },
  {
    q: "Can I track which leads visited the property site?",
    a: "Yes. Move a lead to the 'Site Visit' stage in your pipeline when a visit is scheduled or done. Inside a project, set the lead's outcome to 'Site Visit Booked' and then 'Site Visit Done'. Your pipeline and analytics reflect both.",
  },
  {
    q: "How do I follow up with leads?",
    a: "Go to the Follow-Ups section from the sidebar. Schedule a follow-up for any lead by setting a date and time. Arthaleads will send you a reminder notification when the follow-up is due. Managers can see all overdue follow-ups across the team.",
  },
  {
    q: "Is there a mobile app?",
    a: "Yes. You can install Arthaleads on a phone two ways. On Android there is a native app (see the Download page). On any phone you can also open app.arthaleads.com in Chrome or Safari, sign in, and choose 'Add to Home Screen' to install the web app. Both give you push notifications; features that use the camera, location or calling need those permissions allowed on your phone.",
  },
];

// In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS.
const HELP_JSONLD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
  },
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to get started with Arthaleads CRM",
    "description": "Set up your Arthaleads account and start managing real estate leads in minutes.",
    "totalTime": "PT10M",
    "step": steps.map((s, i) => ({ "@type": "HowToStep", "position": i + 1, "name": s.title, "text": s.desc })),
  },
]).replace(/</g, "\\u003c");

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

function HelpGuideInner() {
  useSEO({
    title: "Help Guide - Getting Started with Arthaleads CRM",
    description: "Learn how to use Arthaleads CRM with step-by-step guides and FAQs. Set up leads, automate workflows, track site visits, and close deals faster.",
    canonical: "https://www.arthaleads.com/help-guide",
  });

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: HELP_JSONLD }} />

      <PageHero
        eyebrow="Help guide"
        title={<>Arthaleads <span className="site-dim">Help Center</span></>}
        lede="Step-by-step guides and answers to the most common questions about setting up and using Arthaleads CRM."
        actions={null}
        trust={false}
      />

      {/* Getting started */}
      <Section tone="tint" id="getting-started">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div className="lg:sticky lg:top-28 self-start">
            <SectionHeader eyebrow="Getting started" title="Getting Started" className="!mb-6"
              lede="Follow these five steps to go from sign-up to your first managed lead in under 15 minutes." />
            <SiteButton href={CRM_SIGNUP_URL} external>Create Your Account <ArrowRight className="w-4 h-4" /></SiteButton>
          </div>
          <ol className="space-y-3 min-w-0">
            {steps.map(({ num, title, desc }, i) => (
              <Reveal as="li" key={num} delay={i * 80}>
                <Card className="flex gap-4 p-5 sm:p-6">
                  <span className="font-display shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white"
                    style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{num}</span>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold site-ink mb-1">{title}</h3>
                    <p className="text-[15px] leading-relaxed">{desc}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      <FaqSection title="Frequently Asked Questions" items={faqs.map(({ q, a }) => [q, a])} tone="white" />

      {/* Support */}
      <Section tone="tint">
        <Container narrow>
          <Reveal>
            <Card raised className="p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={iconTile}>
                <LifeBuoy className="w-7 h-7" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl sm:text-2xl font-bold site-ink mb-2">Need more help?</h2>
                <p className="text-[15px] leading-relaxed">Can't find what you're looking for? Our team is ready to assist.</p>
              </div>
              <SiteButton href="mailto:contact@arthaleads.com" variant="secondary" className="shrink-0">
                <Mail className="w-4 h-4" /> contact@arthaleads.com
              </SiteButton>
            </Card>
          </Reveal>
        </Container>
      </Section>

      <ClosingCta />
    </SitePage>
  );
}

export default function HelpGuide() {
  return <HelpGuideInner />;
}
