import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Lock, KeyRound, Server, Eye, UserCheck, Database, Bell,
  CheckCircle2, ArrowRight, Mail, FileCheck, RefreshCw, Globe,
} from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const PILLARS = [
  {
    key: "data",
    label: "Data Protection",
    icon: Database,
    points: [
      ["Encryption in transit", "All traffic is served over HTTPS/TLS. Data moving between your browser and our servers is always encrypted."],
      ["Encryption at rest", "Your data is stored on MongoDB Atlas with encryption at rest on AWS infrastructure."],
      ["Tenant isolation", "Every organisation's data is strictly scoped by a unique org ID. One customer can never see another's leads."],
      ["Daily backups", "Automated daily database backups so your lead data is never lost."],
    ],
  },
  {
    key: "access",
    label: "Access Control",
    icon: UserCheck,
    points: [
      ["Role-based access", "Admin, Manager, and Agent roles each have precisely scoped permissions. Agents only see leads assigned to them."],
      ["Secure authentication", "Passwords are hashed with bcrypt. Login is protected by httpOnly session cookies that JavaScript cannot read."],
      ["Email & phone OTP", "Verify identity with one-time passwords during signup and login."],
      ["Brute-force protection", "Login attempts are rate-limited to block password-guessing attacks."],
    ],
  },
  {
    key: "infra",
    label: "Infrastructure",
    icon: Server,
    points: [
      ["Hardened headers", "We apply Helmet security headers (CSP, HSTS, X-Frame-Options) on every response."],
      ["Rate limiting", "API endpoints are rate-limited to absorb abuse and keep the service stable for everyone."],
      ["Error monitoring", "Sentry tracks errors in real time so we catch and fix issues fast."],
      ["Signed webhooks", "Incoming Facebook lead webhooks are verified with HMAC-SHA256 signatures — no spoofed leads."],
    ],
  },
  {
    key: "privacy",
    label: "Privacy & Compliance",
    icon: Eye,
    points: [
      ["DPDP Act 2023", "Built to comply with India's Digital Personal Data Protection Act. Consent-first, data-minimal."],
      ["No data selling", "We never sell, rent, or share your leads. Your data is used only to run the CRM for you."],
      ["Facebook reviewed", "Our Meta app is App-Review approved for lead retrieval — held to Meta's data-use standards."],
      ["Full data export", "Export all your leads anytime in CSV/Excel. Your data belongs to you."],
    ],
  },
];

const TRUST_BADGES = [
  ["HTTPS / TLS", Globe],
  ["bcrypt hashing", KeyRound],
  ["httpOnly cookies", Lock],
  ["HMAC webhooks", FileCheck],
  ["Daily backups", RefreshCw],
  ["Role-based access", UserCheck],
  ["Rate limiting", Shield],
  ["Real-time alerts", Bell],
];

export default function Security() {
  const { isDark } = usePublicTheme();
  const [active, setActive] = useState("data");

  useSEO({
    title:       "Security & Trust | Arthaleads Real Estate CRM",
    description: "How Arthaleads keeps your real estate leads safe: encryption, role-based access, signed webhooks, daily backups, and DPDP Act 2023 compliance.",
    canonical:   "https://www.arthaleads.com/security",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  const activePillar = PILLARS.find((p) => p.key === active);

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
            <Shield className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Security & Trust</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5" style={{ color: textColor }}>
            Your leads are{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">safe with us</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: softText }}>
            Arthaleads is built security-first. Encryption, strict access control, signed webhooks, and
            compliance with India's data protection law — so your most valuable asset, your pipeline, stays
            protected.
          </p>
        </div>
      </section>

      {/* Trust badges */}
      <section className="pb-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TRUST_BADGES.map(([label, Icon]) => (
              <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,0,0.1)" }}>
                  <Icon className="w-4 h-4 text-[#ff6b00]" />
                </div>
                <span className="text-xs font-medium" style={{ color: textColor }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive pillars */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>How we protect your data</h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: softText }}>
              Explore the four pillars of Arthaleads security.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {PILLARS.map((p) => {
              const isActive = p.key === active;
              return (
                <button
                  key={p.key}
                  onClick={() => setActive(p.key)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
                  style={{
                    background: isActive ? "#ff6b00" : cardBg,
                    color: isActive ? "#fff" : softText,
                    border: `1px solid ${isActive ? "#ff6b00" : cardBorder}`,
                  }}
                >
                  <p.icon className="w-4 h-4" />
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Active pillar content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {activePillar.points.map(([title, desc]) => (
              <div key={title} className="p-5 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#ff6b00] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1.5" style={{ color: textColor }}>{title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: softText }}>{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Responsible disclosure */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 rounded-2xl text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(255,107,0,0.1)" }}>
              <Shield className="w-6 h-6 text-[#ff6b00]" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: textColor }}>Found a security issue?</h2>
            <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: softText }}>
              We take security seriously. If you believe you've found a vulnerability, please report it
              privately and we'll respond quickly. We appreciate responsible disclosure.
            </p>
            <a
              href="mailto:contact@arthaleads.com?subject=Security%20Disclosure"
              className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors"
              style={{ background: "rgba(255,107,0,0.10)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.40)" }}
            >
              <Mail className="w-4 h-4" />
              Report to contact@arthaleads.com
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3" style={{ color: textColor }}>Ready to manage leads securely?</h2>
          <p className="text-base mb-6" style={{ color: softText }}>
            Join real estate teams across India who trust Arthaleads with their pipeline.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
