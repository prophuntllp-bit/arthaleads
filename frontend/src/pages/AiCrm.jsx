// pages/AiCrm.jsx - /ai-crm, "AI CRM for real estate in India".
//
// Targets "ai crm india" (1K-10K a month, Google Trends scaled to the owner's
// Keyword Planner data, Oct 2026), "ai crm software india", "ai crm for real
// estate" and "real estate crm with ai". Keyword plan:
// https://claude.ai/artifact/CuDksmB3zWyQ77fbh5jUdH
//
// Every claim must match what the product does and the plan it is on
// (re-checked 23 Oct 2026): WhatsApp AI agent, photo reading, AI drafts
// (leadRoutes draft-message), AI lead scoring (services/aiLeadScore.js: last
// 14 days of chat and call notes, +/-20 on the rule score, one-line reason,
// /leads/hot) and the Artha copilot (copilotRoutes, actions/ catalogue) =
// Growth (planGate); call transcripts and Vistrow Voice = Enterprise
// (enablexRoutes, vistrowLeadRoutes). Artha's morning brief, risk alerts and
// reply drafts are pilot-only (Organization.copilot.beta): do not claim them.
// In free-text chat the agent describes the location (no map pin) and offers a
// visit; booking a slot is the Enterprise button flow.
import { Bot, Sparkles, MessageSquareText, Gauge, Headphones, PhoneCall, Image as ImageIcon, Flame } from "lucide-react";
import { WhatsAppLogo } from "../components/site/BrandLogos";
import SolutionPage, { solutionJsonLd } from "../components/SolutionPage";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";

const FAQS = [
  ["What does the AI in Arthaleads actually do?",
   "It answers buyers on WhatsApp day and night and asks about their need, budget and timeline, reads the photos buyers send, scores every lead from what the buyer actually said, and writes follow-up messages for your agents to send. Artha, the AI copilot, answers questions about your own CRM and updates leads when you ask. On Enterprise it also transcribes and summarises sales calls. Your team stays in charge and can take over any chat."],
  ["Does the AI reply to buyers on its own?",
   "Yes, on the Growth and Enterprise plans the WhatsApp AI agent replies within seconds, even at night and on Sundays. It answers questions about your project and its location, sends the brochure, photos and floor plans, offers a site visit and saves what the buyer says into the lead. Any agent can take over the conversation at any time."],
  ["Which languages does the AI speak?",
   "The WhatsApp AI agent follows the buyer's language, including English, Hinglish, Hindi and Marathi. A buyer who switches from English to Hindi halfway through gets replies in Hindi from that point on."],
  ["How does the AI lead scoring work?",
   "Every lead starts with a 0 to 100 score from rules you can read: budget, how recently it came in, pipeline stage, follow-ups and activity. On Growth, the AI then reads the last 14 days of the buyer's WhatsApp chat (and call summaries on Enterprise) and moves the score up or down by at most 20 points, with a one-line reason, such as the buyer asking for a site visit this weekend. The Hot Today list ranks who to call first and shows that reason. Leads from a bulk import wait until the buyer replies, and agents can flag a score the AI got wrong."],
  ["What is Artha, the AI copilot?",
   "Artha is the assistant built into Arthaleads, on the web and in the Android app. Ask in plain words, or speak: \"How many follow-ups are overdue?\" or \"Show me my hot leads in Baner\". It answers from your own leads, follow-ups, tasks, team and projects, and only shows each person what they are allowed to see. Ask it to set a follow-up, change a lead's status, add a note or assign a lead, and it prepares the change for you to apply with one tap. It never messages a buyer by itself."],
  ["Will an AI CRM replace my sales team?",
   "No. The AI takes the first reply, the qualifying questions and the typing off your team. Calls, site visits, negotiation and the booking still need your people. What changes is that they spend their day on buyers who are ready to talk."],
  ["Which plan has the AI features?",
   `The WhatsApp AI agent, AI lead scoring, AI-written replies and Artha, the AI copilot, are on Growth (₹${PLAN_PRICING.growth.monthly} per user per month plus GST). Call transcripts and AI voice calling are on Enterprise. Every team can try Growth free for 14 days, no credit card needed.`],
];

/** The signature band's visual: the Hot Today list with the AI's one-line
    reasons, and Artha's suggestion under it (coded UI, not a screenshot; the
    same scores and reasons as the hero cards). */
const HOT = [
  ["Kabir Jain", 91, "Hot", "Loan approved, wants a 2 BHK"],
  ["Ananya Iyer", 87, "Hot", "Asked for a site visit Saturday"],
  ["Rohan Patil", 74, "Warm", "Budget confirmed on WhatsApp"],
];
function HotTodayViz() {
  return (
    <div className="site-stage p-3 sm:p-4 space-y-2" aria-hidden="true">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold site-ink px-1 pb-1"><Flame className="w-4 h-4" style={{ color: "var(--site-brand)" }} /> Hot Today</p>
      {HOT.map(([name, score, tag, why]) => (
        <div key={name} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--site-card)", border: "1px solid var(--site-line)" }}>
          <span className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-extrabold shrink-0"
            style={tag === "Hot" ? { background: "rgba(255,107,0,0.14)", color: "var(--site-brand-ink)" } : { background: "rgba(180,83,9,0.12)", color: "var(--site-amber)" }}>{score}</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold site-ink leading-tight">{name} · {tag}</span>
            <span className="block text-[12px] site-muted leading-snug mt-0.5">{why}</span>
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "linear-gradient(rgba(255,107,0,0.08), rgba(255,107,0,0.08)), var(--site-card)", border: "1px solid rgba(255,107,0,0.3)" }}>
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "var(--site-brand-ink)" }} />
        <span className="text-[12.5px] site-ink leading-snug"><b>Artha:</b> 3 follow-ups due today. Apply all in one tap.</span>
      </div>
    </div>
  );
}

export default function AiCrm() {
  useSEO({
    title: "AI CRM for Real Estate in India | Arthaleads",
    description: "AI real estate CRM for India: a WhatsApp AI agent that replies to buyers 24/7 in Hindi, Marathi or English, AI lead scoring with reasons, and Artha, an AI copilot.",
    canonical: "https://www.arthaleads.com/ai-crm",
  });

  return (
    <SolutionPage
      jsonLd={solutionJsonLd({ name: "AI CRM for real estate", path: "/ai-crm", faqs: FAQS })}
      signature={{ tone: "sand", layout: "bento" }}
      hero={{
        lines: ["AI CRM for real estate", "built for Indian sales teams"],
        lede: "A WhatsApp AI agent replies to every enquiry in seconds, fills in the lead and scores it from what the buyer said. Artha, the AI copilot, tells your team who to call first.",
        eyebrow: "AI real estate CRM",
        actions: [
          { label: "Book an AI demo", to: "/book-demo" },
          { label: "See every AI feature", href: "#features" },
        ],
        trust: ["Replies in English, Hindi and Marathi", "Answers 24/7", "AI agent from Growth"],
        photo: "partner",
        photoAlt: "Three colleagues in a small real estate office working together at a laptop",
        cards: [
          { Icon: WhatsAppLogo, iconBg: "rgba(37,211,102,0.14)", title: "AI agent replied in 4 sec", sub: "11:02 PM · in Hindi", cycle: [{ title: "AI agent replied in 6 sec", sub: "1:17 AM · in Marathi" }, { title: "AI agent replied in 3 sec", sub: "9:40 PM · in English" }] },
          { Icon: Flame, title: "Lead score 87 · Hot", sub: "Asked for a site visit Saturday", cycle: [{ title: "Lead score 74 · Warm", sub: "Budget confirmed on WhatsApp" }, { title: "Lead score 91 · Hot", sub: "Loan approved, wants a 2 BHK" }] },
          { Icon: Sparkles, title: "Artha: 3 follow-ups due today", sub: "Apply all in one tap", cycle: [{ title: "Artha: 2 site visits tomorrow", sub: "Reminders drafted" }, { title: "Artha: 5 leads gone quiet", sub: "Follow-ups ready to send" }] },
        ],
      }}
      answer={{
        q: "What is an AI CRM for real estate?",
        paras: [
          "An AI CRM for real estate is a CRM that does part of the sales work itself. It replies to new enquiries, asks buyers the qualifying questions, records their answers on the lead and drafts follow-up messages, so agents start each conversation already knowing the buyer's budget, location and timeline.",
          "In India that work happens on WhatsApp, late in the evening and in more than one language, so the AI agent answers in English, Hinglish, Hindi or Marathi. Scores start from rules you can read, and a person always closes the deal.",
        ],
      }}
      steps={{
        title: "How the AI works on a new enquiry",
        intro: "From a buyer's first message to a call your agent is ready for.",
        items: [
          { title: "A buyer messages at 11 PM", body: "From an ad, your website or a hoarding, into the team inbox, not one agent's phone." },
          { title: "The AI agent replies", body: "In seconds, in the buyer's language, with the brochure, floor plans and the qualifying questions." },
          { title: "The lead fills itself in", body: "Answers and the source ad are saved, an owner is alerted, and the AI scores the chat." },
          { title: "Your agent takes over", body: "Hot Today shows who to call first and why; the agent calls and books the visit." },
        ],
      }}
      features={{
        visual: <HotTodayViz />,
        title: "The AI features, and the plan each is on",
        intro: "On the official WhatsApp Business Platform. Nothing here is demo-only.",
        items: [
          { icon: Flame, title: "AI lead scoring", body: "The AI reads each buyer's recent chat, moves the score with a one-line reason, and ranks Hot Today.", plan: "Growth" },
          { icon: Bot, title: "WhatsApp AI agent", body: "Replies 24/7 in English, Hinglish, Hindi or Marathi and offers a site visit.", plan: "Growth" },
          { icon: MessageSquareText, title: "Artha, the AI copilot", body: "Ask about leads and follow-ups by text or voice, and apply its suggested updates.", plan: "Growth" },
          { icon: ImageIcon, title: "Reads the photos buyers send", body: "Floor plans or site boards sent on WhatsApp get a reply about what they show.", plan: "Growth" },
          { icon: Sparkles, title: "AI-written follow-ups", body: "A personal draft with the buyer's name, project and budget, for the agent to send.", plan: "Growth" },
          { icon: Headphones, title: "Call transcripts and summaries", body: "Recorded calls get a transcript, the buyer's intent and the next step.", plan: "Enterprise" },
          { icon: PhoneCall, title: "AI voice calling", body: "An AI agent calls new leads, qualifies them and hands over the transcript.", plan: "Enterprise" },
          { icon: Gauge, title: "Rule-based lead score", body: "A 0 to 100 score from budget, recency, stage and activity that anyone can read.", plan: "all" },
        ],
      }}
      compare={{
        title: "A regular CRM vs an AI CRM",
        intro: "What changes when the CRM does the first reply and the typing.",
        cols: ["Regular CRM", "Arthaleads AI CRM"],
        rows: [
          ["Buyer messages at 11 PM", "Waits until an agent sees it the next morning", "The AI agent replies in seconds and asks the qualifying questions"],
          ["Language", "Whatever the agent types", "Follows the buyer: English, Hinglish, Hindi or Marathi"],
          ["Lead details", "Typed in by hand after the call", "Filled in from the WhatsApp chat, and from call transcripts on Enterprise"],
          ["Who to call first", "The agent's guess", "A score the AI adjusts from the chat, with its reason, on a Hot Today list"],
          ["Follow-up message", "Written from scratch for each buyer", "Drafted by AI with the buyer's name, project and budget"],
          ["Manager's questions", "Export to Excel and count", "Ask Artha in plain words, and apply its suggested updates in one tap"],
        ],
      }}
      faqs={{ title: "AI CRM questions", items: FAQS }}
      related={[
        { to: "/blog/reply-to-property-enquiries-on-whatsapp-fast", label: "replying to property enquiries at night" },
        { to: "/blog/real-estate-follow-up-system-that-works", label: "a follow-up system that works" },
        { to: "/whatsapp-crm", label: "how the WhatsApp CRM works" },
        { to: "/builder-crm", label: "Arthaleads for builders and developers" },
        { to: "/features", label: "every feature" },
        { to: "/pricing", label: "plans and pricing" },
        { to: "/compare", label: "how Arthaleads compares with other real estate CRMs" },
      ]}
      close={{
        title: "Let the AI",
        dim: "take the first reply.",
        body: "Book a 30-minute demo and watch the AI agent answer a buyer, or start the 14-day free trial yourself.",
      }}
    />
  );
}
