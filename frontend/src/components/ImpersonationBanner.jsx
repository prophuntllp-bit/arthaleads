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

  const exit = async () => {
    // Tell backend to clear activeSupportSession and mark record completed
    try {
      if (data.orgId && data.requestId) {
        await api.post(`/super-admin/orgs/${data.orgId}/end-support-session`, { requestId: data.requestId });
      }
    } catch { /* non-blocking */ }
    sessionStorage.removeItem("impersonating");
    await logout();
    window.location.href = "/admin-login";
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5"
      style={{ background: "linear-gradient(90deg,#a04100,#ff6b00)", boxShadow: "0 2px 12px rgba(255,107,0,0.4)" }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Shield className="w-4 h-4 text-white/80 flex-shrink-0" />
        <p className="text-white text-xs font-semibold truncate">
          Viewing as <strong>{data.adminName}</strong> · {data.orgName}
        </p>
        {data.reasonLabel && (
          <span className="hidden sm:inline text-white/70 text-xs">— {data.reasonLabel}</span>
        )}
        <span className="hidden lg:inline text-white/60 text-xs truncate">({data.adminEmail})</span>
      </div>
      <button
        onClick={exit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex-shrink-0 cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        Exit Impersonation
      </button>
    </div>
  );
}
