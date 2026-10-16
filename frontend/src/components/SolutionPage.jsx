// components/SolutionPage.jsx - shared layout for the keyword landing pages
// (/ai-crm, /builder-crm). Each page file holds its own copy, facts and
// useSEO call (scripts/seo-pages.mjs reads useSEO from the page file), and
// passes the content here. Layout follows pages/WhatsAppCrm.jsx.
//
// Props: hero { lines: [string, string], lede, image, imageAlt, chips },
// answer { q, paras } (first paragraph = the 40-60 word definition that
// snippets and AI answers quote), steps { title, intro, items: [{ title, body }] },
// features { title, intro, items: [{ icon, title, body, plan }] } (plan "all" =
// every plan), compare { title, intro, cols: [left, right], rows: [[row, left, right]] },
// faqs { title, items: [[q, a]] }, related [{ to, label }], close { title, body },
// jsonLd (from solutionJsonLd below).
import { Link } from "react-router-dom";
import { ArrowRight, Check, Minus } from "lucide-react";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS, waLink, WA_MESSAGES } from "../utils/crmLinks";
import { Reveal, Spotlight, Magnetic } from "./motion/Motion";
import WhatsAppLogo, { waButtonClass } from "./WhatsAppLogo";

export default function SolutionPage({ hero, answer, steps, features, compare, faqs, related, close, jsonLd }) {
  const { isDark } = usePublicTheme();

  const bg = isDark ? "#0d0d1a" : "#ffffff";
  const altBg = isDark ? "#0a0a14" : "#f9fafb";
  const text = isDark ? "#ffffff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const muted = isDark ? "rgba(255,255,255,0.5)" : "#6b7280";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const linkClr = isDark ? "#fb923c" : "#c2410c";
  const green = isDark ? "#4ade80" : "#15803d";
  const iconBg = isDark ? "rgba(255,107,0,0.12)" : "#fff3ea";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-16 overflow-hidden"
        style={{ background: isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 55%, #f5f3ff 100%)" }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl motion-safe:animate-[aurora-drift_18s_ease-in-out_infinite]"
            style={{ background: "rgba(255,107,0,0.10)" }} />
          <div className="absolute -bottom-32 right-0 w-[26rem] h-[26rem] rounded-full blur-3xl motion-safe:animate-[aurora-drift_22s_ease-in-out_infinite_reverse]"
            style={{ background: isDark ? "rgba(139,92,246,0.10)" : "rgba(139,92,246,0.12)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.08] mb-6" style={{ color: text, textWrap: "balance" }}>
              {hero.lines[0]}{" "}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00] pb-1">{hero.lines[1]}</span>
            </h1>
            <p className="text-lg leading-relaxed mb-8 max-w-xl" style={{ color: soft }}>{hero.lede}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Magnetic>
                <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                  className="shine-btn w-full inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/45 transition-shadow duration-200"
                  style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                  Start 14-day free trial <ArrowRight className="w-4 h-4" />
                </a>
              </Magnetic>
              <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
                style={{ borderColor: cardBorder, color: text, background: cardBg }}>
                <WhatsAppLogo className="w-[18px] h-[18px]" /> Book a demo on WhatsApp
              </a>
            </div>
            <p className="text-sm mt-5" style={{ color: muted }}>No credit card needed. Plans from ₹599 per user per month.</p>
          </div>
          <Reveal delay={250} y={32} className="relative">
            <div className="rounded-3xl overflow-hidden border shadow-2xl motion-safe:animate-[float-soft_7s_ease-in-out_infinite]" style={{ borderColor: cardBorder }}>
              <img src={hero.image} width="2000" height="1125" loading="eager" decoding="async"
                alt={hero.imageAlt} className="w-full h-auto block" />
            </div>
            {hero.chips?.[0] && (
              <div aria-hidden="true" className="hidden sm:flex absolute -top-4 -left-4 items-center gap-2 px-3.5 py-2 rounded-xl border shadow-lg text-xs font-semibold motion-safe:animate-[float-soft_6s_ease-in-out_infinite]"
                style={{ background: cardBg, borderColor: cardBorder, color: text, animationDelay: "0.8s" }}>
                <span className="w-2 h-2 rounded-full bg-[#ff6b00]" /> {hero.chips[0]}
              </div>
            )}
            {hero.chips?.[1] && (
              <div aria-hidden="true" className="hidden sm:flex absolute -bottom-4 -right-3 items-center gap-2 px-3.5 py-2 rounded-xl border shadow-lg text-xs font-semibold motion-safe:animate-[float-soft_6.5s_ease-in-out_infinite]"
                style={{ background: cardBg, borderColor: cardBorder, color: text, animationDelay: "1.6s" }}>
                <Check className="w-3.5 h-3.5" style={{ color: green }} /> {hero.chips[1]}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── Short answer first: what search snippets and AI answers quote ── */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-5" style={{ color: text }}>{answer.q}</h2>
          </Reveal>
          <Reveal delay={120} className="space-y-4 text-base leading-relaxed" style={{ color: soft }}>
            {answer.paras.map((p, i) => <p key={i}>{p}</p>)}
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-3 text-center" style={{ color: text }}>{steps.title}</h2>
            <p className="text-base text-center max-w-2xl mx-auto mb-10" style={{ color: soft }}>{steps.intro}</p>
          </Reveal>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.items.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 110}>
                <Spotlight className="h-full rounded-2xl border p-6 transition-transform duration-300 hover:-translate-y-1" style={{ background: cardBg, borderColor: cardBorder }} color="rgba(255,107,0,0.10)">
                  <span className="inline-flex w-9 h-9 rounded-full items-center justify-center text-sm font-bold mb-4"
                    style={{ background: iconBg, color: linkClr }}>{i + 1}</span>
                  <h3 className="font-bold text-lg mb-2" style={{ color: text }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: soft }}>{s.body}</p>
                </Spotlight>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Features, each with the plan it starts on ── */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-3 text-center" style={{ color: text }}>{features.title}</h2>
            <p className="text-base text-center max-w-2xl mx-auto mb-10" style={{ color: soft }}>{features.intro}</p>
          </Reveal>
          <div className={`grid sm:grid-cols-2 ${features.items.length % 4 && !(features.items.length % 3) ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-5`}>
            {features.items.map(({ icon: Icon, title, body, plan }, i) => (
              <Reveal key={title} delay={(i % 4) * 90 + Math.floor(i / 4) * 60} className="flex">
                <Spotlight className="group w-full rounded-2xl border p-6 flex flex-col transition-transform duration-300 hover:-translate-y-1" style={{ background: cardBg, borderColor: cardBorder }} color="rgba(255,107,0,0.10)">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110" style={{ background: iconBg }}>
                    <Icon className="w-5 h-5" style={{ color: linkClr }} />
                  </span>
                  <h3 className="font-bold mb-2" style={{ color: text }}>{title}</h3>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: soft }}>{body}</p>
                  <span className="mt-4 text-xs font-semibold" style={{ color: muted }}>{plan === "all" ? "On every plan" : `From the ${plan} plan`}</span>
                </Spotlight>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison: real <table> with text cells so crawlers read both columns ── */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-3" style={{ color: text }}>{compare.title}</h2>
            <p className="text-base mb-8" style={{ color: soft }}>{compare.intro}</p>
          </Reveal>
          <div className="sm:hidden space-y-3">
            {compare.rows.map(([row, left, right], i) => (
              <Reveal key={row} delay={i * 50} y={14} className="rounded-2xl border p-4" style={{ borderColor: cardBorder, background: cardBg }}>
                <h3 className="font-semibold mb-2" style={{ color: text }}>{row}</h3>
                <p className="flex gap-2 text-sm mb-1.5" style={{ color: soft }}>
                  <Minus className="w-4 h-4 mt-0.5 shrink-0" style={{ color: muted }} /><span><span className="font-medium">{compare.cols[0]}:</span> {left}</span>
                </p>
                <p className="flex gap-2 text-sm" style={{ color: soft }}>
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: green }} /><span><span className="font-medium">{compare.cols[1]}:</span> {right}</span>
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={100} className="hidden sm:block rounded-2xl border overflow-x-auto" style={{ borderColor: cardBorder, background: cardBg }}>
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <th scope="col" className="text-left font-semibold p-4" style={{ color: muted }}> </th>
                  <th scope="col" className="text-left font-semibold p-4" style={{ color: text }}>{compare.cols[0]}</th>
                  <th scope="col" className="text-left font-semibold p-4" style={{ color: text }}>{compare.cols[1]}</th>
                </tr>
              </thead>
              <tbody>
                {compare.rows.map(([row, left, right]) => (
                  <tr key={row} className="transition-colors duration-200 hover:bg-[#ff6b00]/[0.04]" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <th scope="row" className="text-left font-semibold p-4 align-top" style={{ color: text }}>{row}</th>
                    <td className="p-4 align-top" style={{ color: soft }}>
                      <span className="inline-flex gap-2"><Minus className="w-4 h-4 mt-0.5 shrink-0" style={{ color: muted }} />{left}</span>
                    </td>
                    <td className="p-4 align-top" style={{ color: soft }}>
                      <span className="inline-flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: green }} />{right}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ (same text as the FAQPage JSON-LD) ── */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal><h2 className="text-3xl font-black mb-8" style={{ color: text }}>{faqs.title}</h2></Reveal>
          <div className="space-y-6">
            {faqs.items.map(([q, a], i) => (
              <Reveal key={q} delay={i * 60} y={16}>
                <h3 className="font-bold text-lg mb-2" style={{ color: text }}>{q}</h3>
                <p className="text-base leading-relaxed" style={{ color: soft }}>{a}</p>
              </Reveal>
            ))}
          </div>
          <p className="text-sm mt-8" style={{ color: soft }}>
            Read more:{" "}
            {related.map((r, i) => (
              <span key={r.to}>
                <Link to={r.to} className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>{r.label}</Link>
                {i < related.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="py-20 text-center" style={{ background: altBg }}>
        <Reveal className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-4" style={{ color: text }}>{close.title}</h2>
          <p className="text-base mb-8" style={{ color: soft }}>{close.body}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Magnetic>
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                className="shine-btn inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-shadow duration-200"
                style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                Start free trial <ArrowRight className="w-4 h-4" />
              </a>
            </Magnetic>
            <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer" className={waButtonClass(isDark)}>
              <WhatsAppLogo className="w-[18px] h-[18px]" /> Book a demo on WhatsApp
            </a>
          </div>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}

/** FAQPage + BreadcrumbList JSON-LD for a solution page, escaped for a <script> tag. */
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
