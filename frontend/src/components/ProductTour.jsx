// components/ProductTour.jsx - the product tour at the top of the home page.
//
// Six tabs above a browser-style frame. Each tab plays a short silent clip of
// the real CRM (demo account, fake data) and moves to the next tab when the
// clip ends. Once the visitor picks a tab themselves, auto-advance stops and
// that clip loops. The clip only downloads for the active tab; the still image
// is the poster, so nothing is blank while it loads.
//
// Files live in /public/tour as <id>.mp4, <id>.webm and <id>.webp (poster).
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, MessageCircle, UserRound, KanbanSquare, Building2, BarChart3,
} from "lucide-react";

const STEPS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "dashboard",
    title: "Your whole business on one screen",
    desc: "New leads, follow-ups due today, hot leads to call first and how each source is performing, the moment you log in." },
  { id: "inbox", icon: MessageCircle, label: "WhatsApp Inbox", path: "conversations",
    title: "Every WhatsApp chat, answered",
    desc: "The AI agent replies day and night, asks the right questions, sends photos, the brochure and location, and books the site visit. Your team steps in any time." },
  { id: "lead", icon: UserRound, label: "Lead record", path: "leads",
    title: "Every answer lands in the lead",
    desc: "Budget, configuration, location and timeline fill themselves in from the ad form and the chat. No retyping, nothing lost." },
  { id: "pipeline", icon: KanbanSquare, label: "Pipeline", path: "pipeline",
    title: "See the whole funnel at once",
    desc: "Drag leads from New to Site Visit, Negotiation and Closed Won, and spot where deals are stuck." },
  { id: "project", icon: Building2, label: "Projects", path: "projects",
    title: "Each project with its own leads and media",
    desc: "Photos, brochure, pricing and the team for every project, with its own lead list and pipeline." },
  { id: "performance", icon: BarChart3, label: "Performance", path: "performance",
    title: "Know who is closing",
    desc: "Calls, site visits and closings for every team member, across the main pipeline and every project." },
].map((s) => ({ ...s, image: `/tour/${s.id}.webp`, mp4: `/tour/${s.id}.mp4`, webm: `/tour/${s.id}.webm` }));

const CLIP_MS = 10000;      // every clip is 10 seconds
const STILL_MS = 6000;      // how long a still stays when a clip cannot play
const STALL_MS = 15000;     // safety: move on if a clip never ends (stalled network)

function useTour() {
  const [active, setActive]   = useState(0);
  const [auto, setAuto]       = useState(true);
  const [inView, setInView]   = useState(false);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed]   = useState({});     // step ids whose clip could not play
  const rootRef = useRef(null);

  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (m?.matches) { setReduced(true); setAuto(false); }
    // Data Saver / very slow connections get stills, not 2 MB clips.
    const c = navigator.connection;
    if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType || "")) setReduced(true);
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const next = () => setActive((a) => (a + 1) % STEPS.length);
  const step = STEPS[active];
  const clipPlays = !reduced && !failed[step.id];

  // Fallback timer. With a working clip the `ended` event advances sooner; this
  // only fires for stills or if a clip stalls.
  useEffect(() => {
    if (!auto || !inView) return;
    const t = setTimeout(next, clipPlays ? STALL_MS : STILL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, inView, active, clipPlays]);

  // Warm the next poster so a still never flashes blank.
  useEffect(() => { const img = new Image(); img.src = STEPS[(active + 1) % STEPS.length].image; }, [active]);

  const pick = (i) => { setActive(i); setAuto(false); };
  const markFailed = () => setFailed((f) => ({ ...f, [step.id]: true }));
  return { active, auto, inView, reduced, clipPlays, rootRef, pick, next, step, markFailed };
}

const TOUR_CSS = `
  @keyframes tourFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes tourIn { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .tour-anim { animation: none !important; } }
`;

// The browser-window frame holding the current screen.
function TourScreen({ step, isDark, playClip, loop, inView, onEnded, onFail }) {
  const videoRef = useRef(null);
  const body    = isDark ? "rgba(255,255,255,0.58)" : "#6b7280";
  const frameBg = isDark ? "#16161f" : "#f6f3ef";
  const frameBd = isDark ? "rgba(255,255,255,0.08)" : "#e9e3db";
  const urlBg   = isDark ? "rgba(255,255,255,0.06)" : "#ffffff";

  // Play only while the tour is on screen.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) v.play().catch(() => {}); else v.pause();
  }, [inView, step.id]);

  return (
    <div className="rounded-[18px] sm:rounded-[22px] overflow-hidden"
      style={{
        background: frameBg,
        border: `1px solid ${frameBd}`,
        boxShadow: isDark
          ? "0 40px 80px -24px rgba(0,0,0,0.7)"
          : "0 1px 2px rgba(17,24,39,0.04), 0 40px 80px -28px rgba(120,60,10,0.30)",
      }}>
      <div className="flex items-center gap-3 px-4 h-9 sm:h-10" style={{ borderBottom: `1px solid ${frameBd}` }}>
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex-1 flex justify-center min-w-0">
          <span className="text-[11px] sm:text-xs px-3 py-1 rounded-md truncate max-w-[70%]" style={{ background: urlBg, color: body }}>
            app.arthaleads.com/{step.path}
          </span>
        </span>
        <span className="w-[46px]" aria-hidden="true" />
      </div>
      <div className="relative" style={{ aspectRatio: "16 / 9" }}>
        {/* The still sits underneath the clip, so there is never a blank frame. */}
        <img src={step.image} alt={`${step.label}: ${step.title}`}
          className="absolute inset-0 w-full h-full object-cover object-top" decoding="async"
          {...(step.id === "dashboard" ? { fetchpriority: "high" } : {})} />
        {playClip && (
          <video key={step.id} ref={videoRef}
            className="tour-anim absolute inset-0 w-full h-full object-cover object-top"
            style={{ animation: "tourIn 350ms ease-out" }}
            poster={step.image} autoPlay muted playsInline preload="auto"
            loop={loop} onEnded={onEnded} onError={onFail} aria-label={step.title}>
            <source src={step.mp4} type="video/mp4" />
            {/* A failed <source> reports on itself, not on the <video>; only the last one means "nothing could play". */}
            <source src={step.webm} type="video/webm" onError={onFail} />
          </video>
        )}
      </div>
    </div>
  );
}

/** Tabs above a wide frame, with the caption underneath. */
export function HeroTour({ isDark }) {
  const { active, auto, inView, clipPlays, rootRef, pick, next, step, markFailed } = useTour();
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.6)" : "#6b7280";
  const chipBg  = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.85)";
  const chipBd  = isDark ? "rgba(255,255,255,0.10)" : "#ece5dc";
  const track   = isDark ? "rgba(255,255,255,0.10)" : "#f1ebe4";

  return (
    <div ref={rootRef}>
      <style>{TOUR_CSS}</style>
      <div role="tablist" aria-label="Product screens"
        className="flex sm:justify-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 mb-5 sm:mb-6"
        style={{ scrollbarWidth: "none" }}>
        {STEPS.map((s, i) => {
          const on = i === active;
          const Icon = s.icon;
          return (
            <button key={s.id} role="tab" type="button" aria-selected={on} aria-controls="hero-tour-panel"
              onClick={() => pick(i)}
              className="relative shrink-0 inline-flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full text-sm font-semibold overflow-hidden transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
              style={{
                background: on ? (isDark ? "rgba(255,107,0,0.14)" : "#fff3e8") : chipBg,
                border: `1px solid ${on ? "rgba(255,107,0,0.45)" : chipBd}`,
                color: on ? "#ff6b00" : body,
                backdropFilter: "blur(8px)",
              }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: on ? "#ff6b00" : track }}>
                <Icon className="w-3.5 h-3.5" style={{ color: on ? "#fff" : body }} />
              </span>
              {s.label}
              {on && auto && inView && (
                <span className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full overflow-hidden" style={{ background: track }}>
                  <span key={active} className="tour-anim block h-full origin-left bg-[#ff6b00]"
                    style={{ animation: `tourFill ${clipPlays ? CLIP_MS : STILL_MS}ms linear forwards` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id="hero-tour-panel" role="tabpanel" aria-label={step.label}>
        <TourScreen step={step} isDark={isDark} playClip={clipPlays} loop={!auto} inView={inView}
          onEnded={() => { if (auto) next(); }} onFail={markFailed} />
      </div>

      <p className="mt-5 text-center text-[15px] leading-relaxed max-w-2xl mx-auto min-h-[4.8em] sm:min-h-[3.2em]" style={{ color: body }}>
        <span className="font-semibold" style={{ color: heading }}>{step.title}.</span>{" "}{step.desc}
      </p>
    </div>
  );
}
