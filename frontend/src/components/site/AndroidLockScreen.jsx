// components/site/AndroidLockScreen.jsx - a realistic Android phone on its
// lock screen, with Arthaleads notifications arriving the way a real phone
// shows them: under the clock, newest on top, older ones sliding down.
// Drawn in code (an illustration, not a screenshot); used on /download-app.
//
// The prerendered HTML shows all three notifications. Once the phone is on
// screen they clear and arrive again one at a time, on a loop; reduced motion
// keeps the full stack still.
import { useEffect, useRef, useState } from "react";
import { Bell, Phone, MapPin, Fingerprint, Camera } from "lucide-react";

const ALERTS = [
  { Icon: MapPin, tint: "#2563eb", title: "Clocked in on site", body: "Aurum Heights · selfie" },
  { Icon: Phone, tint: "#16a34a", title: "Call logged · 4 min", body: "Raj Patil · recording saved" },
  { Icon: Bell, tint: "#ea580c", title: "New lead · Ananya Iyer", body: "2 BHK · Facebook ad" },
];
const CARD_H = 66;     // px, one notification
const GAP = 8;
const STEP_MS = 1500;  // between arrivals
const HOLD_MS = 4200;  // full stack on screen before it clears
const CLEAR_MS = 900;

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-white/90">
      <span>Jio 5G</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><rect x="0" y="7" width="2.6" height="4" rx=".6" /><rect x="4" y="5" width="2.6" height="6" rx=".6" /><rect x="8" y="2.6" width="2.6" height="8.4" rx=".6" /><rect x="12" y="0" width="2.6" height="11" rx=".6" /></svg>
        <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor"><path d="M7 11 0 3.4a10 10 0 0 1 14 0z" /></svg>
        <span className="flex items-center gap-0.5">
          <span className="relative w-[20px] h-[10px] rounded-[3px] border border-white/80 p-[1.5px]"><span className="block h-full w-[72%] rounded-[1.5px] bg-white" /></span>
          <span className="text-[10px]">72</span>
        </span>
      </span>
    </div>
  );
}

export default function AndroidLockScreen() {
  const root = useRef(null);
  const [n, setN] = useState(ALERTS.length);   // how many have arrived

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    let timers = [];
    let running = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const cycle = () => {
      setN(0);
      ALERTS.forEach((_, i) => timers.push(setTimeout(() => setN(i + 1), CLEAR_MS + STEP_MS * i)));
      timers.push(setTimeout(cycle, CLEAR_MS + STEP_MS * (ALERTS.length - 1) + HOLD_MS));
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; cycle(); }
      else if (!e.isIntersecting && running) { running = false; clear(); setN(ALERTS.length); }
    }, { threshold: 0.35 });
    if (root.current) io.observe(root.current);
    return () => { io.disconnect(); clear(); };
  }, []);

  return (
    <div ref={root} className="relative mx-auto w-[236px] sm:w-[250px]" role="img"
      aria-label="An Android phone lock screen showing Arthaleads notifications: a new lead, a logged call and a site attendance check-in">
      {/* Side keys: volume and power on the right, like most Android phones */}
      <span aria-hidden="true" className="absolute -right-[3px] top-[100px] w-[4px] h-[46px] rounded-r-md" style={{ background: "linear-gradient(270deg,#7b7e85,#2f3136)" }} />
      <span aria-hidden="true" className="absolute -right-[3px] top-[158px] w-[4px] h-[28px] rounded-r-md" style={{ background: "linear-gradient(270deg,#7b7e85,#2f3136)" }} />

      {/* Aluminium frame */}
      <div className="relative rounded-[2.6rem] p-[3px]"
        style={{ background: "linear-gradient(150deg,#b4b7bd 0%,#4a4d54 20%,#1d1e22 50%,#55585f 80%,#b9bcc2 100%)", boxShadow: "0 50px 90px -30px rgba(0,0,0,0.6), 0 30px 70px -30px rgba(194,65,12,0.35)" }}>
        <div className="rounded-[2.45rem] p-[6px] bg-black">
          {/* Screen */}
          <div className="relative overflow-hidden rounded-[2.1rem] h-[480px] sm:h-[505px]"
            style={{ background: "radial-gradient(120% 60% at 15% 0%, #ff9a52 0%, rgba(255,154,82,0) 55%), radial-gradient(90% 60% at 100% 30%, #c2410c 0%, rgba(194,65,12,0) 60%), radial-gradient(120% 80% at 50% 110%, #1b0d06 0%, #3a1608 55%, #7c2d0b 100%)" }}>
            {/* soft grain so the wallpaper reads as an image, not a flat fill */}
            <div aria-hidden="true" className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />
            {/* punch-hole camera */}
            <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-[10px] w-[11px] h-[11px] rounded-full bg-black ring-[3px] ring-black/40" />

            <div className="relative">
              <StatusBar />
              {/* Clock */}
              <div className="mt-7 text-center text-white">
                <p className="text-[13px] font-medium text-white/85">Saturday · 29°C</p>
                <p className="mt-1 font-display text-[54px] leading-none font-light tracking-[-0.04em]" style={{ textShadow: "0 2px 18px rgba(0,0,0,0.25)" }}>10:42</p>
              </div>

              {/* Notifications: newest on top, older ones slide down */}
              <div className="relative mx-2.5 mt-6" style={{ height: ALERTS.length * (CARD_H + GAP) }}>
                {ALERTS.map(({ Icon, tint, title, body }, k) => {
                  const shown = k < n;
                  const slot = n - 1 - k;
                  return (
                    <div key={title} className="absolute inset-x-0 top-0 rounded-[22px] px-3 py-2.5 flex items-start gap-2.5"
                      style={{
                        height: CARD_H,
                        background: "rgba(255,255,255,0.86)",
                        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
                        boxShadow: "0 10px 26px -14px rgba(0,0,0,0.55)",
                        opacity: shown ? 1 : 0,
                        transform: shown ? `translate3d(0, ${slot * (CARD_H + GAP)}px, 0)` : "translate3d(0, -18px, 0) scale(0.97)",
                        transition: "transform 0.65s cubic-bezier(0.22,1,0.36,1), opacity 0.5s ease",
                      }}>
                      <span className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}>
                        <img src="/logo-112.webp" alt="" width="20" height="20" className="w-5 h-5 object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-[10.5px] text-[#5f6368]">
                          Arthaleads <span aria-hidden="true">·</span> {slot === 0 ? "now" : `${slot * 3} min`}
                          <Icon className="w-3 h-3 ml-auto shrink-0" style={{ color: tint }} aria-hidden="true" />
                        </span>
                        <span className="block text-[13px] font-semibold text-[#1f1f1f] leading-tight truncate">{title}</span>
                        <span className="block text-[11.5px] text-[#444746] leading-tight mt-0.5 truncate">{body}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lock-screen shortcuts and fingerprint */}
            <div aria-hidden="true" className="absolute inset-x-0 bottom-6 flex items-end justify-between px-6 text-white">
              <span className="w-11 h-11 rounded-full flex items-center justify-center bg-white/15 backdrop-blur"><Phone className="w-[18px] h-[18px]" /></span>
              <span className="flex flex-col items-center gap-1.5 mb-1">
                <Fingerprint className="w-8 h-8 text-white/85" strokeWidth={1.4} />
              </span>
              <span className="w-11 h-11 rounded-full flex items-center justify-center bg-white/15 backdrop-blur"><Camera className="w-[18px] h-[18px]" /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
