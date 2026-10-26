// pages/WhatsAppCrm.jsx - /whatsapp-crm, "WhatsApp CRM for real estate", on
// the shared solution-page layout (components/SolutionPage.jsx).
//
// Built for the searches Keyword Planner shows in India (Oct 2026): "whatsapp
// crm", "crm for whatsapp", "crm with whatsapp" (1K-10K a month each) and
// "crm whatsapp integration", "best whatsapp crm" (100-1K). Every claim here
// must stay true to the product and the plan it sits on: plan limits come from
// data/plans.js, the WhatsApp feature copy from data/features.js.
import { Link } from "react-router-dom";
import { Bot, Inbox, UserCheck, Megaphone, ShieldCheck, Clock, Wallet, Sparkles, CalendarCheck2 } from "lucide-react";
import SolutionPage, { solutionJsonLd } from "../components/SolutionPage";
import HeroChat from "../components/HeroChat";
import { FloatCard } from "../components/site/HomeVisuals";
import { FacebookLogo } from "../components/site/BrandLogos";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";

const linkCls = "font-semibold underline underline-offset-4";
const brandInk = { color: "var(--site-brand-ink)" };

const FAQS = [
  ["What is a WhatsApp CRM?",
   "A WhatsApp CRM connects your business WhatsApp number to your customer records. Every chat is saved against the buyer's lead, the whole team works from one inbox, and replies, follow-ups and campaigns happen in the same place you track the sale."],
  ["Do I need the WhatsApp Business API?",
   "Yes. A team inbox, AI replies and campaigns need the official WhatsApp Business Platform (the API), not the WhatsApp Business app on a phone. Our team sets up the connection with you during onboarding."],
  ["Can the AI reply in Hindi or Marathi?",
   "Yes. On the Growth and Enterprise plans the WhatsApp AI agent follows the buyer's language, including English, Hinglish, Hindi and Marathi. Your team can take over any conversation at any time."],
  ["How are WhatsApp messages charged?",
   "Meta charges for WhatsApp business messages. In Arthaleads these are paid from a prepaid credit balance that you top up online, with a statement of every charge and a free monthly allowance of service replies used first."],
  ["Does it work with click-to-WhatsApp ads?",
   "Yes. Chats that start from a Facebook or Instagram click-to-WhatsApp ad become leads with the ad name saved, so you can see which campaign produced which buyer. The guided button flow for these ads is on the Enterprise plan."],
  ["Which plan do I need?",
   `The shared inbox and automatic lead capture are on Starter (₹${PLAN_PRICING.starter.monthly} per user per month). The WhatsApp AI agent, AI-written replies, templates and campaigns are on Growth (₹${PLAN_PRICING.growth.monthly} per user per month). Every plan starts with a 14-day free trial.`],
];

/** The hero: the home page's WhatsApp phone with two status cards beside it. */
function PhoneVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] px-3 sm:px-6 lg:px-0" style={{ "--hc-h": "min(560px, 74svh)", "--hc-w": "calc(var(--hc-h) * 0.53)" }}>
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative py-6 sm:py-8"><HeroChat /></div>
      <FloatCard className="hidden sm:flex left-0 lg:-left-6 top-[18%] items-center gap-3 !py-3 max-w-[240px]">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(24,119,242,0.12)" }}><FacebookLogo className="w-[18px] h-[18px]" /></span>
        <span className="min-w-0"><span className="block text-[13px] font-semibold site-ink leading-tight">New lead · Facebook ad</span><span className="block text-[11px] site-muted leading-tight mt-0.5">Saved with the ad name</span></span>
      </FloatCard>
      <FloatCard className="hidden sm:flex right-0 lg:-right-6 bottom-[16%] items-center gap-3 !py-3 max-w-[240px]">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(22,163,74,0.12)" }}><CalendarCheck2 className="w-[18px] h-[18px]" style={{ color: "#16a34a" }} /></span>
        <span className="min-w-0"><span className="block text-[13px] font-semibold site-ink leading-tight">Site visit booked</span><span className="block text-[11px] site-muted leading-tight mt-0.5">Saturday · 11:00 AM</span></span>
      </FloatCard>
    </div>
  );
}

export default function WhatsAppCrm() {
  useSEO({
    title: "WhatsApp CRM for Real Estate with AI Replies | Arthaleads",
    description: "WhatsApp CRM for real estate in India: a shared team inbox, an AI agent that replies to buyers 24/7 in Hindi or English, and every chat saved as a lead.",
    canonical: "https://www.arthaleads.com/whatsapp-crm",
  });

  return (
    <SolutionPage
      jsonLd={solutionJsonLd({ name: "WhatsApp CRM", path: "/whatsapp-crm", faqs: FAQS })}
      hero={{
        eyebrow: "WhatsApp CRM",
        lines: ["The WhatsApp CRM", "for real estate teams"],
        lede: "Buyers message you on WhatsApp first. Arthaleads answers them in seconds with an AI agent, saves every chat as a lead with the buyer's budget and needs filled in, and gives your whole team one inbox to follow up from.",
        visual: <PhoneVisual />,
      }}
      answer={{
        q: "Why property teams need a WhatsApp CRM",
        paras: [
          "In Indian real estate, most enquiries now start on WhatsApp. A buyer taps an ad, messages at 10 PM, and expects an answer before they message the next builder. If that chat sits on one agent's phone, it is answered late, the buyer's budget and timeline live only in that chat, and nobody else on the team knows it exists.",
          <>A WhatsApp CRM fixes that. The chat, the buyer's details and the next step all live in one lead record the whole team can see. Replies go out in seconds, even at night, and the manager knows which ads produce real buyers. It is the same lead management discipline described in our guide to{" "}
            <Link to="/blog/real-estate-lead-management-enquiry-to-site-visit" className={linkCls} style={brandInk}>real estate lead management</Link>, applied to the channel your buyers use most.</>,
        ],
      }}
      steps={{
        title: "How the WhatsApp CRM works",
        intro: "From the first message to a booked site visit, in four steps.",
        items: [
          { title: "A buyer messages you", body: "From a Facebook or Instagram click-to-WhatsApp ad, the button on your website, a hoarding QR code or a number they saved. Every chat arrives in one team inbox, not on one agent's phone." },
          { title: "The AI agent replies in seconds", body: "Day or night, in the buyer's language. It answers questions about your project, asks what they need, their budget and when they plan to buy, and shares the brochure and location." },
          { title: "The chat becomes a lead", body: "The lead is created with the buyer's answers already filled in and the ad or source it came from. Routing rules give it an owner and their phone gets a push alert." },
          { title: "Your team takes it from there", body: "The agent sees the whole conversation, takes over the chat whenever they like, books the site visit and sets the next follow-up, all from the same screen." },
        ],
      }}
      features={{
        title: "Everything your team needs on WhatsApp",
        intro: "Built on the official WhatsApp Business Platform. The plan each feature starts on is shown on its card.",
        items: [
          { icon: Inbox,       title: "Shared WhatsApp inbox",        body: "One business number for the whole team. Managers see every chat, and nothing is lost when an agent is on leave or leaves.", plan: "all" },
          { icon: UserCheck,   title: "Every chat becomes a lead",    body: "New WhatsApp contacts are added as leads automatically, with the ad name for click-to-WhatsApp chats, so you know what each campaign brought in.", plan: "all" },
          { icon: Bot,         title: "WhatsApp AI agent",            body: "Answers buyers 24/7 in English, Hinglish, Hindi or Marathi, qualifies them and books site visits. Your team can take over any chat at any time.", plan: "Growth" },
          { icon: Sparkles,    title: "AI-written replies",           body: "For any lead, AI drafts a personal message using their name, project interest and budget. The agent reviews it and sends in seconds.", plan: "Growth" },
          { icon: Megaphone,   title: "Templates and campaigns",      body: "Send approved WhatsApp templates to a filtered list of leads, for launches, price updates and site visit reminders.", plan: "Growth" },
          { icon: ShieldCheck, title: "Consent on every lead",        body: "Each lead carries a WhatsApp consent status. Marketing templates skip anyone who said no, and you can filter your audience by consent before you send.", plan: "Growth" },
          { icon: Clock,       title: "Business hours and routing",   body: "Set your business profile, working hours with an automatic away message, and who gets each new conversation.", plan: "all" },
          { icon: Wallet,      title: "Prepaid credits, clear bills", body: "WhatsApp messages are paid from a prepaid credit balance. Top up online and see a statement of every charge.", plan: "all" },
        ],
      }}
      compare={{
        // Plain-language comparison with the free WhatsApp Business app, which is
        // what most brokers use today. No claims about other CRMs here.
        title: "WhatsApp Business app vs a WhatsApp CRM",
        intro: "The free WhatsApp Business app is fine for one person. Once several agents handle enquiries, this is what changes.",
        cols: ["WhatsApp Business app", "Arthaleads WhatsApp CRM"],
        rows: [
          ["Who can reply", "Whoever holds the phone", "The whole team, from one shared inbox"],
          ["Replies at night and on Sundays", "An away message at best", "The AI agent answers and qualifies the buyer, 24/7"],
          ["Buyer details", "Scattered across chats and notes", "Filled into the lead record automatically"],
          ["Which ad brought the buyer", "Visible in that one chat only", "Saved on the lead, so you can count buyers per ad"],
          ["When an agent leaves", "The chats leave with their phone", "History stays with the company"],
          ["Follow-up reminders", "None", "A dated follow-up on every lead"],
          ["Bulk messages", "Broadcast lists only", "Approved templates to filtered lead lists"],
        ],
      }}
      faqs={{ title: "WhatsApp CRM questions", items: FAQS }}
      related={[
        { to: "/blog/reply-to-property-enquiries-on-whatsapp-fast", label: "Replying to enquiries at 1 AM" },
        { to: "/features", label: "All features" },
        { to: "/pricing", label: "Plans and pricing" },
        { to: "/compare", label: "How to choose a real estate CRM" },
      ]}
      close={{
        title: "Answer every buyer on WhatsApp,",
        dim: "day and night.",
        body: "Book a 30-minute demo and see the AI agent reply on your own number, or start the 14-day free trial yourself.",
      }}
    />
  );
}
