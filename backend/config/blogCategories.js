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
// `guide` (two short paragraphs) and `faqs` show under the topic's articles;
// the FAQs also go to search engines as FAQPage data.
// `legacy` lists older names that now belong to this topic, so a post still
// carrying one lands in the right place.
module.exports = [
  {
    name: "Real Estate CRM",
    slug: "real-estate-crm",
    seoTitle: "Real Estate CRM Guides for Indian Builders and Brokers",
    description: "How to choose, set up and get value from a real estate CRM in India: buying guides for developers, brokers and channel partner teams.",
    intro: "Buying guides and how-tos for real estate CRM software in India: what to ask a vendor, what developers, brokers and channel partners each need, and how to get a sales team to actually use it.",
    guide: [
      "A real estate CRM is the one place where every property enquiry lands, gets an owner and moves through to a site visit and a booking. For Indian teams that usually means pulling in Facebook and Instagram lead ads, WhatsApp chats, portal leads and website forms, then making sure someone calls each buyer back on time.",
      "The guides here help you choose one and get your team to use it: what to ask in a demo, how a builder's needs differ from a broker's or a channel partner's, free versus paid tools, and how to move off spreadsheets without losing leads on the way.",
    ],
    faqs: [
      { question: "What does a real estate CRM do?", answer: "It collects enquiries from every source into one list, assigns each lead to a person, reminds them to follow up, and tracks the buyer through stages such as contacted, site visit and booking, so a manager can see where deals get stuck." },
      { question: "Is a spreadsheet enough for a small team?", answer: "For a handful of leads a week it can work. Once leads arrive from several sources, or more than one person calls them, a sheet makes it easy to miss follow-ups and call the same buyer twice. That is usually the point to move to a CRM." },
      { question: "What should builders look for in a CRM?", answer: "Project-wise lead lists, routing rules for telecallers, duplicate detection, site visit tracking and reports by project and source. Our buying guide lists the questions to ask in a demo." },
    ],
    legacy: ["CRM Guides", "CRM Tips"],
  },
  {
    name: "Lead Generation",
    slug: "lead-generation",
    seoTitle: "Real Estate Lead Generation in India: Portals, Ads and WhatsApp",
    description: "Where real estate leads come from in India and how to get more of them: Facebook and Google ads, 99acres, MagicBricks, Housing.com and your own website.",
    intro: "Where property enquiries come from in India and how to get more of them for less: Facebook and Instagram lead ads, Google ads, 99acres, MagicBricks and Housing.com, your website and the site office.",
    guide: [
      "Property enquiries in India come from many channels at once: Facebook and Instagram lead ads, Google search ads, 99acres, MagicBricks and Housing.com, your own website, walk-ins at the site office, channel partners and hoardings. Each brings a different kind of buyer and needs a slightly different response.",
      "These guides compare the channels, show how to set up lead forms that filter out casual enquiries, and explain how to judge a campaign by the site visits it produces rather than the number of leads.",
    ],
    faqs: [
      { question: "Which lead source is best for real estate in India?", answer: "There is no single best source. Compare channels by cost per site visit and cost per booking, not cost per lead, and keep the source recorded on every lead so the comparison is possible." },
      { question: "Are Facebook lead ads good for real estate?", answer: "They produce enquiries cheaply because the form is pre-filled, but many buyers tap on a whim. A few qualifying questions on the form and a reply within minutes make the difference." },
      { question: "How do I stop portal leads going cold?", answer: "Bring them into the same list as your other leads quickly and reply fast, since the same buyer is often sent to several builders and brokers at once." },
    ],
    legacy: [],
  },
  {
    name: "Lead Management & Follow-ups",
    slug: "lead-management",
    seoTitle: "Real Estate Lead Management and Follow-up Guides",
    description: "Practical systems for capturing every property enquiry, replying fast and following up until the site visit, for Indian real estate sales teams.",
    intro: "Systems for capturing every enquiry, replying while the buyer is still interested and following up until the site visit, without leads slipping between people or spreadsheets.",
    guide: [
      "Lead management is the process between an enquiry arriving and the buyer standing at your site: capturing every lead in one list, giving it an owner, replying while the buyer still remembers you, and following up on a fixed rhythm until they visit or say no.",
      "The guides here set out that process step by step, with the stages a lead should move through, a follow-up cadence your team can keep, and the few numbers that tell a manager whether it is working.",
    ],
    faqs: [
      { question: "What is real estate lead management?", answer: "It is the process of turning enquiries from every source into one list, with a clear owner for each lead and a predictable path from first contact to site visit and booking." },
      { question: "How quickly should a new enquiry get a reply?", answer: "Within minutes where you can. A short WhatsApp reply that answers the question and offers a call time is far better than a perfect reply the next day." },
      { question: "How many times should we follow up?", answer: "Agree a written cadence, for example on days 0, 1, 3, 7 and 14, and a rule for when a lead is marked lost, so leads are neither dropped early nor chased forever." },
    ],
    legacy: ["Real Estate Sales"],
  },
  {
    name: "WhatsApp for Real Estate",
    slug: "whatsapp",
    seoTitle: "WhatsApp for Real Estate: CRM, Automation and Fast Replies",
    description: "Using WhatsApp to answer property enquiries, automate replies and keep every chat on the lead, with the WhatsApp Business API and a CRM.",
    intro: "Many Indian buyers ask on WhatsApp first. Guides to answering them fast, automating the first reply, using the WhatsApp Business API and keeping every chat on the lead instead of one agent's phone.",
    guide: [
      "Many Indian buyers make their first enquiry on WhatsApp, often late at night. If that chat sits on one agent's phone, it is answered late, the buyer's needs live only in that chat, and the rest of the team never sees it.",
      "These guides cover replying fast without burning out your team, what to automate and what to leave to a person, the difference between the WhatsApp Business app and the WhatsApp Business API, and keeping every chat on the lead record.",
    ],
    faqs: [
      { question: "Can a CRM send and receive WhatsApp messages?", answer: "Yes, through the official WhatsApp Business Platform (the API). Chats then arrive in a shared team inbox and are saved on the lead, instead of on one person's phone." },
      { question: "What is the difference between the WhatsApp Business app and the API?", answer: "The app runs on one phone and suits a single person. The API connects WhatsApp to software, so a whole team can share one number, use approved templates and automate the first reply." },
      { question: "Should the first reply be automated?", answer: "An automatic first reply that answers the question and shares the brochure keeps the buyer warm. Hand the conversation to a person once the buyer is ready to talk about a visit or price." },
    ],
    legacy: ["WhatsApp Marketing"],
  },
  {
    name: "AI & Automation",
    slug: "ai-automation",
    seoTitle: "AI and Automation for Real Estate Sales in India",
    description: "How AI agents, lead scoring and automation help Indian real estate teams reply faster, qualify buyers and spend calling time on the right leads.",
    intro: "How AI agents, lead scoring and simple automations help a real estate team reply at any hour, qualify buyers and spend calling time on the leads most likely to visit.",
    guide: [
      "AI in real estate sales is mostly about time: replying to buyers at any hour, asking the qualifying questions so your team does not have to, and ranking leads so telecallers call the right people first.",
      "These guides explain what an AI agent can and cannot do for a sales team, how lead scoring works, and which simple automations remove the most manual work.",
    ],
    faqs: [
      { question: "Can AI reply to property enquiries?", answer: "Yes. An AI agent can answer common questions from your project details, ask about budget and timeline, share the brochure and suggest a site visit, and hand the chat to a person when needed." },
      { question: "Will AI replace telecallers?", answer: "No. It handles the first reply and the routine questions so telecallers spend their time on buyers who are ready to talk." },
    ],
    legacy: [],
  },
  {
    name: "Sales Team & Telecalling",
    slug: "sales-team",
    seoTitle: "Real Estate Sales Team and Telecalling Guides",
    description: "Running a real estate sales floor in India: team structure, telecalling, reporting and coaching without micromanaging.",
    intro: "Running a real estate sales floor: how to structure the team, what telecallers need, which few numbers to review each week and how to coach without micromanaging.",
    guide: [
      "Running a real estate sales floor means keeping a team of telecallers and sales managers focused on the right leads without watching over every call. The best teams agree a few numbers, review them on a fixed day and talk about them openly.",
      "The guides here cover team structure, what telecallers need from their tools, the weekly numbers worth tracking and how to coach without micromanaging.",
    ],
    faqs: [
      { question: "Which numbers should a real estate sales manager track?", answer: "Time to first contact, contact rate, site visits booked and done, visit-to-booking rate and overdue follow-ups. Together they show where leads are being lost." },
      { question: "How do I measure a sales team without micromanaging?", answer: "Review outcomes on a regular day rather than counting activity, explain why each number matters, and change a number openly if it stops being useful." },
    ],
    legacy: ["Real Estate Tips"],
  },
  {
    name: "Site Visits & Bookings",
    slug: "site-visits",
    seoTitle: "Site Visit and Booking Management for Real Estate",
    description: "Book, confirm and follow up property site visits, cut no-shows and track bookings from enquiry to agreement.",
    intro: "Booking, confirming and following up site visits so fewer buyers miss them, and tracking every booking from token to agreement.",
    guide: [
      "The site visit is where most property decisions are made, and every missed or forgotten visit is a buyer lost. A visit needs a confirmed time, a reminder, a named person to meet the buyer and a follow-up the same day.",
      "These guides cover booking and confirming visits, cutting no-shows, what to record after each visit and how to track a booking from token to agreement.",
    ],
    faqs: [
      { question: "How do I reduce site visit no-shows?", answer: "Confirm the day before on WhatsApp with the location pin, the name of the person meeting them and a number to call, and send a short reminder on the day." },
      { question: "What should happen after a site visit?", answer: "Record what the buyer liked and what is holding them back, set the next follow-up before the day ends, and send anything you promised, such as a price sheet or payment plan." },
    ],
    legacy: [],
  },
  {
    name: "Channel Partners",
    slug: "channel-partners",
    seoTitle: "Channel Partner Management in Real Estate",
    description: "How builders work with channel partners in India: lead ownership, registration rules, brokerage tracking and keeping partners on side.",
    intro: "How builders and developers work with channel partners in India: who owns a lead, registration windows, brokerage tracking and keeping partners trusting you.",
    guide: [
      "Channel partners bring buyers to many Indian developers, and disputes are usually about who brought a buyer first. Clear rules for registering a lead, a fixed ownership window and accurate brokerage records keep partners working with you.",
      "These guides cover partner onboarding, lead registration, tracking bookings and brokerage, and the records that settle disputes quickly.",
    ],
    faqs: [
      { question: "What is a channel partner in real estate?", answer: "A broker or firm, usually RERA-registered, that brings buyers to a developer's projects in return for brokerage on bookings." },
      { question: "How do builders avoid lead ownership disputes with channel partners?", answer: "Record the partner and source on the lead when it arrives, publish a registration window and the rule for who owns a returning buyer, and apply it the same way every time." },
    ],
    legacy: [],
  },
];
