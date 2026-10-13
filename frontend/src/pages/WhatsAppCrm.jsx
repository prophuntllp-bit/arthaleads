// pages/WhatsAppCrm.jsx - /whatsapp-crm, "WhatsApp CRM for real estate".
//
// Built for the searches Keyword Planner shows in India (Oct 2026): "whatsapp
// crm", "crm for whatsapp", "crm with whatsapp" (1K-10K a month each) and
// "crm whatsapp integration", "best whatsapp crm" (100-1K). Every claim here
// must stay true to the product and the plan it sits on: plan limits come from
// data/plans.js, the WhatsApp feature copy from pages/Features.jsx.
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Bot, Inbox, UserCheck, Megaphone, ShieldCheck, Clock, Wallet, Sparkles, Check, Minus } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS, waLink, WA_MESSAGES } from "../utils/crmLinks";
import { PLAN_PRICING } from "../utils/plan";

const STEPS = [
  { title: "A buyer messages you", body: "From a Facebook or Instagram click-to-WhatsApp ad, the button on your website, a hoarding QR code or a number they saved. Every chat arrives in one team inbox, not on one agent's phone." },
  { title: "The AI agent replies in seconds", body: "Day or night, in the buyer's language. It answers questions about your project, asks what they need, their budget and when they plan to buy, and shares the brochure and location." },
  { title: "The chat becomes a lead", body: "The lead is created with the buyer's answers already filled in and the ad or source it came from. Routing rules give it an owner and their phone gets a push alert." },
  { title: "Your team takes it from there", body: "The agent sees the whole conversation, takes over the chat whenever they like, books the site visit and sets the next follow-up, all from the same screen." },
];

const FEATURES = [
  { icon: Inbox,       title: "Shared WhatsApp inbox",       body: "One business number for the whole team. Managers see every chat, and nothing is lost when an agent is on leave or leaves.", plan: "Starter" },
  { icon: UserCheck,   title: "Every chat becomes a lead",   body: "New WhatsApp contacts are added as leads automatically, with the ad name for click-to-WhatsApp chats, so you know what each campaign brought in.", plan: "Starter" },
  { icon: Bot,         title: "WhatsApp AI agent",           body: "Answers buyers 24/7 in English, Hinglish, Hindi or Marathi, qualifies them and books site visits. Your team can take over any chat at any time.", plan: "Growth" },
  { icon: Sparkles,    title: "AI-written replies",          body: "For any lead, AI drafts a personal message using their name, project interest and budget. The agent reviews it and sends in seconds.", plan: "Growth" },
  { icon: Megaphone,   title: "Templates and campaigns",     body: "Send approved WhatsApp templates to a filtered list of leads, for launches, price updates and site visit reminders.", plan: "Growth" },
  { icon: ShieldCheck, title: "Consent on every lead",       body: "Each lead carries a WhatsApp consent status. Marketing templates skip anyone who said no, and you can filter your audience by consent before you send.", plan: "Growth" },
  { icon: Clock,       title: "Business hours and routing",  body: "Set your business profile, working hours with an automatic away message, and who gets each new conversation.", plan: "Starter" },
  { icon: Wallet,      title: "Prepaid credits, clear bills", body: "WhatsApp messages are paid from a prepaid credit balance. Top up online and see a statement of every charge.", plan: "Starter" },
];

// Plain-language comparison with the free WhatsApp Business app, which is what
// most brokers use today. No claims about other CRMs here.
const VERSUS = [
  ["Who can reply", "Whoever holds the phone", "The whole team, from one shared inbox"],
  ["Replies at night and on Sundays", "An away message at best", "The AI agent answers and qualifies the buyer, 24/7"],
  ["Buyer details", "Scattered across chats and notes", "Filled into the lead record automatically"],
  ["Which ad brought the buyer", "Visible in that one chat only", "Saved on the lead, so you can count buyers per ad"],
  ["When an agent leaves", "The chats leave with their phone", "History stays with the company"],
  ["Follow-up reminders", "None", "A dated follow-up on every lead"],
  ["Bulk messages", "Broadcast lists only", "Approved templates to filtered lead lists"],
];

const FAQS = [
  ["What is a WhatsApp CRM?",
   "A WhatsApp CRM connects your business WhatsApp number to your customer records. Every chat is saved against the buyer's lead, the whole team works from one inbox, and replies, follow-ups and campaigns happen in the same place you track the sale."],
  ["Do I need the WhatsApp Business API?",
   "Yes. A team inbox, AI replies and campaigns need the official WhatsApp Business Platform (the API), not the WhatsApp Business app on a phone. Our team sets up the connection with you during onboarding."],
  ["Can the AI reply in Hindi or Marathi?",
   "Yes. On the Growth and Enterprise plans the WhatsApp AI agent follows the buyer's language, including English, Hinglish, Hindi and Marathi. Your team can take over any conversation at any time."],
  ["How are WhatsApp messages charged?",
   "Meta charges for WhatsApp business messages. In ArthaLeads these are paid from a prepaid credit balance that you top up online, with a statement of every charge and a free monthly allowance of service replies used first."],
  ["Does it work with click-to-WhatsApp ads?",
   "Yes. Chats that start from a Facebook or Instagram click-to-WhatsApp ad become leads with the ad name saved, so you can see which campaign produced which buyer. The guided button flow for these ads is on the Enterprise plan."],
  ["Which plan do I need?",
   `The shared inbox and automatic lead capture are on Starter (₹${PLAN_PRICING.starter.monthly} per user per month). The WhatsApp AI agent, AI-written replies, templates and campaigns are on Growth (₹${PLAN_PRICING.growth.monthly} per user per month). Every plan starts with a 14-day free trial.`],
];

const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
}).replace(/</g, "\\u003c");

export default function WhatsAppCrm() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "WhatsApp CRM for Real Estate Teams | ArthaLeads",
    description: "WhatsApp CRM for real estate teams in India: a shared inbox, an AI agent that replies to buyers 24/7, every chat saved as a lead, plus templates and campaigns.",
    canonical: "https://www.arthaleads.com/whatsapp-crm",
  });

  const bg = isDark ? "#0d0d1a" : "#ffffff";
  const altBg = isDark ? "#0a0a14" : "#f9fafb";
  const text = isDark ? "#ffffff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const muted = isDark ? "rgba(255,255,255,0.5)" : "#6b7280";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const linkClr = isDark ? "#fb923c" : "#c2410c";
  const green = isDark ? "#4ade80" : "#15803d";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-16 overflow-hidden"
        style={{ background: isDark ? "#0d0d1a" : "linear-gradient(135deg, #f0fdf4 0%, #fff 55%, #fff7f0 100%)" }}>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
              style={{ borderColor: "rgba(21,128,61,0.35)", background: "rgba(34,197,94,0.10)" }}>
              <MessageCircle className="w-3.5 h-3.5" style={{ color: green }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: green }}>WhatsApp CRM</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.08] mb-6" style={{ color: text, textWrap: "balance" }}>
              The WhatsApp CRM for real estate teams
            </h1>
            <p className="text-lg leading-relaxed mb-8 max-w-xl" style={{ color: soft }}>
              Buyers message you on WhatsApp first. ArthaLeads answers them in seconds with an AI agent, saves every chat
              as a lead with the buyer's budget and needs filled in, and gives your whole team one inbox to follow up from.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                className="inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-orange-500/25 transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                Start 14-day free trial <ArrowRight className="w-4 h-4" />
              </a>
              <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
                style={{ borderColor: cardBorder, color: text, background: cardBg }}>
                <MessageCircle className="w-4 h-4" style={{ color: green }} /> See it on WhatsApp
              </a>
            </div>
            <p className="text-sm mt-5" style={{ color: muted }}>No credit card needed. Our team helps you connect your WhatsApp Business number.</p>
          </div>
          <div className="rounded-3xl overflow-hidden border shadow-2xl" style={{ borderColor: cardBorder }}>
            <img src="/tour/inbox.webp" width="2000" height="1125" loading="eager" decoding="async"
              alt="The ArthaLeads WhatsApp inbox: an AI agent replying to a property buyer on phone and web"
              className="w-full h-auto block" />
          </div>
        </div>
      </section>

      {/* ── Why ── */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-5" style={{ color: text }}>Why property teams need a WhatsApp CRM</h2>
          <div className="space-y-4 text-base leading-relaxed" style={{ color: soft }}>
            <p>
              In Indian real estate, most enquiries now start on WhatsApp. A buyer taps an ad, messages at 10 PM, and expects an
              answer before they message the next builder. If that chat sits on one agent's phone, it is answered late, the
              buyer's budget and timeline live only in that chat, and nobody else on the team knows it exists.
            </p>
            <p>
              A WhatsApp CRM fixes that. The chat, the buyer's details and the next step all live in one lead record the
              whole team can see. Replies go out in seconds, even at night, and the manager knows which ads produce real buyers.
              It is the same lead management discipline described in our guide to{" "}
              <Link to="/blog/real-estate-lead-management-enquiry-to-site-visit" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>real estate lead management</Link>,
              applied to the channel your buyers use most.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-3 text-center" style={{ color: text }}>How the WhatsApp CRM works</h2>
          <p className="text-base text-center max-w-2xl mx-auto mb-10" style={{ color: soft }}>From the first message to a booked site visit, in four steps.</p>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                <span className="inline-flex w-9 h-9 rounded-full items-center justify-center text-sm font-bold mb-4"
                  style={{ background: isDark ? "rgba(255,107,0,0.15)" : "#fff3ea", color: linkClr }}>{i + 1}</span>
                <h3 className="font-bold text-lg mb-2" style={{ color: text }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: soft }}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-3 text-center" style={{ color: text }}>Everything your team needs on WhatsApp</h2>
          <p className="text-base text-center max-w-2xl mx-auto mb-10" style={{ color: soft }}>
            Built on the official WhatsApp Business Platform. The plan each feature starts on is shown on its card.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, body, plan }) => (
              <div key={title} className="rounded-2xl border p-6 flex flex-col" style={{ background: cardBg, borderColor: cardBorder }}>
                <Icon className="w-6 h-6 mb-4" style={{ color: green }} />
                <h3 className="font-bold mb-2" style={{ color: text }}>{title}</h3>
                <p className="text-sm leading-relaxed flex-1" style={{ color: soft }}>{body}</p>
                <span className="mt-4 text-xs font-semibold" style={{ color: muted }}>From the {plan} plan</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Versus the Business app ── */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-3" style={{ color: text }}>WhatsApp Business app vs a WhatsApp CRM</h2>
          <p className="text-base mb-8" style={{ color: soft }}>
            The free WhatsApp Business app is fine for one person. Once several agents handle enquiries, this is what changes.
          </p>
          {/* Phones: one card per row of the comparison */}
          <div className="sm:hidden space-y-3">
            {VERSUS.map(([row, app, crm]) => (
              <div key={row} className="rounded-2xl border p-4" style={{ borderColor: cardBorder, background: cardBg }}>
                <h3 className="font-semibold mb-2" style={{ color: text }}>{row}</h3>
                <p className="flex gap-2 text-sm mb-1.5" style={{ color: soft }}>
                  <Minus className="w-4 h-4 mt-0.5 shrink-0" style={{ color: muted }} /><span><span className="font-medium">Business app:</span> {app}</span>
                </p>
                <p className="flex gap-2 text-sm" style={{ color: soft }}>
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: green }} /><span><span className="font-medium">ArthaLeads:</span> {crm}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="hidden sm:block rounded-2xl border overflow-x-auto" style={{ borderColor: cardBorder, background: cardBg }}>
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <th scope="col" className="text-left font-semibold p-4" style={{ color: muted }}> </th>
                  <th scope="col" className="text-left font-semibold p-4" style={{ color: text }}>WhatsApp Business app</th>
                  <th scope="col" className="text-left font-semibold p-4" style={{ color: text }}>ArthaLeads WhatsApp CRM</th>
                </tr>
              </thead>
              <tbody>
                {VERSUS.map(([row, app, crm]) => (
                  <tr key={row} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <th scope="row" className="text-left font-semibold p-4 align-top" style={{ color: text }}>{row}</th>
                    <td className="p-4 align-top" style={{ color: soft }}>
                      <span className="inline-flex gap-2"><Minus className="w-4 h-4 mt-0.5 shrink-0" style={{ color: muted }} />{app}</span>
                    </td>
                    <td className="p-4 align-top" style={{ color: soft }}>
                      <span className="inline-flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: green }} />{crm}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-5" style={{ color: soft }}>
            Want the reply routine behind this? Read{" "}
            <Link to="/blog/reply-to-property-enquiries-on-whatsapp-fast" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>how to reply to property enquiries on WhatsApp, even at 1 AM</Link>.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-8" style={{ color: text }}>WhatsApp CRM questions</h2>
          <div className="space-y-6">
            {FAQS.map(([q, a]) => (
              <div key={q}>
                <h3 className="font-bold text-lg mb-2" style={{ color: text }}>{q}</h3>
                <p className="text-base leading-relaxed" style={{ color: soft }}>{a}</p>
              </div>
            ))}
          </div>
          <p className="text-sm mt-8" style={{ color: soft }}>
            See the full feature list on the <Link to="/features" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>features page</Link>, compare{" "}
            <Link to="/pricing" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>plans and pricing</Link>, or read{" "}
            <Link to="/compare" className="font-semibold underline underline-offset-2" style={{ color: linkClr }}>how to choose a real estate CRM</Link>.
          </p>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="py-20 text-center" style={{ background: altBg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-4" style={{ color: text }}>Answer every buyer on WhatsApp, day and night</h2>
          <p className="text-base mb-8" style={{ color: soft }}>
            Start the 14-day free trial, or message us on WhatsApp and see the AI agent reply to you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
              Start free trial <ArrowRight className="w-4 h-4" />
            </a>
            <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: cardBorder, color: text }}>
              <MessageCircle className="w-4 h-4" style={{ color: green }} /> Book a demo on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
