import { useEffect } from "react";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";

// ── Shared layout for Terms and Privacy pages ─────────────────────────────────
export default function LegalLayout({ title, badge, updated, children }) {
  const { isDark } = usePublicTheme();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const bg      = isDark ? "#0d0d1a" : "#f9fafb";
  const cardBg  = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const border  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const heading = isDark ? "#ffffff" : "#111827";
  const soft    = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      <PublicNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Title card */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: "1rem", padding: "2rem", marginBottom: "2rem" }}>
          <span style={{ background: "#ff6b00", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {badge}
          </span>
          <h1 style={{ color: heading, fontSize: "2rem", fontWeight: 900, marginTop: "0.75rem", marginBottom: "0.25rem" }}>{title}</h1>
          <p style={{ color: soft, fontSize: "13px" }}>Last updated: {updated}</p>
        </div>

        {/* Content */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: "1rem", padding: "2rem" }}>
          {children}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// ── Section component ─────────────────────────────────────────────────────────
export function Section({ title, children }) {
  const { isDark } = usePublicTheme();
  const heading = isDark ? "#ffffff" : "#111827";
  const text    = isDark ? "rgba(255,255,255,0.7)" : "#374151";

  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2 style={{ color: heading, fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.75rem" }}>{title}</h2>
      <div style={{ color: text, fontSize: "14px", lineHeight: "1.75" }}>{children}</div>
    </div>
  );
}

// ── Contact info box ──────────────────────────────────────────────────────────
export function ContactBox({ children }) {
  const { isDark } = usePublicTheme();
  return (
    <div style={{
      background: isDark ? "rgba(255,107,0,0.08)" : "#fff7f0",
      border: `1px solid ${isDark ? "rgba(255,107,0,0.2)" : "#fed7aa"}`,
      borderRadius: "0.75rem",
      padding: "1.25rem",
      fontSize: "14px",
      color: isDark ? "rgba(255,255,255,0.8)" : "#374151",
    }}>
      {children}
    </div>
  );
}
