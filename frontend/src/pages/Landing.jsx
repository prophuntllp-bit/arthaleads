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
  ArrowRight, Globe, QrCode, FileSpreadsheet, Store, ShieldCheck, Download, Lock, MapPin,
  MessageCircle, Bot, Sparkles, Phone, Plus, Minus, CircleCheck, BadgeCheck, ArrowUpRight, Repeat2, CalendarCheck2,
} from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton, SiteImage } from "../components/site/Site";
import { WhatsAppLogo, FacebookLogo, GoogleLogo } from "../components/site/BrandLogos";
import {
  FloatCard, HeroVisual, ScoreCard, CopilotCard, CaptureViz, PipelineViz, ProjectViz, VisitViz, TeamViz, BookingViz,
} from "../components/site/HomeVisuals";
import HeroChat from "../components/HeroChat";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";
import { CRM_SIGNUP_URL, waLink, WA_MESSAGES } from "../utils/crmLinks";
import { PLAN_PRICING, formatINR } from "../utils/plan";
import LiveBackground from "../components/site/LiveBackground";
import FilmSection from "../components/site/FilmSection";
import { usePublicTheme } from "../context/PublicThemeContext";

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });

// ── Live backgrounds (React Bits, desktop and tablet only; see LiveBackground) ──
// Grainient in our orange. The first colour is the page background so the
// gradient melts into the section; lightMode turns the same ramp into pale tints.
const GRAIN_COLORS_PANEL = ["#17110d", "#3a1a0c", "#9a3412", "#f97316", "#fed7aa"];

// ── 1. Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <Section id="hero" tone="white" className="site-hero !pt-[5.5rem] sm:!pt-28 lg:!pt-[6.5rem] !pb-14 lg:!pb-10 overflow-x-clip">
      {/* Warm glass stage: soft orange/amber light on the photo side (styles.css .hero-warm);
          the photo sits on a frosted glass panel (HeroVisual). The headline side stays clean. */}
      <div aria-hidden="true" className="hero-warm" />
      <Container className="relative grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
        <div className="text-center lg:text-left">
          <h1 className="font-display site-ink font-extrabold tracking-[-0.03em]">
            <span className="site-eyebrow block mb-4 sm:mb-5">Real estate CRM software for India</span>
            <span className="block text-[35px] leading-[1.06] sm:text-[48px] lg:text-[52px] xl:text-[58px] min-[1700px]:text-[64px]">Every enquiry answered.</span>
            <span className="block text-[35px] leading-[1.1] sm:text-[48px] lg:text-[52px] xl:text-[58px] min-[1700px]:text-[64px]"><span className="site-gradient-text">Even at 1 AM.</span></span>
          </h1>
          <p className="mt-5 text-base sm:text-[17px] min-[1700px]:text-lg leading-relaxed max-w-[35rem] mx-auto lg:mx-0" style={{ textWrap: "pretty" }}>
            Facebook, Google and WhatsApp enquiries land in one place. A WhatsApp AI agent replies in seconds,
            qualifies the buyer and books the site visit, so your team starts the day with buyers ready to talk.
          </p>
          {/* Phones: two compact buttons side by side instead of two full-width slabs. */}
          <div className="mt-7 flex flex-wrap gap-2.5 sm:gap-3 justify-center lg:justify-start">
            {/* The free trial lives in the header; the hero asks for a demo. */}
            <SiteButton to="/book-demo" className="!px-6 text-[15px] sm:!px-8 sm:min-h-[3.5rem] sm:text-base">
              Book a Demo <ArrowRight className="w-4 h-4" />
            </SiteButton>
          </div>
          <ul className="mt-4 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-[13px] sm:text-sm site-muted">
            {["14-day free trial", "No credit card", "Made in Pune"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5"><CircleCheck className="w-4 h-4" style={{ color: "#16a34a" }} aria-hidden="true" />{t}</li>
            ))}
          </ul>
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
  { Logo: FacebookLogo, label: "Facebook & Instagram" },
  { Logo: GoogleLogo, label: "Google forms", note: "Enterprise" },
  { Logo: WhatsAppLogo, label: "WhatsApp" },
  { Icon: Globe, label: "Website forms" },
  { Icon: QrCode, label: "QR codes" },
  { Icon: FileSpreadsheet, label: "Excel & CSV" },
  { Icon: Store, label: "Walk-ins" },
  { Icon: MessageCircle, label: "Click-to-WhatsApp", note: "Enterprise" },
];

function WorksWith() {
  return (
    <Section tone="tint" className="!py-8 sm:!py-10" aria-label="Lead sources Arthaleads works with">
      <Container className="!max-w-[1400px]">
        <Reveal className="flex flex-col items-center gap-4">
          <p className="text-center text-[13px] site-muted">
            <span className="font-display text-[15px] font-bold site-ink">Every lead source, one list.</span>{" "}
            <span className="hidden sm:inline">Portal leads (99acres, MagicBricks, Housing.com) come in by sheet import.</span>
          </p>
          <ul className="flex flex-wrap justify-center gap-2 lg:gap-1.5 xl:gap-2">
            {SOURCES.map(({ Logo, Icon, label, note }) => (
              <li key={label} className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-[12.5px] xl:text-[13px] font-medium site-ink"
                style={{ background: "var(--site-card)", border: "1px solid var(--site-line)", boxShadow: "var(--site-shadow-sm)" }}>
                {Logo ? <Logo className="w-4 h-4 shrink-0" /> : <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />}
                <span className="whitespace-nowrap">{label}{note && <span className="text-[11px] font-normal site-muted"> · {note}</span>}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}

// ── 3. AI that works the night shift (dark band) ──────────────────────────────
const AI_POINTS = [
  { Icon: Bot, title: "WhatsApp AI agent", body: "Replies 24/7 in four languages and books the site visit." },
  { Icon: MessageCircle, title: "AI lead scoring", body: "Scores each buyer from the chat, with a one-line reason." },
  { Icon: Sparkles, title: "Artha, your AI copilot", body: "Ask about your pipeline by text or voice, apply in one tap." },
];

function AiBand() {
  return (
    <Section tone="dark" className="ai-band overflow-hidden !py-14 lg:!py-[clamp(3rem,7vh,4rem)]">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(45% 50% at 20% 35%, rgba(255,107,0,0.2), transparent 70%), radial-gradient(40% 45% at 90% 85%, rgba(255,140,60,0.1), transparent 70%)" }} />
      {/* Orange threads drift behind the cards; faded out at the top so the heading stays clean. */}
      <LiveBackground kind="threads" color="#ff6b00" accentColor="#ffb27a" amplitude={1.3} distance={0.32} lineCount={70}
        thickness={0.55} speed={0.45} angle={12} brightness={1.2} opacity={0.55}
        style={{ WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 38%, #000 85%, transparent 100%)", maskImage: "linear-gradient(180deg, transparent 0%, #000 38%, #000 85%, transparent 100%)" }} />
      <Container className="relative">
        {/* Desktop: heading, text and cards on the left, the phone alone on the right.
            Phones: heading, then the phone, then the cards (DOM order). */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_1fr] gap-x-10 xl:gap-x-16 gap-y-8">
          <SectionHeader eyebrow="AI that works the night shift" title={<>Your best salesperson <span className="site-dim">never sleeps.</span></>}
            lede="Most enquiries arrive after office hours. Arthaleads answers every one and tells your team who to call first. On Growth and above."
            className="!mb-0 lg:col-start-1 lg:row-start-1">
            <Link to="/ai-crm" className="site-link text-[15px] mt-4">See everything the AI does <ArrowRight className="w-4 h-4" /></Link>
          </SectionHeader>
          <Reveal className="mx-auto w-full lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center" style={{ maxWidth: "var(--hc-w)" }}>
            <HeroChat />
          </Reveal>
          <div className="grid gap-4 min-w-0 lg:col-start-1 lg:row-start-2 lg:self-end">
            <div className="grid sm:grid-cols-2 gap-4">
              <Reveal delay={80} className="h-full"><ScoreCard /></Reveal>
              <Reveal delay={160} className="h-full"><CopilotCard /></Reveal>
            </div>
            <ul className="grid sm:grid-cols-3 gap-4">
              {AI_POINTS.map(({ Icon, title, body }, i) => (
                <Reveal as="li" key={title} delay={i * 90}>
                  <Card glow className="h-full p-4 flex gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.14)", boxShadow: "inset 0 0 0 1px rgba(255,138,61,0.25)" }}>
                      <Icon className="w-[18px] h-[18px]" style={{ color: "#ff8a3d" }} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <h3 className="font-display text-[15px] font-bold site-ink leading-tight mb-1">{title}</h3>
                      <p className="text-[13px] leading-snug">{body}</p>
                    </span>
                  </Card>
                </Reveal>
              ))}
            </ul>
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
        <SectionHeader eyebrow="One workspace" title={<>From first message to booking.<br className="hidden sm:block" /> <span className="site-dim">In one place.</span></>}
          lede="Everything a property sales team uses every day, built for how builders, brokers and channel partners in India actually sell."
          action={<Link to="/features" className="site-link text-[15px]">See every feature <ArrowRight className="w-4 h-4" /></Link>} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_CARDS.map(({ title, body, Viz, wide }, i) => (
            <Reveal key={title} delay={(i % 3) * 90} className={wide ? "min-w-0 lg:col-span-2" : "min-w-0"}>
              <Card glow className="h-full p-3 flex flex-col">
                <Viz />
                <div className="px-3 pt-5 pb-3">
                  <h3 className="font-display text-lg font-bold site-ink mb-1.5">{title}</h3>
                  <p className="text-[15px] leading-relaxed">{body}</p>
                </div>
              </Card>
            </Reveal>
          ))}
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
    <Section tone="white">
      <Container>
        <SectionHeader eyebrow="Who it is for" title={<>Built for how property<br className="hidden sm:block" /> <span className="site-dim">is sold in India.</span></>}
          lede="Builders, brokers and channel partners sell differently. Arthaleads fits each of them." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PERSONAS.map(({ img, title, body, to, link, alt }, i) => (
            <Reveal key={title} delay={i * 100} className={i === 2 ? "min-w-0 sm:col-span-2 lg:col-span-1" : "min-w-0"}>
              <Card glow as={Link} to={to} className={`group h-full overflow-hidden flex flex-col ${i === 2 ? "sm:flex-row lg:flex-col" : ""}`}>
                <div className={`overflow-hidden ${i === 2 ? "sm:w-1/2 lg:w-auto shrink-0" : ""}`}>
                  <SiteImage name={img} width={1536} height={1024} sizes="(min-width: 768px) 400px, 92vw" alt={alt}
                    className="block w-full h-full aspect-[3/2] object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="p-6 flex flex-col flex-1 justify-center lg:justify-start">
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
// Three step cards, each with a small picture of that step, joined by a line.
function StepConnect() {
  const srcs = [[FacebookLogo, "Facebook ads"], [GoogleLogo, "Google forms"], [WhatsAppLogo, "WhatsApp"], [Globe, "Website"], [FileSpreadsheet, "Excel"]];
  return (
    <div className="site-stage h-[200px] p-4 flex items-center gap-3">
      <ul className="flex-1 min-w-0 space-y-1.5">
        {srcs.map(([I, l], i) => (
          <li key={l} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium site-ink" style={{ background: "var(--site-card)", border: "1px solid var(--site-line)" }}>
            {i < 3 ? <I className="w-3.5 h-3.5 shrink-0" /> : <I className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />}
            <span className="truncate">{l}</span>
          </li>
        ))}
      </ul>
      <svg width="34" height="120" viewBox="0 0 34 120" fill="none" aria-hidden="true" className="shrink-0">
        {[12, 36, 60, 84, 108].map((y) => <path key={y} d={`M0 ${y} C 18 ${y}, 16 60, 34 60`} stroke="var(--site-brand)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 3" />)}
      </svg>
      <img src="/logo.png" alt="Arthaleads" width="56" height="56" loading="lazy" className="w-14 h-14 rounded-2xl shrink-0" style={{ boxShadow: "0 12px 28px -10px rgba(204,75,0,0.6)" }} />
    </div>
  );
}

function StepReply() {
  return (
    <div className="site-stage h-[200px] p-4 flex flex-col justify-center gap-2">
      <p className="self-start max-w-[85%] rounded-xl rounded-tl-sm px-3 py-2 text-[12px] leading-snug site-ink" style={{ background: "var(--site-card)", border: "1px solid var(--site-line)" }}>
        Is the 3 BHK in Baner ready to move?
      </p>
      <div className="self-end max-w-[88%]">
        <p className="flex items-center gap-1 justify-end text-[10px] font-semibold mb-1" style={{ color: "var(--site-brand-ink)" }}><Sparkles className="w-3 h-3" aria-hidden="true" /> AI agent · 4 sec</p>
        <p className="rounded-xl rounded-tr-sm px-3 py-2 text-[12px] leading-snug text-[#111b21]" style={{ background: "#d9fdd3" }}>
          Yes, possession in March. Would you like to see it this Sunday?
        </p>
      </div>
      <p className="self-center flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
        <CircleCheck className="w-3.5 h-3.5" aria-hidden="true" /> Visit booked · Sun 11 AM
      </p>
    </div>
  );
}

function StepClose() {
  return (
    <div className="relative h-[200px] overflow-hidden rounded-2xl" style={{ border: "1px solid var(--site-line)" }}>
      <SiteImage name="field" width={1536} height={1024} sizes="(min-width: 1024px) 380px, 92vw"
        alt="A sales executive in a hard hat checking her phone outside a residential construction site"
        className="absolute inset-0 w-full h-full object-cover object-[50%_35%]" />
      <FloatCard className="left-3 right-3 bottom-3 flex items-center gap-3 !py-2.5">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.12)" }}>
          <Phone className="w-4 h-4" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold site-ink leading-tight">Call Neha Joshi · score 81</span>
          <span className="block text-[11px] site-muted leading-tight truncate">Follow-up due 4:00 PM · 3 BHK Baner</span>
        </span>
      </FloatCard>
    </div>
  );
}

const STEPS = [
  { title: "Connect your lead sources", body: "Link Facebook lead ads and your WhatsApp Business number, add your website form, and import existing leads from Excel.", Viz: StepConnect },
  { title: "Let the AI take the first reply", body: "Tell the AI agent about your projects. It answers buyers, asks the right questions and books visits, day and night.", Viz: StepReply },
  { title: "Your team closes", body: "Agents get every lead with the chat and a score, call from the Android app, and move deals to booking.", Viz: StepClose },
];

function HowItWorks() {
  return (
    <Section tone="tint">
      <Container>
        <SectionHeader eyebrow="How it works" title={<>Live in a day,<br className="hidden sm:block" /> <span className="site-dim">not a quarter.</span></>}
          lede="No setup project and no consultants. Most teams connect their lead sources and see the AI reply on the same day."
          action={<Link to="/download-app" className="site-link text-[15px]"><Download className="w-4 h-4" /> Get the Android app</Link>} />
        <ol className="relative grid md:grid-cols-3 gap-5">
          {/* The line joining the three numbers (desktop). */}
          <span aria-hidden="true" className="hidden md:block absolute top-[27px] left-[16%] right-[16%] h-px" style={{ background: "linear-gradient(90deg, var(--site-brand), var(--site-line-strong))" }} />
          {STEPS.map(({ title, body, Viz }, i) => (
            <Reveal as="li" key={title} delay={i * 100} className="relative min-w-0">
              <div className="flex justify-center mb-5">
                <span className="font-display relative z-[1] w-14 h-14 rounded-full flex items-center justify-center text-xl font-extrabold text-white"
                  style={{ background: "var(--brand-btn)", boxShadow: "0 0 0 8px var(--site-tint), 0 14px 30px -12px rgba(204,75,0,0.7)" }}>{i + 1}</span>
              </div>
              <Card glow className="h-full p-3 flex flex-col">
                <Viz />
                <div className="px-3 pt-5 pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] site-muted mb-1.5">Step {i + 1}</p>
                  <h3 className="font-display text-lg font-bold site-ink mb-1.5">{title}</h3>
                  <p className="text-[15px] leading-relaxed">{body}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

// ── 8. Trust (no testimonials: facts only) ────────────────────────────────────
// A bento grid: one featured card (the official WhatsApp API, our strongest
// trust point) and four smaller cards, each with a small illustration.
function TrustRow({ left, right, tone, live = false }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[12.5px] ${live ? "ai-live-row" : ""}`} style={{ background: "var(--site-chip)", border: "1px solid var(--site-line)" }}>
      <span className="site-ink font-medium truncate flex items-center gap-1.5">
        {live && <Sparkles className="w-3.5 h-3.5" style={{ color: "#ff8a3d" }} aria-hidden="true" />}{left}
      </span>
      <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 shrink-0" style={tone}>{right}</span>
    </li>
  );
}
const T_GREEN = { background: "rgba(22,163,74,0.14)", color: "#16a34a" };
const T_ORANGE = { background: "rgba(255,107,0,0.13)", color: "var(--site-brand-ink)" };
const T_PLAIN = { background: "var(--site-chip)", color: "var(--site-text)" };

function TrustIcon({ Icon, green }) {
  return (
    <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
      style={green ? { background: "rgba(37,211,102,0.14)", boxShadow: "inset 0 0 0 1px rgba(37,211,102,0.3)" } : { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
      {green ? <Icon className="w-5 h-5" /> : <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />}
    </span>
  );
}

function Trust() {
  return (
    <Section tone="white">
      <Container>
        <SectionHeader eyebrow="Why teams trust it" title={<>Serious about your leads<br className="hidden sm:block" /> <span className="site-dim">and your data.</span></>}
          action={<Link to="/security" className="site-link text-[15px]">How we protect data <ArrowRight className="w-4 h-4" /></Link>} />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Reveal className="min-w-0 md:col-span-2">
            <Card glow className="site-section--dark site-feature-glow h-full p-7 sm:p-9 grid sm:grid-cols-[1fr_280px] gap-8 items-center">
              <div>
                <TrustIcon Icon={WhatsAppLogo} green />
                <h3 className="font-display text-xl sm:text-2xl font-bold site-ink mb-3">Official WhatsApp Business Platform</h3>
                <p className="text-[15px] leading-relaxed max-w-md">Your own verified business number on Meta's official API, not a grey-market tool that can get your number banned. Templates, campaigns and the AI agent run on it.</p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--site-stage)", border: "1px solid var(--site-line)" }}>
                <div className="flex items-center gap-3 mb-3.5">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(37,211,102,0.16)" }}><WhatsAppLogo className="w-5 h-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold site-ink flex items-center gap-1">Your Company <BadgeCheck className="w-4 h-4" style={{ color: "#25D366" }} aria-hidden="true" /></p>
                    <p className="text-[11.5px] site-muted">Official business account</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  <TrustRow left="Business number" right="Verified" tone={T_GREEN} />
                  <TrustRow left="Templates" right="Approved by Meta" tone={T_GREEN} />
                  <TrustRow left="AI agent" right="Live 24/7" tone={T_GREEN} live />
                </ul>
              </div>
            </Card>
          </Reveal>
          <Reveal className="min-w-0" delay={80}>
            <Card glow className="h-full p-7 flex flex-col">
              <TrustIcon Icon={Lock} />
              <h3 className="font-display text-lg font-bold site-ink mb-2">Your data stays yours</h3>
              <p className="text-[15px] leading-relaxed mb-5">Each company's data is kept apart, and you can export everything or delete your account any time.</p>
              <ul className="mt-auto space-y-1.5">
                <TrustRow left="All leads as Excel" right="Export" tone={T_ORANGE} />
                <TrustRow left="Delete account" right="Self-serve" tone={T_PLAIN} />
              </ul>
            </Card>
          </Reveal>
          <Reveal className="min-w-0">
            <Card glow className="h-full p-7 flex flex-col">
              <TrustIcon Icon={ShieldCheck} />
              <h3 className="font-display text-lg font-bold site-ink mb-2">Roles and permissions</h3>
              <p className="text-[15px] leading-relaxed mb-5">Decide who sees what, on the web and in the Android app.</p>
              <ul className="mt-auto space-y-1.5">
                <TrustRow left="Admin" right="Everything" tone={T_ORANGE} />
                <TrustRow left="Manager" right="Their team" tone={T_PLAIN} />
                <TrustRow left="Agent" right="Own leads" tone={T_PLAIN} />
              </ul>
            </Card>
          </Reveal>
          <Reveal className="min-w-0" delay={80}>
            <Card glow className="h-full p-7 flex flex-col">
              <TrustIcon Icon={MapPin} />
              <h3 className="font-display text-lg font-bold site-ink mb-2">Made in Pune</h3>
              <p className="text-[15px] leading-relaxed mb-5">Built by Vistrow Technologies for Indian sales teams, with real people answering on WhatsApp.</p>
              <ul className="mt-auto space-y-1.5">
                <TrustRow left="Built in" right="Pune, India" tone={T_ORANGE} />
                <TrustRow left="Support" right="WhatsApp and phone" tone={T_PLAIN} />
              </ul>
              <Link to="/about-us" className="site-link text-sm mt-4">About us <ArrowRight className="w-4 h-4" /></Link>
            </Card>
          </Reveal>
          <Reveal className="min-w-0" delay={160}>
            <Card glow className="h-full p-7 flex flex-col">
              <TrustIcon Icon={Repeat2} />
              <h3 className="font-display text-lg font-bold site-ink mb-2">Switching from another CRM?</h3>
              <p className="text-[15px] leading-relaxed mb-5">See how Arthaleads compares, feature by feature, and bring your leads over from Excel.</p>
              <ul className="mt-auto space-y-1.5">
                {[["Sell.Do", "/compare/sell-do-alternative"], ["Leadrat", "/compare/leadrat-alternative"], ["Kylas", "/compare/kylas-alternative"]].map(([n, to]) => (
                  <li key={n}>
                    <Link to={to} className="flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium site-ink transition-colors hover:border-[var(--site-brand)]"
                      style={{ background: "var(--site-chip)", border: "1px solid var(--site-line)" }}>
                      Arthaleads vs {n} <ArrowUpRight className="w-4 h-4 site-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
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
  const { isDark } = usePublicTheme();
  return (
    <Section tone="white">
      <Container>
        <Reveal>
          <div className="site-cta-panel relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-5 sm:p-10 lg:p-12 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
            <LiveBackground kind="grainient" colors={GRAIN_COLORS_PANEL} lightMode={!isDark} angle={40} flow={0.6} speed={0.5}
              silk={0.25} grainAmount={0.06} clickSwirl={false} stir={0.5}
              style={{ WebkitMaskImage: "radial-gradient(90% 120% at 100% 100%, #000 20%, transparent 75%)", maskImage: "radial-gradient(90% 120% at 100% 100%, #000 20%, transparent 75%)", opacity: isDark ? 0.9 : 0.7 }} />
            <div className="relative">
              <p className="site-eyebrow mb-4">Start today</p>
              <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[30px] sm:text-[38px] lg:text-[40px] xl:text-[44px]" style={{ textWrap: "balance" }}>
                Stop losing buyers <span className="site-dim">to whoever replies first.</span>
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-lg">Start your 14-day free trial, or message us on WhatsApp and see the AI agent answer you.</p>
              <div className="mt-8 flex gap-2 sm:gap-3">
                <SiteButton href={CRM_SIGNUP_URL} external className="!px-3.5 text-[14px] sm:!px-7 sm:min-h-[3.5rem] sm:text-base">Start free trial <ArrowRight className="w-4 h-4" /></SiteButton>
                <SiteButton to="/book-demo" variant="secondary" className="!px-3.5 text-[14px] sm:!px-7 sm:min-h-[3.5rem] sm:text-base">
                  <CalendarCheck2 className="w-[18px] h-[18px]" aria-hidden="true" /> Book a demo
                </SiteButton>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm site-muted">
                {["14-day free trial", "No credit card", "Made in Pune"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5"><CircleCheck className="w-4 h-4" style={{ color: "#16a34a" }} aria-hidden="true" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
                <SiteImage name="keys" width={1600} height={900} sizes="(min-width: 1024px) 520px, 92vw" alt="A sales executive handing house keys to a young couple"
                  className="block w-full h-auto aspect-[16/10] object-cover" />
              </div>
              <FloatCard className="left-3 bottom-3 sm:-left-5 sm:bottom-6 flex items-center gap-3 !py-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(22,163,74,0.12)" }}>
                  <BadgeCheck className="w-[18px] h-[18px]" style={{ color: "#16a34a" }} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold site-ink leading-tight">Booking confirmed</p>
                  <p className="text-[11px] site-muted leading-tight">Flat 1204 · Aurum Heights</p>
                </div>
              </FloatCard>
            </div>
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
      <FilmSection />
      <BuiltFor />
      <HowItWorks />
      <Trust />
      <Faq />
      <FinalCta />
    </SitePage>
  );
}
