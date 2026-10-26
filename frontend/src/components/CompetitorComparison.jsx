// components/CompetitorComparison.jsx - the shared layout of every
// /compare/<competitor>-alternative page (Sell.Do, LeadRat, Kylas, ...).
//
// Each page file keeps its own useSEO({...}) call (scripts/seo-pages.mjs reads
// it from the page file) and passes the competitor's facts in `c`. Every
// statement about a competitor must come from that competitor's own website
// and carry its source link; never write that they lack something we could not
// confirm on their site. Re-check the facts and `checked` before editing.
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Receipt, FileText, CalendarCheck2 } from "lucide-react";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import { waButtonClass } from "./WhatsAppLogo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { PLAN_PRICING } from "../utils/plan";
import { Reveal, Spotlight, Magnetic, CountUp } from "./motion/Motion";

const OUR_PRICING = [
  "Prices on the website, GST added on top. Enterprise is on quote.",
  "Minimum 5 users. Annual billing gives about two months free.",
  "Growth includes the WhatsApp AI agent, lead scoring and AI-written replies.",
  "WhatsApp message charges from Meta come from a prepaid credit balance, with a statement of every charge.",
  "14-day free trial on your own leads, no credit card.",
];

const SWITCH_STEPS = [
  ["Start the free trial", "14 days on the Growth plan, no credit card. Invite your team on day one."],
  ["Bring your leads", "Import your existing leads from a CSV or Excel export, with their source and stage."],
  ["Connect your sources", "Facebook and Instagram lead ads, your website (free WordPress plugin) and your WhatsApp Business number. Google Ads lead forms on Enterprise."],
  ["Go live", "Routing rules give every new lead an owner, the WhatsApp AI agent starts replying, and your team works from one list."],
];

/**
 * c = {
 *   name, pageUrl, checked,
 *   home: { url, label }, pricing: { url, label },
 *   intro,                                    hero paragraph
 *   priceCard: { status, headline, note },    the competitor half of the hero card
 *   priceCardTitle?,                          defaults to "Price per user, per month"
 *   chip,                                     floating line under the hero card
 *   pricingIntro, pricingBullets,             "What does X cost?"
 *   exampleTeam?,                             team size for the example line (default 5)
 *   chooseThem, chooseUs, rows: [[row, artha, them, src]], faqs: [[q, a]],
 * }
 */
// Every comparison page links to the others, so each one is reachable from its siblings.
const COMPARISONS = [
  ["Sell.Do", "/compare/sell-do-alternative"],
  ["Leadrat", "/compare/leadrat-alternative"],
  ["Kylas", "/compare/kylas-alternative"],
];

export default function CompetitorComparison({ c }) {
  const { isDark } = usePublicTheme();

  const bg = isDark ? "#0d0d1a" : "#ffffff";
  const altBg = isDark ? "#0a0a14" : "#f9fafb";
  const text = isDark ? "#ffffff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.62)" : "#4b5563";
  const muted = isDark ? "rgba(255,255,255,0.5)" : "#6b7280";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const linkClr = isDark ? "#fb923c" : "#c2410c";
  const orange = "#ff6b00";

  const faqLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }).replace(/</g, "\\u003c");
  const crumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.arthaleads.com/" },
      { "@type": "ListItem", position: 2, name: "Compare", item: "https://www.arthaleads.com/compare" },
      { "@type": "ListItem", position: 3, name: `${c.name} alternative`, item: c.pageUrl },
    ],
  }).replace(/</g, "\\u003c");
  const team = c.exampleTeam || 5;
  const growthTeam = (PLAN_PRICING.growth.monthly * team).toLocaleString("en-IN");
  const src = (s, cls = "") => (
    <a href={s} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${cls}`} style={{ color: linkClr }}>source</a>
  );

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbLd }} />
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-16 overflow-hidden"
        style={{ background: isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 55%, #fffbeb 100%)" }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl motion-safe:animate-[aurora-drift_18s_ease-in-out_infinite]"
            style={{ background: "rgba(255,107,0,0.12)" }} />
          <div className="absolute -bottom-32 right-0 w-[26rem] h-[26rem] rounded-full blur-3xl motion-safe:animate-[aurora-drift_22s_ease-in-out_infinite_reverse]"
            style={{ background: isDark ? "rgba(255,170,0,0.08)" : "rgba(255,170,0,0.12)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex items-center gap-1.5 text-sm" style={{ color: muted }}>
                <li><Link to="/compare" className="hover:underline underline-offset-2" style={{ color: linkClr }}>Compare</Link></li>
                <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
                <li aria-current="page">{c.name}</li>
              </ol>
            </nav>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.08] mb-6" style={{ color: text, textWrap: "balance" }}>
              {/* One copy of the words: an sr-only twin made crawlers read the heading twice. */}
              <span>
                {[c.name, "pricing", "and", "alternative:"].map((w, i) => (
                  <span key={w + i} className="word-rise" style={{ animationDelay: `${80 + i * 90}ms` }}>{w}&nbsp;</span>
                ))}
                <span className="block">
                  {["Arthaleads", "vs", c.name].map((w, i) => (
                    <span key={w + i} className="word-rise text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00] pb-1"
                      style={{ animationDelay: `${440 + i * 90}ms` }}>{w}{i < 2 ? " " : ""}</span>
                  ))}
                </span>
              </span>
            </h1>
            <p className="text-lg leading-relaxed mb-8 max-w-xl" style={{ color: soft }}>{c.intro}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Magnetic>
                <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                  className="shine-btn w-full inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/45 transition-shadow duration-200"
                  style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                  Start 14-day free trial <ArrowRight className="w-4 h-4" />
                </a>
              </Magnetic>
              <a href="#pricing"
                className="inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
                style={{ borderColor: cardBorder, color: text, background: cardBg }}>
                Compare pricing
              </a>
            </div>
            <p className="text-sm mt-5" style={{ color: muted }}>{c.name} details checked on {c.checked}.</p>
          </div>

          {/* Price, side by side */}
          <Reveal delay={250} y={32} className="relative">
            <div className="rounded-3xl border shadow-2xl p-6 sm:p-8 motion-safe:animate-[float-soft_7s_ease-in-out_infinite]"
              style={{ background: isDark ? "#14142a" : "#ffffff", borderColor: cardBorder }}>
              <p className="text-sm font-semibold mb-5" style={{ color: muted }}>{c.priceCardTitle || "Price per user, per month"}</p>
              <div className="rounded-2xl p-5 mb-4 border" style={{ borderColor: "rgba(255,107,0,0.35)", background: isDark ? "rgba(255,107,0,0.08)" : "#fff7f0" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold" style={{ color: text }}>Arthaleads</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: isDark ? "#4ade80" : "#15803d" }}>
                    <Check className="w-3.5 h-3.5" /> Published
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[["Starter", PLAN_PRICING.starter.monthly], ["Growth", PLAN_PRICING.growth.monthly]].map(([n, v]) => (
                    <div key={n}>
                      <div className="text-xs mb-1" style={{ color: muted }}>{n}, per user / month</div>
                      <div className="text-3xl font-black" style={{ color: text }}>₹<CountUp value={String(v)} /></div>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3" style={{ color: muted }}>+ GST · 14-day free trial · no card</p>
              </div>
              <div className="rounded-2xl p-5 border" style={{ borderColor: cardBorder, background: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold" style={{ color: text }}>{c.name}</span>
                  <span className="text-xs font-semibold" style={{ color: muted }}>{c.priceCard.status}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: soft }}>{c.priceCard.headline}</div>
                <p className="text-xs mt-3" style={{ color: muted }}>{c.priceCard.note} {src(c.pricing.url)}</p>
              </div>
            </div>
            <div aria-hidden="true" className="hidden sm:flex absolute -bottom-5 -left-4 items-center gap-2 px-3.5 py-2 rounded-xl border shadow-lg text-xs font-semibold motion-safe:animate-[float-soft_6s_ease-in-out_infinite]"
              style={{ background: isDark ? "#16162a" : "#ffffff", borderColor: cardBorder, color: text, animationDelay: "0.8s" }}>
              <Receipt className="w-3.5 h-3.5" style={{ color: orange }} /> {c.chip}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── What they cost ── */}
      <section id="pricing" className="py-16 scroll-mt-20" style={{ background: altBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-3xl font-black mb-3" style={{ color: text }}>What does {c.name} cost?</h2>
            <p className="text-base leading-relaxed" style={{ color: soft }}>{c.pricingIntro}</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal className="flex">
              <Spotlight className="w-full rounded-2xl border p-7" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6" }}>
                    <FileText className="w-5 h-5" style={{ color: soft }} />
                  </span>
                  <h3 className="text-xl font-bold" style={{ color: text }}>How {c.name} prices</h3>
                </div>
                <ul className="space-y-3">
                  {c.pricingBullets.map((t) => (
                    <li key={t} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: soft }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-2.5 shrink-0" style={{ background: muted }} />{t}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-5" style={{ color: muted }}>
                  Source:{" "}
                  <a href={c.pricing.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: linkClr }}>{c.pricing.label}</a>, {c.checked}.
                </p>
              </Spotlight>
            </Reveal>
            <Reveal delay={120} className="flex">
              <Spotlight className="w-full rounded-2xl border p-7" style={{ background: cardBg, borderColor: "rgba(255,107,0,0.45)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? "rgba(255,107,0,0.15)" : "#fff3ea" }}>
                    <Receipt className="w-5 h-5" style={{ color: orange }} />
                  </span>
                  <h3 className="text-xl font-bold" style={{ color: text }}>How Arthaleads prices</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {[["Starter", PLAN_PRICING.starter], ["Growth", PLAN_PRICING.growth]].map(([n, p]) => (
                    <div key={n} className="rounded-xl border p-4" style={{ borderColor: cardBorder }}>
                      <div className="text-sm font-semibold mb-1" style={{ color: muted }}>{n}</div>
                      <div className="text-2xl font-black" style={{ color: text }}>₹{p.monthly}</div>
                      <div className="text-xs" style={{ color: muted }}>per user / month</div>
                      <div className="text-xs mt-2" style={{ color: soft }}>or ₹{p.annual.toLocaleString("en-IN")} a year</div>
                    </div>
                  ))}
                </div>
                <ul className="space-y-3">
                  {OUR_PRICING.map((t) => (
                    <li key={t} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: soft }}>
                      <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: orange }} />{t}
                    </li>
                  ))}
                </ul>
                <p className="text-sm mt-5" style={{ color: soft }}>
                  Example: a team of {team} on Growth pays ₹{growthTeam} a month plus GST.{" "}
                  <Link to="/pricing" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>See full pricing</Link>
                </p>
              </Spotlight>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Verdict ── */}
      <section className="py-14" style={{ background: bg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-8 text-center" style={{ color: text }}>Which one fits your team?</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            {[[`Choose ${c.name} if`, c.chooseThem, muted], ["Choose Arthaleads if", c.chooseUs, orange]].map(([title, items, accent], i) => (
              <Reveal key={title} delay={i * 120} className="flex">
                <Spotlight className="w-full rounded-2xl border p-7 transition-transform duration-300 hover:-translate-y-1"
                  style={{ background: cardBg, borderColor: i === 1 ? "rgba(255,107,0,0.45)" : cardBorder }}>
                  <h3 className="text-xl font-bold mb-4" style={{ color: text }}>{title}</h3>
                  <ul className="space-y-3">
                    {items.map((t) => (
                      <li key={t} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: soft }}>
                        <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: accent }} />{t}
                      </li>
                    ))}
                  </ul>
                </Spotlight>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Side by side ── */}
      <section className="py-14" style={{ background: altBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-3" style={{ color: text }}>Arthaleads vs {c.name}, side by side</h2>
            <p className="text-base mb-8" style={{ color: soft }}>Each {c.name} entry links to the page it comes from.</p>
          </Reveal>

          {/* Phones: one card per row */}
          <div className="md:hidden space-y-3">
            {c.rows.map(([row, artha, them, s], i) => (
              <Reveal key={row} delay={i * 40} y={14} className="rounded-2xl border p-4" style={{ background: cardBg, borderColor: cardBorder }}>
                <h3 className="font-semibold mb-2" style={{ color: text }}>{row}</h3>
                <p className="text-sm mb-1.5" style={{ color: soft }}><span className="font-semibold" style={{ color: text }}>Arthaleads:</span> {artha}</p>
                <p className="text-sm" style={{ color: soft }}><span className="font-semibold" style={{ color: text }}>{c.name}:</span> {them} {src(s)}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100} className="hidden md:block rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <th scope="col" className="text-left p-4 w-[20%] font-semibold" style={{ color: muted }}><span className="sr-only">Topic</span></th>
                  <th scope="col" className="text-left p-4 w-[40%] font-bold" style={{ color: orange }}>Arthaleads</th>
                  <th scope="col" className="text-left p-4 w-[40%] font-bold" style={{ color: text }}>{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map(([row, artha, them, s]) => (
                  <tr key={row} className="align-top transition-colors duration-200 hover:bg-[#ff6b00]/[0.04]" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <th scope="row" className="text-left p-4 font-semibold" style={{ color: text }}>{row}</th>
                    <td className="p-4 leading-relaxed" style={{ color: soft }}>{artha}</td>
                    <td className="p-4 leading-relaxed" style={{ color: soft }}>{them} {src(s, "whitespace-nowrap")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* ── Switching ── */}
      <section className="py-14" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-5" style={{ color: text }}>What moving to Arthaleads looks like</h2>
          </Reveal>
          <ol className="space-y-4">
            {SWITCH_STEPS.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 90} className="flex gap-4">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: isDark ? "rgba(255,107,0,0.15)" : "#fff3ea", color: linkClr }}>{i + 1}</span>
                <div>
                  <h3 className="font-bold mb-1" style={{ color: text }}>{t}</h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: soft }}>{d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={200}>
            <p className="text-sm mt-8" style={{ color: soft }}>
              See every <Link to="/features" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>feature</Link>,
              the full <Link to="/pricing" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>pricing</Link>,
              how the <Link to="/whatsapp-crm" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>WhatsApp CRM</Link> works,
              or our guide on <Link to="/compare" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>how to choose a real estate CRM</Link>.
            </p>
            <p className="text-sm mt-3" style={{ color: soft }}>
              Also compared:{" "}
              {COMPARISONS.filter(([n]) => n !== c.name).map(([n, to], i, arr) => (
                <span key={to}>
                  <Link to={to} className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>Arthaleads vs {n}</Link>{i < arr.length - 1 ? " and " : "."}
                </span>
              ))}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal><h2 className="text-3xl font-black mb-8" style={{ color: text }}>Questions teams ask when comparing</h2></Reveal>
          <div className="space-y-6">
            {c.faqs.map(([q, a], i) => (
              <Reveal key={q} delay={i * 60} y={16}>
                <h3 className="font-bold text-lg mb-2" style={{ color: text }}>{q}</h3>
                <p className="text-base leading-relaxed" style={{ color: soft }}>{a}</p>
              </Reveal>
            ))}
          </div>
          <p className="text-xs mt-10 leading-relaxed" style={{ color: muted }}>
            {c.name} is a trademark of its owner, used here only to identify the product being compared. Arthaleads is not
            affiliated with or endorsed by {c.name}. {c.name} information is taken from{" "}
            <a href={c.home.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{c.home.label}</a> and{" "}
            <a href={c.pricing.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{c.pricing.label}</a> as of {c.checked}.
          </p>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="py-20 text-center" style={{ background: bg }}>
        <Reveal className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-4" style={{ color: text }}>Try Arthaleads on your own leads</h2>
          <p className="text-base mb-8" style={{ color: soft }}>Fourteen days, no credit card, prices you can see today.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Magnetic>
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                className="shine-btn inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-shadow duration-200"
                style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                Start free trial <ArrowRight className="w-4 h-4" />
              </a>
            </Magnetic>
            <Link to="/book-demo" className={waButtonClass(isDark)}>
              <CalendarCheck2 className="w-[18px] h-[18px]" aria-hidden="true" /> Book a demo
            </Link>
          </div>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}
