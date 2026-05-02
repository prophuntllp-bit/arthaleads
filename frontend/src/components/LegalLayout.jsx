import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ── Shared layout for Terms and Privacy pages ─────────────────────────────────
export default function LegalLayout({ title, badge, updated, children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--app-bg)" }}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-4 px-6 py-4"
        style={{
          background: "var(--app-surface)",
          borderBottom: "1px solid var(--app-border)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="Arthaleads" className="h-8 w-8 rounded-xl" />
          <span className="hidden sm:block font-bold text-base text-app">
            Artha<span style={{ color: "var(--app-primary)" }}>leads</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-2">
          <Link
            to="/terms"
            className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition"
            style={{
              background: title === "Terms of Service" ? "rgba(var(--app-primary-rgb),0.12)" : "transparent",
              color: title === "Terms of Service" ? "var(--app-primary)" : "var(--app-text-soft)",
            }}
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition"
            style={{
              background: title === "Privacy Policy" ? "rgba(var(--app-primary-rgb),0.12)" : "transparent",
              color: title === "Privacy Policy" ? "var(--app-primary)" : "var(--app-text-soft)",
            }}
          >
            Privacy
          </Link>

          <div className="h-4 w-px mx-1 hidden sm:block" style={{ background: "var(--app-border)" }} />

          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition"
              style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition"
              style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
            >
              Sign In
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-6 py-14">

        {/* Badge + Title */}
        <div className="mb-10">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-4"
            style={{
              background: "rgba(var(--app-primary-rgb), 0.10)",
              color: "var(--app-primary)",
              border: "1px solid rgba(var(--app-primary-rgb), 0.18)",
            }}
          >
            {badge}
          </span>
          <h1
            className="text-4xl font-black tracking-tight mb-3"
            style={{ color: "var(--app-text)" }}
          >
            {title}
          </h1>
          <p className="text-sm" style={{ color: "var(--app-text-soft)" }}>
            Last updated: <strong style={{ color: "var(--app-text)" }}>{updated}</strong>
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {children}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        className="mt-16 py-8 text-center text-xs"
        style={{
          borderTop: "1px solid var(--app-border)",
          color: "var(--app-text-soft)",
        }}
      >
        <p className="mb-2">
          © {new Date().getFullYear()} <strong style={{ color: "var(--app-text)" }}>Arthaleads</strong>
          {" "}· Prophunt LLP · Pune, India
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/terms" className="hover:underline" style={{ color: "var(--app-primary)" }}>Terms of Service</Link>
          <span style={{ color: "var(--app-border-strong)" }}>·</span>
          <Link to="/privacy" className="hover:underline" style={{ color: "var(--app-primary)" }}>Privacy Policy</Link>
          <span style={{ color: "var(--app-border-strong)" }}>·</span>
          <a href="mailto:hello@arthaleads.com" className="hover:underline" style={{ color: "var(--app-primary)" }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}

// ── Section component ─────────────────────────────────────────────────────────
export function Section({ title, children }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-5 w-1 rounded-full shrink-0"
          style={{ background: "var(--app-primary)" }}
        />
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--app-text)" }}
        >
          {title}
        </h2>
      </div>
      <div
        className="pl-4 text-sm leading-7 space-y-3"
        style={{
          color: "var(--app-text-soft)",
          borderLeft: "1px solid var(--app-border)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ── Contact info box ──────────────────────────────────────────────────────────
export function ContactBox({ children }) {
  return (
    <div
      className="mt-4 rounded-2xl p-5 text-sm"
      style={{
        background: "var(--app-surface-low)",
        border: "1px solid var(--app-border)",
      }}
    >
      {children}
    </div>
  );
}
