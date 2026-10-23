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
   `The WhatsApp AI agent, AI lead scoring, AI-written replies and Artha, the AI copilot, are on Growth (₹${PLAN_PRICING.growth.monthly} per user per month plus GST). Call transcripts and Vistrow Voice AI calling are on Enterprise. Every team can try Growth free for 14 days, no credit card needed.`],
];

export default function AiCrm() {
  useSEO({
    title: "AI CRM for Real Estate in India | Arthaleads",
    description: "AI real estate CRM for India: a WhatsApp AI agent that replies to buyers 24/7 in Hindi, Marathi or English, AI lead scoring with reasons, and Artha, an AI copilot.",
    canonical: "https://www.arthaleads.com/ai-crm",
  });

  return (
    <SolutionPage
      jsonLd={solutionJsonLd({ name: "AI CRM for real estate", path: "/ai-crm", faqs: FAQS })}
      hero={{
        lines: ["AI CRM for real estate", "built for Indian sales teams"],
        lede: "Arthaleads replies to every property enquiry in seconds with a WhatsApp AI agent, fills in the lead from the chat, scores it from what the buyer said and tells your team who to call first. Artha, the AI copilot, answers questions about your pipeline and updates leads when you ask.",
        image: "/tour/lead.webp",
        imageAlt: "A lead created from a WhatsApp chat in Arthaleads, with the buyer's requirements, budget and priority filled in",
        chips: ["AI reply sent on WhatsApp", "Priority: Hot"],
      }}
      answer={{
        q: "What is an AI CRM for real estate?",
        paras: [
          "An AI CRM for real estate is a CRM that does part of the sales work itself. It replies to new enquiries, asks buyers the qualifying questions, records their answers on the lead and drafts follow-up messages, so agents start each conversation already knowing the buyer's budget, location and timeline.",
          "In India that work happens mostly on WhatsApp, often late in the evening and in more than one language. Arthaleads is built around that: the AI agent answers on your official WhatsApp Business number in English, Hinglish, Hindi or Marathi, and every chat becomes a lead your whole team can see.",
          "The AI does not rank leads by guesswork. Each score starts from rules you can read, the AI adjusts it from what the buyer actually said and gives its reason in one line, and a person always books the site visit and closes the deal.",
        ],
      }}
      steps={{
        title: "How the AI works on a new enquiry",
        intro: "From a buyer's first message to a call your agent is ready for.",
        items: [
          { title: "A buyer messages at 11 PM", body: "From a click-to-WhatsApp ad, your website button or a site hoarding. The chat lands in the team inbox, not on one agent's phone." },
          { title: "The AI agent replies", body: "Within seconds, in the buyer's language. It answers questions about the project and its location, sends the brochure, photos and floor plans, and asks what they need, their budget and when they plan to buy." },
          { title: "The lead fills itself in", body: "The buyer's answers are saved on the lead with the ad it came from. The lead gets an owner, that agent's phone gets a push alert, and the AI scores the lead from the chat once the buyer goes quiet." },
          { title: "Your agent takes over", body: "In the morning Hot Today shows who to call first and why. The agent reads the chat, sends an AI-drafted follow-up, calls the buyer and books the site visit." },
        ],
      }}
      features={{
        title: "The AI features, and the plan each is on",
        intro: "Built on the official WhatsApp Business Platform. Nothing here is a demo-only feature.",
        items: [
          { icon: Bot, title: "WhatsApp AI agent", body: "Replies to buyers 24/7 in English, Hinglish, Hindi or Marathi, qualifies them and offers a site visit. Any agent can take over the chat.", plan: "Growth" },
          { icon: Flame, title: "AI lead scoring", body: "The AI reads each buyer's recent WhatsApp chat and moves the lead's score up or down, with a one-line reason and a next step on the Hot Today list.", plan: "Growth" },
          { icon: MessageSquareText, title: "Artha, the AI copilot", body: "Ask about your leads, follow-ups and team in plain words or by voice, on the web or the Android app. Artha prepares follow-ups, status changes and notes for you to apply.", plan: "Growth" },
          { icon: ImageIcon, title: "Reads the photos buyers send", body: "When a buyer sends a photo on WhatsApp, such as a floor plan or a site board, the AI agent looks at it and replies to what it shows.", plan: "Growth" },
          { icon: Sparkles, title: "AI-written follow-ups", body: "For any lead, AI drafts a personal WhatsApp message using their name, project interest and budget. The agent reviews it and sends it.", plan: "Growth" },
          { icon: Headphones, title: "Call transcripts and summaries", body: "Recorded calls are transcribed, with the buyer's intent, a summary and the next step. Switch it on and a call that books a site visit moves the lead's stage.", plan: "Enterprise" },
          { icon: PhoneCall, title: "Vistrow Voice AI calling", body: "An AI calling agent phones new leads, qualifies them and hands them over with the call transcript and the language they spoke.", plan: "Enterprise" },
          { icon: Gauge, title: "Rule-based lead score", body: "Every lead gets a 0 to 100 score from rules on budget, recency, stage and activity, so your team can always see why a lead ranks where it does.", plan: "all" },
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
          ["Who to call first", "The agent's guess", "A score the AI adjusts from the chat, with its reason, on a Hot Today list"],
          ["Follow-up message", "Written from scratch for each buyer", "Drafted by AI with the buyer's name, project and budget"],
          ["Manager's questions", "Export to Excel and count", "Ask Artha in plain words, and apply its suggested updates in one tap"],
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
