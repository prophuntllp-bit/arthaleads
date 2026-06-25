import { useState, useEffect } from "react";
import { Eye, X } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const REASON_LABELS = {
  customer_support:  "Customer Support",
  onboarding:        "Onboarding Assistance",
  bug_investigation: "Bug Investigation",
  data_migration:    "Data Migration",
  billing_issue:     "Billing Issue",
  other:             "Other",
};

export default function SupportSessionBanner() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // Only show to org admins (not super_admin who is doing the impersonation)
  const isOrgAdmin = user?.role === "admin" && user?.role !== "super_admin";

  useEffect(() => {
    if (!isOrgAdmin) return;
    // Poll every 30s to detect active support sessions
    const check = async () => {
      try {
        const { data } = await api.get("/org/me");
        const s = data?.org?.activeSupportSession;
        if (s?.active) {
          setSession(s);
          setDismissed(false);
        } else {
          setSession(null);
        }
      } catch { /* silent */ }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [isOrgAdmin]);

  const endSession = async () => {
    try {
      await api.post("/org/support-access/end-session");
      setSession(null);
    } catch { /* silent */ }
  };

  if (!isOrgAdmin || !session || dismissed) return null;

  const startedAgo = session.startedAt
    ? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000)
    : null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-xl">
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl"
        style={{
          background: "linear-gradient(135deg,rgba(30,29,32,0.97),rgba(40,38,42,0.97))",
          border: "1px solid rgba(249,115,22,0.35)",
          backdropFilter: "blur(12px)",
        }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}>
          <Eye className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-snug">
            Arthaleads support is viewing your account
          </p>
          <p className="text-[10px] text-white/50 mt-0.5 truncate">
            {session.superAdminName} · {REASON_LABELS[session.reason] || session.reason}
            {startedAgo !== null && ` · ${startedAgo < 1 ? "just now" : `${startedAgo}m ago`}`}
          </p>
        </div>
        <button
          onClick={endSession}
          className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.25)" }}
        >
          End Session
        </button>
        <button onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-white/10 transition flex-shrink-0 text-white/40 hover:text-white/70">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
