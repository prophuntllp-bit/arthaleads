import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, Building2, Users, TicketIcon, BarChart3,
  Megaphone, FileText, TrendingUp, ShieldCheck, Activity,
  LogOut, Menu, X, ChevronUp, MoonStar, SunMedium,
  PanelLeftClose, PanelLeft, Settings,
} from "lucide-react";

const NAV = [
  { to: "/super-admin",            label: "Dashboard",     icon: LayoutDashboard, end: true },
  { to: "/super-admin/orgs",       label: "Organizations", icon: Building2 },
  { to: "/super-admin/users",      label: "Users",         icon: Users },
  { to: "/super-admin/insights",   label: "Insights",      icon: Activity },
  { to: "/super-admin/tickets",    label: "Tickets",       icon: TicketIcon },
  { to: "/super-admin/analytics",  label: "Analytics",     icon: BarChart3 },
  { to: "/super-admin/revenue",    label: "Revenue",       icon: TrendingUp },
  { to: "/super-admin/broadcast",  label: "Broadcast",     icon: Megaphone },
  { to: "/super-admin/audit",      label: "Audit Log",     icon: ShieldCheck },
  { to: "/super-admin/blog",       label: "Blog",          icon: FileText },
];

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();

  // Mobile drawer
  const [open, setOpen] = useState(false);

  // Desktop: hover-to-expand overlay OR pinned (pushes content)
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(
    () => localStorage.getItem("admin_sidebar_pinned") === "true"
  );
  const expanded = pinned || hovered;

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem("admin_sidebar_pinned", String(next));
  };

  // Profile dropdown (inline, expands upward)
  const [profileOpen, setProfileOpen] = useState(false);
  const profileBtnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (profileBtnRef.current?.contains(e.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/admin-login", { replace: true });
  };

  // Label fade — same as CRM sidebar
  const labelStyle = (isExpanded) => ({
    opacity:    isExpanded ? 1 : 0,
    maxWidth:   isExpanded ? 200 : 0,
    overflow:   "hidden",
    whiteSpace: "nowrap",
    transition: "opacity 150ms ease, max-width 200ms ease",
    pointerEvents: "none",
  });

  const NavContent = ({ isExpanded, showPin = false }) => {
    const ls = labelStyle(isExpanded);
    return (
      <div className="flex flex-col h-full">

        {/* ── Header ── */}
        <div className="flex items-center px-3 flex-shrink-0" style={{ height: 68, minHeight: 68 }}>
          <div className="w-10 h-10 flex-shrink-0 rounded-2xl overflow-hidden shadow-md">
            <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
          </div>
          <div className="ml-3 overflow-hidden flex-1" style={ls}>
            <p className="font-black text-base leading-none tracking-tight">
              <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
            </p>
            <p className="text-[8px] font-bold mt-0.5 tracking-widest" style={{ color: "var(--app-primary)" }}>ADMIN PANEL</p>
          </div>

          {/* Pin / unpin (desktop only) */}
          {showPin && (
            <button
              onClick={togglePin}
              title={pinned ? "Collapse sidebar" : "Pin sidebar open"}
              className="flex-shrink-0 p-1.5 rounded-xl text-app-soft hover:text-app hover:bg-black/8 dark:hover:bg-white/8 transition-all"
              style={{
                opacity: isExpanded ? 1 : 0,
                pointerEvents: isExpanded ? "auto" : "none",
                transition: "opacity 150ms",
                marginLeft: 4,
              }}
            >
              {pinned
                ? <PanelLeftClose style={{ width: 16, height: 16 }} />
                : <PanelLeft      style={{ width: 16, height: 16 }} />}
            </button>
          )}
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto py-2" style={{ minHeight: 0 }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
              <span className="ml-3 flex-1" style={ls}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Bottom: profile ── */}
        <div className="mt-auto px-2 pb-3 flex-shrink-0 space-y-0.5 border-t" style={{ borderColor: "var(--app-border)", paddingTop: 6 }}>

          {/* Inline profile dropdown (expands upward) */}
          {profileOpen && isExpanded && (
            <div
              className="mx-2 mb-1 rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--app-border)", background: isDark ? "rgb(30,29,32)" : "#fff" }}
            >
              {/* User info */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--app-border)" }}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm"
                  style={{ background: "rgba(var(--app-primary-rgb), 0.12)", color: "var(--app-primary)" }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-app truncate">{user?.name}</p>
                  <p className="text-xs font-semibold" style={{ color: "var(--app-primary)" }}>Super Admin</p>
                </div>
              </div>

              {/* Actions */}
              <div className="px-2 py-1.5">
                <button
                  onClick={() => { toggleTheme(); setProfileOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-all text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 text-left"
                >
                  {isDark
                    ? <MoonStar  style={{ width: 15, height: 15, flexShrink: 0, color: "var(--app-primary)" }} />
                    : <SunMedium style={{ width: 15, height: 15, flexShrink: 0, color: "var(--app-primary)" }} />}
                  {isDark ? "Dark Mode" : "Light Mode"}
                </button>
              </div>

              {/* Sign out */}
              <div className="px-2 pb-1.5 border-t" style={{ borderColor: "var(--app-border)" }}>
                <button
                  onClick={() => { handleLogout(); setProfileOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-all text-red-500 hover:bg-red-500/10 text-left mt-1"
                >
                  <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Profile button */}
          <button
            ref={profileBtnRef}
            onClick={(e) => { e.stopPropagation(); setProfileOpen(v => !v); }}
            title={!isExpanded ? user?.name : undefined}
            className="w-full flex items-center px-3 py-2 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{ paddingLeft: 10 }}
          >
            <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "rgba(var(--app-primary-rgb), 0.12)", color: "var(--app-primary)" }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="ml-3 flex-1 min-w-0 text-left overflow-hidden" style={ls}>
              <p className="text-sm font-semibold text-app truncate leading-tight">{user?.name}</p>
              <p className="text-xs font-medium leading-tight" style={{ color: "var(--app-primary)" }}>Super Admin</p>
            </div>
            <ChevronUp
              className="flex-shrink-0 text-app-soft"
              style={{
                width: 14, height: 14,
                opacity: isExpanded ? 0.6 : 0,
                transition: "opacity 150ms, transform 150ms",
                transform: profileOpen ? "rotate(0deg)" : "rotate(180deg)",
              }}
            />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between border-b sidebar-glass mobile-topbar"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-black text-sm tracking-tight">
              <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
            </span>
            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
              ADMIN
            </span>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-40 w-72 transform transition-transform duration-200 sidebar-glass flex flex-col overflow-hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <NavContent isExpanded={true} />
      </div>

      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
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
          onMouseEnter={() => { if (!pinned) setHovered(true); }}
          onMouseLeave={() => { if (!pinned) setHovered(false); }}
          className="sidebar-glass flex flex-col h-full overflow-hidden"
          style={{
            position:   pinned ? "relative" : "absolute",
            left: 0, top: 0, bottom: 0,
            width:      expanded ? 240 : 64,
            transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
            zIndex: 30,
          }}
        >
          <NavContent isExpanded={expanded} showPin={true} />
        </div>
      </aside>
    </>
  );
}
