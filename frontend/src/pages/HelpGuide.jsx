import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ArrowRight, Mail } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { PublicThemeProvider, usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const steps = [
  { num: "01", title: "Create your account",  desc: "Sign up at arthaleads.com/signup. Your account and organisation are set up instantly — no waiting, no approval process." },
  { num: "02", title: "Add your team",         desc: "Go to Team settings and invite your telecallers, managers, and admins. Each member gets their own login with role-based access." },
  { num: "03", title: "Connect your forms",    desc: "In Automations, connect Facebook Leads, or install the Arthaleads WordPress plugin to capture website form submissions automatically." },
  { num: "04", title: "Import existing leads", desc: "Upload a CSV or paste a lead list directly into a project. The system detects duplicates and normalises phone numbers automatically." },
  { num: "05", title: "Start tracking",        desc: "Assign leads to agents, track call outcomes, set follow-up reminders, and watch your pipeline move through stages toward a closed deal." },
];

const faqs = [
  {
    q: "How do I get leads from Facebook into Arthaleads?",
    a: "Go to Automations → Facebook Leads in your Arthaleads dashboard. Connect your Facebook Ad account, select your lead form, and Arthaleads will pull every new submission automatically in real time.",
  },
  {
    q: "How do I connect my WordPress contact forms?",
    a: "Install the Arthaleads WordPress plugin from the WordPress plugin directory (search 'Arthaleads'). In the plugin settings, enter your Arthaleads API token — found in your Settings → Integrations page. The plugin supports MetForm, Contact Form 7, WPForms, Elementor Forms, Gravity Forms, Ninja Forms, Forminator, and Fluent Forms.",
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
    a: "Yes. Use the Site Visit status in your lead pipeline. Mark a lead as 'Site Visit Booked' when a visit is scheduled, and update it to 'Site Visited' when they've attended. Your pipeline and analytics reflect this automatically.",
  },
  {
    q: "How do I follow up with leads?",
    a: "Go to the Follow-Ups section from the sidebar. Schedule a follow-up for any lead by setting a date and time. Arthaleads will send you a reminder notification when the follow-up is due. Managers can see all overdue follow-ups across the team.",
  },
  {
    q: "Is there a mobile app?",
    a: "Arthaleads is a Progressive Web App (PWA). Open arthaleads.com in Chrome or Safari on any phone, log in, and tap 'Add to Home Screen' when prompted. It works like a native app — offline-capable, with push notifications.",
  },
];

function FAQItem({ q, a, isDark }) {
  const [open, setOpen] = useState(false);
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const textColor   = isDark ? "#ffffff" : "#111827";
  const bodyColor   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const hoverBg     = isDark ? "rgba(255,255,255,0.03)" : "#f9fafb";

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors"
        style={{ color: textColor }}
        onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <span className="font-medium text-sm leading-snug">{q}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: bodyColor }} />
      </button>
      {open && (
        <div className="px-6 pb-5" style={{ borderTop: `1px solid ${borderColor}` }}>
          <p className="text-sm leading-relaxed pt-4" style={{ color: bodyColor }}>{a}</p>
        </div>
      )}
    </div>
  );
}

function HelpGuideInner() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "Help Guide — Getting Started with Arthaleads CRM",
    description: "Learn how to use Arthaleads CRM with step-by-step guides and FAQs. Set up leads, automate workflows, track site visits, and close deals faster.",
    canonical: "https://www.arthaleads.com/help-guide",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.06)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Help Center</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5" style={{ color: textColor }}>
            Arthaleads{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Help Center
            </span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: softText }}>
            Step-by-step guides and answers to the most common questions about setting up and using Arthaleads CRM.
          </p>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>Getting Started</h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: softText }}>
              Follow these five steps to go from sign-up to your first managed lead in under 15 minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="p-5 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="text-[#ff6b00] font-black text-2xl mb-3">{num}</div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: textColor }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: softText }}>{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25"
            >
              Create Your Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>Frequently Asked Questions</h2>
            <p className="text-base" style={{ color: softText }}>
              Quick answers to the questions we hear most often from real estate teams getting started.
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} isDark={isDark} />
            ))}
          </div>
        </div>
      </section>

      {/* Support CTA */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3" style={{ color: textColor }}>Need more help?</h2>
          <p className="text-base mb-6" style={{ color: softText }}>
            Can't find what you're looking for? Our team is ready to assist.
          </p>
          <a
            href="mailto:support@arthaleads.com"
            className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors"
            style={{ borderColor: "rgba(255,107,0,0.40)", background: "rgba(255,107,0,0.10)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.40)" }}
          >
            <Mail className="w-4 h-4" />
            support@arthaleads.com
          </a>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default function HelpGuide() {
  return (
    <PublicThemeProvider>
      <HelpGuideInner />
    </PublicThemeProvider>
  );
}
