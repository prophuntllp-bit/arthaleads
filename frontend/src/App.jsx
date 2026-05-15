// App.jsx
import { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PublicThemeProvider } from "./context/PublicThemeContext";
import Sidebar from "./components/Sidebar";
import { Spinner } from "./components/UI";
import ErrorBoundary from "./components/ErrorBoundary";
import { Download, X, Bell, Share } from "lucide-react";
import { subscribeToPush } from "./utils/pushNotifications";
import CursorGlow from "./components/CursorGlow";

// ── Page-level code splitting ─────────────────────────────────────────────────
// Each page is loaded only when first visited — reduces initial bundle ~50%
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
    // Already installed as PWA — don't show banner
    if (isInStandaloneMode()) return;

    // iOS: no beforeinstallprompt, show manual instructions after a short delay
    if (isIOS() && !dismissed) {
      const t = setTimeout(() => setShowIOS(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome — capture the native prompt
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
// Must be user-gesture triggered — silent requestPermission() is blocked by browsers.
function NotificationBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState(() => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission; // "default" | "granted" | "denied"
  });
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("notif_dismissed") === "1"
  );
  const [enabling, setEnabling] = useState(false);

  // If already granted, silently ensure the subscription is saved to backend
  useEffect(() => {
    if (status === "granted" && user) {
      subscribeToPush().catch(() => {});
    }
  }, [status, user]);

  if (!user) return null;
  if (status === "unsupported" || status === "granted" || dismissed) return null;

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
const AboutUs        = lazy(() => import("./pages/AboutUs"));
const CaseStudies    = lazy(() => import("./pages/CaseStudies"));
const ProductUpdates = lazy(() => import("./pages/ProductUpdates"));
const HelpGuide      = lazy(() => import("./pages/HelpGuide"));
const WordPressPlugin = lazy(() => import("./pages/WordPressPlugin"));
const Contact         = lazy(() => import("./pages/Contact"));

// ── Org Inactive overlay ──────────────────────────────────────────────────────
function OrgInactiveScreen({ onLogout }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="max-w-sm w-full rounded-3xl p-8 text-center shadow-2xl"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-app mb-2">Account Deactivated</h2>
        <p className="text-sm text-app-soft leading-relaxed mb-6">
          Your organisation's account has been deactivated by an administrator. Please contact Arthaleads support to restore access.
        </p>
        <a href="mailto:contact@arthaleads.com"
          className="block w-full py-3 rounded-2xl bg-[#FF6B00] text-white font-semibold text-sm mb-3 hover:bg-[#e05f00] transition">
          Contact Support
        </a>
        <button onClick={onLogout}
          className="block w-full py-2.5 rounded-2xl text-app-soft text-sm hover:text-app transition">
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Trial Expired overlay ─────────────────────────────────────────────────────
function TrialExpiredScreen({ onLogout }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="max-w-sm w-full rounded-3xl p-8 text-center shadow-2xl"
        style={{ background: "var(--app-surface)", border: "1px solid rgba(255,107,0,0.3)" }}>
        <div className="w-16 h-16 rounded-full bg-[#FF6B00]/10 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-app mb-2">Your Free Trial Has Ended</h2>
        <p className="text-sm text-app-soft leading-relaxed mb-1">
          Your 7-day free trial has expired. Upgrade to a paid plan to continue managing your leads and team without interruption.
        </p>
        <p className="text-xs text-app-soft mb-6">All your data is safe and will be restored immediately on upgrade.</p>
        <a href="mailto:contact@arthaleads.com?subject=Upgrade%20Arthaleads%20Plan"
          className="block w-full py-3 rounded-2xl bg-[#FF6B00] text-white font-semibold text-sm mb-3 hover:bg-[#e05f00] transition shadow-lg shadow-orange-500/20">
          Contact Us to Upgrade
        </a>
        <button onClick={onLogout}
          className="block w-full py-2.5 rounded-2xl text-app-soft text-sm hover:text-app transition">
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────────

function RequireAuth() {
  const { user, org, loading, logout } = useAuth();
  const [orgInactive, setOrgInactive] = useState(false);

  // Apply (or clear) the org's custom brand colour whenever it changes
  useEffect(() => { applyBrandColor(org?.brandColor); }, [org?.brandColor]);

  // Listen for org-inactive event fired by the API interceptor
  useEffect(() => {
    const handler = () => setOrgInactive(true);
    window.addEventListener("org:inactive", handler);
    return () => window.removeEventListener("org:inactive", handler);
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

  // Check if org is set to inactive by super admin (also caught by API interceptor above)
  const isInactive = orgInactive || (org && org.isActive === false);

  // Check trial expiry (only for non-super_admin, on trial plan)
  const trialExpired = user.role !== "super_admin"
    && org?.plan === "trial"
    && org?.trialEndsAt
    && new Date() > new Date(org.trialEndsAt);

  return (
    <div className="flex min-h-screen text-app" style={{ background: "transparent" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 pt-16 lg:pt-0 overflow-y-auto">
        <Outlet />
      </main>
      {/* Notification permission prompt — only shows if permission not yet granted */}
      <NotificationBanner />
      {/* Blocking overlays — rendered on top of everything */}
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
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

// Always show the landing page at / — logged-in users can still visit the homepage
function RootRoute() {
  const { loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  return <Landing />;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <PublicThemeProvider>
    <AuthProvider>
      <ErrorBoundary>
      <CursorGlow />
      <InstallBanner />
      <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Landing — guest sees homepage, logged-in user goes to dashboard */}
        <Route path="/" element={<RootRoute />} />

        {/* Fully public — no auth needed */}
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

        {/* Public routes — redirect to dashboard if already logged in */}
        <Route element={<RedirectIfAuth />}>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

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

          {/* Super Admin only */}
          <Route element={<RequireRole roles={["super_admin"]} />}>
            <Route path="/super-admin"                    element={<SuperAdmin />} />
            <Route path="/super-admin/blog"               element={<BlogManager />} />
            <Route path="/super-admin/blog/new"           element={<BlogEditor />} />
            <Route path="/super-admin/blog/:id/edit"      element={<BlogEditor />} />
          </Route>
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
