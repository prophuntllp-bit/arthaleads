// components/Sidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, UserCheck, Settings,
  LogOut, Building2, Menu, X, Kanban, MoonStar, SunMedium, LifeBuoy, BarChart3, Workflow
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { to: "/",          label: "Dashboard",  icon: LayoutDashboard },
  { to: "/leads",     label: "Leads",      icon: Users },
  { to: "/pipeline",  label: "Pipeline",   icon: Kanban },
  { to: "/team",      label: "Team",       icon: UserCheck, roles: ["admin"] },
  { to: "/automation", label: "Automation", icon: Workflow, roles: ["admin", "manager"] },
  { to: "/performance", label: "Performance", icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/settings",  label: "Settings",   icon: Settings },
  { to: "/help-support", label: "Help & Support", icon: LifeBuoy },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filtered = navItems.filter(
    (n) => !n.roles || n.roles.includes(user?.role)
  );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-[#a04100] to-[#ff6b00]">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none tracking-tight text-app">PropCRM</p>
            <p className="stitch-kicker mt-1">Premium Real Estate CRM</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
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

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between border-b sidebar-glass"
        style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#a04100] to-[#ff6b00]">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-app block leading-none">PropCRM</span>
            <span className="stitch-kicker mt-1 block">Real Estate</span>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-xl text-app hover:bg-black/5 dark:hover:bg-white/5">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-40 w-72 transform transition-transform duration-200 sidebar-glass ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <NavContent />
      </div>

      <aside
        className="hidden lg:flex flex-col w-64 h-screen sticky top-0 flex-shrink-0 sidebar-glass"
      >
        <NavContent />
      </aside>
    </>
  );
}
