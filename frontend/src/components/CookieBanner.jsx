import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "artha_cookie_consent";
// The Cookie Policy page keeps the detailed choices under this key. The banner writes the
// same choices there, so "Essential only" there and here always mean the same thing.
const PREFS_KEY = "cookie_prefs";

// Consent card, bottom-left on larger screens; on phones a slim full-width bar
// flush with the bottom edge: two short lines of text over two equal 44px
// buttons. The WhatsApp and Artha buttons stay hidden until a choice is made
// (they listen for the "cookie-consent" event below). "Essential only" rather
// than "Decline": the login cookie is needed to use the app at all, so that is
// what declining actually means.
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(STORAGE_KEY)) setVisible(true); } catch { /* storage blocked */ }
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
      localStorage.setItem(PREFS_KEY, JSON.stringify({ necessary: true, analytics: value === "accepted", marketing: false }));
    } catch { /* storage blocked */ }
    window.dispatchEvent(new Event("cookie-consent"));   // utils/analytics.js starts GA if allowed
    setVisible(false);
  };

  return (
    <div role="dialog" aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[10003] rounded-t-2xl px-3 pt-2.5 sm:bottom-4 sm:left-4 sm:right-auto sm:w-[400px] sm:rounded-2xl sm:p-5"
      style={{ background: "var(--app-surface-solid)", border: "1px solid var(--app-border-strong)", boxShadow: "0 -8px 32px rgba(0,0,0,0.14)",
        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
      <div className="flex items-start gap-3">
        <span className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--brand-text)" }}>
          <Cookie className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="hidden sm:block text-sm font-semibold text-app">Cookies on Arthaleads</p>
          <p className="text-[12px] leading-snug text-app-soft sm:mt-1 sm:text-xs sm:leading-relaxed">
            <span className="sm:hidden">We use cookies to keep you signed in and, if you allow, to improve the site.{" "}</span>
            <span className="hidden sm:inline">We use essential cookies to keep you signed in, and analytics cookies to improve the product.{" "}
              Read our{" "}</span>
            <Link to="/cookie-policy" className="font-medium underline underline-offset-2 hover:text-orange-500">Cookie Policy</Link>
            <span className="hidden sm:inline">{" "}(India's DPDP Act, 2023)</span>.
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4">
        <button type="button" onClick={() => choose("declined")}
          className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold text-app transition hover:bg-black/5 dark:hover:bg-white/5"
          style={{ border: "1px solid var(--app-border-strong)" }}>
          Essential only
        </button>
        <button type="button" onClick={() => choose("accepted")}
          className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--brand-btn)" }}>
          Accept all
        </button>
      </div>
    </div>
  );
}
