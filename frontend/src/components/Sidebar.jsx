// components/Sidebar.jsx
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, UserCheck, Settings, User, Gift,
  LogOut, Menu, X, Kanban, MoonStar, SunMedium, LifeBuoy, BarChart3, Workflow,
  FolderKanban, Archive, Bell, CalendarClock, Clock, LogIn as LogInIcon, ShieldCheck,
  PenLine, ChevronDown, ChevronUp, Tag, FileText, Plus, List,
  PanelLeftClose, PanelLeft, Zap, Search, X as XIcon,
  Receipt, BookMarked, FileCheck, Building2, ClipboardList, Phone, Mail,
} from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { fmtDateTime } from "../utils/constants";
import { canAccess, upgradeTarget } from "../utils/plan";
import toast from "react-hot-toast";
import AttendanceCapture from "./AttendanceCapture";

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
  {
    label: "Bookings & Invoices", icon: Receipt,
    roles: ["admin", "manager", "super_admin"],
    children: [
      { to: "/bookings",   label: "Bookings",   icon: BookMarked },
      { to: "/invoices",   label: "Invoices",   icon: FileCheck  },
      { to: "/developers", label: "Developers", icon: Building2  },
    ],
  },
  { to: "/calls",       label: "Calls",        icon: Phone },
  { to: "/followups",   label: "Follow Ups",   icon: CalendarClock },
  { to: "/conversations", label: "Conversations", icon: WhatsAppIcon },
  {
    label: "Tasks", icon: ClipboardList,
    children: [
      { to: "/tasks",     label: "Manage Tasks", icon: List },
      { to: "/tasks?new=1", label: "Add Task",   icon: Plus, roles: ["admin", "manager", "super_admin"], noActive: true },
    ],
  },
  { to: "/attendance",  label: "Attendance",   icon: Clock,     minPlan: "growth" },
  { to: "/dump-leads",  label: "Dump Leads",   icon: Archive,   roles: ["admin", "manager", "super_admin"] },
  { to: "/team",        label: "Team",         icon: UserCheck, roles: ["admin", "super_admin"] },
  { to: "/automation",  label: "Automation",   icon: Workflow,  roles: ["admin", "manager", "super_admin"] },
  { to: "/performance", label: "Performance",  icon: BarChart3, roles: ["admin", "manager", "super_admin"], minPlan: "growth" },
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

// Live wall clock — updates every second
function useWallClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const opts = { timeZone: "Asia/Kolkata" };
  const day  = now.toLocaleDateString("en-IN", { ...opts, day: "2-digit", month: "short", year: "numeric" });
  const time = now.toLocaleTimeString("en-IN", { ...opts, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();
  return `${day} | ${time}`;
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
  // Nav sub-groups (keyed by item label)
  const [openGroups, setOpenGroups] = useState(() => ({
    Posts: location.pathname.startsWith("/super-admin/blog"),
    "Bookings & Invoices": ["/bookings", "/invoices", "/developers"].some(
      (p) => location.pathname.startsWith(p)
    ),
  }));
  // Alerts panel
  const [alertOpen, setAlertOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [alertDropPos, setAlertDropPos] = useState({ top: 58, right: 8 });
  // Profile dropdown (inline, no portal)
  const [profileOpen, setProfileOpen] = useState(false);

  const alertRef         = useRef(null);
  const mobileBellRef    = useRef(null);
  const mobileSidebarRef = useRef(null);
  const profileBtnRef    = useRef(null);
  const desktopBellRef   = useRef(null);
  const desktopProfileBtnRef = useRef(null);
  const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
  const [desktopProfilePos,  setDesktopProfilePos]  = useState({ top: 58, right: 16 });
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchQ, setMobileSearchQ]       = useState("");
  const mobileSearchRef = useRef(null);
  const [flyout, setFlyout] = useState(null);
  const flyoutRef = useRef(null);
  const flyoutCloseTimer = useRef(null);

  useEffect(() => {
    if (mobileSearchOpen) setTimeout(() => mobileSearchRef.current?.focus(), 60);
  }, [mobileSearchOpen]);
  const lastSeenRef     = useRef(parseInt(localStorage.getItem("crm_alerts_seen") || "0", 10));

  // ── Clock In / Out ────────────────────────────────────────────────────────
  const [clockStatus,      setClockStatus]      = useState(null);
  const [clocking,         setClocking]         = useState(false);
  const [logoError,        setLogoError]        = useState(false);
  const [captureOpen,      setCaptureOpen]      = useState(false);
  const [captureMode,      setCaptureMode]      = useState("clockin");
  const [requireSelfie,    setRequireSelfie]    = useState(true);
  const clockTimer = useLiveClock(
    clockStatus?.clockIn && !clockStatus?.clockOut ? clockStatus.clockIn : null
  );

  const attendanceEnabled = canAccess(org, "growth");

  const fetchClockStatus = useCallback(() => {
    if (!user || !attendanceEnabled) return;
    api.get("/attendance/status").then(r => {
      setClockStatus(r.data.data);
      setRequireSelfie(r.data.requireSelfie ?? true);
    }).catch(() => {});
  }, [user, attendanceEnabled]);
  useEffect(() => { fetchClockStatus(); }, [fetchClockStatus]);
  useEffect(() => { setLogoError(false); }, [org?.logo]);
  useEffect(() => { setFlyout(null); }, [location.pathname, location.search]);

  const openFlyoutForItem = (item, filteredChildren, e) => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyout({
      label: item.label,
      top: Math.min(rect.top, window.innerHeight - (filteredChildren.length * 44 + 72)),
      left: rect.right + 8,
      children: filteredChildren,
    });
  };

  const scheduleFlyoutClose = () => {
    flyoutCloseTimer.current = setTimeout(() => setFlyout(null), 180);
  };

  const cancelFlyoutClose = () => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
  };

  const submitClock = async (captureData) => {
    setClocking(true);
    const isIn = captureMode === "clockin";
    try {
      const body = {};
      if (captureData?.selfie) body.selfie = captureData.selfie;
      if (captureData?.lat != null) { body.lat = captureData.lat; body.lng = captureData.lng; body.accuracy = captureData.accuracy; }
      const r = await api.post(`/attendance/${isIn ? "clockin" : "clockout"}`, body);
      setClockStatus(r.data.data);
      toast.success(isIn ? "Clocked in!" : "Clocked out! Great work today.");
      setCaptureOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.message || (isIn ? "Clock in failed" : "Clock out failed"));
    }
    finally { setClocking(false); }
  };

  const handleClockIn = () => {
    if (requireSelfie) { setCaptureMode("clockin"); setCaptureOpen(true); }
    else submitClock({});
  };

  const handleClockOut = () => {
    if (requireSelfie) { setCaptureMode("clockout"); setCaptureOpen(true); }
    else submitClock({});
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

  // ── Sync alertCount to localStorage + Dashboard bell badge ───────────────
  useEffect(() => {
    localStorage.setItem("crm_alert_count", String(alertCount));
    window.dispatchEvent(new CustomEvent("alerts:count", { detail: { count: alertCount } }));
  }, [alertCount]);

  // ── Listen for "open:alerts" fired by page-level bell buttons ────────────
  useEffect(() => {
    const handler = (e) => {
      const rect = e.detail?.rect;
      if (rect) {
        setAlertDropPos({ top: rect.bottom + 6, right: 8 });
      }
      setAlertOpen(true);
      const now = Date.now();
      localStorage.setItem("crm_alerts_seen", String(now));
      lastSeenRef.current = now;
      setAlertCount(0);
    };
    window.addEventListener("open:alerts", handler);
    return () => window.removeEventListener("open:alerts", handler);
  }, []);

  // ── Close alerts on outside click ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const inDesktop  = alertRef.current?.contains(e.target) || desktopBellRef.current?.contains(e.target);
      const inMobile   = mobileBellRef.current?.contains(e.target);
      const inDropdown = document.getElementById("alerts-portal-dropdown")?.contains(e.target);
      if (!inDesktop && !inMobile && !inDropdown) setAlertOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Close profile dropdowns on outside click ─────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (profileBtnRef.current?.contains(e.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  useEffect(() => {
    const handler = (e) => {
      if (desktopProfileBtnRef.current?.contains(e.target)) return;
      setDesktopProfileOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── Auto-expand nav groups based on current route ─────────────────────────
  useEffect(() => {
    if (location.pathname.startsWith("/super-admin/blog"))
      setOpenGroups((g) => ({ ...g, Posts: true }));
    if (["/bookings", "/invoices", "/developers"].some((p) => location.pathname.startsWith(p)))
      setOpenGroups((g) => ({ ...g, "Bookings & Invoices": true }));
  }, [location.pathname]);

  const filtered = navItems.filter((n) => !n.roles || n.roles.includes(user?.role));

  const handleLogout = async () => {
    await logout(); // clears httpOnly cookie on server, then local session
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
        setAlertDropPos({ top: rect.bottom + 6, left: undefined, right: window.innerWidth - rect.right });
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

  const openDesktopProfileMenu = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDesktopProfilePos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setDesktopProfileOpen(v => !v);
  };

  // ── Derived clock state ───────────────────────────────────────────────────
  const isClockedIn  = !!(clockStatus?.clockIn && !clockStatus?.clockOut);
  const isClockedOut = !!(clockStatus?.clockIn && clockStatus?.clockOut);
  const wallClock    = useWallClock();

  // ── Trial info ────────────────────────────────────────────────────────────
  const showTrial = org && org.plan === "trial" && org.trialEndsAt && user?.role !== "super_admin";
  const trialInfo = showTrial ? (() => {
    const msLeft   = new Date(org.trialEndsAt) - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    const pct      = Math.min(100, Math.round((daysLeft / 14) * 100));
    const expired  = daysLeft === 0;
    const urgent   = daysLeft <= 2 && !expired;
    const color    = expired ? "#ef4444" : urgent ? "#f59e0b" : "#22c55e";
    return { daysLeft, pct, expired, urgent, color };
  })() : null;

  // ──────────────────────────────────────────────────────────────────────────
  // SHARED NAV CONTENT (rendered inside both mobile drawer and desktop sidebar)
  // `isExpanded` controls whether labels are visible
  // ──────────────────────────────────────────────────────────────────────────
  const NavContent = ({ isExpanded, showPin = false, showProfile = true }) => {
    // Label fade style - fade in/out when sidebar expands/collapses
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
          {org?.logo && !logoError ? (
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
                  onError={() => setLogoError(true)}
                />
              </div>
              <div className="ml-3 overflow-hidden flex-1" style={labelStyle}>
                <p className="text-sm font-bold text-app">{org.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <img src="/logo.png" alt="AL" className="w-3 h-3 rounded object-cover" />
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

        {/* ── Nav items ── */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch", minHeight: 0 }}>
          {filtered.map((item) => {
            if (item.children) {
              const filteredChildren = item.children.filter(c => !c.roles || c.roles.includes(user?.role));
              const isGroupActive = filteredChildren.some(
                c => location.pathname === new URL(c.to, window.location.origin).pathname ||
                     location.pathname.startsWith(new URL(c.to, window.location.origin).pathname + "/")
              );
              const gExpanded = openGroups[item.label] || false;
              const isFlyoutOpen = flyout?.label === item.label;

              return (
                <div key={item.label}>
                  <button
                    onClick={open ? () => setOpenGroups((g) => ({ ...g, [item.label]: !g[item.label] })) : undefined}
                    onMouseEnter={!open ? (e) => openFlyoutForItem(item, filteredChildren, e) : undefined}
                    onMouseLeave={!open ? scheduleFlyoutClose : undefined}
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
                      } : isFlyoutOpen ? {
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                      } : {}),
                    }}
                  >
                    <item.icon className="flex-shrink-0" style={{ width: 18, height: 18 }} />
                    <span className="ml-3 flex-1 text-left" style={labelStyle}>{item.label}</span>
                    <ChevronDown
                      className={`flex-shrink-0 transition-transform ${(open ? gExpanded : isFlyoutOpen) ? "rotate-180" : ""}`}
                      style={{ width: 14, height: 14, opacity: isExpanded ? 1 : 0, transition: "opacity 150ms" }}
                    />
                  </button>
                  {/* Mobile accordion only */}
                  {open && gExpanded && isExpanded && (
                    <div
                      className="ml-5 mt-0.5 space-y-0.5 border-l pl-2.5"
                      style={{ borderColor: "var(--app-border)" }}
                    >
                      {filteredChildren.map(({ to, label, icon: CIcon, end: endMatch, noActive }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={endMatch !== undefined ? endMatch : true}
                          onClick={() => setOpen(false)}
                          {...(noActive ? { isActive: () => false } : {})}
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

            const { to, label, icon: Icon, end: endMatch, minPlan } = item;
            const locked = minPlan && !canAccess(org, minPlan) && user?.role !== "super_admin";
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
                  opacity: locked ? 0.5 : 1,
                  ...(isActive ? {
                    color: "var(--app-primary)",
                    background: "rgba(var(--app-primary-rgb), 0.10)",
                    borderRight: "2px solid var(--app-primary)",
                  } : { borderRight: "2px solid transparent" }),
                })}
              >
                <Icon className="flex-shrink-0" style={{ width: 18, height: 18 }} />
                <span className="ml-3 flex-1" style={labelStyle}>{label}</span>
                {locked && isExpanded && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
                    style={{ background: "rgba(255,107,0,0.12)", color: "#ff6b00" }}>
                    PRO
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Upgrade button (hidden for enterprise & super_admin) ── */}
        {user?.role !== "super_admin" && upgradeTarget(org?.plan) && (
          <div className="px-2 mb-1 flex-shrink-0">
            <NavLink to="/plans"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all w-full"
              style={({ isActive }) => ({
                background: isActive
                  ? "rgba(255,107,0,0.15)"
                  : org?.plan === "starter" || org?.plan === "trial"
                    ? "linear-gradient(135deg,rgba(255,107,0,0.12),rgba(255,170,0,0.08))"
                    : "rgba(255,107,0,0.06)",
                border: `1px solid ${isActive ? "rgba(255,107,0,0.4)" : "rgba(255,107,0,0.2)"}`,
                color: "#ff6b00",
              })}>
              <Zap className="flex-shrink-0" style={{ width: 16, height: 16 }} />
              <span style={labelStyle}>Upgrade Plan</span>
              {isExpanded && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#ff6b00] text-white flex-shrink-0 ml-auto">
                  {upgradeTarget(org?.plan)}
                </span>
              )}
            </NavLink>
          </div>
        )}

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

        {/* ── Bottom: profile (mobile only; desktop uses topbar) ── */}
        {showProfile && <div className="mt-auto px-2 pb-3 flex-shrink-0 space-y-0.5 border-t" style={{ borderColor: "var(--app-border)", paddingTop: 6 }}>

          {/* ── Inline profile menu (expands upward, mobile drawer) ── */}
          {profileOpen && isExpanded && (
            <div
              className="mx-2 mb-1 rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--app-border)", background: isDark ? "rgb(30,29,32)" : "#fff" }}
            >
              {/* User card: two-column (avatar left, info right) */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--app-border)" }}>
                <div className="rounded-full overflow-hidden flex items-center justify-center font-bold text-base flex-shrink-0"
                  style={{ width: 44, height: 44, background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)", border: "2px solid rgba(var(--app-primary-rgb),0.2)" }}>
                  {user?.avatar
                    ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    : user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-app leading-tight truncate">{user?.name}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                    style={{ background: "rgba(var(--app-primary-rgb),0.10)", color: "var(--app-primary)" }}>
                    {user?.role?.replace("_", " ")}
                  </span>
                  <div className="mt-1.5 space-y-0.5">
                    {user?.phone && (
                      <div className="flex items-center gap-1.5 text-[11px] text-app-soft">
                        <Phone style={{ width: 10, height: 10, flexShrink: 0 }} />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user?.email && (
                      <div className="flex items-center gap-1.5 text-[11px] text-app-soft">
                        <Mail style={{ width: 10, height: 10, flexShrink: 0 }} />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Clock in/out — Growth+ only */}
              {attendanceEnabled && (
                <div className="px-3 pt-3 pb-1">
                  {isClockedOut ? (
                    <div className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-app-soft"
                      style={{ background: "var(--app-surface-low)" }}>
                      <Clock style={{ width: 13, height: 13 }} />
                      Done for today
                    </div>
                  ) : isClockedIn ? (
                    <button onClick={() => { handleClockOut(); setProfileOpen(false); }} disabled={clocking}
                      className="w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444" }}>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      {clockTimer || "Active"} · Clock Out
                    </button>
                  ) : (
                    <button onClick={() => { handleClockIn(); setProfileOpen(false); }} disabled={clocking}
                      className="w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "#22c55e", color: "#fff" }}>
                      <LogInIcon style={{ width: 13, height: 13 }} />
                      Clock IN
                    </button>
                  )}
                </div>
              )}

              {/* Live date & time */}
              <div className="mx-3 mb-2 mt-2 px-3 py-1.5 rounded-xl flex items-center gap-2"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-app-soft flex-shrink-0">Date &amp; Time</p>
                <p className="text-[10px] font-bold text-app tabular-nums truncate">{wallClock}</p>
              </div>

              {/* Actions */}
              <div className="px-2 pb-1">
                <button onClick={() => { navigate("/settings"); setProfileOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left">
                  <User style={{ width: 13, height: 13, flexShrink: 0 }} />
                  My Profile
                </button>
                <button onClick={() => { navigate("/referrals"); setProfileOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left">
                  <Gift style={{ width: 13, height: 13, flexShrink: 0, color: "#ff6b00" }} />
                  Referrals
                </button>
                <button onClick={() => { toggleTheme(); setProfileOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left">
                  {isDark
                    ? <MoonStar style={{ width: 13, height: 13, flexShrink: 0, color: "var(--app-primary)" }} />
                    : <SunMedium style={{ width: 13, height: 13, flexShrink: 0, color: "var(--app-primary)" }} />}
                  {isDark ? "Dark Mode" : "Light Mode"}
                </button>
              </div>

              {/* Sign out */}
              <div className="px-3 pb-3 border-t pt-1.5" style={{ borderColor: "var(--app-border)" }}>
                <button onClick={() => { handleLogout(); setProfileOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all text-red-500 hover:bg-red-500/10 text-left">
                  <LogOut style={{ width: 13, height: 13, flexShrink: 0 }} />
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
        </div>}
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

  // ── Flyout portal ─────────────────────────────────────────────────────────
  const FlyoutPortal = flyout ? createPortal(
    <>
      {/* Invisible bridge strip between sidebar button and flyout panel */}
      <div
        style={{
          position: "fixed",
          top: flyout.top,
          left: flyout.left - 10,
          width: 12,
          height: 48,
          zIndex: 9998,
        }}
        onMouseEnter={cancelFlyoutClose}
        onMouseLeave={scheduleFlyoutClose}
      />
      <div
        ref={flyoutRef}
        onMouseEnter={cancelFlyoutClose}
        onMouseLeave={scheduleFlyoutClose}
        style={{
          position: "fixed",
          top: flyout.top,
          left: flyout.left,
          zIndex: 9999,
          minWidth: 210,
          background: isDark ? "rgb(24,23,28)" : "#fff",
          border: "1px solid var(--app-border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.10)",
          borderRadius: "1rem",
          overflow: "hidden",
          paddingTop: 6,
          paddingBottom: 6,
          animation: "flyout-in 120ms ease",
        }}
      >
        <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest border-b"
          style={{ color: "var(--app-soft, #888)", borderColor: "var(--app-border)" }}>
          {flyout.label}
        </p>
        <div className="px-1.5 pt-1">
          {flyout.children.map(({ to, label, icon: CIcon, end: endMatch, noActive }) => (
            <NavLink
              key={to}
              to={to}
              end={endMatch !== undefined ? endMatch : true}
              onClick={() => setFlyout(null)}
              {...(noActive ? { isActive: () => false } : {})}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
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
              <CIcon style={{ width: 15, height: 15, flexShrink: 0 }} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  // ── Desktop topbar portal ─────────────────────────────────────────────────
  const DesktopTopbarPortal = createPortal(
    <div
      className="hidden lg:flex items-center justify-between px-4"
      style={{
        position:   "fixed",
        top:        0,
        left:       pinned ? 240 : 64,
        right:      0,
        height:     52,
        zIndex:     20,
        background: "var(--app-surface)",
        backdropFilter:         "blur(20px) saturate(160%)",
        WebkitBackdropFilter:   "blur(20px) saturate(160%)",
        borderBottom:           "1px solid var(--app-border)",
        boxShadow:              "0 2px 12px rgba(0,0,0,0.06)",
        transition:             "left 220ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Search */}
      <form
        style={{ width: 320 }}
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          const val = e.target.elements.globalSearch.value.trim();
          if (!val) return;
          navigate("/leads", { state: { presetSearch: val } });
          e.target.reset();
        }}
      >
        <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app transition">
          <Search style={{ width: 15, height: 15 }} />
        </button>
        <input
          name="globalSearch"
          placeholder="Search leads by name, phone…"
          className="w-full rounded-xl pl-9 pr-3 py-2 text-sm text-app"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", outline: "none" }}
          onFocus={(e) => { e.target.style.borderColor = "var(--app-primary)"; }}
          onBlur={(e)  => { e.target.style.borderColor = "var(--app-border)"; }}
        />
      </form>

      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark
            ? <MoonStar className="w-5 h-5" style={{ color: "var(--app-primary)" }} />
            : <SunMedium className="w-5 h-5" style={{ color: "var(--app-primary)" }} />}
        </button>

        {/* Bell */}
        <div ref={desktopBellRef}>
          <button
            onClick={openAlerts}
            className="relative p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title="New lead alerts"
            style={{ color: alertCount > 0 ? "var(--app-primary)" : undefined }}
          >
            <Bell className={`w-5 h-5${alertCount > 0 ? " bell-ringing" : ""}`} />
            {alertCount > 0 && (
              <span className="badge-glow absolute -top-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: "var(--app-primary)" }}>
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>
        </div>

        {/* Profile button */}
        <button
          ref={desktopProfileBtnRef}
          onClick={openDesktopProfileMenu}
          title={user?.name}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all ml-1"
        >
          <div
            className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden"
            style={{ width: 32, height: 32, background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}
          >
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          <ChevronDown
            className={`flex-shrink-0 text-app-soft transition-transform ${desktopProfileOpen ? "rotate-180" : ""}`}
            style={{ width: 13, height: 13 }}
          />
        </button>
      </div>
    </div>,
    document.body
  );

  // ── Desktop profile dropdown portal ──────────────────────────────────────
  const DesktopProfilePortal = desktopProfileOpen ? createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9997 }} onClick={() => setDesktopProfileOpen(false)} />
      <div
        style={{
          position:     "fixed",
          top:          desktopProfilePos.top,
          right:        desktopProfilePos.right,
          zIndex:       9999,
          width:        260,
          background:   isDark ? "rgb(30,29,32)" : "#fff",
          border:       "1px solid var(--app-border)",
          borderRadius: "1.25rem",
          overflow:     "hidden",
          boxShadow:    "0 16px 48px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.10)",
        }}
      >
        {/* ── User card: two-column ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--app-border)" }}>
          {/* Small avatar */}
          <div className="rounded-full overflow-hidden flex items-center justify-center font-bold text-base flex-shrink-0"
            style={{ width: 44, height: 44, background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)", border: "2px solid rgba(var(--app-primary-rgb),0.2)" }}>
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          {/* Right: name, role, contact */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-app leading-tight truncate">{user?.name}</p>
            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
              style={{ background: "rgba(var(--app-primary-rgb),0.10)", color: "var(--app-primary)" }}>
              {user?.role?.replace("_", " ")}
            </span>
            <div className="mt-1.5 space-y-0.5">
              {user?.phone && (
                <div className="flex items-center gap-1.5 text-[11px] text-app-soft">
                  <Phone style={{ width: 10, height: 10, flexShrink: 0 }} />
                  <span>{user.phone}</span>
                </div>
              )}
              {user?.email && (
                <div className="flex items-center gap-1.5 text-[11px] text-app-soft">
                  <Mail style={{ width: 10, height: 10, flexShrink: 0 }} />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Clock In / Out ── */}
        {attendanceEnabled && (
          <div className="px-3 pt-3 pb-1">
            {isClockedOut ? (
              <div className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-app-soft"
                style={{ background: "var(--app-surface-low)" }}>
                <Clock style={{ width: 13, height: 13 }} />
                Done for today
              </div>
            ) : isClockedIn ? (
              <button onClick={() => { handleClockOut(); setDesktopProfileOpen(false); }} disabled={clocking}
                className="w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {clockTimer || "Active"} · Clock Out
              </button>
            ) : (
              <button onClick={() => { handleClockIn(); setDesktopProfileOpen(false); }} disabled={clocking}
                className="w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "#22c55e", color: "#fff" }}>
                <LogInIcon style={{ width: 13, height: 13 }} />
                Clock IN
              </button>
            )}
          </div>
        )}

        {/* ── Live date & time ── */}
        <div className="mx-3 mb-2 mt-2 px-3 py-1.5 rounded-xl flex items-center gap-2"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-app-soft flex-shrink-0">Date &amp; Time</p>
          <p className="text-[10px] font-bold text-app tabular-nums truncate">{wallClock}</p>
        </div>

        {/* ── Quick links ── */}
        <div className="px-2 pb-1">
          <button onClick={() => { navigate("/settings"); setDesktopProfileOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left">
            <User style={{ width: 13, height: 13, flexShrink: 0 }} />
            My Profile
          </button>
          <button onClick={() => { navigate("/referrals"); setDesktopProfileOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left">
            <Gift style={{ width: 13, height: 13, flexShrink: 0, color: "#ff6b00" }} />
            Referrals
          </button>
        </div>

        {/* ── Sign out ── */}
        <div className="px-3 pb-3 border-t pt-1.5" style={{ borderColor: "var(--app-border)" }}>
          <button onClick={() => { handleLogout(); setDesktopProfileOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-xl transition-all text-red-500 hover:bg-red-500/10 text-left">
            <LogOut style={{ width: 13, height: 13, flexShrink: 0 }} />
            Log Out
          </button>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {AlertsPortal}
      {FlyoutPortal}
      {DesktopTopbarPortal}
      {DesktopProfilePortal}

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 px-3 py-2.5 flex items-center justify-between mobile-topbar"
        style={{
          minHeight: 52,
          background: "var(--app-surface)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "1px solid var(--app-border)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Search overlay mode */}
        {mobileSearchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-soft" />
              <input
                ref={mobileSearchRef}
                value={mobileSearchQ}
                onChange={(e) => setMobileSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && mobileSearchQ.trim()) {
                    navigate("/leads", { state: { presetSearch: mobileSearchQ.trim() } });
                    setMobileSearchOpen(false); setMobileSearchQ("");
                  }
                  if (e.key === "Escape") { setMobileSearchOpen(false); setMobileSearchQ(""); }
                }}
                placeholder="Search leads by name, phone…"
                className="w-full rounded-xl pl-9 pr-3 py-2 text-sm text-app"
                style={{ background: "var(--app-surface-low)", border: "1.5px solid var(--app-primary)", outline: "none" }}
              />
            </div>
            <button onClick={() => { setMobileSearchOpen(false); setMobileSearchQ(""); }}
              className="p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            {/* Brand */}
            <NavLink to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 min-w-0">
              {org?.logo && !logoError ? (
                <>
                  <div className="h-7 max-w-[72px] flex items-center flex-shrink-0">
                    <img key={org.logo} src={org.logo} alt={org.name} className="max-h-full max-w-full object-contain" style={{ borderRadius: 5 }}
                      onError={() => setLogoError(true)} />
                  </div>
                  <span className="font-bold text-sm text-app truncate max-w-[90px]">{org.name}</span>
                  <img src="/logo.png" alt="AL" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 shadow">
                    <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
                  </div>
                  <span className="font-black text-sm tracking-tight text-app">Arthaleads</span>
                </>
              )}
            </NavLink>

            {/* Right icons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Search icon */}
              <button onClick={() => setMobileSearchOpen(true)}
                className="p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5" title="Search leads">
                <Search className="w-5 h-5" />
              </button>

              {/* Bell */}
              <div ref={mobileBellRef}>
                <button onClick={openAlerts} className="relative p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5" title="New lead alerts"
                  style={{ color: alertCount > 0 ? "var(--app-primary)" : undefined }}>
                  <Bell className={`w-5 h-5${alertCount > 0 ? " bell-ringing" : ""}`} />
                  {alertCount > 0 && (
                    <span className="badge-glow absolute -top-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: "var(--app-primary)" }}>
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Menu */}
              <button onClick={() => setOpen(!open)} className="p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5">
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </>
        )}
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
          <NavContent isExpanded={expanded} showPin={true} showProfile={false} />
        </div>
      </aside>

      <AttendanceCapture
        open={captureOpen}
        mode={captureMode}
        required={requireSelfie}
        submitting={clocking}
        onClose={() => setCaptureOpen(false)}
        onConfirm={submitClock}
      />
    </>
  );
}
