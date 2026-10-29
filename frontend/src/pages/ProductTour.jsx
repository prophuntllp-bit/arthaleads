// pages/ProductTour.jsx - /product-tour, the watch page for the 2-minute film,
// on the shared marketing theme (components/site/*).
//
// Google only puts a video in video results when it is the main thing on its
// page ("Video isn't on a watch page" in Search Console while the film lived on
// the home page alone). This page gives the film a home of its own: the player
// straight under the heading, clickable chapters (also sent to Google as key
// moments, see data/introFilm.js) and the full transcript, which is the text
// Google reads to understand what the video covers.
//
// History: first built 12 Oct 2026 (f8793a8) and removed the same evening at the
// owner's request (751dce3); restored 16 Oct 2026 with the owner's approval,
// kept out of the nav and footer, without the eyebrow pill.
import { useState } from "react";
import { Play } from "lucide-react";
import IntroVideo from "../components/IntroVideo";
import { SitePage, Section, Container, SectionHeader, Card } from "../components/site/Site";
import { ClosingCta } from "../components/site/Blocks";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { CHAPTERS, TRANSCRIPT, fmtTime } from "../data/introFilm";

const stamp = "font-mono text-xs font-semibold tabular-nums px-2 py-1 rounded-md shrink-0";
const stampStyle = { background: "rgba(255,107,0,0.12)", color: "var(--site-brand-ink)" };

export default function ProductTour() {
  const { isDark } = usePublicTheme();
  const [seek, setSeek] = useState(null);
  const jump = (t) => {
    setSeek({ t, n: Date.now() });
    document.getElementById("film")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useSEO({
    title: "Arthaleads Product Tour: Real Estate CRM in 2 Minutes (Video)",
    description: "Watch how Arthaleads replies to property buyers on WhatsApp at 1 AM, books site visits, fills in every lead, scores it and tells your team who to call first.",
    canonical: "https://www.arthaleads.com/product-tour",
  });

  return (
    <SitePage>
      {/* Title + film */}
      <Section tone="white" className="!pt-[6.5rem] sm:!pt-32 overflow-x-clip">
        <div aria-hidden="true" className="hero-warm" style={{ opacity: 0.55 }} />
        <Container className="relative">
          <div className="max-w-4xl">
            <h1 className="font-display site-ink font-extrabold tracking-[-0.03em]">
              <span className="site-eyebrow block mb-4 sm:mb-5">Product tour</span>{" "}
              <span className="block text-[32px] leading-[1.1] sm:text-[44px] lg:text-[50px]" style={{ textWrap: "balance" }}>
                Arthaleads in 2 minutes: <span className="site-dim">the real estate CRM that answers buyers at 1 AM</span>
              </span>
            </h1>
            <p className="mt-5 mb-8 text-base sm:text-[17px] leading-relaxed max-w-2xl">
              See the WhatsApp AI agent qualify a buyer and book the site visit, every answer land in the
              lead, and your team start the morning knowing exactly who to call. In English and Hindi.
            </p>
          </div>
          <IntroVideo isDark={isDark} id="film" chapters seek={seek} />
        </Container>
      </Section>

      {/* Chapters */}
      <Section tone="tint">
        <Container narrow>
          <SectionHeader eyebrow="Chapters" title="Jump to the part you care about" />
          <ol className="grid sm:grid-cols-2 gap-3">
            {CHAPTERS.map((c) => (
              <li key={c.t}>
                <Card as="button" type="button" glow onClick={() => jump(c.t)}
                  className="group w-full flex items-center gap-3 text-left px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]">
                  <span className={stamp} style={stampStyle}>{fmtTime(c.t)}</span>
                  <span className="text-[15px] font-semibold site-ink flex-1">{c.title}</span>
                  <Play className="w-4 h-4 site-muted transition-colors group-hover:text-[color:var(--site-brand)]" aria-hidden="true" />
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Transcript */}
      <Section tone="white">
        <Container narrow>
          <SectionHeader eyebrow="Transcript" title="Everything the film says" />
          <Card raised className="p-6 sm:p-8 space-y-5">
            {TRANSCRIPT.map((p) => (
              <div key={p.t} className="flex gap-4">
                <button type="button" onClick={() => jump(p.t)} aria-label={`Play from ${fmtTime(p.t)}`}
                  className={`${stamp} h-fit hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]`} style={stampStyle}>
                  {fmtTime(p.t)}
                </button>
                <p className="text-base leading-relaxed site-ink">{p.text}</p>
              </div>
            ))}
          </Card>
        </Container>
      </Section>

      <ClosingCta title="See it with" dim="your own leads."
        body="Book a 30-minute demo on your projects, or start the 14-day free trial yourself." tone="tint" />
    </SitePage>
  );
}
