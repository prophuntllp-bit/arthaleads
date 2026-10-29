// pages/Features.jsx - the full product feature catalogue, on the shared
// marketing theme (components/site/*).
//
// Organised by the job a sales team is doing, in order. A sticky progress bar
// follows you down the page; each workflow shows a coded illustration of that
// job (the same ones as the home page; owner rule: no real CRM screenshots)
// beside its heading, with the individual features as cards underneath.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, Phone } from "lucide-react";
import { FEATURES, FEATURE_GROUPS } from "../data/features";
import { SitePage, Section, Container, Card } from "../components/site/Site";
import { PageHero, PhotoVisual, ClosingCta } from "../components/site/Blocks";
import { ScoreCard, CopilotCard, CaptureViz, PipelineViz, ProjectViz, TeamViz, BookingViz, VisitViz } from "../components/site/HomeVisuals";
import { WhatsAppLogo } from "../components/site/BrandLogos";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";

/** Coded visuals on a glass panel, stacked. */
function VizPanel({ children }) {
  return (
    <div className="relative mx-auto w-full max-w-[560px] px-3 sm:px-6 lg:px-0">
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative grid gap-3">{children}</div>
    </div>
  );
}

// The illustration for each workflow. "control" has none: it is about trust, not a screen.
const VISUAL = {
  capture:    () => <VizPanel><CaptureViz /></VizPanel>,
  prioritise: () => <VizPanel><div className="grid sm:grid-cols-2 gap-3"><ScoreCard /><CopilotCard /></div></VizPanel>,
  talk:       () => (
    <PhotoVisual name="broker" priority={false} alt="A property broker replying to a buyer on WhatsApp from the office"
      cards={[
        { Icon: WhatsAppLogo, iconColor: "#25D366", iconBg: "rgba(37,211,102,0.12)", title: "AI agent replied in 4 sec", sub: "Shared team inbox", cycle: [{ title: "Neha took over the chat", sub: "Shared team inbox" }, { title: "Brochure sent", sub: "Riverview Heights · PDF" }] },
        { Icon: Sparkles, title: "Follow-up drafted", sub: "Ready to send" },
        { Icon: Phone, iconColor: "#16a34a", iconBg: "rgba(22,163,74,0.12)", title: "Call logged · 4 min 12 sec", sub: "Recording on the lead", cycle: [{ title: "Call logged · 2 min 48 sec", sub: "Site visit discussed" }, { title: "Missed call returned", sub: "Logged on the lead" }] },
      ]} />
  ),
  projects:   () => <VizPanel><ProjectViz /><PipelineViz /></VizPanel>,
  close:      () => <VizPanel><BookingViz /><VisitViz /></VizPanel>,
  team:       () => <VizPanel><TeamViz /></VizPanel>,
};

function Workflow({ group, index }) {
  const items = FEATURES.filter((f) => f.group === group.id);
  const Visual = VISUAL[group.id];
  const flip = index % 2 === 1;
  // A six-column grid so every row is full: 4 cards = 2 + 2, 5 = 2 + 3, 6 = 3 + 3, 3 = 3.
  const spanFor = (i, n) => (n === 5 ? (i < 2 ? "lg:col-span-3" : "lg:col-span-2") : n === 4 ? "lg:col-span-3" : "lg:col-span-2");

  return (
    <Section as="section" id={`group-${group.id}`} tone={index % 2 ? "tint" : "white"} aria-labelledby={`group-${group.id}-title`} className="!scroll-mt-36 overflow-x-clip">
      <Container>
        <div className={`grid ${Visual ? "lg:grid-cols-2 items-center" : "max-w-3xl"} gap-10 lg:gap-16 mb-10 lg:mb-14`}>
          <Reveal className={`min-w-0 ${flip ? "lg:order-2" : ""}`}>
            <p className="flex items-center gap-3 mb-4">
              <span className="font-display w-9 h-9 rounded-full text-white text-sm font-extrabold flex items-center justify-center tabular-nums"
                style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{index + 1}</span>
              <span className="site-eyebrow">{group.label}</span>
            </p>
            <h2 id={`group-${group.id}-title`} className="font-display site-ink text-[30px] sm:text-[38px] lg:text-[42px] font-extrabold leading-[1.1] tracking-[-0.02em] mb-4" style={{ textWrap: "balance" }}>
              {group.title}
            </h2>
            <p className="text-base sm:text-lg leading-relaxed max-w-xl">{group.blurb}</p>
            {Visual && (
              <ul className="mt-6 space-y-2.5">
                {items.slice(0, 3).map((f) => (
                  <li key={f.title} className="flex items-start gap-3 text-[15px] site-ink font-medium">
                    <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: "#16a34a" }} strokeWidth={3} aria-hidden="true" />{f.title}
                  </li>
                ))}
              </ul>
            )}
            {group.more && (
              <Link to={group.more.to} className="site-link mt-6">{group.more.label} <ArrowRight className="w-4 h-4" /></Link>
            )}
          </Reveal>
          {Visual && (
            <Reveal delay={120} className={`min-w-0 ${flip ? "lg:order-1" : ""}`}><Visual /></Reveal>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {items.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title} delay={(i % 3) * 70} className={`min-w-0 flex ${spanFor(i, items.length)}`}>
                <Card as="article" glow className="w-full p-6">
                  <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
                    <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <h3 className="font-display font-bold text-[17px] site-ink mb-2 leading-snug">{f.title}</h3>
                  <p className="text-[15px] leading-relaxed">{f.desc}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

export default function Features() {
  const [active, setActive] = useState(FEATURE_GROUPS[0].id);
  const navRef = useRef(null);

  useSEO({
    title: "Real Estate CRM Features for Indian Sales Teams | Arthaleads",
    description: "Every feature of the Arthaleads real estate CRM: lead capture from ads, WhatsApp and your website, lead scoring, campaigns, call intelligence and bookings.",
    canonical: "https://www.arthaleads.com/features",
  });

  // Which workflow is on screen drives the progress bar: the last one whose top
  // has passed 40% of the screen. Looked up by id on every check, because
  // hydration can swap the prerendered nodes an observer would have held.
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const line = window.innerHeight * 0.4;
      let id = FEATURE_GROUPS[0].id;
      for (const g of FEATURE_GROUPS) {
        const el = document.getElementById(`group-${g.id}`);
        if (el && el.getBoundingClientRect().top <= line) id = g.id;
      }
      setActive(id);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // Keep the active step in view where the bar scrolls sideways (phones).
  useEffect(() => {
    const bar = navRef.current;
    const el = bar?.querySelector(`[data-id="${active}"]`);
    if (!bar || !el || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const jump = (id) => document.getElementById(`group-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const activeIndex = FEATURE_GROUPS.findIndex((g) => g.id === active);

  return (
    <SitePage>
      <PageHero
        eyebrow={`${FEATURES.length} features, one workspace`}
        title={<>From the first enquiry to the <span className="site-dim">paid invoice</span></>}
        lede="Real estate CRM software built for Indian sales teams, from small channel partner offices to large builder and developer sales floors. Here is everything Arthaleads does, in the order your team uses it."
        actions={[
          { label: "Walk through the workflow", href: "#group-capture" },
          { label: "Book a Demo", to: "/book-demo" },
        ]}
        trust={["Android app included", "One workspace for the whole team", "14-day free trial"]}
      />

      {/* Sticky workflow progress */}
      <div className="features-steps sticky z-30">
        <Container>
          <nav ref={navRef} aria-label="Workflow steps" className="relative flex items-center gap-1 overflow-x-auto py-3 lg:justify-center" style={{ scrollbarWidth: "none" }}>
            {FEATURE_GROUPS.map((g, i) => {
              const on = g.id === active;
              const done = i < activeIndex;
              return (
                <div key={g.id} className="flex items-center shrink-0">
                  <button type="button" data-id={g.id} onClick={() => jump(g.id)} aria-current={on ? "step" : undefined}
                    className={`flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00] ${on ? "" : "site-muted"}`}
                    style={on ? { background: "rgba(255,107,0,0.12)", color: "var(--site-brand-ink)" } : undefined}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums transition-colors"
                      style={on || done ? { background: "var(--brand-btn)", color: "#fff" } : { background: "var(--site-chip)" }}>
                      {done ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
                    </span>
                    {g.label}
                  </button>
                  {i < FEATURE_GROUPS.length - 1 && <span className="w-4 sm:w-8 h-px mx-0.5 transition-colors" style={{ background: done ? "var(--site-brand)" : "var(--site-line-strong)" }} />}
                </div>
              );
            })}
          </nav>
        </Container>
      </div>

      {FEATURE_GROUPS.map((g, i) => <Workflow key={g.id} group={g} index={i} />)}

      <ClosingCta title="See it running" dim="on your own leads."
        body="Book a 30-minute demo and we will set Arthaleads up on your real leads, or start the 14-day free trial and have your team calling the same day." />
      <Section tone="white" className="!pt-0 !pb-14">
        <Container>
          <p className="text-sm text-center">
            <span className="site-muted">Moving from another CRM? See how Arthaleads compares with </span>
            <Link to="/compare/sell-do-alternative" className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>Sell.Do</Link>,{" "}
            <Link to="/compare/leadrat-alternative" className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>Leadrat</Link> and{" "}
            <Link to="/compare/kylas-alternative" className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>Kylas</Link>.
          </p>
          <p className="text-sm text-center mt-3">
            <span className="site-muted">Guides: </span>
            <Link to="/blog/real-estate-lead-management-enquiry-to-site-visit" className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>real estate lead management, enquiry to site visit</Link>
            <span className="site-muted"> · </span>
            <Link to="/blog/best-real-estate-crm-software-india" className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>choosing a real estate CRM in India</Link>
          </p>
        </Container>
      </Section>
    </SitePage>
  );
}
