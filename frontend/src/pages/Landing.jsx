// pages/Landing.jsx - Arthaleads home page (rebuilt 24 Oct 2026).
//
// Built only from the shared marketing theme (components/site/Site.jsx +
// the --site-* tokens in styles.css), so every section has the same padding,
// container and card treatment. Owner rules for this page:
//   - no real CRM screenshots: visuals are AI photos + coded illustrations
//     (components/site/HomeVisuals.jsx, HeroChat)
//   - no fake social proof (no testimonials, logos, ratings or counts)
//   - real brand logos only; portals that have no live connection are text
//   - no blog section and no contact form here (/blog and /contact own those)
// SEO: the H1 carries "Real estate CRM software for India"; the FAQ below is
// also the FAQPage JSON-LD, so visible and structured answers always match.
// Rendered by entry-prerender.jsx too: nothing may touch window during render.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Globe, QrCode, FileSpreadsheet, Store, ShieldCheck, Download, Lock, MapPin,
  MessageCircle, Bot, Sparkles, PlayCircle, Plus, Minus, ChevronRight,
} from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton, SiteImage } from "../components/site/Site";
import { WhatsAppLogo, FacebookLogo, GoogleLogo } from "../components/site/BrandLogos";
import {
  HeroVisual, ScoreCard, CopilotCard, CaptureViz, PipelineViz, ProjectViz, VisitViz, TeamViz, BookingViz, FieldVisual,
} from "../components/site/HomeVisuals";
import HeroChat from "../components/HeroChat";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";
import { CRM_SIGNUP_URL, waLink, WA_MESSAGES } from "../utils/crmLinks";
import { PLAN_PRICING, formatINR } from "../utils/plan";
import { PLANS } from "../data/plans";

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });

// ── 1. Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <Section id="hero" tone="white" className="!pt-[5.5rem] sm:!pt-32 lg:!pt-40 overflow-x-clip">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(70% 55% at 85% 20%, rgba(255,107,0,0.10), transparent 70%), radial-gradient(50% 40% at 0% 100%, rgba(255,170,0,0.07), transparent 70%)" }} />
      <Container className="relative grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
        <div className="text-center lg:text-left">
          <h1 className="font-display site-ink font-extrabold tracking-[-0.03em]">
            <span className="site-eyebrow block mb-4 sm:mb-5">Real estate CRM software for India</span>
            <span className="block text-[35px] leading-[1.06] sm:text-[52px] lg:text-[60px] xl:text-[66px]">Every enquiry answered.</span>
            <span className="block text-[35px] leading-[1.1] sm:text-[52px] lg:text-[60px] xl:text-[66px]" style={{ color: "var(--site-brand)" }}>Even at 1 AM.</span>
          </h1>
          <p className="mt-5 sm:mt-6 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0" style={{ textWrap: "pretty" }}>
            Facebook, Google and WhatsApp enquiries land in one place. A WhatsApp AI agent replies in seconds,
            qualifies the buyer and books the site visit, so your team starts the day with buyers ready to talk.
          </p>
          <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <SiteButton href={CRM_SIGNUP_URL} external size="lg" className="w-full sm:w-auto">
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </SiteButton>
            <SiteButton href={waLink(WA_MESSAGES.demo)} external variant="secondary" size="lg" className="w-full sm:w-auto">
              <WhatsAppLogo className="w-[18px] h-[18px]" /> Book a demo on WhatsApp
            </SiteButton>
          </div>
          <p className="mt-4 sm:mt-5 text-[13px] sm:text-sm site-muted">No credit card needed · From {formatINR(PLAN_PRICING.starter.monthly)} per user per month · Made in Pune</p>
        </div>
        <Reveal delay={150} y={28}>
          <HeroVisual />
        </Reveal>
      </Container>
    </Section>
  );
}

// ── 2. Works with ──────────────────────────────────────────────────────────────
const SOURCES = [
  { Logo: FacebookLogo, label: "Facebook & Instagram lead ads" },
  { Logo: GoogleLogo, label: "Google lead forms", note: "Enterprise" },
  { Logo: WhatsAppLogo, label: "WhatsApp Business" },
  { Icon: Globe, label: "Website & WordPress forms" },
  { Icon: QrCode, label: "Site QR codes" },
  { Icon: FileSpreadsheet, label: "Excel & CSV import" },
  { Icon: Store, label: "Walk-ins" },
];

function WorksWith() {
  return (
    <Section tone="tint" className="!py-12 sm:!py-14" aria-label="Lead sources Arthaleads works with">
      <Container>
        <p className="text-center text-sm font-semibold site-ink mb-6">Every lead source in one list</p>
        <ul className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {SOURCES.map(({ Logo, Icon, label, note }) => (
            <li key={label} className="site-card flex items-center gap-2.5 px-4 py-2.5 !rounded-full text-sm font-medium site-ink">
              {Logo ? <Logo className="w-[18px] h-[18px]" /> : <Icon className="w-[18px] h-[18px]" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />}
              {label}
              {note && <span className="text-xs site-muted">({note})</span>}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-sm site-muted">Leads from 99acres, MagicBricks and Housing.com come in by sheet import.</p>
      </Container>
    </Section>
  );
}

// ── 3. AI that works the night shift (dark band) ──────────────────────────────
const AI_POINTS = [
  { Icon: Bot, title: "WhatsApp AI agent", body: "Replies 24/7 in English, Hinglish, Hindi or Marathi, asks the budget and timeline, sends the brochure and offers a site visit." },
  { Icon: MessageCircle, title: "AI lead scoring", body: "Reads each buyer's chat and moves the score up or down with a one-line reason, so Hot Today shows who to call first." },
  { Icon: Sparkles, title: "Artha, your AI copilot", body: "Ask about your pipeline in plain words or by voice, on the web or the Android app, and apply its follow-ups in one tap." },
];

function AiBand() {
  return (
    <Section tone="dark" className="overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(45% 50% at 20% 30%, rgba(255,107,0,0.16), transparent 70%), radial-gradient(40% 45% at 90% 80%, rgba(255,140,60,0.08), transparent 70%)" }} />
      <Container className="relative">
        <SectionHeader eyebrow="AI that works the night shift" title="Your best salesperson never sleeps"
          lede="Most enquiries arrive after office hours. Arthaleads answers every one of them, qualifies the buyer and tells your team exactly who to call in the morning." />
        <div className="grid lg:grid-cols-[minmax(0,360px)_1fr] gap-10 lg:gap-14 items-center">
          <Reveal className="mx-auto w-full max-w-[360px]">
            <HeroChat />
          </Reveal>
          <div className="grid gap-6 min-w-0">
            <div className="grid sm:grid-cols-2 gap-5">
              <Reveal delay={80}><ScoreCard /></Reveal>
              <Reveal delay={160}><CopilotCard /></Reveal>
            </div>
            <ul className="grid sm:grid-cols-3 gap-5">
              {AI_POINTS.map(({ Icon, title, body }, i) => (
                <Reveal as="li" key={title} delay={i * 90}>
                  <Card className="h-full p-5">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(255,107,0,0.14)" }}>
                      <Icon className="w-5 h-5" style={{ color: "#ff8a3d" }} aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-base font-bold site-ink mb-1.5">{title}</h3>
                    <p className="text-sm leading-relaxed">{body}</p>
                  </Card>
                </Reveal>
              ))}
            </ul>
            <p className="text-sm site-muted">
              On the Growth plan and above.{" "}
              <Link to="/ai-crm" className="font-semibold underline underline-offset-4" style={{ color: "#ff8a3d" }}>See everything the AI does</Link>
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ── 4. Platform features ───────────────────────────────────────────────────────
// Three wide + three narrow cards fill a 3-column grid exactly, zig-zagging
// the wide one left, right, left.
const FEATURE_CARDS = [
  { title: "Every lead in one list", body: "Ad, WhatsApp, website and QR leads arrive with their source, duplicates flagged and an owner assigned.", Viz: CaptureViz, wide: true },
  { title: "Pipeline and follow-ups", body: "Move buyers from New to Site Visit to Booked, with reminders that turn red when a follow-up is late.", Viz: PipelineViz },
  { title: "Project-wise sales", body: "Each project keeps its own leads, team, brochures and floor plans.", Viz: ProjectViz },
  { title: "Site visits on a calendar", body: "Visits booked by your team or the AI agent show up with the buyer's details.", Viz: VisitViz, wide: true },
  { title: "Bookings and invoices", body: "Close a deal and get a branded invoice with brokerage and GST worked out.", Viz: BookingViz, wide: true },
  { title: "Team performance", body: "Selfie attendance, calls and conversions per agent, so you coach on facts.", Viz: TeamViz },
];

function Features() {
  return (
    <Section id="features" tone="white">
      <Container>
        <SectionHeader eyebrow="One workspace" title="From first message to booking, in one place"
          lede="Everything a property sales team uses every day, built for how builders, brokers and channel partners in India actually sell." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_CARDS.map(({ title, body, Viz, wide }, i) => (
            <Reveal key={title} delay={(i % 3) * 90} className={wide ? "lg:col-span-2" : ""}>
              <Card hover className="h-full p-6 flex flex-col">
                <div className="rounded-2xl p-4 mb-6" style={{ background: "var(--site-bg)", border: "1px solid var(--site-line)" }}>
                  <Viz />
                </div>
                <h3 className="font-display text-lg font-bold site-ink mb-2">{title}</h3>
                <p className="text-[15px] leading-relaxed">{body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <SiteButton to="/features" variant="secondary">See every feature <ChevronRight className="w-4 h-4" /></SiteButton>
        </div>
      </Container>
    </Section>
  );
}

// ── 5. Built for ───────────────────────────────────────────────────────────────
const PERSONAS = [
  { img: "builder", title: "Builders and developers", body: "Run every project's sales from one screen, with leads routed to the right telecaller in seconds.", to: "/builder-crm", link: "Builder CRM",
    alt: "A sales head explaining a scale model of residential towers to a young couple in a sales gallery" },
  { img: "broker", title: "Brokers", body: "Answer every enquiry on WhatsApp, follow up on time and never lose a buyer to a faster agent.", to: "/whatsapp-crm", link: "WhatsApp CRM",
    alt: "A broker showing a bright new apartment to a family" },
  { img: "partner", title: "Channel partners", body: "Sell for several developers at once and keep each project's leads, visits and bookings apart.", to: "/features", link: "See the features",
    alt: "Three colleagues in a small office working together at a laptop" },
];

function BuiltFor() {
  return (
    <Section tone="tint">
      <Container>
        <SectionHeader eyebrow="Who it is for" title="Built for the way property is sold in India" />
        <div className="grid md:grid-cols-3 gap-6">
          {PERSONAS.map(({ img, title, body, to, link, alt }, i) => (
            <Reveal key={title} delay={i * 100}>
              <Card hover as={Link} to={to} className="group h-full overflow-hidden flex flex-col">
                <div className="overflow-hidden">
                  <SiteImage name={img} width={1536} height={1024} sizes="(min-width: 768px) 400px, 92vw" alt={alt}
                    className="block w-full h-auto aspect-[3/2] object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-display text-lg font-bold site-ink mb-2">{title}</h3>
                  <p className="text-[15px] leading-relaxed flex-1">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--site-brand-ink)" }}>
                    {link} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── 6. How it works ────────────────────────────────────────────────────────────
const STEPS = [
  { title: "Connect your lead sources", body: "Link Facebook lead ads and your WhatsApp Business number, add your website form, and import existing leads from Excel." },
  { title: "Let the AI take the first reply", body: "Tell the AI agent about your projects. It answers buyers, asks the right questions and books visits, day and night." },
  { title: "Your team closes", body: "Agents get every lead with the chat and a score, call from the Android app, and move deals to booking." },
];

function HowItWorks() {
  return (
    <Section tone="white">
      <Container className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <SectionHeader align="left" eyebrow="How it works" title="Live in a day, not a quarter" className="!mb-10" />
          <ol className="space-y-4">
            {STEPS.map(({ title, body }, i) => (
              <Reveal as="li" key={title} delay={i * 90}>
                <Card className="p-5 flex gap-4">
                  <span className="font-display w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base font-extrabold text-white" style={{ background: "var(--brand-btn)" }}>{i + 1}</span>
                  <div>
                    <h3 className="font-display text-base font-bold site-ink mb-1">{title}</h3>
                    <p className="text-[15px] leading-relaxed">{body}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </ol>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <SiteButton to="/product-tour" variant="secondary"><PlayCircle className="w-[18px] h-[18px]" /> Watch the 2-minute film</SiteButton>
            <SiteButton to="/download-app" variant="secondary"><Download className="w-[18px] h-[18px]" /> Get the Android app</SiteButton>
          </div>
        </div>
        <Reveal delay={120}><FieldVisual /></Reveal>
      </Container>
    </Section>
  );
}

// ── 7. Pricing ─────────────────────────────────────────────────────────────────
const planBullets = (plan) => plan.groups.flatMap((g) => g.items).slice(0, 5);
const compareLink = "font-semibold underline underline-offset-4";

function Pricing() {
  return (
    <Section id="pricing" tone="tint">
      <Container>
        <SectionHeader eyebrow="Pricing" title="Simple, published prices"
          lede="Per user per month, plus 18% GST. Start with a 14-day free trial, no credit card needed." />
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan, i) => {
            const price = PLAN_PRICING[plan.id];
            const popular = !!plan.popular;
            return (
              <Reveal key={plan.id} delay={i * 90}>
                <Card raised={popular} className="relative h-full p-7 flex flex-col"
                  style={popular ? { borderColor: "var(--site-brand)", boxShadow: "0 0 0 1px var(--site-brand), var(--site-shadow)" } : undefined}>
                  {popular && (
                    <span className="absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: "var(--brand-btn)" }}>Most popular</span>
                  )}
                  <h3 className="font-display text-xl font-bold site-ink">{plan.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed md:min-h-[2.75rem]">{plan.tagline}</p>
                  <p className="mt-5 flex items-baseline gap-1.5">
                    {price.custom
                      ? <span className="font-display text-[34px] leading-none font-extrabold site-ink">Custom</span>
                      : <><span className="font-display text-[40px] leading-none font-extrabold site-ink">{formatINR(price.monthly)}</span><span className="text-sm site-muted">/ user / month</span></>}
                  </p>
                  <p className="mt-2 text-xs site-muted">{plan.userLimit}</p>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {planBullets(plan).map((item) => (
                      <li key={item} className="flex gap-2.5 text-[14px] leading-snug">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#16a34a" }} aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7">
                    {plan.ctaAction === "signup"
                      ? <SiteButton href={CRM_SIGNUP_URL} external variant={popular ? "primary" : "secondary"} className="w-full">Start free trial</SiteButton>
                      : <SiteButton href={waLink(WA_MESSAGES.sales)} external variant="secondary" className="w-full">Talk to sales</SiteButton>}
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm leading-relaxed">
          <Link to="/pricing" className={compareLink} style={{ color: "var(--site-brand-ink)" }}>Compare every feature by plan</Link>
          <span className="site-muted"> · Switching from </span>
          <Link to="/compare/sell-do-alternative" className={compareLink} style={{ color: "var(--site-brand-ink)" }}>Sell.Do</Link>
          <span className="site-muted">, </span>
          <Link to="/compare/leadrat-alternative" className={compareLink} style={{ color: "var(--site-brand-ink)" }}>Leadrat</Link>
          <span className="site-muted"> or </span>
          <Link to="/compare/kylas-alternative" className={compareLink} style={{ color: "var(--site-brand-ink)" }}>Kylas</Link>
          <span className="site-muted">?</span>
        </p>
      </Container>
    </Section>
  );
}

// ── 8. Trust (no testimonials: facts only) ────────────────────────────────────
const TRUST = [
  { Icon: WhatsAppLogo, brand: true, title: "Official WhatsApp Business Platform", body: "Your own verified business number on Meta's official API, not a grey-market tool that can get banned." },
  { Icon: Lock, title: "Your data stays yours", body: "Each company's data is kept apart, agents see only their leads, and you can export or delete your account any time.", to: "/security", link: "How we protect data" },
  { Icon: ShieldCheck, title: "Roles and permissions", body: "Admin, manager and agent roles decide who sees what, on the web and in the Android app." },
  { Icon: MapPin, title: "Made in Pune", body: "Built by Vistrow Technologies for Indian sales teams, with support on WhatsApp in your working hours.", to: "/about-us", link: "About us" },
];

function Trust() {
  return (
    <Section tone="white">
      <Container>
        <SectionHeader eyebrow="Why teams trust it" title="Serious about your leads and your data" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TRUST.map(({ Icon, brand, title, body, to, link }, i) => (
            <Reveal key={title} delay={i * 80}>
              <Card className="h-full p-6 flex flex-col">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: brand ? "rgba(37,211,102,0.12)" : "rgba(255,107,0,0.10)" }}>
                  {brand ? <Icon className="w-5 h-5" /> : <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />}
                </span>
                <h3 className="font-display text-base font-bold site-ink mb-2">{title}</h3>
                <p className="text-[15px] leading-relaxed flex-1">{body}</p>
                {to && <Link to={to} className="mt-4 text-sm font-semibold inline-flex items-center gap-1" style={{ color: "var(--site-brand-ink)" }}>{link} <ArrowRight className="w-4 h-4" /></Link>}
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── 9. FAQ ─────────────────────────────────────────────────────────────────────
// Also published as FAQPage structured data. Prices come from utils/plan.js so
// the answers never drift from the pricing page.
const HOME_FAQS = [
  ["What is Arthaleads?",
   "Arthaleads is real estate CRM software built for sales teams in India: builders, developers, brokers and channel partners. It collects every property enquiry in one place, replies on WhatsApp with an AI agent, assigns each lead to the right person, reminds them to follow up, and tracks every buyer from first message to site visit and booking."],
  ["Which lead sources can I connect?",
   "Facebook and Instagram lead ads import automatically, WhatsApp chats become leads, and website forms connect through our WordPress plugin or API. Google lead forms are available on Enterprise. Leads from 99acres, MagicBricks and Housing.com come in by importing a sheet."],
  ["Can the WhatsApp AI reply to buyers in Hindi or Marathi?",
   "Yes. On Growth and Enterprise the WhatsApp AI agent answers buyers day and night and follows the buyer's language, including English, Hinglish, Hindi and Marathi. Your team can take over any chat at any time."],
  ["Which is the best real estate CRM in India?",
   "It depends on your team size, lead sources and budget. Look for automatic Facebook and Google lead capture, WhatsApp follow-up, site visit tracking, an app for agents and clear per-user pricing. Arthaleads is built for Indian builders, brokers and channel partners whose buyers enquire on WhatsApp."],
  ["How much does a real estate CRM cost in India?",
   `Most real estate CRMs in India charge per user per month. Arthaleads Starter is ${formatINR(PLAN_PRICING.starter.monthly)} and Growth is ${formatINR(PLAN_PRICING.growth.monthly)} per user per month, plus 18% GST, with a five-seat minimum. Enterprise is quoted on team size. Every team can start with a 14-day free trial, no credit card needed.`],
  ["Is there a mobile app for my sales team?",
   "Yes. Agents get an Android app for calling leads, logging outcomes, checking in and seeing today's follow-ups, and the web app works on any phone or computer."],
];

const HOME_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
}).replace(/</g, "\\u003c");

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <Section id="faq" tone="tint">
      <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
        <div className="lg:sticky lg:top-28 self-start">
          <SectionHeader align="left" eyebrow="FAQ" title="Questions people ask first" className="!mb-6"
            lede="Anything else? Message us on WhatsApp and a real person replies." />
          <SiteButton href={waLink(WA_MESSAGES.sales)} external variant="whatsapp"><WhatsAppLogo className="w-[18px] h-[18px]" color="#fff" /> Ask on WhatsApp</SiteButton>
        </div>
        <div className="space-y-3 min-w-0">
          {HOME_FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <Card key={q} className="overflow-hidden">
                <h3 className="m-0">
                  <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`faq-${i}`}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-5 font-display text-[15px] sm:text-base font-bold site-ink">
                    {q}
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--site-tint)" }}>
                      {isOpen ? <Minus className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                    </span>
                  </button>
                </h3>
                {/* Always in the HTML (crawlers read it); only hidden visually when closed. */}
                <div id={`faq-${i}`} className={isOpen ? "px-5 sm:px-6 pb-5 -mt-1" : "sr-only"}>
                  <p className="text-[15px] leading-relaxed">{a}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

// ── 10. Final CTA (dark band with photo) ──────────────────────────────────────
function FinalCta() {
  return (
    <Section tone="dark" className="overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0">
        <SiteImage name="keys" width={1600} height={900} sizes="100vw" alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(13,14,21,0.96) 0%, rgba(13,14,21,0.86) 45%, rgba(13,14,21,0.55) 100%)" }} />
      </div>
      <Container className="relative">
        <Reveal className="max-w-2xl">
          <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[32px] sm:text-[42px] lg:text-[48px]" style={{ textWrap: "balance" }}>
            Stop losing buyers to whoever replies first
          </h2>
          <p className="mt-5 text-lg leading-relaxed">Start your 14-day free trial today, or message us on WhatsApp and see the AI agent answer you.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <SiteButton href={CRM_SIGNUP_URL} external size="lg" className="w-full sm:w-auto">Start free trial <ArrowRight className="w-4 h-4" /></SiteButton>
            <SiteButton href={waLink(WA_MESSAGES.demo)} external variant="secondary" size="lg" className="w-full sm:w-auto">
              <WhatsAppLogo className="w-[18px] h-[18px]" /> Book a demo
            </SiteButton>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

export default function Landing() {
  useSEO({
    title:       "Real Estate CRM Software in India | Arthaleads",
    description: "Real estate CRM software for builders, developers, brokers and channel partners in India. Capture Facebook, Google and WhatsApp leads; AI replies to buyers 24/7.",
    canonical:   "https://www.arthaleads.com/",
  });

  useEffect(() => {
    // Links from other pages arrive as /#features or /#pricing: land on that section.
    const id = window.location.hash.slice(1);
    if (!id) return undefined;
    const t = setTimeout(() => scrollToId(id), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <SitePage onScrollTo={scrollToId}>
      {/* In the markup (not added by an effect) so the prerendered HTML carries it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: HOME_JSONLD }} />
      <Hero />
      <WorksWith />
      <AiBand />
      <Features />
      <BuiltFor />
      <HowItWorks />
      <Pricing />
      <Trust />
      <Faq />
      <FinalCta />
    </SitePage>
  );
}
