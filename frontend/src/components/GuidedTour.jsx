import { useEffect, useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

// Lightweight guided-tour engine. Spotlights a target element (by selector),
// dims the rest, and shows a tooltip near it. Fully responsive.
export default function GuidedTour({ steps = [], onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const total = steps.length;
  const step = steps[index];

  // Find the current target element, scroll it into view, measure it.
  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    // Measure after the scroll settles
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    });
  }, [step]);

  useLayoutEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure]);

  // Auto-skip steps whose target isn't on this page
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) {
      if (index < total - 1) setIndex((i) => i + 1);
      else onClose();
    }
  }, [step, index, total, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, total - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onClose]);

  if (!step) return null;

  const pad = 8;
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Tooltip placement: below the target if room, else above; clamped to viewport.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipW = Math.min(320, vw - 24);
  let tipTop = 24, tipLeft = (vw - tipW) / 2;
  if (spot) {
    const below = spot.top + spot.height + 12;
    const aboveSpace = spot.top - 12;
    if (below + 160 < vh) tipTop = below;
    else if (aboveSpace > 160) tipTop = Math.max(12, spot.top - 172);
    else tipTop = vh - 184;
    tipLeft = Math.min(Math.max(12, spot.left + spot.width / 2 - tipW / 2), vw - tipW - 12);
  }

  const isLast = index === total - 1;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" style={{ WebkitTapHighlightColor: "transparent" }}>
      {/* Dim overlay with a transparent "hole" via box-shadow */}
      <div
        className="absolute inset-0 transition-all duration-300"
        onClick={onClose}
        style={
          spot
            ? {
                top: spot.top, left: spot.left, width: spot.width, height: spot.height,
                position: "absolute", borderRadius: 12,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
                border: "2px solid var(--app-primary, #ff6b00)",
                pointerEvents: "none",
              }
            : { background: "rgba(0,0,0,0.62)" }
        }
      />

      {/* Tooltip */}
      <div
        className="absolute card p-4 shadow-2xl"
        style={{ top: tipTop, left: tipLeft, width: tipW, background: "var(--app-bg)", border: "1px solid var(--app-border)", borderRadius: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h4 className="text-sm font-bold text-app">{step.title}</h4>
          <button type="button" onClick={onClose} className="text-app-soft hover:text-app transition cursor-pointer shrink-0" aria-label="Close tour">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-app-soft leading-relaxed">{step.body}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all"
                style={{ width: i === index ? 16 : 6, background: i === index ? "var(--app-primary, #ff6b00)" : "var(--app-border)" }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex((i) => i - 1)}
                className="btn-secondary rounded-lg px-2.5 py-1.5 text-xs cursor-pointer flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}
            <button type="button" onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
              className="btn-primary rounded-lg px-3 py-1.5 text-xs cursor-pointer flex items-center gap-1">
              {isLast ? "Done" : <>Next <ArrowRight className="h-3 w-3" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
