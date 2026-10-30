// components/site/YouTubePlayer.jsx - the website's films play from the
// Arthaleads YouTube channel (owner, 27 Oct 2026), so every play on the site
// counts as a YouTube view.
//
// Until the visitor presses play only our own poster loads (no YouTube
// cookies or scripts): then the privacy-enhanced player (youtube-nocookie)
// replaces it and starts. `seek` ({ t, n }; n changes on every click) jumps to
// a time: it starts the player there, or moves the running player with the
// IFrame API's postMessage commands. Plays are sent to Analytics as
// video_play. CSP: frame-src allows https://www.youtube-nocookie.com.
// `posterSet` (optional) is a srcset of WebP sizes, so phones fetch the small one.
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { track } from "../../utils/analytics";

export default function YouTubePlayer({ videoId, poster, posterSet, posterSizes = "(min-width: 1024px) 900px, 100vw", title, badge, seek = null, startAt = 0, name = "film", className = "" }) {
  const [playing, setPlaying] = useState(false);
  const [start, setStart] = useState(startAt);
  const frame = useRef(null);

  const shownId = useRef(videoId);
  const lastSeek = useRef(seek);

  const command = (func, args = []) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  const play = (t = start) => {
    if (playing) { command("seekTo", [t, true]); command("playVideo"); return; }
    setStart(t);
    setPlaying(true);
    track("video_play", { video: name, start: Math.round(t) });
  };

  // One effect for both, so a chapter pressed while the other language was
  // showing starts the new film at that chapter (no race between a reset and
  // a seek). A language switch alone goes back to the poster.
  useEffect(() => {
    const newFilm = shownId.current !== videoId;
    const newSeek = seek && seek !== lastSeek.current;
    shownId.current = videoId;
    lastSeek.current = seek;
    if (newFilm) {
      if (newSeek) { setStart(seek.t); setPlaying(true); track("video_play", { video: name, start: Math.round(seek.t) }); }
      else { setPlaying(false); setStart(startAt); }
    } else if (newSeek) play(seek.t);
  }, [videoId, seek]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!playing) setStart(startAt); }, [startAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${Math.max(0, Math.floor(start))}&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`;

  return (
    <div className={`relative overflow-hidden bg-black ${className}`} style={{ aspectRatio: "16 / 9" }}>
      {playing ? (
        <iframe key={videoId} ref={frame} className="absolute inset-0 w-full h-full" title={title} src={src}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <button type="button" onClick={() => play(start)} className="group absolute inset-0 w-full h-full" aria-label={`Play: ${title}${badge ? `, ${badge}` : ""}`}>
          <img src={poster} srcSet={posterSet} sizes={posterSet ? posterSizes : undefined} alt="" width="1280" height="720" loading="lazy" decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
          <span aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 rounded-full text-white transition-transform duration-300 group-hover:scale-105"
              style={{ background: "var(--brand-btn)", boxShadow: "0 0 0 10px rgba(255,107,0,0.22), 0 20px 50px -10px rgba(204,75,0,0.7)" }}>
              <Play className="w-7 h-7 sm:w-10 sm:h-10 ml-1" fill="currentColor" aria-hidden="true" />
            </span>
          </span>
          {badge && (
            <span className="absolute left-4 bottom-4 sm:left-6 sm:bottom-5 rounded-full px-3 py-1.5 text-[12px] sm:text-sm font-semibold text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
              {badge}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
