// pages/Landing.jsx — Arthaleads public marketing homepage
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
import { PublicThemeProvider } from "../context/PublicThemeContext";

// ── Smooth scroll helper ──────────────────────────────────────────────────────
function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden bg-[#0d0d1a]">
      {/* Background glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff6b00]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-900/10 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff6b00]/5 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,107,0,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,0,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
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
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-[1.1] mb-6">
            Manage Every Lead.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Close More Deals.
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-white/60 leading-relaxed max-w-2xl mx-auto mb-10">
            Arthaleads brings every property enquiry — Facebook ads, Google campaigns, WhatsApp chats,
            and walk-ins — into one powerful workspace. Built for real estate developers and channel partners.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/signup"
              className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 text-base">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={() => scrollTo("features")}
              className="flex items-center gap-2 text-white/70 hover:text-white border border-white/10 hover:border-white/30 px-8 py-4 rounded-2xl transition-all duration-200 text-base font-medium">
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
                <div className="text-xs sm:text-sm text-white/40 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard preview card */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50"
            style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.05) 0%, rgba(13,13,26,0.9) 50%)" }}>
            <div className="p-4 sm:p-6 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <div className="ml-4 flex-1 max-w-xs h-6 rounded-lg bg-white/5 flex items-center px-3">
                  <span className="text-white/20 text-xs">arthaleads.com/dashboard</span>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Leads",   val: "2,847",  color: "#ff6b00", icon: Users },
                { label: "New Today",      val: "34",     color: "#22c55e", icon: TrendingUp },
                { label: "Follow-ups",     val: "128",    color: "#3b82f6", icon: Clock },
                { label: "Closed Won",     val: "91",     color: "#a855f7", icon: Target },
              ].map(({ label, val, color, icon: Icon }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/40 text-xs font-medium uppercase tracking-wide">{label}</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white">{val}</div>
                </div>
              ))}
            </div>
            <div className="px-4 sm:px-8 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { source: "Facebook",  count: 1240, pct: 44 },
                { source: "WhatsApp",  count: 890,  pct: 31 },
                { source: "Google",    count: 717,  pct: 25 },
              ].map(({ source, count, pct }) => (
                <div key={source} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-sm">{source}</span>
                    <span className="text-white text-sm font-bold">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ffaa00] transition-all"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="mt-12 flex justify-center">
          <button onClick={() => scrollTo("features")} className="animate-bounce text-white/30 hover:text-white/60 transition-colors">
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Sources strip ─────────────────────────────────────────────────────────────
function SourcesStrip() {
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
    <section className="py-10 bg-[#0d0d1a] border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest mb-8">
          Capture leads from every source
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {sources.map(({ name, icon: Icon, color }) => (
            <div key={name} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 transition-colors">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-white/60 text-sm font-medium">{name}</span>
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
    desc: "Run multiple real estate projects simultaneously. Import thousands of leads per project, track their status, and assign telecallers — all in one workspace.",
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
    desc: "Assign roles — Admin, Manager, Agent — with controlled access. Track attendance, monitor individual performance, and manage the entire sales team from one panel.",
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
    desc: "Our intelligent import engine detects and skips duplicate phone numbers automatically — even across different formats. Every agent calls a unique lead.",
  },
  {
    icon: TrendingUp,
    color: "#ff6b00",
    title: "Lead Pipeline",
    desc: "Kanban-style pipeline view lets you drag leads through stages — New, Contacted, Site Visit, Booked, Closed. Visualise your entire sales funnel at a glance.",
  },
  {
    icon: Shield,
    color: "#22c55e",
    title: "Secure & Multi-tenant",
    desc: "Enterprise-grade data isolation. Every organisation's data is completely separate. Role-based access ensures agents only see what they're supposed to.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 lg:py-32 bg-[#0d0d1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Zap className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            Everything your team needs to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              close more deals
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Built specifically for the Indian real estate market — from small channel partner offices to large developer sales teams.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title}
              className="group p-6 rounded-2xl border border-white/6 hover:border-white/12 transition-all duration-300 hover:-translate-y-1"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${color}18` }}>
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
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

  return (
    <section className="py-24 lg:py-32 bg-[#080810]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Activity className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            Up and running in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              minutes
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
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
                  <span className="absolute -top-2 -right-2 text-[10px] font-black text-[#ff6b00] bg-[#0d0d1a] border border-[#ff6b00]/30 rounded-full w-6 h-6 flex items-center justify-center">
                    {num.slice(1)}
                  </span>
                </div>
                <h3 className="text-white font-bold text-base mb-2">{title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────
function About() {
  const points = [
    "Founded by real estate professionals who felt the pain of managing hundreds of leads across WhatsApp, email, and spreadsheets.",
    "Designed for the Indian market — we understand the way property sales teams actually work in Pune, Mumbai, and across Maharashtra.",
    "Built for scale — whether you're a 3-person channel partner office or a 100-seat developer sales team.",
    "Continuously improved based on direct feedback from our customers' daily workflows.",
  ];

  return (
    <section id="about" className="py-24 lg:py-32 bg-[#0d0d1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — text */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
              <Building2 className="w-3.5 h-3.5 text-[#ff6b00]" />
              <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">About Arthaleads</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
              Built by real estate people,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
                for real estate people
              </span>
            </h2>
            <p className="text-white/55 text-base leading-relaxed mb-8">
              Arthaleads was born out of frustration. We watched sales teams lose hot leads because they were scattered across six different WhatsApp groups, three spreadsheets, and someone's personal notebook.
            </p>
            <p className="text-white/55 text-base leading-relaxed mb-10">
              We built the CRM we always wished we had — one that speaks the language of property sales, handles the volume of real estate campaigns, and makes every agent's job easier from day one.
            </p>
            <div className="space-y-3">
              {points.map((p) => (
                <div key={p} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#ff6b00]/15 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-[#ff6b00]" />
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — stat cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { val: "50+",     label: "Real Estate Teams",    sub: "actively using Arthaleads",  color: "#ff6b00" },
              { val: "10,000+", label: "Leads Managed Monthly",sub: "across all organisations",    color: "#22c55e" },
              { val: "98%",     label: "Uptime Guaranteed",    sub: "enterprise-grade reliability", color: "#3b82f6" },
              { val: "3×",      label: "Faster Follow-ups",    sub: "vs. manual spreadsheet teams", color: "#a855f7" },
            ].map(({ val, label, sub, color }) => (
              <div key={label} className="p-6 rounded-2xl border border-white/6"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}>
                <div className="text-3xl font-black mb-1" style={{ color }}>{val}</div>
                <div className="text-white font-semibold text-sm mb-1">{label}</div>
                <div className="text-white/35 text-xs">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────
function Testimonials() {
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

  return (
    <section className="py-24 lg:py-32 bg-[#080810]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Star className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Customer Stories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Trusted by teams across{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Maharashtra
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map(({ name, role, quote, stars }) => (
            <div key={name} className="p-6 rounded-2xl border border-white/6 flex flex-col gap-5"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}>
              <div className="flex gap-1">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#ff6b00] text-[#ff6b00]" />
                ))}
              </div>
              <p className="text-white/65 text-sm leading-relaxed flex-1">"{quote}"</p>
              <div>
                <div className="text-white font-semibold text-sm">{name}</div>
                <div className="text-white/35 text-xs mt-0.5">{role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function Pricing() {
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

  return (
    <section id="pricing" className="py-24 lg:py-32 bg-[#0d0d1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Target className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Pricing Plans</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            Plans for every{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              team size
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Transparent, flexible pricing with no hidden fees. Start free, scale as you grow.
            Contact us for exact pricing tailored to your team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map(({ name, tagline, color, popular, features, cta }) => (
            <div key={name}
              className={`relative p-7 rounded-2xl border transition-all duration-300 ${
                popular
                  ? "border-[#ff6b00]/40 shadow-2xl shadow-orange-500/10 scale-105"
                  : "border-white/6"
              }`}
              style={{ background: popular
                ? "linear-gradient(135deg, rgba(255,107,0,0.07), rgba(13,13,26,0.95))"
                : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))"
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
                  <h3 className="text-white font-black text-xl">{name}</h3>
                </div>
                <p className="text-white/40 text-sm">{tagline}</p>
              </div>

              <div className="mb-6 pb-6 border-b border-white/6">
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-sm">Pricing available on request</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: `${color}20` }}>
                      <Check className="w-2.5 h-2.5" style={{ color }} />
                    </div>
                    <span className="text-white/65 text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <button onClick={() => scrollTo("contact")}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  popular
                    ? "bg-[#ff6b00] hover:bg-[#e05f00] text-white shadow-lg shadow-orange-500/20"
                    : "border border-white/10 text-white/70 hover:text-white hover:border-white/25"
                }`}>
                {cta}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-white/30 text-sm mt-10">
          All plans include a 14-day free trial. No credit card required to get started.
        </p>
      </div>
    </section>
  );
}

// ── Contact ───────────────────────────────────────────────────────────────────
function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Open a mailto as a simple contact mechanism
    const subject = encodeURIComponent(`Arthaleads Enquiry from ${form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nCompany: ${form.company}\n\nMessage:\n${form.message}`
    );
    window.open(`mailto:hello@arthaleads.com?subject=${subject}&body=${body}`);
    setSent(true);
  };

  const info = [
    { icon: Mail,    label: "Email Us",      val: "hello@arthaleads.com",    href: "mailto:hello@arthaleads.com" },
    { icon: Phone,   label: "Call Us",       val: "+91 98765 43210",          href: "tel:+919876543210" },
    { icon: MapPin,  label: "Based In",      val: "Pune, Maharashtra, India", href: null },
  ];

  return (
    <section id="contact" className="py-24 lg:py-32 bg-[#080810]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
              <MessageCircle className="w-3.5 h-3.5 text-[#ff6b00]" />
              <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Get in Touch</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Ready to transform your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
                lead management?
              </span>
            </h2>
            <p className="text-white/55 text-base leading-relaxed mb-10">
              Talk to our team for a personalised demo, pricing information, or any questions about how Arthaleads can fit your workflow.
            </p>

            <div className="space-y-5">
              {info.map(({ icon: Icon, label, val, href }) => (
                <div key={label} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#ff6b00]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#ff6b00]" />
                  </div>
                  <div>
                    <div className="text-white/35 text-xs font-medium">{label}</div>
                    {href ? (
                      <a href={href} className="text-white text-sm font-medium hover:text-[#ff6b00] transition-colors">{val}</a>
                    ) : (
                      <div className="text-white text-sm font-medium">{val}</div>
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
                <div className="text-white text-sm font-semibold">Chat on WhatsApp</div>
                <div className="text-white/40 text-xs">Usually replies within minutes</div>
              </div>
            </a>
          </div>

          {/* Right — form */}
          <div className="p-7 rounded-2xl border border-white/6"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}>
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-white font-bold text-xl mb-2">Message Sent!</h3>
                <p className="text-white/50 text-sm">We'll get back to you within 24 hours. Check your email for confirmation.</p>
                <button onClick={() => setSent(false)} className="mt-6 text-[#ff6b00] text-sm font-medium hover:underline">
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-white font-bold text-lg mb-6">Send us a message</h3>
                {[
                  { id: "name",    label: "Your Name",     type: "text",  ph: "Rajesh Patil",          req: true },
                  { id: "email",   label: "Email Address", type: "email", ph: "rajesh@example.com",    req: true },
                  { id: "phone",   label: "Phone Number",  type: "tel",   ph: "+91 98765 43210",        req: false },
                  { id: "company", label: "Company / Team",type: "text",  ph: "Milestone Properties",   req: false },
                ].map(({ id, label, type, ph, req }) => (
                  <div key={id}>
                    <label className="block text-white/50 text-xs font-medium mb-1.5">{label}{req && <span className="text-[#ff6b00] ml-0.5">*</span>}</label>
                    <input
                      type={type} placeholder={ph} required={req}
                      value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#ff6b00]/50 focus:bg-white/8 transition-all" />
                  </div>
                ))}
                <div>
                  <label className="block text-white/50 text-xs font-medium mb-1.5">Message</label>
                  <textarea rows={4} placeholder="Tell us about your team size, current lead volume, and what you're looking for..."
                    value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#ff6b00]/50 focus:bg-white/8 transition-all resize-none" />
                </div>
                <button type="submit"
                  className="w-full bg-[#ff6b00] hover:bg-[#e05f00] text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 flex items-center justify-center gap-2">
                  Send Message
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-20 bg-[#0d0d1a] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #ff6b00 0%, transparent 70%)" }} />
      </div>
      <div className="relative max-w-3xl mx-auto text-center px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
          Stop losing leads to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
            messy spreadsheets
          </span>
        </h2>
        <p className="text-white/50 text-lg mb-10">
          Join 50+ real estate teams already closing more deals with Arthaleads.
          Start your free trial today — no credit card needed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signup"
            className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1">
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <button onClick={() => scrollTo("contact")}
            className="flex items-center gap-2 text-white/70 hover:text-white border border-white/10 hover:border-white/30 px-8 py-4 rounded-2xl transition-all duration-200 font-medium">
            Talk to Sales
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const year = new Date().getFullYear();

  const sections = [
    {
      title: "Product",
      links: [
        { label: "Features",   action: () => scrollTo("features") },
        { label: "Pricing",    action: () => scrollTo("pricing") },
        { label: "How It Works", action: () => scrollTo("features") },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us",   action: () => scrollTo("about") },
        { label: "Contact",    action: () => scrollTo("contact") },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="bg-[#080810] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#a04100] flex items-center justify-center">
                <span className="text-white font-black text-sm">A</span>
              </div>
              <div>
                <span className="text-white font-bold text-lg leading-none">Artha</span>
                <span className="text-[#ff6b00] font-bold text-lg leading-none">leads</span>
              </div>
            </div>
            <p className="text-white/35 text-sm leading-relaxed max-w-xs">
              Real estate CRM built for Indian property teams. Every lead, one place.
            </p>
          </div>

          {sections.map((s) => (
            <div key={s.title}>
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">{s.title}</h4>
              <ul className="space-y-3">
                {s.links.map((l) => (
                  <li key={l.label}>
                    {l.href ? (
                      <Link to={l.href} className="text-white/40 hover:text-white text-sm transition-colors">{l.label}</Link>
                    ) : (
                      <button onClick={l.action} className="text-white/40 hover:text-white text-sm transition-colors">{l.label}</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-sm">© {year} Arthaleads. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="mailto:hello@arthaleads.com" className="text-white/25 hover:text-white/60 transition-colors">
              <Mail className="w-4 h-4" />
            </a>
            <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer"
              className="text-white/25 hover:text-white/60 transition-colors">
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Arthaleads — Real Estate CRM | Manage Every Property Lead";
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) { desc = document.createElement("meta"); desc.name = "description"; document.head.appendChild(desc); }
    desc.content = "Arthaleads is India's #1 real estate CRM. Capture Facebook, Google, WhatsApp & website leads automatically. Built for developers, brokers & channel partners.";
  }, []);

  return (
    <PublicThemeProvider>
      <div className="min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
        <PublicNav onScrollTo={scrollTo} />
        <Hero />
        <SourcesStrip />
        <Features />
        <HowItWorks />
        <About />
        <Testimonials />
        <Pricing />
        <Contact />
        <FinalCTA />
        <Footer />
      </div>
    </PublicThemeProvider>
  );
}
