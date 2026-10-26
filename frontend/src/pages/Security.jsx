// pages/Security.jsx - /security on the shared marketing theme (components/site/*).
// Every point must stay true to how the product runs today; change the copy
// when the infrastructure changes.
import {
  Shield, Lock, KeyRound, Server, Eye, UserCheck, Database, Bell,
  CheckCircle2, Mail, FileCheck, RefreshCw, Globe,
} from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, ClosingCta } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";

const PILLARS = [
  {
    key: "data",
    label: "Data protection",
    icon: Database,
    points: [
      ["Encryption in transit", "All traffic is served over HTTPS/TLS. Data moving between your browser and our servers is always encrypted."],
      ["Encryption at rest", "Your data is stored on MongoDB Atlas with encryption at rest on AWS infrastructure."],
      ["Tenant isolation", "Every organisation's data is strictly scoped by a unique org ID. One customer can never see another's leads."],
      ["Backups", "Automated daily backups of core records such as leads, projects, bookings and team data. Uploaded files (photos, brochures, recordings) are stored separately in our file storage."],
    ],
  },
  {
    key: "access",
    label: "Access control",
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
      ["Signed webhooks", "Incoming Facebook lead webhooks are verified with HMAC-SHA256 signatures, so nobody can send in spoofed leads."],
    ],
  },
  {
    key: "privacy",
    label: "Privacy and compliance",
    icon: Eye,
    points: [
      ["DPDP Act 2023", "Built to comply with India's Digital Personal Data Protection Act. Consent-first, data-minimal."],
      ["No data selling", "We never sell, rent, or share your leads. Your data is used only to run the CRM for you."],
      ["Facebook reviewed", "Our Meta app is App-Review approved for lead retrieval and held to Meta's data-use standards."],
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

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

export default function Security() {
  useSEO({
    title:       "Security & Trust | Arthaleads Real Estate CRM",
    description: "How Arthaleads keeps your real estate leads safe: encryption, role-based access, signed webhooks, daily backups, and DPDP Act 2023 compliance.",
    canonical:   "https://www.arthaleads.com/security",
  });

  return (
    <SitePage>
      <PageHero
        eyebrow="Security"
        title={<>Your leads are <span className="site-dim">safe with us</span></>}
        lede="Arthaleads is built security-first: encryption, strict access control, signed webhooks and compliance with India's data protection law, so your most valuable asset, your pipeline, stays protected."
        actions={null}
      >
        <ul className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          {TRUST_BADGES.map(([label, Icon]) => (
            <li key={label}>
              <Card className="flex items-center gap-2.5 p-3 h-full">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={iconTile}>
                  <Icon className="w-4 h-4" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                </span>
                <span className="text-[13px] font-semibold site-ink leading-tight">{label}</span>
              </Card>
            </li>
          ))}
        </ul>
      </PageHero>

      {/* The four pillars, all on the page (no tabs) so every point is readable and indexable */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="How we protect your data" title="Four pillars of Arthaleads security" />
          <div className="grid md:grid-cols-2 gap-4">
            {PILLARS.map((p, i) => (
              <Reveal key={p.key} delay={(i % 2) * 100} className="min-w-0 flex">
                <Card glow className="w-full p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={iconTile}>
                      <p.icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-xl font-bold site-ink">{p.label}</h3>
                  </div>
                  <ul className="space-y-4">
                    {p.points.map(([title, desc]) => (
                      <li key={title} className="flex items-start gap-3">
                        <CheckCircle2 className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: "#16a34a" }} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-semibold site-ink text-[15px] mb-0.5">{title}</span>
                          <span className="block text-[14px] leading-relaxed">{desc}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Responsible disclosure */}
      <Section tone="white">
        <Container narrow>
          <Reveal>
            <Card raised className="p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={iconTile}>
                <Shield className="w-7 h-7" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl sm:text-2xl font-bold site-ink mb-2">Found a security issue?</h2>
                <p className="text-[15px] leading-relaxed">
                  If you believe you've found a vulnerability, please report it privately and we'll respond quickly. We appreciate responsible disclosure.
                </p>
              </div>
              <SiteButton href="mailto:contact@arthaleads.com?subject=Security%20Disclosure" variant="secondary" className="shrink-0">
                <Mail className="w-4 h-4" /> Report an issue
              </SiteButton>
            </Card>
          </Reveal>
        </Container>
      </Section>

      <ClosingCta title="Manage your leads" dim="securely, in one place."
        body="Book a 30-minute demo and ask us anything about how your data is handled, or start the 14-day free trial yourself." tone="tint" />
    </SitePage>
  );
}
