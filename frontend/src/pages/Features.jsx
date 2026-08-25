// pages/Features.jsx - the full product feature catalogue.
//
// The home page deliberately shows only six features with no card chrome; this
// is where the complete list lives, with the category filter that used to sit
// above the fold on the homepage.
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { FEATURES, FEAT_FILTERS } from "../data/features";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

export default function Features() {
  const { isDark } = usePublicTheme();
  const [activeFilter, setActiveFilter] = useState("all");

  useSEO({
    title: "Features - Arthaleads Real Estate CRM",
    description:
      "Every Arthaleads feature in one place: unified lead inbox, AI lead scoring, call intelligence, WhatsApp drafts, pipeline, attendance, invoicing and analytics.",
    canonical: "https://arthaleads.com/features",
  });

  const pageBg   = isDark ? "#0d0d1a" : "#ffffff";
  const heroBg   = isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 60%)";
  const heading  = isDark ? "#ffffff" : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const cardBg   = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr  = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const cardText = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";

  const filtered =
    activeFilter === "all" ? FEATURES : FEATURES.filter((f) => f.cat === activeFilter);

  const Card = ({ icon: Icon, color, title, desc, idx }) => (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: cardBg, border: `1px solid ${cardBdr}` }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-300"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
      />
      <div
        className="absolute right-3 top-1 text-6xl font-black select-none pointer-events-none leading-none"
        style={{ color: `${color}12` }}
      >
        {String(idx + 1).padStart(2, "0")}
      </div>
      <div className="p-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="font-bold text-base mb-1.5" style={{ color: heading }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: cardText }}>{desc}</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: pageBg, minHeight: "100vh" }}>
      <PublicNav />

      {/* ── Page header ── */}
      <section className="pt-28 pb-12 lg:pt-36 lg:pb-16" style={{ background: heroBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-5">
            <Zap className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">
              Powerful Features
            </span>
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] mb-5 max-w-4xl"
            style={{ color: heading }}
          >
            Every tool your sales team needs,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              in one CRM
            </span>
          </h1>
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: body }}>
            {FEATURES.length} features built for the Indian real estate market - from small
            channel partner offices to large developer sales teams.
          </p>
        </div>
      </section>

      {/* ── Catalogue ── */}
      <section className="pb-20 lg:pb-28" style={{ background: pageBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex mb-8 lg:mb-10">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {FEAT_FILTERS.map((f) => {
                const isActive = activeFilter === f.id;
                const count =
                  f.id === "all" ? FEATURES.length : FEATURES.filter((x) => x.cat === f.id).length;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
                    style={{
                      background: isActive ? `${f.color}15` : "transparent",
                      border: `1px solid ${isActive ? f.color + "55" : (isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb")}`,
                      color: isActive ? f.color : (isDark ? "rgba(255,255,255,0.45)" : "#6b7280"),
                      boxShadow: isActive ? `0 0 0 3px ${f.color}12` : "none",
                    }}
                  >
                    {f.label}
                    <span
                      className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive ? `${f.color}20` : (isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6"),
                        color: isActive ? f.color : (isDark ? "rgba(255,255,255,0.40)" : "#9ca3af"),
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((f, i) => <Card key={f.title} {...f} idx={i} />)}
          </div>

          {/* ── Closing CTA ── */}
          <div className="mt-16 lg:mt-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: heading }}>
              See it running on your own leads
            </h2>
            <p className="text-base mb-7 max-w-xl mx-auto" style={{ color: body }}>
              Start free, import your existing leads, and have your team calling the same day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={CRM_SIGNUP_URL}
                {...CRM_LINK_PROPS}
                className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 text-base"
              >
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </a>
              <Link
                to="/pricing"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl transition-all duration-200 text-base font-medium border"
                style={{
                  color: isDark ? "rgba(255,255,255,0.70)" : "#374151",
                  borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb",
                }}
              >
                View Pricing
              </Link>
            </div>
          </div>

        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
