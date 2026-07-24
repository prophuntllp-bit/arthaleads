// ── Soft phone call widget ────────────────────────────────────────────────────
// Floating in-call card shown while an in-app (browser) call is active. Renders
// nothing when idle, so it has zero footprint unless a call is in progress.
import { createPortal } from "react-dom";
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import { useSoftPhone } from "../context/SoftPhoneContext";

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_LABEL = {
  connecting: "Connecting…",
  ringing:    "Ringing…",
  active:     "In call",
  ending:     "Ending…",
};

export default function SoftPhoneWidget() {
  const sp = useSoftPhone();
  if (!sp || sp.status === "idle" || !sp.call) return null;

  const { status, call, muted, elapsed, hangUp, toggleMute } = sp;
  const connecting = status === "connecting" || status === "ringing";

  return createPortal(
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 10000,
        width: 300,
        maxWidth: "calc(100vw - 2rem)",
        background: "var(--app-surface-solid)",
        border: "1px solid var(--app-border)",
        borderRadius: "1.25rem",
        boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
        overflow: "hidden",
      }}
    >
      {/* Header strip */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: status === "active" ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.12)" }}
        >
          {connecting
            ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#f97316" }} />
            : <Phone   className="h-5 w-5" style={{ color: status === "active" ? "#22c55e" : "#f97316" }} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-app">{call.leadName}</p>
          <p className="text-xs text-app-soft">
            {STATUS_LABEL[status] || ""}
            {status === "active" && <span className="ml-1 tabular-nums">· {fmt(elapsed)}</span>}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4">
        <button
          onClick={toggleMute}
          disabled={status !== "active"}
          title={muted ? "Unmute" : "Mute"}
          className="flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-40"
          style={{
            background: muted ? "rgba(249,115,22,0.15)" : "var(--app-surface)",
            border: "1px solid var(--app-border)",
          }}
        >
          {muted
            ? <MicOff className="h-5 w-5" style={{ color: "#f97316" }} />
            : <Mic    className="h-5 w-5 text-app" />}
        </button>

        <button
          onClick={hangUp}
          title="Hang up"
          className="flex h-14 w-14 items-center justify-center rounded-full transition hover:opacity-90"
          style={{ background: "#ef4444" }}
        >
          <PhoneOff className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>,
    document.body
  );
}
