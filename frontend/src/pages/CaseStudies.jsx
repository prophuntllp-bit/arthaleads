import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useSEO } from "../utils/useSEO";

const cases = [
  {
    tag: "Real Estate Developer",
    result: "40% faster response time",
    headline: "Capturing Facebook and Google leads automatically — zero manual export",
    body: "A Pune-based real estate developer was running simultaneous Facebook lead ad campaigns and Google search campaigns for two projects. Leads were arriving in Meta's Leads Centre and a Google Sheet, and someone had to manually copy them into a WhatsApp group every few hours. High-intent enquiries were going cold by the time a telecaller called. After connecting both sources to Arthaleads, every new lead appears in the CRM within seconds, gets assigned automatically, and the telecaller receives a push notification to call immediately.",
    metrics: [
      { val: "40%", label: "faster response time" },
      { val: "2 sources", label: "connected automatically" },
      { val: "0 manual exports", label: "required daily" },
    ],
  },
  {
    tag: "Channel Partner",
    result: "60% improvement in follow-up consistency",
    headline: "Managing three project pipelines in one CRM with full team visibility",
    body: "A channel partner managing sales for three different developer projects found that their telecallers were mixing up lead lists, calling the wrong leads for the wrong project, and missing scheduled follow-ups because they were tracked in personal notebooks. With Arthaleads, each project has its own lead pipeline. Telecallers see only their assigned leads. Managers get a live dashboard showing follow-up completion rates across all three projects. Follow-up reminders fire automatically.",
    metrics: [
      { val: "3 projects", label: "in one dashboard" },
      { val: "60%", label: "better follow-up consistency" },
      { val: "100%", label: "lead-to-agent traceability" },
    ],
  },
  {
    tag: "Real Estate Agency",
    result: "Zero leads lost from website forms",
    headline: "WordPress contact forms feeding directly into the CRM — every enquiry captured",
    body: "A real estate agency with a high-traffic property listing website was relying on email notifications from their WordPress contact form. Emails would get buried, marked as spam, or simply not checked over weekends. Enquiries from serious buyers were sitting unanswered for days. After installing the Arthaleads WordPress plugin and connecting it via webhook, every form submission arrives in the CRM in real time, is assigned to an available agent, and triggers an immediate follow-up reminder.",
    metrics: [
      { val: "0 leads", label: "lost from web forms" },
      { val: "Real-time", label: "form-to-CRM delivery" },
      { val: "8 form types", label: "supported out of box" },
    ],
  },
];

export default function CaseStudies() {
  useSEO({
    title: "Case Studies — How Real Estate Teams Win with Arthaleads CRM",
    description: "Discover how real estate developers, builders, and brokers across India use Arthaleads CRM to capture more leads, track site visits, and close more property deals faster.",
    canonical: "https://www.arthaleads.com/case-studies",
  });

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-[#ff6b00]/8 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Case Studies</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-5">
            Real Estate Teams.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Real Results.
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto leading-relaxed">
            How developers, channel partners, and agencies across India use Arthaleads to capture more leads,
            respond faster, and close more property deals.
          </p>
        </div>
      </section>

      {/* Cases */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {cases.map(({ tag, result, headline, body, metrics }, i) => (
            <div key={i}
              className="rounded-2xl border border-white/8 overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}>
              <div className="p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <span className="px-3 py-1 rounded-full bg-[#ff6b00]/15 border border-[#ff6b00]/25 text-[#ff6b00] text-xs font-semibold">
                    {tag}
                  </span>
                  <span className="text-white/35 text-sm">Result: <span className="text-white/70 font-semibold">{result}</span></span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4 leading-snug">{headline}</h2>
                <p className="text-white/55 text-base leading-relaxed mb-8 max-w-3xl">{body}</p>
                <div className="grid grid-cols-3 gap-4">
                  {metrics.map(({ val, label }) => (
                    <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/6 text-center">
                      <div className="text-2xl font-black text-[#ff6b00] mb-1">{val}</div>
                      <div className="text-white/45 text-xs">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#080810]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            See Arthaleads in Action
          </h2>
          <p className="text-white/50 text-base mb-8">
            Start a free trial and set up your first lead pipeline today. No credit card required.
          </p>
          <Link to="/signup"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5">
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
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
