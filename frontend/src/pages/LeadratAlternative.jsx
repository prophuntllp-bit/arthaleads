// pages/LeadratAlternative.jsx - /compare/leadrat-alternative, Leadrat pricing
// explained and an honest Arthaleads vs Leadrat comparison.
//
// Every statement about Leadrat comes from its own public pages (leadrat.com,
// its pricing page, refund policy and feature comparison page) and is linked
// as the source. Prices are rendered by script on leadrat.com/pricing, so read
// them in a browser, not from the raw HTML. Never add a claim about Leadrat
// that its site does not make, and never say it lacks something we could not
// confirm. Re-check the facts before editing. Layout:
// components/CompetitorComparison.jsx.
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";
import CompetitorComparison from "../components/CompetitorComparison";

const CHECKED = "14 October 2026";
const SRC_HOME = "https://leadrat.com/";
const SRC_PRICING = "https://leadrat.com/pricing/";
const SRC_REFUND = "https://leadrat.com/refund-and-cancellation-policy/";
const SRC_FEATURES = "https://leadrat.com/leadrat-vs-paramantra/";

const g = PLAN_PRICING.growth.monthly;
const s = PLAN_PRICING.starter.monthly;
const inr = (n) => n.toLocaleString("en-IN");

const LEADRAT = {
  name: "Leadrat",
  pageUrl: "https://www.arthaleads.com/compare/leadrat-alternative",
  checked: CHECKED,
  home: { url: SRC_HOME, label: "leadrat.com" },
  pricing: { url: SRC_PRICING, label: "leadrat.com/pricing" },
  intro: "Leadrat is a real estate CRM with one all-features plan, priced per user and billed annually, starting at 10 users. Arthaleads starts at 5 users with monthly billing, a free trial and a WhatsApp AI agent on Growth. Here is how they compare, using Leadrat's own website as the source.",
  priceCard: { status: "Published", headline: "₹2,299", note: "per user / month at 10 users, billed annually · ₹1,499 at 100 users" },
  chip: `10 users on Growth: ₹${inr(g * 10)} a month + GST`,
  exampleTeam: 10,
  pricingIntro: "Both publish their prices. Leadrat charges per user with one plan and a lower rate for bigger teams; Arthaleads charges per user by plan. This is how Leadrat's pricing page sets it out, next to ours.",
  // Each point as shown on leadrat.com/pricing.
  pricingBullets: [
    "One plan with every feature, priced per user per month and billed annually.",
    "₹2,299 per user at 10 users, ₹2,099 at 20, ₹1,899 at 30, ₹1,699 at 50 and ₹1,499 at 100 users.",
    "Prices start at 10 users: ₹22,990 a month, ₹2,75,880 a year.",
    "Teams of more than 100 users are offered a custom plan.",
    "To get started you schedule a demo; the page does not mention a free trial.",
  ],
  chooseThem: [
    "Your team works property portals such as 99acres and MagicBricks, or GCC portals like Bayut and Property Finder, and you want them connected (Leadrat lists these integrations).",
    "You run field teams and want geofencing, mandatory clock-in and site-visit geo-verification.",
    "You have 30 to 100 users and want a published per-user price at that size.",
  ],
  chooseUs: [
    `You have 5 to 30 users and want to pay monthly, from ₹${s} per user, instead of a year upfront.`,
    "You want to try it on your own leads first: a 14-day free trial with no card, and a 7-day money-back guarantee on new subscriptions.",
    "WhatsApp is where your buyers talk, and you want an AI agent replying to them 24/7 as part of the plan.",
  ],
  // [what we compare, Arthaleads, Leadrat (from its own site), source for the Leadrat cell]
  rows: [
    ["Pricing", `₹${s} (Starter) or ₹${g} (Growth) per user per month, GST extra. Enterprise on quote.`, "₹2,299 per user per month at 10 users, falling to ₹1,499 at 100 users. One plan.", SRC_PRICING],
    ["Billing", "Monthly, or annual with about two months free", "Billed annually", SRC_PRICING],
    ["Smallest team", "5 users", "Prices start at 10 users", SRC_PRICING],
    ["How you try it", "14-day free trial, no credit card", "Schedule a demo", SRC_PRICING],
    ["Refunds", "7-day money-back guarantee on new subscriptions", "Zero refund policy: no refund after cancellation", SRC_REFUND],
    ["Plans", "Starter, Growth and Enterprise, with more features on higher plans", "One plan with every feature", SRC_PRICING],
    ["WhatsApp", "Shared team inbox, AI agent, templates and campaigns, click-to-WhatsApp ad leads", "WhatsApp Business API integration", SRC_FEATURES],
    ["Field teams", "Selfie and location clock-in with attendance reports (Growth)", "Geofencing, mandatory clock-in, site-visit geo-verification and attendance reports", SRC_FEATURES],
    ["Property portals", "No built-in property portal connectors", "99acres, MagicBricks and GCC portals (Bayut, Property Finder, Dubizzle)", SRC_FEATURES],
  ],
  faqs: [
    ["How much does Leadrat cost?",
     `Leadrat publishes its prices. It has one plan, billed annually, at ₹2,299 per user per month for 10 users, ₹2,099 for 20, ₹1,899 for 30, ₹1,699 for 50 and ₹1,499 for 100 users, according to its pricing page on ${CHECKED}. A 10-user team pays ₹22,990 a month, or ₹2,75,880 a year. Teams over 100 users get a custom plan.`],
    ["Is Arthaleads cheaper than Leadrat?",
     `For teams of 5 to 30 users, yes, at list prices. Ten users on Arthaleads Growth cost ₹${inr(g * 10)} a month plus GST (₹${g} per user), against ₹22,990 a month billed annually at Leadrat's published 10-user rate. Starter is ₹${s} per user. Leadrat's pricing page does not say whether GST is included.`],
    ["Does Leadrat have a free trial?",
     "Its pricing page does not mention one; it invites you to schedule a demo. Arthaleads has a 14-day free trial with no credit card, and a 7-day money-back guarantee on new subscriptions."],
    ["Can I move my leads from Leadrat to Arthaleads?",
     "Yes, if you can export them as a CSV or Excel file. Arthaleads imports leads from CSV and Excel on every plan, and our team helps you map the columns and connect your Facebook, Google, website and WhatsApp sources during onboarding."],
    ["Is this comparison fair?",
     `We wrote it, so read it with that in mind. Every statement about Leadrat comes from its own website, linked in the table, as checked on ${CHECKED}. If something has changed, message us and we will correct it.`],
  ],
};

export default function LeadratAlternative() {
  useSEO({
    title: "Leadrat Pricing & Alternative: Arthaleads vs Leadrat CRM",
    description: "Leadrat pricing explained and compared with Arthaleads for Indian real estate teams: per-user prices, billing, free trial, WhatsApp and who each suits.",
    canonical: "https://www.arthaleads.com/compare/leadrat-alternative",
  });
  return <CompetitorComparison c={LEADRAT} />;
}
