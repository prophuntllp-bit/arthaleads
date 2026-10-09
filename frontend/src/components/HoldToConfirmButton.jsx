import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

// A destructive button you must press and HOLD to confirm: a red fill sweeps across
// while held, and releasing early (or sliding the pointer off, or blurring) cancels it.
// Works with pointer and keyboard (hold Enter or Space). Honours reduced motion.
//   <HoldToConfirmButton onConfirm={fn} duration={1600}>Hold to delete</HoldToConfirmButton>
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function HoldToConfirmButton({
  children = "Hold to confirm", confirmedContent, disabled = false, duration = 1600, onConfirm, resetAfter = 1800, className = "", ...rest
}) {
  const btn = useRef(null);
  const confirmTimer = useRef(null);
  const resetTimer = useRef(null);
  const pointerId = useRef(null);
  const input = useRef("pointer");
  const holding = useRef(false);
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | holding | confirmed

  const clearConfirm = useCallback(() => { if (confirmTimer.current !== null) { clearTimeout(confirmTimer.current); confirmTimer.current = null; } }, []);

  const complete = useCallback(() => {
    if (!holding.current) return;
    holding.current = false; pointerId.current = null; clearConfirm();
    setStatus("confirmed");
    onConfirm?.(input.current);
    if (resetAfter > 0) resetTimer.current = setTimeout(() => { setStatus("idle"); resetTimer.current = null; }, resetAfter);
  }, [clearConfirm, onConfirm, resetAfter]);

  const cancel = useCallback(() => {
    if (!holding.current) return;
    holding.current = false; pointerId.current = null; clearConfirm(); setStatus("idle");
  }, [clearConfirm]);

  const start = useCallback((kind) => {
    if (disabled || status === "confirmed" || holding.current) return;
    if (resetTimer.current !== null) { clearTimeout(resetTimer.current); resetTimer.current = null; }
    input.current = kind; setMode(kind); holding.current = true; setStatus("holding");
    confirmTimer.current = setTimeout(complete, duration);
  }, [complete, disabled, duration, status]);

  useEffect(() => () => { clearConfirm(); if (resetTimer.current !== null) clearTimeout(resetTimer.current); }, [clearConfirm]);
  useEffect(() => { if (disabled) cancel(); }, [cancel, disabled]);

  const release = (id) => { const b = btn.current; if (b?.hasPointerCapture?.(id)) b.releasePointerCapture(id); };

  const onPointerDown = (e) => {
    if (!e.isPrimary || e.button !== 0 || disabled) return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    start("pointer");
  };
  const onPointerMove = (e) => {
    if (!holding.current || pointerId.current !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect(); const pad = 8;
    if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) { cancel(); release(e.pointerId); }
  };
  const onPointerEnd = (e) => { if (pointerId.current !== e.pointerId) return; cancel(); release(e.pointerId); };
  const onKeyDown = (e) => { if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return; e.preventDefault(); start("keyboard"); };
  const onKeyUp = (e) => { if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); cancel(); };

  const confirmed = status === "confirmed";
  const isHolding = status === "holding";
  const instant = prefersReducedMotion() || mode === "keyboard";
  const overlay = {
    clipPath: isHolding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
    transition: `clip-path ${instant ? 0 : isHolding ? duration : 180}ms ${isHolding ? "linear" : "cubic-bezier(0.23, 1, 0.32, 1)"}`,
    background: "#dc2626", color: "#fff",
  };

  return (
    <button
      {...rest}
      ref={btn}
      type="button"
      disabled={disabled}
      aria-busy={isHolding}
      data-input={mode}
      className={`relative isolate inline-flex min-w-40 touch-none select-none items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition-[transform,background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50 ${isHolding && mode === "pointer" ? "scale-[0.98]" : ""} ${className}`}
      style={{ borderColor: "#dc2626", background: confirmed ? "#dc2626" : "rgba(220,38,38,0.10)", color: confirmed ? "#fff" : "#dc2626", cursor: disabled ? "not-allowed" : "pointer" }}
      onBlur={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onLostPointerCapture={cancel}
      onPointerCancel={onPointerEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
    >
      {confirmed ? (
        <span className="relative flex items-center justify-center gap-1.5">{confirmedContent ?? (<><Check aria-hidden="true" className="h-4 w-4" />Confirmed</>)}</span>
      ) : (
        <>
          <span className="relative flex items-center justify-center gap-1.5">{children}</span>
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-1.5 px-4" style={overlay}>{children}</span>
        </>
      )}
    </button>
  );
}
