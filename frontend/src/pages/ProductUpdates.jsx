import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import PublicNav from "../components/PublicNav";
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

export default function ProductUpdates() {
  useSEO({
    title: "Product Updates — Arthaleads CRM Latest Features & Improvements",
    description: "See the latest features, improvements, and updates to Arthaleads CRM. Stay up to date with India's top real estate lead management platform.",
    canonical: "https://www.arthaleads.com/product-updates",
  });

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-[#ff6b00]/8 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#ff6b00] animate-pulse" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Product Updates</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-5">
            What's New in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Arthaleads
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-xl mx-auto">
            We ship improvements every week. Here's what's changed.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/8 ml-[7px] hidden sm:block" />
            <div className="space-y-10">
              {updates.map(({ date, title, desc, tags }, i) => (
                <div key={i} className="sm:pl-10 relative">
                  <div className="hidden sm:block absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-[#ff6b00] border-2 border-[#0d0d1a] shadow-lg shadow-orange-500/30" />
                  <div className="text-[#ff6b00] text-xs font-semibold uppercase tracking-widest mb-2">{date}</div>
                  <div className="p-6 rounded-2xl border border-white/8 bg-white/2">
                    <h2 className="text-white font-bold text-lg mb-3 leading-snug">{title}</h2>
                    <p className="text-white/55 text-sm leading-relaxed mb-4">{desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/45 text-xs">
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
      <section className="py-20 bg-[#080810]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Try the latest features today
          </h2>
          <p className="text-white/50 text-base mb-8">
            Every update goes live for all users the day it ships. Start your free trial to access everything.
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
