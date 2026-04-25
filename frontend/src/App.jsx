// App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import { Spinner } from "./components/UI";
import { Download, X, Bell, Share } from "lucide-react";
import { subscribeToPush } from "./utils/pushNotifications";

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

import Login        from "./pages/Login";
import Signup       from "./pages/Signup";
import Dashboard    from "./pages/Dashboard";
import Leads        from "./pages/Leads";
import LeadPipeline from "./pages/LeadPipeline";
import Team         from "./pages/Team";
import Performance  from "./pages/Performance";
import Automation   from "./pages/Automation";
import Settings      from "./pages/Settings";
import HelpSupport   from "./pages/HelpSupport";
import NotFound      from "./pages/NotFound";
import Privacy       from "./pages/Privacy";
import Terms         from "./pages/Terms";
import FbCallback    from "./pages/FbCallback";
import Projects      from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import DumpLeads     from "./pages/DumpLeads";
import FollowUps     from "./pages/FollowUps";

// ── Route guards ──────────────────────────────────────────────────────────────

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen text-app" style={{ background: "transparent" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 pt-16 lg:pt-0 overflow-y-auto">
        <Outlet />
      </main>
      {/* Notification permission prompt — only shows if permission not yet granted */}
      <NotificationBanner />
    </div>
  );
}

function RequireRole({ roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RedirectIfAuth() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <InstallBanner />
      <Routes>
        {/* Fully public — no auth needed */}
        <Route path="/privacy"     element={<Privacy />} />
        <Route path="/terms"       element={<Terms />} />
        <Route path="/fb-callback" element={<FbCallback />} />

        {/* Public routes */}
        <Route element={<RedirectIfAuth />}>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/leads"     element={<Leads />} />
          <Route path="/pipeline"  element={<LeadPipeline />} />
          <Route path="/settings"      element={<Settings />} />
          <Route path="/help-support"  element={<HelpSupport />} />
          <Route path="/projects"      element={<Projects />} />
          <Route path="/projects/:id"  element={<ProjectDetail />} />
          <Route path="/followups"     element={<FollowUps />} />

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

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
