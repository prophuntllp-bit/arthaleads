// pages/Features.jsx - the full product feature catalogue.
//
// Organised by the job a sales team is doing (capture, prioritise, talk,
// projects, close, team, control) rather than one long grid of identical
// cards. Each group has a short heading on the left that stays in view while
// its features scroll past on the right.
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { FEATURES, FEATURE_GROUPS } from "../data/features";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

export default function Features() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "Features - Arthaleads Real Estate CRM",
    description: "Every Arthaleads feature: lead capture from ads, portals and WhatsApp, AI lead scoring, WhatsApp campaigns and consent, call intelligence, projects, bookings and invoices, Meta Conversions API, attendance and tasks.",
    canonical: "https://www.arthaleads.com/features",
  });

  const pageBg   = isDark ? "#0d0d1a" : "#ffffff";
  const heroBg   = isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 60%)";
  const heading  = isDark ? "#ffffff" : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const itemText = isDark ? "rgba(255,255,255,0.55)" : "#5b6170";
  const rule     = isDark ? "rgba(255,255,255,0.07)" : "#ece8e3";
  const chipBdr  = isDark ? "rgba(255,255,255,0.10)" : "#e7e1d8";
  const chipBg   = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";

  const jump = (id) => document.getElementById(`group-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div style={{ background: pageBg, minHeight: "100vh" }}>
      <PublicNav />

      {/* ── Page header ── */}
      <section className="pt-28 pb-12 lg:pt-36 lg:pb-16" style={{ background: heroBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b00]">
            {FEATURES.length} features, one workspace
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] mt-4 mb-5 max-w-4xl"
            style={{ color: heading, textWrap: "balance" }}>
            From the first enquiry to the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              paid invoice
            </span>
          </h1>
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: body }}>
            Built for Indian real estate teams, from small channel partner offices to large
            developer sales floors. Here is everything ArthaLeads does, in the order your
            team uses it.
          </p>

          <nav aria-label="Feature groups" className="mt-10 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" style={{ scrollbarWidth: "none" }}>
            {FEATURE_GROUPS.map((g) => {
              const n = FEATURES.filter((f) => f.group === g.id).length;
              return (
                <button key={g.id} type="button" onClick={() => jump(g.id)}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-150 hover:border-[#ff6b00]/60 hover:text-[#ff6b00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
                  style={{ background: chipBg, border: `1px solid ${chipBdr}`, color: heading }}>
                  {g.label}
                  <span className="text-xs font-medium tabular-nums" style={{ color: body }}>{n}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* ── Groups ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {FEATURE_GROUPS.map((g) => {
          const items = FEATURES.filter((f) => f.group === g.id);
          return (
            <section key={g.id} id={`group-${g.id}`} aria-labelledby={`group-${g.id}-title`}
              className="scroll-mt-24 py-14 lg:py-20 grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)] gap-8 lg:gap-16"
              style={{ borderTop: `1px solid ${rule}` }}>
              <div className="lg:sticky lg:top-28 self-start">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b00]">{g.label}</span>
                <h2 id={`group-${g.id}-title`} className="text-2xl sm:text-3xl font-black mt-3 mb-3 leading-tight"
                  style={{ color: heading, textWrap: "balance" }}>
                  {g.title}
                </h2>
                <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: body }}>{g.blurb}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-10 gap-y-10">
                {items.map(({ icon: Icon, color, title, desc }) => (
                  <article key={title}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}14` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <h3 className="font-bold text-[17px] mb-1.5" style={{ color: heading }}>{title}</h3>
                    <p className="text-[15px] leading-relaxed" style={{ color: itemText }}>{desc}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Closing CTA ── */}
      <section className="py-16 lg:py-24 text-center px-4">
        <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: heading }}>
          See it running on your own leads
        </h2>
        <p className="text-base mb-7 max-w-xl mx-auto" style={{ color: body }}>
          Request your workspace, import your existing leads, and have your team calling the same day.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
            className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 text-base">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </a>
          <Link to="/pricing"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl transition-all duration-200 text-base font-medium border"
            style={{ color: isDark ? "rgba(255,255,255,0.70)" : "#374151", borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb" }}>
            View Pricing
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
