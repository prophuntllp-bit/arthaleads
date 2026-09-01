import { useState } from "react";
import { Flag, Check } from "lucide-react";
import api from "../services/api";

const REASONS = [
  ["offensive", "Offensive"],
  ["inaccurate", "Wrong or misleading"],
  ["harmful", "Harmful advice"],
  ["privacy", "Exposed private data"],
  ["other", "Something else"],
];

// Flags something the assistant said, without leaving the app.
//
// Google Play's AI-Generated Content policy requires this on any app that shows
// AI-generated output, and specifically requires it to work in-app — a mailto:
// or a support page does not satisfy it.
//
// Sits quiet until used. It has to be present on every answer to meet the
// policy, and an alarming control on every message would read as though we
// expect the assistant to misbehave.
export default function ReportMessageButton({ reportedText, prompt = "", page = "", surface = "web" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("offensive");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error

  const send = async () => {
    setState("sending");
    try {
      await api.post("/help/report", { reportedText, prompt, page, surface, reason, detail });
      setState("sent");
      setTimeout(() => setOpen(false), 1600);
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="mt-1.5 inline-flex items-center gap-1 text-xs" style={{ color: "var(--app-text-soft)" }}>
        <Check className="h-3 w-3" /> Thanks — we'll review this.
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] opacity-50 transition hover:opacity-100"
        style={{ color: "var(--app-text-soft)" }}
        aria-label="Report this response">
        <Flag className="h-2.5 w-2.5" /> Report
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl p-2.5 text-xs"
      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
      <p className="mb-1.5 font-semibold" style={{ color: "var(--app-text)" }}>
        What's wrong with this response?
      </p>

      <div className="mb-2 flex flex-wrap gap-1">
        {REASONS.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setReason(value)}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold transition"
            style={reason === value
              ? { background: "rgba(255,107,0,0.12)", color: "var(--app-primary, #ff6b00)", border: "1px solid rgba(255,107,0,0.3)" }
              : { background: "transparent", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
            {label}
          </button>
        ))}
      </div>

      <textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)}
        placeholder="Anything else we should know? (optional)"
        className="mb-2 w-full rounded-lg px-2 py-1.5 text-xs"
        style={{ background: "var(--app-surface)", color: "var(--app-text)", border: "1px solid var(--app-border)" }} />

      {state === "error" && (
        <p className="mb-2 text-[11px]" style={{ color: "#ef4444" }}>
          Couldn't send that. Please try again.
        </p>
      )}

      <div className="flex gap-1.5">
        <button type="button" onClick={send} disabled={state === "sending"}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--app-primary, #ff6b00)" }}>
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setState("idle"); }}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
          style={{ color: "var(--app-text-soft)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
