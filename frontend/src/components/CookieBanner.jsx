import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "artha_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => { localStorage.setItem(STORAGE_KEY, "accepted"); setVisible(false); };
  const decline = () => { localStorage.setItem(STORAGE_KEY, "declined"); setVisible(false); };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
      style={{ background: "var(--app-bg)", borderTop: "1px solid var(--app-border)", boxShadow: "0 -4px 24px rgba(0,0,0,0.12)" }}
    >
      <p className="text-xs text-app-soft leading-snug max-w-2xl">
        We use essential cookies to keep you logged in and analytics cookies to improve the product.
        By using Arthaleads you agree to our{" "}
        <Link to="/cookie-policy" className="underline hover:text-orange-500 transition">Cookie Policy</Link>
        {" "}in compliance with India's DPDP Act 2023.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={decline}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition hover:border-orange-400 hover:text-orange-500"
          style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl text-white transition hover:opacity-90"
          style={{ background: "var(--app-primary)" }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
