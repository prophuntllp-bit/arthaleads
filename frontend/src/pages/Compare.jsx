import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { waLink, CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { Check, X, Search, ArrowRight } from "lucide-react";
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


// What to weigh when choosing, written about buyers' needs and what Arthaleads
// does, so it never makes claims about other products beyond the table above.
const CHOOSING = [
  { title: "Every lead source lands on its own",
    body: "List where your enquiries come from today: Facebook and Instagram lead forms, Google Ads, property portals, your website and WhatsApp. Each one should arrive in the CRM automatically, with its source and campaign attached. Anything that still needs a spreadsheet download will be forgotten on a busy day.",
    link: { to: "/blog/real-estate-lead-management-enquiry-to-site-visit", label: "How lead management works, step by step" } },
  { title: "Speed to the first call",
    body: "Buyers enquire with several projects at once, so the first useful reply often wins. Look for instant assignment to the right person, a push alert on their phone, and a way to answer on WhatsApp at night when nobody is at a desk.",
    link: { to: "/blog/reply-to-property-enquiries-on-whatsapp-fast", label: "Replying to property enquiries on WhatsApp" } },
  { title: "Project-wise work for developers",
    body: "If you sell more than one project, each needs its own pipeline, team and reports, while managers still see everything together. Check that a lead can be moved or copied into a project without losing its history." },
  { title: "Follow-ups that cannot slip",
    body: "Every conversation should end with a dated next step, and every person should start the day with a list of overdue and due follow-ups. This one habit decides more bookings than any feature list." },
  { title: "Numbers a manager can trust",
    body: "Response time, contact rate, site visits booked and done, and bookings by source, per person and per campaign, without anyone compiling a report by hand. If the numbers need a spreadsheet, they will arrive late and be argued about." },
  { title: "Clear pricing and a quick start",
    body: "Published per-user prices, GST shown separately, and a trial you can run on your own leads. A CRM your team is using in the first week is worth more than a more powerful one that takes a month to set up.",
    link: { to: "/pricing", label: "See Arthaleads plans and pricing" } },
];

function Cell({ val }) {
  if (val === "y") return <Check className="w-4 h-4 mx-auto" style={{ color: "#22c55e" }} />;
  if (val === "p") return <span className="text-xs font-medium" style={{ color: "#b45309" }}>Partial</span>;
  return <X className="w-4 h-4 mx-auto" style={{ color: "#ef4444" }} />;
}

export default function Compare() {
  const { isDark } = usePublicTheme();
  const [query, setQuery] = useState("");

  useSEO({
    title:       "Arthaleads vs LeadRat, Sell.do & Kylas: CRM Comparison",
    description: "Compare Arthaleads with LeadRat, Sell.do, and Kylas. See how India’s real estate CRMs stack up on lead management, automation, analytics, and value.",
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
          {/* Below sm the five columns would crush into ~340px: scroll sideways instead. */}
          <div className="overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="rounded-2xl overflow-hidden min-w-[560px] sm:min-w-0" style={{ border: `1px solid ${cardBorder}` }}>
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
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-5 text-xs" style={{ color: softText }}>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "#22c55e" }} /> Full support</span>
            <span className="flex items-center gap-1.5"><span style={{ color: "#b45309", fontWeight: 600 }}>Partial</span> Limited</span>
            <span className="flex items-center gap-1.5"><X className="w-4 h-4" style={{ color: "#ef4444" }} /> Not available</span>
          </div>
          <p className="text-center text-xs mt-4 max-w-2xl mx-auto" style={{ color: softText }}>
            Comparison based on publicly available information as of May 2026. Competitor features may change —
            we keep this page updated. Spotted something out of date?{" "}
            <a href={waLink("Hi Arthaleads, something on your CRM comparison page looks out of date: ")} target="_blank" rel="noopener noreferrer"
              className="text-[#ff6b00] font-semibold hover:underline">Let us know</a>.
          </p>
        </div>
      </section>

      {/* How to choose */}
      <section className="py-16 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "#f1f1f1" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black mb-3 text-center" style={{ color: textColor }}>How to choose a real estate CRM</h2>
          <p className="text-base max-w-2xl mx-auto text-center mb-10" style={{ color: softText }}>
            A feature table only tells part of the story. These six questions decide whether a CRM actually helps your
            team close more bookings, whichever product you pick.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {CHOOSING.map((c, i) => (
              <div key={c.title} className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb" }}>
                <h3 className="font-bold text-lg mb-2" style={{ color: textColor }}>{i + 1}. {c.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: softText }}>{c.body}</p>
                {c.link && (
                  <Link to={c.link.to} className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold underline underline-offset-2" style={{ color: isDark ? "#fb923c" : "#c2410c" }}>
                    {c.link.label} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3" style={{ color: textColor }}>See the difference yourself</h2>
          <p className="text-base mb-6" style={{ color: softText }}>
            Start free — no credit card needed. Set up your pipeline in minutes.
          </p>
          <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS} className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25">
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
