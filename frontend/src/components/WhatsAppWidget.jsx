// components/WhatsAppWidget.jsx - floating "Chat on WhatsApp" pill on the
// marketing site, bottom LEFT (Ask Artha keeps the bottom right; owner's call).
// Same shape as the Artha pill, mirrored: icon first, then the label. Opens a
// WhatsApp chat with the sales number. Hidden while the phone menu is open and
// on the Book a Demo page on phones (styles.css), like the Artha pill. On
// phones it is just the round icon. Sits above the cookie banner while that is open.
import WhatsAppLogo from "./WhatsAppLogo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { waLink, WA_MESSAGES } from "../utils/crmLinks";

export default function WhatsAppWidget() {
  const { isDark } = usePublicTheme();
  return (
    <a href={waLink(WA_MESSAGES.sales)} target="_blank" rel="noopener noreferrer"
      aria-label="Chat with Arthaleads on WhatsApp"
      className="wa-widget fixed z-[996] flex items-center gap-2.5 rounded-full p-1.5 sm:pr-4 transition hover:-translate-y-0.5"
      style={{
        left: 20,
        bottom: "calc(20px + var(--cookie-h, 0px) + env(safe-area-inset-bottom, 0px))",   // above the cookie banner while it is open
        background: isDark ? "#111318" : "#ffffff",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb"}`,
        boxShadow: "0 14px 34px -12px rgba(0,0,0,0.35), 0 0 0 4px rgba(37,211,102,0.12)",
      }}>
      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "#25D366" }}>
        <WhatsAppLogo className="w-6 h-6" color="#ffffff" />
      </span>
      <span className="hidden sm:block text-[14px] font-bold leading-[1.05] text-left" style={{ color: isDark ? "#ffffff" : "#111827" }}>Chat on<br />WhatsApp</span>
    </a>
  );
}
