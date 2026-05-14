import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const updates = [
  {
    date: "May 2026",
    title: "WordPress Plugin v1.0.2 — 8 Form Builders Supported",
    desc: "The Arthaleads WordPress plugin now captures leads from MetForm, Contact Form 7, WPForms, Elementor Forms, Gravity Forms, Ninja Forms, Forminator, and Fluent Forms. All custom form fields are captured automatically — name, phone, project interest, and any field you add.",
    tags: ["WordPress", "Integrations"],
  },
  {
    date: "April 2026",
    title: "Blog Module for Real Estate Teams",
    desc: "Publish property listings, market insights, and project updates directly from your Arthaleads dashboard. Full rich-text editor with image uploads, category management, and SEO-friendly slugs. Content appears on your public blog at arthaleads.com/blog.",
    tags: ["Content", "New Feature"],
  },
  {
    date: "April 2026",
    title: "Not Reachable Lead Status",
    desc: "A dedicated pipeline stage for leads that couldn't be contacted — number not reachable, switched off, or out of coverage. Telecallers can now accurately track this state separately from other non-contact outcomes, giving managers clearer pipeline data.",
    tags: ["Pipeline", "Improvement"],
  },
  {
    date: "March 2026",
    title: "Paste-and-Import — Instant Lead List Import",
    desc: "Import lead lists by pasting markdown or CSV data directly into the CRM. No file upload required. The system parses the content, extracts fields, detects duplicates, and loads the leads into your project in seconds.",
    tags: ["Imports", "New Feature"],
  },
  {
    date: "March 2026",
    title: "Facebook Leads Integration — Auto Pull from Meta Campaigns",
    desc: "Connect your Facebook Ad account and Arthaleads will automatically pull new leads from your Meta campaigns in real time. No manual export from Meta's Leads Centre. Leads arrive in your CRM within seconds of a form submission.",
    tags: ["Facebook", "Integrations"],
  },
  {
    date: "February 2026",
    title: "WhatsApp Source Tracking",
    desc: "Leads that originate from WhatsApp chats are automatically tagged with a WhatsApp source label and tracked separately in your analytics dashboard. Filter your pipeline by source to see exactly how much pipeline WhatsApp is generating vs. other channels.",
    tags: ["WhatsApp", "Analytics"],
  },
];

function ProductUpdatesInner() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "Product Updates — Arthaleads CRM Latest Features & Improvements",
    description: "See the latest features, improvements, and updates to Arthaleads CRM. Stay up to date with India's top real estate lead management platform.",
    canonical: "https://www.arthaleads.com/product-updates",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const tagBg      = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6";
  const tagText    = isDark ? "rgba(255,255,255,0.45)" : "#9ca3af";
  const tagBorder  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const timelineLine = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.08)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <span className="w-2 h-2 rounded-full bg-[#ff6b00] animate-pulse" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Product Updates</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5" style={{ color: textColor }}>
            What's New in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Arthaleads
            </span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: softText }}>
            We ship improvements every week. Here's what's changed.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-12" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-px ml-[7px] hidden sm:block" style={{ background: timelineLine }} />
            <div className="space-y-10">
              {updates.map(({ date, title, desc, tags }, i) => (
                <div key={i} className="sm:pl-10 relative">
                  <div
                    className="hidden sm:block absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 shadow-lg shadow-orange-500/30"
                    style={{ background: "#ff6b00", borderColor: bg }}
                  />
                  <div className="text-[#ff6b00] text-xs font-semibold uppercase tracking-widest mb-2">{date}</div>
                  <div className="p-6 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <h2 className="font-bold text-lg mb-3 leading-snug" style={{ color: textColor }}>{title}</h2>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: softText }}>{desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs" style={{ background: tagBg, border: `1px solid ${tagBorder}`, color: tagText }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: textColor }}>
            Try the latest features today
          </h2>
          <p className="text-base mb-8" style={{ color: softText }}>
            Every update goes live for all users the day it ships. Start your free trial to access everything.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default function ProductUpdates() {
  return <ProductUpdatesInner />;
}
