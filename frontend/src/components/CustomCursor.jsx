import { useEffect, useRef } from "react";

const HOVER_TARGETS = "a, button, [data-cursor-hover]";

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!cursor || !finePointer.matches) return;

    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let pointerX = cursorX;
    let pointerY = cursorY;
    let animationFrame;

    const onPointerMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      cursor.classList.add("visible");
    };

    const onPointerOver = (event) => {
      if (event.target.closest?.(HOVER_TARGETS)) {
        cursor.classList.add("active");
      }
    };

    const onPointerOut = (event) => {
      const target = event.target.closest?.(HOVER_TARGETS);
      if (target && !target.contains(event.relatedTarget)) {
        cursor.classList.remove("active");
      }
    };

    const onPointerLeave = () => {
      cursor.classList.remove("visible", "active");
    };

    const renderCursor = () => {
      const easing = reducedMotion.matches ? 1 : 0.22;
      cursorX += (pointerX - cursorX) * easing;
      cursorY += (pointerY - cursorY) * easing;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      animationFrame = window.requestAnimationFrame(renderCursor);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.documentElement.addEventListener("mouseleave", onPointerLeave);
    animationFrame = window.requestAnimationFrame(renderCursor);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
    };
  }, []);

  return <div ref={cursorRef} className="custom-cursor" aria-hidden="true" />;
}
