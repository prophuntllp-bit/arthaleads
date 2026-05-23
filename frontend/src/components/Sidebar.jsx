// components/Sidebar.jsx
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, UserCheck, Settings,
  LogOut, Menu, X, Kanban, MoonStar, SunMedium, LifeBuoy, BarChart3, Workflow, FolderKanban, Archive, Bell, CalendarClock, Clock, LogIn as LogInIcon, ShieldCheck, PenLine, ChevronDown, Tag, FileText, Plus, List,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { fmtDate, fmtDateTime } from "../utils/constants";
import toast from "react-hot-toast";
// subscribeToPush is now handled by NotificationBanner in App.jsx (requires user gesture)

const navItems = [
  { to: "/super-admin", label: "Super Admin",  icon: ShieldCheck, roles: ["super_admin"], end: true },
  {
    label: "Posts", icon: PenLine, roles: ["super_admin"],
    children: [
      { to: "/super-admin/blog",             label: "All Posts",   icon: List,     end: true },
      { to: "/super-admin/blog/new",         label: "Add Post",    icon: Plus,     end: true },
      { to: "/super-admin/blog/categories",  label: "Categories",  icon: FileText, end: true },
      { to: "/super-admin/blog/tags",        label: "Tags",        icon: Tag,      end: true },
    ],
  },
  { to: "/dashboard",   label: "Dashboard",    icon: LayoutDashboard },
  { to: "/leads",       label: "Leads",        icon: Users,   roles: ["admin", "manager", "super_admin"] },
  { to: "/pipeline",    label: "Pipeline",     icon: Kanban,  roles: ["admin", "manager", "super_admin"] },
  { to: "/projects",    label: "Projects",     icon: FolderKanban },
  { to: "/followups",   label: "Follow Ups",   icon: CalendarClock },
  { to: "/attendance",  label: "Attendance",   icon: Clock },
  { to: "/dump-leads",  label: "Dump Leads",   icon: Archive, roles: ["admin", "manager", "super_admin"] },
  { to: "/team",        label: "Team",         icon: UserCheck, roles: ["admin", "super_admin"] },
  { to: "/automation",  label: "Automation",   icon: Workflow, roles: ["admin", "manager", "super_admin"] },
  { to: "/performance", label: "Performance",  icon: BarChart3, roles: ["admin", "manager", "super_admin"] },
  { to: "/settings",    label: "Settings",     icon: Settings },
  { to: "/help-support", label: "Help & Support", icon: LifeBuoy },
];

// Live elapsed clock timer - recalculates correctly when `since` arrives async
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
  const { user, org, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(location.pathname.startsWith("/super-admin/blog"));
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
  // the sidebar panel - that lets the nav scroll freely on iOS/Android.
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
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000); // poll every 5 min (was 30s = 2880 req/day)
    return () => clearInterval(interval);
  }, [user]);

  // ── Service worker push → in-app toast + instant bell increment ─────────────
  // When the app IS open, the service worker forwards the push payload via
  // postMessage. We catch it here, show a toast, and bump the bell count so
  // the user sees the alert even if they're actively using the app.
  useEffect(() => {
    if (!user || !("serviceWorker" in navigator)) return;
    const handler = (e) => {
      if (e.data?.type !== "PUSH_NOTIFICATION") return;
      const { title, body, data: notifData } = e.data;
      // Show a dismissible in-app toast
      toast(
        (t) => (
          <div
            className="flex items-start gap-3 cursor-pointer"
            onClick={() => {
              toast.dismiss(t.id);
              if (notifData?.url) window.location.href = notifData.url;
            }}
          >
            <Bell className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold leading-tight">{title}</p>
              <p className="text-xs text-app-soft mt-0.5">{body}</p>
            </div>
          </div>
        ),
        { duration: 8000 }
      );
      // Bump the bell badge count
      setAlertCount((c) => c + 1);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [user]);

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

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const filtered = navItems.filter(
    (n) => !n.roles || n.roles.includes(user?.role)
  );

  // Auto-expand Posts group when navigating to a blog route
  useEffect(() => {
    if (location.pathname.startsWith("/super-admin/blog")) setPostsOpen(true);
  }, [location.pathname]);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* ── Sidebar header: org logo if set, else default ArthaLeads branding ── */}
      {org?.logo ? (
        /* Custom org logo - org takes center stage, ArthaLeads branding below */
        <div className="px-4 pt-5 pb-4 flex flex-col items-center text-center">
          {/* Org logo - prominent center */}
          <div className="w-24 h-20 flex items-center justify-center mb-2 rounded-2xl overflow-hidden p-1"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <img
              src={org.logo}
              alt={org.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <p className="text-sm font-bold text-app leading-tight truncate w-full mb-2.5">{org.name}</p>
          {/* Powered by ArthaLeads */}
          <p className="text-[9px] font-medium text-app-soft mb-1 tracking-wide">Powered By -</p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <img src="/logo.png" alt="ArthaLeads" className="w-5 h-5 rounded-md object-cover flex-shrink-0" />
            <span className="text-xs font-bold leading-none">
              <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
            </span>
          </div>
        </div>
      ) : (
        /* Default ArthaLeads branding */
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
      )}

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
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: "var(--app-primary)" }}>
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {filtered.map((item) => {
          if (item.children) {
            // ── Collapsible group (e.g. Posts) ──────────────────────────────
            const isGroupActive = item.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + "/"));
            const expanded = item.label === "Posts" ? postsOpen : false;
            const toggle   = item.label === "Posts" ? () => setPostsOpen(v => !v) : () => {};
            return (
              <div key={item.label}>
                <button
                  onClick={toggle}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all border-r-2 ${
                    isGroupActive
                      ? "font-semibold border-r-2"
                      : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 border-transparent"
                  }`}
                  style={isGroupActive ? { color: "var(--app-primary)", background: "rgba(var(--app-primary-rgb),0.10)", borderColor: "var(--app-primary)" } : {}}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: "var(--app-border)" }}>
                    {item.children.map(({ to, label, icon: CIcon, end: endMatch }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={endMatch !== undefined ? endMatch : true}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? "font-semibold"
                              : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
                          }`
                        }
                        style={({ isActive }) => isActive ? {
                          color: "var(--app-primary)",
                          background: "rgba(var(--app-primary-rgb),0.10)",
                        } : {}}
                      >
                        <CIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // ── Regular nav link ─────────────────────────────────────────────
          const { to, label, icon: Icon, end: endMatch } = item;
          return (
            <NavLink
              key={to}
              to={to}
              end={endMatch !== undefined ? endMatch : to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all border-r-2 ${
                  isActive
                    ? "font-semibold"
                    : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 border-transparent"
                }`
              }
              style={({ isActive }) => isActive ? {
                color: "var(--app-primary)",
                background: "rgba(var(--app-primary-rgb), 0.10)",
                borderColor: "var(--app-primary)",
              } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Trial countdown - compact single-line strip ── */}
      {org && org.plan === "trial" && org.trialEndsAt && user?.role !== "super_admin" && (() => {
        const msLeft = new Date(org.trialEndsAt) - Date.now();
        const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        const pct = Math.min(100, Math.round((daysLeft / 7) * 100));
        const expired = daysLeft === 0;
        const urgent  = daysLeft <= 2 && !expired;
        const color   = expired ? "#ef4444" : urgent ? "#f59e0b" : "#22c55e";
        return (
          <div className="mx-3 mb-1 px-3 py-1.5 rounded-xl flex items-center gap-2"
            style={{ background: expired ? "rgba(239,68,68,0.07)" : urgent ? "rgba(245,158,11,0.07)" : "rgba(34,197,94,0.07)", border: `1px solid ${expired ? "rgba(239,68,68,0.18)" : urgent ? "rgba(245,158,11,0.18)" : "rgba(34,197,94,0.14)"}` }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] font-bold flex-1 truncate" style={{ color }}>
              {expired ? "Trial Expired" : `Free Trial · ${daysLeft}d left`}
            </span>
            <div className="w-10 h-1 rounded-full overflow-hidden flex-shrink-0" style={{ background: "rgba(0,0,0,0.12)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })()}

      <div className="mt-auto p-4 space-y-3">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between rounded-2xl px-4 py-3 border transition"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
        >
          <span className="flex items-center gap-3 text-sm font-medium">
            {isDark ? <MoonStar className="w-4 h-4" style={{ color: "var(--app-primary)" }} /> : <SunMedium className="w-4 h-4" style={{ color: "var(--app-primary)" }} />}
            {theme === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
          <span className="stitch-kicker">{theme}</span>
        </button>

        <div className="rounded-[1.35rem] px-4 py-4 shell-panel">
          <div className="flex items-center gap-3 mb-3">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border"
                style={{ borderColor: "var(--app-border)" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextSibling.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="w-10 h-10 rounded-full items-center justify-center font-bold text-sm flex-shrink-0"
              style={{
                background: "rgba(var(--app-primary-rgb), 0.10)",
                color: "var(--app-primary)",
                display: user?.avatar ? "none" : "flex",
              }}
            >
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

  // Single portal-rendered alerts dropdown - escapes backdrop-filter stacking context
  const AlertsPortal = alertOpen ? createPortal(
    <>
      {/* Scrim - closes on outside click, keeps popup visually separated */}
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
            className="w-full flex items-start gap-3 px-4 py-3 border-b transition text-left cursor-pointer"
            onMouseEnter={(e) => e.currentTarget.style.background = `rgba(var(--app-primary-rgb), 0.05)`}
            onMouseLeave={(e) => e.currentTarget.style.background = ""}
            style={{ borderColor: "var(--app-border)" }}
            onClick={() => { setAlertOpen(false); navigate("/leads", { state: { openLeadId: lead._id } }); }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "rgba(var(--app-primary-rgb), 0.10)", color: "var(--app-primary)" }}>
              {lead.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-app truncate">{lead.name}</p>
              <p className="text-[11px] text-app-soft">{lead.phone} · <span style={{ color: "var(--app-primary)" }}>{lead.source}</span></p>
              <p className="text-[10px] text-app-soft mt-0.5">{fmtDateTime(lead.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>
      <button
        className="px-4 py-2.5 text-xs font-semibold border-t transition text-center"
        style={{ color: "var(--app-primary)" }}
        onMouseEnter={(e) => e.currentTarget.style.background = `rgba(var(--app-primary-rgb), 0.05)`}
        onMouseLeave={(e) => e.currentTarget.style.background = ""}
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between border-b sidebar-glass mobile-topbar"
        style={{ borderColor: "var(--app-border)" }}>
        {/* Clickable logo → home */}
        <NavLink to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
          {org?.logo ? (
            <>
              <div className="h-8 max-w-[80px] flex items-center flex-shrink-0">
                <img src={org.logo} alt={org.name} className="max-h-full max-w-full object-contain" style={{ borderRadius: 6 }} />
              </div>
              <span className="font-bold text-sm text-app truncate max-w-[100px]">{org.name}</span>
              {/* Tiny ArthaLeads badge */}
              <div className="flex items-center gap-1 opacity-50 flex-shrink-0">
                <img src="/logo.png" alt="AL" className="w-4 h-4 rounded object-cover" />
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow">
                <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
              </div>
              <span className="font-black text-sm tracking-tight text-app">Arthaleads</span>
            </>
          )}
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
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white animate-pulse"
                  style={{ background: "var(--app-primary)" }}>
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
