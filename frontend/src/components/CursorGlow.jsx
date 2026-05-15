/**
 * CursorGlow — subtle radial glow that follows the cursor.
 * Uses RAF + lerp for buttery-smooth tracking.
 * Automatically disabled on touch/mobile devices.
 */
import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const outerRef = useRef(null);
  const innerRef = useRef(null);

  useEffect(() => {
    // Skip on touch screens — no cursor to follow
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const mouse    = { x: -1000, y: -1000 };
    const smoothed = { x: -1000, y: -1000 };
    let rafId;
    let visible = false;

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!visible) {
        // Snap to position on first move so there's no swoop from off-screen
        smoothed.x = mouse.x;
        smoothed.y = mouse.y;
        outer.style.opacity = "1";
        inner.style.opacity = "1";
        visible = true;
      }
    };

    const onLeave = () => {
      outer.style.opacity = "0";
      inner.style.opacity = "0";
      visible = false;
    };

    const animate = () => {
      // Outer glow lags behind the cursor (lerp factor 0.08 = slower/dreamier)
      smoothed.x += (mouse.x - smoothed.x) * 0.08;
      smoothed.y += (mouse.y - smoothed.y) * 0.08;

      outer.style.left = `${smoothed.x}px`;
      outer.style.top  = `${smoothed.y}px`;

      // Inner dot tracks exactly
      inner.style.left = `${mouse.x}px`;
      inner.style.top  = `${mouse.y}px`;

      rafId = requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    rafId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      {/* Large soft glow that lags behind — creates the dreamy ambient light */}
      <div
        ref={outerRef}
        aria-hidden="true"
        style={{
          position:      "fixed",
          pointerEvents: "none",
          zIndex:        9997,
          top:           0,
          left:          0,
          width:         "380px",
          height:        "380px",
          borderRadius:  "50%",
          transform:     "translate(-50%, -50%)",
          background:    "radial-gradient(circle, rgba(255,107,0,0.13) 0%, rgba(255,107,0,0.06) 40%, transparent 70%)",
          filter:        "blur(28px)",
          opacity:       0,
          transition:    "opacity 0.4s ease",
          willChange:    "left, top",
        }}
      />

      {/* Tiny sharp dot exactly at cursor — crisp accent point */}
      <div
        ref={innerRef}
        aria-hidden="true"
        style={{
          position:      "fixed",
          pointerEvents: "none",
          zIndex:        9998,
          top:           0,
          left:          0,
          width:         "8px",
          height:        "8px",
          borderRadius:  "50%",
          transform:     "translate(-50%, -50%)",
          background:    "rgba(255,107,0,0.75)",
          boxShadow:     "0 0 8px 3px rgba(255,107,0,0.5), 0 0 18px 6px rgba(255,107,0,0.2)",
          opacity:       0,
          transition:    "opacity 0.4s ease",
          willChange:    "left, top",
        }}
      />
    </>
  );
}
