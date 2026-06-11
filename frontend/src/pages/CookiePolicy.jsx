import { useState, useEffect } from "react";
import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { Check } from "lucide-react";

const STORAGE_KEY = "cookie_prefs";

// ── Interactive cookie preference center ──────────────────────────────────────
function CookiePreferences() {
  const { isDark } = usePublicTheme();
  const [prefs, setPrefs] = useState({ necessary: true, analytics: true, marketing: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (stored) setPrefs({ ...stored, necessary: true });
    } catch { /* ignore */ }
  }, []);

  const cardBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb";
  const heading = isDark ? "#fff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  const categories = [
    { key: "necessary", name: "Strictly Necessary", locked: true,
      desc: "Required for login, security, and core CRM functionality. These cannot be turned off." },
    { key: "analytics", name: "Analytics", locked: false,
      desc: "Help us understand how the site is used so we can improve it. Anonymous and aggregated." },
    { key: "marketing", name: "Marketing", locked: false,
      desc: "Used to measure ad campaigns and show relevant content. Off by default." },
  ];

  const toggle = (key) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: "0.75rem", padding: "1.25rem" }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: heading, marginBottom: 4 }}>Manage Your Cookie Preferences</h3>
      <p style={{ fontSize: 12, color: soft, marginBottom: 16 }}>Choose which cookies you allow. Your choice is saved on this device.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {categories.map((c) => (
          <div key={c.key} style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14,
            padding: "12px 14px", borderRadius: 10, border: `1px solid ${border}`,
            background: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: heading, marginBottom: 2 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: soft, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
            <button
              onClick={() => !c.locked && toggle(c.key)}
              disabled={c.locked}
              aria-label={`Toggle ${c.name}`}
              style={{
                flexShrink: 0, width: 44, height: 24, borderRadius: 999, border: "none",
                cursor: c.locked ? "not-allowed" : "pointer", position: "relative",
                background: prefs[c.key] ? "#ff6b00" : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db"),
                opacity: c.locked ? 0.6 : 1, transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: prefs[c.key] ? 22 : 2,
                width: 20, height: 20, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        style={{
          marginTop: 16, width: "100%", padding: "11px", borderRadius: 10, border: "none",
          background: "#ff6b00", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#e05f00")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#ff6b00")}
      >
        {saved ? <><Check style={{ width: 16, height: 16 }} /> Preferences Saved</> : "Save Preferences"}
      </button>
    </div>
  );
}

export default function CookiePolicy() {
  useSEO({
    title:       "Cookie Policy | Arthaleads Real Estate CRM",
    description: "Learn how Arthaleads uses cookies. Manage your cookie preferences for analytics and marketing. Compliant with India’s DPDP Act 2023.",
    canonical:   "https://www.arthaleads.com/cookie-policy",
  });

  return (
    <LegalLayout title="Cookie Policy" badge="Privacy" updated="31 May 2026">

      <Section title="1. What Are Cookies?">
        <p>
          Cookies are small text files stored on your device when you visit a website. They help the site
          remember your actions and preferences (such as login, language, and display settings) so you don't
          have to re-enter them. We also use similar technologies like local storage to keep you signed in
          securely.
        </p>
      </Section>

      <Section title="2. Your Cookie Choices">
        <p>You can control non-essential cookies below. Your preference is stored on your device and respected on future visits.</p>
        <div style={{ marginTop: "1rem" }}>
          <CookiePreferences />
        </div>
      </Section>

      <Section title="3. Types of Cookies We Use">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={{ color: "var(--app-text)" }}>Strictly necessary:</strong>{" "}
            Authentication tokens (httpOnly session cookie), security, and load balancing. The CRM cannot
            function without these.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Analytics:</strong>{" "}
            Anonymous usage data that helps us understand which features are used and where to improve.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Marketing:</strong>{" "}
            Used only with your consent to measure the effectiveness of our advertising. Off by default.
          </li>
        </ul>
      </Section>

      <Section title="4. Cookies We Set">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>crm_token</strong> — secure httpOnly session cookie that keeps you logged in. Essential.</li>
          <li><strong style={{ color: "var(--app-text)" }}>cookie_prefs</strong> — stores your cookie preferences from the panel above.</li>
          <li><strong style={{ color: "var(--app-text)" }}>theme</strong> — remembers your light/dark mode choice.</li>
        </ul>
      </Section>

      <Section title="5. Third-Party Services">
        <p>
          We use a small number of trusted third-party services to operate the platform — for example,
          Cloudinary (image hosting), Resend (transactional email), and Sentry (error monitoring). These may
          set their own cookies strictly to deliver their service. We do not sell your data to any
          third party.
        </p>
      </Section>

      <Section title="6. Managing Cookies in Your Browser">
        <p>
          In addition to the controls above, you can manage or delete cookies through your browser settings.
          Note that disabling strictly necessary cookies will prevent you from logging into the CRM.
        </p>
      </Section>

      <Section title="7. DPDP Act 2023 Compliance">
        <p>
          Arthaleads is committed to compliance with India's Digital Personal Data Protection Act, 2023. We
          obtain consent before setting non-essential cookies, give you clear controls, and never use your
          personal data beyond operating the CRM service for you. For more on how we handle data, see our{" "}
          <a href="/privacy" style={{ color: "var(--app-primary)" }} className="hover:underline">Privacy Policy</a>.
        </p>
      </Section>

      <Section title="8. Contact Us">
        <p>Questions about our use of cookies?</p>
        <ContactBox>
          <p className="font-bold mb-1" style={{ color: "var(--app-text)" }}>Arthaleads</p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Email:{" "}
            <a href="mailto:contact@arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">
              contact@arthaleads.com
            </a>
          </p>
        </ContactBox>
      </Section>

    </LegalLayout>
  );
}
