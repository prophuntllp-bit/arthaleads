import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Building2, Users, TicketIcon, BarChart3,
  Megaphone, FileText, ChevronLeft, ChevronRight, LogOut,
  TrendingUp, ShieldCheck,
} from "lucide-react";

const NAV = [
  { to: "/super-admin",           label: "Dashboard",     icon: LayoutDashboard, end: true },
  { to: "/super-admin/orgs",      label: "Organizations", icon: Building2 },
  { to: "/super-admin/users",     label: "Users",         icon: Users },
  { to: "/super-admin/tickets",   label: "Tickets",       icon: TicketIcon },
  { to: "/super-admin/analytics", label: "Analytics",     icon: BarChart3 },
  { to: "/super-admin/revenue",   label: "Revenue",       icon: TrendingUp },
  { to: "/super-admin/broadcast", label: "Broadcast",     icon: Megaphone },
  { to: "/super-admin/audit",     label: "Audit Log",     icon: ShieldCheck },
  { to: "/super-admin/blog",      label: "Blog",          icon: FileText },
];

export default function AdminSidebar() {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("admin_sidebar_collapsed") === "1"
  );

  const toggle = () => {
    setCollapsed(v => {
      localStorage.setItem("admin_sidebar_collapsed", v ? "0" : "1");
      return !v;
    });
  };

  const handleLogout = () => { logout(); navigate("/admin-login", { replace: true }); };

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-screen sticky top-0 border-r transition-all duration-300"
      style={{
        width: collapsed ? "64px" : "220px",
        background: "var(--app-surface)",
        borderColor: "var(--app-border)",
        zIndex: 30,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-4 border-b flex-shrink-0"
        style={{ borderColor: "var(--app-border)" }}>
        <img src="/logo.png" alt="AL" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-black text-app leading-none truncate">Arthaleads</p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: "var(--app-primary)" }}>Admin Panel</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "text-white"
                  : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
              }`
            }
            style={({ isActive }) => isActive ? { background: "var(--app-primary)" } : {}}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle + logout */}
      <div className="flex-shrink-0 border-t p-2 space-y-0.5" style={{ borderColor: "var(--app-border)" }}>
        <button
          onClick={toggle}
          title={collapsed ? "Expand" : "Collapse"}
          className="flex w-full items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 flex-shrink-0" />
            : <ChevronLeft  className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
