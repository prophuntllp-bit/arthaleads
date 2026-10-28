// components/IntroVideo.jsx - the 2-minute product film ("A buyer messages at
// 1 AM"), English and Hindi, for the /product-tour watch page.
//
// Plays from the Arthaleads YouTube channel through components/site/
// YouTubePlayer.jsx (owner, 27 Oct 2026: plays on the site should count as
// YouTube views). Our own poster shows until the visitor presses play.
// `chapters`: the language toggle and "Watch on YouTube" above the player and
// the VideoObject structured data with its key moments (in the markup, so the
// prerendered HTML carries it). `seek` ({ t, n }, n bumps on every click)
// jumps to a chapter; ?t=N on arrival starts the film there when played.
// The home page has its own section (components/site/FilmSection.jsx), which
// shares INTRO_VIDEOS.
import { useEffect, useState } from "react";
import { Youtube } from "lucide-react";
import { filmJsonLd } from "../data/introFilm";
import { YOUTUBE_FILM } from "../utils/crmLinks";
import YouTubePlayer from "./site/YouTubePlayer";

export const INTRO_VIDEOS = {
  en: { label: "English", youtubeId: "htXLDOPHzac", length: "2:18", poster: "/video/arthaleads-intro-en-poster-1280.webp",
        posterSet: "/video/arthaleads-intro-en-poster-640.webp 640w, /video/arthaleads-intro-en-poster-1280.webp 1280w" },
  hi: { label: "हिन्दी",   youtubeId: "bAkgsfgfPKw", length: "2:28", poster: "/video/arthaleads-intro-hi-poster-1280.webp",
        posterSet: "/video/arthaleads-intro-hi-poster-640.webp 640w, /video/arthaleads-intro-hi-poster-1280.webp 1280w" },
};

export default function IntroVideo({ id = "tour", chapters = false, seek = null }) {
  const [lang, setLang] = useState("en");
  const [startAt, setStartAt] = useState(0);
  const [jump, setJump] = useState(null);
  const v = INTRO_VIDEOS[lang];

  // ?t=N from a shared chapter link: start there when played.
  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (t > 0) setStartAt(t);
  }, []);

  // Chapters are timed to the English film.
  useEffect(() => {
    if (!seek) return;
    if (lang !== "en") setLang("en");
    setJump({ ...seek });
  }, [seek]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id={id} className="relative scroll-mt-20">
      {chapters && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: filmJsonLd({ chapters: true }) }} />}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
        <a href={YOUTUBE_FILM[lang]} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold site-ink hover:underline underline-offset-4">
          <Youtube className="w-[18px] h-[18px]" style={{ color: "#FF0000" }} strokeWidth={2} aria-hidden="true" /> Watch on YouTube
        </a>
        <div role="group" aria-label="Video language" className="site-card inline-flex p-1 !rounded-full">
          {Object.entries(INTRO_VIDEOS).map(([k, item]) => (
            <button key={k} type="button" onClick={() => setLang(k)} aria-pressed={k === lang}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
              style={k === lang ? { background: "var(--brand-btn)", color: "#fff" } : { color: "var(--site-text)" }}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-[22px] sm:rounded-[28px] p-1.5 sm:p-2" style={{ background: "var(--site-card)", border: "1px solid var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
        <YouTubePlayer videoId={v.youtubeId} poster={v.poster} posterSet={v.posterSet} name={`tour-${lang}`} startAt={startAt} seek={jump}
          title={`Arthaleads product tour (${v.label})`} badge={`${v.length} · ${v.label}`}
          className="rounded-[17px] sm:rounded-[23px]" />
      </div>
    </section>
  );
}
