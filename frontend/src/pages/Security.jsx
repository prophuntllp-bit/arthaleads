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
      ["Encryption in transit", "All traffic between your browser and our servers runs over HTTPS/TLS."],
      ["Encryption at rest", "MongoDB Atlas (AWS, Mumbai) encrypted at rest; stored access tokens get extra field-level encryption."],
      ["Tenant isolation", "Every organisation's data is scoped by its own org ID, so no customer sees another's leads."],
      ["Backups", "Daily database backups to private Backblaze storage (USA), kept at most 12 months. Uploaded files sit in private storage, served only to signed-in users allowed to see them."],
    ],
  },
  {
    key: "access",
    label: "Access control",
    icon: UserCheck,
    points: [
      ["Role-based access", "Admin, Manager and Agent roles with scoped permissions; agents see only their assigned leads."],
      ["Secure authentication", "Passwords hashed with bcrypt; sessions in httpOnly cookies that JavaScript cannot read."],
      ["Email verification", "New accounts confirm their email with a one-time code."],
      ["Brute-force protection", "Login attempts are rate-limited to block password guessing."],
    ],
  },
  {
    key: "infra",
    label: "Infrastructure",
    icon: Server,
    points: [
      ["Hardened headers", "Helmet security headers (CSP, HSTS, X-Frame-Options) on every response."],
      ["Rate limiting", "API endpoints are rate-limited to absorb abuse."],
      ["Error monitoring", "Sentry tracks errors in real time."],
      ["Signed webhooks", "Facebook lead webhooks are verified with HMAC-SHA256 signatures, so spoofed leads are rejected."],
    ],
  },
  {
    key: "privacy",
    label: "Privacy and compliance",
    icon: Eye,
    points: [
      ["DPDP Act and Rules", "Built to follow the DPDP Act, 2023 and DPDP Rules, 2025: published sub-processors, breach notification and a Grievance Officer."],
      ["No data selling", "We never sell or rent your leads; they are shared only with the providers that run the CRM."],
      ["Facebook reviewed", "Our Meta app is App Review approved for lead retrieval."],
      ["Full data export", "On Growth and Enterprise, export all your leads as CSV or Excel at any time."],
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
        lede="Encryption, strict access control, signed webhooks and India's data protection law, so your pipeline stays protected."
        actions={[
          { label: "See how we protect data", href: "#pillars" },
          { label: "Report an issue", href: "mailto:contact@arthaleads.com?subject=Security%20Disclosure", Icon: Mail },
        ]}
      >
        <ul className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          {TRUST_BADGES.map(([label, Icon]) => (
            <li key={label}>
              <Card glow className="flex items-center gap-2.5 p-3 h-full">
                <span className="site-icon w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={iconTile}>
                  <Icon className="w-4 h-4" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                </span>
                <span className="text-[13px] font-semibold site-ink leading-tight">{label}</span>
              </Card>
            </li>
          ))}
        </ul>
      </PageHero>

      {/* The four pillars, all on the page (no tabs) so every point is readable and indexable.
          The page's signature sand band. */}
      <Section tone="sand" id="pillars">
        <Container>
          <SectionHeader eyebrow="How we protect your data" title="Four pillars of Arthaleads security" />
          <div className="grid md:grid-cols-2 gap-4">
            {PILLARS.map((p, i) => (
              <Reveal key={p.key} delay={(i % 2) * 100} className="min-w-0 flex">
                <Card glow className="w-full p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={iconTile}>
                      <p.icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                    </span>
                    <h3 className="site-h3">{p.label}</h3>
                  </div>
                  <ul className="space-y-4">
                    {p.points.map(([title, desc]) => (
                      <li key={title} className="flex items-start gap-3">
                        <CheckCircle2 className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: "#16a34a" }} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block site-h4 !text-[15px] !mb-0.5">{title}</span>
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
        <Container>
          <Reveal>
            <Card raised className="p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
              <span className="site-icon w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={iconTile}>
                <Shield className="w-7 h-7" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="site-h3 !mb-2">Found a security issue?</h2>
                <p className="text-[15px] leading-relaxed">
                  Report a vulnerability privately and we will respond quickly.
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
