// components/WhatsAppWidget.jsx - floating WhatsApp button on the marketing
// site, plus the shared rules for both floating launchers (this one and Ask
// Artha in MarketingChatBot.jsx). Owner-approved rules (31 Oct 2026):
// - Nothing floats until the visitor has answered the cookie banner.
// - Both sit stacked in the bottom-right corner: WhatsApp above Ask Artha. One
//   corner covers less than two, and page text is left-aligned, so the right
//   edge is mostly empty space. Icon-only, with the real WhatsApp logo.
// - Phones and tablets (<1024px): compact 48px round buttons that slide away
//   while scrolling down and come back on scroll up or near the top/bottom.
// - Every width: they fade out while the footer is on screen, so footer links
//   are never covered.
// Still hidden while the phone menu is open and on Book a Demo on phones
// (.menu-open / .hide-chat-mobile in styles.css).
import { useEffect, useState } from "react";
import WhatsAppLogo from "./WhatsAppLogo";
import { waLink, WA_MESSAGES } from "../utils/crmLinks";

const CONSENT_KEY = "artha_cookie_consent";   // written by CookieBanner / CookiePolicy

function readConsent() {
  try { return !!localStorage.getItem(CONSENT_KEY); }
  catch { return true; }   // storage blocked: the banner never shows, so don't wait for it
}

function useMedia(query) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return match;
}

// Shared state for both launchers: { consented, compact, reduce, hidden }.
// `hidden` = slid away (scrolling down on phones/tablets, or footer in view).
export function useLauncherState() {
  const [consented, setConsented] = useState(readConsent);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const compact = useMedia("(max-width: 1023px)");
  const reduce = useMedia("(prefers-reduced-motion: reduce)");

  // Consent: CookieBanner (and the Cookie Policy page) fire "cookie-consent".
  useEffect(() => {
    const on = () => setConsented(readConsent());
    window.addEventListener("cookie-consent", on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener("cookie-consent", on); window.removeEventListener("storage", on); };
  }, []);

  // Scroll direction (used below 1024px) + footer watch (all widths).
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    let observed = null;
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => entries.forEach((e) => setFooterInView(e.isIntersecting)))
      : null;
    // The page's footer mounts after us and is swapped on route changes, so
    // re-find it whenever the one we watch has left the document.
    const watchFooter = () => {
      if (!io || (observed && observed.isConnected)) return;
      const all = document.getElementsByTagName("footer");
      const f = all[all.length - 1] || null;
      if (observed) io.unobserve(observed);
      observed = f;
      setFooterInView(false);
      if (f) io.observe(f);
    };
    const tick = () => {
      frame = 0;
      watchFooter();
      const y = Math.max(0, window.scrollY);
      const nearTop = y < 80;
      const nearBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 160;
      const dy = y - lastY;
      if (nearTop || nearBottom) { setScrollHidden(false); lastY = y; }
      else if (dy > 8) { setScrollHidden(true); lastY = y; }
      else if (dy < -8) { setScrollHidden(false); lastY = y; }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(tick); };
    tick();
    const retry = setInterval(watchFooter, 1500);   // lazy pages and route changes without a scroll
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      clearInterval(retry);
      io?.disconnect();
    };
  }, []);

  return { consented, compact, reduce, hidden: footerInView || (compact && scrollHidden) };
}

// Inline style that slides a launcher off the bottom edge (or only fades it
// when the visitor prefers reduced motion) and takes it out of reach.
export function launcherMotion(hidden, reduce) {
  const d = reduce ? "0ms" : "260ms";
  return {
    transform: hidden && !reduce ? "translateY(calc(100% + 32px))" : "none",
    opacity: hidden ? 0 : 1,
    visibility: hidden ? "hidden" : "visible",
    pointerEvents: hidden ? "none" : "auto",
    transition: `transform ${d} cubic-bezier(.2,.7,.2,1), opacity ${d} ease, visibility 0s linear ${hidden ? d : "0ms"}`,
  };
}

export default function WhatsAppWidget() {
  const { consented, compact, reduce, hidden } = useLauncherState();
  if (!consented) return null;
  const size = compact ? 48 : 54;
  return (
    <a href={waLink(WA_MESSAGES.sales)} target="_blank" rel="noopener noreferrer"
      aria-label="Chat on WhatsApp with Arthaleads"
      className="wa-widget group fixed z-[996] flex items-center justify-center rounded-full"
      style={{
        // Stacked above Ask Artha (phones 16 + 48 + 12, desktop 20 + 58 + 12),
        // centred on Artha's avatar.
        right: compact ? 16 : 22,
        bottom: `calc(${compact ? 76 : 90}px + env(safe-area-inset-bottom, 0px))`,
        width: size, height: size,
        background: "#25D366",
        boxShadow: "0 12px 28px -10px rgba(0,0,0,0.40), 0 0 0 4px rgba(37,211,102,0.16)",
        ...launcherMotion(hidden, reduce),
      }}>
      <WhatsAppLogo className={compact ? "w-6 h-6" : "w-7 h-7"} color="#ffffff" />
      {/* Desktop tooltip: the button is icon-only, so say what it does on hover/focus. */}
      <span aria-hidden="true"
        className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold opacity-0 transition-opacity duration-150 lg:block group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ background: "var(--app-surface-solid, #fff)", color: "var(--app-text, #18181b)", border: "1px solid var(--app-border-strong, #e5e7eb)", boxShadow: "0 10px 24px -12px rgba(0,0,0,0.35)" }}>
        Chat on WhatsApp
      </span>
    </a>
  );
}
