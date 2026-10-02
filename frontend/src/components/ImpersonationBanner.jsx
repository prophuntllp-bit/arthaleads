import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, Shield } from "lucide-react";
import api from "../services/api";

export default function ImpersonationBanner() {
  const { logout } = useAuth();
  const [data] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("impersonating")); }
    catch { return null; }
  });

  if (!data) return null;

  // Two ways to get here: a super admin's "Login As" (support), or an org
  // admin's "Switch account" (kind: "switch"). Same mechanics, different
  // wording and a different place to land afterwards.
  const isSwitch = data.kind === "switch";

  const exit = async () => {
    sessionStorage.removeItem("impersonating");
    try { localStorage.removeItem("crm_user"); sessionStorage.removeItem("crm_user"); } catch { /* storage blocked */ }
    // Restore the super admin's own session so exiting lands back in the
    // admin panel instead of forcing a fresh login. Falls back to a full
    // logout if we never captured a token (or it's since expired).
    if (data.superAdminToken) {
      try {
        await api.post("/auth/restore-admin-session", { token: data.superAdminToken });
        window.location.href = data.returnTo || "/super-admin/orgs";
        return;
      } catch { /* fall through to full logout below */ }
    }
    await logout();
    window.location.href = isSwitch ? "/login" : "/admin-login";
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5"
      style={{ background: "linear-gradient(90deg,#a04100,#ff6b00)", boxShadow: "0 2px 12px rgba(255,107,0,0.4)" }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Shield className="w-4 h-4 text-white/80 flex-shrink-0" />
        <p className="text-white text-xs font-semibold truncate">
          Viewing as <strong>{data.adminName}</strong>
          {isSwitch ? <span className="capitalize"> ({data.role})</span> : <> · {data.orgName}</>}
        </p>
        <span className="hidden lg:inline text-white/70 text-xs truncate">
          {isSwitch ? "Anything you change now is saved under their name." : `(${data.adminEmail})`}
        </span>
      </div>
      <button
        onClick={exit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex-shrink-0 cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        {isSwitch ? "Switch back" : "Exit Impersonation"}
      </button>
    </div>
  );
}
