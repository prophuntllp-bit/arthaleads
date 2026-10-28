// config/blogCategories.js - the blog's topics, each with its own page at
// /blog/category/<slug> (owner, 28 Oct 2026: categories that can rank on Google).
//
// Chosen from Google India search suggestions on 28 Oct 2026 (e.g. "best crm
// for real estate india", "real estate lead generation india", "whatsapp crm
// for real estate", "ai agent for real estate india", "site visit management in
// real estate", "what is channel partner in real estate").
//
// `name` must match the Category dropdown in studio/schemaTypes/post.js: the
// Sanity sync finds a post's topic by that name. A topic with no published post
// is left off the blog and out of the sitemap until one arrives.
// `legacy` lists older names that now belong to this topic, so a post still
// carrying one lands in the right place.
module.exports = [
  {
    name: "Real Estate CRM",
    slug: "real-estate-crm",
    seoTitle: "Real Estate CRM Guides for Indian Builders and Brokers",
    description: "How to choose, set up and get value from a real estate CRM in India: buying guides for developers, brokers and channel partner teams.",
    intro: "Buying guides and how-tos for real estate CRM software in India: what to ask a vendor, what developers, brokers and channel partners each need, and how to get a sales team to actually use it.",
    legacy: ["CRM Guides", "CRM Tips"],
  },
  {
    name: "Lead Generation",
    slug: "lead-generation",
    seoTitle: "Real Estate Lead Generation in India: Portals, Ads and WhatsApp",
    description: "Where real estate leads come from in India and how to get more of them: Facebook and Google ads, 99acres, MagicBricks, Housing.com and your own website.",
    intro: "Where property enquiries come from in India and how to get more of them for less: Facebook and Instagram lead ads, Google ads, 99acres, MagicBricks and Housing.com, your website and the site office.",
    legacy: [],
  },
  {
    name: "Lead Management & Follow-ups",
    slug: "lead-management",
    seoTitle: "Real Estate Lead Management and Follow-up Guides",
    description: "Practical systems for capturing every property enquiry, replying fast and following up until the site visit, for Indian real estate sales teams.",
    intro: "Systems for capturing every enquiry, replying while the buyer is still interested and following up until the site visit, without leads slipping between people or spreadsheets.",
    legacy: ["Real Estate Sales"],
  },
  {
    name: "WhatsApp for Real Estate",
    slug: "whatsapp",
    seoTitle: "WhatsApp for Real Estate: CRM, Automation and Fast Replies",
    description: "Using WhatsApp to answer property enquiries, automate replies and keep every chat on the lead, with the WhatsApp Business API and a CRM.",
    intro: "Most Indian buyers ask on WhatsApp first. Guides to answering them fast, automating the first reply, using the WhatsApp Business API and keeping every chat on the lead instead of one agent's phone.",
    legacy: ["WhatsApp Marketing"],
  },
  {
    name: "AI & Automation",
    slug: "ai-automation",
    seoTitle: "AI and Automation for Real Estate Sales in India",
    description: "How AI agents, lead scoring and automation help Indian real estate teams reply faster, qualify buyers and spend calling time on the right leads.",
    intro: "How AI agents, lead scoring and simple automations help a real estate team reply at any hour, qualify buyers and spend calling time on the leads most likely to visit.",
    legacy: [],
  },
  {
    name: "Sales Team & Telecalling",
    slug: "sales-team",
    seoTitle: "Real Estate Sales Team and Telecalling Guides",
    description: "Running a real estate sales floor in India: team structure, telecalling, reporting and coaching without micromanaging.",
    intro: "Running a real estate sales floor: how to structure the team, what telecallers need, which few numbers to review each week and how to coach without micromanaging.",
    legacy: ["Real Estate Tips"],
  },
  {
    name: "Site Visits & Bookings",
    slug: "site-visits",
    seoTitle: "Site Visit and Booking Management for Real Estate",
    description: "Book, confirm and follow up property site visits, cut no-shows and track bookings from enquiry to agreement.",
    intro: "Booking, confirming and following up site visits so fewer buyers miss them, and tracking every booking from token to agreement.",
    legacy: [],
  },
  {
    name: "Channel Partners",
    slug: "channel-partners",
    seoTitle: "Channel Partner Management in Real Estate",
    description: "How builders work with channel partners in India: lead ownership, registration rules, brokerage tracking and keeping partners on side.",
    intro: "How builders and developers work with channel partners in India: who owns a lead, registration windows, brokerage tracking and keeping partners trusting you.",
    legacy: [],
  },
];
