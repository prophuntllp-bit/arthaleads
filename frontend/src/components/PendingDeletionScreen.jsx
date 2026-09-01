import { useEffect, useState } from "react";
import { Spinner } from "./UI";
import api from "../services/api";

// Shown when the organisation is inside its deletion window.
//
// The whole point of the 30-day grace period is that it can be called off, so
// this screen exists to make cancelling reachable: the backend deliberately
// exempts the deletion endpoints from the freeze that produced this screen. It
// leads with how long is left, because that is the only thing a person in this
// position actually wants to know.
//
// White card in both themes, matching the other blocking overlays — a person
// hitting this is often signing in somewhere unfamiliar to stop it.
export default function PendingDeletionScreen({ onLogout }) {
  const [status, setStatus] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/auth/account/deletion")
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({}));
  }, []);

  const daysLeft = status?.scheduledFor
    ? Math.max(0, Math.ceil((new Date(status.scheduledFor) - Date.now()) / 86400000))
    : null;

  const cancel = async () => {
    setError("");
    setCancelling(true);
    try {
      await api.delete("/auth/account/deletion");
      setDone(true);
      // A full reload is the honest way back: the org gate, the cached org and
      // every screen behind this overlay were all built on "frozen".
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel. Please try again.");
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="max-w-sm w-full rounded-3xl p-8 text-center shadow-2xl" style={{ background: "#ffffff" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(239,68,68,0.1)" }}>
          <svg className="w-8 h-8" style={{ color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        {done ? (
          <>
            <h2 className="text-xl font-black mb-2" style={{ color: "#111827" }}>Deletion cancelled</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
              Your workspace is active again. Taking you back in…
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-black mb-2" style={{ color: "#111827" }}>Scheduled for deletion</h2>
            <p className="text-sm leading-relaxed mb-2" style={{ color: "#6b7280" }}>
              {daysLeft === null
                ? "This workspace is scheduled to be deleted."
                : daysLeft === 0
                  ? "This workspace and everything in it will be deleted today."
                  : `This workspace and everything in it will be deleted in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}.`}
            </p>
            {status?.scheduledFor && (
              <p className="text-sm font-semibold mb-6" style={{ color: "#FF6B00" }}>
                {new Date(status.scheduledFor).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
                })}
              </p>
            )}

            {error && (
              <p className="text-sm mb-4" style={{ color: "#ef4444" }}>{error}</p>
            )}

            <button onClick={cancel} disabled={cancelling}
              className="flex w-full items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm mb-3 transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#FF6B00", color: "#ffffff" }}>
              {cancelling ? <><Spinner size="sm" /> Cancelling…</> : "Keep my workspace"}
            </button>
            <button onClick={onLogout}
              className="block w-full py-2.5 rounded-2xl text-sm transition hover:underline"
              style={{ color: "#6b7280" }}>
              Sign Out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
