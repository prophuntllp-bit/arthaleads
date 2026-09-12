import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Sparkles, Building2, Megaphone, Plus, X, Check, Loader2,
  ChevronDown, MessageSquare, Send, AlertTriangle, Eye, Trash2,
} from "lucide-react";
import api from "../../services/api";
import CustomSelect from "../../components/CustomSelect";
import toast from "react-hot-toast";

/**
 * Create or edit one WhatsApp assistant, and try it before it ever touches a
 * customer.
 *
 * Its own route rather than a tab, because a form you can wander out of
 * mid-edit is how half-configured assistants end up answering real people.
 */

const SELECT_STYLE = { width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 };

const LANGUAGES = [
  { value: "auto",     label: "Match the customer" },
  { value: "English",  label: "English" },
  { value: "Hindi",    label: "Hindi" },
  { value: "Marathi",  label: "Marathi" },
  { value: "Gujarati", label: "Gujarati" },
  { value: "Tamil",    label: "Tamil" },
  { value: "Telugu",   label: "Telugu" },
  { value: "Kannada",  label: "Kannada" },
  { value: "Bengali",  label: "Bengali" },
  { value: "Punjabi",  label: "Punjabi" },
];

const STATUSES = [
  { value: "active", label: "Live — answers customers" },
  { value: "paused", label: "Paused — does not answer" },
  { value: "draft",  label: "Draft — still being written" },
];

export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [projects, setProjects] = useState([]);
  const [readiness, setReadiness] = useState(null);

  const [form, setForm] = useState({
    name: "", description: "", status: "draft", greeting: "",
    businessContext: "", groundRules: "", projectIds: [],
    systemPrompt: "", language: "auto", adIds: [],
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adDraft, setAdDraft] = useState("");

  // Try-it console
  const [tryInput, setTryInput] = useState("");
  const [tryLog, setTryLog]     = useState([]);
  const [trying, setTrying]     = useState(false);
  const [tryMeta, setTryMeta]   = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const tryEndRef = useRef(null);

  useEffect(() => {
    const reqs = [api.get("/projects")];
    if (!isNew) reqs.push(api.get(`/whatsapp/agents/${id}`));
    Promise.all(reqs).then(([projRes, agentRes]) => {
      setProjects(projRes.data?.data || []);
      if (agentRes) {
        const a = agentRes.data.agent;
        setForm({
          name: a.name || "", description: a.description || "", status: a.status || "draft",
          greeting: a.greeting || "", businessContext: a.businessContext || "",
          groundRules: a.groundRules || "",
          projectIds: (a.projectIds || []).map((p) => String(p?._id || p)),
          systemPrompt: a.systemPrompt || "", language: a.language || "auto",
          adIds: a.adIds || [],
        });
        setShowAdvanced(!!a.systemPrompt);
        setReadiness(a.readiness);
      }
    }).catch(() => toast.error("Could not load this assistant"))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  useEffect(() => { tryEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [tryLog, trying]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Give the assistant a name first.");
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post("/whatsapp/agents", form);
        toast.success(`${data.agent.name} created`);
        // Replace rather than push, so Back does not land on a "new" form that
        // would create a second copy on save.
        navigate(`/conversations/agent/${data.agent._id}`, { replace: true });
      } else {
        const { data } = await api.patch(`/whatsapp/agents/${id}`, form);
        setReadiness(data.agent.readiness);
        toast.success("Saved");
      }
    } catch (e) { toast.error(e.response?.data?.message || "Could not save"); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/whatsapp/agents/${id}`);
      toast.success("Assistant deleted");
      navigate("/conversations/agent");
    } catch (e) { toast.error(e.response?.data?.message || "Could not delete"); }
  };

  const runTry = async () => {
    const text = tryInput.trim();
    if (!text || trying) return;
    if (isNew) return toast.error("Save the assistant first, then you can try it.");
    setTryInput("");
    const history = tryLog.filter((m) => m.role !== "error").map((m) => ({ role: m.role, body: m.body }));
    setTryLog((l) => [...l, { role: "user", body: text }]);
    setTrying(true);
    try {
      const { data } = await api.post(`/whatsapp/agents/${id}/preview`, { message: text, history });
      setTryLog((l) => [...l, { role: "assistant", body: data.reply || "(no reply)", handoff: data.handoff }]);
      setTryMeta(data);
    } catch (e) {
      setTryLog((l) => [...l, { role: "error", body: e.response?.data?.message || "The assistant could not answer." }]);
    } finally { setTrying(false); }
  };

  const toggleProject = (pid) => set({
    projectIds: form.projectIds.includes(pid)
      ? form.projectIds.filter((x) => x !== pid)
      : [...form.projectIds, pid],
  });

  const addAd = () => {
    const v = adDraft.trim();
    if (!v) return;
    if (form.adIds.includes(v)) return setAdDraft("");
    set({ adIds: [...form.adIds, v] });
    setAdDraft("");
  };

  if (loading) {
    return (
      <div className="stitch-page">
        <div className="card p-5 h-64 animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      </div>
    );
  }

  const narrowScope = form.projectIds.length > 0 && form.projectIds.length < projects.length / 2;

  return (
    <div className="stitch-page">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate("/conversations/agent")}
          className="flex items-center gap-1.5 text-sm font-semibold text-app-soft hover:text-app transition">
          <ArrowLeft className="w-4 h-4" /> All agents
        </button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button onClick={remove}
              className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="btn-primary rounded-full px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : isNew ? "Create agent" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-lg font-bold text-app">{isNew ? "New agent" : form.name || "Agent"}</h1>
        <p className="text-xs text-app-soft">
          What this assistant knows, how it talks, and which messages reach it
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="space-y-5 min-w-0">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">Identity</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Name</label>
                <input className="input w-full" placeholder="e.g. Arohi"
                  value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Status</label>
                <CustomSelect value={form.status} onChange={(v) => set({ status: v })}
                  options={STATUSES} style={SELECT_STYLE} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                What it does <span className="font-normal">(for your team, never sent to customers)</span>
              </label>
              <input className="input w-full" placeholder="e.g. Qualifies leads and books site visits for Treetopia"
                value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Reply language</label>
              <CustomSelect value={form.language} onChange={(v) => set({ language: v })}
                options={LANGUAGES} style={SELECT_STYLE} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-base font-bold text-app">How it talks</h3>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Greeting <span className="font-normal">(optional)</span>
              </label>
              <input className="input w-full" placeholder="Hi! Thanks for reaching out — how can I help you find your next home?"
                value={form.greeting} onChange={(e) => set({ greeting: e.target.value })} />
              <p className="text-xs text-app-soft mt-1">Sent automatically as the first message when someone new writes in.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Business context <span className="font-normal">(optional)</span>
              </label>
              <textarea className="input w-full resize-none" rows={3}
                placeholder="Who you are, service area, working hours, anything the assistant should know about your business."
                value={form.businessContext} onChange={(e) => set({ businessContext: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Ground rules <span className="font-normal">(optional)</span>
              </label>
              <textarea className="input w-full resize-none" rows={3}
                placeholder="Dos and don'ts — e.g. never discuss competitor pricing, always ask for a preferred visit time before booking a site visit."
                value={form.groundRules} onChange={(e) => set({ groundRules: e.target.value })} />
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">What it can discuss</h3>
            </div>
            <p className="text-sm text-app-soft">
              Answers come from your real Projects, not a crawled website. Edit a price on the Projects
              page and the next reply reflects it — nothing to re-sync.
            </p>
            <p className="text-xs text-app-soft">Leave everything unchecked to allow all of your active projects.</p>

            {projects.length === 0 ? (
              <p className="text-xs text-app-soft italic rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                No projects yet — add some on the Projects page first.
              </p>
            ) : (
              <div className="rounded-xl divide-y max-h-64 overflow-y-auto" style={{ border: "1px solid var(--app-border)" }}>
                {projects.map((p) => (
                  <label key={p._id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--app-surface-low)]">
                    <input type="checkbox" className="shrink-0"
                      checked={form.projectIds.includes(p._id)} onChange={() => toggleProject(p._id)} />
                    <span className="flex-1 min-w-0 truncate text-app">{p.name}</span>
                    {p.location && <span className="text-xs text-app-soft truncate shrink-0 max-w-[40%]">{p.location}</span>}
                  </label>
                ))}
              </div>
            )}

            {form.projectIds.length > 0 && (
              <div className="text-xs rounded-xl px-3 py-2 flex items-start gap-2"
                style={narrowScope
                  ? { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }
                  : { background: "rgba(var(--app-primary-rgb),0.08)", color: "var(--app-primary)" }}>
                {narrowScope && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                <span>
                  This assistant can only discuss <strong>{form.projectIds.length} of your {projects.length}</strong> active
                  project{projects.length === 1 ? "" : "s"}. Ask it about any of the others and it will say your team
                  will follow up. Uncheck everything to allow all {projects.length}.
                </span>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">Route ads to this agent</h3>
            </div>
            <p className="text-sm text-app-soft">
              Running a Click-to-WhatsApp ad? Paste its Ad ID (from Meta Ads Manager — the ad, not the
              campaign). Anyone who messages in from that ad reaches this assistant, whichever one is
              your default.
            </p>
            <div className="flex items-center gap-2">
              <input className="input flex-1 font-mono text-xs" placeholder="Ad ID e.g. 1202101234567890"
                value={adDraft} onChange={(e) => setAdDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAd(); } }} />
              <button type="button" onClick={addAd} disabled={!adDraft.trim()}
                className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {form.adIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.adIds.map((ad) => (
                  <span key={ad} className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                    {ad}
                    <button type="button" onClick={() => set({ adIds: form.adIds.filter((a) => a !== ad) })}
                      className="text-app-soft hover:text-red-500 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <button type="button" onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced: replace everything above with one custom prompt
            </button>
            {showAdvanced && (
              <div>
                <textarea className="input w-full resize-none" rows={5}
                  placeholder="Leave blank to use the settings above. Writing anything here overrides them entirely."
                  value={form.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} />
                <p className="text-xs text-app-soft mt-1">
                  When this is filled in, the greeting, business context, ground rules and project list are
                  all ignored — you are fully in control of the prompt.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Try it, alongside the form rather than under it, so you can change a
            ground rule and immediately ask the same question again. */}
        <div className="card p-5 space-y-4 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
            <h3 className="text-base font-bold text-app">Try it</h3>
          </div>

          {readiness && readiness.score < readiness.total && (
            <div className="text-xs rounded-xl px-3 py-2"
              style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }}>
              <strong>Setup {readiness.score}/{readiness.total}.</strong>{" "}
              {readiness.checks.filter((c) => !c.ok).map((c) => c.label).join(" · ")}
            </div>
          )}

          <p className="text-sm text-app-soft">
            {isNew
              ? "Create the assistant first, then you can try it here."
              : "Nothing is sent over WhatsApp and no WhatsApp credit is used. Save your changes first — this reads what is stored."}
          </p>

          <div className="rounded-2xl p-3 space-y-2 overflow-y-auto"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", minHeight: 180, maxHeight: 340 }}>
            {tryLog.length === 0 && (
              <p className="text-xs text-app-soft italic text-center py-8">
                Try “what projects do you have in Pune?” or “price of a 2BHK?”
              </p>
            )}
            {tryLog.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
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
            <input className="input flex-1" placeholder="Ask what a customer would ask…" disabled={isNew}
              value={tryInput} onChange={(e) => setTryInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runTry(); } }} />
            <button type="button" onClick={runTry} disabled={!tryInput.trim() || trying || isNew}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-40"
              style={{ background: tryInput.trim() && !isNew ? "var(--app-primary)" : "var(--app-surface-low)" }}>
              <Send className={`w-4 h-4 ${tryInput.trim() && !isNew ? "text-white" : "text-app-soft"}`} />
            </button>
          </div>

          {tryMeta && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-1 rounded-full font-semibold"
                  style={tryMeta.projectsInScope === 0 && !tryMeta.usingCustomPrompt
                    ? { background: "rgba(239,68,68,0.10)", color: "#b91c1c" }
                    : { background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
                  {tryMeta.usingCustomPrompt
                    ? "Using your custom prompt"
                    : `Knows ${tryMeta.projectsInScope} of ${tryMeta.activeProjects} projects`}
                </span>
                {tryLog.length > 0 && (
                  <button type="button" onClick={() => setTryLog([])}
                    className="text-xs font-semibold text-app-soft hover:text-app transition">Clear</button>
                )}
                <button type="button" onClick={() => setShowPrompt((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition ml-auto">
                  <Eye className="w-3.5 h-3.5" />
                  {showPrompt ? "Hide" : "Show"} what it was told
                </button>
              </div>
              {showPrompt && (
                <pre className="text-[11px] leading-relaxed rounded-xl p-3 overflow-auto whitespace-pre-wrap break-words"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft)", maxHeight: 280 }}>
                  {tryMeta.systemPrompt}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
