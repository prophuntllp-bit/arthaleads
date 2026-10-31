// components/SolutionPage.jsx - shared layout for the keyword landing pages
// (/ai-crm, /builder-crm), on the shared marketing theme (components/site/*).
// Each page file holds its own copy, facts and useSEO call
// (scripts/seo-pages.mjs reads useSEO from the page file) and passes it here.
//
// Props: hero { lines: [string, string], lede, eyebrow, photo, photoAlt,
// cards: [{ Icon, title, sub, iconColor?, iconBg? }], visual? } (AI photo + coded
// cards, or a coded `visual` node instead; owner rule: no real CRM
// screenshots), answer { q, paras } (first paragraph =
// the 40-60 word definition that snippets and AI answers quote), steps
// { title, intro, items: [{ title, body }] }, features { title, intro, items:
// [{ icon, title, body, plan }] } (plan "all" = every plan), compare { title,
// intro, cols: [left, right], rows: [[row, left, right]] }, faqs { title,
// items: [[q, a]] }, related [{ to, label }], close { title, dim?, body },
// jsonLd (from solutionJsonLd below), signature { tone, layout } (optional).
//
// Signature band (UI audit 31 Oct 2026): every page alternates white/tint and
// gives ONE section a deeper tone so the three solution pages don't look alike.
// The features section carries it: tone "sand" | "dark", layout "bento" (big
// featured tile + small tiles) | "split" (the visual large beside a compact
// feature list) | "split-reverse" (the same, visual on the right).
import { Link } from "react-router-dom";
import { Check, Minus, ArrowRight } from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card } from "./site/Site";
import { PageHero, PhotoVisual, FaqSection, ClosingCta, HeroActions } from "./site/Blocks";
import { Reveal } from "./motion/Motion";

const planLabel = (plan) => (plan === "all" ? "Every plan" : `From ${plan}`);
// Desktop span for the last bento tile, by the cells left in its row once the
// 2 x 2 featured tile is counted ((n + 3) % 4 cells used in the last row).
const LAST_SPAN = { 0: "", 1: "lg:col-span-4", 2: "lg:col-span-3", 3: "lg:col-span-2" };

export default function SolutionPage({ hero, answer, steps, features, compare, faqs, related, close, jsonLd, signature }) {
  const sig = { tone: "sand", layout: "bento", ...signature };
  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <PageHero
        eyebrow={hero.eyebrow}
        title={<>{hero.lines[0]}{" "}<span className="site-dim">{hero.lines[1]}</span></>}
        lede={hero.lede}
        visual={hero.visual || <PhotoVisual name={hero.photo} alt={hero.photoAlt} cards={hero.cards} />}
        actions={hero.actions && <HeroActions items={hero.actions} className="mt-7 max-w-[36rem] mx-auto lg:mx-0 [&>*]:grow [&>*]:basis-56" />}
        trust={hero.trust}
      />

      {/* Short answer first: what search snippets and AI answers quote */}
      <Section tone="tint">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16">
          <SectionHeader eyebrow="The short answer" title={answer.q} className="!mb-0" />
          <Reveal delay={100} className="space-y-4 text-base sm:text-[17px] leading-relaxed max-w-2xl">
            {answer.paras.map((p, i) => <p key={i} className={i === 0 ? "site-ink font-medium" : undefined}>{p}</p>)}
          </Reveal>
        </Container>
      </Section>

      {/* How it works */}
      <Section tone="white" id="how">
        <Container>
          <SectionHeader eyebrow="How it works" title={steps.title} lede={steps.intro} />
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.items.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 90} className="min-w-0">
                <Card glow className="h-full p-5 sm:p-6 flex gap-4 sm:block">
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold text-white shrink-0 sm:mb-5"
                    style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className="site-h4 mb-1.5 sm:mb-2">{s.title}</h3>
                    <p className="text-[15px] leading-relaxed">{s.body}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Features, each with the plan it starts on: the page's signature band */}
      <Section tone={sig.tone} id="features">
        <Container>
          <SectionHeader eyebrow="Features" title={features.title} lede={features.intro} />
          {sig.layout === "bento" ? <FeatureBento features={features} /> : <FeatureSplit features={features} reverse={sig.layout === "split-reverse"} />}
          <p className="mt-8 text-center text-sm"><Link to="/pricing" className="site-link py-3 -my-3">See plans and prices <ArrowRight className="w-4 h-4" /></Link></p>
        </Container>
      </Section>

      {/* Comparison: a real <table> with text cells so crawlers read both columns */}
      <Section tone="white">
        <Container>
          <SectionHeader eyebrow="Side by side" title={compare.title} lede={compare.intro} />
          <div className="sm:hidden space-y-3">
            {compare.rows.map(([row, left, right]) => (
              <Card key={row} className="p-4">
                <h3 className="site-h4 mb-2">{row}</h3>
                <p className="flex gap-2 text-sm mb-1.5"><Minus className="w-4 h-4 mt-0.5 shrink-0 site-muted" aria-hidden="true" /><span><span className="font-medium site-ink">{compare.cols[0]}:</span> {left}</span></p>
                <p className="flex gap-2 text-sm"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--site-green)" }} aria-hidden="true" /><span><span className="font-medium site-ink">{compare.cols[1]}:</span> {right}</span></p>
              </Card>
            ))}
          </div>
          <Reveal className="hidden sm:block">
            <Card raised className="overflow-hidden" style={{ background: "var(--site-card)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--site-line)" }}>
                    <th scope="col" className="text-left p-4 w-[22%]"><span className="sr-only">Topic</span></th>
                    <th scope="col" className="text-left font-semibold p-4 w-[36%] site-muted">{compare.cols[0]}</th>
                    <th scope="col" className="text-left font-bold p-4 site-ink" style={{ background: "rgba(255,107,0,0.06)" }}>{compare.cols[1]}</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.rows.map(([row, left, right], i) => (
                    <tr key={row} style={i < compare.rows.length - 1 ? { borderBottom: "1px solid var(--site-line)" } : undefined}>
                      <th scope="row" className="text-left font-semibold p-4 align-top site-ink">{row}</th>
                      <td className="p-4 align-top"><span className="inline-flex gap-2"><Minus className="w-4 h-4 mt-0.5 shrink-0 site-muted" aria-hidden="true" />{left}</span></td>
                      <td className="p-4 align-top site-ink" style={{ background: "rgba(255,107,0,0.04)" }}><span className="inline-flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--site-green)" }} aria-hidden="true" />{right}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Reveal>
        </Container>
      </Section>

      <FaqSection title={faqs.title} items={faqs.items} />

      {/* Related pages: internal links for readers and crawlers */}
      <Section tone="white" className="!pt-14 !pb-0 sm:!pt-16">
        <Container>
          <p className="text-sm text-center leading-relaxed">
            <span className="site-muted">Read more: </span>
            {related.map((r, i) => (
              <span key={r.to}>
                <Link to={r.to} className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>{r.label}</Link>
                {i < related.length - 1 ? <span className="site-muted">, </span> : null}
              </span>
            ))}
          </p>
        </Container>
      </Section>

      <ClosingCta title={close.title} dim={close.dim || ""} body={close.body} />
    </SitePage>
  );
}

/** The plan chip on a feature card. */
function PlanChip({ plan, className = "" }) {
  return (
    <span className={`self-start text-[12px] font-semibold rounded-md px-2 py-1 ${className}`}
      style={plan === "all" ? { background: "linear-gradient(rgba(22,163,74,0.12), rgba(22,163,74,0.12)), var(--site-card)", color: "var(--site-green-ink)" } : { background: "linear-gradient(rgba(255,107,0,0.12), rgba(255,107,0,0.12)), var(--site-card)", color: "var(--site-brand-ink)" }}>
      {planLabel(plan)}
    </span>
  );
}

const iconWell = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

/** Bento: the first feature is the featured tile (2 x 2 on desktop, full width
    on tablets); the last one stretches to close the final row. */
function FeatureBento({ features }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:auto-rows-fr">
      {features.items.map(({ icon: Icon, title, body, plan }, i) => {
        const first = i === 0, last = i === features.items.length - 1;
        const lastSpan = last ? LAST_SPAN[(features.items.length + 3) % 4] : "";
        const tabletSpan = last && (features.items.length - 1) % 2 === 1 ? "sm:col-span-2" : "";
        return (
          <Reveal key={title} delay={(i % 4) * 80} className={`min-w-0 flex ${first ? "sm:col-span-2 lg:row-span-2" : ""} ${lastSpan} ${tabletSpan}`}>
            <Card glow className={`w-full flex flex-col ${first ? "site-feature-glow site-live-border p-7 sm:p-9" : "p-6"}`}>
              <span className={`site-icon rounded-xl flex items-center justify-center ${first ? "w-14 h-14 mb-7" : "w-11 h-11 mb-5"}`} style={iconWell}>
                <Icon className={first ? "w-7 h-7" : "w-5 h-5"} style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              </span>
              <h3 className={`${first ? "site-h3" : "site-h4"} mb-2`}>{title}</h3>
              <p className={`leading-relaxed ${first && features.visual ? "" : "flex-1"} ${first ? "site-ink text-base sm:text-[17px] max-w-md" : "text-[14px]"}`}>{body}</p>
              {first && features.visual && <div className="mt-6 flex-1 flex flex-col justify-center">{features.visual}</div>}
              <PlanChip plan={plan} className="mt-5" />
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}

/** Split: the page's visual large on one side (sticky on desktop), every
    feature as a compact card on the other. */
function FeatureSplit({ features, reverse = false }) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6 lg:gap-10 items-start">
      {features.visual && (
        <Reveal className={`min-w-0 lg:sticky lg:top-28 ${reverse ? "lg:order-2" : ""}`}>
          <Card raised className="p-3 sm:p-5">{features.visual}</Card>
        </Reveal>
      )}
      <ul className="grid sm:grid-cols-2 gap-3 min-w-0">
        {features.items.map(({ icon: Icon, title, body, plan }, i) => (
          <Reveal as="li" key={title} delay={(i % 2) * 80} className="min-w-0 flex">
            <Card className="w-full p-5 flex flex-col">
              <div className="flex items-center gap-3 mb-2.5">
                <span className="site-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={iconWell}>
                  <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                </span>
                <h3 className="site-h4">{title}</h3>
              </div>
              <p className="text-[14px] leading-relaxed flex-1">{body}</p>
              <PlanChip plan={plan} className="mt-3" />
            </Card>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

/** FAQPage + BreadcrumbList JSON-LD for a solution page, escaped for a <script> tag. */
/** A short coded WhatsApp exchange for a featured tile: [[who, text]], who = "buyer" | "ai". */
export function MiniChat({ messages, contact, note }) {
  // `contact` { name, sub } adds a WhatsApp-style chat header and `note` the
  // yellow system line: the larger form used as a page's signature visual.
  const big = !!contact;
  return (
    <div className="site-stage overflow-hidden" aria-hidden="true">
      {contact && (
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--site-card)", borderBottom: "1px solid var(--site-line)" }}>
          <span className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0" style={{ background: "#25d366" }}>
            {contact.name.split(" ").map((w) => w[0]).join("")}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold site-ink leading-tight">{contact.name}</span>
            <span className="block text-[12px] site-muted leading-tight mt-0.5 truncate">{contact.sub}</span>
          </span>
        </div>
      )}
      <div className={big ? "p-4 sm:p-6 space-y-3" : "p-4 space-y-2"}>
        {note && <p className="mx-auto w-fit max-w-[90%] text-center text-[12px] leading-snug rounded-lg px-3 py-1.5" style={{ background: "#fdf4c5", color: "#54656f" }}>{note}</p>}
        {messages.map(([who, text], i) => (
          <div key={i} className={`flex ${who === "ai" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[85%] rounded-2xl px-3.5 leading-snug ${big ? "py-2.5 text-[14px] sm:text-[15px]" : "py-2 text-[13px]"}`}
              style={who === "ai" ? { background: "#d9fdd3", color: "#0f1222", borderTopRightRadius: 6 } : { background: "var(--site-card)", color: "var(--site-ink)", border: "1px solid var(--site-line)", borderTopLeftRadius: 6 }}>
              {text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function solutionJsonLd({ name, path, faqs }) {
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.arthaleads.com/" },
        { "@type": "ListItem", position: 2, name, item: `https://www.arthaleads.com${path}` },
      ],
    },
  ]).replace(/</g, "\\u003c");
}
