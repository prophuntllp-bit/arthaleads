// pages/Pricing.jsx - /pricing on the shared marketing theme (components/site/*).
// Plans come from data/plans.js and prices from utils/plan.js; the comparison
// table restates both, so change a plan there and here together.
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { Reveal } from "../components/motion/Motion";
import { Check, Users, ArrowRight, Minus, CircleCheck } from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, FaqSection, ClosingCta } from "../components/site/Blocks";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING, formatINR, freeMonths, withGST } from "../utils/plan";
import { PLANS } from "../data/plans";

const FAQS = [
  ["Is there a free trial?", "Yes. The Growth plan comes with a 14-day free trial that includes every Growth feature, with 1 GB of file storage during the trial (15 GB once you subscribe to Growth). No credit card is required, and you can upgrade or cancel anytime."],
  ["How is pricing calculated?", "Pricing is per team member, per month, with a five-seat minimum on every plan. Starter is ₹599 and Growth is ₹999 per user per month, plus 18% GST. There is no setup fee. Enterprise is custom-quoted for large or multi-branch organisations."],
  ["Is there a setup or onboarding fee?", "No. There is no setup fee on any plan. You can start on a 14-day free trial and only pay the per-seat price once you subscribe."],
  ["Can I change plans later?", "Absolutely. You can upgrade or downgrade at any time. When you upgrade, you get instant access to the new features; when you downgrade, the change applies from your next billing cycle."],
  ["What happens to my data if I cancel?", "Your data stays yours. On Growth and Enterprise you can export all your leads as CSV or Excel at any time. After cancellation we retain your data per our Refund & Cancellation Policy before secure deletion."],
  ["Do you offer annual billing discounts?", "Yes. Annual billing is ten months’ rate for twelve months — two months free, a saving of 16.7%. Starter is ₹5,990 per user per year and Growth is ₹9,990 per user per year."],
  ["Which payment methods do you accept?", "We accept all major credit/debit cards, UPI, and net banking for Indian businesses. Enterprise customers can also pay via invoice."],
];

// In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS.
const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(([q, a]) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
}).replace(/</g, "\\u003c");

// Plan comparison table: a real <table>, so search engines and AI answers can
// read the plans side by side. Every row restates data/plans.js and
// PLAN_PRICING: change a plan there, change it here. true = included,
// false = not on this plan, a string = the value shown.
const inr = (n) => `₹${n.toLocaleString("en-IN")}`;
const COMPARE_ROWS = [
  ["Price per user per month", `${inr(PLAN_PRICING.starter.monthly)} + GST`, `${inr(PLAN_PRICING.growth.monthly)} + GST`, "Custom quote"],
  ["Price per user per year (2 months free)", `${inr(PLAN_PRICING.starter.annual)} + GST`, `${inr(PLAN_PRICING.growth.annual)} + GST`, "Custom quote"],
  ["Team size", "5 to 10 users", "5 to 30 users", "25+ users"],
  ["Projects", "2", "Unlimited", "Unlimited"],
  ["File storage", "2 GB", "15 GB", "100 GB"],
  ["Call recordings kept", "30 days", "90 days", "1 year"],
  ["Facebook and Instagram lead ads import", true, true, true],
  ["WhatsApp chats, website forms, CSV import", true, true, true],
  ["Kanban pipeline and follow-up reminders", true, true, true],
  ["Role-based access (admin, manager, agent)", true, true, true],
  ["WhatsApp AI agent, 24/7 replies", false, true, true],
  ["WhatsApp templates and campaigns", false, true, true],
  ["Duplicate detection and round-robin assignment", false, true, true],
  ["Bulk lead export", false, true, true],
  ["Attendance and team performance dashboard", false, true, true],
  ["Conversion and booking analytics", false, true, true],
  ["AI lead scoring, Hot Today and the Artha AI assistant", false, true, true],
  ["Bookings, invoices and Meta Conversions API", false, true, true],
  ["Google Ads leads", false, false, true],
  ["Webhooks and API access", false, false, true],
  ["Vistrow Voice AI calling", false, false, true],
  ["Custom branding and reporting", false, false, true],
  ["Support", "Email", "Priority", "Dedicated account manager"],
];

const planName = (id) => PLANS.find((p) => p.id === id).name;

export default function Pricing() {
  const [members, setMembers] = useState(5);
  const [billing, setBilling] = useState("monthly");

  useSEO({
    title:       "Pricing | Arthaleads Real Estate CRM Plans",
    description: "Simple, transparent Arthaleads pricing. Starter, Growth and Enterprise plans for real estate teams of every size. 14-day free trial, no credit card needed.",
    canonical:   "https://www.arthaleads.com/pricing",
  });

  // Interactive: which plan does the chosen team size land in?
  const recommended = useMemo(() => {
    if (members <= PLAN_PRICING.starter.maxSeats) return "starter";
    if (members <= PLAN_PRICING.growth.maxSeats)  return "growth";
    return "enterprise";
  }, [members]);

  // What the chosen team would pay on the recommended plan (five-seat minimum).
  const estimate = useMemo(() => {
    const price = PLAN_PRICING[recommended];
    if (!price || price.custom) return null;
    const seats = Math.max(members, price.minSeats);
    const base = billing === "annual" ? price.annual * seats : price.monthly * seats;
    return { seats, base, gst: withGST(base) - base, total: withGST(base), perMonth: billing === "annual" ? Math.round(base / 12) : base };
  }, [members, recommended, billing]);

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />

      <PageHero
        eyebrow="Pricing"
        title={<>Plans for every <span className="site-dim">team size</span></>}
        lede="Simple per-seat pricing. No setup fee and no hidden charges: you pay only for the team members you add."
        actions={null}
      >
        {/* Team-size calculator */}
        <Card raised className="mt-10 p-5 sm:p-7 text-left">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="flex items-center gap-2 text-sm font-semibold site-ink">
              <Users className="w-4 h-4" style={{ color: "var(--site-brand)" }} aria-hidden="true" /> How big is your team?
            </p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-extrabold tabular-nums" style={{ color: "var(--site-brand-ink)" }}>{members >= 50 ? "50+" : members}</span>
              <span className="text-sm site-muted">members</span>
            </p>
          </div>
          <input type="range" min={1} max={50} value={members} onChange={(e) => setMembers(Number(e.target.value))}
            className="w-full accent-[#ff6b00] cursor-pointer" aria-label="Team size" />
          <div className="flex justify-between mt-1.5 text-[11px] site-muted" aria-hidden="true">
            <span>1</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50+</span>
          </div>

          <div className="mt-5 pt-5 grid sm:grid-cols-[1fr_auto] gap-4 items-end" style={{ borderTop: "1px solid var(--site-line)" }}>
            <div className="min-w-0">
              <p className="text-sm">Recommended plan: <span className="font-bold" style={{ color: "var(--site-brand-ink)" }}>{planName(recommended)}</span></p>
              {estimate ? (
                <>
                  <p className="flex items-baseline gap-2 mt-1.5">
                    <span className="font-display text-3xl font-extrabold tabular-nums site-ink">{formatINR(estimate.base)}</span>
                    <span className="text-sm site-muted">/ {billing === "annual" ? "year" : "month"} + GST</span>
                  </p>
                  <p className="text-xs site-muted mt-1">
                    {estimate.seats} seats{members < estimate.seats ? ` (minimum ${estimate.seats})` : ""} · {formatINR(estimate.total)} including 18% GST
                    {billing === "annual" ? ` · works out to ${formatINR(estimate.perMonth)} a month` : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm mt-1.5 site-ink">
                  Teams this size get a custom Enterprise quote.{" "}
                  <Link to="/book-demo" className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>Book a demo for a quote</Link>
                </p>
              )}
            </div>
            <div role="radiogroup" aria-label="Billing period" className="inline-flex p-1 rounded-xl self-start sm:self-end" style={{ background: "var(--site-chip)" }}>
              {[["monthly", "Monthly"], ["annual", "Annual · 2 months free"]].map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={billing === id} onClick={() => setBilling(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${billing === id ? "site-ink" : "site-muted"}`}
                  style={billing === id ? { background: "var(--site-card)", boxShadow: "var(--site-shadow-sm)" } : undefined}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Card>
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium" style={{ color: "#16a34a" }}>
          <CircleCheck className="w-4 h-4" aria-hidden="true" /> 14-day free trial with every Growth feature. No credit card.
        </p>
      </PageHero>

      {/* Plan cards */}
      <Section tone="tint" className="!pt-14 sm:!pt-20">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {PLANS.map((plan, idx) => {
              const price = PLAN_PRICING[plan.id];
              const isPopular = plan.popular;
              const isReco = recommended === plan.id;
              const free = freeMonths(plan.id);
              return (
                <Reveal key={plan.id} delay={idx * 110} className="flex min-w-0">
                  <Card glow className={`relative w-full flex flex-col p-6 sm:p-7 transition-shadow duration-300 ${isPopular ? "md:-translate-y-2" : ""}`}
                    style={isReco ? { borderColor: "rgba(255,107,0,0.65)", boxShadow: "0 0 0 1px rgba(255,107,0,0.35), 0 26px 60px -26px rgba(255,107,0,0.45)" }
                      : isPopular ? { borderColor: "rgba(255,107,0,0.35)" } : undefined}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="font-display text-2xl font-extrabold site-ink">{plan.name}</h2>
                      {(isReco || isPopular) && (
                        <span className="shrink-0 text-[11px] font-bold rounded-md px-2 py-1 text-white" style={{ background: "var(--brand-btn)" }}>
                          {isReco ? "Your match" : "Most popular"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{plan.tagline}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold site-muted"><Users className="w-3.5 h-3.5" aria-hidden="true" /> {plan.userLimit}</p>

                    {/* Price: published rather than "on request", so a prospect can
                        qualify themselves before they ever reach the contact form. */}
                    <div className="my-6 py-6" style={{ borderTop: "1px solid var(--site-line)", borderBottom: "1px solid var(--site-line)" }}>
                      {!price || price.custom ? (
                        <>
                          <div className="font-display text-4xl font-extrabold site-ink tracking-tight">Custom</div>
                          <p className="text-xs site-muted mt-2">Priced on team size and rollout. From {price?.minSeats ?? 25} seats.</p>
                        </>
                      ) : (
                        <>
                          <p className="flex items-baseline gap-1.5">
                            <span className="font-display text-[44px] leading-none font-extrabold site-ink tracking-tight">{formatINR(price.monthly)}</span>
                            <span className="text-xs site-muted">/ user / month</span>
                          </p>
                          <p className="text-xs site-muted mt-2">Plus 18% GST · minimum {price.minSeats} seats</p>
                          <p className="text-xs mt-1 font-semibold" style={{ color: "var(--site-brand-ink)" }}>
                            {formatINR(price.annual)}/user/year billed annually{free ? `, ${free} months free` : ""}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex flex-col gap-5 flex-1 mb-7">
                      {plan.groups.map((group) => (
                        <div key={group.label}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] site-muted mb-2.5">{group.label}</p>
                          <ul className="space-y-2">
                            {group.items.map((item) => (
                              <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#16a34a" }} aria-hidden="true" />{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {plan.ctaAction === "signup" ? (
                      <SiteButton href={CRM_SIGNUP_URL} external variant={isPopular ? "primary" : "secondary"} className="w-full" {...CRM_LINK_PROPS}>
                        {plan.cta} {isPopular && <ArrowRight className="w-4 h-4" />}
                      </SiteButton>
                    ) : (
                      <SiteButton to="/book-demo" variant="secondary" className="w-full">Book a Demo</SiteButton>
                    )}
                  </Card>
                </Reveal>
              );
            })}
          </div>
          <p className="mt-10 text-center text-sm">
            <Link to="/compare" className="site-link">See how we compare to other CRMs <ArrowRight className="w-4 h-4" /></Link>
          </p>
        </Container>
      </Section>

      {/* Plans side by side */}
      <Section tone="white">
        <Container narrow>
          <SectionHeader eyebrow="Side by side" title="Compare Arthaleads plans"
            lede="Prices are per user per month, with a five-user minimum and 18% GST on top. New accounts start with a 14-day free trial of Growth." />
          <Card raised className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm border-collapse">
              <caption className="sr-only">Arthaleads Starter, Growth and Enterprise plans compared</caption>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--site-line)" }}>
                  <th scope="col" className="text-left font-semibold px-5 py-4 site-muted">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className="text-center font-display font-bold px-3 py-4 site-ink"
                      style={p.popular ? { background: "rgba(255,107,0,0.06)", color: "var(--site-brand-ink)" } : undefined}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([label, ...vals], ri) => (
                  <tr key={label} style={ri < COMPARE_ROWS.length - 1 ? { borderBottom: "1px solid var(--site-line)" } : undefined}>
                    <th scope="row" className="text-left font-normal px-5 py-3.5">{label}</th>
                    {vals.map((v, i) => (
                      <td key={i} className="text-center px-3 py-3.5 site-ink" style={PLANS[i]?.popular ? { background: "rgba(255,107,0,0.04)" } : undefined}>
                        {v === true ? <><Check aria-hidden="true" className="w-4 h-4 mx-auto" style={{ color: "#16a34a" }} /><span className="sr-only">Included</span></>
                          : v === false ? <><Minus aria-hidden="true" className="w-4 h-4 mx-auto site-muted opacity-60" /><span className="sr-only">Not included</span></>
                          : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Container>
      </Section>

      <FaqSection title="Pricing questions, answered" items={FAQS} />

      <ClosingCta title="See the price" dim="on your own team."
        body="Book a 30-minute demo and we will show Arthaleads on your real leads and quote for your team, or start the 14-day free trial yourself." />
    </SitePage>
  );
}
