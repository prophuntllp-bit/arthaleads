import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Search } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// "Switch account" inside the profile menu. Admins only: signs in as someone
// on their own team for up to 2 hours (POST /auth/switch-user/:id), with an
// orange "Viewing as" banner and a one-click way back (ImpersonationBanner).
// Hidden while already switched: you switch back first, then switch again.
export default function AccountSwitcher({ onDone }) {
  const { user, org } = useAuth();
  const [people, setPeople] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const switched = (() => { try { return !!sessionStorage.getItem("impersonating"); } catch { return false; } })();
  const allowed = user?.role === "admin" && !switched;

  useEffect(() => {
    if (!allowed) return;
    api.get("/auth/users")
      .then(({ data }) => setPeople((data.users || []).filter((u) => u.isActive !== false && u.role !== "super_admin")))
      .catch(() => setPeople([]));
  }, [allowed]);

  if (!allowed || !people || people.length < 2) return null;

  const shown = people
    .filter((p) => !q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (String(a._id) === String(user._id) ? -1 : String(b._id) === String(user._id) ? 1 : a.name.localeCompare(b.name)));

  const switchTo = async (p) => {
    if (String(p._id) === String(user._id) || busy) return;
    setBusy(p._id);
    try {
      const { data } = await api.post(`/auth/switch-user/${p._id}`);
      sessionStorage.setItem("impersonating", JSON.stringify({
        kind: "switch",
        adminName: data.user.name, adminEmail: data.user.email, orgName: org?.name || "",
        role: data.user.role, switchedBy: user.name,
        superAdminToken: data.originalToken, returnTo: "/team",
      }));
      // The cached profile is the admin's; drop it so the new page load
      // shows the switched person straight from /auth/me.
      try { localStorage.removeItem("crm_user"); sessionStorage.removeItem("crm_user"); } catch { /* storage blocked */ }
      onDone?.();
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't switch account");
      setBusy("");
    }
  };

  return (
    <div className="border-t px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
      <p className="px-2 pb-1.5 text-[11px] font-semibold text-app-soft">Switch account</p>
      {people.length > 4 && (
        <label className="mx-1 mb-1.5 flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          <Search className="h-3.5 w-3.5 text-app-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a teammate"
            className="w-full bg-transparent text-xs text-app outline-none placeholder:text-app-soft" />
        </label>
      )}
      {/* Two people visible, the rest scroll, so the menu stays short. */}
      <div className="max-h-[92px] space-y-0.5 overflow-y-auto overscroll-contain pr-1">
        {shown.map((p) => {
          const me = String(p._id) === String(user._id);
          return (
            <button key={p._id} type="button" onClick={() => switchTo(p)} disabled={!!busy}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition ${me ? "" : "hover:bg-black/5 dark:hover:bg-white/5"} disabled:opacity-60`}
              style={me ? { background: "var(--app-surface-low)" } : undefined}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
                style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : p.name?.[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-app">{p.name}</span>
                <span className="block truncate text-[11px] capitalize text-app-soft">{busy === p._id ? "Switching…" : p.role?.replace("_", " ")}</span>
              </span>
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: me ? "var(--app-primary)" : "var(--app-border-strong)" }}>
                {me && <span className="h-2 w-2 rounded-full" style={{ background: "var(--app-primary)" }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
