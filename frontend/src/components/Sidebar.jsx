// components/Sidebar.jsx
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, UserCheck, Settings,
  LogOut, Menu, X, Kanban, MoonStar, SunMedium, LifeBuoy, BarChart3, Workflow,
  FolderKanban, Archive, Bell, CalendarClock, Clock, LogIn as LogInIcon, ShieldCheck,
  PenLine, ChevronDown, ChevronUp, Tag, FileText, Plus, List,
  PanelLeftClose, PanelLeft,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { fmtDateTime } from "../utils/constants";
import toast from "react-hot-toast";

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
  { to: "/leads",       label: "Leads",        icon: Users },
  { to: "/pipeline",    label: "Pipeline",     icon: Kanban },
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

// Live elapsed clock timer
function useLiveClock(since) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!since) { setSecs(0); return; }
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

  // Mobile drawer
  const [open, setOpen] = useState(false);
  // Desktop: hover to expand (overlay mode) or pinned (pushes content)
  const [hovered, setHovered]   = useState(false);
  const [pinned,  setPinned]    = useState(() => {
    try { return localStorage.getItem("crm_sidebar_pinned") === "true"; }
    catch { return false; }
  });
  const expanded = pinned || hovered; // visible as wide sidebar either way

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try { localStorage.setItem("crm_sidebar_pinned", String(next)); } catch {}
  };
  // Posts sub-group
  const [postsOpen, setPostsOpen] = useState(location.pathname.startsWith("/super-admin/blog"));
  // Alerts panel
  const [alertOpen, setAlertOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [alertDropPos, setAlertDropPos] = useState({ top: 80, left: 268 });
  // Profile dropdown (inline, no portal)
  const [profileOpen, setProfileOpen] = useState(false);

  const alertRef        = useRef(null);
  const mobileBellRef   = useRef(null);
  const mobileSidebarRef = useRef(null);
  const profileBtnRef   = useRef(null);
  const lastSeenRef     = useRef(parseInt(localStorage.getItem("crm_alerts_seen") || "0", 10));

  // ── Clock In / Out ────────────────────────────────────────────────────────
  const [clockStatus, setClockStatus] = useState(null);
  const [clocking,    setClocking]    = useState(false);
  const clockTimer = useLiveClock(
    clockStatus?.clockIn && !clockStatus?.clockOut ? clockStatus.clockIn : null
  );

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

  // ── Scroll lock when mobile sidebar open ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const preventScroll = (e) => {
      if (mobileSidebarRef.current?.contains(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("wheel",     preventScroll, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventScroll);
      document.removeEventListener("wheel",     preventScroll);
    };
  }, [open]);

  // ── Alerts polling ────────────────────────────────────────────────────────
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
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Push notification toast ───────────────────────────────────────────────
  useEffect(() => {
    if (!user || !("serviceWorker" in navigator)) return;
    const handler = (e) => {
      if (e.data?.type !== "PUSH_NOTIFICATION") return;
      const { title, body, data: notifData } = e.data;
      toast(
        (t) => (
          <div className="flex items-start gap-3 cursor-pointer"
            onClick={() => { toast.dismiss(t.id); if (notifData?.url) window.location.href = notifData.url; }}>
            <Bell className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold leading-tight">{title}</p>
              <p className="text-xs text-app-soft mt-0.5">{body}</p>
            </div>
          </div>
        ),
        { duration: 8000 }
      );
      setAlertCount((c) => c + 1);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [user]);

  // ── Close alerts on outside click ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const inDesktop  = alertRef.current?.contains(e.target);
      const inMobile   = mobileBellRef.current?.contains(e.target);
      const inDropdown = document.getElementById("alerts-portal-dropdown")?.contains(e.target);
      if (!inDesktop && !inMobile && !inDropdown) setAlertOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Close profile dropdown on outside click ───────────────────────────────
  // Use "click" (not "mousedown") so any button inside the menu fires its
  // onClick FIRST before this handler removes the menu from the DOM.
  useEffect(() => {
    const handler = (e) => {
      if (profileBtnRef.current?.contains(e.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── Auto-expand Posts group on blog routes ────────────────────────────────
  useEffect(() => {
    if (location.pathname.startsWith("/super-admin/blog")) setPostsOpen(true);
  }, [location.pathname]);

  const filtered = navItems.filter((n) => !n.roles || n.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const openAlerts = (e) => {
    const newOpen = !alertOpen;
    if (newOpen && e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setAlertDropPos({ top: rect.bottom + 6, left: undefined, right: 8 });
      } else {
        setAlertDropPos({ top: rect.top, left: rect.right + 8, right: undefined });
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

  const openProfileMenu = (e) => { e?.stopPropagation(); setProfileOpen(v => !v); };

  // ── Derived clock state ───────────────────────────────────────────────────
  const isClockedIn  = !!(clockStatus?.clockIn && !clockStatus?.clockOut);
  const isClockedOut = !!(clockStatus?.clockIn && clockStatus?.clockOut);

  // ── Trial info ────────────────────────────────────────────────────────────
  const showTrial = org && org.plan === "trial" && org.trialEndsAt && user?.role !== "super_admin";
  const trialInfo = showTrial ? (() => {
    const msLeft   = new Date(org.trialEndsAt) - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    const pct      = Math.min(100, Math.round((daysLeft / 7) * 100));
    const expired  = daysLeft === 0;
    const urgent   = daysLeft <= 2 && !expired;
    const color    = expired ? "#ef4444" : urgent ? "#f59e0b" : "#22c55e";
    return { daysLeft, pct, expired, urgent, color };
  })() : null;

  // ──────────────────────────────────────────────────────────────────────────
  // SHARED NAV CONTENT (rendered inside both mobile drawer and desktop sidebar)
  // `isExpanded` controls whether labels are visible
  // ──────────────────────────────────────────────────────────────────────────
  const NavContent = ({ isExpanded, showPin = false }) => {
    // Label fade style — fade in/out when sidebar expands/collapses
    const labelStyle = {
      opacity:    isExpanded ? 1 : 0,
      maxWidth:   isExpanded ? 200 : 0,
      overflow:   "hidden",
      whiteSpace: "nowrap",
      transition: "opacity 150ms ease, max-width 200ms ease",
      pointerEvents: "none",
    };

    return (
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div
          className="flex items-center px-3 flex-shrink-0"
          style={{ height: 68, minHeight: 68 }}
        >
          {org?.logo ? (
            <>
              <div
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}
              >
                <img
                  key={org.logo}
                  src={org.logo}
                  alt={org.name}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>
              <div className="ml-3 overflow-hidden flex-1" style={labelStyle}>
                <p className="text-sm font-bold text-app">{org.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <img src="/logo.png" alt="AL" className="w-3 h-3 rounded object-cover opacity-50" />
                  <span className="text-[9px] text-app-soft">
                    <span style={{ color: "#FF6B00" }}>Artha</span>Leads
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 flex-shrink-0 rounded-2xl overflow-hidden shadow-md">
                <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
              </div>
              <div className="ml-3 overflow-hidden flex-1" style={labelStyle}>
                <p className="font-black text-base leading-none tracking-tight">
                  <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
                </p>
                <p className="text-[8px] text-app-soft tracking-widest mt-0.5">CRM PLATFORM</p>
              </div>
            </>
          )}

          {/* ── Pin / Unpin toggle (desktop only, visible when expanded) ── */}
          {showPin && (
            <button
              onClick={togglePin}
              title={pinned ? "Collapse sidebar" : "Pin sidebar open"}
              className="flex-shrink-0 p-1.5 rounded-xl text-app-soft hover:text-app hover:bg-black/8 dark:hover:bg-white/8 transition-all"
              style={{
                opacity:    isExpanded ? 1 : 0,
                pointerEvents: isExpanded ? "auto" : "none",
                transition: "opacity 150ms",
                marginLeft: 4,
              }}
            >
              {pinned
                ? <PanelLeftClose style={{ width: 16, height: 16 }} />
                : <PanelLeft      style={{ width: 16, height: 16 }} />
              }
            </button>
          )}
        </div>

        {/* ── Alerts bell ── */}
        <div className="px-2 pb-1 flex-shrink-0">
          <div ref={alertRef}>
            <button
              onClick={openAlerts}
              title={!isExpanded ? "Alerts" : undefined}
              className="relative w-full flex items-center px-3 py-2.5 rounded-2xl text-sm font-medium transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
              style={{ paddingLeft: 14 }}
            >
              <Bell className="w-4.5 h-4.5 flex-shrink-0" style={{ width: 18, height: 18 }} />
              <span className="ml-3" style={labelStyle}>Alerts</span>
              {alertCount > 0 && (
                <span
                  className={`flex items-center justify-center rounded-full text-[9px] font-bold text-white flex-shrink-0 ${isExpanded ? "ml-auto" : "absolute top-1.5 right-1.5"}`}
                  style={{ background: "var(--app-primary)", width: 18, height: 18, minWidth: 18 }}
                >
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch", minHeight: 0 }}>
          {filtered.map((item) => {
            if (item.children) {
              const isGroupActive = item.children.some(
                c => location.pathname === c.to || location.pathname.startsWith(c.to + "/")
              );
              const gExpanded = item.label === "Posts" ? postsOpen : false;
              const toggle    = item.label === "Posts" ? () => setPostsOpen(v => !v) : () => {};

              return (
                <div key={item.label}>
                  <button
                    onClick={toggle}
                    title={!isExpanded ? item.label : undefined}
                    className={`w-full flex items-center px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                      isGroupActive
                        ? "font-semibold"
                        : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      paddingLeft: 14,
                      ...(isGroupActive ? {
                        color: "var(--app-primary)",
                        background: "rgba(var(--app-primary-rgb),0.10)",
                      } : {}),
                    }}
                  >
                    <item.icon className="flex-shrink-0" style={{ width: 18, height: 18 }} />
                    <span className="ml-3 flex-1 text-left" style={labelStyle}>{item.label}</span>
                    <ChevronDown
                      className={`flex-shrink-0 transition-transform ${gExpanded ? "rotate-180" : ""}`}
                      style={{ width: 14, height: 14, opacity: isExpanded ? 1 : 0, transition: "opacity 150ms" }}
                    />
                  </button>
                  {gExpanded && isExpanded && (
                    <div
                      className="ml-5 mt-0.5 space-y-0.5 border-l pl-2.5"
                      style={{ borderColor: "var(--app-border)" }}
                    >
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
                          <CIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            const { to, label, icon: Icon, end: endMatch } = item;
            return (
              <NavLink
                key={to}
                to={to}
                end={endMatch !== undefined ? endMatch : to === "/"}
                title={!isExpanded ? label : undefined}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                    isActive
                      ? "font-semibold"
                      : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
                  }`
                }
                style={({ isActive }) => ({
                  paddingLeft: 14,
                  ...(isActive ? {
                    color: "var(--app-primary)",
                    background: "rgba(var(--app-primary-rgb), 0.10)",
                    borderRight: "2px solid var(--app-primary)",
                  } : { borderRight: "2px solid transparent" }),
                })}
              >
                <Icon className="flex-shrink-0" style={{ width: 18, height: 18 }} />
                <span className="ml-3" style={labelStyle}>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* ── Trial bar (visible only when expanded) ── */}
        {trialInfo && (
          <div
            className="mx-2 mb-1 px-3 py-1.5 rounded-xl flex items-center gap-2 overflow-hidden flex-shrink-0"
            style={{
              background: trialInfo.expired ? "rgba(239,68,68,0.07)" : trialInfo.urgent ? "rgba(245,158,11,0.07)" : "rgba(34,197,94,0.07)",
              border: `1px solid ${trialInfo.expired ? "rgba(239,68,68,0.18)" : trialInfo.urgent ? "rgba(245,158,11,0.18)" : "rgba(34,197,94,0.14)"}`,
              opacity: isExpanded ? 1 : 0,
              transition: "opacity 150ms ease",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: trialInfo.color }} />
            <span className="text-[10px] font-bold flex-1 truncate" style={{ color: trialInfo.color }}>
              {trialInfo.expired ? "Trial Expired" : `Free Trial · ${trialInfo.daysLeft}d left`}
            </span>
            <div className="w-10 h-1 rounded-full overflow-hidden flex-shrink-0" style={{ background: "rgba(0,0,0,0.12)" }}>
              <div className="h-full rounded-full" style={{ width: `${trialInfo.pct}%`, background: trialInfo.color }} />
            </div>
          </div>
        )}

        {/* ── Bottom: profile ── */}
        <div className="mt-auto px-2 pb-3 flex-shrink-0 space-y-0.5 border-t" style={{ borderColor: "var(--app-border)", paddingTop: 6 }}>

          {/* ── Inline profile menu (expands upward, works on all devices) ── */}
          {profileOpen && isExpanded && (
            <div
              className="mx-2 mb-1 rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--app-border)", background: isDark ? "rgb(30,29,32)" : "#fff" }}
            >
              {/* User info */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--app-border)" }}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden"
                  style={{ background: "rgba(var(--app-primary-rgb), 0.12)", color: "var(--app-primary)" }}>
                  {user?.avatar
                    ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    : user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-app truncate">{user?.name}</p>
                  <p className="text-xs text-app-soft capitalize">{user?.role?.replace("_", " ")}</p>
                </div>
              </div>

              {/* Clock in/out */}
              <div className="px-2 py-1.5 border-b" style={{ borderColor: "var(--app-border)" }}>
                {isClockedOut ? (
                  <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-app-soft rounded-xl" style={{ background: "var(--app-surface-low)" }}>
                    <Clock style={{ width: 14, height: 14, flexShrink: 0 }} />
                    Done for today
                  </div>
                ) : isClockedIn ? (
                  <button onClick={() => { handleClockOut(); setProfileOpen(false); }} disabled={clocking}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs rounded-xl transition-all text-red-500 hover:bg-red-500/10 disabled:opacity-60 font-semibold">
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{clockTimer || "Active"}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-red-400">Clock Out</span>
                  </button>
                ) : (
                  <button onClick={() => { handleClockIn(); setProfileOpen(false); }} disabled={clocking}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs rounded-xl transition-all text-green-600 hover:bg-green-500/10 disabled:opacity-60 font-semibold">
                    <LogInIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                    Clock In
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="px-2 py-1.5">
                <button onClick={() => { navigate("/settings"); setProfileOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left">
                  <Settings style={{ width: 15, height: 15, flexShrink: 0 }} />
                  Account Settings
                </button>
                <button onClick={() => { toggleTheme(); setProfileOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left">
                  {isDark
                    ? <MoonStar style={{ width: 15, height: 15, flexShrink: 0, color: "var(--app-primary)" }} />
                    : <SunMedium style={{ width: 15, height: 15, flexShrink: 0, color: "var(--app-primary)" }} />}
                  {isDark ? "Dark Mode" : "Light Mode"}
                </button>
              </div>

              {/* Sign out */}
              <div className="px-2 pb-1.5 border-t" style={{ borderColor: "var(--app-border)" }}>
                <button onClick={() => { handleLogout(); setProfileOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-all text-red-500 hover:bg-red-500/10 text-left mt-1">
                  <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Profile button */}
          <button
            ref={profileBtnRef}
            onClick={openProfileMenu}
            title={!isExpanded ? user?.name : undefined}
            className="w-full flex items-center px-3 py-2 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{ paddingLeft: 10 }}
          >
            {/* Avatar */}
            <div className="flex-shrink-0 relative" style={{ width: 36, height: 36 }}>
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover border"
                  style={{ borderColor: "var(--app-border)" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
              ) : null}
              <div className="w-full h-full rounded-full items-center justify-center font-bold text-sm"
                style={{ background: "rgba(var(--app-primary-rgb), 0.12)", color: "var(--app-primary)",
                  display: user?.avatar ? "none" : "flex", position: user?.avatar ? "absolute" : "relative", top: 0, left: 0 }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
            </div>
            {/* Name + role */}
            <div className="ml-3 flex-1 min-w-0 text-left overflow-hidden" style={labelStyle}>
              <p className="text-sm font-semibold text-app truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-app-soft capitalize leading-tight">{user?.role?.replace("_", " ")}</p>
            </div>
            {/* Chevron */}
            <ChevronUp className="flex-shrink-0 text-app-soft"
              style={{ width: 14, height: 14, opacity: isExpanded ? 0.6 : 0, transition: "opacity 150ms",
                transform: profileOpen ? "rotate(0deg)" : "rotate(180deg)" }} />
          </button>
        </div>
      </div>
    );
  };

  // ── Alerts portal ─────────────────────────────────────────────────────────
  const AlertsPortal = alertOpen ? createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.18)" }}
        onClick={() => setAlertOpen(false)}
      />
      <div
        id="alerts-portal-dropdown"
        className="w-80 max-h-[70vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          position: "fixed",
          top: alertDropPos.top,
          ...(alertDropPos.right !== undefined
            ? { right: alertDropPos.right }
            : { left: alertDropPos.left }),
          zIndex: 9999,
          background: isDark ? "rgb(30,29,32)" : "#fff",
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
          style={{ color: "var(--app-primary)", borderColor: "var(--app-border)" }}
          onMouseEnter={(e) => e.currentTarget.style.background = `rgba(var(--app-primary-rgb), 0.05)`}
          onMouseLeave={(e) => e.currentTarget.style.background = ""}
          onClick={() => { setAlertOpen(false); navigate("/leads"); }}
        >
          View All Leads →
        </button>
      </div>
    </>,
    document.body
  ) : null;

  // Profile menu is now rendered inline inside NavContent (mobile-safe)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {AlertsPortal}

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between border-b sidebar-glass mobile-topbar"
        style={{ borderColor: "var(--app-border)" }}
      >
        <NavLink to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
          {org?.logo ? (
            <>
              <div className="h-8 max-w-[80px] flex items-center flex-shrink-0">
                <img key={org.logo} src={org.logo} alt={org.name} className="max-h-full max-w-full object-contain" style={{ borderRadius: 6 }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
              <span className="font-bold text-sm text-app truncate max-w-[100px]">{org.name}</span>
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
            <button onClick={openAlerts} className="relative p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5" title="New lead alerts">
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

      {/* ── Mobile overlay ──────────────────────────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      <div
        ref={mobileSidebarRef}
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-40 w-72 transform transition-transform duration-200 sidebar-glass flex flex-col overflow-hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ overscrollBehavior: "contain" }}
      >
        <NavContent isExpanded={true} />
      </div>

      {/* ── Desktop sidebar ──────────────────────────────────────────────────
           PINNED  → outer aside is 240 px wide  → pushes main content
           HOVER   → outer aside is 64 px wide   → inner panel overlays content
           Both states show the full expanded panel (icons + labels)            */}
      <aside
        className="hidden lg:block h-full flex-shrink-0"
        style={{
          width:    pinned ? 240 : 64,
          minWidth: pinned ? 240 : 64,
          position: "relative",
          zIndex:   30,
          transition: "width 220ms cubic-bezier(0.4,0,0.2,1), min-width 220ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div
          onMouseEnter={() => { if (!pinned) setHovered(true);  }}
          onMouseLeave={() => { if (!pinned) setHovered(false); }}
          className="sidebar-glass flex flex-col h-full overflow-hidden"
          style={{
            /* Pinned: stay in normal flow (same width as aside, no overlay)   */
            /* Hover:  absolute so it overlays content without shifting layout */
            position:   pinned ? "relative" : "absolute",
            left:  0,
            top:   0,
            bottom:0,
            width:      expanded ? 240 : 64,
            transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
            zIndex:     30,
          }}
        >
          <NavContent isExpanded={expanded} showPin={true} />
        </div>
      </aside>
    </>
  );
}
