// components/site/LiveBackground.jsx - animated WebGL backgrounds for the
// marketing theme, loaded only where they are safe.
//
// The React Bits shaders (components/site/reactbits) are heavy for phones:
// layered GPU effects made Android Chrome paint blank tiles while scrolling.
// So the animation only mounts on tablet/desktop widths, with WebGL2, without
// reduced motion or Data Saver. Everywhere else (and in the prerendered HTML)
// the `fallback` CSS gradient shows instead. The shader code is lazy-loaded so
// it never weighs on the first paint, and each shader pauses itself when it is
// off screen or the tab is hidden.
import { lazy, Suspense, useEffect, useState } from "react";

const SHADERS = {
  grainient: lazy(() => import("./reactbits/Grainient")),
  threads: lazy(() => import("./reactbits/Threads")),
};

function canAnimate() {
  if (typeof window === "undefined") return false;
  const mq = (q) => window.matchMedia?.(q).matches;
  if (!mq("(min-width: 768px)") || mq("(prefers-reduced-motion: reduce)")) return false;
  if (navigator.connection?.saveData) return false;
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

/**
 * <LiveBackground kind="grainient" fallback="radial-gradient(...)" className style {...shaderProps} />
 * Fills its positioned parent (absolute, inset 0) and never takes pointer events.
 */
export default function LiveBackground({ kind, fallback, className = "", style, ...props }) {
  const [live, setLive] = useState(false);
  const [shown, setShown] = useState(false);
  // The shader starts on the visitor's first move, scroll, touch or key, not
  // while the page loads: setting it up held the main thread for about 250 ms
  // during start-up on desktop (Lighthouse, 30 Oct 2026). The `fallback`
  // gradient shows until then, and on desktop the first mouse move comes at once.
  useEffect(() => {
    const events = ["pointermove", "pointerdown", "scroll", "keydown", "touchstart"];
    let started = false;
    const update = () => { if (started) setLive(canAnimate()); };
    const start = () => {
      events.forEach((e) => window.removeEventListener(e, start));
      started = true;
      update();
    };
    events.forEach((e) => window.addEventListener(e, start, { passive: true }));
    const mq = window.matchMedia?.("(min-width: 768px)");
    mq?.addEventListener?.("change", update);
    return () => {
      events.forEach((e) => window.removeEventListener(e, start));
      mq?.removeEventListener?.("change", update);
    };
  }, []);
  // Fade the canvas in once it has mounted, instead of popping in.
  useEffect(() => {
    if (!live) { setShown(false); return undefined; }
    const t = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(t);
  }, [live]);

  const Shader = SHADERS[kind];
  return (
    <div aria-hidden="true" className={`absolute inset-0 pointer-events-none ${className}`} style={style}>
      {fallback && <div className="absolute inset-0" style={{ background: fallback }} />}
      {live && Shader && (
        <div className="absolute inset-0" style={{ opacity: shown ? 1 : 0, transition: "opacity 900ms ease" }}>
          <Suspense fallback={null}><Shader {...props} /></Suspense>
        </div>
      )}
    </div>
  );
}
