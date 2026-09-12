import { useEffect, useRef, useState } from "react";
import {
  Sparkles, ChevronDown, Building2, Megaphone, Plus, X, Check, Loader2,
  Power, MessageSquare, Send, AlertTriangle, Eye,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

/**
 * The AI WhatsApp agent's own page — separate from connection/credentials
 * (WhatsAppSettings.jsx) on purpose. Configuring what the assistant says and
 * knows is a different job from plumbing in a provider, done by a different
 * person at a different cadence, and it kept getting lost at the bottom of a
 * long credentials form.
 */
export default function AgentStudio() {
  const [loading, setLoading]         = useState(true);
  const [botEnabled, setBotEnabled]   = useState(true);
  const [botName, setBotName]         = useState("Artha Assistant");
  const [botPrompt, setBotPrompt]     = useState("");
  const [botGreeting, setBotGreeting] = useState("");
  const [botGroundRules, setBotGroundRules]         = useState("");
  const [botBusinessContext, setBotBusinessContext] = useState("");
  const [botProjectIds, setBotProjectIds]           = useState([]); // empty = all active projects
  const [botAdProjectMap, setBotAdProjectMap]       = useState([]); // [{ adId, label, projectIds: [] }]
  const [projects, setProjects]       = useState([]);
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [saving, setSaving]           = useState(false);

  // Try-it console
  const [tryOpen, setTryOpen]     = useState(false);
  const [tryInput, setTryInput]   = useState("");
  const [tryLog, setTryLog]       = useState([]);
  const [trying, setTrying]       = useState(false);
  const [tryMeta, setTryMeta]     = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const tryEndRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get("/whatsapp/settings"),
      api.get("/projects"),
    ]).then(([settingsRes, projectsRes]) => {
      const s = settingsRes.data.whatsapp || {};
      setBotEnabled(s.botEnabled ?? true);
      setBotName(s.botName || "Artha Assistant");
      setBotPrompt(s.botSystemPrompt || "");
      setBotGreeting(s.botGreeting || "");
      setBotGroundRules(s.botGroundRules || "");
      setBotBusinessContext(s.botBusinessContext || "");
      setBotProjectIds((s.botProjectIds || []).map(String));
      setBotAdProjectMap((s.botAdProjectMap || []).map(m => ({
        adId: m.adId || "", label: m.label || "", projectIds: (m.projectIds || []).map(String),
      })));
      setShowAdvancedPrompt(!!s.botSystemPrompt);
      setProjects(projectsRes.data?.data || []);
    }).catch(() => toast.error("Could not load the AI agent's settings")
    ).finally(() => setLoading(false));
  }, []);

  // The master switch saves on its own rather than waiting for the Save button
  // — turning the assistant off is an "I need this to stop now" action, and
  // making it wait behind a form save is how you keep replying to customers
  // you meant to stop replying to.
  const toggleBotEnabled = async () => {
    const next = !botEnabled;
    setBotEnabled(next);
    try {
      await api.patch("/whatsapp/settings", { botEnabled: next });
      toast.success(next ? "AI assistant is answering new messages" : "AI assistant paused — new messages go to your team");
    } catch {
      setBotEnabled(!next);
      toast.error("Could not change that");
    }
  };

  const runTry = async () => {
    const text = tryInput.trim();
    if (!text || trying) return;
    setTryInput("");
    const history = tryLog.map((m) => ({ role: m.role, body: m.body }));
    setTryLog((l) => [...l, { role: "user", body: text }]);
    setTrying(true);
    try {
      const { data } = await api.post("/whatsapp/agent/preview", { message: text, history });
      setTryLog((l) => [...l, { role: "assistant", body: data.reply || "(no reply)", handoff: data.handoff }]);
      setTryMeta(data);
    } catch (e) {
      setTryLog((l) => [...l, { role: "error", body: e.response?.data?.message || "The assistant could not answer." }]);
    } finally { setTrying(false); }
  };

  useEffect(() => { tryEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [tryLog, trying]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/whatsapp/settings", {
        botName,
        botSystemPrompt: botPrompt,
        botGreeting,
        botGroundRules,
        botBusinessContext,
        botProjectIds,
        botAdProjectMap,
      });
      toast.success("Assistant settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const toggleProject = (id) => {
    setBotProjectIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const addAdMapping = () => setBotAdProjectMap((c) => [...c, { adId: "", label: "", projectIds: [] }]);
  const removeAdMapping = (idx) => setBotAdProjectMap((c) => c.filter((_, i) => i !== idx));
  const updateAdMapping = (idx, patch) => setBotAdProjectMap((c) => c.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const toggleAdMappingProject = (idx, projectId) => setBotAdProjectMap((c) => c.map((r, i) => {
    if (i !== idx) return r;
    const has = r.projectIds.includes(projectId);
    return { ...r, projectIds: has ? r.projectIds.filter((x) => x !== projectId) : [...r.projectIds, projectId] };
  }));

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <div className="h-4 w-40 rounded animate-pulse" style={{ background: "var(--app-surface-low)" }} />
        <div className="h-9 w-full rounded animate-pulse" style={{ background: "var(--app-surface-low)" }} />
        <div className="h-9 w-full rounded animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* The org-wide switch. It has existed on the server since the bot was
          built and was read on every inbound message, but no screen ever
          rendered it — so the only way to stop the AI was to open each
          conversation and flip it one at a time. */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={botEnabled
                ? { background: "rgba(34,197,94,0.12)" }
                : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <Power className="w-4 h-4" style={{ color: botEnabled ? "#15803d" : "var(--app-text-soft)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-app">
                {botEnabled ? "The assistant is answering automatically" : "The assistant is paused"}
              </p>
              <p className="text-xs text-app-soft mt-0.5 max-w-md">
                {botEnabled
                  ? "Every new WhatsApp message gets an AI reply unless you switch that thread to Manual in the inbox."
                  : "New messages arrive in the inbox and wait for a person. Nothing is auto-answered."}
              </p>
            </div>
          </div>
          <button type="button" onClick={toggleBotEnabled} role="switch" aria-checked={botEnabled}
            className="relative shrink-0 rounded-full transition"
            style={{
              width: 46, height: 26,
              background: botEnabled ? "#22c55e" : "var(--app-border-strong)",
            }}>
            <span className="absolute top-0.5 rounded-full bg-white transition-all"
              style={{ width: 22, height: 22, left: botEnabled ? 22 : 2 }} />
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
          <h3 className="text-base font-bold text-app">Agent Studio</h3>
        </div>
        <p className="text-sm text-app-soft">
          Your AI assistant answers from your real Projects — not a crawled website. Pick which
          projects it can talk about; edit a price or amenity on the Projects page and the next
          reply reflects it immediately, nothing to resync.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Assistant name</label>
            <input className="input w-full" placeholder="Artha Assistant"
              value={botName} onChange={e => setBotName(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">
              Greeting message <span className="text-app-soft font-normal">(optional)</span>
            </label>
            <input className="input w-full" placeholder="Hi! Thanks for reaching out — how can I help you find your next home?"
              value={botGreeting} onChange={e => setBotGreeting(e.target.value)} />
            <p className="text-xs text-app-soft mt-1">Sent automatically as the first message when someone new writes in.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">
              Business context <span className="text-app-soft font-normal">(optional)</span>
            </label>
            <textarea className="input w-full resize-none" rows={2}
              placeholder="Who you are, service area, working hours, anything the assistant should know about your business."
              value={botBusinessContext} onChange={e => setBotBusinessContext(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">
              Ground rules <span className="text-app-soft font-normal">(optional)</span>
            </label>
            <textarea className="input w-full resize-none" rows={2}
              placeholder="Dos and don'ts — e.g. never discuss competitor pricing, always ask for preferred visit time before booking a site visit."
              value={botGroundRules} onChange={e => setBotGroundRules(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Projects the assistant can discuss
            </label>
            <p className="text-xs text-app-soft mb-2">
              Leave everything unchecked to let it discuss all of your active projects.
            </p>
            {projects.length === 0 ? (
              <p className="text-xs text-app-soft italic rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                No projects yet — add some on the Projects page first.
              </p>
            ) : (
              <div className="rounded-xl divide-y max-h-56 overflow-y-auto"
                style={{ border: "1px solid var(--app-border)" }}>
                {projects.map((p) => (
                  <label key={p._id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--app-surface-low)]">
                    <input type="checkbox" className="shrink-0" checked={botProjectIds.includes(p._id)}
                      onChange={() => toggleProject(p._id)} />
                    <span className="flex-1 min-w-0 truncate text-app">{p.name}</span>
                    {p.location && <span className="text-xs text-app-soft truncate shrink-0 max-w-[40%]">{p.location}</span>}
                  </label>
                ))}
              </div>
            )}
            {/* A narrow selection is easy to set once and forget, and the bot
                then answers "our team will confirm shortly" to everything it
                was not given. Say so plainly rather than just counting. */}
            {botProjectIds.length > 0 && (
              <div className="text-xs mt-2 rounded-xl px-3 py-2 flex items-start gap-2"
                style={botProjectIds.length < projects.length / 2
                  ? { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }
                  : { background: "rgba(var(--app-primary-rgb),0.08)", color: "var(--app-primary)" }}>
                {botProjectIds.length < projects.length / 2 && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                <span>
                  The assistant can only discuss <strong>{botProjectIds.length} of your {projects.length}</strong> active
                  project{projects.length === 1 ? "" : "s"}. Ask it about any of the others and it will say your team
                  will follow up. Uncheck everything to let it use all {projects.length}.
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t" style={{ borderColor: "var(--app-border)" }}>
            <label className="text-xs font-semibold text-app-soft mb-1 flex items-center gap-1.5 pt-3">
              <Megaphone className="w-3.5 h-3.5" /> Ad campaign mapping <span className="text-app-soft font-normal">(optional)</span>
            </label>
            <p className="text-xs text-app-soft mb-2">
              Running a Click-to-WhatsApp ad? Paste its Ad ID (from Meta Ads Manager → the ad, not the
              campaign) and pick the project(s) it's about. When someone messages in from that specific
              ad, the assistant's very first reply is guaranteed to be about the right project — even if
              the ad's own pre-filled message is generic.
            </p>
            <div className="space-y-2">
              {botAdProjectMap.map((row, idx) => (
                <div key={idx} className="rounded-xl p-3 space-y-2"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input className="input flex-1 min-w-[160px] font-mono text-xs" placeholder="Ad ID e.g. 1202101234567890"
                      value={row.adId} onChange={e => updateAdMapping(idx, { adId: e.target.value.trim() })} />
                    <input className="input flex-1 min-w-[160px] text-xs" placeholder="Label (optional) e.g. Skyline launch"
                      value={row.label} onChange={e => updateAdMapping(idx, { label: e.target.value })} />
                    <button type="button" onClick={() => removeAdMapping(idx)} title="Remove"
                      className="shrink-0 p-1.5 rounded-lg text-app-soft hover:text-red-500 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {projects.length === 0 && <span className="text-xs text-app-soft italic">Add projects on the Projects page first</span>}
                    {projects.map((p) => (
                      <button key={p._id} type="button" onClick={() => toggleAdMappingProject(idx, p._id)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full transition"
                        style={row.projectIds.includes(p._id)
                          ? { background: "var(--app-primary)", color: "#fff" }
                          : { background: "var(--app-border)", color: "var(--app-text-soft)" }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addAdMapping}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition">
              <Plus className="w-3.5 h-3.5" /> Add ad mapping
            </button>
          </div>

          <button type="button" onClick={() => setShowAdvancedPrompt(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedPrompt ? "rotate-180" : ""}`} />
            Advanced: replace with a fully custom prompt
          </button>
          {showAdvancedPrompt && (
            <div>
              <textarea className="input w-full resize-none" rows={3}
                placeholder="Leave blank to use Agent Studio above. Writing anything here overrides it entirely — the assistant will use only this prompt."
                value={botPrompt} onChange={e => setBotPrompt(e.target.value)} />
              <p className="text-xs text-app-soft mt-1">
                When this is filled in, the greeting/business context/ground rules/projects above are ignored — you're fully in control of the prompt.
              </p>
            </div>
          )}

          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-40 btn-secondary">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save assistant settings"}
          </button>
        </div>
      </div>

      {/* Try it. Runs the real prompt, sends nothing over WhatsApp, spends no
          WhatsApp credit — previously the only way to hear what the assistant
          would say was to message the live number and bill a real customer. */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
            <h3 className="text-base font-bold text-app">Try it</h3>
          </div>
          <button type="button" onClick={() => setTryOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${tryOpen ? "rotate-180" : ""}`} />
            {tryOpen ? "Hide" : "Open test chat"}
          </button>
        </div>
        <p className="text-sm text-app-soft">
          Ask it something a customer would ask. Nothing is sent over WhatsApp and no WhatsApp credit is used.
          Save your changes first — this reads the settings already stored.
        </p>

        {tryOpen && (
          <>
            <div className="rounded-2xl p-3 space-y-2 max-h-72 overflow-y-auto"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              {tryLog.length === 0 && (
                <p className="text-xs text-app-soft italic text-center py-6">
                  Try “what projects do you have in Pune?” or “what's the price of a 2BHK?”
                </p>
              )}
              {tryLog.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === "user" ? "rounded-tr-[4px] wa-bubble-out" : "rounded-tl-[4px]"}`}
                    style={m.role === "error"
                      ? { background: "rgba(239,68,68,0.10)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.28)" }
                      : m.role === "assistant"
                        ? { background: "var(--app-card-solid)", color: "var(--app-text)", border: "1px solid var(--app-border)" }
                        : undefined}>
                    {m.body}
                    {m.handoff && (
                      <span className="block text-[10px] font-bold mt-1.5" style={{ color: "#b45309" }}>
                        → would hand this thread to a human
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {trying && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-[4px] px-3.5 py-2"
                    style={{ background: "var(--app-card-solid)", border: "1px solid var(--app-border)" }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-app-soft" />
                  </div>
                </div>
              )}
              <div ref={tryEndRef} />
            </div>

            <div className="flex items-end gap-2">
              <input className="input flex-1" placeholder="Ask what a customer would ask…"
                value={tryInput} onChange={(e) => setTryInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runTry(); } }} />
              <button type="button" onClick={runTry} disabled={!tryInput.trim() || trying}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-40"
                style={{ background: tryInput.trim() ? "var(--app-primary)" : "var(--app-surface-low)" }}>
                <Send className={`w-4 h-4 ${tryInput.trim() ? "text-white" : "text-app-soft"}`} />
              </button>
            </div>

            {tryMeta && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2.5 py-1 rounded-full font-semibold"
                    style={tryMeta.projectsInScope === 0
                      ? { background: "rgba(239,68,68,0.10)", color: "#b91c1c" }
                      : { background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
                    {tryMeta.usingCustomPrompt
                      ? "Using your custom prompt"
                      : `Knows ${tryMeta.projectsInScope} of ${tryMeta.activeProjects} projects`}
                  </span>
                  {tryLog.length > 0 && (
                    <button type="button" onClick={() => setTryLog([])}
                      className="text-xs font-semibold text-app-soft hover:text-app transition">Clear chat</button>
                  )}
                  <button type="button" onClick={() => setShowPrompt((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition ml-auto">
                    <Eye className="w-3.5 h-3.5" />
                    {showPrompt ? "Hide" : "Show"} what it was told
                  </button>
                </div>
                {showPrompt && (
                  <pre className="text-[11px] leading-relaxed rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft)", maxHeight: 260 }}>
                    {tryMeta.systemPrompt}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
