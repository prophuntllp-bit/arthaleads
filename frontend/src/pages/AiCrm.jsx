// pages/AiCrm.jsx - /ai-crm, "AI CRM for real estate in India".
//
// Targets "ai crm india" (1K-10K a month, Google Trends scaled to the owner's
// Keyword Planner data, Oct 2026), "ai crm software india", "ai crm for real
// estate" and "real estate crm with ai". Keyword plan:
// https://claude.ai/artifact/CuDksmB3zWyQ77fbh5jUdH
//
// Every claim must match what the product does and the plan it is on
// (checked 16 Oct 2026): WhatsApp AI agent, AI drafts (leadRoutes
// draft-message) and Copilot = Growth (planGate); automatic call transcripts
// and Vistrow Voice = Enterprise (enablexRoutes transcribeAndSummarize,
// vistrowLeadRoutes); lead scoring = fixed rules on every plan, so it is not
// called AI here.
import { Bot, Sparkles, MessageSquareText, Gauge, Headphones, PhoneCall } from "lucide-react";
import SolutionPage, { solutionJsonLd } from "../components/SolutionPage";
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";

const FAQS = [
  ["What does the AI in Arthaleads actually do?",
   "It answers buyers on WhatsApp day and night and asks about budget, location and timeline, writes personal follow-up messages for your agents to send, answers questions about your own CRM data, and on Enterprise transcribes and summarises sales calls. Your team stays in charge and can take over any chat."],
  ["Does the AI reply to buyers on its own?",
   "Yes, on the Growth and Enterprise plans the WhatsApp AI agent replies within seconds, even at night and on Sundays. It shares your project details, brochure and location, and saves what the buyer says into the lead. Any agent can take over the conversation at any time."],
  ["Which languages does the AI speak?",
   "The WhatsApp AI agent follows the buyer's language, including English, Hinglish, Hindi and Marathi. A buyer who switches from English to Hindi halfway through gets replies in Hindi from that point on."],
  ["Is the lead score made by AI?",
   "No. Every lead gets a 0 to 100 score from fixed rules: budget, how recently it came in, pipeline stage, follow-ups and activity. Fixed rules mean your team can see why a lead ranks high, and the Hot Today list shows the top leads to call each morning."],
  ["Will an AI CRM replace my sales team?",
   "No. The AI takes the first reply, the qualifying questions and the typing off your team. Calls, site visits, negotiation and the booking still need your people. What changes is that they spend their day on buyers who are ready to talk."],
  ["Which plan has the AI features?",
   `The WhatsApp AI agent, AI-written replies and the CRM copilot are on Growth (₹${PLAN_PRICING.growth.monthly} per user per month plus GST). Call transcripts and Vistrow Voice AI calling are on Enterprise. Every team can try Growth free for 14 days, no credit card needed.`],
];

export default function AiCrm() {
  useSEO({
    title: "AI CRM for Real Estate in India | Arthaleads",
    description: "AI-powered real estate CRM for India: a WhatsApp AI agent that replies to buyers 24/7 in Hindi, Marathi or English, AI-written follow-ups and a CRM copilot.",
    canonical: "https://www.arthaleads.com/ai-crm",
  });

  return (
    <SolutionPage
      jsonLd={solutionJsonLd({ name: "AI CRM for real estate", path: "/ai-crm", faqs: FAQS })}
      hero={{
        lines: ["AI CRM for real estate", "built for Indian sales teams"],
        lede: "Arthaleads replies to every property enquiry in seconds with a WhatsApp AI agent, fills in the lead from the chat, writes your agents' follow-ups and answers your questions about the pipeline. Your team spends its time on buyers who are ready to visit.",
        image: "/tour/lead.webp",
        imageAlt: "A lead created from a WhatsApp chat in Arthaleads, with the buyer's requirements, budget and priority filled in",
        chips: ["AI reply sent on WhatsApp", "Priority: Hot"],
      }}
      answer={{
        q: "What is an AI CRM for real estate?",
        paras: [
          "An AI CRM for real estate is a CRM that does part of the sales work itself. It replies to new enquiries, asks buyers the qualifying questions, records their answers on the lead and drafts follow-up messages, so agents start each conversation already knowing the buyer's budget, location and timeline.",
          "In India that work happens mostly on WhatsApp, often late in the evening and in more than one language. Arthaleads is built around that: the AI agent answers on your official WhatsApp Business number in English, Hinglish, Hindi or Marathi, and every chat becomes a lead your whole team can see.",
          "The AI does not decide who your best leads are by guesswork. Lead scores come from fixed rules you can read, and a person always books the site visit and closes the deal.",
        ],
      }}
      steps={{
        title: "How the AI works on a new enquiry",
        intro: "From a buyer's first message to a call your agent is ready for.",
        items: [
          { title: "A buyer messages at 11 PM", body: "From a click-to-WhatsApp ad, your website button or a site hoarding. The chat lands in the team inbox, not on one agent's phone." },
          { title: "The AI agent replies", body: "Within seconds, in the buyer's language. It answers questions about the project, shares the brochure and location, and asks what they need, their budget and when they plan to buy." },
          { title: "The lead fills itself in", body: "The buyer's answers are saved on the lead with the ad it came from. The lead gets a score and an owner, and that agent's phone gets a push alert." },
          { title: "Your agent takes over", body: "In the morning the agent reads the whole chat, sends an AI-drafted follow-up in one tap, calls the buyer and books the site visit." },
        ],
      }}
      features={{
        title: "The AI features, and the plan each is on",
        intro: "Built on the official WhatsApp Business Platform. Nothing here is a demo-only feature.",
        items: [
          { icon: Bot, title: "WhatsApp AI agent", body: "Replies to buyers 24/7 in English, Hinglish, Hindi or Marathi, qualifies them and offers a site visit. Any agent can take over the chat.", plan: "Growth" },
          { icon: Sparkles, title: "AI-written follow-ups", body: "For any lead, AI drafts a personal WhatsApp message using their name, project interest and budget. The agent reviews it and sends it.", plan: "Growth" },
          { icon: MessageSquareText, title: "CRM copilot", body: "Ask in plain words: \"How many overdue follow-ups do I have?\" or \"Who are my hottest leads?\" and get the answer from your own data.", plan: "Growth" },
          { icon: Headphones, title: "Call transcripts and summaries", body: "Recorded calls are transcribed, with the buyer's intent, a summary and the next step. A call that mentions a site visit can move the lead's stage.", plan: "Enterprise" },
          { icon: PhoneCall, title: "Vistrow Voice AI calling", body: "An AI calling agent phones new leads, qualifies them and hands them over with the call transcript and the language they spoke.", plan: "Enterprise" },
          { icon: Gauge, title: "Lead score and Hot Today", body: "Every lead scored 0 to 100 from fixed rules on budget, recency, stage and activity, with a morning list of who to call first.", plan: "all" },
        ],
      }}
      compare={{
        title: "A regular CRM vs an AI CRM",
        intro: "What changes for a property sales team when the CRM does the first reply and the typing.",
        cols: ["Regular CRM", "Arthaleads AI CRM"],
        rows: [
          ["Buyer messages at 11 PM", "Waits until an agent sees it the next morning", "The AI agent replies in seconds and asks the qualifying questions"],
          ["Language", "Whatever the agent types", "Follows the buyer: English, Hinglish, Hindi or Marathi"],
          ["Lead details", "Typed in by hand after the call", "Filled in from the WhatsApp chat, and from call transcripts on Enterprise"],
          ["Who to call first", "The agent's guess", "A 0 to 100 score and a Hot Today list"],
          ["Follow-up message", "Written from scratch for each buyer", "Drafted by AI with the buyer's name, project and budget"],
          ["Manager's questions", "Export to Excel and count", "Ask the copilot in plain words"],
        ],
      }}
      faqs={{ title: "AI CRM questions", items: FAQS }}
      related={[
        { to: "/whatsapp-crm", label: "how the WhatsApp CRM works" },
        { to: "/builder-crm", label: "Arthaleads for builders and developers" },
        { to: "/features", label: "every feature" },
        { to: "/pricing", label: "plans and pricing" },
        { to: "/compare", label: "how Arthaleads compares with other real estate CRMs" },
      ]}
      close={{
        title: "Let the AI take the first reply",
        body: "Start the 14-day free trial, or message us on WhatsApp and watch the AI agent answer you.",
      }}
    />
  );
}
