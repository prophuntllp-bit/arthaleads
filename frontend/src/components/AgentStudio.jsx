import { useEffect, useState } from "react";
import { Sparkles, ChevronDown, Building2, Megaphone, Plus, X, Check, Loader2 } from "lucide-react";
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

  useEffect(() => {
    Promise.all([
      api.get("/whatsapp/settings"),
      api.get("/projects"),
    ]).then(([settingsRes, projectsRes]) => {
      const s = settingsRes.data.whatsapp || {};
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
            {botProjectIds.length > 0 && (
              <p className="text-xs mt-1.5" style={{ color: "var(--app-primary)" }}>
                {botProjectIds.length} project{botProjectIds.length > 1 ? "s" : ""} selected — only these will be discussed.
              </p>
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
    </div>
  );
}
