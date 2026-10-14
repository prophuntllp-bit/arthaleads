// pages/SellDoAlternative.jsx - /compare/sell-do-alternative, Sell.Do pricing
// explained and an honest ArthaLeads vs Sell.Do comparison.
//
// Targets "sell do pricing", "sell do reviews" and "sell do alternative"
// (10-100 searches a month each in India, Keyword Planner, Oct 2026). The big
// "sell do" / "sell do login" volume is navigational and not expected here. Every statement about
// Sell.Do comes from its own public pages (sell.do and sell.do/pricing, read on
// 13 Oct 2026) and is linked as the source. Never add a claim about Sell.Do
// that its site does not make, and never say it lacks something we could not
// confirm. Re-check the facts before editing this page.
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Receipt, FileText } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import WhatsAppLogo from "../components/WhatsAppLogo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS, waLink, WA_MESSAGES } from "../utils/crmLinks";
import { PLAN_PRICING } from "../utils/plan";
import { Reveal, Spotlight, Magnetic, CountUp } from "../components/motion/Motion";

const CHECKED = "13 October 2026";
const SRC_HOME = "https://www.sell.do/";
const SRC_PRICING = "https://www.sell.do/pricing";
const PAGE_URL = "https://www.arthaleads.com/compare/sell-do-alternative";

// How Sell.Do prices, each point as stated on sell.do/pricing.
const SELLDO_PRICING = [
  "No published rate card. You book a call and receive a custom quote.",
  "Charged per active user per month, with a minimum of 5 users.",
  "The rate depends on the modules: core CRM, the full real-estate suite, or both.",
  "AI (Jarvis scoring, voice agents, call analysis) is a usage-based add-on.",
  "WhatsApp, telephony, SMS and email costs are quoted for your volumes.",
  "Discounts are offered on annual contracts.",
];

const CHOOSE_SELLDO = [
  "You are a large developer running big launches and need a launch-day booking and inventory engine (Sell.Do calls it IRIS).",
  "You want one vendor for pre-sales, inventory, channel partners and post-sales, and have the budget for a custom quote.",
  "You want AI voice agents calling every lead and are happy to pay for AI usage on top of seats.",
];
const CHOOSE_ARTHA = [
  "You are a broker, channel partner or a small to mid-size developer and want to start this week, not after a sales cycle.",
  "You want prices you can see today and a free trial on your own leads before you commit.",
  "WhatsApp is where your buyers talk, and you want an AI agent replying to them 24/7 as part of the plan.",
];

// Rows: what we compare, ArthaLeads, Sell.Do (from its own site), source link for the Sell.Do cell.
const ROWS = [
  ["Pricing", `Published: ₹${PLAN_PRICING.starter.monthly} (Starter) or ₹${PLAN_PRICING.growth.monthly} (Growth) per user per month, GST extra. Enterprise on quote.`, "Not published. A custom per-user quote based on team size and modules.", SRC_PRICING],
  ["Minimum team size", "5 users", "5 users", SRC_PRICING],
  ["How you try it", "14-day free trial, no credit card", "Book a demo, then a written quote", SRC_PRICING],
  ["AI", "WhatsApp AI agent, AI lead scoring and AI-written replies included on Growth", "Jarvis AI: voice agents, call analysis and content agents, priced as usage-based add-ons", SRC_PRICING],
  ["WhatsApp", "Shared team inbox, AI agent, templates and campaigns, click-to-WhatsApp ad leads", "WhatsApp Connector, with communication costs quoted separately", SRC_HOME],
  ["Launch-day booking engine", "Not built for launch-day inventory release", "IRIS launch platform for bookings and inventory at launch", SRC_HOME],
  ["Post-sales", "Bookings and brokerage invoices", "Post-sales and collections in the real-estate suite", SRC_PRICING],
  ["Track record", "Newer, built in Pune for Indian sales teams", "15 years, 1,500+ real estate businesses (its own figures)", SRC_HOME],
];

const FAQS = [
  ["How much does Sell.Do cost?",
   "Sell.Do does not publish its prices. According to its pricing page, it quotes per active user per month with a minimum of 5 users, the rate depends on whether you take the core CRM or the full real-estate suite, and AI features and communication channels (WhatsApp, telephony, SMS, email) are priced as usage-based add-ons. You need to book a call to get a number."],
  ["Is ArthaLeads cheaper than Sell.Do?",
   `We cannot compare exact prices, because Sell.Do does not publish them: it sends a custom quote per team. ArthaLeads publishes its prices: ₹${PLAN_PRICING.starter.monthly} or ₹${PLAN_PRICING.growth.monthly} per user per month plus GST, with no setup fee, and Growth includes the WhatsApp AI agent.`],
  ["Can I move my leads from Sell.Do to ArthaLeads?",
   "Yes, if you can export them as a CSV or Excel file. ArthaLeads imports leads from CSV and Excel on every plan, and our team helps you map the columns and connect your Facebook, Google, website and WhatsApp sources during onboarding."],
  ["Does ArthaLeads have AI calling like Sell.Do?",
   "Yes, through Vistrow Voice, our AI calling agent, on the Enterprise plan. Every plan also has one-tap calling from the lead, with the call logged automatically."],
  ["Is this comparison fair?",
   `We wrote it, so read it with that in mind. Every statement about Sell.Do comes from its own website, linked in the table, as checked on ${CHECKED}. If something has changed, message us and we will correct it.`],
];

export default function SellDoAlternative() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "Sell.Do Pricing & Alternative: ArthaLeads vs Sell.Do",
    description: "Sell.Do pricing explained and compared with ArthaLeads for Indian real estate teams: published prices, free trial, AI, WhatsApp and who each suits.",
    canonical: "https://www.arthaleads.com/compare/sell-do-alternative",
  });

  const bg = isDark ? "#0d0d1a" : "#ffffff";
  const altBg = isDark ? "#0a0a14" : "#f9fafb";
  const text = isDark ? "#ffffff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.62)" : "#4b5563";
  const muted = isDark ? "rgba(255,255,255,0.5)" : "#6b7280";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const linkClr = isDark ? "#fb923c" : "#c2410c";
  const orange = "#ff6b00";

  const faqLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }).replace(/</g, "\\u003c");
  const crumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.arthaleads.com/" },
      { "@type": "ListItem", position: 2, name: "Compare", item: "https://www.arthaleads.com/compare" },
      { "@type": "ListItem", position: 3, name: "Sell.Do alternative", item: PAGE_URL },
    ],
  });
  const growth5 = (PLAN_PRICING.growth.monthly * 5).toLocaleString("en-IN");

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbLd }} />
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-16 overflow-hidden"
        style={{ background: isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 55%, #fffbeb 100%)" }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl motion-safe:animate-[aurora-drift_18s_ease-in-out_infinite]"
            style={{ background: "rgba(255,107,0,0.12)" }} />
          <div className="absolute -bottom-32 right-0 w-[26rem] h-[26rem] rounded-full blur-3xl motion-safe:animate-[aurora-drift_22s_ease-in-out_infinite_reverse]"
            style={{ background: isDark ? "rgba(255,170,0,0.08)" : "rgba(255,170,0,0.12)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex items-center gap-1.5 text-sm" style={{ color: muted }}>
                <li><Link to="/compare" className="hover:underline underline-offset-2" style={{ color: linkClr }}>Compare</Link></li>
                <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
                <li aria-current="page">Sell.Do</li>
              </ol>
            </nav>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.08] mb-6" style={{ color: text, textWrap: "balance" }}>
              <span className="sr-only">Sell.Do pricing and alternative: ArthaLeads vs Sell.Do</span>
              <span aria-hidden="true">
                {["Sell.Do", "pricing", "and", "alternative"].map((w, i) => (
                  <span key={w} className="word-rise" style={{ animationDelay: `${80 + i * 90}ms` }}>{w}&nbsp;</span>
                ))}
                <span className="block">
                  {["ArthaLeads", "vs", "Sell.Do"].map((w, i) => (
                    <span key={w + i} className="word-rise text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00] pb-1"
                      style={{ animationDelay: `${440 + i * 90}ms` }}>{w}{i < 2 ? " " : ""}</span>
                  ))}
                </span>
              </span>
            </h1>
            <p className="text-lg leading-relaxed mb-8 max-w-xl" style={{ color: soft }}>
              Sell.Do is an established platform built for large developers, sold on a custom quote. ArthaLeads is a simpler
              real estate CRM with published prices, a free trial and a WhatsApp AI agent in the plan. Here is how they
              compare, using Sell.Do's own website as the source.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Magnetic>
                <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                  className="shine-btn w-full inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/45 transition-shadow duration-200"
                  style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                  Start 14-day free trial <ArrowRight className="w-4 h-4" />
                </a>
              </Magnetic>
              <a href="#pricing"
                className="inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
                style={{ borderColor: cardBorder, color: text, background: cardBg }}>
                Compare pricing
              </a>
            </div>
            <p className="text-sm mt-5" style={{ color: muted }}>Sell.Do details checked on {CHECKED}.</p>
          </div>

          {/* Price per user, side by side */}
          <Reveal delay={250} y={32} className="relative">
            <div className="rounded-3xl border shadow-2xl p-6 sm:p-8 motion-safe:animate-[float-soft_7s_ease-in-out_infinite]"
              style={{ background: isDark ? "#14142a" : "#ffffff", borderColor: cardBorder }}>
              <p className="text-sm font-semibold mb-5" style={{ color: muted }}>Price per user, per month</p>
              <div className="rounded-2xl p-5 mb-4 border" style={{ borderColor: "rgba(255,107,0,0.35)", background: isDark ? "rgba(255,107,0,0.08)" : "#fff7f0" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold" style={{ color: text }}>ArthaLeads</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: isDark ? "#4ade80" : "#15803d" }}>
                    <Check className="w-3.5 h-3.5" /> Published
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[["Starter", PLAN_PRICING.starter.monthly], ["Growth", PLAN_PRICING.growth.monthly]].map(([n, v]) => (
                    <div key={n}>
                      <div className="text-xs mb-1" style={{ color: muted }}>{n}</div>
                      <div className="text-3xl font-black" style={{ color: text }}>₹<CountUp value={String(v)} /></div>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3" style={{ color: muted }}>+ GST · 14-day free trial · no card</p>
              </div>
              <div className="rounded-2xl p-5 border" style={{ borderColor: cardBorder, background: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold" style={{ color: text }}>Sell.Do</span>
                  <span className="text-xs font-semibold" style={{ color: muted }}>Not published</span>
                </div>
                <div className="text-2xl font-black" style={{ color: soft }}>Custom quote</div>
                <p className="text-xs mt-3" style={{ color: muted }}>
                  Book a call first · AI and messaging billed on usage{" "}
                  <a href={SRC_PRICING} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: linkClr }}>source</a>
                </p>
              </div>
            </div>
            <div aria-hidden="true" className="hidden sm:flex absolute -bottom-5 -left-4 items-center gap-2 px-3.5 py-2 rounded-xl border shadow-lg text-xs font-semibold motion-safe:animate-[float-soft_6s_ease-in-out_infinite]"
              style={{ background: isDark ? "#16162a" : "#ffffff", borderColor: cardBorder, color: text, animationDelay: "0.8s" }}>
              <Receipt className="w-3.5 h-3.5" style={{ color: orange }} /> 5 users on Growth: ₹{growth5} a month + GST
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── What Sell.Do costs ── */}
      <section id="pricing" className="py-16 scroll-mt-20" style={{ background: altBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-3xl font-black mb-3" style={{ color: text }}>What does Sell.Do cost?</h2>
            <p className="text-base leading-relaxed" style={{ color: soft }}>
              Sell.Do does not publish a price list, so there is no single number to quote. This is how its own pricing
              page says the price is worked out, next to what ArthaLeads charges.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal className="flex">
              <Spotlight className="w-full rounded-2xl border p-7" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6" }}>
                    <FileText className="w-5 h-5" style={{ color: soft }} />
                  </span>
                  <h3 className="text-xl font-bold" style={{ color: text }}>How Sell.Do prices</h3>
                </div>
                <ul className="space-y-3">
                  {SELLDO_PRICING.map((t) => (
                    <li key={t} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: soft }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-2.5 shrink-0" style={{ background: muted }} />{t}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-5" style={{ color: muted }}>
                  Source:{" "}
                  <a href={SRC_PRICING} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: linkClr }}>sell.do/pricing</a>, {CHECKED}.
                </p>
              </Spotlight>
            </Reveal>
            <Reveal delay={120} className="flex">
              <Spotlight className="w-full rounded-2xl border p-7" style={{ background: cardBg, borderColor: "rgba(255,107,0,0.45)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? "rgba(255,107,0,0.15)" : "#fff3ea" }}>
                    <Receipt className="w-5 h-5" style={{ color: orange }} />
                  </span>
                  <h3 className="text-xl font-bold" style={{ color: text }}>How ArthaLeads prices</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {[["Starter", PLAN_PRICING.starter], ["Growth", PLAN_PRICING.growth]].map(([n, p]) => (
                    <div key={n} className="rounded-xl border p-4" style={{ borderColor: cardBorder }}>
                      <div className="text-sm font-semibold mb-1" style={{ color: muted }}>{n}</div>
                      <div className="text-2xl font-black" style={{ color: text }}>₹{p.monthly}</div>
                      <div className="text-xs" style={{ color: muted }}>per user / month</div>
                      <div className="text-xs mt-2" style={{ color: soft }}>or ₹{p.annual.toLocaleString("en-IN")} a year</div>
                    </div>
                  ))}
                </div>
                <ul className="space-y-3">
                  {[
                    "Prices on the website, GST added on top. Enterprise is on quote.",
                    "Minimum 5 users. Annual billing gives about two months free.",
                    "Growth includes the WhatsApp AI agent, AI lead scoring and AI-written replies.",
                    "WhatsApp message charges from Meta come from a prepaid credit balance, with a statement of every charge.",
                    "14-day free trial on your own leads, no credit card.",
                  ].map((t) => (
                    <li key={t} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: soft }}>
                      <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: orange }} />{t}
                    </li>
                  ))}
                </ul>
                <p className="text-sm mt-5" style={{ color: soft }}>
                  Example: a team of 5 on Growth pays ₹{growth5} a month plus GST.{" "}
                  <Link to="/pricing" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>See full pricing</Link>
                </p>
              </Spotlight>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Verdict ── */}
      <section className="py-14" style={{ background: bg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-8 text-center" style={{ color: text }}>Which one fits your team?</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            {[["Choose Sell.Do if", CHOOSE_SELLDO, muted], ["Choose ArthaLeads if", CHOOSE_ARTHA, orange]].map(([title, items, accent], i) => (
              <Reveal key={title} delay={i * 120} className="flex">
                <Spotlight className="w-full rounded-2xl border p-7 transition-transform duration-300 hover:-translate-y-1"
                  style={{ background: cardBg, borderColor: i === 1 ? "rgba(255,107,0,0.45)" : cardBorder }}>
                  <h3 className="text-xl font-bold mb-4" style={{ color: text }}>{title}</h3>
                  <ul className="space-y-3">
                    {items.map((t) => (
                      <li key={t} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: soft }}>
                        <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: accent }} />{t}
                      </li>
                    ))}
                  </ul>
                </Spotlight>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Side by side ── */}
      <section className="py-14" style={{ background: altBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-3" style={{ color: text }}>ArthaLeads vs Sell.Do, side by side</h2>
            <p className="text-base mb-8" style={{ color: soft }}>Each Sell.Do entry links to the page it comes from.</p>
          </Reveal>

          {/* Phones: one card per row */}
          <div className="md:hidden space-y-3">
            {ROWS.map(([row, artha, selldo, src], i) => (
              <Reveal key={row} delay={i * 40} y={14} className="rounded-2xl border p-4" style={{ background: cardBg, borderColor: cardBorder }}>
                <h3 className="font-semibold mb-2" style={{ color: text }}>{row}</h3>
                <p className="text-sm mb-1.5" style={{ color: soft }}><span className="font-semibold" style={{ color: text }}>ArthaLeads:</span> {artha}</p>
                <p className="text-sm" style={{ color: soft }}><span className="font-semibold" style={{ color: text }}>Sell.Do:</span> {selldo}{" "}
                  <a href={src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: linkClr }}>source</a></p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100} className="hidden md:block rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <th scope="col" className="text-left p-4 w-[20%] font-semibold" style={{ color: muted }}> </th>
                  <th scope="col" className="text-left p-4 w-[40%] font-bold" style={{ color: orange }}>ArthaLeads</th>
                  <th scope="col" className="text-left p-4 w-[40%] font-bold" style={{ color: text }}>Sell.Do</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([row, artha, selldo, src]) => (
                  <tr key={row} className="align-top transition-colors duration-200 hover:bg-[#ff6b00]/[0.04]" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <th scope="row" className="text-left p-4 font-semibold" style={{ color: text }}>{row}</th>
                    <td className="p-4 leading-relaxed" style={{ color: soft }}>{artha}</td>
                    <td className="p-4 leading-relaxed" style={{ color: soft }}>
                      {selldo}{" "}
                      <a href={src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 whitespace-nowrap" style={{ color: linkClr }}>source</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* ── Switching ── */}
      <section className="py-14" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black mb-5" style={{ color: text }}>What moving to ArthaLeads looks like</h2>
          </Reveal>
          <ol className="space-y-4">
            {[
              ["Start the free trial", "14 days on the Growth plan, no credit card. Invite your team on day one."],
              ["Bring your leads", "Import your existing leads from a CSV or Excel export, with their source and stage."],
              ["Connect your sources", "Facebook and Instagram lead ads, your website (free WordPress plugin) and your WhatsApp Business number. Google Ads lead forms on Enterprise."],
              ["Go live", "Routing rules give every new lead an owner, the WhatsApp AI agent starts replying, and your team works from one list."],
            ].map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 90} className="flex gap-4">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: isDark ? "rgba(255,107,0,0.15)" : "#fff3ea", color: linkClr }}>{i + 1}</span>
                <div>
                  <h3 className="font-bold mb-1" style={{ color: text }}>{t}</h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: soft }}>{d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={200}>
            <p className="text-sm mt-8" style={{ color: soft }}>
              See every <Link to="/features" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>feature</Link>,
              the full <Link to="/pricing" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>pricing</Link>,
              how the <Link to="/whatsapp-crm" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>WhatsApp CRM</Link> works,
              or our guide on <Link to="/compare" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>how to choose a real estate CRM</Link>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal><h2 className="text-3xl font-black mb-8" style={{ color: text }}>Questions teams ask when comparing</h2></Reveal>
          <div className="space-y-6">
            {FAQS.map(([q, a], i) => (
              <Reveal key={q} delay={i * 60} y={16}>
                <h3 className="font-bold text-lg mb-2" style={{ color: text }}>{q}</h3>
                <p className="text-base leading-relaxed" style={{ color: soft }}>{a}</p>
              </Reveal>
            ))}
          </div>
          <p className="text-xs mt-10 leading-relaxed" style={{ color: muted }}>
            Sell.Do is a trademark of its owner, used here only to identify the product being compared. ArthaLeads is not
            affiliated with or endorsed by Sell.Do. Sell.Do information is taken from{" "}
            <a href={SRC_HOME} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">sell.do</a> and{" "}
            <a href={SRC_PRICING} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">sell.do/pricing</a> as of {CHECKED}.
          </p>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="py-20 text-center" style={{ background: bg }}>
        <Reveal className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-4" style={{ color: text }}>Try ArthaLeads on your own leads</h2>
          <p className="text-base mb-8" style={{ color: soft }}>Fourteen days, no credit card, prices you can see today.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Magnetic>
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                className="shine-btn inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-shadow duration-200"
                style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                Start free trial <ArrowRight className="w-4 h-4" />
              </a>
            </Magnetic>
            <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: cardBorder, color: text }}>
              <WhatsAppLogo className="w-[18px] h-[18px]" /> Book a demo on WhatsApp
            </a>
          </div>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}
