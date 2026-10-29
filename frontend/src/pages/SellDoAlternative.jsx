// pages/SellDoAlternative.jsx - /compare/sell-do-alternative, Sell.Do pricing
// explained and an honest Arthaleads vs Sell.Do comparison.
//
// Targets "sell do pricing", "sell do reviews" and "sell do alternative"
// (10-100 searches a month each in India, Keyword Planner, Oct 2026). The big
// "sell do" / "sell do login" volume is navigational and not expected here.
// Every statement about Sell.Do comes from its own public pages (sell.do and
// sell.do/pricing) and is linked as the source. Never add a claim about Sell.Do
// that its site does not make, and never say it lacks something we could not
// confirm. Re-check the facts before editing this page. Layout:
// components/CompetitorComparison.jsx.
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";
import CompetitorComparison from "../components/CompetitorComparison";

const CHECKED = "14 October 2026";
const SRC_HOME = "https://www.sell.do/";
const SRC_PRICING = "https://www.sell.do/pricing";

const SELLDO = {
  name: "Sell.Do",
  pageUrl: "https://www.arthaleads.com/compare/sell-do-alternative",
  checked: CHECKED,
  home: { url: SRC_HOME, label: "sell.do" },
  pricing: { url: SRC_PRICING, label: "sell.do/pricing" },
  intro: "Sell.Do is an established platform built for large developers, sold on a custom quote. Arthaleads is a simpler real estate CRM with published prices, a free trial and a WhatsApp AI agent in the plan. Here is how they compare, using Sell.Do's own website as the source.",
  priceCard: { status: "Not published", headline: "Custom quote", note: "Book a call first · AI and messaging billed on usage" },
  chip: `5 users on Growth: ₹${(PLAN_PRICING.growth.monthly * 5).toLocaleString("en-IN")} a month + GST`,
  pricingIntro: "Sell.Do does not publish a price list, so there is no single number to quote. This is how its own pricing page says the price is worked out, next to what Arthaleads charges.",
  // Each point as stated on sell.do/pricing.
  pricingBullets: [
    "No published rate card. You book a call and receive a custom quote.",
    "Charged per active user per month, with a minimum of 5 users.",
    "The rate depends on the modules: core CRM, the full real-estate suite, or both.",
    "AI (Jarvis scoring, voice agents, call analysis) is a usage-based add-on.",
    "WhatsApp, telephony, SMS and email costs are quoted for your volumes.",
    "Discounts are offered on annual contracts.",
  ],
  chooseThem: [
    "You are a large developer running big launches and need a launch-day booking and inventory engine (Sell.Do calls it IRIS).",
    "You want one vendor for pre-sales, inventory, channel partners and post-sales, and have the budget for a custom quote.",
    "You want AI voice agents calling every lead and are happy to pay for AI usage on top of seats.",
  ],
  chooseUs: [
    "You are a broker, channel partner or a small to mid-size developer and want to start this week, not after a sales cycle.",
    "You want prices you can see today and a free trial on your own leads before you commit.",
    "WhatsApp is where your buyers talk, and you want an AI agent replying to them 24/7 as part of the plan.",
  ],
  // [what we compare, Arthaleads, Sell.Do (from its own site), source for the Sell.Do cell]
  rows: [
    ["Pricing", `Published: ₹${PLAN_PRICING.starter.monthly} (Starter) or ₹${PLAN_PRICING.growth.monthly} (Growth) per user per month, GST extra. Enterprise on quote.`, "Not published. A custom per-user quote based on team size and modules.", SRC_PRICING],
    ["Minimum team size", "5 users", "5 users", SRC_PRICING],
    ["How you try it", "14-day free trial, no credit card", "Book a demo, then a written quote", SRC_PRICING],
    ["AI", "WhatsApp AI agent, lead scoring and AI-written replies included on Growth", "Jarvis AI: voice agents, call analysis and content agents, priced as usage-based add-ons", SRC_PRICING],
    ["WhatsApp", "Shared team inbox, AI agent, templates and campaigns, click-to-WhatsApp ad leads", "WhatsApp Connector, with communication costs quoted separately", SRC_HOME],
    ["Launch-day booking engine", "Not built for launch-day inventory release", "IRIS launch platform for bookings and inventory at launch", SRC_HOME],
    ["Post-sales", "Bookings and brokerage invoices", "Post-sales and collections in the real-estate suite", SRC_PRICING],
    ["Track record", "Newer, built in Pune for Indian sales teams", "15 years, 1,500+ real estate businesses (its own figures)", SRC_HOME],
  ],
  faqs: [
    ["How much does Sell.Do cost?",
     "Sell.Do does not publish its prices. According to its pricing page, it quotes per active user per month with a minimum of 5 users, the rate depends on whether you take the core CRM or the full real-estate suite, and AI features and communication channels (WhatsApp, telephony, SMS, email) are priced as usage-based add-ons. You need to book a call to get a number."],
    ["Is Arthaleads cheaper than Sell.Do?",
     `We cannot compare exact prices, because Sell.Do does not publish them: it sends a custom quote per team. Arthaleads publishes its prices: ₹${PLAN_PRICING.starter.monthly} or ₹${PLAN_PRICING.growth.monthly} per user per month plus GST, with no setup fee, and Growth includes the WhatsApp AI agent.`],
    ["Can I move my leads from Sell.Do to Arthaleads?",
     "Yes, if you can export them as a CSV or Excel file. Arthaleads imports leads from CSV and Excel on every plan, and our team helps you map the columns and connect your Facebook, Google, website and WhatsApp sources during onboarding."],
    ["Does Arthaleads have AI calling like Sell.Do?",
     "Yes, through our AI calling agent, on the Enterprise plan. Every plan also has one-tap calling from the lead, with the call logged automatically."],
    ["Is this comparison fair?",
     `We wrote it, so read it with that in mind. Every statement about Sell.Do comes from its own website, linked in the table, as checked on ${CHECKED}. If something has changed, message us and we will correct it.`],
  ],
};

export default function SellDoAlternative() {
  useSEO({
    // Searches are "sell.do alternative(s)": that phrase leads (GSC, 29 Oct 2026).
    title: "Sell.Do Alternative: Pricing and Features vs Arthaleads",
    description: "A Sell.Do alternative with published prices, a 14-day free trial and a WhatsApp AI agent. Sell.Do quotes on request. Both compared, with sources and dates.",
    canonical: "https://www.arthaleads.com/compare/sell-do-alternative",
  });
  return <CompetitorComparison c={SELLDO} />;
}
