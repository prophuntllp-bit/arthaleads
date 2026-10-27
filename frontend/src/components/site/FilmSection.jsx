// components/site/FilmSection.jsx - the 2-minute product film on the home page.
//
// Poster first, video only on tap: nothing but the ~40 KB poster loads until
// the visitor presses play, so the home page stays light on phones. A tap is
// a gesture, so the film plays with sound. English/Hindi toggle and chapter
// chips (times from data/introFilm). No VideoObject structured data here on
// purpose: Google indexes the film on its watch page, /product-tour.
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, ArrowRight, Youtube } from "lucide-react";
import { Section, Container, SectionHeader } from "./Site";
import { INTRO_VIDEOS } from "../IntroVideo";
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
  const [playing, setPlaying] = useState(false);   // the <video> is mounted once play is pressed
  const videoRef = useRef(null);
  const pending = useRef(0);
  const v = INTRO_VIDEOS[lang];

  const play = (t = 0) => {
    pending.current = t;
    if (!playing) { setPlaying(true); return; }   // onLoadedMetadata picks up `pending`
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = t;
    el.play().catch(() => {});
  };
  const switchLang = (k) => {
    if (k === lang) return;
    pending.current = 0;
    setLang(k);
  };

  return (
    <Section id="tour" tone="tint">
      <Container>
        <SectionHeader eyebrow="Watch the tour" title={<>A buyer messages at 1 AM.<br className="hidden sm:block" /> <span className="site-dim">Here is what happens next.</span></>}
          lede="Two minutes on how Arthaleads replies on WhatsApp, qualifies the buyer, books the site visit and hands your team a lead with every answer filled in."
          action={
            <div role="group" aria-label="Film language" className="site-card inline-flex p-1 !rounded-full">
              {Object.entries(INTRO_VIDEOS).map(([k, item]) => (
                <button key={k} type="button" onClick={() => switchLang(k)} aria-pressed={k === lang}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                  style={k === lang ? { background: "var(--brand-btn)", color: "#fff" } : { color: "var(--site-text)" }}>
                  {item.label}
                </button>
              ))}
            </div>
          } />

        <div className="relative rounded-[22px] sm:rounded-[30px] p-1.5 sm:p-2" style={{ background: "var(--site-card)", border: "1px solid var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
          <div className="relative overflow-hidden rounded-[17px] sm:rounded-[23px] bg-black" style={{ aspectRatio: "16 / 9" }}>
            {playing ? (
              <video key={v.src} ref={videoRef} src={v.src} poster={v.poster} controls playsInline autoPlay preload="auto"
                className="absolute inset-0 w-full h-full object-cover" aria-label={`Arthaleads product tour (${v.label})`}
                onLoadedMetadata={(e) => { if (pending.current) e.currentTarget.currentTime = pending.current; e.currentTarget.play().catch(() => {}); }} />
            ) : (
              <button type="button" onClick={() => play(0)} className="group absolute inset-0 w-full h-full" aria-label={`Play the 2-minute product tour (${v.label})`}>
                <img src={v.poster} alt="" width="1280" height="720" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                <span aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="relative flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 rounded-full text-white transition-transform duration-300 group-hover:scale-105"
                    style={{ background: "var(--brand-btn)", boxShadow: "0 0 0 10px rgba(255,107,0,0.22), 0 20px 50px -10px rgba(204,75,0,0.7)" }}>
                    <Play className="w-7 h-7 sm:w-10 sm:h-10 ml-1" fill="currentColor" aria-hidden="true" />
                  </span>
                </span>
                <span className="absolute left-4 bottom-4 sm:left-6 sm:bottom-5 flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] sm:text-sm font-semibold text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
                  2:17 · {v.label}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <ul className="flex flex-wrap gap-2" aria-label="Jump to a part of the film">
            {CHIPS.map(({ t, label }) => (
              <li key={t}>
                <button type="button" onClick={() => { if (lang !== "en") setLang("en"); play(t); }}
                  className="site-chip rounded-full px-3.5 py-2 text-[13px] font-medium hover:text-[color:var(--site-ink)] transition-colors">
                  <span className="font-semibold site-ink mr-1.5">{Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}</span>{label}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm shrink-0">
            <Link to="/product-tour" className="site-link">Chapters and transcript <ArrowRight className="w-4 h-4" /></Link>
            <a href={YOUTUBE_FILM[lang]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold site-ink hover:underline underline-offset-4">
              <Youtube className="w-[18px] h-[18px]" style={{ color: "#FF0000" }} aria-hidden="true" /> Watch on YouTube
            </a>
          </div>
        </div>
      </Container>
    </Section>
  );
}
