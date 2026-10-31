// pages/Features.jsx - the full product feature catalogue, on the shared
// marketing theme (components/site/*).
//
// Organised by the job a sales team is doing, in order. A sticky progress bar
// follows you down the page; each workflow shows a coded illustration of that
// job (the same ones as the home page; owner rule: no real CRM screenshots)
// beside its heading, with the individual features as cards underneath.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, Phone, ChevronDown } from "lucide-react";
import { FEATURES, FEATURE_GROUPS } from "../data/features";
import { SitePage, Section, Container, Card, SectionHeader } from "../components/site/Site";
import { PageHero, PhotoVisual, FaqSection, ClosingCta } from "../components/site/Blocks";
import { ScoreCard, CopilotCard, CaptureViz, PipelineViz, ProjectViz, TeamViz, BookingViz, VisitViz } from "../components/site/HomeVisuals";
import { WhatsAppLogo } from "../components/site/BrandLogos";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING, formatINR } from "../utils/plan";

// The questions buyers ask about the feature set. Shown on the page and sent to
// search engines as FAQPage data, so keep the two the same text.
const FAQS = [
  ["Which lead sources does Arthaleads bring in automatically?",
   "Facebook and Instagram lead ads, new WhatsApp chats, website forms (through the WordPress plugin or the API) and each project's QR code come in automatically. Google Ads lead forms come in on Enterprise. Leads from 99acres, MagicBricks and Housing.com are imported from the portal's CSV or Excel export."],
  ["Does Arthaleads reply to buyers on WhatsApp by itself?",
   "Yes, on Growth and above. A WhatsApp AI agent replies day and night, asks about budget, need and timeline, shares the brochure and location and can book the site visit. Your team works from one shared inbox and can take over any chat."],
  ["Is there a mobile app?",
   "Yes. An Android app is included, so your team can call leads, update follow-ups and see new leads from their phones."],
  ["Can we move our existing leads in?",
   "Yes. Import your current leads from a CSV or Excel file. Duplicate phone numbers are skipped, so the same buyer is not added twice."],
  ["How much does it cost?",
   `Starter is ${formatINR(PLAN_PRICING.starter.monthly)} and Growth is ${formatINR(PLAN_PRICING.growth.monthly)} per user per month, plus 18% GST, with a five-seat minimum. Enterprise is quoted on team size. Every team can start with a 14-day free trial.`],
];
const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(([q, a]) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
}).replace(/</g, "\\u003c");

// One short line per feature for this page (the full copy stays in
// data/features.js for other pages). UI audit 31 Oct 2026: the page was 32
// paragraphs long; every card now carries one sentence with the key fact.
const SHORT = {
  "Unified Lead Inbox": "Facebook, WhatsApp, Google Ads, portal and walk-in leads land in one list.",
  "QR Code Lead Capture": "A scan of a project's QR code becomes a lead, with the source tagged.",
  "Duplicate Prevention": "Duplicate phone numbers are skipped, even in different formats.",
  "Connection Health & Repair": "See which sources are live, and fix or reconnect them in one place.",
  "AI Lead Scoring": "Every lead scored 0 to 100, with the hottest shown each morning.",
  "Smart Alerts & Follow-ups": "Red for overdue, amber for due today, and a push for every new lead.",
  "Search Everything": "Ctrl+K finds any lead by name or phone from any page.",
  "Admin Intelligence Dashboard": "Stale leads, revenue forecast, lead trends and clock-ins on one screen.",
  "AI WhatsApp Draft": "AI writes a personal WhatsApp message; your agent checks it and sends.",
  "WhatsApp Consent": "Campaigns skip anyone who said no to WhatsApp messages.",
  "WhatsApp Credits & Statements": "Prepaid credits, online top-ups and a statement of every charge.",
  "WhatsApp Business Settings": "Business profile, hours, away message and chat auto-assignment.",
  "AI Call Intelligence": "Calls are transcribed, summarised and scored, and can move the lead's stage.",
  "Telecaller Workflow": "Remarks, call outcomes and follow-ups for your calling team.",
  "Lead Pipeline": "Drag leads from New to Site Visit to Closed Won on a kanban board.",
  "Project Management": "Each project keeps its own leads, team, brochures and floor plans.",
  "Move Leads Between Projects": "Move a lead to another project with its notes and history.",
  "Project WhatsApp History": "Read a project lead's full WhatsApp chat without leaving the project.",
  "Project Dump Recovery": "Leads removed from a project can be restored in one click.",
  "Dump Review & Clean-up": "Deleted leads wait in the Dump until you restore or remove them.",
  "Booking & Invoice Engine": "A closed deal becomes a branded PDF invoice with brokerage and GST.",
  "Invoice Numbers & Status": "Invoices are numbered and tracked from draft to payment received.",
  "Developer Partners": "Each developer's default brokerage fills in on every booking.",
  "Meta Conversions API": "Send site visits and closed deals back to Meta so your ads find similar buyers.",
  "Team Management": "Admin, Manager and Agent roles, with attendance and performance in one panel.",
  "Seat Usage": "See paid and used seats; deactivating someone frees a seat.",
  "Tasks": "Assign tasks linked to a lead or project, with a due date.",
  "Attendance & Selfie Clock-In": "Field agents clock in from their phone with a selfie and location.",
  "Performance Analytics": "Lead sources, conversion and follow-up completion, per team member.",
  "Secure & Multi-tenant": "Every company's data is kept apart, and agents see only their own leads.",
  "AI Copilot & Help Bot": "Ask questions about your own CRM data on any page.",
  "Support Tickets": "Raise a ticket with screenshots and follow every reply in one thread.",
};
const short = (f) => SHORT[f.title] || f.desc;

// The three cards each step leads with; the rest fold into "More in this step".
const PRIMARY = new Set(["AI WhatsApp Draft", "AI Call Intelligence", "Telecaller Workflow", "Lead Pipeline", "Project Management",
  "Move Leads Between Projects", "Team Management", "Attendance & Selfie Clock-In", "Performance Analytics"]);
function splitItems(items) {
  const lead = items.filter((f) => PRIMARY.has(f.title));
  const ordered = lead.length ? [...lead, ...items.filter((f) => !PRIMARY.has(f.title))] : items;
  return [ordered.slice(0, 3), ordered.slice(3)];
}

/** Coded visuals on a glass panel, stacked. lg:mx-5 keeps the glass frame inside the container. */
function VizPanel({ children }) {
  return (
    <div className="relative mx-auto w-full max-w-[560px] px-3 sm:px-6 lg:px-0 lg:mx-5 lg:w-auto">
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
    <div className="lg:mx-5">
      <PhotoVisual name="broker" priority={false} alt="A property broker replying to a buyer on WhatsApp from the office"
        cards={[
          { Icon: WhatsAppLogo, iconColor: "#25D366", iconBg: "rgba(37,211,102,0.12)", title: "AI agent replied in 4 sec", sub: "Shared team inbox", cycle: [{ title: "Neha took over the chat", sub: "Shared team inbox" }, { title: "Brochure sent", sub: "Riverview Heights · PDF" }] },
          { Icon: Sparkles, title: "Follow-up drafted", sub: "Ready to send" },
          { Icon: Phone, iconColor: "#16a34a", iconBg: "rgba(22,163,74,0.12)", title: "Call logged · 4 min 12 sec", sub: "Recording on the lead", cycle: [{ title: "Call logged · 2 min 48 sec", sub: "Site visit discussed" }, { title: "Missed call returned", sub: "Logged on the lead" }] },
        ]} />
    </div>
  ),
  projects:   () => <VizPanel><ProjectViz /><PipelineViz /></VizPanel>,
  close:      () => <VizPanel><BookingViz /><VisitViz /></VizPanel>,
  team:       () => <VizPanel><TeamViz /></VizPanel>,
};

const ICON_BOX = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

function Workflow({ group, index }) {
  const items = FEATURES.filter((f) => f.group === group.id);
  const [primary, extra] = splitItems(items);
  const [open, setOpen] = useState(false);
  const Visual = VISUAL[group.id];
  const flip = index % 2 === 1;
  // White and tint alternate; Projects is the page's one signature band (sand).
  const tone = group.id === "projects" ? "sand" : index % 2 ? "tint" : "white";
  const extraId = `group-${group.id}-more`;

  return (
    <Section as="section" id={`group-${group.id}`} tone={tone} aria-labelledby={`group-${group.id}-title`} className="!scroll-mt-36 overflow-x-clip">
      <Container>
        <div className={`grid ${Visual ? "lg:grid-cols-2 items-center" : "max-w-3xl"} gap-10 lg:gap-16 mb-8 lg:mb-12`}>
          <Reveal className={`min-w-0 ${flip ? "lg:order-2" : ""}`}>
            <p className="flex items-center gap-3 mb-4">
              <span className="font-display w-9 h-9 rounded-full text-white text-sm font-extrabold flex items-center justify-center tabular-nums"
                style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{index + 1}</span>
              <span className="site-eyebrow">{group.label}</span>
            </p>
            <h2 id={`group-${group.id}-title`} className="site-h2 !mb-4">{group.title}</h2>
            <p className="text-base sm:text-lg leading-relaxed max-w-xl">{group.blurb}</p>
            {group.more && (
              <Link to={group.more.to} className="site-link mt-3 min-h-[44px]">{group.more.label} <ArrowRight className="w-4 h-4" /></Link>
            )}
          </Reveal>
          {Visual && (
            <Reveal delay={120} className={`min-w-0 ${flip ? "lg:order-1" : ""}`}><Visual /></Reveal>
          )}
        </div>

        {/* One grid everywhere: 3 per row on desktop, 2 compact per row on phones. */}
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {primary.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal as="li" key={f.title} delay={i * 70} className={`min-w-0 flex ${i === 2 ? "col-span-2 lg:col-span-1" : ""}`}>
                <Card as="article" glow className="w-full p-4 sm:p-6">
                  <span className="site-icon w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-3 sm:mb-4" style={ICON_BOX}>
                    <Icon className="w-[18px] h-[18px] sm:w-5 sm:h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <h3 className="site-h4 !mb-1.5">{f.title}</h3>
                  <p className="text-[13px] sm:text-[15px] leading-snug sm:leading-relaxed">{short(f)}</p>
                </Card>
              </Reveal>
            );
          })}
        </ul>

        {extra.length > 0 && (
          <div className="mt-4 sm:mt-5">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={extraId}
              className="inline-flex items-center gap-2 min-h-[44px] -ml-1 px-1 text-[15px] font-semibold rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
              style={{ color: "var(--site-brand-ink)" }}>
              More in this step <span className="site-muted font-medium">({extra.length})</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {/* Titles always show; the one-line descriptions open on demand (kept in the HTML for crawlers). */}
            <ul id={extraId} className="mt-2 grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 [&>li:last-child:nth-child(odd)]:col-span-2 lg:[&>li:last-child:nth-child(odd)]:col-span-1">
              {extra.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.title} className="min-w-0 flex">
                    <Card className="w-full flex items-start gap-3 px-3.5 py-3 sm:px-4">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={ICON_BOX}>
                        <Icon className="w-4 h-4" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 self-center">
                        <h3 className="site-h4 !text-[15px] sm:!text-base">{f.title}</h3>
                        <span className={open ? "block mt-1 text-[13px] sm:text-sm leading-snug" : "sr-only"}>{short(f)}</span>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Container>
    </Section>
  );
}

export default function Features() {
  const [active, setActive] = useState(FEATURE_GROUPS[0].id);
  const navRef = useRef(null);
  // Phones: the step bar slides away while you scroll down and comes back on
  // the way up (UI audit: 137px of sticky bars on /features). `fade` marks the
  // sides of the bar that have more steps to scroll to.
  const [barHidden, setBarHidden] = useState(false);
  const [fade, setFade] = useState({ left: false, right: false });

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
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 8) { setBarHidden(y > lastY && y > 400); lastY = y; }
      if (!raf) raf = requestAnimationFrame(check);
    };
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

  // Edge fades on the sideways-scrolling bar.
  useEffect(() => {
    const bar = navRef.current;
    if (!bar) return undefined;
    const update = () => setFade({ left: bar.scrollLeft > 4, right: bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4 });
    update();
    bar.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { bar.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  const mask = fade.left || fade.right
    ? `linear-gradient(90deg, ${fade.left ? "transparent 0, #000 32px" : "#000 0"}, ${fade.right ? "#000 calc(100% - 40px), transparent 100%" : "#000 100%"})`
    : undefined;

  const jump = (id) => document.getElementById(`group-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const activeIndex = FEATURE_GROUPS.findIndex((g) => g.id === active);

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />
      <PageHero
        eyebrow={`${FEATURES.length} features, one workspace`}
        title={<>From the first enquiry to the <span className="site-dim">paid invoice</span></>}
        lede="Real estate CRM software for Indian sales teams, from channel partner offices to builder sales floors. Everything Arthaleads does, in the order your team uses it."
        actions={[
          { label: "Walk through the workflow", href: "#group-capture" },
          { label: "Book a Demo", to: "/book-demo" },
        ]}
        trust={["Android app included", "One workspace for the whole team", "14-day free trial"]}
      />

      {/* Short answer first: what search snippets and AI answers quote */}
      <Section tone="tint">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16">
          <SectionHeader eyebrow="The short answer" title="What is a real estate CRM?" className="!mb-0" />
          <Reveal delay={100} className="space-y-4 text-base sm:text-[17px] leading-relaxed">
            <p className="site-ink font-medium">A real estate CRM keeps every property enquiry in one place, whether it came from an ad, WhatsApp, a portal or your website. It gives each lead an owner, reminds your team when to follow up, and tracks every buyer from the first message through the site visit to the booking.</p>
            <p>Arthaleads is a real estate CRM built for Indian builders, developers and channel partners.</p>
          </Reveal>
        </Container>
      </Section>

      {/* Sticky workflow progress */}
      <div className={`features-steps sticky z-30 transition-transform duration-300 ${barHidden ? "max-md:-translate-y-[calc(100%+80px)] max-md:pointer-events-none" : ""}`}>
        <Container>
          <nav ref={navRef} aria-label="Workflow steps" className="relative flex items-center gap-1 overflow-x-auto py-1.5 sm:py-2 lg:justify-center" style={{ scrollbarWidth: "none", WebkitMaskImage: mask, maskImage: mask }}>
            {FEATURE_GROUPS.map((g, i) => {
              const on = g.id === active;
              const done = i < activeIndex;
              return (
                <div key={g.id} className="flex items-center shrink-0">
                  <button type="button" data-id={g.id} onClick={() => jump(g.id)} aria-current={on ? "step" : undefined}
                    className={`flex items-center gap-2 min-h-[44px] pl-2 pr-3.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00] ${on ? "" : "site-muted"}`}
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

      <FaqSection title="Feature questions, answered" items={FAQS} />

      <ClosingCta title="See it running" dim="on your own leads."
        body="Book a 30-minute demo on your own leads, or start the 14-day free trial and have your team calling today." />
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
