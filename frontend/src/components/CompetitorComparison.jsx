// components/CompetitorComparison.jsx - the shared layout of every
// /compare/<competitor>-alternative page (Sell.Do, LeadRat, Kylas, ...), on the
// shared marketing theme (components/site/*).
//
// Each page file keeps its own useSEO({...}) call (scripts/seo-pages.mjs reads
// it from the page file) and passes the competitor's facts in `c`. Every
// statement about a competitor must come from that competitor's own website
// and carry its source link; never write that they lack something we could not
// confirm on their site. Re-check the facts and `checked` before editing.
import { Link } from "react-router-dom";
import { Check, ChevronRight, Receipt, FileText } from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card } from "./site/Site";
import { PageHero, FaqSection, ClosingCta } from "./site/Blocks";
import { PLAN_PRICING } from "../utils/plan";
import { Reveal, CountUp } from "./motion/Motion";

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

const linkCls = "font-semibold underline underline-offset-4";
const brandInk = { color: "var(--site-brand-ink)" };
const ourBorder = { borderColor: "rgba(255,107,0,0.45)" };

function Src({ href, className = "" }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${className}`} style={brandInk}>source</a>;
}

/** The hero visual: published prices side by side (coded UI, not a screenshot). */
function PriceCard({ c }) {
  return (
    <div className="relative mx-auto w-full max-w-[520px] px-3 sm:px-6 lg:px-0">
      <div aria-hidden="true" className="hero-glass" />
      <Card raised className="relative p-5 sm:p-7 text-left">
        <p className="text-sm font-semibold site-muted mb-4">{c.priceCardTitle || "Price per user, per month"}</p>
        <div className="rounded-2xl p-5 mb-3 border" style={{ ...ourBorder, background: "rgba(255,107,0,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-bold site-ink">Arthaleads</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#16a34a" }}><Check className="w-3.5 h-3.5" aria-hidden="true" /> Published</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[["Starter", PLAN_PRICING.starter.monthly], ["Growth", PLAN_PRICING.growth.monthly]].map(([n, v]) => (
              <div key={n}>
                <div className="text-xs site-muted mb-1">{n}, per user / month</div>
                <div className="font-display text-3xl font-extrabold site-ink">₹<CountUp value={String(v)} /></div>
              </div>
            ))}
          </div>
          <p className="text-xs site-muted mt-3">+ GST · 14-day free trial · no card</p>
        </div>
        <div className="rounded-2xl p-5 border" style={{ borderColor: "var(--site-line)", background: "var(--site-card-soft)" }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="font-display font-bold site-ink">{c.name}</span>
            <span className="text-xs font-semibold site-muted text-right">{c.priceCard.status}</span>
          </div>
          <div className="font-display text-2xl font-extrabold">{c.priceCard.headline}</div>
          <p className="text-xs site-muted mt-3">{c.priceCard.note} <Src href={c.pricing.url} /></p>
        </div>
      </Card>
      <div aria-hidden="true" className="hidden sm:flex absolute -bottom-5 left-2 lg:-left-6 items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold site-ink"
        style={{ background: "var(--site-card)", borderColor: "var(--site-line)", boxShadow: "var(--site-shadow)" }}>
        <Receipt className="w-3.5 h-3.5" style={{ color: "var(--site-brand)" }} /> {c.chip}
      </div>
    </div>
  );
}

function CheckList({ items, color = "var(--site-brand)" }) {
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[15px] leading-relaxed">
          <Check className="w-4 h-4 mt-1 shrink-0" style={{ color }} aria-hidden="true" />{t}
        </li>
      ))}
    </ul>
  );
}

export default function CompetitorComparison({ c }) {
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

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbLd }} />

      <PageHero
        crumb={
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center lg:justify-start gap-1.5 text-sm site-muted">
              <li><Link to="/compare" className="font-semibold hover:underline underline-offset-2" style={brandInk}>Compare</Link></li>
              <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
              <li aria-current="page">{c.name}</li>
            </ol>
          </nav>
        }
        title={<>{c.name} pricing and alternative: <span className="site-dim">Arthaleads vs {c.name}</span></>}
        lede={c.intro}
        visual={<PriceCard c={c} />}
        actions={[
          { label: "Book a Demo", to: "/book-demo" },
          { label: `Compare ${c.name} pricing`, href: "#pricing" },
        ]}
        trust={["Prices published", "Every claim sourced", "14-day free trial"]}
      >
        <p className="text-[13px] site-muted mt-4">{c.name} details checked on {c.checked}.</p>
      </PageHero>

      {/* What they cost */}
      <Section id="pricing" tone="tint">
        <Container>
          <SectionHeader eyebrow="Pricing" title={`What does ${c.name} cost?`} lede={c.pricingIntro} />
          <div className="grid md:grid-cols-2 gap-4">
            <Reveal className="flex min-w-0">
              <Card glow className="w-full p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--site-chip)" }}>
                    <FileText className="w-5 h-5 site-muted" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-xl font-bold site-ink">How {c.name} prices</h3>
                </div>
                <ul className="space-y-3">
                  {c.pricingBullets.map((t) => (
                    <li key={t} className="flex gap-3 text-[15px] leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full mt-2.5 shrink-0" style={{ background: "var(--site-muted)" }} />{t}
                    </li>
                  ))}
                </ul>
                <p className="text-xs site-muted mt-6">
                  Source: <a href={c.pricing.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={brandInk}>{c.pricing.label}</a>, {c.checked}.
                </p>
              </Card>
            </Reveal>
            <Reveal delay={120} className="flex min-w-0">
              <Card glow className="w-full p-6 sm:p-8" style={ourBorder}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
                    <Receipt className="w-5 h-5" style={brandInk} aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-xl font-bold site-ink">How Arthaleads prices</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[["Starter", PLAN_PRICING.starter], ["Growth", PLAN_PRICING.growth]].map(([n, p]) => (
                    <div key={n} className="rounded-2xl border p-4 min-w-0" style={{ borderColor: "var(--site-line)", background: "var(--site-card-soft)" }}>
                      <div className="text-sm font-semibold site-muted mb-1">{n}</div>
                      <div className="font-display text-2xl font-extrabold site-ink">₹{p.monthly}</div>
                      <div className="text-xs site-muted">per user / month</div>
                      <div className="text-xs mt-2">or ₹{p.annual.toLocaleString("en-IN")} a year</div>
                    </div>
                  ))}
                </div>
                <CheckList items={OUR_PRICING} />
                <p className="text-sm mt-6">
                  Example: a team of {team} on Growth pays ₹{growthTeam} a month plus GST.{" "}
                  <Link to="/pricing" className={linkCls} style={brandInk}>See full pricing</Link>
                </p>
              </Card>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Verdict */}
      <Section tone="white">
        <Container>
          <SectionHeader eyebrow="The verdict" title="Which one fits your team?" />
          <div className="grid md:grid-cols-2 gap-4">
            {[[`Choose ${c.name} if`, c.chooseThem, false], ["Choose Arthaleads if", c.chooseUs, true]].map(([title, items, ours], i) => (
              <Reveal key={title} delay={i * 120} className="flex min-w-0">
                <Card glow className="w-full p-6 sm:p-8" style={ours ? ourBorder : undefined}>
                  <h3 className="font-display text-xl font-bold site-ink mb-5">{title}</h3>
                  <CheckList items={items} color={ours ? "var(--site-brand)" : "var(--site-muted)"} />
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Side by side: a real <table> so crawlers read every cell */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="Side by side" title={`Arthaleads vs ${c.name}`} lede={`Each ${c.name} entry links to the page it comes from.`} />
          <div className="md:hidden space-y-3">
            {c.rows.map(([row, artha, them, s]) => (
              <Card key={row} className="p-5">
                <h3 className="font-display font-bold site-ink mb-3">{row}</h3>
                <p className="text-sm mb-2"><span className="font-semibold" style={brandInk}>Arthaleads:</span> {artha}</p>
                <p className="text-sm"><span className="font-semibold site-ink">{c.name}:</span> {them} <Src href={s} /></p>
              </Card>
            ))}
          </div>
          <Reveal className="hidden md:block">
            <Card raised className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--site-line)" }}>
                    <th scope="col" className="text-left p-5 w-[20%]"><span className="sr-only">Topic</span></th>
                    <th scope="col" className="text-left p-5 w-[40%] font-display font-bold" style={{ ...brandInk, background: "rgba(255,107,0,0.06)" }}>Arthaleads</th>
                    <th scope="col" className="text-left p-5 w-[40%] font-display font-bold site-ink">{c.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map(([row, artha, them, s], i) => (
                    <tr key={row} className="align-top" style={i < c.rows.length - 1 ? { borderBottom: "1px solid var(--site-line)" } : undefined}>
                      <th scope="row" className="text-left p-5 font-semibold site-ink">{row}</th>
                      <td className="p-5 leading-relaxed site-ink" style={{ background: "rgba(255,107,0,0.04)" }}>{artha}</td>
                      <td className="p-5 leading-relaxed">{them} <Src href={s} className="whitespace-nowrap" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Reveal>
        </Container>
      </Section>

      {/* Switching */}
      <Section tone="white">
        <Container>
          <SectionHeader eyebrow="Switching" title="What moving to Arthaleads looks like" />
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SWITCH_STEPS.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 90} className="min-w-0">
                <Card glow className="h-full p-6">
                  <span className="font-display w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold text-white mb-5"
                    style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{i + 1}</span>
                  <h3 className="font-display text-lg font-bold site-ink mb-2">{t}</h3>
                  <p className="text-[15px] leading-relaxed">{d}</p>
                </Card>
              </Reveal>
            ))}
          </ol>
          <div className="mt-10 space-y-2 text-sm leading-relaxed">
            <p>
              See every <Link to="/features" className={linkCls} style={brandInk}>feature</Link>,
              the full <Link to="/pricing" className={linkCls} style={brandInk}>pricing</Link>,
              how the <Link to="/whatsapp-crm" className={linkCls} style={brandInk}>WhatsApp CRM</Link> works,
              or our guide on <Link to="/compare" className={linkCls} style={brandInk}>how to choose a real estate CRM</Link>.
            </p>
            <p>
              Also compared:{" "}
              {COMPARISONS.filter(([n]) => n !== c.name).map(([n, to], i, arr) => (
                <span key={to}>
                  <Link to={to} className={linkCls} style={brandInk}>Arthaleads vs {n}</Link>{i < arr.length - 1 ? " and " : "."}
                </span>
              ))}
            </p>
          </div>
        </Container>
      </Section>

      <FaqSection title="Questions teams ask when comparing" items={c.faqs} />

      <ClosingCta title="Try Arthaleads" dim="on your own leads."
        body="Book a 30-minute demo and we will set it up on your real leads, or start the 14-day free trial yourself. Prices you can see today, no credit card." />

      {/* Trademark note */}
      <Section tone="white" className="!pt-0 !pb-14">
        <Container>
          <p className="text-xs site-muted leading-relaxed max-w-3xl">
            {c.name} is a trademark of its owner, used here only to identify the product being compared. Arthaleads is not
            affiliated with or endorsed by {c.name}. {c.name} information is taken from{" "}
            <a href={c.home.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{c.home.label}</a> and{" "}
            <a href={c.pricing.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{c.pricing.label}</a> as of {c.checked}.
          </p>
        </Container>
      </Section>
    </SitePage>
  );
}
