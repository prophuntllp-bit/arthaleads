// pages/ProductTour.jsx - /product-tour, the watch page for the 2-minute film.
//
// Google indexes a video only on a page where it is the main content
// ("Video isn't on a watch page" in Search Console when the film sat on the
// home page alone). So the player comes straight after the heading, the copy
// around it stays short, and the film's VideoObject structured data lives here
// only. The home page keeps the same film as one of its sections.
import { ArrowRight } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import IntroVideo from "../components/IntroVideo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";

// The film's four parts, in order (from the film's own chapter titles).
const PARTS = [
  { title: "Your AI replies first",
    body: "A buyer messages at 1 AM. The WhatsApp AI agent answers at once, asks about budget and timeline, sends the brochure and books the site visit." },
  { title: "The lead fills itself in",
    body: "The buyer's answers move into the lead record by themselves, and the new lead appears in your list tagged with the ad it came from." },
  { title: "Your team calls ready",
    body: "In the morning the dashboard shows the hottest leads, the AI score and the next step, and the assistant sets a follow-up from one typed line." },
  { title: "Every lead, one place",
    body: "Facebook, Google, your website and WhatsApp all feed the same list, so nothing waits on someone's phone." },
];

export default function ProductTour() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "ArthaLeads Product Tour: Watch the 2-Minute Film",
    description: "Watch how ArthaLeads replies to a buyer on WhatsApp at 1 AM, books the site visit and hands your sales team a ready lead. In English and Hindi.",
    canonical: "https://www.arthaleads.com/product-tour",
  });

  const bg = isDark ? "#0d0d1a" : "#faf8f5";
  const text = isDark ? "#ffffff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e7e1d8";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <PublicNav />

      <main className="pt-28 pb-16 lg:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] max-w-3xl" style={{ color: text, textWrap: "balance" }}>
            ArthaLeads in 2 minutes
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mt-4 mb-8 max-w-2xl" style={{ color: soft }}>
            A buyer messages at 1 AM. Watch ArthaLeads reply on WhatsApp, qualify them, book the site
            visit and hand your team a lead with every answer already filled in.
          </p>

          <IntroVideo isDark={isDark} id="film" jsonLd bare />

          <h2 className="text-2xl sm:text-3xl font-black mt-14 mb-6" style={{ color: text }}>What the film shows</h2>
          <ol className="grid sm:grid-cols-2 gap-4">
            {PARTS.map((p, i) => (
              <li key={p.title} className="rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: cardBg, borderColor: cardBorder }}>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-text)]">Part {i + 1}</span>
                <h3 className="text-lg font-bold mt-1.5 mb-1.5" style={{ color: text }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: soft }}>{p.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4">
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/45 transition-shadow duration-200"
              style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-sm" style={{ color: soft }}>No credit card needed. Every Growth feature included.</p>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
