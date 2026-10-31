// pages/Pricing.jsx - /pricing on the shared marketing theme (components/site/*).
// Plans come from data/plans.js and prices from utils/plan.js; the comparison
// table restates both, so change a plan there and here together.
//
// Layout (owner-approved, 31 Oct 2026): plans first. One Monthly / Annual switch
// above the cards drives every price on the page (Annual by default); Growth is
// the Recommended plan; "Your match" appears only after the visitor moves the
// team-size slider. No file storage anywhere on this page.
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { Reveal } from "../components/motion/Motion";
import { Check, Users, ArrowRight, Minus, CircleCheck, ChevronDown } from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, FaqSection, ClosingCta } from "../components/site/Blocks";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING, formatINR, withGST, annualMonthly } from "../utils/plan";
import { PLANS } from "../data/plans";

const FAQS = [
  ["Is there a free trial?", "Yes. The Growth plan comes with a 14-day free trial that includes every Growth feature. No credit card is required, and you can upgrade or cancel anytime."],
  ["How is pricing calculated?", "Pricing is per team member, per month, with a five-seat minimum on every plan. Starter is ₹599 and Growth is ₹999 per user per month, plus 18% GST. There is no setup fee. Enterprise is custom-quoted for large or multi-branch organisations."],
  ["Are WhatsApp message charges included in the plan price?", "No. The plan price covers Arthaleads. WhatsApp itself charges per message, at rates set by Meta: marketing messages cost more than replies and service messages. Depending on how your number is set up, Meta bills these to your own account, or they come from prepaid credits you add in Arthaleads."],
  ["Is there a setup or onboarding fee?", "No. There is no setup fee on any plan. You can start on a 14-day free trial and only pay the per-seat price once you subscribe."],
  ["Can I change plans later?", "Yes, at any time. An upgrade gives you the new features straight away; a downgrade applies from your next billing cycle."],
  ["What happens to my data if I cancel?", "Your data stays yours. On Growth and Enterprise you can export all your leads as CSV or Excel at any time. After cancellation we retain your data per our Refund & Cancellation Policy before secure deletion."],
  ["Do you offer annual billing discounts?", "Yes. Annual billing is ten months’ rate for twelve months: two months free, a saving of 16.7%. Starter is ₹5,990 per user per year and Growth is ₹9,990 per user per year."],
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
  ["AI voice calling", false, false, true],
  ["Custom branding and reporting", false, false, true],
  ["Support", "Email", "Priority", "Dedicated account manager"],
];

const planName = (id) => PLANS.find((p) => p.id === id).name;
const RECOMMENDED_ID = PLANS.find((p) => p.recommended)?.id ?? "growth";

// Per-user yearly saving on annual billing: twelve monthly payments minus the annual price.
const yearlySaving = (id) => {
  const p = PLAN_PRICING[id];
  return p?.monthly && p?.annual ? p.monthly * 12 - p.annual : null;
};

// Bullets shown on a collapsed card below 1024px; desktop shows the full list.
const SHORT_LIST = 5;

// Orange wash for the Recommended plan (cards, table column). color-mix keeps it
// opaque, which the sticky table cells need, and the brand ink is lighter in the
// dark theme, so the tint stays visible there too.
const tint = (pct) => `color-mix(in srgb, var(--site-brand-ink) ${pct}%, var(--site-card))`;

const SLIDER_MIN = 1;
const SLIDER_MAX = 50;
const TICKS = [1, 10, 20, 30, 40, 50];

function BillingSwitch({ billing, setBilling }) {
  const opts = [["monthly", "Monthly"], ["annual", "Annual"]];
  const onKey = (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const next = billing === "annual" ? "monthly" : "annual";
      setBilling(next);
      e.currentTarget.querySelector(`[data-id="${next}"]`)?.focus();
    }
  };
  return (
    <div className="flex flex-col items-center gap-2.5 mb-8 sm:mb-10">
      <div role="radiogroup" aria-label="Billing period" onKeyDown={onKey}
        className="inline-flex p-1 gap-1 rounded-2xl" style={{ background: "var(--site-card)", boxShadow: "inset 0 0 0 1px var(--site-line-strong), var(--site-shadow-sm)" }}>
        {opts.map(([id, label]) => {
          const on = billing === id;
          return (
            <button key={id} data-id={id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => setBilling(id)}
              className="inline-flex items-center gap-2 h-11 px-5 sm:px-6 rounded-xl text-[15px] font-semibold transition-[background-color,color] duration-200 cursor-pointer"
              style={on ? { background: "var(--brand-btn)", color: "#fff" } : { color: "var(--site-text)" }}>
              {label}
              {id === "annual" && (
                <span className="text-xs font-bold rounded-md px-1.5 py-0.5"
                  style={on ? { background: "rgba(255,255,255,0.22)", color: "#fff" } : { background: "rgba(22,163,74,0.12)", color: "var(--site-green-ink)" }}>
                  2 months free
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-sm site-muted text-center">
        {billing === "annual" ? "Per user per month, billed yearly. Plus 18% GST." : "Per user per month, billed monthly. Plus 18% GST."}
      </p>
    </div>
  );
}

function PlanPrice({ planId, billing, setBilling }) {
  const price = PLAN_PRICING[planId];
  if (!price || price.custom) {
    return (
      <>
        <div className="font-display text-[40px] leading-none font-extrabold site-ink tracking-tight">Custom</div>
        <p className="text-xs site-muted mt-3">Priced on team size and rollout. From {price?.minSeats ?? 25} seats.</p>
      </>
    );
  }
  const saving = yearlySaving(planId);
  if (billing === "annual") {
    return (
      <>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[44px] leading-none font-extrabold site-ink tracking-tight tabular-nums">{formatINR(annualMonthly(planId))}</span>
          <s className="text-lg font-semibold site-muted tabular-nums"><span className="sr-only">was </span>{formatINR(price.monthly)}</s>
          <span className="text-xs site-muted">/ user / month</span>
        </p>
        <p className="text-xs mt-3 font-semibold leading-relaxed" style={{ color: "var(--site-brand-ink)" }}>
          {formatINR(price.annual)} per user, billed yearly. You save {formatINR(saving)} per user a year.
        </p>
        <p className="text-xs site-muted mt-1">Plus 18% GST, minimum {price.minSeats} seats</p>
      </>
    );
  }
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-[44px] leading-none font-extrabold site-ink tracking-tight tabular-nums">{formatINR(price.monthly)}</span>
        <span className="text-xs site-muted">/ user / month</span>
      </p>
      <button type="button" onClick={() => setBilling("annual")}
        className="mt-1 min-h-[44px] text-left text-xs font-semibold underline underline-offset-4 cursor-pointer" style={{ color: "var(--site-brand-ink)" }}>
        Switch to annual and save {formatINR(saving)} per user a year
      </button>
      <p className="text-xs site-muted">Plus 18% GST, minimum {price.minSeats} seats</p>
    </>
  );
}

function PlanCard({ plan, billing, setBilling, isMatch }) {
  const [open, setOpen] = useState(false);
  const isReco = plan.id === RECOMMENDED_ID;
  const total = plan.groups.reduce((n, g) => n + g.items.length, 0);
  const listId = `plan-${plan.id}-features`;
  let n = 0;

  // Growth is always the strongest card; a calculator match on another plan
  // gets a lighter brand edge. No transform: the cards stay aligned.
  const style = isReco
    ? {
        border: "2px solid var(--site-brand)",
        background: `linear-gradient(180deg, ${tint(9)} 0, var(--site-card) 260px)`,
        boxShadow: "0 0 0 4px rgba(255,107,0,0.12), 0 30px 70px -34px rgba(255,107,0,0.6)",
      }
    : isMatch
      ? { borderColor: "rgba(255,107,0,0.7)", boxShadow: "0 0 0 1px rgba(255,107,0,0.4), var(--site-shadow)" }
      : undefined;

  return (
    <Card glow id={`plan-${plan.id}`} className="relative w-full flex flex-col p-5 sm:p-7 scroll-mt-24" style={style}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="site-h3">{plan.name}</h2>
        <div className="flex flex-wrap justify-end gap-1.5">
          {isReco && (
            <span className="shrink-0 text-xs font-bold rounded-md px-2 py-1 text-white" style={{ background: "var(--brand-btn)" }}>Recommended</span>
          )}
          {isMatch && (
            <span className="shrink-0 text-xs font-bold rounded-md px-2 py-1" style={{ color: "var(--site-brand-ink)", background: "rgba(255,107,0,0.12)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.35)" }}>Your match</span>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed">{plan.tagline}</p>
      <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold site-muted"><Users className="w-3.5 h-3.5" aria-hidden="true" /> {plan.userLimit}</p>

      {/* Price: published rather than "on request", so a prospect can
          qualify themselves before they ever reach the contact form. */}
      <div className="my-5 py-5" style={{ borderTop: "1px solid var(--site-line)", borderBottom: "1px solid var(--site-line)" }}>
        <PlanPrice planId={plan.id} billing={billing} setBilling={setBilling} />
      </div>

      <div id={listId} className="flex flex-col gap-4 flex-1 mb-5 lg:mb-7">
        {plan.groups.map((group) => {
          const items = group.items.map((item) => ({ item, i: n++ }));
          const groupHidden = !open && items[0].i >= SHORT_LIST;
          return (
            <div key={group.label} className={groupHidden ? "hidden lg:block" : undefined}>
              <p className="text-xs font-semibold site-muted mb-2">{group.label}</p>
              <ul className="space-y-1.5">
                {items.map(({ item, i }) => (
                  <li key={item} className={`${!open && i >= SHORT_LIST ? "hidden lg:flex" : "flex"} items-start gap-2.5 text-sm leading-snug`}>
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--site-green)" }} aria-hidden="true" />{item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {total > SHORT_LIST && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={listId}
          className="lg:hidden mb-4 -mt-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] w-full rounded-xl text-sm font-semibold cursor-pointer"
          style={{ color: "var(--site-brand-ink)", background: "var(--site-chip)" }}>
          {open ? "Show fewer features" : `See all ${total} features`}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}

      {plan.ctaAction === "signup" ? (
        <SiteButton href={CRM_SIGNUP_URL} external variant={isReco ? "primary" : "secondary"} className="w-full" {...CRM_LINK_PROPS}>
          {plan.cta} {isReco && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
        </SiteButton>
      ) : (
        <SiteButton to="/book-demo" variant="secondary" className="w-full">Book a Demo</SiteButton>
      )}
    </Card>
  );
}

export default function Pricing() {
  // One billing state for the whole page; Annual by default (owner, 31 Oct 2026).
  const [billing, setBilling] = useState("annual");
  // Starts inside Growth's range, so the calculator agrees with the Recommended card.
  const [members, setMembers] = useState(12);
  const [touched, setTouched] = useState(false);

  useSEO({
    title:       "Pricing | Arthaleads Real Estate CRM Plans",
    description: "Arthaleads pricing: Starter ₹599 and Growth ₹999 per user a month plus GST, five-seat minimum; Enterprise on quote. 14-day free trial, no credit card.",
    canonical:   "https://www.arthaleads.com/pricing",
  });

  // Which plan does the chosen team size land in?
  const matched = useMemo(() => {
    if (members <= PLAN_PRICING.starter.maxSeats) return "starter";
    if (members <= PLAN_PRICING.growth.maxSeats)  return "growth";
    return "enterprise";
  }, [members]);

  // What the chosen team would pay on that plan (five-seat minimum).
  const estimate = useMemo(() => {
    const price = PLAN_PRICING[matched];
    if (!price || price.custom) return null;
    const seats = Math.max(members, price.minSeats);
    const base = billing === "annual" ? price.annual * seats : price.monthly * seats;
    return { seats, base, total: withGST(base), perMonth: billing === "annual" ? Math.round(base / 12) : base, saving: yearlySaving(matched) * seats };
  }, [members, matched, billing]);

  const onSlide = (e) => { setMembers(Number(e.target.value)); setTouched(true); };
  const showPlan = () => document.getElementById(`plan-${matched}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />

      <PageHero
        eyebrow="Pricing"
        title={<>Plans for every <span className="site-dim">team size</span></>}
        lede="Simple per-seat pricing. No setup fee and no hidden charges: you pay only for the team members you add."
        actions={null}
      >
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--site-green)" }}>
          <CircleCheck className="w-4 h-4" aria-hidden="true" /> 14-day free trial with every Growth feature. No credit card.
        </p>
      </PageHero>

      {/* Plan cards: Growth first on phones and tablets, three across from 1024px. */}
      <Section tone="tint" id="plans" className="!pt-12 sm:!pt-16">
        <Container>
          <BillingSwitch billing={billing} setBilling={setBilling} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-4 items-stretch max-w-[600px] mx-auto lg:max-w-none">
            {PLANS.map((plan, idx) => (
              <Reveal key={plan.id} delay={idx * 110} className={`flex min-w-0 ${plan.id === RECOMMENDED_ID ? "order-first lg:order-none" : ""}`}>
                <PlanCard plan={plan} billing={billing} setBilling={setBilling} isMatch={touched && matched === plan.id} />
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-sm">
            <Link to="/compare" className="site-link">See how we compare to other CRMs <ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
          </p>
        </Container>
      </Section>

      {/* Team-size calculator: follows the page's billing switch. */}
      <Section tone="white" id="calculator">
        <Container>
          <SectionHeader title="Price your team" lede="Move the slider to see which plan fits and what your team would pay." />
          <Card raised className="p-5 sm:p-8 grid lg:grid-cols-[1.15fr_1fr] gap-6 lg:gap-12 items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label htmlFor="team-size" className="flex items-center gap-2 text-sm font-semibold site-ink">
                  <Users className="w-4 h-4" style={{ color: "var(--site-brand)" }} aria-hidden="true" /> How big is your team?
                </label>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-extrabold tabular-nums" style={{ color: "var(--site-brand-ink)" }}>{members >= SLIDER_MAX ? "50+" : members}</span>
                  <span className="text-sm site-muted">members</span>
                </p>
              </div>
              <input id="team-size" type="range" min={SLIDER_MIN} max={SLIDER_MAX} value={members} onChange={onSlide}
                aria-valuetext={`${members >= SLIDER_MAX ? "50 or more" : members} members`}
                className="block w-full h-11 mt-2 cursor-pointer" style={{ accentColor: "#ff6b00" }} />
              <div className="relative h-5 text-xs site-muted tabular-nums" aria-hidden="true">
                {TICKS.map((t, i) => {
                  const pos = ((t - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
                  const edge = i === 0 ? { left: 0 } : i === TICKS.length - 1 ? { right: 0 } : { left: `${pos}%`, transform: "translateX(-50%)" };
                  return <span key={t} className="absolute top-0" style={edge}>{t === SLIDER_MAX ? "50+" : t}</span>;
                })}
              </div>
            </div>

            <div className="min-w-0 pt-5 border-t lg:pt-0 lg:pl-12 lg:border-t-0 lg:border-l" style={{ borderColor: "var(--site-line)" }}>
              <div>
                <p className="text-sm">
                  {touched ? "Your match" : "Plan for this team"}: <span className="font-bold" style={{ color: "var(--site-brand-ink)" }}>{planName(matched)}</span>
                </p>
                {estimate ? (
                  <>
                    <p className="flex flex-wrap items-baseline gap-x-2 mt-1.5">
                      <span className="font-display text-3xl font-extrabold tabular-nums site-ink">{formatINR(estimate.base)}</span>
                      <span className="text-sm site-muted">/ {billing === "annual" ? "year" : "month"} + GST</span>
                    </p>
                    <p className="text-xs site-muted mt-1.5 leading-relaxed">
                      {estimate.seats} seats{members < estimate.seats ? ` (minimum ${estimate.seats})` : ""}, {formatINR(estimate.total)} including 18% GST
                      {billing === "annual" ? `, works out to ${formatINR(estimate.perMonth)} a month` : ""}
                    </p>
                    <p className="text-xs mt-1 font-semibold" style={{ color: "var(--site-brand-ink)" }}>
                      {billing === "annual" ? `You save ${formatINR(estimate.saving)} a year on annual billing.` : `Annual billing would save ${formatINR(estimate.saving)} a year.`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm mt-1.5 site-ink">
                    Teams this size get a custom Enterprise quote.{" "}
                    <Link to="/book-demo" className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>Book a demo for a quote</Link>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5">
                  <button type="button" onClick={() => setBilling(billing === "annual" ? "monthly" : "annual")}
                    className="site-link min-h-[44px] text-sm cursor-pointer">
                    {billing === "annual" ? "Show monthly billing" : "Show annual billing"}
                  </button>
                  <button type="button" onClick={showPlan} className="site-link min-h-[44px] text-sm cursor-pointer">
                    See the {planName(matched)} plan <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </Container>
      </Section>

      {/* Plans side by side: the page's signature sand band. On phones the table
          scrolls inside its card with the feature names and plan names pinned. */}
      <Section tone="sand">
        <Container>
          <SectionHeader title="Compare Arthaleads plans"
            lede="Prices are per user per month, with a five-user minimum and 18% GST on top. New accounts start with a 14-day free trial of Growth." />
          <Card raised className="overflow-hidden">
            <div className="relative overflow-auto max-h-[75vh] md:max-h-none overscroll-x-contain" tabIndex={0} role="region" aria-label="Plan comparison table, scrolls sideways on small screens">
              <table className="w-full min-w-[452px] text-sm border-separate border-spacing-0">
                <caption className="sr-only">Arthaleads Starter, Growth and Enterprise plans compared</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky top-0 left-0 z-[3] text-left font-semibold px-3 sm:px-5 py-4 site-muted w-[128px] sm:w-[38%]"
                      style={{ background: "var(--site-card)", boxShadow: "inset 0 -1px 0 var(--site-line), inset -1px 0 0 var(--site-line)" }}>Feature</th>
                    {PLANS.map((p) => {
                      const reco = p.id === RECOMMENDED_ID;
                      return (
                        <th key={p.id} scope="col" className="sticky top-0 z-[2] text-center px-2 sm:px-3 py-4 min-w-[108px]"
                          style={{ background: reco ? tint(16) : "var(--site-card)", boxShadow: "inset 0 -1px 0 var(--site-line)" }}>
                          <span className="site-h4 block" style={reco ? { color: "var(--site-brand-ink)" } : undefined}>{p.name}</span>
                          {reco && <span className="block text-xs font-semibold mt-0.5" style={{ color: "var(--site-brand-ink)" }}>Recommended</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(([label, ...vals], ri) => {
                    const line = ri < COMPARE_ROWS.length - 1 ? "inset 0 -1px 0 var(--site-line)" : null;
                    return (
                      <tr key={label}>
                        <th scope="row" className="sticky left-0 z-[1] text-left font-normal px-3 sm:px-5 py-3.5 leading-snug"
                          style={{ background: "var(--site-card)", boxShadow: [line, "inset -1px 0 0 var(--site-line)"].filter(Boolean).join(", ") }}>{label}</th>
                        {vals.map((v, i) => (
                          <td key={i} className="text-center px-2 sm:px-3 py-3.5 site-ink"
                            style={{ background: PLANS[i]?.id === RECOMMENDED_ID ? tint(8) : undefined, boxShadow: line || undefined }}>
                            {v === true ? <><Check aria-hidden="true" className="w-4 h-4 mx-auto" style={{ color: "var(--site-green)" }} /><span className="sr-only">Included</span></>
                              : v === false ? <><Minus aria-hidden="true" className="w-4 h-4 mx-auto site-muted opacity-60" /><span className="sr-only">Not included</span></>
                              : v}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Container>
      </Section>

      <FaqSection title="Pricing questions, answered" items={FAQS} />

      <ClosingCta title="See the price" dim="on your own team."
        body="Book a 30-minute demo and we will show Arthaleads on your real leads and quote for your team, or start the 14-day free trial yourself." />
    </SitePage>
  );
}
