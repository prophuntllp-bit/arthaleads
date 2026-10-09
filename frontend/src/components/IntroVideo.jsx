// components/IntroVideo.jsx - the 2-minute product film, in English and Hindi.
//
// Self-hosted from /public/video. Nothing downloads until the visitor presses
// play (preload="none" + a static poster), so the section costs one ~40 KB JPEG
// on page load, not 13 MB of video.
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

export const INTRO_VIDEOS = {
  en: { label: "English", src: "/video/arthaleads-intro-en.mp4", poster: "/video/arthaleads-intro-en-poster.jpg" },
  hi: { label: "हिन्दी",   src: "/video/arthaleads-intro-hi.mp4", poster: "/video/arthaleads-intro-hi-poster.jpg" },
};

// VideoObject structured data, so the film can appear in Google video results.
export function useIntroVideoJsonLd() {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "intro-video-jsonld";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: "ArthaLeads in 2 minutes",
      description:
        "How ArthaLeads answers a buyer on WhatsApp at 1 AM, qualifies them, books the site visit and puts every answer into the lead for your sales team.",
      thumbnailUrl: ["https://www.arthaleads.com/video/arthaleads-intro-en-poster.jpg"],
      uploadDate: "2026-10-07",
      duration: "PT2M17S",
      contentUrl: "https://www.arthaleads.com/video/arthaleads-intro-en.mp4",
      inLanguage: "en-IN",
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

export default function IntroVideo({ isDark, id = "tour" }) {
  const [lang, setLang]       = useState("en");
  const [started, setStarted] = useState(false);
  const videoRef = useRef(null);
  useIntroVideoJsonLd();

  const v = INTRO_VIDEOS[lang];

  const play = () => {
    setStarted(true);
    // The <video> is already mounted (poster showing); start it in the same
    // user gesture so mobile browsers allow sound.
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
  };

  const switchLang = (next) => {
    if (next === lang) return;
    const wasPlaying = started && videoRef.current && !videoRef.current.paused;
    setLang(next);
    if (wasPlaying) requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
  };

  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.58)" : "#6b7280";
  const bg      = isDark ? "#0b0b14" : "#faf8f5";
  const rail    = isDark ? "rgba(255,255,255,0.06)" : "#efeae3";
  const segBg   = isDark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const segBdr  = isDark ? "rgba(255,255,255,0.10)" : "#e7e1d8";

  return (
    <section id={id} className="relative py-16 lg:py-24 overflow-hidden scroll-mt-20" style={{ background: bg, borderTop: `1px solid ${rail}`, borderBottom: `1px solid ${rail}` }}>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8 lg:mb-10">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b00]">Watch the tour</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black mt-3 leading-[1.1]" style={{ color: heading, textWrap: "balance" }}>
              A buyer messages at 1 AM. Here is what happens next.
            </h2>
            <p className="text-base sm:text-lg leading-relaxed mt-4" style={{ color: body }}>
              Two minutes on how ArthaLeads replies on WhatsApp, qualifies the buyer, books the
              site visit and hands your team a lead with every answer already filled in.
            </p>
          </div>

          <div role="group" aria-label="Video language" className="inline-flex self-start md:self-auto p-1 rounded-full shrink-0"
            style={{ background: segBg, border: `1px solid ${segBdr}` }}>
            {Object.entries(INTRO_VIDEOS).map(([k, item]) => {
              const on = k === lang;
              return (
                <button key={k} type="button" onClick={() => switchLang(k)} aria-pressed={on}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
                  style={{ background: on ? "#ff6b00" : "transparent", color: on ? "#fff" : body }}>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative rounded-[22px] sm:rounded-[28px] overflow-hidden"
          style={{
            aspectRatio: "16 / 9",
            background: "#111",
            boxShadow: isDark
              ? "0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px -20px rgba(0,0,0,0.7)"
              : "0 0 0 1px rgba(17,24,39,0.06), 0 40px 80px -24px rgba(120,60,10,0.28)",
          }}>
          <video
            key={v.src}
            ref={videoRef}
            src={v.src}
            poster={v.poster}
            preload="none"
            playsInline
            controls={started}
            className="absolute inset-0 w-full h-full object-cover"
            aria-label={`ArthaLeads product tour (${v.label})`}
          />
          {!started && (
            <button type="button" onClick={play}
              className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none"
              aria-label={`Play the 2-minute tour in ${v.label}`}>
              <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
              <span className="relative flex items-center gap-3 p-2 sm:pl-3 sm:pr-6 sm:py-3 rounded-full bg-white/95 shadow-2xl transition-transform duration-200 group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[#ff6b00]/50">
                <span className="w-11 h-11 rounded-full bg-[#ff6b00] flex items-center justify-center">
                  <Play className="w-5 h-5 text-white translate-x-[1px]" fill="currentColor" />
                </span>
                <span className="hidden sm:block text-left">
                  <span className="block text-sm font-bold text-gray-900">Play the tour</span>
                  <span className="block text-xs text-gray-500">2:17 · {v.label}</span>
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
