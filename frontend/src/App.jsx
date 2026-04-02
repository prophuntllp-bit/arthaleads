// App.jsx
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import { Spinner } from "./components/UI";

import Login        from "./pages/Login";
import Signup       from "./pages/Signup";
import Dashboard    from "./pages/Dashboard";
import Leads        from "./pages/Leads";
import LeadPipeline from "./pages/LeadPipeline";
import Team         from "./pages/Team";
import Performance  from "./pages/Performance";
import Automation   from "./pages/Automation";
import Settings     from "./pages/Settings";
import HelpSupport  from "./pages/HelpSupport";
import NotFound     from "./pages/NotFound";

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
    <div className="flex min-h-screen bg-app text-app">
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
      <Routes>
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
          <Route path="/settings"  element={<Settings />} />
          <Route path="/help-support" element={<HelpSupport />} />

          {/* Admin only */}
          <Route element={<RequireRole roles={["admin"]} />}>
            <Route path="/team" element={<Team />} />
          </Route>

          {/* Admin + Manager only */}
          <Route element={<RequireRole roles={["admin", "manager"]} />}>
            <Route path="/automation" element={<Automation />} />
            <Route path="/performance" element={<Performance />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
