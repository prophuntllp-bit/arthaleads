import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "artha_cookie_consent";

// Consent card, bottom-left so it never sits on top of the Artha assistant
// (bottom-right). "Essential only" rather than "Decline": the login cookie is
// needed to use the app at all, so that is what declining actually means.
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(STORAGE_KEY)) setVisible(true); } catch { /* storage blocked */ }
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* storage blocked */ }
    setVisible(false);
  };

  return (
    <div role="dialog" aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-[10003] rounded-2xl p-5 sm:right-auto sm:w-[400px]"
      style={{ background: "var(--app-surface-solid)", border: "1px solid var(--app-border-strong)", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
          <Cookie className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-app">Cookies on ArthaLeads</p>
          <p className="mt-1 text-xs leading-relaxed text-app-soft">
            We use essential cookies to keep you signed in, and analytics cookies to improve the product.
            Read our{" "}
            <Link to="/cookie-policy" className="font-medium underline underline-offset-2 hover:text-orange-500">Cookie Policy</Link>
            {" "}(India's DPDP Act, 2023).
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => choose("declined")}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-app transition hover:bg-black/5 dark:hover:bg-white/5"
          style={{ border: "1px solid var(--app-border-strong)" }}>
          Essential only
        </button>
        <button type="button" onClick={() => choose("accepted")}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--app-primary)" }}>
          Accept all
        </button>
      </div>
    </div>
  );
}
