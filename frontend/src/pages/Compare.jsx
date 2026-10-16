import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { waLink, CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { Check, X, Search, ArrowRight } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const COMPETITORS = ["Arthaleads", "Leadrat", "Sell.Do", "Kylas"];

// Every competitor mark was checked against that company's OWN website and
// help docs on 14 Oct 2026 (sources below the table, SOURCES). Rules:
//   y = their site says they have it, p = their site shows a limited version,
//   n = ONLY when their own page says they don't (e.g. a refund policy),
//   u = not stated on their site (never write "n" for "we couldn't find it").
// Re-check before changing a mark, and update CHECKED.
const CHECKED = "14 October 2026";
const SOURCES = [
  ["Leadrat", "https://leadrat.com/"],
  ["Sell.Do", "https://www.sell.do/"],
  ["Kylas", "https://kylas.io/"],
];
const CATEGORIES = [
  {
    name: "Lead Management",
    rows: [
      ["Facebook Lead Ads auto-import",      ["y", "y", "y", "y"]],
      ["Kanban lead pipeline",               ["y", "u", "u", "p"]],   // Kylas: kanban for deals
      ["Follow-up reminders",                ["y", "y", "y", "y"]],
      ["Duplicate lead detection",           ["y", "y", "y", "y"]],
      ["Bulk import & export",               ["y", "y", "y", "y"]],
      ["Lead activity timeline",             ["y", "y", "y", "y"]],
      ["Project-wise lead management",       ["y", "y", "y", "p"]],   // Kylas: custom pipelines, no project module
    ],
  },
  {
    name: "Automation & Integrations",
    rows: [
      ["WhatsApp Business API integration",  ["y", "y", "y", "y"]],
      ["Website form capture",               ["y", "y", "y", "y"]],
      ["Free WordPress plugin",              ["y", "u", "u", "u"]],
      ["Google Ads lead capture",            ["y", "y", "y", "y"]],
      ["Automatic lead assignment",          ["y", "y", "y", "p"]],   // Kylas: round-robin via a workflow webhook
      ["REST API & webhooks",                ["y", "y", "y", "y"]],
    ],
  },
  {
    name: "Team & Analytics",
    rows: [
      ["Role-based access control",          ["y", "y", "y", "y"]],
      ["Attendance tracking",                ["y", "y", "y", "y"]],   // Kylas: Field Sales add-on
      ["Team performance dashboard",         ["y", "y", "y", "y"]],
      ["Conversion & booking analytics",     ["y", "y", "y", "p"]],   // Kylas: general reports, no booking analytics
      ["Audit log",                          ["y", "p", "y", "u"]],   // Leadrat: activity log for assignment
    ],
  },
  {
    name: "Platform & Value",
    rows: [
      ["Built for Indian real estate",       ["y", "y", "y", "p"]],   // Kylas: general CRM with Indian portal connectors
      ["Mobile app",                         ["y", "y", "y", "y"]],
      ["Push notifications",                 ["y", "y", "y", "y"]],
      ["Prices published on the website",    ["y", "y", "n", "y"]],   // Sell.Do: "not a rate card", custom quote
      ["Free trial, no sales call",          ["y", "u", "u", "y"]],
      ["Refer & earn program",               ["y", "u", "u", "y"]],
      ["7-day money-back guarantee",         ["y", "n", "u", "u"]],   // Leadrat: "Zero Refund Policy"; Kylas: refunds only in set windows, no guarantee stated
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
  if (val === "y") return <span><Check aria-hidden="true" className="w-4 h-4 mx-auto" style={{ color: "#22c55e" }} /><span className="sr-only">Yes</span></span>;
  if (val === "p") return <span className="text-xs font-medium" style={{ color: "#b45309" }}>Partial</span>;
  if (val === "u") return <span className="text-sm" style={{ color: "#6b7280" }} title="Not stated on their website"><span aria-hidden="true">–</span><span className="sr-only">Not stated</span></span>;
  return <span><X aria-hidden="true" className="w-4 h-4 mx-auto" style={{ color: "#ef4444" }} /><span className="sr-only">No</span></span>;
}

export default function Compare() {
  const { isDark } = usePublicTheme();
  const [query, setQuery] = useState("");

  useSEO({
    title:       "Arthaleads vs Leadrat, Sell.Do & Kylas: CRM Comparison",
    description: "Compare Arthaleads with Leadrat, Sell.Do, and Kylas. See how India’s real estate CRMs stack up on lead management, automation, analytics, and value.",
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
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--brand-text)", background: isDark ? "rgba(255,107,0,0.04)" : "#fff7f0", borderBottom: `1px solid ${cardBorder}` }}>
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
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5 text-xs" style={{ color: softText }}>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "#22c55e" }} /> Full support</span>
            <span className="flex items-center gap-1.5"><span style={{ color: "#b45309", fontWeight: 600 }}>Partial</span> Limited</span>
            <span className="flex items-center gap-1.5"><X className="w-4 h-4" style={{ color: "#ef4444" }} /> Not offered, per their website</span>
            <span className="flex items-center gap-1.5"><span className="text-sm" style={{ color: "#6b7280" }}>–</span> Not stated on their website</span>
          </div>
          <p className="text-center text-xs mt-4 max-w-2xl mx-auto leading-relaxed" style={{ color: softText }}>
            Each competitor is marked from its own website and help pages as checked on {CHECKED}:{" "}
            {SOURCES.map(([n, u], i) => (
              <span key={n}>
                <a href={u} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{n}</a>{i < SOURCES.length - 1 ? ", " : ". "}
              </span>
            ))}
            Products change, and some features sit on higher plans or add-ons. Spotted something out of date?{" "}
            <a href={waLink("Hi Arthaleads, something on your CRM comparison page looks out of date: ")} target="_blank" rel="noopener noreferrer"
              className="font-semibold hover:underline" style={{ color: isDark ? "#fb923c" : "#c2410c" }}>Let us know</a> and we will correct it.
            {" "}Leadrat, Sell.Do and Kylas are trademarks of their owners; Arthaleads is not affiliated with them.
          </p>
        </div>
      </section>

      {/* One page per competitor, in depth */}
      <section className="pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black mb-6 text-center" style={{ color: textColor }}>Detailed comparisons</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              ["Sell.Do", "/compare/sell-do-alternative", "Sell.Do does not publish prices. How it quotes, what each includes, and which suits your team."],
              ["Leadrat", "/compare/leadrat-alternative", "Leadrat's per-user prices from 10 users, billing, refunds, and which suits your team."],
              ["Kylas", "/compare/kylas-alternative", "Kylas's flat fee against per-user pricing, its free plan, and which suits your team."],
            ].map(([name, to, body]) => (
              <Link key={to} to={to}
                className="group flex flex-col rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-orange-300"
                style={{ background: cardBg, borderColor: cardBorder }}>
                <h3 className="font-bold text-lg mb-2 group-hover:text-[color:var(--brand-text)] transition-colors" style={{ color: textColor }}>Arthaleads vs {name}</h3>
                <p className="text-sm leading-relaxed mb-3 flex-1" style={{ color: softText }}>{body}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5" style={{ color: isDark ? "#fb923c" : "#c2410c" }}>
                  Read the comparison <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
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
