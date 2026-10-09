// components/IntroVideo.jsx - the 2-minute product film, in English and Hindi.
//
// Self-hosted from /public/video. It starts by itself, with sound, when more
// than half of it is on screen, and pauses when it scrolls away. Browsers only
// allow sound if the visitor has already clicked, tapped or pressed a key on the
// site (arriving from another page of ours or the language toggle counts); when
// they refuse, it starts muted and the sound comes on at the visitor's first
// click, tap or key press anywhere on the page, with a "Turn on sound" button
// on the video as the fallback. Nothing downloads until it nears the screen
// (preload="metadata" + a ~40 KB poster). Visitors on Data Saver or with
// reduced motion get a play button instead of autoplay.
import { useEffect, useRef, useState } from "react";
import { Play, Volume2 } from "lucide-react";

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
  const [lang, setLang]         = useState("en");
  const [started, setStarted]   = useState(false);   // has played at least once: show the player controls
  const [blocked, setBlocked]   = useState(false);   // autoplay refused or disabled: show the big play button
  const [muted, setMuted]       = useState(true);
  const videoRef   = useRef(null);
  const sectionRef = useRef(null);
  const visible    = useRef(false);
  const userPaused = useRef(false);   // the visitor paused it themselves: do not restart on scroll
  const ourPause   = useRef(false);   // a pause we caused by scrolling away
  useIntroVideoJsonLd();

  const v = INTRO_VIDEOS[lang];

  const tryPlay = () => {
    const el = videoRef.current;
    if (!el || userPaused.current) return;
    // Try with sound first; if the browser refuses, fall back to a muted start.
    el.muted = false;
    el.play().then(() => { setMuted(false); setStarted(true); setBlocked(false); }).catch(() => {
      el.muted = true;
      el.play().then(() => { setMuted(true); setStarted(true); setBlocked(false); }).catch(() => setBlocked(true));
    });
  };

  // Start when more than half is visible, pause when it leaves.
  useEffect(() => {
    const save = navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || "");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (save || reduce) { setBlocked(true); return; }
    const el = sectionRef.current;
    if (!el || !("IntersectionObserver" in window)) { setBlocked(true); return; }
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      const vid = videoRef.current;
      if (!vid) return;
      if (e.isIntersecting) tryPlay();
      else if (!vid.paused) { ourPause.current = true; vid.pause(); }
    }, { threshold: 0.5 });
    io.observe(el);
    // Coming back to this browser tab: the browser paused the clip on its own, so carry on.
    const onVis = () => { if (!document.hidden && visible.current) tryPlay(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Muted start: the first real gesture anywhere on the page grants sound.
  useEffect(() => {
    if (!started || !muted) return;
    const on = () => {
      const el = videoRef.current;
      if (el && !el.paused) { el.muted = false; setMuted(false); }
    };
    const evs = ["pointerdown", "keydown", "touchend"];
    evs.forEach((e) => window.addEventListener(e, on, { once: true, passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, on));
  }, [started, muted, lang]);

  const manualPlay = () => {
    userPaused.current = false;
    const el = videoRef.current;
    if (!el) return;
    el.muted = false; setMuted(false);          // a click is the permission to use sound
    el.play().then(() => { setStarted(true); setBlocked(false); }).catch(() => {});
  };

  const soundOn = () => { setMuted(false); if (videoRef.current) videoRef.current.muted = false; };

  const switchLang = (next) => { if (next !== lang) setLang(next); };

  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.58)" : "#6b7280";
  const bg      = isDark ? "#0b0b14" : "#faf8f5";
  const rail    = isDark ? "rgba(255,255,255,0.06)" : "#efeae3";
  const segBg   = isDark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const segBdr  = isDark ? "rgba(255,255,255,0.10)" : "#e7e1d8";

  return (
    <section id={id} ref={sectionRef} className="relative py-16 lg:py-24 overflow-hidden scroll-mt-20" style={{ background: bg, borderTop: `1px solid ${rail}`, borderBottom: `1px solid ${rail}` }}>
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
            background: isDark ? "#0d0c11" : "#f0ece6",   // matches the film's own edge colour, so no dark hairline can show
            boxShadow: isDark
              ? "0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px -20px rgba(0,0,0,0.7)"
              : "0 0 0 1px rgba(17,24,39,0.06), 0 40px 80px -24px rgba(120,60,10,0.28)",
          }}>
          <video
            key={v.src}
            ref={videoRef}
            src={v.src}
            poster={v.poster}
            preload="metadata"
            playsInline
            controls={started}
            className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scale(1.01)" }}
            aria-label={`ArthaLeads product tour (${v.label})`}
            onLoadedData={() => { if (visible.current) tryPlay(); }}
            onPause={() => { if (ourPause.current) ourPause.current = false; else if (started && !document.hidden) userPaused.current = true; }}
            onPlay={() => { userPaused.current = false; }}
          />

          {/* Only shown when the browser made the film start silent. */}
          {started && muted && !blocked && (
            <button type="button" onClick={soundOn}
              className="absolute left-4 top-4 sm:left-6 sm:top-6 flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-black/70 hover:bg-black/85 text-white text-sm font-semibold backdrop-blur transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <Volume2 className="w-4 h-4" /> Turn on sound
            </button>
          )}

          {/* Only when autoplay is not allowed or the visitor chose reduced motion / Data Saver. */}
          {blocked && !started && (
            <button type="button" onClick={manualPlay}
              className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none"
              aria-label={`Play the 2-minute tour in ${v.label}`}>
              <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
              <span className="relative flex items-center gap-3 pl-3 pr-4 sm:pr-6 py-3 rounded-full bg-white/95 shadow-2xl transition-transform duration-200 group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[#ff6b00]/50">
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
