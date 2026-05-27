// App.jsx
import { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PublicThemeProvider } from "./context/PublicThemeContext";
import Sidebar from "./components/Sidebar";
import AdminSidebar from "./components/AdminSidebar";
import ImpersonationBanner from "./components/ImpersonationBanner";
import { Spinner } from "./components/UI";
import ErrorBoundary from "./components/ErrorBoundary";
import { Download, X, Bell, Share } from "lucide-react";
import { subscribeToPush } from "./utils/pushNotifications";
import api from "./services/api";
import toast from "react-hot-toast";

// ── Phone Prompt Modal ────────────────────────────────────────────────────────
// Shows once per session to any logged-in user who hasn't added their phone yet.
// Lets them save it inline without navigating to Settings.
function PhonePromptModal() {
  const { user, updateUserState } = useAuth();
  const [phone, setPhone]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [visible, setVisible]     = useState(false);
  const [error, setError]         = useState("");

  // Show after a 2-second grace period to any user without a phone number
  useEffect(() => {
    if (!user) return;
    if (user.phone) return; // already has phone — never show
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, [user]);

  if (!visible) return null;

  const handleSave = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.put("/auth/me", { phone });
      updateUserState(data.user);
      setVisible(false);
      toast.success("Mobile number saved!");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-4 sm:p-0"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <div
        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4"
          style={{ background: "rgba(255,107,0,0.10)" }}>
          <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
          </svg>
        </div>

        <h2 className="text-lg font-black text-app text-center mb-1">Add your mobile number</h2>
        <p className="text-sm text-app-soft text-center mb-5 leading-relaxed">
          Your team needs your contact number for follow-up alerts and coordination. Takes 5 seconds.
        </p>

        <div className="space-y-3">
          <input
            type="tel"
            className="input w-full text-center text-base tracking-wider"
            placeholder="Enter 10-digit mobile number"
            value={phone}
            onChange={e => { setPhone(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
            maxLength={15}
          />
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !phone}
            className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Number"}
          </button>

        </div>
      </div>
    </div>
  );
}

// ── Page-level code splitting ─────────────────────────────────────────────────
// Each page is loaded only when first visited - reduces initial bundle ~50%
const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Spinner size="lg" />
  </div>
);

// ── Brand Colour ──────────────────────────────────────────────────────────────
// Applies a customer's hex accent colour as CSS-variable overrides so the
// entire UI theme switches without a page reload.  Passing "" or null resets
// back to the default orange palette defined in styles.css.
export function applyBrandColor(hex) {
  const root = document.documentElement;
  const VARS = ["--app-primary", "--app-primary-deep", "--app-primary-rgb", "--app-primary-deep-rgb"];

  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    VARS.forEach((v) => root.style.removeProperty(v));
    return;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Deep = darken ~37 % to match original #ff6b00 → #a04100 ratio
  const dr = Math.round(r * 0.627);
  const dg = Math.round(g * 0.627);
  const db = Math.round(b * 0.627);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  const deepHex = `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;

  root.style.setProperty("--app-primary",          hex);
  root.style.setProperty("--app-primary-deep",     deepHex);
  root.style.setProperty("--app-primary-rgb",      `${r}, ${g}, ${b}`);
  root.style.setProperty("--app-primary-deep-rgb", `${dr}, ${dg}, ${db}`);
}

// ── Detect iOS ────────────────────────────────────────────────────────────────
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
}

// ── PWA Install Banner ────────────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt]           = useState(null);
  const [showIOS, setShowIOS]         = useState(false);
  const [dismissed, setDismissed]     = useState(
    () => localStorage.getItem("pwa_dismissed") === "1"
  );

  useEffect(() => {
    // Already installed as PWA - don't show banner
    if (isInStandaloneMode()) return;

    // iOS: no beforeinstallprompt, show manual instructions after a short delay
    if (isIOS() && !dismissed) {
      const t = setTimeout(() => setShowIOS(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome - capture the native prompt
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const dismiss = () => {
    setDismissed(true);
    setShowIOS(false);
    setPrompt(null);
    localStorage.setItem("pwa_dismissed", "1");
  };

  const install = async () => {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setPrompt(null);
      setDismissed(true);
      localStorage.setItem("pwa_dismissed", "1");
    }
  };

  const bannerStyle = {
    background: "rgba(14,14,22,0.88)",
    backdropFilter: "blur(24px)",
    border: "1px solid rgba(255,107,0,0.25)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,107,0,0.08)",
  };

  // iOS manual instruction card
  if (showIOS && !dismissed) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm">
        <div className="flex flex-col gap-2 rounded-2xl px-4 py-3 shadow-xl" style={bannerStyle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#a04100] to-[#ff6b00]">
                <Share className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-white">Install Arthaleads</p>
            </div>
            <button onClick={dismiss} className="text-white/40 hover:text-white/70">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-white/70 leading-5">
            Tap the <span className="font-bold text-orange-400">Share</span> button (↑) in Safari, then tap <span className="font-bold text-orange-400">"Add to Home Screen"</span> to install the app.
          </p>
        </div>
      </div>
    );
  }

  // Android / Chrome native prompt
  if (!prompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl" style={bannerStyle}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#a04100] to-[#ff6b00]">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install Arthaleads</p>
          <p className="text-xs text-white/60">Add to home screen for quick access</p>
        </div>
        <button onClick={install}
          className="flex-shrink-0 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white">
          Install
        </button>
        <button onClick={dismiss} className="flex-shrink-0 text-white/40 hover:text-white/70">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Notification Permission Banner ────────────────────────────────────────────
// Shows a clear, clickable banner asking users to enable push notifications.
// Must be user-gesture triggered - silent requestPermission() is blocked by browsers.
function NotificationBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState(() => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission; // "default" | "granted" | "denied"
  });
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("notif_dismissed") === "1" ||
    sessionStorage.getItem("notif_shown") === "1"
  );
  const [enabling, setEnabling] = useState(false);

  // If already granted, silently ensure the subscription is saved to backend
  useEffect(() => {
    if (status === "granted" && user) {
      subscribeToPush().catch(() => {});
    }
  }, [status, user]);

  // Mark this session so banner doesn't reappear on every refresh.
  // User gets one prompt per session; permanent dismiss stores in localStorage.
  useEffect(() => {
    if (user && status === "default" && !dismissed) {
      sessionStorage.setItem("notif_shown", "1");
    }
  }, [user, status, dismissed]);

  if (!user) return null;
  if (status === "unsupported" || status === "granted" || status === "denied" || dismissed) return null;

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const perm = await Notification.requestPermission();
      setStatus(perm);
      if (perm === "granted") {
        await subscribeToPush();
      }
    } catch {
      // ignore
    } finally {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("notif_dismissed", "1");
  };

  const bannerStyle = {
    background: "rgba(14,14,22,0.88)",
    backdropFilter: "blur(24px)",
    border: status === "denied"
      ? "1px solid rgba(255,255,255,0.10)"
      : "1px solid rgba(255,107,0,0.25)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.50)",
  };

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm lg:left-auto lg:right-4 lg:translate-x-0">
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl" style={bannerStyle}>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
          status === "denied"
            ? "bg-white/10"
            : "bg-gradient-to-br from-[#a04100] to-[#ff6b00]"
        }`}>
          <Bell className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {status === "denied" ? (
            <>
              <p className="text-sm font-semibold text-white">Notifications blocked</p>
              <p className="text-xs text-white/60">Enable in browser settings → Site settings → Notifications</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Enable Notifications</p>
              <p className="text-xs text-white/60">Get alerts when leads are assigned to you</p>
            </>
          )}
        </div>
        {status !== "denied" && (
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="flex-shrink-0 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {enabling ? "…" : "Enable"}
          </button>
        )}
        <button onClick={handleDismiss} className="flex-shrink-0 text-white/40 hover:text-white/70">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const Landing        = lazy(() => import("./pages/Landing"));
const Login          = lazy(() => import("./pages/Login"));
const Signup         = lazy(() => import("./pages/Signup"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const Leads          = lazy(() => import("./pages/Leads"));
const LeadPipeline   = lazy(() => import("./pages/LeadPipeline"));
const Team           = lazy(() => import("./pages/Team"));
const Performance    = lazy(() => import("./pages/Performance"));
const Automation     = lazy(() => import("./pages/Automation"));
const Settings       = lazy(() => import("./pages/Settings"));
const HelpSupport    = lazy(() => import("./pages/HelpSupport"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const Privacy        = lazy(() => import("./pages/Privacy"));
const Terms          = lazy(() => import("./pages/Terms"));
const FbCallback     = lazy(() => import("./pages/FbCallback"));
const Projects       = lazy(() => import("./pages/Projects"));
const ProjectDetail  = lazy(() => import("./pages/ProjectDetail"));
const DumpLeads      = lazy(() => import("./pages/DumpLeads"));
const FollowUps      = lazy(() => import("./pages/FollowUps"));
const Attendance     = lazy(() => import("./pages/Attendance"));
const SuperAdmin     = lazy(() => import("./pages/SuperAdmin"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword"));
const PublicBlog     = lazy(() => import("./pages/PublicBlog"));
const PublicBlogPost = lazy(() => import("./pages/PublicBlogPost"));
const BlogManager    = lazy(() => import("./pages/BlogManager"));
const BlogEditor     = lazy(() => import("./pages/BlogEditor"));
const BlogCategories = lazy(() => import("./pages/BlogCategories"));
const BlogTags       = lazy(() => import("./pages/BlogTags"));
const AboutUs        = lazy(() => import("./pages/AboutUs"));
const CaseStudies    = lazy(() => import("./pages/CaseStudies"));
const ProductUpdates = lazy(() => import("./pages/ProductUpdates"));
const HelpGuide      = lazy(() => import("./pages/HelpGuide"));
const WordPressPlugin = lazy(() => import("./pages/WordPressPlugin"));
const Contact         = lazy(() => import("./pages/Contact"));
const ShareTarget     = lazy(() => import("./pages/ShareTarget"));
const Plans           = lazy(() => import("./pages/Plans"));
const AdminLogin            = lazy(() => import("./pages/AdminLogin"));
const SuperAdminHome        = lazy(() => import("./pages/SuperAdminHome"));
const SuperAdminUsers       = lazy(() => import("./pages/SuperAdminUsers"));
const SuperAdminTickets     = lazy(() => import("./pages/SuperAdminTickets"));
const SuperAdminAnalytics   = lazy(() => import("./pages/SuperAdminAnalytics"));
const SuperAdminBroadcast   = lazy(() => import("./pages/SuperAdminBroadcast"));
const SuperAdminOrgDetail   = lazy(() => import("./pages/SuperAdminOrgDetail"));
const SuperAdminAudit       = lazy(() => import("./pages/SuperAdminAudit"));
const SuperAdminRevenue     = lazy(() => import("./pages/SuperAdminRevenue"));

// ── Org Inactive overlay ──────────────────────────────────────────────────────
function OrgInactiveScreen({ onLogout }) {
  const SUPPORT_EMAIL = 'contact@arthaleads.com';
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Always white card so text is guaranteed readable in both dark and light mode */}
      <div className="max-w-sm w-full rounded-3xl p-8 text-center shadow-2xl" style={{ background: '#ffffff' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <svg className="w-8 h-8" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 115.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-xl font-black mb-2" style={{ color: '#111827' }}>Account Deactivated</h2>
        <p className="text-sm leading-relaxed mb-2" style={{ color: '#6b7280' }}>
          Your organisation's account has been deactivated. Please contact Arthaleads support to restore access.
        </p>
        <p className="text-sm font-semibold mb-6" style={{ color: '#FF6B00' }}>{SUPPORT_EMAIL}</p>
        <a
          href={"mailto:" + SUPPORT_EMAIL + "?subject=Account%20Deactivated%20-%20Restore%20Access&body=Hello%20Arthaleads%20Support%2C%0A%0AMy%20organization%20account%20has%20been%20deactivated.%20Please%20help%20restore%20access.%0A%0AOrganization%3A%20%0AContact%20Name%3A%20"}
          className="block w-full py-3 rounded-2xl font-semibold text-sm mb-3 transition hover:opacity-90 text-center"
          style={{ background: '#FF6B00', color: '#ffffff' }}>
          Contact Support
        </a>
        <button onClick={onLogout}
          className="block w-full py-2.5 rounded-2xl text-sm transition hover:underline"
          style={{ color: '#6b7280' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Trial Expired overlay ─────────────────────────────────────────────────────
function TrialExpiredScreen({ onLogout }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="max-w-md w-full rounded-3xl p-8 text-center shadow-2xl"
        style={{ background: "var(--app-surface)", border: "1px solid rgba(255,107,0,0.35)" }}>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-[#FF6B00]/10 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-2xl font-black text-app mb-2">Your Free Trial Has Ended</h2>
        <p className="text-sm text-app-soft leading-relaxed mb-1">
          Your 14-day free trial has expired. Upgrade to a paid plan to continue managing your leads and team without interruption.
        </p>
        <p className="text-xs text-app-soft mb-6">
          All your data is safe and will be restored immediately on upgrade.
        </p>

        {/* Primary — WhatsApp */}
        <a href="https://wa.me/918080197945?text=Hi%2C%20my%20Arthaleads%20trial%20has%20expired.%20I%27d%20like%20to%20upgrade%20my%20plan."
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 w-full py-3 rounded-2xl text-white font-semibold text-sm mb-3 transition hover:opacity-90 shadow-lg"
          style={{ background: "#25D366" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Chat on WhatsApp
        </a>

        {/* Secondary — Email */}
        <a href="mailto:contact@arthaleads.com?subject=Upgrade%20Arthaleads%20Plan&body=Hi%2C%20my%20trial%20has%20expired.%20I%27d%20like%20to%20upgrade."
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold mb-3 transition"
          style={{ background: "rgba(255,107,0,0.08)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.2)" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,107,0,0.14)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,107,0,0.08)"}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email Us to Upgrade
        </a>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
          <span className="text-xs text-app-muted">or</span>
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
        </div>

        <button onClick={onLogout}
          className="block w-full py-2.5 rounded-2xl text-app-soft text-sm hover:text-app transition cursor-pointer">
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────────

function RequireAuth() {
  const { user, org, loading, logout } = useAuth();
  const [orgInactive,      setOrgInactive]      = useState(false);
  const [trialExpiredFlag, setTrialExpiredFlag] = useState(false);

  // Apply (or clear) the org's custom brand colour whenever it changes
  useEffect(() => { applyBrandColor(org?.brandColor); }, [org?.brandColor]);

  // Listen for blocking 403 events fired by the API interceptor / AuthContext
  useEffect(() => {
    const onInactive = () => setOrgInactive(true);
    const onTrial    = () => setTrialExpiredFlag(true);
    window.addEventListener("org:inactive",  onInactive);
    window.addEventListener("trial:expired", onTrial);
    return () => {
      window.removeEventListener("org:inactive",  onInactive);
      window.removeEventListener("trial:expired", onTrial);
    };
  }, []);

  const handleLogout = () => { logout(); window.location.href = "/login"; };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Super admin has no org — send to their own panel
  if (user.role === "super_admin") return <Navigate to="/super-admin" replace />;

  // Check if org is set to inactive by super admin (also caught by API interceptor above)
  const isInactive = orgInactive || (org && org.isActive === false);

  // Check trial expiry — client-side (cached org data) OR server-confirmed via event
  const trialExpired = trialExpiredFlag
    || (user.role !== "super_admin"
        && org?.plan === "trial"
        && org?.trialEndsAt
        && new Date() > new Date(org.trialEndsAt));

  return (
    <div className="flex h-screen overflow-hidden text-app" style={{ background: "transparent" }}>
      <ImpersonationBanner />
      <Sidebar />
      <main className="flex-1 min-w-0 pt-16 lg:pt-0 overflow-y-auto">
        <Outlet />
      </main>
      {/* Notification permission prompt - only shows if permission not yet granted */}
      <NotificationBanner />
      {/* Phone number prompt - shows once per session to users missing a phone */}
      <PhonePromptModal />
      {/* Blocking overlays - rendered on top of everything */}
      {isInactive   && <OrgInactiveScreen   onLogout={handleLogout} />}
      {!isInactive && trialExpired && <TrialExpiredScreen onLogout={handleLogout} />}
    </div>
  );
}

function RequireRole({ roles }) {
  const { user } = useAuth();
  // super_admin bypasses all role gates
  if (user?.role === "super_admin" || roles.includes(user?.role)) return <Outlet />;
  return <Navigate to="/dashboard" replace />;
}

function RedirectIfAuth() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === "super_admin" ? "/super-admin" : "/dashboard"} replace />;
  return <Outlet />;
}

// ── Admin Layout ─────────────────────────────────────────────────────────────
// Clean layout for the super admin panel — sidebar + scrollable main
function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--app-bg)" }}>
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

// Guards super admin routes — must be logged in AND be super_admin
function RequireAdmin() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  if (!user) return <Navigate to="/admin-login" replace />;
  if (user.role !== "super_admin") return <Navigate to="/dashboard" replace />;
  return <AdminLayout />;
}

// / route: logged-in users → dashboard, guests → Landing marketing page
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  if (user) return <Navigate to={user.role === "super_admin" ? "/super-admin" : "/dashboard"} replace />;
  return <Landing />;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <PublicThemeProvider>
    <AuthProvider>
      <ErrorBoundary>
      <InstallBanner />
      <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Landing - guest sees homepage, logged-in user goes to dashboard */}
        <Route path="/" element={<RootRoute />} />

        {/* Fully public - no auth needed */}
        <Route path="/privacy"              element={<Privacy />} />
        <Route path="/terms"                element={<Terms />} />
        <Route path="/fb-callback"          element={<FbCallback />} />
        <Route path="/forgot-password"      element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/blog"                 element={<PublicBlog />} />
        <Route path="/blog/:slug"           element={<PublicBlogPost />} />
        <Route path="/about-us"             element={<AboutUs />} />
        <Route path="/case-studies"         element={<CaseStudies />} />
        <Route path="/product-updates"      element={<ProductUpdates />} />
        <Route path="/help-guide"           element={<HelpGuide />} />
        <Route path="/wordpress-plugin"     element={<WordPressPlugin />} />
        <Route path="/contact"              element={<Contact />} />
        <Route path="/share-target"         element={<ShareTarget />} />

        {/* Public routes - redirect to dashboard if already logged in */}
        <Route element={<RedirectIfAuth />}>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* Admin login - always public (separate from org login) */}
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads"     element={<Leads />} />
          <Route path="/pipeline"  element={<LeadPipeline />} />
          <Route path="/settings"      element={<Settings />} />
          <Route path="/help-support"  element={<HelpSupport />} />
          <Route path="/projects"      element={<Projects />} />
          <Route path="/projects/:id"  element={<ProjectDetail />} />
          <Route path="/followups"     element={<FollowUps />} />
          <Route path="/attendance"    element={<Attendance />} />
          <Route path="/plans"         element={<Plans />} />

          {/* Admin only */}
          <Route element={<RequireRole roles={["admin"]} />}>
            <Route path="/team" element={<Team />} />
          </Route>

          {/* Admin + Manager only */}
          <Route element={<RequireRole roles={["admin", "manager"]} />}>
            <Route path="/automation"  element={<Automation />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/dump-leads"  element={<DumpLeads />} />
          </Route>

        </Route>

        {/* Super Admin routes — own layout with AdminSidebar */}
        <Route element={<RequireAdmin />}>
          <Route path="/super-admin"                    element={<SuperAdminHome />} />
          <Route path="/super-admin/orgs"               element={<SuperAdmin />} />
          <Route path="/super-admin/users"              element={<SuperAdminUsers />} />
          <Route path="/super-admin/tickets"            element={<SuperAdminTickets />} />
          <Route path="/super-admin/analytics"          element={<SuperAdminAnalytics />} />
          <Route path="/super-admin/revenue"            element={<SuperAdminRevenue />} />
          <Route path="/super-admin/broadcast"          element={<SuperAdminBroadcast />} />
          <Route path="/super-admin/audit"              element={<SuperAdminAudit />} />
          <Route path="/super-admin/orgs/:id"           element={<SuperAdminOrgDetail />} />
          <Route path="/super-admin/blog"               element={<BlogManager />} />
          <Route path="/super-admin/blog/new"           element={<BlogEditor />} />
          <Route path="/super-admin/blog/categories"    element={<BlogCategories />} />
          <Route path="/super-admin/blog/tags"          element={<BlogTags />} />
          <Route path="/super-admin/blog/:id/edit"      element={<BlogEditor />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </AuthProvider>
    </PublicThemeProvider>
  );
}
