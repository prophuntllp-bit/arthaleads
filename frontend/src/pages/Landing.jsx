// pages/Landing.jsx - Arthaleads public marketing homepage
import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS, waLink, WA_MESSAGES } from "../utils/crmLinks";
import { FEATURES, HOME_FEATURES } from "../data/features";
import {
  ChevronRight, ChevronLeft, Check, ArrowRight, BarChart3, Users, Zap, Building2, PhoneCall, Bell, TrendingUp, Shield, Facebook, Mail, Phone, MapPin, ChevronDown, PlayCircle, Layers, Filter, FileSpreadsheet, UserCheck, QrCode, Sparkles, FileText, Camera, Bot, Headphones, Handshake,
} from "lucide-react";
import WhatsAppLogo, { waButtonClass } from "../components/WhatsAppLogo";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { getRecaptchaToken } from "../utils/recaptcha";
import IntroVideo from "../components/IntroVideo";
import api from "../services/api";
import BlogCard from "../components/BlogCard";
import { HeroTour } from "../components/ProductTour";
import HeroLeadFlow from "../components/HeroLeadFlow";
import FeatureBento from "../components/FeatureBento";
import { PLAN_PRICING, formatINR } from "../utils/plan";
import { Reveal, Spotlight, Magnetic } from "../components/motion/Motion";

// Small text in the brand orange uses the darker accessible shade (see --brand-text in styles.css).
const smallText = (c) => (c === "#ff6b00" ? "var(--brand-text)" : c);

// ── Smooth scroll helper ──────────────────────────────────────────────────────
const REDUCED_MOTION = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
  const heroBg     = isDark ? "#0d0d1a" : "linear-gradient(180deg, #fff7f0 0%, #fffaf6 45%, #ffffff 100%)";
  const headingClr = isDark ? "#ffffff" : "#111827";
  const bodyClr    = isDark ? "rgba(255,255,255,0.6)" : "#6b7280";
  const softClr    = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  const btnBorder  = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const btnText    = isDark ? "rgba(255,255,255,0.70)" : "#374151";
  const btnBg      = isDark ? "transparent" : "rgba(255,255,255,0.7)";
  const gridOpacity = isDark ? "0.03" : "0.035";
  const chipText   = isDark ? "rgba(255,255,255,0.85)" : "#111827";
  const tickerBg   = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const tickerBdr  = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";

  return (
    <section id="hero" className="relative overflow-hidden" style={{ background: heroBg }}>
      {/* Background: one soft glow behind the product and a faint grid that fades out */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 -translate-x-1/2 top-[38%] w-[900px] max-w-[120vw] h-[520px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse at center, rgba(255,107,0,0.16) 0%, transparent 70%)" }} />
        {/* Two slow aurora blobs drifting behind the headline */}
        <div className="absolute -top-24 left-[8%] w-[520px] max-w-[80vw] h-[420px] rounded-full blur-3xl opacity-70"
          style={{ background: "radial-gradient(circle, rgba(255,170,0,0.18), transparent 65%)", animation: "aurora-drift 18s ease-in-out infinite" }} />
        <div className="absolute -top-10 right-[6%] w-[460px] max-w-[70vw] h-[380px] rounded-full blur-3xl opacity-60"
          style={{ background: "radial-gradient(circle, rgba(255,107,0,0.14), transparent 65%)", animation: "aurora-drift 22s ease-in-out infinite reverse" }} />
        <div className="absolute inset-0"
          style={{ opacity: gridOpacity, backgroundImage: "linear-gradient(rgba(255,107,0,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,0,1) 1px,transparent 1px)", backgroundSize: "60px 60px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 55%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 55%)" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12 lg:pt-40 lg:pb-16">
        {/* ── Copy, centred above the product ── */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] xl:text-[4rem] font-black leading-[1.05] tracking-[-0.02em] mb-6"
            style={{ color: headingClr, textWrap: "balance" }}>
            {/* The keyword line is part of the h1 (it is what the page ranks for); the slogan follows as plain words, no sr-only copy, so the heading text is not doubled. */}
            <span className="block text-sm sm:text-base font-semibold uppercase tracking-[0.18em] mb-5 text-[color:var(--brand-text)]">AI-powered real estate CRM for India</span>{" "}
            <span>
              {["Manage", "Every", "Lead."].map((w, i) => (
                <span key={w} className="word-rise" style={{ animationDelay: `${80 + i * 90}ms` }}>{w}&nbsp;</span>
              ))}
              <span className="block">
                {["Close", "More", "Deals."].map((w, i) => (
                  <span key={w} className="word-rise text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00] pb-1"
                    style={{ animationDelay: `${380 + i * 90}ms` }}>{w}{i < 2 ? " " : ""}</span>
                ))}
              </span>
            </span>
          </h1>
          <p className="text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-9" style={{ color: bodyClr, textWrap: "pretty" }}>
            Arthaleads is real estate CRM software for builders, developers and channel partners in India.
            It brings every property enquiry - Facebook ads, Google campaigns, WhatsApp chats and walk-ins -
            into one workspace, and replies on WhatsApp while your team sleeps.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Magnetic>
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                className="shine-btn flex items-center gap-2 bg-[color:var(--brand-btn)] hover:bg-[color:var(--brand-btn-hover)] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 text-base">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </a>
            </Magnetic>
            <button onClick={() => scrollTo("tour")}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl transition-all duration-200 text-base font-medium border hover:-translate-y-0.5"
              style={{ color: btnText, borderColor: btnBorder, background: btnBg }}>
              <PlayCircle className="w-5 h-5" /> Watch the 2-min film
            </button>
          </div>
          <p className="text-sm mb-12 lg:mb-14" style={{ color: softClr }}>
            14-day free trial, no card needed ·{" "}
            <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
              className="font-semibold underline-offset-4 hover:underline" style={{ color: isDark ? "#4ade80" : "#15803d" }}>
              or book a demo on WhatsApp
            </a>
          </p>
        </div>

        {/* ── The real product ── */}
        <div className="relative max-w-6xl mx-auto">
          <HeroTour isDark={isDark} />
          <HeroLeadFlow isDark={isDark} />
        </div>

        <div className="flex items-center justify-center gap-8 sm:gap-12 mt-12 lg:mt-14">
            {[
              // Product facts only: no customer counts or outcome claims until they are real.
              { num: "14-day",  label: "Free trial" },
              { num: "24/7",    label: "WhatsApp AI replies" },
              { num: `₹${PLAN_PRICING.starter.monthly}`, label: "Per user / month" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                {/* Plain text: these are facts, not counts, and "24/7" counting up read as "4/7" mid-way. */}
                <span className="block text-2xl sm:text-3xl font-black text-[#ff6b00] tabular-nums whitespace-nowrap">{s.num}</span>
                <div className="text-xs sm:text-sm mt-0.5" style={{ color: softClr }}>{s.label}</div>
              </div>
            ))}
          </div>

        {/* ── Live lead ticker ── */}
        <div className="mt-12 lg:mt-16 relative overflow-hidden"
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
                <span style={{ fontSize: 11, fontWeight: 700, color: chipText }}>{src}</span>
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
          @media (prefers-reduced-motion: reduce) {
            #hero * { animation: none !important; }
          }
        `}</style>
      </div>
    </section>
  );
}

// ── Sources strip ─────────────────────────────────────────────────────────────
function SourcesStrip({ isDark }) {
  const [hoveredSource, setHoveredSource] = useState(null);
  const bg       = isDark ? "#0d0d1a" : "#f9fafb";
  const border   = isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb";
  const label    = isDark ? "rgba(255,255,255,0.30)" : "#6b7280";
  const chipBg   = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const chipBdr  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const chipText = isDark ? "rgba(255,255,255,0.60)" : "#6b7280";

  const sources = [
    { name: "Facebook Ads",  color: "#1877F2", type: "Auto",   Logo: FbLogo },
    { name: "WhatsApp",      color: "#25D366", type: "Auto",   Logo: WaLogo },
    { name: "Google Ads",    color: "#4285F4", type: "Auto",   Logo: GoogleLogo },
    { name: "Walk-ins",      color: "#ff6b00", type: "Manual", Logo: ({ size }) => <Building2 style={{ width: size, height: size, color: "#ff6b00" }} /> },
    { name: "99acres",       color: "#f97316", type: "Manual",   Logo: AcresLogo },
    { name: "Housing.com",   color: "#2563eb", type: "Manual",   Logo: HousingLogo },
    { name: "MagicBricks",   color: "#dc2626", type: "Manual",   Logo: MagicBricksLogo },
    { name: "Email & Forms", color: "#6366f1", type: "Manual", Logo: ({ size }) => <Mail style={{ width: size, height: size, color: "#6366f1" }} /> },
  ];

  return (
    <section className="py-10" style={{ background: bg, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: label }}>
          Capture leads from every source
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {sources.map(({ name, color, type, Logo }, idx) => {
            const isHovered = hoveredSource === name;
            return (
              <Reveal key={name} delay={idx * 55} y={14}>
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-default"
                style={{
                  background: isHovered ? `${color}12` : chipBg,
                  border: `1px solid ${isHovered ? color + "50" : chipBdr}`,
                  boxShadow: isHovered ? `0 4px 16px ${color}25` : "none",
                  transform: isHovered ? "translateY(-2px)" : "none",
                }}
                onMouseEnter={() => setHoveredSource(name)}
                onMouseLeave={() => setHoveredSource(null)}>
                <Logo size={16} />
                <span className="text-sm font-medium transition-colors duration-150"
                  style={{ color: isHovered ? color : chipText }}>{name}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all duration-150"
                  style={{
                    background: isHovered ? `${color}18` : "transparent",
                    color: isHovered ? color : "transparent",
                    minWidth: 0,
                  }}>
                  {type}
                </span>
              </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
/**
 * Home-page feature section.
 *
 * This used to render all 17 features as bordered cards with accent bars and
 * ghost numerals — three columns of chrome that read as a wall of boxes rather
 * than a product story. The full catalogue now lives on /features, and the home
 * page shows six, with the card removed entirely: a tinted icon, a title, a
 * line of copy, and space. Structure comes from the grid, not from borders.
 */
function Features({ isDark }) {
  const bg       = isDark ? "#0d0d1a" : "#ffffff";
  const heading  = isDark ? "#ffffff" : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const rule     = isDark ? "rgba(255,255,255,0.06)" : "#f0f0f2";

  return (
    <section id="features" className="py-16 lg:py-24" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <Reveal className="max-w-3xl mb-10 lg:mb-14">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-text)]">
            Powerful Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-4 mb-4 leading-[1.12]" style={{ color: heading }}>
            Everything your team needs to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              close more deals
            </span>
          </h2>
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: body }}>
            A real estate CRM built for the Indian market - from small channel partner offices to
            large builder and developer sales teams.
          </p>
        </Reveal>

        <FeatureBento features={HOME_FEATURES} isDark={isDark} />

        <div className="mt-16 lg:mt-20 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ borderTop: `1px solid ${rule}` }}>
          <p className="text-[15px]" style={{ color: body }}>
            {FEATURES.length} features in all, including the{" "}
            <Link to="/whatsapp-crm" className="font-semibold underline underline-offset-2" style={{ color: isDark ? "#fb923c" : "#c2410c" }}>WhatsApp CRM</Link>,
            tasks, invoicing and the Meta Conversions API.
          </p>
          <Link to="/features"
            className="inline-flex items-center gap-2 font-semibold text-[15px] text-[color:var(--brand-text)] hover:gap-3 transition-all duration-200 whitespace-nowrap">
            Explore all features <ArrowRight className="w-4 h-4" />
          </Link>
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
    highlight: "Duplicates flagged before anyone calls",
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
    desc: "Agents log call outcomes, schedule follow-ups, and set the lead outcome. Managers see live progress dashboards at every stage.",
    highlight: "Never miss a follow-up again",
  },
  {
    num: 4,
    icon: TrendingUp,
    label: "Track & Convert",
    color: "#a855f7",
    title: "Track & Convert",
    desc: "Move hot leads through Site Visit and Negotiation to Closed Won. Analytics show your conversion rate, top sources, and team performance over any time period.",
    highlight: "Pipeline and analytics in one place",
  },
];


function HowItWorks({ isDark }) {
  const [active, setActive] = useState(0);
  const intervalRef = useRef(null);

  const startTimer = () => {
    clearInterval(intervalRef.current);
    if (REDUCED_MOTION()) return;
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
  const mutedTxt = isDark ? "rgba(255,255,255,0.30)" : "#4b5563";
  const navDisab = isDark ? "rgba(255,255,255,0.15)" : "#6b7280";

  return (
    <section id="how-it-works" className="py-10 lg:py-14 overflow-hidden" style={{ background: bg }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
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
              <span className="text-xs font-bold whitespace-nowrap" style={{ color: i === active ? smallText(s.color) : mutedTxt }}>{s.label}</span>
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
                <span className="text-xs font-black tracking-widest"
                  style={{ color: smallText(step.color) }}>
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
                <span className="text-sm font-semibold" style={{ color: smallText(step.color) }}>{step.highlight}</span>
              </div>

              {/* Nav */}
              <div className="flex items-center justify-between mt-6 pt-5" style={{ borderTop: `1px solid ${cardBdr}` }}>
                <button onClick={() => goTo((active - 1 + HOW_STEPS.length) % HOW_STEPS.length)}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer"
                  style={{ color: active === 0 ? navDisab : body }}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <div className="flex items-center">
                  {HOW_STEPS.map((s, i) => (
                    <button key={i} onClick={() => goTo(i)} aria-label={`Step ${i + 1}: ${s.label}`} aria-current={i === active}
                      className="cursor-pointer min-w-[24px] min-h-[24px] px-0.5 flex items-center justify-center">
                      <span className="block rounded-full transition-all duration-300"
                        style={{ width: i === active ? 20 : 6, height: 6, background: i === active ? step.color : (isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb") }} />
                    </button>
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
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);

  const stats = [
    // Product facts only. No customer counts or outcome claims until they are real and checkable.
    { num: 14,    suffix: "-day", label: "Free Trial",          sub: "every Growth feature, no credit card", color: "#ff6b00" },
    { num: 8,     suffix: "",     label: "Form Builders",       sub: "connected by the free WordPress plugin", color: "#22c55e" },
    { num: 24,    suffix: "/7",   label: "WhatsApp AI Replies", sub: "day and night, in your buyer's language", color: "#3b82f6" },
    { num: 4,     suffix: "",     label: "Languages",           sub: "English, Hinglish, Hindi and Marathi", color: "#a855f7" },
  ];
  // Prerendered HTML (reduced motion on the server) shows the real numbers, not 0.
  const [counts, setCounts] = useState(() => (REDUCED_MOTION() ? stats.map((st) => st.num) : stats.map(() => 0)));

  const points = [
    "Founded by real estate professionals who felt the pain of managing hundreds of leads across WhatsApp, email, and spreadsheets.",
    "Designed for the Indian market - we understand the way property sales teams actually work in Pune, Mumbai, and across Maharashtra.",
    "Built for scale - whether you're a 3-person channel partner office or a 100-seat developer sales team.",
    "Continuously improved based on direct feedback from our customers' daily workflows.",
  ];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
      if (REDUCED_MOTION()) { setCounts(stats.map((st) => st.num)); return; }
      stats.forEach((stat, i) => {
        const duration = 1600;
        const fps = 60;
        const steps = (duration / 1000) * fps;
        let step = 0;
        const id = setInterval(() => {
          step++;
          const progress = 1 - Math.pow(1 - step / steps, 3); // ease-out cubic
          setCounts(prev => {
            const next = [...prev];
            next[i] = Math.round(progress * stat.num);
            return next;
          });
          if (step >= steps) clearInterval(id);
        }, 1000 / fps);
      });
    }, { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function fmtCount(i) {
    const n = counts[i];
    const { suffix } = stats[i];
    return n.toLocaleString("en-IN") + suffix;
  }

  const bg      = isDark ? "#0d0d1a" : "#ffffff";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg  = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const cardSub = isDark ? "rgba(255,255,255,0.35)" : "#6b7280";

  return (
    <section id="about" ref={sectionRef} className="py-10 lg:py-14 overflow-hidden" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left - text with slide-in */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-40px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}>
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
              {points.map((p, i) => (
                <div key={p} className="flex items-start gap-3" style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateX(0)" : "translateX(-20px)",
                  transition: `opacity 0.5s ease ${0.35 + i * 0.1}s, transform 0.5s ease ${0.35 + i * 0.1}s`,
                }}>
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#ff6b00]/15 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-[#ff6b00]" />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: body }}>{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right - stat cards with animated counters + hover glow */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map(({ color, label, sub }, i) => (
              <div
                key={label}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                className="p-6 rounded-2xl cursor-default select-none"
                style={{
                  background: cardBg,
                  border: `1px solid ${hoveredCard === i ? color + "66" : cardBdr}`,
                  boxShadow: hoveredCard === i ? `0 8px 30px ${color}28` : "none",
                  transform: visible
                    ? (hoveredCard === i ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)")
                    : "translateY(20px)",
                  opacity: visible ? 1 : 0,
                  transition: [
                    `opacity 0.6s ease ${0.1 + i * 0.12}s`,
                    `transform 0.6s ease ${0.1 + i * 0.12}s`,
                    "border 0.22s ease",
                    "box-shadow 0.22s ease",
                  ].join(", "),
                }}
              >
                <div className="text-3xl font-black mb-1 tabular-nums" style={{ color }}>
                  {fmtCount(i)}
                </div>
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

// ── Contact ───────────────────────────────────────────────────────────────────
function Contact({ isDark }) {
  const bg      = isDark ? "#080810" : "#f4f0eb";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg  = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";

  const perks = [
    { icon: Zap,       text: "Response within 2 hours" },
    { icon: Users,     text: "Dedicated onboarding support" },
    { icon: Shield,    text: "Free 14-day trial, no card needed" },
    { icon: TrendingUp, text: "Custom demo for your team" },
  ];

  const info = [
    { icon: Mail,   label: "Email Us",  val: "contact@arthaleads.com",   href: "mailto:contact@arthaleads.com" },
    { icon: Phone,  label: "Call Us",   val: "+91 90670 97779",          href: "tel:+919067097779" },
    { icon: MapPin, label: "Based In",  val: "Pune, Maharashtra, India", href: null },
  ];

  const infoCardBg  = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const infoCardBdr = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const infoLabel   = isDark ? "rgba(255,255,255,0.38)" : "#6b7280";
  const infoVal     = isDark ? "#ffffff" : "#111827";

  return (
    <section id="contact" className="py-16 lg:py-24 relative overflow-hidden" style={{ background: bg }}>
      {/* Background glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: "absolute", top: "10%", left: "-10%", width: 500, height: 500,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,0,0.07) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: "5%", right: "-5%", width: 400, height: 400,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(255,170,0,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4" style={{ color: heading }}>
            Ready to transform your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              lead management?
            </span>
          </h2>
          <p className="text-base sm:text-lg max-w-xl mx-auto" style={{ color: body }}>
            Talk to our team for a personalised demo, pricing info, or any question about how Arthaleads fits your workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start lg:items-stretch">

          {/* Left panel — 2 cols */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Perks */}
            <div className="rounded-2xl p-6 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--brand-text)" }}>Why reach out?</p>
              {perks.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff6b00]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#ff6b00]" />
                  </div>
                  <span className="text-sm font-medium" style={{ color: heading }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Contact info cards */}
            <div className="space-y-3">
              {info.map(({ icon: Icon, label, val, href }) => (
                <div key={label}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-default"
                  style={{ background: infoCardBg, border: `1px solid ${infoCardBdr}` }}>
                  <div className="w-9 h-9 rounded-lg bg-[#ff6b00]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#ff6b00]" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: infoLabel }}>{label}</div>
                    {href
                      ? <a href={href} className="text-sm font-semibold hover:text-[color:var(--brand-text)] transition-colors" style={{ color: infoVal }}>{val}</a>
                      : <div className="text-sm font-semibold" style={{ color: infoVal }}>{val}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* WhatsApp */}
            <a href={waLink(WA_MESSAGES.sales)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
              style={{ background: "linear-gradient(135deg, rgba(37,211,102,0.12), rgba(37,211,102,0.06))", border: "1px solid rgba(37,211,102,0.25)" }}>
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#25D366]/30 transition-colors">
                <WhatsAppLogo className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: isDark ? "#ffffff" : "#111827" }}>Chat on WhatsApp</div>
                <div className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#6b7280" }}>Usually replies within minutes</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto text-[#25D366] opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>

          {/* Right panel — 3 cols — form */}
          <div className="lg:col-span-3 rounded-3xl overflow-hidden flex flex-col"
            style={{
              background: cardBg,
              border: `1px solid ${cardBdr}`,
              boxShadow: isDark
                ? "0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,107,0,0.06)"
                : "0 32px 80px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,107,0,0.06)",
            }}>
            {/* Top accent strip */}
            <div style={{ height: 3, background: "linear-gradient(to right, #ff6b00, #ffaa00, #ff6b00)" }} />
            {/* Stretches to the left column's height; the message box takes the extra space */}
            <div className="p-8 flex-1 flex flex-col">
              <ContactForm isDark={isDark} />
            </div>
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
  const [focused, setFocused] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
    try {
      const recaptchaToken = await getRecaptchaToken("contact");
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recaptchaToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setSent(true);
      else setError(data.message || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const heading  = isDark ? "#ffffff" : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const labelClr = isDark ? "rgba(255,255,255,0.55)" : "#374151";
  const inputBg  = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const inputBdr = isDark ? "rgba(255,255,255,0.09)" : "#e5e7eb";
  const inputClr = isDark ? "#ffffff" : "#111827";

  const fieldStyle = (id) => ({
    background: focused === id ? (isDark ? "rgba(255,107,0,0.06)" : "rgba(255,107,0,0.03)") : inputBg,
    border: `1.5px solid ${focused === id ? "#ff6b00" : inputBdr}`,
    color: inputClr,
    transition: "all 0.2s",
    outline: "none",
  });

  if (sent) return (
    <div className="flex flex-col items-center justify-center text-center py-14">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#ff6b00] flex items-center justify-center">
          <span style={{ fontSize: 12 }}>✓</span>
        </div>
      </div>
      <h3 className="font-black text-2xl mb-2" style={{ color: heading }}>Message Sent!</h3>
      <p className="text-sm mb-1" style={{ color: body }}>We'll get back to you at</p>
      <p className="text-sm font-bold mb-6" style={{ color: "var(--brand-text)" }}>{form.email}</p>
      <p className="text-xs px-6" style={{ color: body }}>Our team typically responds within 2 hours during business hours.</p>
      <button onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", company: "", message: "" }); }}
        className="mt-8 px-6 py-2.5 rounded-xl border text-sm font-semibold transition-all text-[color:var(--brand-text)] hover:bg-[color:var(--brand-btn)] hover:text-white hover:border-[#ff6b00]"
        style={{ borderColor: "#ff6b00" }}>
        Send another message
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
      <div className="mb-1">
        <h3 className="font-black text-xl mb-1" style={{ color: heading }}>Send us a message</h3>
        <p className="text-sm" style={{ color: body }}>Fill in the form and we'll be in touch shortly.</p>
      </div>

      {/* Name + Email row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { id: "name",  label: "Your Name",     type: "text",  ph: "Rajesh Patil",       req: true },
          { id: "email", label: "Email Address", type: "email", ph: "rajesh@example.com", req: true },
        ].map(({ id, label, type, ph, req }) => (
          <div key={id}>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: labelClr }}>
              {label}{req && <span className="text-[color:var(--brand-text)] ml-0.5">*</span>}
            </label>
            <input type={type} placeholder={ph} required={req}
              value={form[id]}
              onChange={(e) => setForm({ ...form, [id]: e.target.value })}
              onFocus={() => setFocused(id)}
              onBlur={() => setFocused("")}
              className="w-full rounded-xl px-4 py-2.5 text-sm"
              style={fieldStyle(id)} />
          </div>
        ))}
      </div>

      {/* Phone + Company row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { id: "phone",   label: "Phone Number",   type: "tel",  ph: "+91 98765 43210",    req: false },
          { id: "company", label: "Company / Team", type: "text", ph: "Milestone Properties", req: false },
        ].map(({ id, label, type, ph, req }) => (
          <div key={id}>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: labelClr }}>
              {label}
            </label>
            <input type={type} placeholder={ph}
              value={form[id]}
              onChange={(e) => setForm({ ...form, [id]: e.target.value })}
              onFocus={() => setFocused(id)}
              onBlur={() => setFocused("")}
              className="w-full rounded-xl px-4 py-2.5 text-sm"
              style={fieldStyle(id)} />
          </div>
        ))}
      </div>

      {/* Message */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold" style={{ color: labelClr }}>Message</label>
          <span className="text-[11px]" style={{ color: form.message.length > 1800 ? "#ef4444" : body }}>
            {form.message.length}/2000
          </span>
        </div>
        <textarea rows={4}
          placeholder="Tell us about your team size, current lead volume, and what you're looking for..."
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          onFocus={() => setFocused("message")}
          onBlur={() => setFocused("")}
          maxLength={2000}
          className="w-full flex-1 min-h-[112px] rounded-xl px-4 py-3 text-sm resize-none"
          style={fieldStyle("message")} />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full relative overflow-hidden text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group"
        style={{
          background: loading ? "#cc5500" : "linear-gradient(135deg, #ff6b00, #ff8c00)",
          boxShadow: loading ? "none" : "0 8px 32px rgba(255,107,0,0.35)",
          transform: loading ? "none" : undefined,
        }}>
        {/* Shimmer on hover */}
        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1), transparent)" }} />
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Sending…
          </>
        ) : (
          <>
            Send Message
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </button>

      <p className="text-center text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#6b7280" }}>
        By sending, you agree to our privacy policy. We never spam.
      </p>
    </form>
  );
}

// ── Who it's for ──────────────────────────────────────────────────────────────
// Every line here must stay true to data/features.js and data/plans.js.
const AUDIENCES = [
  { icon: Building2, color: "#ff6b00", title: "Builders and developers",
    body: "Run every project from one workspace: project-wise pipelines and lead imports, QR codes on site hoardings and brochures, a telecaller workflow for your calling team, and project-wise conversion for your managers.",
    link: { to: "/features", label: "See project features" } },
  { icon: Handshake, color: "#22c55e", title: "Channel partners",
    body: "Sell for several developers at once. Keep each developer's brokerage percentage, turn a closed deal into a booking in one click, and send a branded PDF invoice with GST already worked out.",
    link: { to: "/features", label: "See booking and invoices" } },
  { icon: UserCheck, color: "#3b82f6", title: "Brokers and small teams",
    body: "Every enquiry from Facebook, Instagram, WhatsApp and your website in one list, a shared WhatsApp inbox for the whole team, and follow-up reminders on your phone so no buyer is forgotten.",
    link: { to: "/whatsapp-crm", label: "See the WhatsApp CRM" } },
];

function WhoItsFor({ isDark }) {
  const bg      = isDark ? "#0a0a14" : "#fafafa";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.58)" : "#4b5563";
  const cardBg  = isDark ? "rgba(255,255,255,0.035)" : "#ffffff";
  const cardBdr = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const linkClr = isDark ? "#fb923c" : "#c2410c";

  return (
    <section id="who-its-for" className="py-16 lg:py-24" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black mb-4 leading-[1.15]" style={{ color: heading }}>
            One real estate CRM for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">builders, channel partners and brokers</span>
          </h2>
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: body }}>
            The same workspace fits the way each kind of property sales team works.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {AUDIENCES.map(({ icon: Icon, color, title, body: text, link }, i) => (
            <Reveal key={title} delay={i * 110} className="flex">
              <Spotlight className="group w-full flex flex-col rounded-3xl border p-7 transition-transform duration-300 hover:-translate-y-1"
                style={{ background: cardBg, borderColor: cardBdr }} color={`${color}1f`}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                  style={{ background: `${color}14` }}>
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: heading }}>{title}</h3>
                <p className="text-[15px] leading-relaxed flex-1" style={{ color: body }}>{text}</p>
                <Link to={link.to} className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold transition-all group-hover:gap-2.5" style={{ color: linkClr }}>
                  {link.label} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── What you can count on ─────────────────────────────────────────────────────
// Facts about the product and the company only: no customer counts, ratings or
// testimonials until real ones exist. Lead export is a Growth+ feature
// (planGate in leadRoutes), so it is worded that way.
const TRUST_FACTS = [
  { big: "14 days",  title: "Free trial",              body: "Every Growth feature on your own leads. No credit card, cancel any time." },
  { big: "7 days",   title: "Money-back",              body: "Changed your mind after paying? New subscriptions get a full refund.", link: { to: "/refund", label: "Refund policy" } },
  { big: "Official", title: "WhatsApp Business API",   body: "Built on Meta's platform, not a browser extension or an unofficial tool.", Icon: WhatsAppLogo },
  { big: "Isolated", title: "Your company's data",     body: "Each company's data is kept apart, and agents see only the leads assigned to them.", link: { to: "/security", label: "How we protect data" } },
  { big: "Yours",    title: "Your leads",              body: "Import CSV or Excel on every plan; export on Growth and Enterprise." },
  { big: "Pune",     title: "Built and supported in",  body: "By Vistrow, for the way Indian property teams sell." },
];

// A dark band on purpose: it breaks the run of white sections, and the facts read
// as big, scannable statements instead of six identical icon cards.
function TrustFacts() {
  const line = "rgba(255,255,255,0.09)";
  return (
    <section id="trust" className="relative overflow-hidden py-16 lg:py-24" style={{ background: "#0f0f17" }}>
      <div aria-hidden="true" className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] max-w-[140vw] h-[420px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(255,107,0,0.18), transparent 70%)" }} />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl mb-12 lg:mb-14">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#fb923c]">Before you hand us your leads</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-4 leading-[1.1] text-white" style={{ textWrap: "balance" }}>
            What you can count on
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ borderTop: `1px solid ${line}` }}>
          {TRUST_FACTS.map(({ big, title, body: text, link, Icon }, i) => (
            <Reveal key={big} delay={(i % 3) * 80}
              className={`group py-7 sm:pr-6 lg:pr-8 transition-colors duration-300 hover:bg-white/[0.02] ${i % 2 ? "sm:pl-6" : ""} ${i % 3 ? "lg:pl-8 lg:border-l" : "lg:pl-0"}`}
              style={{ borderBottom: `1px solid ${line}`, borderColor: line }}>
              <div className="flex items-center gap-3">
                <span className="text-4xl lg:text-5xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffb347] transition-transform duration-300 group-hover:translate-x-1">
                  {big}
                </span>
                {Icon && <Icon className="w-7 h-7" />}
              </div>
              <h3 className="mt-3 font-bold text-[16px] text-white">{title}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.58)" }}>
                {text}{link && <>{" "}<Link to={link.to} className="font-semibold underline underline-offset-2 text-[#fb923c]">{link.label}</Link></>}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Plans and switching ───────────────────────────────────────────────────────
// One slim band instead of the old pricing section (owner: plans live on
// /pricing): the starting price with a link, and the comparison pages for
// teams already on another CRM.
function PlansStrip({ isDark }) {
  const bg      = isDark ? "#0d0d1a" : "#ffffff";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.58)" : "#4b5563";
  const cardBg  = isDark ? "rgba(255,255,255,0.035)" : "#fffaf6";
  const cardBdr = isDark ? "rgba(255,255,255,0.08)" : "#f3e3d6";
  const rule    = isDark ? "rgba(255,255,255,0.08)" : "#f0e2d6";
  const COMPARE = [["Sell.Do", "/compare/sell-do-alternative"], ["Leadrat", "/compare/leadrat-alternative"], ["Kylas", "/compare/kylas-alternative"]];

  return (
    <section className="pb-16 lg:pb-24" style={{ background: bg }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="rounded-3xl border grid md:grid-cols-2 overflow-hidden" style={{ background: cardBg, borderColor: cardBdr }}>
          <div className="p-7 sm:p-8 flex flex-col">
            <h2 className="text-xl font-bold mb-2" style={{ color: heading }}>
              Plans from {formatINR(PLAN_PRICING.starter.monthly)} per user per month
            </h2>
            <p className="text-[15px] leading-relaxed mb-5 flex-1" style={{ color: body }}>
              Starter, Growth and Enterprise, with GST shown separately and a 14-day free trial on every Growth feature.
            </p>
            <Link to="/pricing" className="group inline-flex items-center gap-1.5 text-sm font-semibold transition-all hover:gap-2.5" style={{ color: "var(--brand-text)" }}>
              See plans and pricing <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-7 sm:p-8 flex flex-col border-t md:border-t-0 md:border-l" style={{ borderColor: rule }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: heading }}>Switching from another CRM?</h2>
            <p className="text-[15px] leading-relaxed mb-5 flex-1" style={{ color: body }}>
              See how Arthaleads compares on price, trial, WhatsApp and features, with every competitor detail linked to its source.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {COMPARE.map(([name, to]) => (
                <Link key={to} to={to} className="group inline-flex items-center gap-1.5 text-sm font-semibold transition-all hover:gap-2.5" style={{ color: "var(--brand-text)" }}>
                  vs {name} <ArrowRight className="w-4 h-4" />
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Latest from the blog ──────────────────────────────────────────────────────
// The three newest published posts. Hidden until they load (and if the API is
// down), so the home page never shows an empty block.
function LatestPosts({ isDark }) {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    let alive = true;
    api.get("/blog/posts?page=1&limit=3")
      .then((r) => { if (alive) setPosts((r.data.posts || []).slice(0, 3)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (posts.length === 0) return null;

  const bg      = isDark ? "#0a0a14" : "#fafafa";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.58)" : "#4b5563";
  const linkClr = isDark ? "#fb923c" : "#c2410c";

  return (
    <section id="latest-posts" className="py-16 lg:py-24" style={{ background: bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3 leading-[1.15]" style={{ color: heading }}>Latest from the blog</h2>
            <p className="text-base leading-relaxed" style={{ color: body }}>Practical guides for property sales teams: leads, follow-ups and WhatsApp.</p>
          </div>
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:gap-2.5 transition-all shrink-0" style={{ color: linkClr }}>
            All articles <ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p, i) => (
            <Reveal key={p._id || p.slug} delay={i * 100} className="flex">
              <BlogCard post={p} isDark={isDark} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
// Also published as FAQPage structured data (see Landing below). Keep answers
// true to the product: plan names and prices come from utils/plan.js.
const HOME_FAQS = [
  ["What is Arthaleads?",
   "Arthaleads is real estate CRM software built for sales teams in India: builders, developers, channel partners and brokers. It collects every property enquiry in one place, assigns it to the right person, reminds them to follow up, and tracks each lead from first call to site visit and booking."],
  ["Which lead sources can I connect?",
   "Facebook and Instagram lead ads import automatically, WhatsApp chats become leads, and website forms connect through our WordPress plugin or API. Google Ads is available on Enterprise. Portal leads from 99acres, Housing.com and MagicBricks can be added or imported from a sheet."],
  ["Can the WhatsApp AI reply to buyers in Hindi or Marathi?",
   "Yes. On Growth and Enterprise the WhatsApp AI agent answers buyer questions day and night and follows the buyer's language, including English, Hinglish, Hindi and Marathi. Your team can take over any chat at any time."],
  ["Is there a mobile app for my sales team?",
   "Yes. Agents get an Android app for calling leads, logging outcomes and seeing today's follow-ups, and the web app works on any phone or computer."],
  ["Which is the best real estate CRM in India?",
   "There is no single best one: it depends on your team size, lead sources and budget. Look for automatic Facebook and portal lead capture, WhatsApp follow-up, site visit tracking, an app for agents and clear per-user pricing. Arthaleads is built for Indian builders, channel partners and brokers whose buyers enquire on WhatsApp and Facebook."],
  ["Does Arthaleads work with 99acres, MagicBricks and Housing.com?",
   "Yes, through import rather than a live connection. Download your portal leads as a sheet and import the CSV or Excel file, or add them one by one. Once inside, they are assigned, followed up and tracked like every other lead, next to your Facebook, WhatsApp and website enquiries."],
  ["How much does a real estate CRM cost in India?",
   `Most real estate CRMs in India charge per user per month. Arthaleads Starter is ${formatINR(PLAN_PRICING.starter.monthly)} and Growth is ${formatINR(PLAN_PRICING.growth.monthly)} per user per month, plus 18% GST, with a five-seat minimum. Enterprise is quoted on team size. Every team can start with a 14-day free trial, no credit card needed.`],
  ["Can I take my data with me?",
   "Yes. On Growth and Enterprise you can export your leads to CSV or Excel whenever you like. Read how we protect your data on our Security page."],
];

const HOME_JSONLD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to manage real estate leads with Arthaleads",
    "description": "Get your entire real estate team capturing, assigning, and converting leads in four steps.",
    "totalTime": "PT5M",
    "step": HOW_STEPS.map((s) => ({ "@type": "HowToStep", "position": s.num, "name": s.title, "text": s.desc })),
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": HOME_FAQS.map(([q, a]) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
  },
]).replace(/</g, "\\u003c");

function FAQ({ isDark }) {
  const [open, setOpen] = useState(0);
  const bg      = isDark ? "#0d0d1a" : "#ffffff";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBdr = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const cardBg  = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";

  return (
    <section id="faq" className="py-16 lg:py-24" style={{ background: bg }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 self-start">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-text)]">Questions</span>
          <h2 className="text-3xl sm:text-4xl font-black mt-4 mb-4 leading-[1.12]" style={{ color: heading }}>
            Everything you are{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">wondering about</span>
          </h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: body }}>
            Still unsure whether Arthaleads fits your team? Ask us directly, we usually reply within minutes.
          </p>
          <a href={waLink(WA_MESSAGES.sales)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: "var(--wa-btn)", boxShadow: "0 6px 20px rgba(18,140,126,0.3)" }}>
            <WaLogo size={16} /> Ask on WhatsApp
          </a>
        </Reveal>

        <div className="space-y-3">
          {HOME_FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <Reveal key={q} delay={i * 60} y={16}>
                <div className="rounded-2xl border transition-colors duration-300"
                  style={{ background: cardBg, borderColor: isOpen ? "rgba(255,107,0,0.45)" : cardBdr }}>
                  <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`} id={`faq-q-${i}`}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer">
                    <span className="text-[15px] font-semibold" style={{ color: heading }}>{q}</span>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
                      style={{ background: isOpen ? "#ff6b00" : (isDark ? "rgba(255,255,255,0.06)" : "#fff7ed"), transform: isOpen ? "rotate(45deg)" : "none" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isOpen ? "#fff" : "#ff6b00"} strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </button>
                  <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: body }}>
                        {a}{i === HOME_FAQS.length - 1 && <> <Link to="/security" className="text-[color:var(--brand-text)] font-semibold hover:underline">Open Security</Link></>}
                        {/^Can the WhatsApp AI/.test(q) && <> <Link to="/whatsapp-crm" className="text-[color:var(--brand-text)] font-semibold hover:underline">See how the WhatsApp CRM works</Link></>}
                        {/^Which is the best/.test(q) && <> <Link to="/compare" className="text-[color:var(--brand-text)] font-semibold hover:underline">Compare Arthaleads with Sell.Do, Leadrat and Kylas</Link></>}
                        {/^How much does a real estate CRM cost/.test(q) && <> <Link to="/pricing" className="text-[color:var(--brand-text)] font-semibold hover:underline">See plans and pricing</Link></>}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA({ isDark }) {
  const bg      = isDark ? "#0d0d1a" : "#fff7f0";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";

  return (
    <section className="py-12 relative overflow-hidden" style={{ background: bg }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #ff6b00 0%, transparent 70%)" }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] max-w-[110vw] h-[340px] rounded-full blur-3xl"
          style={{ background: "conic-gradient(from 90deg, rgba(255,107,0,0.22), rgba(255,170,0,0.10), rgba(255,107,0,0.22))", animation: "aurora-drift 16s ease-in-out infinite" }} />
      </div>
      <Reveal className="relative max-w-3xl mx-auto text-center px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4" style={{ color: heading }}>
          Stop losing leads to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
            messy spreadsheets
          </span>
        </h2>
        <p className="text-lg mb-10" style={{ color: body }}>
          Bring every enquiry into one place and let the WhatsApp AI answer buyers while you sleep.
          Start your 14-day free trial today - no credit card needed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Magnetic>
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="shine-btn flex items-center gap-2 bg-[color:var(--brand-btn)] hover:bg-[color:var(--brand-btn-hover)] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </a>
          </Magnetic>
          <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
            className={waButtonClass(isDark)}>
            <WaLogo size={18} /> Book a demo on WhatsApp
          </a>
        </div>
      </Reveal>
    </section>
  );
}



export default function Landing() {
  const { isDark } = usePublicTheme();

  useSEO({
    title:       "AI Real Estate CRM Software in India | Arthaleads",
    description: "AI-powered real estate CRM for builders, developers and brokers in India. Capture Facebook, Google and WhatsApp leads, and let AI reply to buyers 24/7.",
    canonical:   "https://www.arthaleads.com/",
  });

  useEffect(() => {
    // Nav links from other pages arrive as /#pricing, /#contact...: land on that section.
    const id = window.location.hash.slice(1);
    if (!id) { window.scrollTo(0, 0); return undefined; }
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: REDUCED_MOTION() ? "auto" : "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, []);


  return (
    <div className="min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: HOME_JSONLD }} />
      <PublicNav onScrollTo={scrollTo} />
      <Hero isDark={isDark} />
      <SourcesStrip isDark={isDark} />
      <Features isDark={isDark} />
      <WhoItsFor isDark={isDark} />
      <IntroVideo isDark={isDark} />
      <HowItWorks isDark={isDark} />
      <About isDark={isDark} />
      <TrustFacts />
      <PlansStrip isDark={isDark} />
      <LatestPosts isDark={isDark} />
      <FAQ isDark={isDark} />
      <Contact isDark={isDark} />
      <FinalCTA isDark={isDark} />
      <PublicFooter />
    </div>
  );
}
