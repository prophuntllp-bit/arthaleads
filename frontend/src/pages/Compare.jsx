// pages/Compare.jsx - /compare, the Arthaleads / Sell.Do / Leadrat / Kylas comparison
// (retitled 30 Oct 2026: the 'best real estate CRM' query belongs to the five-CRM blog post), on
// the shared marketing theme (components/site/*).
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { waLink } from "../utils/crmLinks";
import { Check, X, Minus, Search, ArrowRight } from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card } from "../components/site/Site";
import { PageHero, FaqSection, ClosingCta } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";

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
      ["Google Ads lead capture",            ["e", "y", "y", "y"]],   // Arthaleads: Enterprise plan only
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

// Buyer's guide. Competitor figures are the ones already sourced and dated on
// SellDoAlternative.jsx, LeadratAlternative.jsx and KylasAlternative.jsx
// (checked 14 Oct 2026): keep the three in step, and never add a figure that
// is not on one of those pages first.
const KYLAS_FLAT = 12999;
const KYLAS_BREAK_EVEN = Math.floor(KYLAS_FLAT / PLAN_PRICING.growth.monthly);   // Growth is cheaper up to this many users
const inr = (n) => `₹${n.toLocaleString("en-IN")}`;

const WHO_FITS = [
  { name: "Arthaleads", fit: `Teams of 5 to 30 who sell on WhatsApp and want published per-user prices (${inr(PLAN_PRICING.starter.monthly)} or ${inr(PLAN_PRICING.growth.monthly)} plus GST), a 14-day free trial and a WhatsApp AI agent in the plan.` },
  { name: "Sell.Do", fit: "Large developers who want an established real estate suite and are happy to book a demo and work from a custom quote.", to: "/compare/sell-do-alternative" },
  { name: "Leadrat", fit: "Teams of 30 to 100 users who prefer one all-features plan billed annually, from ₹2,299 per user at 10 users down to ₹1,499 at 100.", to: "/compare/leadrat-alternative" },
  { name: "Kylas", fit: `Teams of ${KYLAS_BREAK_EVEN + 1} or more who would rather pay one flat fee (Elevate, ${inr(KYLAS_FLAT)} a month in India) for unlimited users, or start on a free plan.`, to: "/compare/kylas-alternative" },
];

const COST_ROWS = [
  ["Arthaleads", "Per user per month, five-user minimum", `${inr(PLAN_PRICING.starter.monthly)} (Starter) or ${inr(PLAN_PRICING.growth.monthly)} (Growth) per user, plus GST. Enterprise on quote.`, "14-day free trial, no credit card"],
  ["Sell.Do", "Per active user per month, five-user minimum", "Not published: a custom quote", "Book a demo first"],
  ["Leadrat", "Per user, one plan, billed annually, from 10 users", "₹2,299 per user per month at 10 users, ₹1,499 at 100", "Book a demo; no trial mentioned"],
  ["Kylas", "Flat monthly fee, unlimited users", `Elevate ${inr(KYLAS_FLAT)} a month in India; Embark free`, "Free plan; 7-day Elevate trial"],
];

const GUIDE_FAQS = [
  ["Which is the best real estate CRM in India?",
   `It depends on your team. For 5 to 30 people who work on WhatsApp and want published prices and a free trial, Arthaleads fits. Large developers who want a full suite on a custom quote often look at Sell.Do. Leadrat suits 30 to 100 users on one annual plan, and Kylas suits bigger teams that prefer a flat fee for unlimited users.`],
  ["How much does a real estate CRM cost in India?",
   `Published prices on the websites we checked on ${CHECKED} range from ${inr(PLAN_PRICING.starter.monthly)} per user per month (Arthaleads Starter) to ₹2,299 per user per month (Leadrat at 10 users, billed annually). Kylas charges a flat ${inr(KYLAS_FLAT)} a month for unlimited users, and Sell.Do quotes per team. Check whether GST is included and whether billing is monthly or yearly.`],
  ["What should a real estate CRM include?",
   "Automatic capture from Facebook, Instagram and Google lead ads, WhatsApp and your website, with the source on every lead; instant assignment and alerts; follow-up reminders; project-wise pipelines if you sell more than one project; and reports on response time, site visits and bookings by source and person."],
  ["Can I try a real estate CRM before paying?",
   "Arthaleads has a 14-day free trial of the Growth plan with no credit card. Kylas has a free plan and a 7-day trial of Elevate. Sell.Do and Leadrat start with a demo, according to their websites."],
];

// In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS.
const GUIDE_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": GUIDE_FAQS.map(([q, a]) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
}).replace(/</g, "\\u003c");

// --site-amber lives in styles.css (light #b45309, dark #fbbf24); the fallback is the old amber.
const PARTIAL = "var(--site-amber, #d97706)";
const brandInk = { color: "var(--site-brand-ink)" };
const COLS = "minmax(0,1.6fr) repeat(4, minmax(0,1fr))";

function Cell({ val }) {
  if (val === "y") return <span><Check aria-hidden="true" className="w-4 h-4 mx-auto" style={{ color: "#16a34a" }} /><span className="sr-only">Yes</span></span>;
  if (val === "e") return <span className="text-xs font-semibold" style={{ color: "var(--site-green)" }}>Enterprise</span>;
  if (val === "p") return <span className="text-xs font-semibold" style={{ color: PARTIAL }}>Partial</span>;
  if (val === "u") return <span className="site-muted" title="Not stated on their website"><Minus aria-hidden="true" className="w-4 h-4 mx-auto" /><span className="sr-only">Not stated</span></span>;
  return <span><X aria-hidden="true" className="w-4 h-4 mx-auto" style={{ color: "#ef4444" }} /><span className="sr-only">No</span></span>;
}

export default function Compare() {
  const [query, setQuery] = useState("");

  useSEO({
    title:       "Arthaleads vs Sell.Do, Leadrat and Kylas: CRM Comparison",
    description: "Arthaleads, Sell.Do, Leadrat and Kylas side by side: features, pricing and free trials, and which real estate CRM suits which team in India.",
    canonical:   "https://www.arthaleads.com/compare",
  });

  const filtered = useMemo(() => {
    if (!query.trim()) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES
      .map((c) => ({ ...c, rows: c.rows.filter(([label]) => label.toLowerCase().includes(q)) }))
      .filter((c) => c.rows.length > 0);
  }, [query]);

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: GUIDE_JSONLD }} />

      <PageHero
        eyebrow="Real estate CRM comparison"
        title={<>Arthaleads, Sell.Do, Leadrat and Kylas <span className="site-dim">compared</span></>}
        lede="Who each CRM suits, what it costs, and a feature-by-feature comparison of Arthaleads, Sell.Do, Leadrat and Kylas, sourced from their own websites."
        actions={[
          { label: "See the comparison", href: "#feature-table" },
          { label: "Book a Demo", to: "/book-demo" },
        ]}
        trust={[`Checked ${CHECKED}`, "Sources linked", "Four CRMs side by side"]}
      />

      {/* Quick answer: who each one suits */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="The short answer" title="It depends on your team"
            lede="No CRM is best for everyone. This is who each one fits, based on how it is priced and sold." />
          <div className="grid sm:grid-cols-2 gap-4">
            {WHO_FITS.map((w, i) => (
              <Reveal key={w.name} delay={(i % 2) * 90} className="min-w-0 flex">
                <Card glow className="w-full p-6 flex flex-col" style={i === 0 ? { borderColor: "rgba(255,107,0,0.45)" } : undefined}>
                  <h3 className="font-display text-lg font-bold site-ink mb-2" style={i === 0 ? brandInk : undefined}>{w.name}</h3>
                  <p className="text-[15px] leading-relaxed flex-1">{w.fit}</p>
                  {w.to && <Link to={w.to} className="site-link mt-4 text-sm">Arthaleads vs {w.name} <ArrowRight className="w-4 h-4" /></Link>}
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Feature comparison */}
      <Section tone="white" id="feature-table">
        <Container narrow>
          <SectionHeader eyebrow="Feature by feature" title="Arthaleads, Leadrat, Sell.Do and Kylas" />
          <div className="relative mb-6">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 site-muted" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search a feature"
              placeholder="Search a feature (e.g. WhatsApp, API, analytics)…"
              className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition focus:ring-2 focus:ring-[color:var(--site-brand)]"
              style={{ background: "var(--site-card)", border: "1px solid var(--site-field-line)", color: "var(--site-ink)" }} />
          </div>

          {/* Below sm the five columns would crush into ~340px: scroll sideways instead. */}
          <div className="relative overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0">
            <Card raised className="min-w-[560px] sm:min-w-0">
              <div className="grid sm:sticky site-sticky-top z-10 rounded-t-[20px]"
                style={{ gridTemplateColumns: COLS, background: "var(--site-card)", borderBottom: "1px solid var(--site-line)" }}>
                <div className="px-5 py-4 text-xs font-semibold site-muted flex items-center">Feature</div>
                {COMPETITORS.map((c, i) => (
                  <div key={c} className={`px-2 py-4 text-center text-[13px] font-display font-bold flex items-center justify-center ${i ? "site-ink" : ""}`}
                    style={i === 0 ? { ...brandInk, background: "rgba(255,107,0,0.07)" } : undefined}>{c}</div>
                ))}
              </div>

              {filtered.length === 0 && (
                <p className="px-5 py-10 text-center text-sm site-muted">No features match "{query}". Try another search.</p>
              )}

              {filtered.map((cat, ci) => (
                <div key={cat.name}>
                  <div className="px-5 py-2.5 text-xs font-semibold" style={{ ...brandInk, background: "rgba(255,107,0,0.05)", borderBottom: "1px solid var(--site-line)" }}>
                    {cat.name}
                  </div>
                  {cat.rows.map(([label, vals], ri) => {
                    const last = ci === filtered.length - 1 && ri === cat.rows.length - 1;
                    return (
                      <div key={label} className="grid items-center" style={{ gridTemplateColumns: COLS, borderBottom: last ? undefined : "1px solid var(--site-line)" }}>
                        <div className="px-5 py-3.5 text-sm site-ink">{label}</div>
                        {vals.map((v, i) => (
                          <div key={i} className="px-2 py-3.5 text-center self-stretch flex items-center justify-center" style={i === 0 ? { background: "rgba(255,107,0,0.04)" } : undefined}>
                            <Cell val={v} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </Card>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs site-muted">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "#16a34a" }} /> Full support</span>
            <span className="flex items-center gap-1.5"><span className="font-semibold" style={{ color: PARTIAL }}>Partial</span> Limited</span>
            <span className="flex items-center gap-1.5"><X className="w-4 h-4" style={{ color: "#ef4444" }} /> Not offered, per their website</span>
            <span className="flex items-center gap-1.5"><Minus className="w-4 h-4" aria-hidden="true" /> Not stated on their website</span>
          </div>
          <p className="text-center text-xs mt-4 max-w-2xl mx-auto leading-relaxed site-muted">
            Each competitor is marked from its own website and help pages as checked on {CHECKED}:{" "}
            {SOURCES.map(([n, u], i) => (
              <span key={n}>
                <a href={u} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{n}</a>{i < SOURCES.length - 1 ? ", " : ". "}
              </span>
            ))}
            Products change, and some features sit on higher plans or add-ons. Spotted something out of date?{" "}
            <a href={waLink("Hi Arthaleads, something on your CRM comparison page looks out of date: ")} target="_blank" rel="noopener noreferrer"
              className="font-semibold hover:underline" style={brandInk}>Let us know</a> and we will correct it.
            {" "}Leadrat, Sell.Do and Kylas are trademarks of their owners; Arthaleads is not affiliated with them.
          </p>
        </Container>
      </Section>

      {/* One page per competitor, in depth */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="In depth" title="Detailed comparisons" />
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              ["Sell.Do", "/compare/sell-do-alternative", "Sell.Do does not publish prices. How it quotes, what each includes, and which suits your team."],
              ["Leadrat", "/compare/leadrat-alternative", "Leadrat's per-user prices from 10 users, billing, refunds, and which suits your team."],
              ["Kylas", "/compare/kylas-alternative", "Kylas's flat fee against per-user pricing, its free plan, and which suits your team."],
            ].map(([name, to, body], i) => (
              <Reveal key={to} delay={i * 90} className="min-w-0 flex">
                <Card as={Link} to={to} glow className="group w-full p-6 flex flex-col transition-transform duration-300 hover:-translate-y-1">
                  <h3 className="font-display text-lg font-bold site-ink mb-2">Arthaleads vs {name}</h3>
                  <p className="text-[15px] leading-relaxed mb-4 flex-1">{body}</p>
                  <span className="site-link text-sm">Read the comparison <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></span>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* How to choose */}
      <Section tone="white">
        <Container>
          <SectionHeader eyebrow="How to choose" title="Six questions that decide it"
            lede={<>A feature table only tells part of the story. These six questions decide whether a CRM actually helps your team close more bookings, whichever product you pick. For a wider look that adds Privyr, see <Link to="/blog/best-real-estate-crm-software-india" className="font-semibold site-ink underline underline-offset-4">five real estate CRMs compared</Link>.</>} />
          <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHOOSING.map((c, i) => (
              <Reveal as="li" key={c.title} delay={(i % 3) * 80} className="min-w-0 flex">
                <Card glow className="w-full p-6 flex flex-col">
                  <span className="font-display w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold text-white mb-5"
                    style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{i + 1}</span>
                  <h3 className="font-display text-lg font-bold site-ink mb-2">{c.title}</h3>
                  <p className="text-[15px] leading-relaxed flex-1">{c.body}</p>
                  {c.link && <Link to={c.link.to} className="site-link mt-4 text-sm">{c.link.label} <ArrowRight className="w-4 h-4" /></Link>}
                </Card>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* What it costs */}
      <Section tone="tint">
        <Container narrow>
          <SectionHeader eyebrow="Pricing" title="What does a real estate CRM cost in India?"
            lede={`List prices as published on each company's website on ${CHECKED}. Some prices exclude GST, and billing may be monthly or yearly.`} />
          <Card raised className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm border-collapse">
              <caption className="sr-only">Real estate CRM prices in India compared</caption>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--site-line)" }}>
                  {["CRM", "How it is priced", "Published price", "Try before you buy"].map((h) => (
                    <th key={h} scope="col" className="text-left font-semibold px-5 py-4 site-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COST_ROWS.map(([name, model, price, trial], i) => (
                  <tr key={name} className="align-top" style={{ borderBottom: i < COST_ROWS.length - 1 ? "1px solid var(--site-line)" : undefined, background: i === 0 ? "rgba(255,107,0,0.05)" : undefined }}>
                    <th scope="row" className="text-left font-display font-bold px-5 py-4" style={i === 0 ? brandInk : { color: "var(--site-ink)" }}>{name}</th>
                    <td className="px-5 py-4 leading-relaxed">{model}</td>
                    <td className="px-5 py-4 leading-relaxed site-ink">{price}</td>
                    <td className="px-5 py-4 leading-relaxed">{trial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Container>
      </Section>

      {/* Buyer FAQs (same text as GUIDE_JSONLD) */}
      <FaqSection title="Questions buyers ask" items={GUIDE_FAQS} tone="white" />

      <ClosingCta title="See the difference" dim="on your own leads."
        body="Book a 30-minute demo and compare for yourself with your real leads, or start the 14-day free trial. No credit card needed." tone="tint" />
    </SitePage>
  );
}
