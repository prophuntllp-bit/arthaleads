import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { PublicThemeProvider, usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const values = [
  {
    title: "Speed",
    desc: "Every lead that comes in is captured instantly. Every follow-up reminder fires on time. We build for the urgency of property sales.",
  },
  {
    title: "Simplicity",
    desc: "Sales teams shouldn't need training to use their CRM. Arthaleads is intuitive enough for a telecaller on day one.",
  },
  {
    title: "Support",
    desc: "When your team is in the middle of a campaign and something goes wrong, we're there. Real support from people who understand real estate.",
  },
];

const stats = [
  { val: "500+",    label: "Real Estate Teams" },
  { val: "50,000+", label: "Leads Managed" },
  { val: "8",       label: "Form Integrations" },
  { val: "99.9%",   label: "Uptime" },
];

const storyPoints = [
  "Every lead source connected to one inbox — Facebook, Google, WhatsApp, forms, portals.",
  "Duplicate prevention so your team never wastes a call.",
  "Role-based access so telecallers, managers, and admins each see exactly what they need.",
  "Real-time dashboards built for the pace of property sales campaigns.",
];

function AboutUsInner() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "About Arthaleads — Real Estate CRM Built for India",
    description: "Arthaleads is India's leading real estate CRM platform built for developers, brokers, and channel partners. Learn our mission to simplify property lead management.",
    canonical: "https://www.arthaleads.com/about-us",
  });

  const bg        = isDark ? "#0d0d1a" : "#ffffff";
  const altBg     = isDark ? "#080810" : "#f9fafb";
  const textColor = isDark ? "#ffffff" : "#111827";
  const softText  = isDark ? "rgba(255,255,255,0.60)" : "#6b7280";
  const cardBg    = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const checkBg   = isDark ? "rgba(255,107,0,0.15)" : "rgba(255,107,0,0.10)";

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.08)" }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.08)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">About Arthaleads</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] mb-6" style={{ color: textColor }}>
            Built for Real Estate.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Built for India.
            </span>
          </h1>
          <p className="text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: softText }}>
            We set out to solve a problem every Indian real estate team knows: leads slipping through the cracks
            across WhatsApp groups, Facebook campaigns, and forgotten spreadsheets.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6" style={{ color: textColor }}>Our Story</h2>
              <p className="text-base leading-relaxed mb-5" style={{ color: softText }}>
                Real estate sales teams in India work across multiple channels simultaneously — Facebook lead ads,
                Google campaigns, WhatsApp enquiries, walk-ins, and housing portals — all at once. Before Arthaleads,
                managing this meant juggling six different tabs, three WhatsApp groups, and a shared Excel sheet
                that nobody trusted.
              </p>
              <p className="text-base leading-relaxed mb-5" style={{ color: softText }}>
                Hot leads would go cold because no one followed up in time. Telecallers would call the same number
                three times from different lists. Managers had no way to see what the team was actually doing.
              </p>
              <p className="text-base leading-relaxed" style={{ color: softText }}>
                We built Arthaleads to be the single workspace where every property enquiry lands, gets assigned,
                gets called, and gets tracked — from first contact to closed deal.
              </p>
            </div>
            <div className="space-y-4">
              {storyPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: checkBg }}>
                    <Check className="w-3 h-3 text-[#ff6b00]" />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: softText }}>{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ color: textColor }}>Our Mission</h2>
          <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00] leading-tight">
            Turn every property enquiry into a closed deal.
          </p>
          <p className="text-base leading-relaxed mt-6 max-w-xl mx-auto" style={{ color: softText }}>
            We believe the difference between a sale and a missed opportunity is usually just one thing: a timely,
            informed follow-up. Arthaleads exists to make sure that follow-up never gets missed.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>What We Stand For</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: softText }}>
              Three values that shape every decision we make, every feature we ship, and every customer interaction.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map(({ title, desc }) => (
              <div key={title} className="p-7 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="text-[#ff6b00] font-black text-3xl mb-4">{title}</div>
                <p className="text-sm leading-relaxed" style={{ color: softText }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(({ val, label }) => (
              <div key={label} className="text-center p-6 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="text-4xl font-black text-[#ff6b00] mb-2">{val}</div>
                <div className="text-sm font-medium" style={{ color: softText }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: textColor }}>
            Ready to bring your team onto Arthaleads?
          </h2>
          <p className="text-base mb-8" style={{ color: softText }}>
            Start your free trial — no credit card required. Your team can be up and running today.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default function AboutUs() {
  return (
    <PublicThemeProvider>
      <AboutUsInner />
    </PublicThemeProvider>
  );
}
