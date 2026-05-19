// pages/Landing.jsx - Arthaleads public marketing homepage
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight, Check, ArrowRight,
  BarChart3, Users, Zap, Building2, PhoneCall,
  Bell, Target, TrendingUp, Shield, Star,
  Facebook, MessageCircle, Mail, Phone, MapPin,
  ChevronDown, PlayCircle, Layers, Clock, Filter,
  FileSpreadsheet, UserCheck, Activity
} from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";

// ── Smooth scroll helper ──────────────────────────────────────────────────────
function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ isDark }) {
  const heroBg     = isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 60%)";
  const headingClr = isDark ? "#ffffff" : "#111827";
  const bodyClr    = isDark ? "rgba(255,255,255,0.6)" : "#6b7280";
  const softClr    = isDark ? "rgba(255,255,255,0.4)" : "#9ca3af";
  const btnBorder  = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const btnText    = isDark ? "rgba(255,255,255,0.70)" : "#374151";
  const cardBg     = isDark
    ? "linear-gradient(135deg, rgba(255,107,0,0.05) 0%, rgba(13,13,26,0.9) 50%)"
    : "linear-gradient(135deg, rgba(255,107,0,0.04) 0%, rgba(249,250,251,0.95) 50%)";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const statCardBg  = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const statCardBdr = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const statLabel   = isDark ? "rgba(255,255,255,0.40)" : "#9ca3af";
  const statVal     = isDark ? "#ffffff" : "#111827";
  const gridOpacity = isDark ? "0.03" : "0.04";
  const urlBarBg    = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const urlText     = isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.25)";
  const barTrack    = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
  const srcText     = isDark ? "rgba(255,255,255,0.60)" : "#6b7280";
  const srcVal      = isDark ? "#ffffff" : "#111827";
  const scrollChevr = isDark ? "rgba(255,255,255,0.30)" : "#9ca3af";

  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: heroBg }}>
      {/* Background glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff6b00]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-900/10 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff6b00]/5 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0"
          style={{ opacity: gridOpacity, backgroundImage: "linear-gradient(rgba(255,107,0,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,0,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="text-center max-w-4xl mx-auto">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#ff6b00] animate-pulse" />
            <span className="text-[#ff6b00] text-xs font-semibold tracking-wide uppercase">
              #1 Real Estate CRM in Pune
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.1] mb-6"
            style={{ color: headingClr }}>
            Manage Every Lead.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Close More Deals.
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ color: bodyClr }}>
            Arthaleads brings every property enquiry - Facebook ads, Google campaigns, WhatsApp chats,
            and walk-ins - into one powerful workspace. Built for real estate developers and channel partners.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/signup"
              className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 text-base">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={() => scrollTo("features")}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl transition-all duration-200 text-base font-medium border"
              style={{ color: btnText, borderColor: btnBorder }}>
              <PlayCircle className="w-5 h-5" />
              See How It Works
            </button>
          </div>

          {/* Social proof numbers */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            {[
              { num: "10,000+", label: "Leads Managed" },
              { num: "50+",     label: "Teams Onboarded" },
              { num: "3×",      label: "Faster Follow-ups" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-black text-[#ff6b00]">{s.num}</div>
                <div className="text-xs sm:text-sm mt-0.5" style={{ color: softClr }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard preview - MacBook mockup (frame is part of the PNG) */}
        <div className="mt-16 max-w-4xl mx-auto px-4">
          <link rel="preload" as="image" href="/dashboard-light.png" />
          <img
            src="/dashboard-light.png"
            alt="Arthaleads CRM Dashboard"
            className="w-full"
            style={{ display: "block" }}
          />
        </div>

        {/* Scroll indicator */}
        <div className="mt-12 flex justify-center">
          <button onClick={() => scrollTo("features")} className="animate-bounce transition-colors"
            style={{ color: scrollChevr }}>
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Sources strip ─────────────────────────────────────────────────────────────
function SourcesStrip({ isDark }) {
  const bg       = isDark ? "#0d0d1a" : "#f9fafb";
  const border   = isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb";
  const label    = isDark ? "rgba(255,255,255,0.30)" : "#9ca3af";
  const chipBg   = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const chipBdr  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const chipText = isDark ? "rgba(255,255,255,0.60)" : "#6b7280";

  const sources = [
    { name: "Facebook Ads",  icon: Facebook,       color: "#1877F2" },
    { name: "WhatsApp",      icon: MessageCircle,  color: "#25D366" },
    { name: "Google Ads",    icon: Target,         color: "#EA4335" },
    { name: "Walk-ins",      icon: Building2,      color: "#ff6b00" },
    { name: "99acres",       icon: Layers,         color: "#e63946" },
    { name: "Housing.com",   icon: Building2,      color: "#1e90ff" },
    { name: "MagicBricks",   icon: Layers,         color: "#c0392b" },
    { name: "Email & Forms", icon: Mail,           color: "#6366f1" },
  ];

  return (
    <section className="py-10" style={{ background: bg, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: label }}>
          Capture leads from every source
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {sources.map(({ name, icon: Icon, color }) => (
            <div key={name} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-colors"
              style={{ background: chipBg, border: `1px solid ${chipBdr}` }}>
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-sm font-medium" style={{ color: chipText }}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Layers,
    color: "#ff6b00",
    title: "Unified Lead Inbox",
    desc: "Every lead from Facebook, WhatsApp, Google Ads, walk-ins and portals lands in one place. No more juggling spreadsheets or missing follow-ups across platforms.",
  },
  {
    icon: Building2,
    color: "#22c55e",
    title: "Project Management",
    desc: "Run multiple real estate projects simultaneously. Import thousands of leads per project, track their status, and assign telecallers - all in one workspace.",
  },
  {
    icon: PhoneCall,
    color: "#3b82f6",
    title: "Telecaller Workflow",
    desc: "Streamline your calling team with remark tracking, booking status, follow-up scheduling, and call outcomes. Never let a hot lead go cold again.",
  },
  {
    icon: BarChart3,
    color: "#a855f7",
    title: "Performance Analytics",
    desc: "Real-time dashboards showing lead sources, team conversion rates, follow-up completion, and deal pipeline. Make data-driven decisions every day.",
  },
  {
    icon: Users,
    color: "#f59e0b",
    title: "Team Management",
    desc: "Assign roles - Admin, Manager, Agent - with controlled access. Track attendance, monitor individual performance, and manage the entire sales team from one panel.",
  },
  {
    icon: Bell,
    color: "#ec4899",
    title: "Smart Alerts & Follow-ups",
    desc: "Automated reminders for scheduled follow-ups, push notifications for new lead assignments, and overdue call alerts so nothing slips through the cracks.",
  },
  {
    icon: Filter,
    color: "#14b8a6",
    title: "Duplicate Prevention",
    desc: "Our intelligent import engine detects and skips duplicate phone numbers automatically - even across different formats. Every agent calls a unique lead.",
  },
  {
    icon: TrendingUp,
    color: "#ff6b00",
    title: "Lead Pipeline",
    desc: "Kanban-style pipeline view lets you drag leads through stages - New, Contacted, Site Visit, Booked, Closed. Visualise your entire sales funnel at a glance.",
  },
  {
    icon: Shield,
    color: "#22c55e",
    title: "Secure & Multi-tenant",
    desc: "Enterprise-grade data isolation. Every organisation's data is completely separate. Role-based access ensures agents only see what they're supposed to.",
  },
];

function Features({ isDark }) {
  const bg       = isDark ? "#0d0d1a" : "#ffffff";
  const heading  = isDark ? "#ffffff" : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const cardBg   = isDark ? "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)" : "#ffffff";
  const cardBdr  = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const cardText = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";

  return (
    <section id="features" className="py-24 lg:py-32" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Zap className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4" style={{ color: heading }}>
            Everything your team needs to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              close more deals
            </span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: body }}>
            Built specifically for the Indian real estate market - from small channel partner offices to large developer sales teams.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title}
              className="group p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
              style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${color}18` }}>
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ color: heading }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: cardText }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks({ isDark }) {
  const steps = [
    {
      num: "01",
      icon: FileSpreadsheet,
      title: "Import or Capture Leads",
      desc: "Connect your Facebook Ad account for auto-import, paste a CSV, or add leads manually. Our system normalises phone numbers and removes duplicates instantly.",
    },
    {
      num: "02",
      icon: UserCheck,
      title: "Assign to Your Team",
      desc: "Distribute leads to your telecallers and agents based on projects or geography. Agents receive instant push notifications for new assignments.",
    },
    {
      num: "03",
      icon: PhoneCall,
      title: "Call, Remark & Follow Up",
      desc: "Agents log call outcomes, schedule follow-ups, and set booking status. Managers see live progress dashboards at every stage.",
    },
    {
      num: "04",
      icon: TrendingUp,
      title: "Track & Convert",
      desc: "Move hot leads from Site Visit Booked to Booked. Analytics show your conversion rate, top sources, and team performance over any time period.",
    },
  ];

  const bg      = isDark ? "#080810" : "#f9fafb";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const stepBd  = isDark ? "rgba(255,255,255,0.45)" : "#374151";
  const badgeBg = isDark ? "#0d0d1a" : "#ffffff";

  return (
    <section className="py-24 lg:py-32" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Activity className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4" style={{ color: heading }}>
            Up and running in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              minutes
            </span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: body }}>
            No complex onboarding. Your team can start managing leads the same day.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-16 left-1/2 -translate-x-1/2 w-[calc(100%-12rem)] h-px bg-gradient-to-r from-transparent via-[#ff6b00]/30 to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map(({ num, icon: Icon, title, desc }) => (
              <div key={num} className="text-center">
                <div className="relative inline-flex mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6b00] to-[#a04100] flex items-center justify-center shadow-xl shadow-orange-500/20">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 text-[10px] font-black text-[#ff6b00] border border-[#ff6b00]/30 rounded-full w-6 h-6 flex items-center justify-center"
                    style={{ background: badgeBg }}>
                    {num.slice(1)}
                  </span>
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: heading }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: body }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────
function About({ isDark }) {
  const points = [
    "Founded by real estate professionals who felt the pain of managing hundreds of leads across WhatsApp, email, and spreadsheets.",
    "Designed for the Indian market - we understand the way property sales teams actually work in Pune, Mumbai, and across Maharashtra.",
    "Built for scale - whether you're a 3-person channel partner office or a 100-seat developer sales team.",
    "Continuously improved based on direct feedback from our customers' daily workflows.",
  ];

  const bg      = isDark ? "#0d0d1a" : "#ffffff";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg  = isDark ? "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" : "#ffffff";
  const cardBdr = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const cardSub = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";

  return (
    <section id="about" className="py-24 lg:py-32" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left - text */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
              <Building2 className="w-3.5 h-3.5 text-[#ff6b00]" />
              <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">About Arthaleads</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6 leading-tight" style={{ color: heading }}>
              Built by real estate people,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
                for real estate people
              </span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: body }}>
              Arthaleads was born out of frustration. We watched sales teams lose hot leads because they were scattered across six different WhatsApp groups, three spreadsheets, and someone's personal notebook.
            </p>
            <p className="text-base leading-relaxed mb-10" style={{ color: body }}>
              We built the CRM we always wished we had - one that speaks the language of property sales, handles the volume of real estate campaigns, and makes every agent's job easier from day one.
            </p>
            <div className="space-y-3">
              {points.map((p) => (
                <div key={p} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#ff6b00]/15 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-[#ff6b00]" />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: body }}>{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right - stat cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { val: "50+",     label: "Real Estate Teams",    sub: "actively using Arthaleads",  color: "#ff6b00" },
              { val: "10,000+", label: "Leads Managed Monthly",sub: "across all organisations",    color: "#22c55e" },
              { val: "98%",     label: "Uptime Guaranteed",    sub: "enterprise-grade reliability", color: "#3b82f6" },
              { val: "3×",      label: "Faster Follow-ups",    sub: "vs. manual spreadsheet teams", color: "#a855f7" },
            ].map(({ val, label, sub, color }) => (
              <div key={label} className="p-6 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
                <div className="text-3xl font-black mb-1" style={{ color }}>{val}</div>
                <div className="font-semibold text-sm mb-1" style={{ color: heading }}>{label}</div>
                <div className="text-xs" style={{ color: cardSub }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────
function Testimonials({ isDark }) {
  const reviews = [
    {
      name: "Rajesh Patil",
      role: "Sales Head, Kolte Patil Channel Partner",
      quote: "Before Arthaleads, our team was managing 500+ Facebook leads in WhatsApp groups. Now everything is centralised and our follow-up rate has tripled.",
      stars: 5,
    },
    {
      name: "Priya Sharma",
      role: "Founder, Milestone Properties",
      quote: "The project import feature is a game-changer. We imported 2,000 leads in minutes and the duplicate detection saved us from calling the same people twice.",
      stars: 5,
    },
    {
      name: "Amit Deshmukh",
      role: "Manager, Magarpatta Real Estate Team",
      quote: "Our conversion rate jumped from 2% to 6% in 3 months. The analytics dashboard gives us clarity we never had before with Excel sheets.",
      stars: 5,
    },
  ];

  const bg      = isDark ? "#080810" : "#f9fafb";
  const heading = isDark ? "#ffffff" : "#111827";
  const cardBg  = isDark ? "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" : "#ffffff";
  const cardBdr = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const quoteClr= isDark ? "rgba(255,255,255,0.65)" : "#6b7280";
  const nameClr = isDark ? "#ffffff" : "#111827";
  const roleClr = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";

  return (
    <section className="py-24 lg:py-32" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Star className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Customer Stories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: heading }}>
            Trusted by teams across{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Maharashtra
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map(({ name, role, quote, stars }) => (
            <div key={name} className="p-6 rounded-2xl flex flex-col gap-5"
              style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
              <div className="flex gap-1">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#ff6b00] text-[#ff6b00]" />
                ))}
              </div>
              <p className="text-sm leading-relaxed flex-1" style={{ color: quoteClr }}>"{quote}"</p>
              <div>
                <div className="font-semibold text-sm" style={{ color: nameClr }}>{name}</div>
                <div className="text-xs mt-0.5" style={{ color: roleClr }}>{role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function Pricing({ isDark }) {
  const plans = [
    {
      name: "Starter",
      tagline: "Perfect for small teams and channel partners",
      color: "#3b82f6",
      features: [
        "Up to 5 team members",
        "Unlimited lead imports",
        "Facebook & WhatsApp integration",
        "Basic analytics dashboard",
        "Lead pipeline & follow-ups",
        "Email support",
      ],
      cta: "Get Started",
    },
    {
      name: "Growth",
      tagline: "For growing real estate teams",
      color: "#ff6b00",
      popular: true,
      features: [
        "Up to 25 team members",
        "Multiple projects & campaigns",
        "All lead sources connected",
        "Advanced analytics & reports",
        "Team performance dashboard",
        "Duplicate lead prevention",
        "Attendance tracking",
        "Priority support",
      ],
      cta: "Start Free Trial",
    },
    {
      name: "Enterprise",
      tagline: "For large developers and franchise networks",
      color: "#a855f7",
      features: [
        "Unlimited team members",
        "Custom branding & white-label",
        "Dedicated account manager",
        "API access & integrations",
        "Multi-org management",
        "Custom reporting",
        "SLA-backed uptime",
        "On-site training",
      ],
      cta: "Contact Sales",
    },
  ];

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const heading    = isDark ? "#ffffff" : "#111827";
  const body       = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const cardBg     = isDark ? "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" : "#ffffff";
  const cardBdr    = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const popBg      = isDark ? "linear-gradient(135deg, rgba(255,107,0,0.07), rgba(13,13,26,0.95))" : "linear-gradient(135deg, #fff7f0, #fff)";
  const taglineClr = isDark ? "rgba(255,255,255,0.40)" : "#9ca3af";
  const divBdr     = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const priceClr   = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const chevClr    = isDark ? "rgba(255,255,255,0.30)" : "#9ca3af";
  const featClr    = isDark ? "rgba(255,255,255,0.65)" : "#374151";
  const altBtnClr  = isDark ? "rgba(255,255,255,0.70)" : "#374151";
  const altBtnBdr  = isDark ? "rgba(255,255,255,0.10)" : "#d1d5db";
  const noteClr    = isDark ? "rgba(255,255,255,0.30)" : "#9ca3af";

  return (
    <section id="pricing" className="py-24 lg:py-32" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Target className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Pricing Plans</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4" style={{ color: heading }}>
            Plans for every{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              team size
            </span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: body }}>
            Transparent, flexible pricing with no hidden fees. Start free, scale as you grow.
            Contact us for exact pricing tailored to your team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map(({ name, tagline, color, popular, features, cta }) => (
            <div key={name}
              className={`relative p-7 rounded-2xl transition-all duration-300 ${popular ? "shadow-2xl shadow-orange-500/10 scale-105" : ""}`}
              style={{
                background: popular ? popBg : cardBg,
                border: popular ? "1px solid rgba(255,107,0,0.40)" : `1px solid ${cardBdr}`,
              }}>
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-[#ff6b00] text-white text-xs font-bold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                    <Zap className="w-4 h-4" style={{ color }} />
                  </div>
                  <h3 className="font-black text-xl" style={{ color: heading }}>{name}</h3>
                </div>
                <p className="text-sm" style={{ color: taglineClr }}>{tagline}</p>
              </div>

              <div className="mb-6 pb-6" style={{ borderBottom: `1px solid ${divBdr}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: priceClr }}>Pricing available on request</span>
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: chevClr }} />
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: `${color}20` }}>
                      <Check className="w-2.5 h-2.5" style={{ color }} />
                    </div>
                    <span className="text-sm" style={{ color: featClr }}>{f}</span>
                  </li>
                ))}
              </ul>

              <button onClick={() => scrollTo("contact")}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  popular ? "bg-[#ff6b00] hover:bg-[#e05f00] text-white shadow-lg shadow-orange-500/20" : ""
                }`}
                style={popular ? {} : { border: `1px solid ${altBtnBdr}`, color: altBtnClr }}>
                {cta}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm mt-10" style={{ color: noteClr }}>
          All plans include a 14-day free trial. No credit card required to get started.
        </p>
      </div>
    </section>
  );
}

// ── Contact ───────────────────────────────────────────────────────────────────
function Contact({ isDark }) {
  const info = [
    { icon: Mail,    label: "Email Us",  val: "contact@arthaleads.com",    href: "mailto:contact@arthaleads.com" },
    { icon: Phone,   label: "Call Us",   val: "+91 98765 43210",           href: "tel:+919876543210" },
    { icon: MapPin,  label: "Based In",  val: "Pune, Maharashtra, India",  href: null },
  ];

  const bg        = isDark ? "#080810" : "#f9fafb";
  const heading   = isDark ? "#ffffff" : "#111827";
  const body      = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const infoLabel = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const infoVal   = isDark ? "#ffffff" : "#111827";
  const cardBg    = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr   = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const waText    = isDark ? "#ffffff" : "#111827";
  const waSub     = isDark ? "rgba(255,255,255,0.40)" : "#9ca3af";

  return (
    <section id="contact" className="py-24 lg:py-32" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

          {/* Left - info */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
              <MessageCircle className="w-3.5 h-3.5 text-[#ff6b00]" />
              <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Get in Touch</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: heading }}>
              Ready to transform your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
                lead management?
              </span>
            </h2>
            <p className="text-base leading-relaxed mb-10" style={{ color: body }}>
              Talk to our team for a personalised demo, pricing information, or any questions about how Arthaleads can fit your workflow.
            </p>

            <div className="space-y-5">
              {info.map(({ icon: Icon, label, val, href }) => (
                <div key={label} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#ff6b00]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#ff6b00]" />
                  </div>
                  <div>
                    <div className="text-xs font-medium" style={{ color: infoLabel }}>{label}</div>
                    {href ? (
                      <a href={href} className="text-sm font-medium hover:text-[#ff6b00] transition-colors" style={{ color: infoVal }}>{val}</a>
                    ) : (
                      <div className="text-sm font-medium" style={{ color: infoVal }}>{val}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <a href="https://wa.me/919876543210?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Arthaleads"
              target="_blank" rel="noopener noreferrer"
              className="mt-10 inline-flex items-center gap-3 bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors px-5 py-3 rounded-xl">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              <div>
                <div className="text-sm font-semibold" style={{ color: waText }}>Chat on WhatsApp</div>
                <div className="text-xs" style={{ color: waSub }}>Usually replies within minutes</div>
              </div>
            </a>
          </div>

          {/* Right - form */}
          <div className="p-7 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
            <ContactForm isDark={isDark} />
          </div>

        </div>
      </div>
    </section>
  );
}

function ContactForm({ isDark }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
    try {
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) setSent(true);
      else setError(data.message || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const heading  = isDark ? "#ffffff" : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const labelClr = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const inputBg  = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const inputBdr = isDark ? "rgba(255,255,255,0.08)" : "#d1d5db";
  const inputClr = isDark ? "#ffffff" : "#111827";

  if (sent) return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
        <Check className="w-8 h-8 text-green-400" />
      </div>
      <h3 className="font-bold text-xl mb-2" style={{ color: heading }}>Message Sent!</h3>
      <p className="text-sm" style={{ color: body }}>We'll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
      <button onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", company: "", message: "" }); }}
        className="mt-6 text-[#ff6b00] text-sm font-medium hover:underline">Send another message</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-bold text-lg mb-6" style={{ color: heading }}>Send us a message</h3>
      {[
        { id: "name",    label: "Your Name",      type: "text",  ph: "Rajesh Patil",        req: true },
        { id: "email",   label: "Email Address",  type: "email", ph: "rajesh@example.com",  req: true },
        { id: "phone",   label: "Phone Number",   type: "tel",   ph: "+91 98765 43210",     req: false },
        { id: "company", label: "Company / Team", type: "text",  ph: "Milestone Properties", req: false },
      ].map(({ id, label, type, ph, req }) => (
        <div key={id}>
          <label className="block text-xs font-medium mb-1.5" style={{ color: labelClr }}>
            {label}{req && <span className="text-[#ff6b00] ml-0.5">*</span>}
          </label>
          <input type={type} placeholder={ph} required={req}
            value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })}
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff6b00]/40 transition-all"
            style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: inputClr }} />
        </div>
      ))}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: labelClr }}>Message</label>
        <textarea rows={4} placeholder="Tell us about your team size, current lead volume, and what you're looking for..."
          value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff6b00]/40 transition-all resize-none"
          style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: inputClr }} />
      </div>
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-[#ff6b00] hover:bg-[#e05f00] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
        {loading ? "Sending…" : "Send Message"}
        {!loading && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA({ isDark }) {
  const bg      = isDark ? "#0d0d1a" : "#fff7f0";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const btnBdr  = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const btnText = isDark ? "rgba(255,255,255,0.70)" : "#374151";

  return (
    <section className="py-20 relative overflow-hidden" style={{ background: bg }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #ff6b00 0%, transparent 70%)" }} />
      </div>
      <div className="relative max-w-3xl mx-auto text-center px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4" style={{ color: heading }}>
          Stop losing leads to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
            messy spreadsheets
          </span>
        </h2>
        <p className="text-lg mb-10" style={{ color: body }}>
          Join 50+ real estate teams already closing more deals with Arthaleads.
          Start your free trial today - no credit card needed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signup"
            className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1">
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <button onClick={() => scrollTo("contact")}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl transition-all duration-200 font-medium border"
            style={{ color: btnText, borderColor: btnBdr }}>
            Talk to Sales
          </button>
        </div>
      </div>
    </section>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  const { isDark } = usePublicTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Arthaleads - Real Estate CRM | Manage Every Property Lead";
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) { desc = document.createElement("meta"); desc.name = "description"; document.head.appendChild(desc); }
    desc.content = "Arthaleads is India's #1 real estate CRM. Capture Facebook, Google, WhatsApp & website leads automatically. Built for developers, brokers & channel partners.";
  }, []);

  return (
    <div className="min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
      <PublicNav onScrollTo={scrollTo} />
      <Hero isDark={isDark} />
      <SourcesStrip isDark={isDark} />
      <Features isDark={isDark} />
      <HowItWorks isDark={isDark} />
      <About isDark={isDark} />
      <Testimonials isDark={isDark} />
      <Pricing isDark={isDark} />
      <Contact isDark={isDark} />
      <FinalCTA isDark={isDark} />
      <PublicFooter />
    </div>
  );
}
