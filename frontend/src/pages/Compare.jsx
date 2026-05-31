import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, X, Search, ArrowRight, Sparkles } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const COMPETITORS = ["Arthaleads", "LeadRat", "Sell.do", "Kylas"];

// y = yes, n = no, p = partial
const CATEGORIES = [
  {
    name: "Lead Management",
    rows: [
      ["Facebook Lead Ads auto-import",      ["y", "y", "y", "y"]],
      ["Kanban lead pipeline",               ["y", "y", "y", "y"]],
      ["Follow-up reminders",                ["y", "y", "y", "y"]],
      ["Duplicate lead detection",           ["y", "y", "y", "p"]],
      ["Bulk CSV import & export",           ["y", "y", "y", "y"]],
      ["Lead activity timeline",             ["y", "y", "y", "y"]],
      ["Project-wise pipelines",             ["y", "p", "y", "p"]],
    ],
  },
  {
    name: "Automation & Integrations",
    rows: [
      ["WhatsApp lead capture",              ["y", "y", "y", "p"]],
      ["WordPress / website forms",          ["y", "p", "p", "p"]],
      ["Google Ads integration",             ["y", "y", "y", "y"]],
      ["Auto round-robin assignment",        ["y", "y", "y", "y"]],
      ["REST API access",                    ["y", "p", "y", "y"]],
      ["Webhook (signed/secure)",            ["y", "p", "p", "p"]],
    ],
  },
  {
    name: "Team & Analytics",
    rows: [
      ["Role-based access control",          ["y", "y", "y", "y"]],
      ["Attendance tracking",                ["y", "n", "p", "n"]],
      ["Team performance dashboard",         ["y", "y", "y", "y"]],
      ["Conversion & booking analytics",     ["y", "y", "y", "y"]],
      ["Audit log",                          ["y", "p", "y", "y"]],
    ],
  },
  {
    name: "Platform & Value",
    rows: [
      ["Built for Indian real estate",       ["y", "y", "y", "p"]],
      ["Mobile PWA (add to home screen)",    ["y", "p", "p", "y"]],
      ["Push notifications",                 ["y", "y", "p", "y"]],
      ["Refer & earn program",               ["y", "n", "n", "p"]],
      ["7-day money-back guarantee",         ["y", "n", "n", "n"]],
      ["Transparent, fast setup (instant)",  ["y", "p", "p", "p"]],
    ],
  },
];

function Cell({ val }) {
  if (val === "y") return <Check className="w-4 h-4 mx-auto" style={{ color: "#22c55e" }} />;
  if (val === "p") return <span className="text-xs font-medium" style={{ color: "#f59e0b" }}>Partial</span>;
  return <X className="w-4 h-4 mx-auto" style={{ color: "#ef4444" }} />;
}

export default function Compare() {
  const { isDark } = usePublicTheme();
  const [query, setQuery] = useState("");

  useSEO({
    title:       "Arthaleads vs LeadRat, Sell.do & Kylas | Real Estate CRM Comparison",
    description: "Compare Arthaleads with LeadRat, Sell.do, and Kylas. See how India's real estate CRMs stack up on lead management, automation, analytics, and value.",
    canonical:   "https://www.arthaleads.com/compare",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const headBg     = isDark ? "rgba(255,255,255,0.03)" : "#f9fafb";

  const filtered = useMemo(() => {
    if (!query.trim()) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES
      .map((c) => ({ ...c, rows: c.rows.filter(([label]) => label.toLowerCase().includes(q)) }))
      .filter((c) => c.rows.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-10 overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <Sparkles className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Comparison</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5" style={{ color: textColor }}>
            How Arthaleads{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">compares</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: softText }}>
            An honest, feature-by-feature look at Arthaleads against other popular real estate CRMs in India.
            Search any feature to jump straight to it.
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="pb-6">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: softText }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a feature (e.g. WhatsApp, API, analytics)…"
              className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textColor }}
            />
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
            {/* Sticky header row */}
            <div className="grid sticky top-16 z-10" style={{ gridTemplateColumns: "minmax(0,1.6fr) repeat(4, minmax(0,1fr))", background: headBg, borderBottom: `1px solid ${cardBorder}` }}>
              <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide flex items-center" style={{ color: softText }}>Feature</div>
              {COMPETITORS.map((c, i) => (
                <div key={c} className="px-2 py-3 text-center text-xs font-bold flex items-center justify-center" style={{ color: i === 0 ? "#ff6b00" : softText, background: i === 0 ? "rgba(255,107,0,0.06)" : "transparent" }}>
                  {c}
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-sm" style={{ color: softText, background: cardBg }}>
                No features match "{query}". Try another search.
              </div>
            )}

            {filtered.map((cat) => (
              <div key={cat.name}>
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ color: "#ff6b00", background: isDark ? "rgba(255,107,0,0.04)" : "#fff7f0", borderBottom: `1px solid ${cardBorder}` }}>
                  {cat.name}
                </div>
                {cat.rows.map(([label, vals], ri) => (
                  <div
                    key={label}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: "minmax(0,1.6fr) repeat(4, minmax(0,1fr))",
                      background: ri % 2 === 0 ? cardBg : (isDark ? "rgba(255,255,255,0.01)" : "#fcfcfc"),
                      borderBottom: `1px solid ${cardBorder}`,
                    }}
                  >
                    <div className="px-4 py-3 text-sm" style={{ color: textColor }}>{label}</div>
                    {vals.map((v, i) => (
                      <div key={i} className="px-2 py-3 text-center" style={{ background: i === 0 ? "rgba(255,107,0,0.04)" : "transparent" }}>
                        <Cell val={v} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-5 text-xs" style={{ color: softText }}>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "#22c55e" }} /> Full support</span>
            <span className="flex items-center gap-1.5"><span style={{ color: "#f59e0b", fontWeight: 600 }}>Partial</span> Limited</span>
            <span className="flex items-center gap-1.5"><X className="w-4 h-4" style={{ color: "#ef4444" }} /> Not available</span>
          </div>
          <p className="text-center text-xs mt-4 max-w-2xl mx-auto" style={{ color: softText }}>
            Comparison based on publicly available information as of May 2026. Competitor features may change —
            we keep this page updated. Spotted something out of date? Let us know.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3" style={{ color: textColor }}>See the difference yourself</h2>
          <p className="text-base mb-6" style={{ color: softText }}>
            Start free — no credit card needed. Set up your pipeline in minutes.
          </p>
          <Link to="/signup" className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25">
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
