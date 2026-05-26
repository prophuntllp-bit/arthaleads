// pages/Landing.jsx - Arthaleads public marketing homepage
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight, ChevronLeft, Check, ArrowRight,
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

// ── Inline brand logos (no external CDN) ─────────────────────────────────────
const FbLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
    <path d="M22.676 0H1.324C.593 0 0 .593 0 1.324v21.352C0 23.408.593 24 1.324 24h11.494v-9.294H9.689v-3.621h3.129V8.41c0-3.099 1.894-4.785 4.659-4.785 1.325 0 2.464.097 2.796.141v3.24h-1.921c-1.5 0-1.792.721-1.792 1.771v2.311h3.584l-.465 3.63H16.56V24h6.115c.733 0 1.325-.592 1.325-1.324V1.324C24 .593 23.408 0 22.676 0" />
  </svg>
);
const WaLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
const GoogleLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);
const AcresLogo = ({ size = 16 }) => (
  <span style={{ width: size, height: size, background: "linear-gradient(135deg,#f97316,#ea580c)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 900, color: "#fff", lineHeight: 1, flexShrink: 0 }}>99</span>
);
const HousingLogo = ({ size = 16 }) => (
  <span style={{ width: size, height: size, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.52, fontWeight: 900, color: "#fff", lineHeight: 1, flexShrink: 0 }}>H</span>
);
const MagicBricksLogo = ({ size = 16 }) => (
  <span style={{ width: size, height: size, background: "linear-gradient(135deg,#dc2626,#b91c1c)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 900, color: "#fff", lineHeight: 1, flexShrink: 0 }}>MB</span>
);

// ── Hero ──────────────────────────────────────────────────────────────────────

const TICKER_LEADS = [
  { name: "Raj Patil",      src: "Facebook", srcClr: "#1877F2", action: "New Lead",          city: "Pune" },
  { name: "Priya Sharma",   src: "WhatsApp", srcClr: "#25D366", action: "Site Visit Booked", city: "Mumbai" },
  { name: "Amit Deshmukh",  src: "Google",   srcClr: "#EA4335", action: "Contacted",          city: "Nagpur" },
  { name: "Sneha Kulkarni", src: "Facebook", srcClr: "#1877F2", action: "Proposal Sent",      city: "Pune" },
  { name: "Vikram Patil",   src: "99acres",  srcClr: "#e63946", action: "New Lead",           city: "Nashik" },
  { name: "Neha Joshi",     src: "WhatsApp", srcClr: "#25D366", action: "Booked ✓",           city: "Pune" },
  { name: "Rahul Mehta",    src: "Google",   srcClr: "#EA4335", action: "Follow-up Due",      city: "Thane" },
  { name: "Kavya Nair",     src: "Facebook", srcClr: "#1877F2", action: "Site Visit Done",    city: "Pune" },
];

function Hero({ isDark }) {
  const mockupRef  = useRef(null);
  const mousePos   = useRef({ x: 0, y: 0 });
  const currentRot = useRef({ x: 0, y: 0 });
  const rafRef     = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      mousePos.current = {
        x: (e.clientX / window.innerWidth  - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };
    const tick = () => {
      currentRot.current.x += (mousePos.current.y * -6 - currentRot.current.x) * 0.05;
      currentRot.current.y += (mousePos.current.x *  9 - currentRot.current.y) * 0.05;
      if (mockupRef.current) {
        mockupRef.current.style.transform =
          `perspective(1400px) rotateX(${currentRot.current.x}deg) rotateY(${currentRot.current.y}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const heroBg     = isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 60%)";
  const headingClr = isDark ? "#ffffff" : "#111827";
  const bodyClr    = isDark ? "rgba(255,255,255,0.6)" : "#6b7280";
  const softClr    = isDark ? "rgba(255,255,255,0.4)" : "#9ca3af";
  const btnBorder  = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const btnText    = isDark ? "rgba(255,255,255,0.70)" : "#374151";
  const gridOpacity = isDark ? "0.03" : "0.04";
  const chipBg     = isDark ? "rgba(255,255,255,0.06)" : "#ffffff";
  const chipBdr    = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const chipText   = isDark ? "rgba(255,255,255,0.85)" : "#111827";
  const tickerBg   = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const tickerBdr  = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";

  return (
    <section id="hero" className="relative overflow-hidden" style={{ background: heroBg }}>
      {/* Background glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff6b00]/10 rounded-full blur-3xl" style={{ animation: "blobDrift1 8s ease-in-out infinite" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-900/10 rounded-full blur-3xl" style={{ animation: "blobDrift2 10s ease-in-out infinite" }} />
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff6b00]/5 rounded-full blur-3xl" style={{ animation: "blobDrift1 12s ease-in-out infinite reverse" }} />
        <div className="absolute inset-0"
          style={{ opacity: gridOpacity, backgroundImage: "linear-gradient(rgba(255,107,0,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,0,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-6 lg:pt-36 lg:pb-8">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.1] mb-6" style={{ color: headingClr }}>
            Manage Every Lead.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Close More Deals.
            </span>
          </h1>
          <p className="text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: bodyClr }}>
            Arthaleads brings every property enquiry - Facebook ads, Google campaigns, WhatsApp chats,
            and walk-ins - into one powerful workspace. Built for real estate developers and channel partners.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/signup"
              className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 text-base">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={() => scrollTo("features")}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl transition-all duration-200 text-base font-medium border"
              style={{ color: btnText, borderColor: btnBorder }}>
              <PlayCircle className="w-5 h-5" /> See How It Works
            </button>
          </div>
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

        {/* ── Mockup area ── */}
        <div className="mt-12 relative" style={{ maxWidth: 900, margin: "3rem auto 0" }}>

          {/* Deep glow behind mockup */}
          <div className="absolute pointer-events-none"
            style={{ inset: "-20px 60px", background: "radial-gradient(ellipse at 50% 55%, rgba(255,107,0,0.22) 0%, transparent 68%)", filter: "blur(48px)" }} />

          {/* ── Floating stat badges ── */}
          <div className="absolute -left-4 sm:left-0 top-12 z-20 hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-2xl shadow-2xl"
            style={{ background: chipBg, border: `1px solid ${chipBdr}`, backdropFilter: "blur(14px)", animation: "floatA 4s ease-in-out infinite" }}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <div>
              <div className="text-xs font-bold" style={{ color: chipText }}>+14 New Leads</div>
              <div className="text-[10px]" style={{ color: softClr }}>Today · Live</div>
            </div>
          </div>

          <div className="absolute -right-4 sm:right-0 top-16 z-20 hidden sm:flex items-center gap-2.5 px-3 py-2.5 rounded-2xl shadow-2xl"
            style={{ background: chipBg, border: `1px solid ${chipBdr}`, backdropFilter: "blur(14px)", animation: "floatB 5s ease-in-out infinite" }}>
            <span className="text-xl leading-none">📞</span>
            <div>
              <div className="text-xs font-bold" style={{ color: chipText }}>Follow-up</div>
              <div className="text-[10px]" style={{ color: softClr }}>Scheduled · 2:30 PM</div>
            </div>
          </div>

          <div className="absolute sm:right-4 bottom-20 z-20 hidden sm:flex items-center gap-2.5 px-3 py-2.5 rounded-2xl shadow-2xl"
            style={{ background: chipBg, border: `1px solid ${chipBdr}`, backdropFilter: "blur(14px)", animation: "floatC 4.5s ease-in-out infinite" }}>
            <span className="text-xl leading-none">🏠</span>
            <div>
              <div className="text-xs font-bold" style={{ color: chipText }}>Site Visit Booked!</div>
              <div className="text-[10px]" style={{ color: softClr }}>Raj Patil · Pune</div>
            </div>
          </div>

          <div className="absolute left-4 bottom-24 z-30 hidden lg:flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-2xl"
            style={{ background: isDark ? "rgba(20,30,20,0.92)" : "#ffffff", border: "1.5px solid #22c55e", backdropFilter: "blur(12px)", animation: "floatA 6s ease-in-out infinite 1s" }}>
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
            <span className="text-xs font-bold" style={{ color: isDark ? "#86efac" : "#15803d" }}>Deal Closed ✓</span>
          </div>

          {/* ── Mockup image with mouse parallax ── */}
          <div ref={mockupRef} style={{ willChange: "transform", transformStyle: "preserve-3d", position: "relative", zIndex: 1 }}>
            <link rel="preload" as="image" href="/dashboard-light.png" />
            <img
              src="/dashboard-light.png"
              alt="Arthaleads CRM Dashboard"
              className="w-full"
              style={{ display: "block", filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.22))" }}
            />
          </div>

        </div>

        {/* ── Live lead ticker ── */}
        <div className="mt-8 relative overflow-hidden"
          style={{ maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)" }}>
          <div style={{ display: "flex", gap: 10, animation: "tickerScroll 30s linear infinite", width: "max-content" }}>
            {[...TICKER_LEADS, ...TICKER_LEADS].map(({ name, src, srcClr, action, city }, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px", borderRadius: 999, flexShrink: 0,
                background: tickerBg, border: `1px solid ${tickerBdr}`,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: srcClr, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: chipText }}>{name}</span>
                <span style={{ fontSize: 11, color: softClr }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: srcClr }}>{src}</span>
                <span style={{ fontSize: 11, color: softClr }}>·</span>
                <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.55)" : "#6b7280" }}>{action}</span>
                <span style={{ fontSize: 10, color: softClr, marginLeft: 2 }}>{city}</span>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes tickerScroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          @keyframes blobDrift1 {
            0%,100% { transform: translate(0,0) scale(1); }
            50%     { transform: translate(30px,-20px) scale(1.1); }
          }
          @keyframes blobDrift2 {
            0%,100% { transform: translate(0,0) scale(1); }
            50%     { transform: translate(-25px,15px) scale(0.95); }
          }
          @keyframes floatA {
            0%,100% { transform: translateY(0px); }
            50%     { transform: translateY(-10px); }
          }
          @keyframes floatB {
            0%,100% { transform: translateY(0px); }
            50%     { transform: translateY(-14px); }
          }
          @keyframes floatC {
            0%,100% { transform: translateY(0px); }
            50%     { transform: translateY(-8px); }
          }
        `}</style>
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
    { name: "Facebook Ads",  Logo: FbLogo },
    { name: "WhatsApp",      Logo: WaLogo },
    { name: "Google Ads",    Logo: GoogleLogo },
    { name: "Walk-ins",      Logo: ({ size }) => <Building2 style={{ width: size, height: size, color: "#ff6b00" }} /> },
    { name: "99acres",       Logo: AcresLogo },
    { name: "Housing.com",   Logo: HousingLogo },
    { name: "MagicBricks",   Logo: MagicBricksLogo },
    { name: "Email & Forms", Logo: ({ size }) => <Mail style={{ width: size, height: size, color: "#6366f1" }} /> },
  ];

  return (
    <section className="py-10" style={{ background: bg, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: label }}>
          Capture leads from every source
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {sources.map(({ name, Logo }) => (
            <div key={name} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-colors"
              style={{ background: chipBg, border: `1px solid ${chipBdr}` }}>
              <Logo size={16} />
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
  const cardBg   = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr  = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const cardText = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";

  const Card = ({ icon: Icon, color, title, desc, idx }) => (
    <div className="group relative flex-shrink-0 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
      {/* Colored top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-300"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }} />
      {/* Ghost number watermark */}
      <div className="absolute right-3 top-1 text-6xl font-black select-none pointer-events-none leading-none"
        style={{ color: `${color}12` }}>
        {String(idx + 1).padStart(2, "0")}
      </div>
      <div className="p-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
          style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="font-bold text-base mb-1.5" style={{ color: heading }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: cardText }}>{desc}</p>
      </div>
    </div>
  );

  return (
    <section id="features" className="py-10 lg:py-14" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Zap className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3" style={{ color: heading }}>
            Everything your team needs to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              close more deals
            </span>
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: body }}>
            Built for the Indian real estate market - from small channel partner offices to large developer sales teams.
          </p>
        </div>

        {/* Mobile: horizontal swipe carousel */}
        <div className="lg:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="snap-start flex-shrink-0" style={{ width: "72vw", maxWidth: 300 }}>
                <Card {...f} idx={i} />
              </div>
            ))}
            {/* Trailing spacer so last card isn't flush to edge */}
            <div className="flex-shrink-0 w-4" />
          </div>
          {/* Swipe hint */}
          <p className="text-center text-xs mt-2" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#d1d5db" }}>
            swipe to see more
          </p>
        </div>

        {/* Desktop: 3-column grid */}
        <div className="hidden lg:grid grid-cols-3 gap-5">
          {FEATURES.map((f, i) => <Card key={f.title} {...f} idx={i} />)}
        </div>
      </div>
    </section>
  );
}

// ── How it works - interactive step-through UI ───────────────────────────────
const HOW_STEPS = [
  {
    num: 1,
    icon: FileSpreadsheet,
    label: "Import",
    color: "#ff6b00",
    title: "Import or Capture Leads",
    desc: "Connect your Facebook Ad account for auto-import, paste a CSV, or add leads manually. Our system normalises phone numbers and removes duplicates instantly.",
    highlight: "Zero duplicate calls guaranteed",
  },
  {
    num: 2,
    icon: UserCheck,
    label: "Assign",
    color: "#3b82f6",
    title: "Assign to Your Team",
    desc: "Distribute leads to your telecallers and agents based on projects or geography. Agents receive instant push notifications for new assignments.",
    highlight: "Round-robin auto-assignment built in",
  },
  {
    num: 3,
    icon: PhoneCall,
    label: "Call & Follow Up",
    color: "#22c55e",
    title: "Call, Remark & Follow Up",
    desc: "Agents log call outcomes, schedule follow-ups, and set booking status. Managers see live progress dashboards at every stage.",
    highlight: "Never miss a follow-up again",
  },
  {
    num: 4,
    icon: TrendingUp,
    label: "Track & Convert",
    color: "#a855f7",
    title: "Track & Convert",
    desc: "Move hot leads from Site Visit Booked to Booked. Analytics show your conversion rate, top sources, and team performance over any time period.",
    highlight: "3× conversion improvement reported",
  },
];

function HowItWorks({ isDark }) {
  const [active, setActive] = useState(0);
  const intervalRef = useRef(null);

  const startTimer = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setActive((a) => (a + 1) % HOW_STEPS.length), 4500);
  };
  useEffect(() => { startTimer(); return () => clearInterval(intervalRef.current); }, []);
  const goTo = (i) => { setActive(i); startTimer(); };
  const step = HOW_STEPS[active];

  const bg       = isDark ? "#080810" : "#f9fafb";
  const heading  = isDark ? "#ffffff"  : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const cardBg   = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const listBg   = isDark ? "rgba(255,255,255,0.02)" : "#f3f4f6";
  const mutedTxt = isDark ? "rgba(255,255,255,0.30)" : "#9ca3af";
  const navDisab = isDark ? "rgba(255,255,255,0.15)" : "#d1d5db";

  return (
    <section id="how-it-works" className="py-10 lg:py-14 overflow-hidden" style={{ background: bg }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Activity className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3" style={{ color: heading }}>
            Up and running in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">minutes</span>
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: body }}>
            No complex onboarding. Your team can start managing leads the same day.
          </p>
        </div>

        {/* Mobile: horizontal step tabs */}
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4 snap-x" style={{ scrollbarWidth: "none" }}>
          {HOW_STEPS.map((s, i) => (
            <button key={i} onClick={() => goTo(i)} className="snap-start flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer"
              style={{ background: i === active ? `${s.color}15` : listBg, border: `1px solid ${i === active ? s.color + "40" : "transparent"}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: i === active ? s.color : (isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb") }}>
                <s.icon className="w-3.5 h-3.5" style={{ color: i === active ? "#fff" : mutedTxt }} />
              </div>
              <span className="text-xs font-bold whitespace-nowrap" style={{ color: i === active ? s.color : mutedTxt }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">

          {/* Left: Step list (desktop only) */}
          <div className="hidden lg:flex flex-col gap-2">
            {HOW_STEPS.map((s, i) => (
              <button key={i} onClick={() => goTo(i)} className="text-left w-full rounded-2xl transition-all duration-250 cursor-pointer group"
                style={{ padding: "14px 16px", background: i === active ? `${s.color}10` : "transparent", border: `1px solid ${i === active ? s.color + "35" : "transparent"}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                    style={{ background: i === active ? s.color : (isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6"), boxShadow: i === active ? `0 4px 12px ${s.color}45` : "none" }}>
                    <s.icon className="w-4 h-4" style={{ color: i === active ? "#fff" : mutedTxt }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight" style={{ color: i === active ? heading : mutedTxt }}>{s.label}</div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: i === active ? body : "transparent" }}>{s.title}</div>
                  </div>
                  {i === active && (
                    <div className="ml-auto w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  )}
                </div>
                {/* Timer bar for active step */}
                {i === active && (
                  <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: `${s.color}20` }}>
                    <div className="h-full rounded-full" style={{ background: s.color, animation: "stepTimer 4.5s linear infinite", transformOrigin: "left" }} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Right: Detail panel */}
          <div key={active} className="rounded-3xl overflow-hidden relative"
            style={{ background: cardBg, border: `1px solid ${cardBdr}`, boxShadow: isDark ? `0 0 60px ${step.color}06` : "0 8px 48px rgba(0,0,0,0.08)", animation: "howFade 0.3s ease" }}>

            {/* Color top strip */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${step.color}, ${step.color}50, transparent)` }} />

            <div className="p-6 lg:p-8">
              {/* Step label */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-black px-3 py-1 rounded-full tracking-widest"
                  style={{ background: `${step.color}15`, color: step.color }}>
                  STEP {String(step.num).padStart(2, "0")} / {String(HOW_STEPS.length).padStart(2, "0")}
                </span>
                <div className="flex-1 h-px" style={{ background: `${step.color}20` }} />
                {/* Ghost large number */}
                <span className="text-4xl font-black leading-none select-none" style={{ color: `${step.color}18` }}>
                  {String(step.num).padStart(2, "0")}
                </span>
              </div>

              {/* Icon + Title + Desc */}
              <div className="flex gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${step.color}12`, border: `1px solid ${step.color}25` }}>
                  <step.icon className="w-7 h-7" style={{ color: step.color }} />
                </div>
                <div>
                  <h3 className="text-xl lg:text-2xl font-black mb-2" style={{ color: heading }}>{step.title}</h3>
                  <p className="text-sm lg:text-base leading-relaxed" style={{ color: body }}>{step.desc}</p>
                </div>
              </div>

              {/* Highlight */}
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                style={{ background: `${step.color}08`, border: `1px solid ${step.color}20` }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${step.color}20` }}>
                  <Check className="w-3 h-3" style={{ color: step.color }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: step.color }}>{step.highlight}</span>
              </div>

              {/* Nav */}
              <div className="flex items-center justify-between mt-6 pt-5" style={{ borderTop: `1px solid ${cardBdr}` }}>
                <button onClick={() => goTo((active - 1 + HOW_STEPS.length) % HOW_STEPS.length)}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer"
                  style={{ color: active === 0 ? navDisab : body }}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <div className="flex gap-1.5 items-center">
                  {HOW_STEPS.map((s, i) => (
                    <button key={i} onClick={() => goTo(i)} className="rounded-full transition-all duration-300 cursor-pointer"
                      style={{ width: i === active ? 20 : 6, height: 6, background: i === active ? step.color : (isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb") }} />
                  ))}
                </div>
                <button onClick={() => goTo((active + 1) % HOW_STEPS.length)}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer"
                  style={{ color: body }}>
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes howFade {
            from { opacity: 0; transform: translateX(8px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes stepTimer {
            from { transform: scaleX(0); }
            to   { transform: scaleX(1); }
          }
        `}</style>
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
    <section id="about" className="py-10 lg:py-14" style={{ background: bg }}>
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
  const [active, setActive] = React.useState(0);
  const [hovered, setHovered] = React.useState(null);
  const [isPaused, setIsPaused] = React.useState(false);
  const timerRef = React.useRef(null);

  const reviews = [
    {
      name: "Rajesh Patil",
      role: "Sales Head, Kolte Patil Channel Partner",
      city: "Pune",
      quote: "Before Arthaleads our team was managing 500+ Facebook leads in WhatsApp groups. Now everything is centralised and our follow-up rate has tripled.",
      stars: 5,
      metric: "3x follow-up rate",
      avatar: "RP",
      avatarClr: "#ff6b00",
    },
    {
      name: "Priya Sharma",
      role: "Founder, Milestone Properties",
      city: "Mumbai",
      quote: "The project import feature is a game-changer. We imported 2,000 leads in minutes and the duplicate detection saved us from calling the same people twice.",
      stars: 5,
      metric: "2,000 leads in minutes",
      avatar: "PS",
      avatarClr: "#8b5cf6",
    },
    {
      name: "Amit Deshmukh",
      role: "Manager, Magarpatta Real Estate",
      city: "Pune",
      quote: "Our conversion rate jumped from 2% to 6% in 3 months. The analytics dashboard gives us clarity we never had before with Excel sheets.",
      stars: 5,
      metric: "3x conversion rate",
      avatar: "AD",
      avatarClr: "#0ea5e9",
    },
    {
      name: "Sneha Kulkarni",
      role: "Director, Kulkarni Associates",
      city: "Nashik",
      quote: "We were losing track of leads coming from 99acres, Housing, and Facebook. Arthaleads brings everything into one place. Our team saved around 2 hours daily on manual follow-ups.",
      stars: 4,
      metric: "2 hrs saved per day",
      avatar: "SK",
      avatarClr: "#10b981",
    },
    {
      name: "Vikram Joshi",
      role: "Co-founder, Urban Nest Realty",
      city: "Nagpur",
      quote: "Honestly wasn't sure about switching from our Excel setup. But after a week the team didn't want to go back. The mobile app makes site visit tracking effortless.",
      stars: 5,
      metric: "Zero Excel sheets",
      avatar: "VJ",
      avatarClr: "#f59e0b",
    },
    {
      name: "Meena Agarwal",
      role: "Channel Partner, Pride Purple Properties",
      city: "Thane",
      quote: "The WhatsApp integration alone was worth it. Leads from our broadcasts now land directly into the CRM with source tagging. No more copy-pasting names into sheets.",
      stars: 4,
      metric: "100% source tracking",
      avatar: "MA",
      avatarClr: "#ec4899",
    },
  ];

  const startTimer = React.useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!isPaused) setActive(a => (a + 1) % reviews.length);
    }, 4500);
  }, [isPaused, reviews.length]);

  React.useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  const goTo = (i) => { setActive(i); startTimer(); };
  const prev = () => goTo((active - 1 + reviews.length) % reviews.length);
  const next = () => goTo((active + 1) % reviews.length);

  const bg       = isDark ? "#080810" : "#f9fafb";
  const heading  = isDark ? "#ffffff" : "#111827";
  const sub      = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const cardBg   = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const cardBdrH = isDark ? "rgba(255,107,0,0.35)"   : "#ff6b00";
  const quoteClr = isDark ? "rgba(255,255,255,0.7)"  : "#374151";
  const nameClr  = isDark ? "#ffffff" : "#111827";
  const roleClr  = isDark ? "rgba(255,255,255,0.38)" : "#9ca3af";
  const metricBg = isDark ? "rgba(255,107,0,0.12)"   : "#fff7ed";
  const dotBg    = isDark ? "rgba(255,255,255,0.12)"  : "#e5e7eb";

  // visible window: active-1, active, active+1 on desktop; active only on mobile
  const visible = [-1, 0, 1].map(o => (active + o + reviews.length) % reviews.length);

  return (
    <section className="py-10 lg:py-14 overflow-hidden" style={{ background: bg }}>
      <style>{`
        @keyframes tFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .t-card { transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .t-card:hover { transform: translateY(-4px); }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-4">
            <Star className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Customer Stories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: heading }}>
            Trusted by real estate teams{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">across India</span>
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: sub }}>
            From solo brokers in Nashik to 30-member developer teams in Mumbai - here's what they say.
          </p>

          {/* Aggregate rating bar */}
          <div className="inline-flex items-center gap-3 mt-5 px-5 py-2.5 rounded-full"
            style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#fff", border: `1px solid ${cardBdr}` }}>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= 4 ? "#ff6b00" : "none"} stroke="#ff6b00" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
            </div>
            <span className="font-bold text-sm" style={{ color: heading }}>4.8</span>
            <span className="text-xs" style={{ color: sub }}>avg rating from 90+ users</span>
          </div>
        </div>

        {/* Desktop: 3-card window */}
        <div className="hidden md:grid grid-cols-3 gap-5 mb-8"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => { setIsPaused(false); startTimer(); }}>
          {visible.map((ri, col) => {
            const r = reviews[ri];
            const isCenter = col === 1;
            return (
              <div key={ri} className="t-card p-6 rounded-2xl flex flex-col gap-4 cursor-pointer"
                style={{
                  background: isCenter
                    ? isDark ? "linear-gradient(145deg,rgba(255,107,0,0.08),rgba(255,107,0,0.03))" : "#fff"
                    : cardBg,
                  border: `1px solid ${isCenter ? cardBdrH : cardBdr}`,
                  boxShadow: isCenter
                    ? isDark ? "0 8px 32px rgba(255,107,0,0.12)" : "0 8px 32px rgba(0,0,0,0.08)"
                    : "none",
                  opacity: isCenter ? 1 : 0.6,
                  animation: isCenter ? "tFade 0.4s ease" : "none",
                  scale: isCenter ? "1" : "0.97",
                }}
                onClick={() => goTo(ri)}
                onMouseEnter={() => setHovered(ri)}
                onMouseLeave={() => setHovered(null)}>

                {/* Stars */}
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24"
                      fill={i <= r.stars ? "#ff6b00" : "none"}
                      stroke={i <= r.stars ? "#ff6b00" : isDark ? "rgba(255,255,255,0.2)" : "#d1d5db"}
                      strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                  <span className="ml-1 text-xs font-semibold" style={{ color: "#ff6b00" }}>{r.stars}.0</span>
                </div>

                {/* Quote */}
                <p className="text-sm leading-relaxed flex-1" style={{ color: quoteClr }}>
                  <span className="text-2xl leading-none mr-1" style={{ color: "#ff6b00", opacity: 0.5 }}>"</span>
                  {r.quote}
                  <span className="text-2xl leading-none ml-1" style={{ color: "#ff6b00", opacity: 0.5 }}>"</span>
                </p>

                {/* Metric pill */}
                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: metricBg, color: "#ff6b00" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  {r.metric}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 pt-2" style={{ borderTop: `1px solid ${cardBdr}` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: r.avatarClr }}>
                    {r.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: nameClr }}>{r.name}</div>
                    <div className="text-xs" style={{ color: roleClr }}>{r.role} - {r.city}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: single card */}
        <div className="md:hidden mb-6">
          {(() => {
            const r = reviews[active];
            return (
              <div className="p-6 rounded-2xl flex flex-col gap-4"
                key={active}
                style={{
                  background: cardBg, border: `1px solid ${cardBdrH}`,
                  boxShadow: isDark ? "0 8px 32px rgba(255,107,0,0.1)" : "0 8px 32px rgba(0,0,0,0.07)",
                  animation: "tFade 0.35s ease",
                }}>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24"
                      fill={i <= r.stars ? "#ff6b00" : "none"}
                      stroke={i <= r.stars ? "#ff6b00" : isDark ? "rgba(255,255,255,0.2)" : "#d1d5db"}
                      strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                  <span className="ml-1 text-xs font-semibold" style={{ color: "#ff6b00" }}>{r.stars}.0</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: quoteClr }}>"{r.quote}"</p>
                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: metricBg, color: "#ff6b00" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  {r.metric}
                </div>
                <div className="flex items-center gap-3 pt-2" style={{ borderTop: `1px solid ${cardBdr}` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: r.avatarClr }}>
                    {r.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: nameClr }}>{r.name}</div>
                    <div className="text-xs" style={{ color: roleClr }}>{r.role} - {r.city}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prev} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all"
            style={{ background: cardBg, border: `1px solid ${cardBdr}`, color: sub }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6b00"; e.currentTarget.style.color = "#ff6b00"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = cardBdr; e.currentTarget.style.color = sub; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div className="flex items-center gap-2">
            {reviews.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} className="cursor-pointer transition-all rounded-full"
                style={{
                  width: i === active ? "24px" : "8px",
                  height: "8px",
                  background: i === active ? "#ff6b00" : dotBg,
                }}>
              </button>
            ))}
          </div>

          <button onClick={next} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all"
            style={{ background: cardBg, border: `1px solid ${cardBdr}`, color: sub }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6b00"; e.currentTarget.style.color = "#ff6b00"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = cardBdr; e.currentTarget.style.color = sub; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Avatar stack footer */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <div className="flex -space-x-2">
            {reviews.map((r, i) => (
              <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2"
                style={{ background: r.avatarClr, ringColor: bg, zIndex: reviews.length - i }}>
                {r.avatar}
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: sub }}>Join <strong style={{ color: heading }}>90+ teams</strong> already using Arthaleads</p>
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
    <section id="pricing" className="py-10 lg:py-14" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
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
    { icon: Phone,   label: "Call Us",   val: "+91 80801 97945",           href: "tel:+918080197945" },
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
    <section id="contact" className="py-10 lg:py-14" style={{ background: bg }}>
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
            <a href="https://wa.me/918080197945?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Arthaleads"
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
    <section className="py-12 relative overflow-hidden" style={{ background: bg }}>
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
