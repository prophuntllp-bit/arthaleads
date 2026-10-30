// components/site/Blocks.jsx - page-level building blocks of the shared
// marketing theme, used by every page after the home page (Oct 2026).
//
//   <PageHero>     eyebrow + H1 (two-tone) + lede + actions, with an optional
//                  visual on the warm glass stage (same look as the home hero)
//   <PhotoVisual>  an AI photo on the glass panel with floating UI cards
//   <FaqSection>   accordion FAQ; answers stay in the HTML for crawlers
//   <ClosingCta>   the closing panel: Book a Demo first, free trial second
//
// Owner rules that apply to every page: no real CRM screenshots (AI photos and
// coded illustrations only), no fake social proof, no eyebrow pills, Book a
// Demo is the main action.
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, CircleCheck, Plus, Minus } from "lucide-react";
import { Section, Container, SectionHeader, Card, SiteButton, SiteImage } from "./Site";
import { FloatCard, Cycle } from "./HomeVisuals";
import { Reveal } from "../motion/Motion";
import { WhatsAppLogo } from "./BrandLogos";
import { CRM_SIGNUP_URL, waLink, WA_MESSAGES } from "../../utils/crmLinks";

const cx = (...c) => c.filter(Boolean).join(" ");

/** The default pair of actions: Book a Demo (main) and the free trial. */
export function DemoActions({ className, center = false }) {
  return (
    <div className={cx("flex flex-wrap gap-2.5 sm:gap-3", center ? "justify-center" : "justify-center lg:justify-start", className)}>
      <SiteButton to="/book-demo" className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">Book a Demo <ArrowRight className="w-4 h-4" /></SiteButton>
      <SiteButton href={CRM_SIGNUP_URL} external variant="secondary" className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">Start free trial</SiteButton>
    </div>
  );
}

export function TrustLine({ items = ["14-day free trial", "No credit card", "Made in Pune"], className, center = false }) {
  return (
    <ul className={cx("flex flex-wrap gap-x-5 gap-y-2 text-[13px] sm:text-sm site-muted", center ? "justify-center" : "justify-center lg:justify-start", className)}>
      {items.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5"><CircleCheck className="w-4 h-4" style={{ color: "#16a34a" }} aria-hidden="true" />{t}</li>
      ))}
    </ul>
  );
}

/**
 * A page's own hero buttons: [{ label, to | href, external?, variant?, Icon? }].
 * The first is the main action (primary unless a variant is given, with an
 * arrow); anchors ("#id") scroll within the page. Every page passes its own
 * set, so no two heroes read the same (owner, 27 Oct 2026).
 */
export function HeroActions({ items, className, center = false }) {
  return (
    <div className={cx("flex flex-wrap gap-2.5 sm:gap-3", center ? "justify-center" : "justify-center lg:justify-start", className)}>
      {items.map(({ label, to, href, external, variant, Icon }, i) => (
        <SiteButton key={label} to={to} href={href} external={external} variant={variant || (i === 0 ? "primary" : "secondary")}
          className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">
          {Icon && <Icon className="w-[18px] h-[18px]" {...(variant === "whatsapp" ? { color: "#fff" } : {})} aria-hidden="true" />}
          {label}
          {i === 0 && !Icon && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
        </SiteButton>
      ))}
    </div>
  );
}

/**
 * Page hero. `title` is a node (use <span className="site-dim"> for the
 * gradient half). With `visual` it is two columns on the warm glass stage;
 * without, the text is centred. `actions` is the page's own button list (see
 * HeroActions) or a custom node; `trust` an optional list of short facts
 * under them. `crumb` (a breadcrumb nav) sits above the H1.
 */
export function PageHero({ eyebrow, crumb, title, lede, visual, actions, trust, children }) {
  const two = !!visual;
  return (
    <Section tone="white" className="!pt-[6.5rem] sm:!pt-32 !pb-14 sm:!pb-20 overflow-x-clip">
      <div aria-hidden="true" className="hero-warm" style={two ? undefined : { opacity: 0.55 }} />
      <Container className={cx("relative", two && "grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center")}>
        <div className={two ? "text-center lg:text-left" : "text-center max-w-3xl mx-auto"}>
          {crumb}
          {/* The label sits above the H1, not inside it: inside, search engines read
              "About usBuilt for ..." as one heading (audit, 29 Oct 2026). */}
          {eyebrow && <p className="site-eyebrow mb-3 sm:mb-4">{eyebrow}</p>}
          <h1 className="font-display site-ink font-extrabold tracking-[-0.03em]">
            <span className="block text-[34px] leading-[1.08] sm:text-[46px] lg:text-[52px]" style={{ textWrap: "balance" }}>{title}</span>
          </h1>
          {lede && (
            <p className={cx("mt-5 text-base sm:text-[17px] leading-relaxed max-w-[36rem]", two ? "mx-auto lg:mx-0" : "mx-auto")} style={{ textWrap: "pretty" }}>{lede}</p>
          )}
          {Array.isArray(actions) ? <HeroActions items={actions} className="mt-7" center={!two} /> : actions}
          {Array.isArray(trust) && <TrustLine items={trust} className="mt-4" center={!two} />}
          {children}
        </div>
        {two && <div className="relative min-w-0">{visual}</div>}
      </Container>
    </Section>
  );
}

const CARD_POS = [
  "left-0 top-6 sm:-left-2 lg:-left-6 xl:-left-10",
  "hidden sm:flex right-0 lg:-right-3 xl:-right-8 top-[44%]",
  "left-2 bottom-6 sm:left-4 lg:-left-4 xl:-left-8",
];

/**
 * An AI photo (public/img/site/{name}-*.webp, 3:2) on the glass panel with
 * up to three floating cards: [{ Icon, iconColor, iconBg, title, sub, cycle? }],
 * where `cycle` is more [{ title, sub }] the card rotates through.
 */
export function PhotoVisual({ name, alt, cards = [], aspect = "aspect-[4/3]", position = "object-center", priority = true }) {
  return (
    <div className="relative mx-auto w-full max-w-[540px] px-3 sm:px-6 lg:px-0">
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative overflow-hidden rounded-[28px] border" style={{ borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
        <SiteImage name={name} width={1536} height={1024} priority={priority} sizes="(min-width: 1024px) 540px, 92vw" alt={alt}
          className={cx("block w-full h-auto object-cover", aspect, position)} />
      </div>
      {cards.slice(0, 3).map(({ Icon, iconColor = "var(--site-brand-ink)", iconBg = "rgba(255,107,0,0.12)", title, sub, cycle }, i) => (
        <FloatCard key={title} index={i} className={cx(CARD_POS[i], "flex items-center gap-3 !py-3 max-w-[260px]")}>
          {Icon && (
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
              <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} aria-hidden="true" />
            </span>
          )}
          <Cycle items={[{ title, sub }, ...(cycle || [])]} offset={600 + i * 1300}>
            {(c) => (
              <span className="min-w-0 block">
                <span className="block text-[13px] font-semibold site-ink leading-tight">{c.title}</span>
                {c.sub && <span className="block text-[11px] site-muted leading-tight mt-0.5">{c.sub}</span>}
              </span>
            )}
          </Cycle>
        </FloatCard>
      ))}
    </div>
  );
}

/** Accordion FAQ. items: [[question, answer]]. Answers stay in the HTML. */
export function FaqSection({ items, title = "Questions people ask", eyebrow = "FAQ", tone = "tint", id = "faq", aside = true }) {
  const [open, setOpen] = useState(0);
  return (
    <Section id={id} tone={tone}>
      <Container className={aside ? "grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16" : "max-w-3xl"}>
        {aside ? (
          <div className="lg:sticky lg:top-28 self-start">
            <SectionHeader eyebrow={eyebrow} title={title} className="!mb-6" lede="Anything else? Message us on WhatsApp and a real person replies." />
            <SiteButton href={waLink(WA_MESSAGES.sales)} external variant="whatsapp"><WhatsAppLogo className="w-[18px] h-[18px]" color="#fff" /> Ask on WhatsApp</SiteButton>
          </div>
        ) : (
          <SectionHeader eyebrow={eyebrow} title={title} />
        )}
        <div className="space-y-3 min-w-0">
          {items.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <Card key={q} className="overflow-hidden">
                <h3 className="m-0">
                  <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`${id}-${i}`}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-5 font-display text-[15px] sm:text-base font-bold site-ink">
                    {q}
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--site-tint)" }}>
                      {isOpen ? <Minus className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                    </span>
                  </button>
                </h3>
                <div id={`${id}-${i}`} className={isOpen ? "px-5 sm:px-6 pb-5 -mt-1" : "sr-only"}>
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

/**
 * The closing panel, as on the home page: title (with an optional gradient
 * part), body, Book a Demo + trial, and a photo on the right.
 */
// Every page has its own closing photo (owner, 27 Oct 2026: no photo used
// twice). AI-generated per outputs/site-images/cta/BRIEF.md, served as
// public/img/site/cta-*-{640,1024,1600}.webp. The home page keeps "keys".
const CTA_PHOTOS = {
  keys:                "A sales executive handing house keys to a young couple",
  "cta-ai-crm":        "A young woman on a sofa at night smiling as a reply arrives on her phone",
  "cta-builder-crm":   "A sales manager handing a project brochure to a couple at a site office",
  "cta-whatsapp-crm":  "A man at a sunlit cafe smiling as he reads a message on his phone",
  "cta-selldo":        "A developer's sales leadership meeting in a glass-walled room",
  "cta-leadrat":       "A brokerage team's morning huddle in an open office",
  "cta-kylas":         "A brokerage owner reviewing paperwork at his desk",
  "cta-pricing":       "Two business partners discussing costs over tea at their office desk",
  "cta-features":      "A telecalling team with headsets at work in a bright office",
  "cta-compare":       "Two colleagues comparing notes side by side at a coworking table",
  "cta-about":         "A small product team planning at a whiteboard in a Pune office",
  "cta-security":      "An office manager locking her laptop at a tidy desk at dusk",
  "cta-product-tour":  "A young couple watching something together on a tablet at home",
  "cta-help":          "A support specialist with a headset smiling while he helps a customer",
  "cta-api":           "A software developer reviewing code at her desk",
  "cta-updates":       "Two colleagues high-fiving as the team celebrates a win",
  "cta-refer":         "Two brokers shaking hands warmly at a cafe",
  "cta-cases":         "A builder's sales team in hard hats reviewing a site plan at a project",
};
const CTA_BY_PAGE = {
  "/ai-crm": "cta-ai-crm", "/builder-crm": "cta-builder-crm", "/whatsapp-crm": "cta-whatsapp-crm",
  "/compare/sell-do-alternative": "cta-selldo", "/compare/leadrat-alternative": "cta-leadrat", "/compare/kylas-alternative": "cta-kylas",
  "/pricing": "cta-pricing", "/features": "cta-features", "/compare": "cta-compare", "/about-us": "cta-about",
  "/security": "cta-security", "/product-tour": "cta-product-tour", "/help-guide": "cta-help", "/api-docs": "cta-api",
  "/product-updates": "cta-updates", "/refer": "cta-refer", "/case-studies": "cta-cases",
};

export function ClosingCta({
  title = "Stop losing buyers", dim = "to whoever replies first.",
  body = "Book a 30-minute demo on your own leads, or start the 14-day free trial yourself.",
  image, imageAlt, tone = "white",
}) {
  const { pathname } = useLocation();
  const photo = image || CTA_BY_PAGE[pathname.replace(/\/$/, "") || "/"] || "keys";
  const alt = imageAlt || CTA_PHOTOS[photo] || "";
  return (
    <Section tone={tone}>
      <Container>
        <Reveal>
          <div className="site-cta-panel relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-5 sm:p-10 lg:p-12 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
            <div className="relative">
              <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[30px] sm:text-[38px] lg:text-[40px] xl:text-[44px]" style={{ textWrap: "balance" }}>
                {title} {dim && <span className="site-dim">{dim}</span>}
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-lg">{body}</p>
              <DemoActions className="mt-8 !justify-start" />
              <TrustLine className="mt-6 !justify-start" />
            </div>
            <div className="relative overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
              <SiteImage name={photo} width={1600} height={900} sizes="(min-width: 1024px) 520px, 92vw" alt={alt}
                className="block w-full h-auto aspect-[16/10] object-cover" />
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
