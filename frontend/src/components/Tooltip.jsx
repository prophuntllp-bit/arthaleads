import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

// Small dark bubble that explains what something is. Shows on hover and on
// keyboard focus after a short delay, rendered in a portal so a scrolling or
// clipped parent (the sidebar, a card) can't cut it off.
//
//   <Tooltip content="What this does"><button>…</button></Tooltip>
//   <Tooltip title="Leads" content="Every lead from every source" side="right">…</Tooltip>
//   <InfoTip text="How this number is worked out" />
export default function Tooltip({ content, title, side = "top", delay = 350, className = "", children, disabled = false }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [pos, setPos] = useState(null);
  const has = !disabled && (content || title);

  const show = () => {
    if (!has) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      setPos(side === "right" ? { left: r.right + 10, top: r.top + r.height / 2 }
        : side === "bottom" ? { left: r.left + r.width / 2, top: r.bottom + 8 }
        : { left: r.left + r.width / 2, top: r.top - 8 });
    }, delay);
  };
  const hide = () => { clearTimeout(timer.current); setPos(null); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (!has) hide(); }, [has]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={ref} className={className || "inline-flex"} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onMouseDown={hide}>
      {children}
      {pos && createPortal(<Bubble pos={pos} side={side} title={title} content={content} />, document.body)}
    </span>
  );
}

function Bubble({ pos, side, title, content }) {
  const el = useRef(null);
  const [shift, setShift] = useState(0);
  // Keep it on screen: nudge sideways if it would run past either edge.
  useLayoutEffect(() => {
    const r = el.current?.getBoundingClientRect();
    if (!r) return;
    if (r.right > window.innerWidth - 8) setShift(window.innerWidth - 8 - r.right);
    else if (r.left < 8) setShift(8 - r.left);
  }, []);
  const transform = side === "right" ? "translateY(-50%)" : side === "bottom" ? "translateX(-50%)" : "translate(-50%, -100%)";
  const arrow = side === "right"
    ? { left: -4, top: "50%", marginTop: -4 }
    : side === "bottom" ? { top: -4, left: `calc(50% - 4px - ${shift}px)` } : { bottom: -4, left: `calc(50% - 4px - ${shift}px)` };
  return (
    <div ref={el} role="tooltip"
      className="pointer-events-none fixed z-[10002] max-w-[260px] rounded-lg px-3 py-2 text-xs leading-snug shadow-lg"
      style={{ left: pos.left + shift, top: pos.top, transform, background: "var(--tip-bg)", color: "var(--tip-text)", animation: "tip-in 120ms ease-out" }}>
      {title && <p className="font-semibold">{title}</p>}
      {content && <p className={title ? "mt-0.5 opacity-80" : "font-medium"}>{content}</p>}
      <span className="absolute h-2 w-2 rotate-45" style={{ background: "var(--tip-bg)", ...arrow }} />
    </div>
  );
}

// A "?" next to a label, for features that need a sentence of explanation.
export function InfoTip({ text, title, side = "top", size = 14 }) {
  return (
    <Tooltip content={text} title={title} side={side}>
      {/* A span, not a button: it often sits inside a clickable card. */}
      <span role="img" tabIndex={0} aria-label={`${title ? `${title}: ` : ""}${text || ""}`} onClick={(e) => e.stopPropagation()}
        className="inline-flex cursor-help items-center text-app-soft opacity-70 transition hover:opacity-100 focus:opacity-100 focus:outline-none">
        <HelpCircle style={{ width: size, height: size }} />
      </span>
    </Tooltip>
  );
}
