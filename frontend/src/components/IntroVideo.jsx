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
import { Link } from "react-router-dom";
import { Play, Volume2, RotateCcw, ArrowRight } from "lucide-react";
import { filmJsonLd, fmtTime } from "../data/introFilm";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS, waLink, WA_MESSAGES } from "../utils/crmLinks";
import WhatsAppLogo from "./WhatsAppLogo";
import { SITE_MEDIA } from "../data/siteMedia";

export const INTRO_VIDEOS = {
  en: { label: "English", src: `${SITE_MEDIA}/video/arthaleads-intro-en.mp4`, poster: "/video/arthaleads-intro-en-poster.jpg" },
  hi: { label: "हिन्दी",   src: `${SITE_MEDIA}/video/arthaleads-intro-hi.mp4`, poster: "/video/arthaleads-intro-hi-poster.jpg" },
};

// `chapters` (the /product-tour watch page only): player and language toggle
// without the home-page heading, the VideoObject structured data with its key
// moments, the film starting at ?t=N, and `seek` ({ t, n }, n bumps on every
// click) jumping to a chapter. The home page sends no structured data: Google
// indexes a video only where it is the main content of the page.
// Home page only: short chapter chips under the player (times from data/introFilm CHAPTERS).
const HOME_CHAPTERS = [
  { t: 0,   label: "The 1 AM message" },
  { t: 29,  label: "AI replies and books the visit" },
  { t: 58,  label: "The lead fills itself in" },
  { t: 86,  label: "AI calling" },
  { t: 125, label: "Pricing and demo" },
];

export default function IntroVideo({ isDark, id = "tour", chapters = false, seek = null }) {
  const bare = chapters;
  const [lang, setLang]         = useState("en");
  const [started, setStarted]   = useState(false);   // has played at least once: show the player controls
  const [blocked, setBlocked]   = useState(false);   // autoplay refused or disabled: show the big play button
  const [muted, setMuted]       = useState(true);
  const [ended, setEnded]       = useState(false);   // home: show the next-step screen over the last frame
  const videoRef   = useRef(null);
  const sectionRef = useRef(null);
  const visible    = useRef(false);
  const userPaused = useRef(false);   // the visitor paused it themselves: do not restart on scroll
  const ourPause   = useRef(false);   // a pause we caused by scrolling away
  const pendingSeek = useRef(null);   // a chapter clicked while the Hindi film was showing

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

  // Jump to a time: from ?t=N on arrival, or a chapter click (a click is a
  // gesture, so sound is allowed). English only: the chapters are timed to it.
  const seekTo = (t, withSound) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(t)) return;
    if (lang !== "en") { pendingSeek.current = { t, withSound }; setLang("en"); return; }
    const go = () => {
      el.currentTime = Math.max(0, t);
      userPaused.current = false;
      if (withSound) { el.muted = false; setMuted(false); }
      el.play().then(() => { setStarted(true); setBlocked(false); }).catch(() => {});
    };
    if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
  };
  useEffect(() => {
    if (!chapters) return;
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (t > 0) seekTo(t, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters]);
  useEffect(() => {
    if (seek) { sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); seekTo(seek.t, true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seek]);

  const soundOn = () => { setMuted(false); if (videoRef.current) videoRef.current.muted = false; };

  const switchLang = (next) => { if (next !== lang) setLang(next); };

  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.58)" : "#6b7280";
  const bg      = isDark ? "#0b0b14" : "#faf8f5";
  const rail    = isDark ? "rgba(255,255,255,0.06)" : "#efeae3";
  const segBg   = isDark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const segBdr  = isDark ? "rgba(255,255,255,0.10)" : "#e7e1d8";

  return (
    <section id={id} ref={sectionRef}
      className={bare ? "relative scroll-mt-20" : "relative py-16 lg:py-24 overflow-hidden scroll-mt-20"}
      style={bare ? undefined : { background: bg, borderTop: `1px solid ${rail}`, borderBottom: `1px solid ${rail}` }}>
      {/* In the markup, not an effect, so the prerendered HTML carries it. */}
      {chapters && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: filmJsonLd({ chapters: true }) }} />}
      <div className={bare ? "relative" : "relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"}>
        <div className={`flex flex-col md:flex-row md:items-end gap-6 ${bare ? "md:justify-end mb-4" : "md:justify-between mb-8 lg:mb-10"}`}>
          {!bare && (
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-text)]">Watch the tour</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black mt-3 leading-[1.1]" style={{ color: heading, textWrap: "balance" }}>
              A buyer messages at 1 AM. Here is what happens next.
            </h2>
            <p className="text-base sm:text-lg leading-relaxed mt-4" style={{ color: body }}>
              Two minutes on how Arthaleads replies on WhatsApp, qualifies the buyer, books the
              site visit and hands your team a lead with every answer already filled in.
            </p>
            <Link to="/product-tour" className="inline-block mt-3 text-sm font-semibold underline underline-offset-4 text-[color:var(--brand-text)]">
              Watch with chapters and a transcript
            </Link>
          </div>
          )}

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          {!bare && <span className="text-sm font-semibold" style={{ color: heading }}>Watch in</span>}
          <div role="group" aria-label="Video language" className="inline-flex p-1 rounded-full"
            style={{ background: segBg, border: `1px solid ${segBdr}` }}>
            {Object.entries(INTRO_VIDEOS).map(([k, item]) => {
              const on = k === lang;
              return (
                <button key={k} type="button" onClick={() => switchLang(k)} aria-pressed={on}
                  className={`${bare ? "px-4 py-1.5 text-sm" : "px-5 py-2.5 text-[15px]"} rounded-full font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]`}
                  style={{ background: on ? "var(--brand-btn)" : "transparent", color: on ? "#fff" : body }}>
                  {item.label}{!bare && k === "hi" ? " (Hindi)" : ""}
                </button>
              );
            })}
          </div>
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
            aria-label={`Arthaleads product tour (${v.label})`}
            onLoadedData={() => {
              const p = pendingSeek.current;
              if (p) { pendingSeek.current = null; seekTo(p.t, p.withSound); }
              else if (visible.current) tryPlay();
            }}
            onPause={() => { if (ourPause.current) ourPause.current = false; else if (started && !document.hidden) userPaused.current = true; }}
            onPlay={() => { userPaused.current = false; setEnded(false); }}
            onEnded={() => { if (!bare) setEnded(true); }}
          />

          {/* Home: the people who watched to the end are the warmest visitors on the page. */}
          {ended && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black/70 backdrop-blur-sm">
              <p className="text-white text-xl sm:text-2xl font-black" style={{ textWrap: "balance" }}>Try it on your own leads</p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                  className="flex items-center gap-2 bg-[color:var(--brand-btn)] text-white font-bold px-6 py-3 rounded-2xl shadow-xl">
                  Start free trial <ArrowRight className="w-4 h-4" />
                </a>
                <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-3 rounded-2xl">
                  <WhatsAppLogo className="w-4 h-4" /> Book a demo
                </a>
              </div>
              <button type="button" onClick={() => { setEnded(false); const el = videoRef.current; if (el) { el.currentTime = 0; userPaused.current = false; el.play().catch(() => {}); } }}
                className="flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white">
                <RotateCcw className="w-4 h-4" /> Watch again
              </button>
            </div>
          )}

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

        {!bare && (
          <>
            <div className="mt-5 flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-1" style={{ scrollbarWidth: "none" }}>
              {HOME_CHAPTERS.map((c) => (
                <button key={c.t} type="button" onClick={() => { setEnded(false); seekTo(c.t, true); }}
                  className="shrink-0 flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1.5 text-sm font-medium transition-colors hover:border-[#ff6b00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
                  style={{ background: segBg, border: `1px solid ${segBdr}`, color: heading }}>
                  <span className="text-[11px] font-bold tabular-nums rounded-full px-2 py-0.5" style={{ background: "rgba(255,107,0,0.12)", color: "var(--brand-text)" }}>{fmtTime(c.t)}</span>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                className="inline-flex items-center justify-center gap-2 bg-[color:var(--brand-btn)] hover:bg-[color:var(--brand-btn-hover)] text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-orange-500/25">
                Start free trial <ArrowRight className="w-4 h-4" />
              </a>
              <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 font-semibold" style={{ color: isDark ? "#4ade80" : "#15803d" }}>
                <WhatsAppLogo className="w-4 h-4" /> Or book a demo on WhatsApp
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
