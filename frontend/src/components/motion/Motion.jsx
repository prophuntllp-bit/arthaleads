// components/motion/Motion.jsx
//
// The marketing site's motion kit. Small on purpose: CSS transitions driven by
// one shared IntersectionObserver, no animation library on the landing bundle.
// Every effect is skipped for prefers-reduced-motion and for Data Saver, and
// content is always visible without JavaScript (the hidden state is only
// applied once the observer is ready).
import { useEffect, useRef, useState } from "react";

const prefersReduced = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData === true);

// One observer for every reveal on the page.
let observer = null;
const callbacks = new WeakMap();
function observe(el, cb) {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        callbacks.get(e.target)?.();
        observer.unobserve(e.target);
        callbacks.delete(e.target);
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
  }
  callbacks.set(el, cb);
  observer.observe(el);
  return () => { observer?.unobserve(el); callbacks.delete(el); };
}

/** True once the element has scrolled into view (immediately when motion is off). */
export function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced() || typeof IntersectionObserver === "undefined") { setSeen(true); return undefined; }
    return observe(el, () => setSeen(true));
  }, [ref]);
  return seen;
}

/**
 * Fades and lifts its children in when they scroll into view.
 * `delay` (ms) staggers siblings; `y` is the travel distance in px.
 */
export function Reveal({ as: Tag = "div", delay = 0, y = 24, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  const [armed, setArmed] = useState(false);   // hidden state only after mount, so no-JS / SSR shows content
  const seen = useInView(ref);
  useEffect(() => { if (!prefersReduced()) setArmed(true); }, []);
  const hidden = armed && !seen;
  return (
    <Tag ref={ref} className={className} {...rest}
      style={{
        ...style,
        opacity: hidden ? 0 : 1,
        transform: hidden ? `translate3d(0, ${y}px, 0) scale(0.985)` : "none",
        filter: hidden ? "blur(6px)" : "none",
        transition: armed
          ? `opacity 700ms cubic-bezier(.2,.7,.2,1) ${delay}ms, transform 800ms cubic-bezier(.2,.7,.2,1) ${delay}ms, filter 700ms ease ${delay}ms`
          : undefined,
        willChange: hidden ? "opacity, transform" : undefined,
      }}>
      {children}
    </Tag>
  );
}

/**
 * Counts up to a number the first time it is seen. Keeps any prefix/suffix
 * from the label, e.g. "10,000+" or "3×", so callers pass the display string.
 */
export function CountUp({ value, duration = 1400, className, style }) {
  const ref = useRef(null);
  const seen = useInView(ref);
  const m = String(value).match(/^(\D*)([\d,.]+)(.*)$/);
  const target = m ? parseFloat(m[2].replace(/,/g, "")) : 0;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const [n, setN] = useState(() => (prefersReduced() ? target : 0));

  useEffect(() => {
    if (!m || !seen || prefersReduced()) { setN(target); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(target * (1 - Math.pow(1 - p, 4)));   // ease-out quart
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, target, duration]);

  if (!m) return <span className={className} style={style}>{value}</span>;
  const shown = n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className={className} style={style} aria-label={String(value)}>
      <span aria-hidden="true">{m[1]}{shown}{m[3]}</span>
    </span>
  );
}

/**
 * A card with a soft orange light that follows the pointer. Pure CSS
 * variables, so it costs nothing until hovered and does nothing on touch.
 */
export function Spotlight({ as: Tag = "div", className = "", style, children, color = "rgba(255,107,0,0.12)", ...rest }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--sx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return (
    <Tag className={`spotlight-card ${className}`} onPointerMove={onMove} style={{ ...style, "--spot": color }} {...rest}>
      {children}
    </Tag>
  );
}

/** Thin progress bar along the top edge showing how far down the page you are. */
export function ScrollProgress() {
  const ref = useRef(null);
  useEffect(() => {
    if (prefersReduced()) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? Math.min(1, h.scrollTop / max) : 0})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div aria-hidden="true" className="fixed top-0 left-0 right-0 h-[3px] z-[60] pointer-events-none">
      <div ref={ref} className="h-full origin-left bg-gradient-to-r from-[#ff6b00] via-[#ff8a00] to-[#ffaa00]"
        style={{ transform: "scaleX(0)", boxShadow: "0 0 12px rgba(255,107,0,0.55)" }} />
    </div>
  );
}

/** Wraps a primary CTA so it leans slightly toward the pointer. */
export function Magnetic({ children, strength = 0.25, className = "" }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (prefersReduced() || e.pointerType !== "mouse") return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * strength;
    const y = (e.clientY - (r.top + r.height / 2)) * strength;
    ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <span ref={ref} onPointerMove={onMove} onPointerLeave={reset}
      className={`inline-flex transition-transform duration-300 ease-out ${className}`}>
      {children}
    </span>
  );
}
