// Pre-made WhatsApp templates, grouped by the lead stage they belong to.
//
// These are starting points, not shortcuts past Meta — every one still goes to
// review unchanged, and every one still has to be submitted by the tenant on
// their own WABA.
//
// Two things make these different from a generic template library:
//
//   1. `varMap` binds each {{n}} to a real CRM field, so a campaign fills them
//      from the lead record instead of asking someone to type the same value
//      500 times. Only fields the campaign runner can actually resolve appear
//      here — see VAR_FIELDS in CampaignBuilder.
//   2. The stages match the Lead status values the CRM already uses, so the
//      list you are browsing lines up with the pipeline you are working.
//
// `example` supplies Meta's required sample values, positionally matched to
// varMap. Templates with variables are rejected without them.

export const STAGES = [
  { key: "new",          label: "New enquiry",   status: "New",         blurb: "The first reply, sent while they still remember enquiring." },
  { key: "contacted",    label: "Following up",  status: "Contacted",   blurb: "Staying in touch without becoming noise." },
  { key: "visit",        label: "Site visit",    status: "Site Visit",  blurb: "Confirming, reminding and rescheduling visits." },
  { key: "negotiation",  label: "Negotiation",   status: "Negotiation", blurb: "Offers, payment plans and closing nudges." },
  { key: "won",          label: "After booking", status: "Closed Won",  blurb: "Everything that keeps a booked customer informed." },
  { key: "reengage",     label: "Re-engaging",   status: "",            blurb: "Bringing back leads who went quiet." },
];

export const GALLERY = [
  // ── New enquiry ────────────────────────────────────────────────────────────
  {
    key: "enquiry_ack",
    stage: "new",
    title: "Enquiry acknowledgement",
    description: "Auto-reply the moment a lead comes in from a site or ad.",
    category: "UTILITY",
    body: "Hi {{1}}, thanks for your enquiry about property in {{2}}. I'm {{3}} from {{4}} and I'll be helping you with your search.\n\nCould you tell me when you're planning to buy? I'll shortlist options that fit.",
    footer: "Reply STOP to opt out",
    varMap: ["name", "location", "agentName", "orgName"],
    example: ["Priya", "Khopoli", "Rahul", "PropHunt"],
    buttons: [{ type: "QUICK_REPLY", text: "Within 3 months" }, { type: "QUICK_REPLY", text: "Just exploring" }],
  },
  {
    key: "enquiry_brochure",
    stage: "new",
    title: "Send brochure and price list",
    description: "Follows an enquiry with the documents people always ask for next.",
    category: "UTILITY",
    body: "Hi {{1}}, as requested here are the details for our {{2}} homes in {{3}}.\n\nFloor plans, the price list and the payment schedule are all in the link below. Happy to walk you through any of it.",
    varMap: ["name", "bhk", "location"],
    example: ["Amit", "3BHK", "Panvel"],
    buttons: [{ type: "URL", text: "View brochure", url: "" }],
  },
  {
    key: "enquiry_qualify",
    stage: "new",
    title: "Qualify budget and configuration",
    description: "Asks the two questions that decide everything else.",
    category: "UTILITY",
    body: "Hi {{1}}, to shortlist the right homes for you in {{2}}, could you confirm two things?\n\n• The configuration you're looking for\n• Your comfortable budget range\n\nReply here and I'll send matching options today.",
    varMap: ["name", "location"],
    example: ["Sneha", "Kharghar"],
    buttons: [{ type: "QUICK_REPLY", text: "Share my budget" }],
  },
  {
    key: "launch_announce",
    stage: "new",
    title: "New project launch",
    description: "Announces a launch to leads who opted in.",
    category: "MARKETING",
    body: "Hi {{1}}, we've just launched a new project in {{2}} — {{3}} homes with early-bird pricing for the first bookings.\n\nUnits are limited and the launch pricing is only for this phase. Reply here and I'll send the floor plans and price list.",
    footer: "Reply STOP to opt out",
    varMap: ["name", "location", "bhk"],
    example: ["Rohan", "Ulwe", "2 and 3BHK"],
    buttons: [{ type: "QUICK_REPLY", text: "Send me details" }, { type: "URL", text: "See the project", url: "" }],
  },
  {
    key: "site_lead_callback",
    stage: "new",
    title: "Missed call follow-up",
    description: "For when you called and they did not pick up.",
    category: "UTILITY",
    body: "Hi {{1}}, I tried reaching you about your enquiry for {{2}}. Sorry I missed you.\n\nWhat time suits you for a quick call? I'll ring back then.",
    varMap: ["name", "location"],
    example: ["Kiran", "Taloja"],
    buttons: [{ type: "QUICK_REPLY", text: "Call me this evening" }, { type: "QUICK_REPLY", text: "Message me instead" }],
  },

  // ── Following up ───────────────────────────────────────────────────────────
  {
    key: "followup_options",
    stage: "contacted",
    title: "Shortlisted options",
    description: "Sends a curated shortlist after the first conversation.",
    category: "UTILITY",
    body: "Hi {{1}}, based on what you told me I've shortlisted a few {{2}} homes in {{3}} that fit your budget.\n\nWant me to send the details, or would you rather see them in person?",
    varMap: ["name", "bhk", "location"],
    example: ["Deepak", "2BHK", "Khopoli"],
    buttons: [{ type: "QUICK_REPLY", text: "Send details" }, { type: "QUICK_REPLY", text: "Book a visit" }],
  },
  {
    key: "followup_checkin",
    stage: "contacted",
    title: "Gentle check-in",
    description: "A light touch for leads who have gone quiet for a week or two.",
    category: "UTILITY",
    body: "Hi {{1}}, just checking in on your home search in {{2}}. No pressure at all.\n\nIf the timing has changed, tell me when to follow up and I'll leave you alone until then.",
    varMap: ["name", "location"],
    example: ["Meera", "Panvel"],
    buttons: [{ type: "QUICK_REPLY", text: "Still looking" }, { type: "QUICK_REPLY", text: "Follow up later" }],
  },
  {
    key: "followup_loan",
    stage: "contacted",
    title: "Home loan assistance",
    description: "Offers loan help, which is often the real blocker.",
    category: "UTILITY",
    body: "Hi {{1}}, if financing is what you're working out for your {{2}} purchase, we can help.\n\nWe work with banks offering pre-approved loans, and our team handles the paperwork. Want me to check what you'd be eligible for?",
    varMap: ["name", "bhk"],
    example: ["Vikram", "3BHK"],
    buttons: [{ type: "QUICK_REPLY", text: "Check eligibility" }],
  },
  {
    key: "followup_similar",
    stage: "contacted",
    title: "Similar property available",
    description: "For when something matching their brief comes up.",
    category: "MARKETING",
    body: "Hi {{1}}, a {{2}} in {{3}} just became available and it matches what you were looking for.\n\nThese move quickly at this price. Shall I hold it for you to see this week?",
    footer: "Reply STOP to opt out",
    varMap: ["name", "bhk", "location"],
    example: ["Anita", "2BHK", "Kharghar"],
    buttons: [{ type: "QUICK_REPLY", text: "Yes, hold it" }, { type: "QUICK_REPLY", text: "Send photos" }],
  },

  // ── Site visit ─────────────────────────────────────────────────────────────
  {
    key: "visit_confirm",
    stage: "visit",
    title: "Site visit confirmed",
    description: "Confirms a booked visit with the details they need on the day.",
    category: "UTILITY",
    body: "Hi {{1}}, your site visit to our project in {{2}} is confirmed for {{3}}.\n\nOur team will meet you at the site office. Carry a photo ID for entry. Reply here if anything changes.",
    varMap: ["name", "location", "visitDate"],
    example: ["Suresh", "Khopoli", "Saturday, 14 Sep, 11:00 AM"],
    buttons: [{ type: "QUICK_REPLY", text: "Confirmed" }, { type: "QUICK_REPLY", text: "Reschedule" }],
  },
  {
    key: "visit_reminder",
    stage: "visit",
    title: "Visit reminder",
    description: "Sent the day before, which is where most no-shows are saved.",
    category: "UTILITY",
    body: "Hi {{1}}, a reminder about your site visit to {{2}} tomorrow at {{3}}.\n\nLet me know if you'd like us to arrange pickup. See you there.",
    varMap: ["name", "location", "visitDate"],
    example: ["Pooja", "Ulwe", "11:00 AM"],
    buttons: [{ type: "QUICK_REPLY", text: "See you there" }, { type: "QUICK_REPLY", text: "Need to reschedule" }],
  },
  {
    key: "visit_reschedule",
    stage: "visit",
    title: "Reschedule a visit",
    description: "Offers a new slot after a missed or cancelled visit.",
    category: "UTILITY",
    body: "Hi {{1}}, sorry we missed you for the {{2}} visit. These things happen.\n\nWhich day next week works better? I'll block the slot and confirm.",
    varMap: ["name", "location"],
    example: ["Nikhil", "Panvel"],
    buttons: [{ type: "QUICK_REPLY", text: "This weekend" }, { type: "QUICK_REPLY", text: "Next weekend" }],
  },
  {
    key: "visit_thanks",
    stage: "visit",
    title: "Thank you after the visit",
    description: "Follows up the same evening, while it is fresh.",
    category: "UTILITY",
    body: "Hi {{1}}, thank you for visiting our project in {{2}} today. It was good to meet you.\n\nIf you'd like the price list, payment plan or a second visit with family, just tell me and I'll arrange it.",
    varMap: ["name", "location"],
    example: ["Farhan", "Taloja"],
    buttons: [{ type: "QUICK_REPLY", text: "Send price list" }, { type: "QUICK_REPLY", text: "Book second visit" }],
  },

  // ── Negotiation ────────────────────────────────────────────────────────────
  {
    key: "nego_offer",
    stage: "negotiation",
    title: "Offer summary",
    description: "Puts the offer in writing so nothing is misremembered.",
    category: "UTILITY",
    body: "Hi {{1}}, here's a summary of what we discussed for the {{2}} in {{3}}.\n\nI've shared the final pricing, the payment schedule and what's included. Take your time to review, and tell me if you'd like anything adjusted.",
    varMap: ["name", "bhk", "location"],
    example: ["Rajesh", "3BHK", "Kharghar"],
    buttons: [{ type: "QUICK_REPLY", text: "Looks good" }, { type: "QUICK_REPLY", text: "Let's discuss" }],
  },
  {
    key: "nego_payment_plan",
    stage: "negotiation",
    title: "Flexible payment plan",
    description: "For a buyer who likes the home but is stuck on cash flow.",
    category: "UTILITY",
    body: "Hi {{1}}, about the {{2}} you're considering — we can structure the payment differently if that helps.\n\nThere are a few plans available, including construction-linked. Want me to work out which one suits you?",
    varMap: ["name", "bhk"],
    example: ["Shalini", "2BHK"],
    buttons: [{ type: "QUICK_REPLY", text: "Show me the plans" }],
  },
  {
    key: "nego_closing",
    stage: "negotiation",
    title: "Closing nudge",
    description: "An honest last nudge when a unit is genuinely going.",
    category: "MARKETING",
    body: "Hi {{1}}, the {{2}} in {{3}} you shortlisted has had enquiries from two other buyers this week.\n\nI didn't want you to lose it without knowing. If you'd like to proceed, I can hold it for 48 hours.",
    footer: "Reply STOP to opt out",
    varMap: ["name", "bhk", "location"],
    example: ["Gaurav", "3BHK", "Khopoli"],
    buttons: [{ type: "QUICK_REPLY", text: "Hold it for me" }, { type: "QUICK_REPLY", text: "I've decided against" }],
  },

  // ── After booking ──────────────────────────────────────────────────────────
  {
    key: "won_welcome",
    stage: "won",
    title: "Booking confirmation",
    description: "The message that makes a new buyer feel looked after.",
    category: "UTILITY",
    body: "Congratulations {{1}}! Your booking for the {{2}} in {{3}} is confirmed.\n\nOur team will share the agreement and the payment schedule shortly. I'm on this number if you need anything at all.",
    varMap: ["name", "bhk", "location"],
    example: ["Manish", "3BHK", "Panvel"],
    buttons: [{ type: "QUICK_REPLY", text: "Thank you" }],
  },
  {
    key: "won_payment_due",
    stage: "won",
    title: "Payment instalment reminder",
    description: "A reminder that reads as a service, not a demand.",
    category: "UTILITY",
    body: "Hi {{1}}, a reminder that the next instalment for your home in {{2}} is due on {{3}}.\n\nThe payment details are the same as before. Reply here if you'd like the receipt resent or need a few more days.",
    varMap: ["name", "location", "dueDate"],
    example: ["Ritu", "Ulwe", "30 September"],
    buttons: [{ type: "QUICK_REPLY", text: "Send payment details" }],
  },
  {
    key: "won_possession",
    stage: "won",
    title: "Construction and possession update",
    description: "Keeps buyers informed during the long quiet stretch.",
    category: "UTILITY",
    body: "Hi {{1}}, an update on your home in {{2}}.\n\nConstruction is progressing on schedule and possession is expected by {{3}}. We'll invite you for a site walkthrough closer to handover.",
    varMap: ["name", "location", "possessionDate"],
    example: ["Arjun", "Kharghar", "March 2027"],
    buttons: [{ type: "QUICK_REPLY", text: "Share photos" }],
  },

  // ── Re-engaging ────────────────────────────────────────────────────────────
  {
    key: "reengage_still_looking",
    stage: "reengage",
    title: "Still looking?",
    description: "Reopens a conversation that stopped months ago.",
    category: "MARKETING",
    body: "Hi {{1}}, it's been a while since we spoke about your home search in {{2}}.\n\nPrices and inventory have both moved since then. If you're still looking, I'd be glad to send you what's available now.",
    footer: "Reply STOP to opt out",
    varMap: ["name", "location"],
    example: ["Sandeep", "Panvel"],
    buttons: [{ type: "QUICK_REPLY", text: "Yes, still looking" }, { type: "QUICK_REPLY", text: "No longer interested" }],
  },
  {
    key: "reengage_price_revision",
    stage: "reengage",
    title: "Price revision notice",
    description: "A real reason to get back in touch, which beats a generic nudge.",
    category: "MARKETING",
    body: "Hi {{1}}, prices for our {{2}} homes in {{3}} are being revised from next month.\n\nIf you were considering this project, booking before the revision locks the current rate. Reply and I'll send the current price list.",
    footer: "Reply STOP to opt out",
    varMap: ["name", "bhk", "location"],
    example: ["Neha", "2BHK", "Taloja"],
    buttons: [{ type: "QUICK_REPLY", text: "Send price list" }],
  },
  {
    key: "reengage_referral",
    stage: "reengage",
    title: "Referral request",
    description: "Asks a past buyer for an introduction, at the right moment.",
    category: "MARKETING",
    body: "Hi {{1}}, hope you're settling in well at {{2}}.\n\nIf anyone you know is looking for a home in the area, I'd be glad to help them the way I helped you. A quick introduction is all it takes.",
    footer: "Reply STOP to opt out",
    varMap: ["name", "location"],
    example: ["Karan", "Khopoli"],
    buttons: [{ type: "QUICK_REPLY", text: "Happy to refer" }],
  },
];

// Human names for every binding used above. Showing "Hi [Lead name]" instead of
// "Hi {{1}}" is the whole point of carrying varMap around — you can read what a
// template will actually say before you pick it.
export const VAR_LABELS = {
  name: "Lead name",
  phone: "Lead phone",
  location: "Preferred location",
  city: "City",
  bhk: "Configuration",
  propertyType: "Property type",
  budget: "Budget range",
  visitDate: "Site visit date",
  agentName: "Your name",
  orgName: "Your business",
  dueDate: "Due date",
  possessionDate: "Possession date",
};

/** Fields the campaign runner resolves per lead. Everything else is typed once. */
export const PER_LEAD_FIELDS = new Set([
  "name", "phone", "location", "city", "bhk", "propertyType", "budget", "visitDate",
]);

/** Gallery entries for one stage, in authoring order. */
export const byStage = (stageKey) => GALLERY.filter((t) => t.stage === stageKey);
