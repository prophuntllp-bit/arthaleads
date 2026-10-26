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
  ghostfibers: lazy(() => import("./reactbits/GhostFibers")),
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
  useEffect(() => {
    const update = () => setLive(canAnimate());
    update();
    const mq = window.matchMedia?.("(min-width: 768px)");
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
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
