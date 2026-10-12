// data/introFilm.js - the 2:17 product film: chapters, transcript and the
// VideoObject structured data Google needs to show it in video results.
//
// Timings and words come from the film's own voice cues
// (Desktop/BRANDS/Arhtaleads/promo-video: script.json + promo/cues.json), so
// the transcript matches what is actually said. Re-sync both if the film is
// re-cut.
const SITE = "https://www.arthaleads.com";
export const TOUR_URL = `${SITE}/product-tour`;

export const FILM = {
  name: "What is ArthaLeads? The real estate CRM in 2 minutes",
  description:
    "A buyer messages at 1 AM. See how ArthaLeads replies on WhatsApp, qualifies the buyer, books the site visit, fills in the lead, scores it and tells your team who to call first. The AI-powered CRM built for real estate teams in India.",
  durationSec: 137,
  duration: "PT2M17S",
  // Full date-time with the IST offset: a bare date is flagged by Search Console
  // ("uploadDate is missing a timezone").
  uploadDate: "2026-10-07T12:00:00+05:30",
  contentUrl: `${SITE}/video/arthaleads-intro-en.mp4`,
  thumbnailUrl: `${SITE}/video/arthaleads-intro-en-poster.jpg`,
};

// Key moments. `t` is the start in seconds; each ends where the next begins.
export const CHAPTERS = [
  { t: 0,   title: "A buyer messages at 1 AM" },
  { t: 23,  title: "Meet ArthaLeads" },
  { t: 29,  title: "The AI agent replies on WhatsApp and books the site visit" },
  { t: 58,  title: "Every answer goes straight into the lead" },
  { t: 75,  title: "AI lead scores and a copilot that sets follow-ups" },
  { t: 86,  title: "One-tap calls and Vistrow Voice AI calling" },
  { t: 100, title: "Every lead source in one place" },
  { t: 111, title: "Pipeline, WhatsApp campaigns and the mobile app" },
  { t: 125, title: "Pricing and booking a demo" },
];

export const TRANSCRIPT = [
  { t: 0,   text: "One AM, at night. A buyer asks about your project. Your team is offline. But the buyer still gets every answer. The price. Photos. The brochure. A walkthrough video. And a site visit, booked. No human needed." },
  { t: 16,  text: "Most enquiries wait till morning. By then, the buyer has moved on. Not anymore." },
  { t: 23,  text: "Meet ArthaLeads, by Vistrow. The AI-powered CRM, built for real estate." },
  { t: 29,  text: "Here's how. Your AI agent replies on WhatsApp, instantly. It asks what they're looking for, their budget, and when they plan to buy. Photos. Brochure. Video. Location." },
  { t: 43,  text: "Then it books the site visit. Day or night, every day of the week. Twenty-four seven. And the moment a buyer is ready, your team gets a ping. You tell it about your projects. It does the talking." },
  { t: 58,  text: "Every answer goes straight into the lead. Budget. Location. Requirement. Timeline. Filled in for you. Nothing typed by hand." },
  { t: 67,  text: "When your team opens ArthaLeads in the morning, the brief is already waiting. What they asked. What they want. How serious they are." },
  { t: 75,  text: "AI scores every lead, so you know exactly who to call first. And your AI copilot? Just ask. It finds who to call, and sets the follow-up for you." },
  { t: 86,  text: "Call any lead, straight from your own dashboard. In one tap. Want every new lead called within a minute? Add Vistrow Voice, our AI calling agent. It speaks your customer's language, in eighty-seven plus languages." },
  { t: 100, text: "Facebook. Google. Your website. WhatsApp ads. AI calls from Vistrow Voice. Every lead in one place, sent to the right person, for the right project." },
  { t: 111, text: "Pipeline. Projects. Site visits. Follow-ups. Your whole team, in one CRM. Send WhatsApp campaigns to your leads, straight from the CRM. And take it all with you, on the ArthaLeads mobile app." },
  { t: 125, text: "And it starts from just ₹599 per user. ArthaLeads, by Vistrow. More closings. Less chasing. Book your demo today." },
];

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// VideoObject JSON-LD. With `chapters`, adds the key moments as Clips that
// link to /product-tour?t=N (the player there seeks to N), which is how
// Google shows "key moments" under the video.
export function filmJsonLd({ chapters = false } = {}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: FILM.name,
    description: FILM.description,
    thumbnailUrl: [FILM.thumbnailUrl],
    uploadDate: FILM.uploadDate,
    duration: FILM.duration,
    contentUrl: FILM.contentUrl,
    inLanguage: "en-IN",
    publisher: {
      "@type": "Organization",
      name: "ArthaLeads",
      url: SITE,
      logo: { "@type": "ImageObject", url: `${SITE}/logo.png` },
    },
  };
  if (chapters) {
    data.url = TOUR_URL;
    data.transcript = TRANSCRIPT.map((p) => p.text).join(" ");
    data.hasPart = CHAPTERS.map((c, i) => ({
      "@type": "Clip",
      name: c.title,
      startOffset: c.t,
      endOffset: CHAPTERS[i + 1]?.t ?? FILM.durationSec,
      url: `${TOUR_URL}?t=${c.t}`,
    }));
  }
  // "<" escaped so the JSON can never close the <script> it sits in.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
