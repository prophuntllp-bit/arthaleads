// components/Sidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, UserCheck, Settings,
  LogOut, Menu, X, Kanban, MoonStar, SunMedium, LifeBuoy, BarChart3, Workflow, FolderKanban, Archive, Bell, CalendarClock, Clock, LogIn as LogInIcon
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { fmtDate } from "../utils/constants";
import toast from "react-hot-toast";
// subscribeToPush is now handled by NotificationBanner in App.jsx (requires user gesture)

const navItems = [
  { to: "/",            label: "Dashboard",    icon: LayoutDashboard },
  { to: "/leads",       label: "Leads",        icon: Users },
  { to: "/pipeline",    label: "Pipeline",     icon: Kanban },
  { to: "/projects",    label: "Projects",     icon: FolderKanban },
  { to: "/followups",   label: "Follow Ups",   icon: CalendarClock },
  { to: "/attendance",  label: "Attendance",   icon: Clock },
  { to: "/dump-leads",  label: "Dump Leads",   icon: Archive, roles: ["admin", "manager"] },
  { to: "/team",        label: "Team",         icon: UserCheck, roles: ["admin"] },
  { to: "/automation",  label: "Automation",   icon: Workflow, roles: ["admin", "manager"] },
  { to: "/performance", label: "Performance",  icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/settings",    label: "Settings",     icon: Settings },
  { to: "/help-support", label: "Help & Support", icon: LifeBuoy },
];

// Live elapsed clock timer — recalculates correctly when `since` arrives async
function useLiveClock(since) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!since) { setSecs(0); return; }
    // Seed with real elapsed time whenever `since` changes (e.g. after API fetch)
    setSecs(Math.floor((Date.now() - new Date(since)) / 1000));
    const iv = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [since]);
  if (!since) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 80, left: 268, right: undefined });
  const alertRef = useRef(null);
  const mobileBellRef = useRef(null);
  const mobileSidebarRef = useRef(null);
  const lastSeenRef = useRef(parseInt(localStorage.getItem("crm_alerts_seen") || "0", 10));

  // ── Clock In / Out state ──────────────────────────────────────────────────
  const [clockStatus, setClockStatus] = useState(null); // null | attendance doc
  const [clocking, setClocking] = useState(false);
  const clockTimer = useLiveClock(clockStatus?.clockIn && !clockStatus?.clockOut ? clockStatus.clockIn : null);

  const fetchClockStatus = useCallback(() => {
    if (!user) return;
    api.get("/attendance/status").then(r => setClockStatus(r.data.data)).catch(() => {});
  }, [user]);

  useEffect(() => { fetchClockStatus(); }, [fetchClockStatus]);

  const handleClockIn = async () => {
    setClocking(true);
    try {
      const r = await api.post("/attendance/clockin");
      setClockStatus(r.data.data);
      toast.success("Clocked in!");
    } catch (e) { toast.error(e.response?.data?.message || "Clock in failed"); }
    finally { setClocking(false); }
  };

  const handleClockOut = async () => {
    setClocking(true);
    try {
      const r = await api.post("/attendance/clockout");
      setClockStatus(r.data.data);
      toast.success("Clocked out! Great work today.");
    } catch (e) { toast.error(e.response?.data?.message || "Clock out failed"); }
    finally { setClocking(false); }
  };

  // Prevent background page scroll while sidebar is open.
  // Strategy: block touchmove on document UNLESS the touch originates inside
  // the sidebar panel — that lets the nav scroll freely on iOS/Android.
  // Also block wheel events on the body for desktop.
  useEffect(() => {
    if (!open) return;

    const preventScroll = (e) => {
      if (mobileSidebarRef.current && mobileSidebarRef.current.contains(e.target)) return;
      e.preventDefault();
    };

    const prevWheelBody = (e) => {
      if (mobileSidebarRef.current && mobileSidebarRef.current.contains(e.target)) return;
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("wheel",     prevWheelBody, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventScroll);
      document.removeEventListener("wheel",     prevWheelBody);
    };
  }, [open]);

  useEffect(() => {
    if (!user) return;
    const fetchAlerts = () => {
      api.get("/leads/alerts")
        .then((r) => {
          const data = r.data.data || [];
          setAlerts(data);
          const newCount = data.filter(
            (l) => new Date(l.createdAt).getTime() > lastSeenRef.current
          ).length;
          setAlertCount(newCount);
        })
        .catch(() => {});
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Push subscription is handled by NotificationBanner in App.jsx

  // Close alerts panel on outside click
  useEffect(() => {
    const handler = (e) => {
      const inDesktop = alertRef.current?.contains(e.target);
      const inMobile = mobileBellRef.current?.contains(e.target);
      // Also check if click is inside the portal dropdown
      const dropdown = document.getElementById("alerts-portal-dropdown");
      const inDropdown = dropdown?.contains(e.target);
      if (!inDesktop && !inMobile && !inDropdown) setAlertOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openAlerts = (e) => {
    const newOpen = !alertOpen;
    if (newOpen && e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      // Position dropdown: on mobile (< 1024) anchor to button bottom-right; desktop anchor to button right+8
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        // Anchor to right edge of screen, just below topbar
        setDropdownPos({ top: rect.bottom + 6, left: undefined, right: 8 });
      } else {
        setDropdownPos({ top: rect.top, left: rect.right + 8, right: undefined });
      }
    }
    setAlertOpen(newOpen);
    if (newOpen) {
      const now = Date.now();
      localStorage.setItem("crm_alerts_seen", String(now));
      lastSeenRef.current = now;
      setAlertCount(0);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filtered = navItems.filter(
    (n) => !n.roles || n.roles.includes(user?.role)
  );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-5 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg mb-3">
          <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
        </div>
        <p className="font-black text-base leading-none tracking-tight">
          <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span style={{ display: "block", width: 16, height: 1.5, background: "#FF6B00", borderRadius: 1 }} />
          <p className="text-[8px] font-semibold tracking-[0.15em] text-app-soft uppercase">Turning Opportunities Into Value</p>
          <span style={{ display: "block", width: 16, height: 1.5, background: "#FF6B00", borderRadius: 1 }} />
        </div>
      </div>

      {/* Alerts bell - desktop sidebar */}
      <div className="px-3 pb-2">
        <div ref={alertRef}>
          <button
            onClick={openAlerts}
            className="relative w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Bell className="w-4 h-4 flex-shrink-0" />
            Alerts
            {alertCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {filtered.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                isActive
                  ? "text-orange-500 bg-orange-500/10 border-r-2 border-orange-500"
                  : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-4 space-y-3">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between rounded-2xl px-4 py-3 border transition"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
        >
          <span className="flex items-center gap-3 text-sm font-medium">
            {isDark ? <MoonStar className="w-4 h-4 text-orange-500" /> : <SunMedium className="w-4 h-4 text-orange-500" />}
            {theme === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
          <span className="stitch-kicker">{theme}</span>
        </button>

        <div className="rounded-[1.35rem] px-4 py-4 shell-panel">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-app">{user?.name}</p>
              <p className="text-xs capitalize text-app-soft">{user?.role}</p>
            </div>
          </div>

          {/* ── Clock In / Out button ── */}
          {(() => {
            const isClockedIn  = clockStatus?.clockIn && !clockStatus?.clockOut;
            const isClockedOut = clockStatus?.clockIn && clockStatus?.clockOut;
            return (
              <div className="mb-2">
                {isClockedOut ? (
                  <div className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                    <Clock className="w-3.5 h-3.5 text-app-soft flex-shrink-0" />
                    <span className="text-app-soft">Done today</span>
                  </div>
                ) : isClockedIn ? (
                  <button
                    onClick={handleClockOut}
                    disabled={clocking}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-xl transition-all font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{clockTimer || "Active"}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-red-400">Clock Out</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClockIn}
                    disabled={clocking}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-xl transition-all font-semibold text-green-600 hover:bg-green-500/10 disabled:opacity-60"
                  >
                    <LogInIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">Clock In</span>
                  </button>
                )}
              </div>
            );
          })()}

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-xl transition-all text-app-soft hover:text-red-500 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  // Single portal-rendered alerts dropdown — escapes backdrop-filter stacking context
  const AlertsPortal = alertOpen ? createPortal(
    <>
      {/* Scrim — closes on outside click, keeps popup visually separated */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.18)" }}
        onClick={() => setAlertOpen(false)}
      />
      <div
        id="alerts-portal-dropdown"
        className="w-80 max-h-[70vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          position: "fixed",
          top: dropdownPos.top,
          ...(dropdownPos.right !== undefined
            ? { right: dropdownPos.right }
            : { left: dropdownPos.left }),
          zIndex: 9999,
          background: isDark ? "rgb(30, 29, 32)" : "rgb(255, 255, 255)",
          border: "1px solid var(--app-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.15)",
        }}
      >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--app-border)" }}>
        <p className="text-sm font-bold text-app">New Lead Alerts</p>
        <span className="stitch-kicker">{alerts.length} in last 7 days</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {alerts.length === 0 ? (
          <p className="p-4 text-xs text-app-soft text-center">No new leads yet</p>
        ) : alerts.map((lead) => (
          <button
            key={lead._id}
            className="w-full flex items-start gap-3 px-4 py-3 border-b hover:bg-orange-500/5 transition text-left cursor-pointer"
            style={{ borderColor: "var(--app-border)" }}
            onClick={() => { setAlertOpen(false); navigate("/leads", { state: { openLeadId: lead._id } }); }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold">
              {lead.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-app truncate">{lead.name}</p>
              <p className="text-[11px] text-app-soft">{lead.phone} · <span className="text-orange-500">{lead.source}</span></p>
              <p className="text-[10px] text-app-soft mt-0.5">{fmtDate(lead.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>
      <button
        className="px-4 py-2.5 text-xs font-semibold text-orange-500 border-t hover:bg-orange-500/5 transition text-center"
        style={{ borderColor: "var(--app-border)" }}
        onClick={() => { setAlertOpen(false); navigate("/leads"); }}
      >View All Leads →</button>
    </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      {AlertsPortal}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between border-b sidebar-glass"
        style={{ borderColor: "var(--app-border)" }}>
        {/* Clickable logo → home */}
        <NavLink to="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow">
            <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
          </div>
          <span className="font-black text-sm tracking-tight text-app">Arthaleads</span>
        </NavLink>
        <div className="flex items-center gap-2">
          <div ref={mobileBellRef}>
            <button
              onClick={openAlerts}
              className="relative p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5"
              title="New lead alerts"
            >
              <Bell className="w-5 h-5" />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white animate-pulse">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </button>
          </div>
          <button onClick={() => setOpen(!open)} className="p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      <div
        ref={mobileSidebarRef}
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-40 w-72 transform transition-transform duration-200 sidebar-glass flex flex-col ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ overscrollBehavior: "contain" }}
      >
        {NavContent()}
      </div>

      <aside
        className="hidden lg:flex flex-col w-64 h-screen sticky top-0 flex-shrink-0 sidebar-glass"
      >
        {NavContent()}
      </aside>
    </>
  );
}
