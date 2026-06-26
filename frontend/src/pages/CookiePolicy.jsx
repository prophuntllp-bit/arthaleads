import { useState, useEffect } from "react";
import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { Check } from "lucide-react";

const STORAGE_KEY = "cookie_prefs";

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
      desc: "Required for login, security, and core CRM functionality. Cannot be turned off." },
    { key: "analytics", name: "Analytics", locked: false,
      desc: "Help us understand how the platform is used so we can improve it. Anonymous and aggregated." },
    { key: "marketing", name: "Marketing", locked: false,
      desc: "Used to measure ad campaign effectiveness and show relevant content. Off by default." },
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
      <p style={{ fontSize: 12, color: soft, marginBottom: 16 }}>
        Choose which cookies you allow. Your choice is saved on this device and respected on future visits.
      </p>

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
    description: "Learn how Arthaleads uses cookies. Manage your cookie preferences for analytics and marketing. Compliant with India's DPDP Act 2023.",
    canonical:   "https://www.arthaleads.com/cookie-policy",
  });

  return (
    <LegalLayout title="Cookie Policy" badge="Privacy" updated="25 June 2026">

      <Section title="1. What Are Cookies?">
        <p>
          Cookies are small text files stored on your device when you visit a website. They help the
          platform remember your preferences — such as login state, theme, and display settings — so you
          don't have to re-enter them each visit. We also use similar technologies such as <code>localStorage</code>{" "}
          and <code>sessionStorage</code> for client-side state that never leaves your browser.
        </p>
      </Section>

      <Section title="2. Your Cookie Choices">
        <p>
          Under India's Digital Personal Data Protection (DPDP) Act, 2023, and general principles of
          privacy, we give you control over non-essential cookies. Use the panel below to set your
          preferences at any time — your choice is saved on this device.
        </p>
        <div style={{ marginTop: "1rem" }}>
          <CookiePreferences />
        </div>
      </Section>

      <Section title="3. Types of Cookies We Use">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: "var(--app-text)" }}>Strictly Necessary:</strong>{" "}
            These cookies are required for the platform to function. They handle authentication, security,
            CSRF protection, and session management. Without them, you cannot log into the CRM. These are
            set unconditionally and cannot be opted out of.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Analytics:</strong>{" "}
            Anonymous, aggregated data that helps us understand which features are most used and where
            improvements are needed. No personally identifiable information is included. Enabled by default
            but can be turned off in the panel above.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Marketing:</strong>{" "}
            Used only with your explicit consent to measure the effectiveness of our advertising campaigns.
            Disabled by default.
          </li>
        </ul>
      </Section>

      <Section title="4. Specific Cookies We Set">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: "var(--app-text)" }}>crm_token</strong> —
            Secure httpOnly session cookie that keeps you authenticated. Set on login, cleared on logout.
            Expires after 2 hours of inactivity (or 7 days if "Remember me" is selected).
            <em style={{ color: "var(--app-text-soft)" }}> Strictly necessary.</em>
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>cookie_prefs</strong> —
            Stores your cookie consent choices from the preference panel above. Set locally in{" "}
            <code>localStorage</code>, never sent to our servers.
            <em style={{ color: "var(--app-text-soft)" }}> Strictly necessary (preference storage).</em>
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>theme</strong> —
            Remembers your light/dark mode choice. Stored in <code>localStorage</code>.
            <em style={{ color: "var(--app-text-soft)" }}> Strictly necessary (UI preference).</em>
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>admin_sidebar_pinned</strong> —
            Remembers whether the admin panel sidebar is pinned open or collapsed. Stored in{" "}
            <code>localStorage</code>. Never sent to servers.
            <em style={{ color: "var(--app-text-soft)" }}> Strictly necessary (UI preference).</em>
          </li>
        </ul>
      </Section>

      <Section title="5. sessionStorage (Non-Persistent)">
        <p>
          We use <code>sessionStorage</code> for temporary in-browser state that is automatically cleared
          when you close the tab or browser. This includes:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={{ color: "var(--app-text)" }}>impersonating</strong> —
            When Arthaleads platform support enters a support session on your account, a temporary record
            is stored in <code>sessionStorage</code> so the support banner can display context. This is
            cleared the moment the session ends or the browser tab is closed. It is never persisted to
            our servers beyond the audit log entry.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>fup_panel_dismissed</strong> —
            Tracks whether you have dismissed the follow-up reminder panel during the current session.
          </li>
        </ul>
      </Section>

      <Section title="6. Third-Party Services">
        <p>
          We use a small number of trusted third-party services to operate the platform. These services
          may set their own cookies or store identifiers strictly to deliver their function:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>Cloudinary</strong> — Image and media hosting (org logos, blog images). No tracking cookies.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Firebase (Google)</strong> — Push notification delivery for Android app users. May store a device token.</li>
          <li><strong style={{ color: "var(--app-text)" }}>OpenAI</strong> — AI feature processing. API calls only; no browser-level cookies set by OpenAI in our platform.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Resend</strong> — Transactional email delivery. No browser cookies.</li>
        </ul>
        <p>We do not use Google Analytics, Facebook Pixel, or any behavioural advertising trackers.</p>
      </Section>

      <Section title="7. Managing Cookies in Your Browser">
        <p>
          In addition to the controls in Section 2, you can manage or delete cookies through your browser
          settings. Instructions for common browsers:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>Chrome:</strong> Settings → Privacy and security → Cookies and other site data.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Safari:</strong> Preferences → Privacy → Manage Website Data.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Firefox:</strong> Options → Privacy &amp; Security → Cookies and Site Data.</li>
        </ul>
        <p>
          Note: Disabling strictly necessary cookies will prevent you from logging into the CRM or using
          core platform features.
        </p>
      </Section>

      <Section title="8. DPDP Act 2023 Compliance">
        <p>
          Arthaleads is committed to compliance with India's Digital Personal Data Protection Act, 2023.
          In line with this:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We do not set non-essential cookies without your consent.</li>
          <li>We provide clear, granular controls to accept or reject each category of cookie.</li>
          <li>We do not use cookies to build behavioural advertising profiles or sell your data.</li>
          <li>You can withdraw consent and change your preferences at any time using the panel in Section 2.</li>
        </ul>
        <p>
          For details on how we handle personal data more broadly, see our{" "}
          <a href="/privacy" style={{ color: "var(--app-primary)" }} className="hover:underline">Privacy Policy</a>.
        </p>
      </Section>

      <Section title="9. Contact Us">
        <p>Questions about our use of cookies or data practices?</p>
        <ContactBox>
          <p className="font-bold mb-1" style={{ color: "var(--app-text)" }}>Arthaleads (Prophunt LLP)</p>
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
