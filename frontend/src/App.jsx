// App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import { Spinner } from "./components/UI";
import { Download, X } from "lucide-react";

function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa_dismissed") === "1"
  );

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  const install = async () => {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setPrompt(null);
      setDismissed(true);
      localStorage.setItem("pwa_dismissed", "1");
    }
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa_dismissed", "1");
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl"
        style={{
          background: "rgba(14,14,22,0.88)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,107,0,0.25)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,107,0,0.08)"
        }}>
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
import Projects      from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import DumpLeads     from "./pages/DumpLeads";

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
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms"   element={<Terms />} />

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
