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
import SolutionPage, { solutionJsonLd, MiniChat } from "../components/SolutionPage";
import HeroChat from "../components/HeroChat";
import { FloatCard, Cycle } from "../components/site/HomeVisuals";
import { FacebookLogo } from "../components/site/BrandLogos";
import { useSEO } from "../utils/useSEO";
import { waLink, WA_MESSAGES } from "../utils/crmLinks";
import WhatsAppLogo from "../components/WhatsAppLogo";
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

/** The hero: the home page's WhatsApp phone with two status cards beside it.
    The phone is a fixed 290px wide (was 0.53 x height, about 236px on a 1024 x
    768 tablet, which cut "Raj Patil" and the quick replies: UI audit 31 Oct 2026). */
function PhoneVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[290px]" style={{ "--hc-h": "clamp(470px, 64svh, 540px)", "--hc-w": "290px" }}>
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative py-4"><HeroChat /></div>
      <FloatCard index={0} className="hidden sm:flex -left-10 lg:-left-16 xl:-left-24 top-[1%] items-center gap-3 !py-3 max-w-[240px]">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(24,119,242,0.12)" }}><FacebookLogo className="w-[18px] h-[18px]" /></span>
        <Cycle items={["Riverview Heights campaign", "Skyline Residency campaign", "Green Acres campaign"]} offset={600}>{(c) => <span className="min-w-0 block"><span className="block text-[13px] font-semibold site-ink leading-tight">New lead · Facebook ad</span><span className="block text-[12px] site-muted leading-tight mt-0.5">{c}</span></span>}</Cycle>
      </FloatCard>
      <FloatCard index={1} className="hidden sm:flex -right-10 lg:-right-16 xl:-right-24 bottom-[2%] items-center gap-3 !py-3 max-w-[240px]">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(22,163,74,0.12)" }}><CalendarCheck2 className="w-[18px] h-[18px]" style={{ color: "var(--site-green)" }} /></span>
        <Cycle items={["Saturday · 11:00 AM", "Sunday · 4:00 PM", "Monday · 10:30 AM"]} offset={2200}>{(v) => <span className="min-w-0 block"><span className="block text-[13px] font-semibold site-ink leading-tight">Site visit booked</span><span className="block text-[12px] site-muted leading-tight mt-0.5">{v}</span></span>}</Cycle>
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
      signature={{ tone: "dark", layout: "split" }}
      hero={{
        eyebrow: "WhatsApp CRM",
        actions: [
          { label: "Book a WhatsApp demo", to: "/book-demo" },
          { label: "Message us on WhatsApp", href: waLink(WA_MESSAGES.demo), external: true, variant: "whatsapp", Icon: WhatsAppLogo },
        ],
        trust: ["Official WhatsApp Business Platform", "One shared team inbox", "AI replies day and night"],
        lines: ["The WhatsApp CRM", "for real estate teams"],
        lede: "Buyers message you on WhatsApp first. Arthaleads answers in seconds with an AI agent, saves every chat as a lead and gives your team one inbox.",
        visual: <PhoneVisual />,
      }}
      answer={{
        q: "Why property teams need a WhatsApp CRM",
        paras: [
          "In Indian real estate, many enquiries now start on WhatsApp. A buyer taps an ad, messages at 10 PM, and expects an answer before they message the next builder. If that chat sits on one agent's phone, it is answered late, the buyer's budget and timeline live only in that chat, and nobody else on the team knows it exists.",
          <>A WhatsApp CRM puts the chat, the buyer's details and the next step in one lead the whole team can see. It is the{" "}
            <Link to="/blog/real-estate-lead-management-enquiry-to-site-visit" className={linkCls} style={brandInk}>real estate lead management</Link> discipline, on the channel your buyers use most.</>,
        ],
      }}
      steps={{
        title: "How the WhatsApp CRM works",
        intro: "From the first message to a booked site visit, in four steps.",
        items: [
          { title: "A buyer messages you", body: "From a click-to-WhatsApp ad, your website, a hoarding QR code or a saved number, into one team inbox." },
          { title: "The AI agent replies in seconds", body: "Day or night, in the buyer's language: project questions, budget, timeline, brochure and location." },
          { title: "The chat becomes a lead", body: "With the buyer's answers and the ad it came from, routed to an owner with a push alert." },
          { title: "Your team takes it from there", body: "The agent reads the chat, takes over, books the site visit and sets the next follow-up." },
        ],
      }}
      features={{
        visual: <MiniChat contact={{ name: "Raj Patil", sub: "Facebook ad · Riverview Heights" }} note="Replies here are sent by the Arthaleads AI agent" messages={[
          ["buyer", "Hi, is the 2 BHK at Riverview Heights still available? What's the price?"],
          ["ai", "Hi Raj, yes it is. 2 BHK homes start at ₹82 L. Are you buying to live in or as an investment?"],
          ["buyer", "To live in. Can I see it this weekend?"],
          ["ai", "Of course. Saturday 11 AM or Sunday 4 PM?"],
        ]} />,
        title: "Everything your team needs on WhatsApp",
        intro: "On the official WhatsApp Business Platform. Each card shows the plan it starts on.",
        items: [
          { icon: Inbox,       title: "Shared WhatsApp inbox",        body: "One business number for the whole team, and no chat lost when an agent leaves.", plan: "all" },
          { icon: UserCheck,   title: "Every chat becomes a lead",    body: "New contacts become leads automatically, with the ad name for click-to-WhatsApp chats.", plan: "all" },
          { icon: Bot,         title: "WhatsApp AI agent",            body: "Answers 24/7 in English, Hinglish, Hindi or Marathi and books site visits.", plan: "Growth" },
          { icon: Sparkles,    title: "AI-written replies",           body: "A personal draft with the buyer's name, project and budget, ready to review and send.", plan: "Growth" },
          { icon: Megaphone,   title: "Templates and campaigns",      body: "Approved templates to filtered leads for launches, price updates and visit reminders.", plan: "Growth" },
          { icon: ShieldCheck, title: "Consent on every lead",        body: "Marketing templates skip anyone who said no to WhatsApp messages.", plan: "Growth" },
          { icon: Clock,       title: "Business hours and routing",   body: "Working hours, an automatic away message and who gets each new chat.", plan: "all" },
          { icon: Wallet,      title: "Prepaid credits, clear bills", body: "Messages are paid from a prepaid balance, with a statement of every charge.", plan: "all" },
        ],
      }}
      compare={{
        // Plain-language comparison with the free WhatsApp Business app, which is
        // what most brokers use today. No claims about other CRMs here.
        title: "WhatsApp Business app vs a WhatsApp CRM",
        intro: "The free app is fine for one person. With several agents, this is what changes.",
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
        { to: "/blog/whatsapp-crm-integration-real-estate", label: "Connecting WhatsApp to your CRM" },
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
