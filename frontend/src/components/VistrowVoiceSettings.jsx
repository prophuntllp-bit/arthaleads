import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Copy, Mic, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { Spinner } from "./UI";

// Recreated from Vistrow Voice's actual app icon (a hand-drawn approximation,
// not their exact source asset — see conversation for why). Self-contained:
// includes its own rounded-square gradient background, so wrap it in a plain
// sizing div (no separate bg-* class) wherever it's used.
export function VistrowVoiceIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vistrowVoiceGrad" x1="4" y1="37" x2="37" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="50%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="url(#vistrowVoiceGrad)" />
      <path
        d="M6 20 H11 C12.5 20 13 15.5 14.5 15.5 C16 15.5 16.5 24.5 18 24.5
           C19.2 24.5 19.8 10 21.5 10 C23.2 10 23.8 24.5 25 24.5
           C26.2 24.5 26.8 20 28 20 H31 C32 20 32 17 34 17"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/* ─── Vistrow Voice: per-connection token card ─────────────────────────────── */
function VoiceCard({ conn, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isConnected = conn.status === "connected";

  const copy = () => {
    navigator.clipboard.writeText(conn.token);
    setCopied(true);
    toast.success("Token copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${conn.name}" from Arthaleads? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/automations/${conn.id}`);
      onDelete(conn.id);
      toast.success("Connection removed");
    } catch {
      toast.error("Failed to remove connection");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${isConnected ? "border-emerald-500/30" : "border-[var(--app-border)]"}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${isConnected ? "bg-emerald-500" : "bg-[var(--app-surface-low)]"}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${isConnected ? "bg-white/20" : "bg-violet-500"}`}>
          <Mic className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${isConnected ? "text-white" : "text-app"}`}>{conn.name}</p>
          {conn.lastSyncAt && <p className={`text-xs ${isConnected ? "text-white/70" : "text-app-soft"}`}>Last lead: {new Date(conn.lastSyncAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">✓ Connected</span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Pending</span>
          )}
          <button onClick={handleDelete} disabled={deleting} className={`p-1.5 rounded-lg hover:bg-black/10 transition ${isConnected ? "text-white/60 hover:text-white" : "text-app-soft hover:text-red-400"}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <code className="flex-1 rounded-xl px-3 py-2 text-sm font-mono font-bold text-violet-400 tracking-wider min-w-0 truncate" style={{ background: "var(--app-surface-low)" }}>
          {conn.token}
        </code>
        <button onClick={copy} className="btn-secondary rounded-xl px-3 py-2 shrink-0 flex items-center gap-1.5 text-xs">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ─── Vistrow Voice: connection tokens (the inbound side: Vistrow sends qualified calls here) ── */
export function VoiceConnectionPanel({ onChanged }) {
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [adding, setAdding] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const serverBase = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  const endpoint = `${serverBase}/webhook/lead`;

  const load = useCallback((isInitial = false) => {
    if (isInitial) setLoading(true);
    return api.get("/automations/voice/connections")
      .then(({ data }) => setConnections(data.connections || []))
      .catch(() => isInitial && toast.error("Failed to load connections"))
      .finally(() => isInitial && setLoading(false));
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAdd = async () => {
    setAdding(true);
    try {
      // Bare "Vistrow Voice" for the first connection — a number only makes
      // sense once there's a second one to tell apart.
      const name = connections.length === 0 ? "Vistrow Voice" : `Vistrow Voice ${connections.length + 1}`;
      const { data } = await api.post("/automations/voice/create", { name });
      setConnections((prev) => [...prev, data.connection]);
      onChanged?.();
      toast.success("New token created — paste it into Vistrow Voice's webhook sender.");
    } catch {
      toast.error("Failed to create connection");
    } finally {
      setAdding(false);
    }
  };

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <section className="card p-6 space-y-4" data-testid="voice-connection">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden"><VistrowVoiceIcon size={40} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-app">Connection token</h2>
          <p className="text-xs text-app-soft">Lets Vistrow Voice send qualified calls into ArthaLeads as leads. Each connection gets its own token.</p>
        </div>
      </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <>
              {/* Intro (only before a connection exists) */}
              {connections.length === 0 && (
                <p className="text-sm text-app-soft">
                  Create a connection to get your token, paste it into Vistrow Voice, and your calls will start showing up here as leads — automatically.
                </p>
              )}

              {/* Connections */}
              {connections.map((conn) => (
                <VoiceCard
                  key={conn.id}
                  conn={conn}
                  onDelete={(id) => { setConnections((prev) => prev.filter((c) => c.id !== id)); onChanged?.(); }}
                />
              ))}

              <button
                type="button"
                onClick={handleAdd}
                disabled={adding}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold border-2 border-dashed border-[var(--app-border)] text-app-soft hover:border-violet-500 hover:text-violet-400 transition"
              >
                {adding ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
                {adding ? "Creating…" : connections.length ? "Add Another Connection" : "Add Voice Connection"}
              </button>

              {/* Friendly setup steps */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--app-surface-low)" }}>
                <p className="text-xs font-bold text-app-soft uppercase tracking-wider">How to connect</p>
                {[
                  'Click "Add Voice Connection" to generate your token.',
                  "Copy the token shown above.",
                  "In Vistrow Voice, open the Arthaleads integration and paste it in.",
                  "That's it — qualified calls flow straight into your leads.",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold mt-0.5">{i + 1}</span>
                    <p className="text-sm text-app-soft">{t}</p>
                  </div>
                ))}
              </div>

              {/* Developer details — hidden by default, for manual/custom senders */}
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowSteps((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-app-soft uppercase tracking-wider hover:text-app transition"
                >
                  <span>Developer details (optional)</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${showSteps ? "rotate-90" : ""}`} />
                </button>
                {showSteps && (
                  <div className="px-4 py-3 space-y-3" style={{ borderTop: "1px solid var(--app-border)" }}>
                    <p className="text-xs text-app-soft">Only needed if you're wiring a custom sender by hand — the Vistrow Voice integration does this for you.</p>
                    <div>
                      <p className="text-xs text-app-soft mb-1">Endpoint</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-xl px-3 py-2 text-xs text-violet-400" style={{ background: "var(--app-surface-low)" }}>{endpoint}</code>
                        <button type="button" className="btn-secondary rounded-xl shrink-0" onClick={() => copyText(endpoint, "Endpoint")}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <pre className="overflow-x-auto rounded-xl px-3 py-2 text-xs text-violet-400" style={{ background: "var(--app-surface-low)" }}>{`POST { "token", "name", "phone", "email", "message" }`}</pre>
                    <p className="text-xs text-app-soft"><span className="text-violet-400 font-semibold">message</span> becomes the lead's Requirements. Leads arrive as source <span className="text-violet-400 font-semibold">Vistrow Voice</span>.</p>
                  </div>
                )}
              </div>
            </>
          )}
    </section>
  );
}
