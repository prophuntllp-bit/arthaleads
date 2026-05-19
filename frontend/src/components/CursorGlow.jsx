/**
 * CursorGlow - custom cursor with orange neon glow border.
 * Replaces the OS cursor with a sleek arrow SVG + glowing outline.
 * Works on dark and light mode. Auto-disabled on touch/mobile.
 */
import { useEffect, useRef } from "react";


export default function CursorGlow() {
  const wrapRef = useRef(null);

  useEffect(() => {
    // Skip on touch/mobile - no cursor to replace
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const el = wrapRef.current;
    if (!el) return;

    // ── Detect and track dark mode ──────────────────────────────────────────
    const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

    // CRM uses classList.add("dark"); public site uses data-public-theme="dark"
    const getIsDark = () =>
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-public-theme") === "dark" ||
      darkMQ.matches;

    const applyFill = () => {
      const fill = el.querySelector(".cursor-fill");
      if (fill) fill.setAttribute("fill", getIsDark() ? "#ffffff" : "#1a1a1a");
    };

    applyFill();

    // Watch for any theme attribute/class changes on <html>
    const observer = new MutationObserver(applyFill);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-public-theme"],
    });
    darkMQ.addEventListener("change", applyFill);

    // ── Inject global cursor: none ──────────────────────────────────────────
    const styleTag = document.createElement("style");
    styleTag.id = "cursor-glow-hide";
    styleTag.textContent = `
      *, *::before, *::after { cursor: none !important; }
    `;
    document.head.appendChild(styleTag);

    // ── Track mouse exactly (no lag - cursor must feel instant) ────────────
    let visible = false;

    const onMove = (e) => {
      el.style.left = e.clientX + "px";
      el.style.top  = e.clientY + "px";
      if (!visible) {
        el.style.opacity = "1";
        visible = true;
      }
    };

    const onLeave = () => { el.style.opacity = "0"; visible = false; };
    const onEnter = () => { if (visible) el.style.opacity = "1"; };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    return () => {
      document.getElementById("cursor-glow-hide")?.remove();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        position:      "fixed",
        pointerEvents: "none",
        zIndex:        99999,
        top:           0,
        left:          0,
        opacity:       0,
        // No transform offset - SVG tip is at (0,0) matching the hotspot
        transition:    "opacity 0.25s ease",
        willChange:    "left, top",
      }}
    >
      {/* Outer ambient glow blob - lags slightly behind for depth */}
      <div
        style={{
          position:     "absolute",
          top:          "4px",
          left:         "4px",
          width:        "60px",
          height:       "60px",
          borderRadius: "50%",
          background:   "radial-gradient(circle, rgba(255,107,0,0.25) 0%, transparent 70%)",
          filter:       "blur(12px)",
          transform:    "translate(-20%, -20%)",
        }}
      />

      {/* The cursor itself */}
      <svg
        width="26"
        height="30"
        viewBox="0 0 26 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", position: "relative", zIndex: 1 }}
      >
        <defs>
          <filter id="cursor-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2"  result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="4"  result="b2" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8"  result="b3" />
            <feMerge>
              <feMergeNode in="b3" />
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Glow stroke layer (blurred orange = the neon border) */}
        <path
          d="M3.5 2L22.5 12L15.5 15L10.5 28Z"
          fill="none"
          stroke="#ff6b00"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#cursor-glow)"
        />

        {/* Solid cursor - fill set by JS based on dark/light mode */}
        <path
          className="cursor-fill"
          d="M3.5 2L22.5 12L15.5 15L10.5 28Z"
          fill="#ffffff"
          stroke="#ff6b00"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
