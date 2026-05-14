import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ArrowRight, Mail } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useSEO } from "../utils/useSEO";

const steps = [
  { num: "01", title: "Create your account", desc: "Sign up at arthaleads.com/signup. Your account and organisation are set up instantly — no waiting, no approval process." },
  { num: "02", title: "Add your team",        desc: "Go to Team settings and invite your telecallers, managers, and admins. Each member gets their own login with role-based access." },
  { num: "03", title: "Connect your forms",   desc: "In Automations, connect Facebook Leads, or install the Arthaleads WordPress plugin to capture website form submissions automatically." },
  { num: "04", title: "Import existing leads",desc: "Upload a CSV or paste a lead list directly into a project. The system detects duplicates and normalises phone numbers automatically." },
  { num: "05", title: "Start tracking",       desc: "Assign leads to agents, track call outcomes, set follow-up reminders, and watch your pipeline move through stages toward a closed deal." },
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

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="text-white font-medium text-sm leading-snug">{q}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-white/5">
          <p className="text-white/55 text-sm leading-relaxed pt-4">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpGuide() {
  useSEO({
    title: "Help Guide — Getting Started with Arthaleads CRM",
    description: "Learn how to use Arthaleads CRM with step-by-step guides and FAQs. Set up leads, automate workflows, track site visits, and close deals faster.",
    canonical: "https://www.arthaleads.com/help-guide",
  });

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#ff6b00]/6 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Help Center</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-5">
            Arthaleads{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Help Center
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-xl mx-auto">
            Step-by-step guides and answers to the most common questions about setting up and using Arthaleads CRM.
          </p>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-16 bg-[#080810]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Getting Started</h2>
            <p className="text-white/50 text-base max-w-lg mx-auto">
              Follow these five steps to go from sign-up to your first managed lead in under 15 minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="p-5 rounded-2xl border border-white/8 bg-white/2">
                <div className="text-[#ff6b00] font-black text-2xl mb-3">{num}</div>
                <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/signup"
              className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25">
              Create Your Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Frequently Asked Questions</h2>
            <p className="text-white/50 text-base">
              Quick answers to the questions we hear most often from real estate teams getting started.
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* Support CTA */}
      <section className="py-20 bg-[#080810]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Need more help?</h2>
          <p className="text-white/50 text-base mb-6">
            Can't find what you're looking for? Our team is ready to assist.
          </p>
          <a href="mailto:support@arthaleads.com"
            className="inline-flex items-center gap-2 border border-[#ff6b00]/40 bg-[#ff6b00]/10 hover:bg-[#ff6b00]/20 text-[#ff6b00] font-semibold px-6 py-3 rounded-xl transition-colors">
            <Mail className="w-4 h-4" />
            support@arthaleads.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#080810] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/25 text-sm">© {new Date().getFullYear()} Arthaleads. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-white/35 hover:text-white/70 transition-colors">Privacy Policy</Link>
              <Link to="/terms"   className="text-white/35 hover:text-white/70 transition-colors">Terms of Service</Link>
              <a href="mailto:hello@arthaleads.com" className="text-white/35 hover:text-white/70 transition-colors flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> hello@arthaleads.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
