// components/site/FilmSection.jsx - the 2-minute product film on the home page.
//
// Poster first: nothing but the ~40 KB poster loads until the visitor presses
// play, then the film plays from the Arthaleads YouTube channel (YouTubePlayer),
// so every play counts as a YouTube view. English/Hindi toggle and chapter
// chips (times from data/introFilm). No VideoObject structured data here on
// purpose: Google indexes the film on its watch page, /product-tour.
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Youtube } from "lucide-react";
import { Section, Container, SectionHeader } from "./Site";
import { INTRO_VIDEOS } from "../IntroVideo";
import YouTubePlayer from "./YouTubePlayer";
import { YOUTUBE_FILM } from "../../utils/crmLinks";

const CHIPS = [
  { t: 0, label: "The 1 AM message" },
  { t: 29, label: "AI replies and books the visit" },
  { t: 58, label: "The lead fills itself in" },
  { t: 75, label: "Lead scores and copilot" },
  { t: 100, label: "Every lead source" },
];

export default function FilmSection() {
  const [lang, setLang] = useState("en");
  const [jump, setJump] = useState(null);   // { t, n }: a chapter chip was pressed
  const v = INTRO_VIDEOS[lang];

  const play = (t = 0) => setJump({ t, n: Date.now() });
  const switchLang = (k) => { if (k !== lang) setLang(k); };

  return (
    <Section id="tour" tone="tint">
      <Container>
        <SectionHeader title={<>A buyer messages at 1 AM.<br className="hidden sm:block" /> Here is what happens next.</>}
          lede="Two minutes on how Arthaleads replies on WhatsApp, qualifies the buyer, books the site visit and hands your team a lead with every answer filled in."
          action={
            <div role="group" aria-label="Film language" className="site-card inline-flex p-1 !rounded-full">
              {Object.entries(INTRO_VIDEOS).map(([k, item]) => (
                <button key={k} type="button" onClick={() => switchLang(k)} aria-pressed={k === lang}
                  className="min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                  style={k === lang ? { background: "var(--brand-btn)", color: "#fff" } : { color: "var(--site-text)" }}>
                  {item.label}
                </button>
              ))}
            </div>
          } />

        <div className="relative rounded-[22px] sm:rounded-[30px] p-1.5 sm:p-2" style={{ background: "var(--site-card)", border: "1px solid var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
          <YouTubePlayer videoId={v.youtubeId} poster={v.poster} posterSet={v.posterSet} name={`home-${lang}`} seek={jump}
            title={`Arthaleads product tour (${v.label})`} badge={`${v.length} · ${v.label}`}
            className="rounded-[17px] sm:rounded-[23px]" />
        </div>

        <div className="mt-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <ul className="flex flex-wrap gap-2" aria-label="Jump to a part of the film">
            {CHIPS.map(({ t, label }) => (
              <li key={t}>
                <button type="button" onClick={() => { if (lang !== "en") setLang("en"); play(t); }}
                  className="site-chip min-h-[44px] rounded-full px-3.5 py-2 text-[13px] font-medium hover:text-[color:var(--site-ink)] transition-colors">
                  <span className="font-semibold site-ink mr-1.5">{Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}</span>{label}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm shrink-0">
            <Link to="/product-tour" className="site-link min-h-[44px]">Chapters and transcript <ArrowRight className="w-4 h-4" /></Link>
            <a href={YOUTUBE_FILM[lang]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-[44px] font-semibold site-ink hover:underline underline-offset-4">
              <Youtube className="w-[18px] h-[18px]" style={{ color: "#FF0000" }} aria-hidden="true" /> Watch on YouTube
            </a>
          </div>
        </div>
      </Container>
    </Section>
  );
}
