// pages/KylasAlternative.jsx - /compare/kylas-alternative, Kylas pricing
// explained and an honest ArthaLeads vs Kylas comparison.
//
// Every statement about Kylas comes from its own public pages (kylas.io, its
// pricing page, refund policy, WhatsApp and integrations pages) and is linked
// as the source. Kylas's Elevate price is set by script per country (India:
// ₹12,999 a month flat), so read it in a browser from India. Kylas charges a
// flat fee, so it is cheaper than our Growth plan from 14 users: say so, the
// page is only credible if it is honest. Never add a claim about Kylas that
// its site does not make. Layout: components/CompetitorComparison.jsx.
import { useSEO } from "../utils/useSEO";
import { PLAN_PRICING } from "../utils/plan";
import CompetitorComparison from "../components/CompetitorComparison";

const CHECKED = "14 October 2026";
const SRC_HOME = "https://kylas.io/";
const SRC_PRICING = "https://kylas.io/pricing";
const SRC_REFUND = "https://kylas.io/refund-policy";
const SRC_WHATSAPP = "https://kylas.io/whatsapp-feature";
const SRC_PORTALS = "https://kylas.io/integrations/leadgeneration";

const g = PLAN_PRICING.growth.monthly;
const s = PLAN_PRICING.starter.monthly;
const KYLAS_FLAT = 12999;
// Largest Growth team that still costs less than Kylas Elevate's flat fee.
const BREAK_EVEN = Math.floor(KYLAS_FLAT / g);
const inr = (n) => n.toLocaleString("en-IN");

const KYLAS = {
  name: "Kylas",
  pageUrl: "https://www.arthaleads.com/compare/kylas-alternative",
  checked: CHECKED,
  home: { url: SRC_HOME, label: "kylas.io" },
  pricing: { url: SRC_PRICING, label: "kylas.io/pricing" },
  intro: "Kylas is a general sales CRM with a free plan and a flat monthly fee for unlimited users. ArthaLeads is built only for real estate teams, priced per user, with a WhatsApp AI agent on Growth. Here is how they compare, using Kylas's own website as the source.",
  priceCardTitle: "List price per month, before tax",
  priceCard: { status: "Published", headline: `₹${inr(KYLAS_FLAT)} / month`, note: "Elevate, flat fee for unlimited users in India · free Embark plan" },
  chip: `${BREAK_EVEN} users on Growth: ₹${inr(g * BREAK_EVEN)} a month + GST`,
  exampleTeam: 10,
  pricingIntro: `Both publish their prices, but they charge differently. Kylas charges one flat monthly fee for unlimited users; ArthaLeads charges per user. At list prices, ArthaLeads Growth costs less for teams of up to ${BREAK_EVEN} users and Kylas Elevate costs less from ${BREAK_EVEN + 1} users.`,
  // Each point as shown on kylas.io/pricing (India prices).
  pricingBullets: [
    "Embark: free for life, unlimited users, 10,000 records. No WhatsApp, API access, history feed or automated lead routing on this plan.",
    `Elevate: ₹${inr(KYLAS_FLAT)} a month as a flat fee in India, unlimited users, 100,000 records.`,
    "Elevate has a 7-day free trial with no credit card.",
    "Exceed: a custom plan with phone support and an account manager.",
    "Paid add-ons include field sales tracking (₹400 per user per month), BI analytics (₹5,000 a month) and more workflows (₹500 a month for 10).",
  ],
  chooseThem: [
    "You sell more than property, or want one general sales CRM with deals, quotations and products across several businesses.",
    `Your team has ${BREAK_EVEN + 1} or more users and you would rather pay one flat monthly fee than pay per user.`,
    "You want to start on a free plan and add features such as field sales tracking or BI analytics as paid add-ons.",
  ],
  chooseUs: [
    "You are a real estate team and want a CRM built around projects, site visits and bookings, not a general sales CRM you set up for property.",
    "WhatsApp is where your buyers talk, and you want an AI agent that replies and qualifies them 24/7 as part of the plan.",
    `You have 5 to ${BREAK_EVEN} users, where per-user pricing costs less than a flat fee, and want a 14-day trial plus a 7-day money-back guarantee.`,
  ],
  // [what we compare, ArthaLeads, Kylas (from its own site), source for the Kylas cell]
  rows: [
    ["Pricing model", `Per user: ₹${s} (Starter) or ₹${g} (Growth) per user per month, GST extra`, `Flat fee: Elevate ₹${inr(KYLAS_FLAT)} a month in India for unlimited users`, SRC_PRICING],
    ["Free option", "14-day free trial, no credit card", "Free Embark plan for life; 7-day Elevate trial, no card", SRC_PRICING],
    ["Built for", "Real estate teams in India", "Sales teams in general, with Indian property portal integrations (99acres, MagicBricks, Housing.com)", SRC_PORTALS],
    ["WhatsApp", "Shared team inbox, AI agent, templates and campaigns; every new chat becomes a lead", "Two-way chat and templates in the CRM; inbuilt WhatsApp is an add-on at ₹3,500 a month plus message credits", SRC_WHATSAPP],
    ["Field teams", "Selfie and location clock-in with attendance reports (Growth)", "Field sales tracking add-on at ₹400 per user per month", SRC_PRICING],
    ["Pipelines", "Kanban lead pipeline, organised by project", "Customisable lead and deal pipelines", SRC_PRICING],
    ["Refunds", "7-day money-back guarantee on new subscriptions", "Full refund if an annual plan is cancelled within five business days of renewal; none after 30 days", SRC_REFUND],
  ],
  faqs: [
    ["How much does Kylas cost?",
     `Kylas publishes its prices. Its Embark plan is free for life with unlimited users and 10,000 records. Elevate is ₹${inr(KYLAS_FLAT)} a month as a flat fee in India for unlimited users, with a 7-day free trial. Exceed is a custom plan. Field sales tracking, BI analytics, extra workflows and inbuilt WhatsApp are paid add-ons, according to its website on ${CHECKED}.`],
    ["Is ArthaLeads cheaper than Kylas?",
     `It depends on team size. At list prices before tax, ArthaLeads Growth at ₹${g} per user costs less than Kylas Elevate's flat ₹${inr(KYLAS_FLAT)} for teams of up to ${BREAK_EVEN} users, and more from ${BREAK_EVEN + 1} users. Starter, at ₹${s} per user for up to 10 users, costs less than Elevate at every size it covers. Kylas also has a free plan with fewer features.`],
    ["Is Kylas a real estate CRM?",
     "Kylas is a general sales CRM with pages for several industries. Its website lists integrations with Indian property portals such as 99acres, MagicBricks and Housing.com. ArthaLeads is built only for real estate teams."],
    ["Can I move my leads from Kylas to ArthaLeads?",
     "Yes, if you can export them as a CSV or Excel file. ArthaLeads imports leads from CSV and Excel on every plan, and our team helps you map the columns and connect your Facebook, Google, website and WhatsApp sources during onboarding."],
    ["Is this comparison fair?",
     `We wrote it, so read it with that in mind. Every statement about Kylas comes from its own website, linked in the table, as checked on ${CHECKED}. If something has changed, message us and we will correct it.`],
  ],
};

export default function KylasAlternative() {
  useSEO({
    title: "Kylas Pricing & Alternative: ArthaLeads vs Kylas CRM",
    description: "Kylas CRM pricing explained and compared with ArthaLeads for real estate teams: flat fee vs per user, free plan, WhatsApp and who each one suits best.",
    canonical: "https://www.arthaleads.com/compare/kylas-alternative",
  });
  return <CompetitorComparison c={KYLAS} />;
}
