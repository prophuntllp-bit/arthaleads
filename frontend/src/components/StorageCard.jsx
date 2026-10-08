// StorageCard.jsx — the "Used space" card at the foot of the sidebar.
//
// A quiet meter always; the full card once the org has used 80% of its file allowance (photos, brochures,
// videos, recordings), then it says how much is left and where to get more.
// Real figures from GET /org/storage, which sums the files we actually hold.
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatBytes } from "../utils/plan";
import StorageManageModal from "./StorageManageModal";

const DISMISS_KEY = "storage_card_dismissed";
const DISMISS_MS = 24 * 60 * 60 * 1000;   // comes back tomorrow if still over 80%

function dismissedRecently() {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_MS; }
  catch { return false; }
}

export default function StorageCard() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [hidden, setHidden] = useState(dismissedRecently);
  const [manage, setManage] = useState(false);

  const load = useCallback(() => {
    api.get("/org/storage").then((r) => setS(r.data.storage)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || user.role === "super_admin") return undefined;
    load();
    const iv = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [user, load]);

  if (!s) return null;

  const pct = Math.min(100, Math.round(s.percent));
  const isAdmin = user?.role === "admin";

  // Under 80%: a quiet one-line meter, always there, so people can see how much
  // space they use. From 80% it becomes the full card below.
  const modal = <StorageManageModal open={manage} onClose={() => { setManage(false); load(); }} />;
  if (!s.warn) {
    return (
      <>
      {modal}
      <div className="mx-2 mb-2 rounded-xl px-3 py-2.5 flex-shrink-0"
        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-app">Storage</p>
          {isAdmin && (
            <button type="button" onClick={() => setManage(true)} className="text-[11px] font-semibold cursor-pointer" style={{ color: "var(--app-primary)" }}>
              Get more
            </button>
          )}
        </div>
        <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(pct, s.usedBytes > 0 ? 2 : 0)}%`, background: "var(--app-primary)" }} />
        </div>
        <p className="mt-1 text-[11px] text-app-soft tabular-nums">{formatBytes(s.usedBytes)} of {formatBytes(s.limitBytes)} used</p>
      </div>
      </>
    );
  }
  // A full allowance is not something to hide for a day: uploads are blocked.
  if (hidden && !s.full) return null;
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setHidden(true);
  };
  const barColor = s.full ? "#dc2626" : "var(--app-primary)";

  return (
    <>
    {modal}
    <div className="mx-2 mb-2 rounded-xl p-3 flex-shrink-0"
      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-app leading-tight">Used space</p>
        {!s.full && (
          <button type="button" onClick={dismiss} aria-label="Dismiss"
            className="-mt-0.5 -mr-1 p-1 rounded-md text-app-soft hover:text-app transition cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-app-soft leading-snug">
        {s.full
          ? "Your file space is full. New uploads are blocked until you free some up or add more."
          : `You've used ${pct}% of your file space (${formatBytes(s.usedBytes)} of ${formatBytes(s.limitBytes)}).`}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <span className="text-xs font-semibold text-app tabular-nums">{pct}%</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {!s.full && (
          <button type="button" onClick={dismiss} className="text-xs font-semibold text-app-soft hover:text-app transition cursor-pointer">
            Dismiss
          </button>
        )}
        {isAdmin ? (
          <button type="button" onClick={() => setManage(true)} className="text-xs font-semibold cursor-pointer" style={{ color: "var(--app-primary)" }}>
            Free up or add space
          </button>
        ) : (
          <span className="text-xs text-app-soft">Ask your admin for more space</span>
        )}
      </div>
    </div>
    </>
  );
}
