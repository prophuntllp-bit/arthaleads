// StorageWarningPopup.jsx — one-time-a-day popup for admins when file space is
// at 80% or full. The sidebar card is the quiet reminder; this is the one that
// makes sure somebody who can act on it has seen it.
import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Modal } from "./UI";
import { formatBytes } from "../utils/plan";
import StorageManageModal from "./StorageManageModal";

const KEY = "storage_popup_seen";

function seenToday(level) {
  try {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return localStorage.getItem(KEY) === `${day}:${level}`;
  } catch { return false; }
}
function markSeen(level) {
  try {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    localStorage.setItem(KEY, `${day}:${level}`);
  } catch { /* private mode */ }
}

export default function StorageWarningPopup() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") return undefined;
    let alive = true;
    const t = setTimeout(() => {
      api.get("/org/storage").then((r) => {
        const st = r.data.storage;
        if (!alive || !st?.warn) return;
        const level = st.full ? 100 : 80;
        if (seenToday(level)) return;
        setS(st); setOpen(true);
      }).catch(() => {});
    }, 4000);
    return () => { alive = false; clearTimeout(t); };
  }, [user?.role]);

  if (!s) return null;
  const close = () => { markSeen(s.full ? 100 : 80); setOpen(false); };
  const pct = Math.min(100, Math.round(s.percent));

  return (
    <>
    <StorageManageModal open={manage} onClose={() => setManage(false)} />
    <Modal open={open} onClose={close} title={s.full ? "Your file space is full" : "Your file space is almost full"} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: s.full ? "rgba(220,38,38,0.12)" : "rgba(245,158,11,0.14)" }}>
            <HardDrive className="w-5 h-5" style={{ color: s.full ? "#dc2626" : "#d97706" }} />
          </div>
          <p className="text-sm text-app-soft leading-relaxed">
            {s.full
              ? "New photos, brochures, floor plans and videos can't be uploaded until you free some space or add more. Your leads and everything already stored are safe."
              : "Project photos, brochures, videos and call recordings are close to your plan's limit. Once it's full, new uploads stop."}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-app">{formatBytes(s.usedBytes)} of {formatBytes(s.limitBytes)}</span>
            <span className="font-semibold text-app tabular-nums">{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.full ? "#dc2626" : "#f59e0b" }} />
          </div>
        </div>
        <p className="text-xs text-app-soft">Removing unused project videos and old photos frees the most space.</p>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary rounded-xl cursor-pointer" onClick={close}>Remind me tomorrow</button>
          <button type="button" className="btn-primary rounded-xl cursor-pointer" onClick={() => { close(); setManage(true); }}>Free up or add space</button>
        </div>
      </div>
    </Modal>
    </>
  );
}
