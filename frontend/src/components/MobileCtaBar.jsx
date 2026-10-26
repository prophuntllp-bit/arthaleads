// components/MobileCtaBar.jsx - one sticky action bar for phones on the marketing site.
//
// Replaces the stack that used to pile up at the bottom of a phone screen (the
// Android-app banner plus the chat avatar, which covered the hero buttons).
// It appears only after the visitor scrolls past the hero, so it never doubles
// the hero's own buttons, and it publishes its height as --mcta-h so the chat
// launcher can sit above it instead of on top of it.
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import WhatsAppLogo from "./WhatsAppLogo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS, waLink, WA_MESSAGES } from "../utils/crmLinks";

const BAR_H = 92; // buttons + the trial line + padding

export default function MobileCtaBar() {
  const { isDark } = usePublicTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    let raf = 0;
    const update = () => {
      raf = 0;
      setShow(mq.matches && window.scrollY > window.innerHeight * 0.9);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener?.("change", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--mcta-h", show ? `${BAR_H}px` : "0px");
    root.dataset.mcta = show ? "on" : "off";   // phones: the chat launcher waits for the bar (styles.css)
    return () => { root.style.removeProperty("--mcta-h"); delete root.dataset.mcta; };
  }, [show]);

  return (
    <div aria-hidden={!show}
      className="md:hidden fixed left-0 right-0 bottom-0 z-[996] transition-transform duration-300 ease-out"
      style={{
        transform: show ? "none" : "translateY(110%)",
        paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
        paddingTop: 10,
        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
        background: isDark ? "rgba(13,13,26,0.94)" : "rgba(255,255,255,0.94)",
        borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)"}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}>
      <div className="flex items-center gap-2.5">
        <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS} tabIndex={show ? 0 : -1}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--brand-btn)] text-white font-bold text-[15px] h-12 shadow-lg shadow-orange-500/25">
          Start free trial <ArrowRight className="w-4 h-4" />
        </a>
        <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer" tabIndex={show ? 0 : -1}
          aria-label="Book a demo on WhatsApp"
          className={`flex items-center justify-center gap-1.5 rounded-2xl h-12 px-4 font-semibold text-[14px] border ${isDark ? "text-[#4ade80] border-[#14532d] bg-[#052e16]" : "text-[#15803d] border-[#bbf7d0] bg-[#f0fdf4]"}`}>
          <WhatsAppLogo className="w-[18px] h-[18px]" /> Demo
        </a>
      </div>
      <p className="mt-1.5 text-center text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "#6b7280" }}>14 days free, no card needed</p>
    </div>
  );
}
