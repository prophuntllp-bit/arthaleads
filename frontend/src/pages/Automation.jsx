import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2, ChevronRight, Copy, ExternalLink, Globe2,
  Link2, MessageCircle, Pencil, Plus, SearchCheck, Trash2, Webhook,
} from "lucide-react";
import api from "../services/api";
import { ConfirmDialog, EmptyState, Modal, PageLoader, Spinner } from "../components/UI";

/* ─── platform presets (non-Facebook) ─────────────────────────────────────── */
const PLATFORM_PRESETS = {
  Facebook: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Facebook",
    webhookPath: "/webhook",
    description: "Connect Meta Lead Ads. Leads flow in automatically — no setup required.",
    icon: Webhook,
    tone: "bg-blue-500/10 text-blue-400",
  },
  Google: {
    mode: "api",
    status: "draft",
    leadSourceLabel: "Google",
    webhookPath: "/api/leads",
    description: "Connect Google Ads landing pages or lead bridges into the CRM API.",
    icon: SearchCheck,
    tone: "bg-red-500/10 text-red-400",
  },
  WhatsApp: {
    mode: "api",
    status: "draft",
    leadSourceLabel: "WhatsApp",
    webhookPath: "/api/leads",
    description: "Route WhatsApp enquiries from a bot or form into the CRM.",
    icon: MessageCircle,
    tone: "bg-green-500/10 text-green-400",
  },
  "Website Form": {
    mode: "form",
    status: "draft",
    leadSourceLabel: "Website",
    webhookPath: "/api/leads",
    description: "Use the CRM API endpoint directly from your website or landing page.",
    icon: Globe2,
    tone: "bg-cyan-500/10 text-cyan-400",
  },
  Custom: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Other",
    webhookPath: "/api/leads",
    description: "Connect any other partner, broker, or vendor lead source.",
    icon: Link2,
    tone: "bg-orange-500/10 text-orange-400",
  },
};

const emptyNonFbForm = {
  name: "",
  platform: "Google",
  mode: "api",
  status: "draft",
  description: "",
  leadSourceLabel: "Google",
  externalSourceId: "",
  externalSourceUrl: "",
  webhookPath: "/api/leads",
  verifyToken: "",
  accessToken: "",
  mappingNotes: "",
  isActive: true,
};

/* ─── FacebookWizard ───────────────────────────────────────────────────────── */
function FacebookWizard({ open, onClose, onSaved, editingItem, apiBase }) {
  // step: "connect" | "select" | "saving"
  const [step, setStep] = useState("connect");
  const [connecting, setConnecting] = useState(false);
  const [pages, setPages] = useState([]);
  const [pageId, setPageId] = useState("");
  const [formId, setFormId] = useState("");
  const [connName, setConnName] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPage = pages.find((p) => p.id === pageId);
  const formOptions = selectedPage?.forms || [];

  // Pre-fill when editing
  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setStep("select");
      setPages([]);          // will show manual ID fields
      setPageId(editingItem.pageId || "");
      setFormId(editingItem.formId || "");
      setConnName(editingItem.name || "");
    } else {
      setStep("connect");
      setPages([]);
      setPageId("");
      setFormId("");
      setConnName("");
    }
    setConnecting(false);
  }, [open, editingItem]);

  // Listen for OAuth popup result via localStorage storage event
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "fb_oauth_result" || !e.newValue) return;
      let result;
      try { result = JSON.parse(e.newValue); } catch { return; }
      localStorage.removeItem("fb_oauth_result");
      setConnecting(false);

      if (result.type === "facebook_oauth_success") {
        const fetchedPages = result.pages || [];
        setPages(fetchedPages);
        if (fetchedPages.length > 0) {
          const first = fetchedPages[0];
          setPageId(first.id || "");
          if (!connName) setConnName(`${first.name} — Lead Ads`);
        }
        setStep("select");
        toast.success("Facebook connected! Choose your page and form.");
      }
      if (result.type === "facebook_oauth_error") {
        toast.error(result.message || "Facebook connection failed. Please try again.");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [step, connName]);

  const handlePageChange = (e) => {
    const id = e.target.value;
    setPageId(id);
    const pg = pages.find((p) => p.id === id);
    setFormId(pg?.forms?.[0]?.id || "");
    if (!connName || connName.endsWith("— Lead Ads")) {
      setConnName(pg ? `${pg.name} — Lead Ads` : "");
    }
  };

  const openOAuth = () => {
    const token = localStorage.getItem("crm_token");
    if (!token) { toast.error("Please log in again"); return; }
    setConnecting(true);
    const url = `${(apiBase || "").replace(/\/api\/?$/, "")}/api/automations/facebook/connect?token=${encodeURIComponent(token)}`;
    const popup = window.open(url, "arthaleads-fb-oauth", "width=720,height=760,resizable=yes,scrollbars=yes");
    if (!popup) {
      setConnecting(false);
      toast.error("Please allow popups for this site, then try again.");
    }
  };

  const handleSave = async () => {
    if (!pageId) { toast.error("Please select a Facebook Page"); return; }
    if (!connName.trim()) { toast.error("Please give this connection a name"); return; }
    setSaving(true);
    const selectedPageData = pages.find((p) => p.id === pageId);
    const payload = {
      name: connName.trim(),
      platform: "Facebook",
      mode: "webhook",
      status: "connected",
      leadSourceLabel: "Facebook",
      webhookPath: "/webhook",
      pageId,
      formId,
      accessToken: selectedPageData?.accessToken || editingItem?.accessToken || "",
      verifyToken: editingItem?.verifyToken || `arthaleads_${Date.now()}`,
      isActive: true,
    };
    try {
      if (editingItem) {
        const { data } = await api.patch(`/automations/${editingItem._id}`, payload);
        onSaved("update", data.automation);
        toast.success("Facebook connection updated");
      } else {
        const { data } = await api.post("/automations", payload);
        onSaved("create", data.automation);
        toast.success("Facebook Lead Ads connected!");
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[1.75rem] shell-panel overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1877F2]">
            <FacebookIcon />
          </div>
          <div>
            <h2 className="text-lg font-bold text-app">Facebook Lead Ads</h2>
            <p className="text-xs text-app-soft">Connect your ad account in seconds</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-1">
          <StepDot n={1} label="Connect" active={step === "connect"} done={step === "select"} />
          <div className="flex-1 h-px bg-white/10" />
          <StepDot n={2} label="Choose Page & Form" active={step === "select"} done={false} />
        </div>

        <div className="p-6 space-y-5">
          {/* ── STEP 1: Connect ── */}
          {step === "connect" && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-5 space-y-3">
                <p className="text-sm font-semibold text-app">What happens when you click below:</p>
                <ul className="space-y-2">
                  {[
                    "A Facebook login window opens",
                    "You approve access to your pages",
                    "Your pages and lead forms load automatically",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-app-soft">
                      <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={openOAuth}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 text-sm font-semibold text-white transition"
                style={{ background: "#1877F2" }}
              >
                {connecting ? (
                  <><Spinner size="sm" /><span className="text-white">Waiting for Facebook...</span></>
                ) : (
                  <><FacebookIcon /><span>Continue with Facebook</span><ChevronRight className="h-4 w-4 ml-auto" /></>
                )}
              </button>

              <p className="text-center text-xs text-app-soft">
                No technical setup needed. We handle everything securely.
              </p>
            </div>
          )}

          {/* ── STEP 2: Select page + form ── */}
          {step === "select" && (
            <div className="space-y-4">
              {pages.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-400 font-medium">
                    Facebook connected — {pages.length} page{pages.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="label">Facebook Page</label>
                {pages.length > 0 ? (
                  <select className="select" value={pageId} onChange={handlePageChange}>
                    <option value="">Select a page…</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="Page ID (from Facebook Business)"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="label">Lead Form</label>
                {pages.length > 0 ? (
                  <select className="select" value={formId} onChange={(e) => setFormId(e.target.value)}>
                    <option value="">All forms on this page</option>
                    {formOptions.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="Form ID (optional)"
                  />
                )}
                <p className="text-xs text-app-soft mt-1">
                  Leave as "All forms" to capture leads from every form on this page.
                </p>
              </div>

              <div className="space-y-1">
                <label className="label">Connection name</label>
                <input
                  className="input"
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                  placeholder="e.g. Arthaleads — Treetopia Leads"
                />
              </div>

              {/* Reconnect option */}
              <button
                type="button"
                onClick={() => { setStep("connect"); setPages([]); }}
                className="text-xs text-blue-400 hover:underline"
              >
                Use a different Facebook account
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <button type="button" className="btn-secondary rounded-xl" onClick={onClose}>Cancel</button>
          {step === "select" && (
            <button
              type="button"
              className="btn-primary rounded-xl"
              onClick={handleSave}
              disabled={saving || !pageId}
            >
              {saving ? <><Spinner size="sm" /> Saving…</> : "Save Connection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDot({ n, label, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition
        ${done ? "bg-emerald-500 text-white" : active ? "bg-[#1877F2] text-white" : "bg-white/10 text-app-soft"}`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={`text-xs font-medium ${active ? "text-app" : "text-app-soft"}`}>{label}</span>
    </div>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

/* ─── Non-Facebook source form ─────────────────────────────────────────────── */
function SourceModal({ open, onClose, editingItem, onSaved, apiBase }) {
  const [form, setForm] = useState(emptyNonFbForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setForm({
        name: editingItem.name || "",
        platform: editingItem.platform || "Google",
        mode: editingItem.mode || "api",
        status: editingItem.status || "draft",
        description: editingItem.description || "",
        leadSourceLabel: editingItem.leadSourceLabel || "",
        externalSourceId: editingItem.externalSourceId || "",
        externalSourceUrl: editingItem.externalSourceUrl || "",
        webhookPath: editingItem.webhookPath || "/api/leads",
        verifyToken: editingItem.verifyToken || "",
        accessToken: editingItem.accessToken || "",
        mappingNotes: editingItem.mappingNotes || "",
        isActive: editingItem.isActive ?? true,
      });
    } else {
      setForm(emptyNonFbForm);
    }
  }, [open, editingItem]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handlePlatformChange = (e) => {
    const platform = e.target.value;
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.Custom;
    setForm((f) => ({
      ...f,
      platform,
      mode: preset.mode,
      leadSourceLabel: preset.leadSourceLabel,
      webhookPath: preset.webhookPath,
      description: preset.description || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        const { data } = await api.patch(`/automations/${editingItem._id}`, form);
        onSaved("update", data.automation);
        toast.success("Source updated");
      } else {
        const { data } = await api.post("/automations", form);
        onSaved("create", data.automation);
        toast.success("Source added");
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const endpoint = `${(apiBase || "").replace(/\/api\/?$/, "")}${form.webhookPath || "/api/leads"}`;

  return (
    <Modal open={open} onClose={onClose} title={editingItem ? "Edit Source" : "Add Lead Source"} size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Source Name</label>
            <input className="input" value={form.name} onChange={set("name")} required />
          </div>
          <div>
            <label className="label">Platform</label>
            <select className="select" value={form.platform} onChange={handlePlatformChange}>
              {Object.keys(PLATFORM_PRESETS).filter((p) => p !== "Facebook").map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={set("status")}>
              <option value="draft">Draft</option>
              <option value="connected">Connected</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div>
            <label className="label">Lead Source Label</label>
            <input className="input" value={form.leadSourceLabel} onChange={set("leadSourceLabel")} placeholder="Google / WhatsApp / Website" />
          </div>
          <div>
            <label className="label">External Source ID</label>
            <input className="input" value={form.externalSourceId} onChange={set("externalSourceId")} placeholder="Campaign or partner ID" />
          </div>
          <div>
            <label className="label">External Source URL</label>
            <input className="input" value={form.externalSourceUrl} onChange={set("externalSourceUrl")} placeholder="Landing page URL" />
          </div>
        </div>
        <div>
          <label className="label">API Endpoint</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl px-3 py-2 text-xs text-orange-400" style={{ background: "var(--app-surface-low)" }}>{endpoint}</code>
            <button type="button" className="btn-secondary rounded-xl" onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("Copied"); }}>
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-app-soft">POST leads to this endpoint with source set to <span className="text-orange-400">{form.leadSourceLabel || form.platform}</span>.</p>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" value={form.mappingNotes} onChange={set("mappingNotes")} placeholder="Notes about field mapping or setup details" />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-app" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
          <input type="checkbox" checked={form.isActive} onChange={set("isActive")} />
          This source is active
        </label>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : editingItem ? "Update" : "Save Source"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Main Automation page ─────────────────────────────────────────────────── */
export default function Automation() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Facebook wizard state
  const [fbWizardOpen, setFbWizardOpen] = useState(false);
  const [fbEditingItem, setFbEditingItem] = useState(null);

  // Non-FB source modal state
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceEditingItem, setSourceEditingItem] = useState(null);

  // Delete confirm
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const apiBase = useMemo(() => api.defaults.baseURL || "http://localhost:5000/api", []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/automations");
      setItems(data.automations || []);
    } catch {
      toast.error("Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  useEffect(() => {
    if (!location.state?.presetPlatform) return;
    const platform = location.state.presetPlatform;
    if (platform === "Facebook") {
      setFbEditingItem(null);
      setFbWizardOpen(true);
    } else {
      setSourceEditingItem(null);
      setSourceModalOpen(true);
    }
  }, [location.state]);

  const handleSaved = (action, automation) => {
    setItems((prev) =>
      action === "create"
        ? [automation, ...prev]
        : prev.map((item) => (item._id === automation._id ? automation : item))
    );
  };

  const openEdit = (item) => {
    if (item.platform === "Facebook") {
      setFbEditingItem(item);
      setFbWizardOpen(true);
    } else {
      setSourceEditingItem(item);
      setSourceModalOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/automations/${deleting._id}`);
      setItems((prev) => prev.filter((item) => item._id !== deleting._id));
      toast.success("Connection removed");
      setDeleting(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove");
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyEndpoint = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied!");
    } catch {
      toast.error("Could not copy");
    }
  };

  const summary = useMemo(() => ({
    connected: items.filter((i) => i.status === "connected").length,
    total: items.length,
  }), [items]);

  if (loading) return <PageLoader />;

  const serverBase = (apiBase || "").replace(/\/api\/?$/, "");

  return (
    <div className="stitch-page space-y-6">
      {/* Header */}
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="stitch-kicker mb-2">Lead Sources</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Connect Your Accounts</h1>
            <p className="mt-2 max-w-2xl text-sm text-app-soft">
              Connect Facebook Lead Ads, Google, WhatsApp, and more. Leads flow directly into your CRM automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary rounded-xl"
              onClick={() => { setFbEditingItem(null); setFbWizardOpen(true); }}
            >
              <FacebookIcon2 /> Connect Facebook
            </button>
            <button
              className="btn-secondary rounded-xl"
              onClick={() => { setSourceEditingItem(null); setSourceModalOpen(true); }}
            >
              <Plus className="h-4 w-4" /> Other Source
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Connected" value={summary.connected} note="Live channels" accent="text-emerald-400" />
        <MetricCard label="Total Sources" value={summary.total} note="All connections" />
        <MetricCard label="Facebook" value={items.filter((i) => i.platform === "Facebook").length} note="Meta Lead Ads" accent="text-blue-400" />
        <MetricCard label="Other" value={items.filter((i) => i.platform !== "Facebook").length} note="Google · WhatsApp · Web" />
      </section>

      {/* Quick connect tiles */}
      <section>
        <p className="mb-3 text-sm font-semibold text-app-soft">Quick connect</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
          {/* Facebook tile — special styling */}
          <button
            type="button"
            className="card p-5 text-left transition hover:-translate-y-1 hover:border-blue-500/30 relative overflow-hidden"
            onClick={() => { setFbEditingItem(null); setFbWizardOpen(true); }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1877F2]">
              <FacebookIcon />
            </div>
            <h3 className="mt-4 text-base font-semibold text-app">Facebook</h3>
            <p className="mt-1 text-xs text-app-soft">Lead Ads · One click</p>
            <span className="absolute top-3 right-3 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">Popular</span>
          </button>

          {Object.entries(PLATFORM_PRESETS)
            .filter(([p]) => p !== "Facebook")
            .map(([platform, preset]) => {
              const Icon = preset.icon;
              return (
                <button
                  key={platform}
                  type="button"
                  className="card p-5 text-left transition hover:-translate-y-1 hover:border-orange-500/30"
                  onClick={() => { setSourceEditingItem(null); setSourceModalOpen(true); }}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${preset.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-app">{platform}</h3>
                  <p className="mt-1 text-xs text-app-soft">{preset.description.split(".")[0]}</p>
                </button>
              );
            })}
        </div>
      </section>

      {/* Connected sources list */}
      {items.length === 0 ? (
        <section className="card">
          <EmptyState
            title="No connections yet"
            desc="Connect Facebook Lead Ads in one click — no technical setup needed."
            action={
              <button className="btn-primary" onClick={() => { setFbEditingItem(null); setFbWizardOpen(true); }}>
                <FacebookIcon2 /> Connect Facebook
              </button>
            }
          />
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-app-soft">Your connections ({items.length})</p>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => {
              const preset = PLATFORM_PRESETS[item.platform] || PLATFORM_PRESETS.Custom;
              const Icon = preset.icon;
              const isFb = item.platform === "Facebook";
              const endpointPath = item.webhookPath || "/api/leads";
              return (
                <article key={item._id} className="card p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isFb ? "bg-[#1877F2]" : preset.tone}`}>
                        {isFb ? <FacebookIcon /> : <Icon className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-app">{item.name}</h3>
                        <p className="text-xs text-app-soft">{item.platform}</p>
                      </div>
                    </div>
                    <span className={`badge shrink-0 ${item.status === "connected" ? "bg-emerald-500/10 text-emerald-400" : item.status === "paused" ? "bg-amber-500/10 text-amber-400" : "bg-white/5 text-app-soft"}`}>
                      {item.status}
                    </span>
                  </div>

                  {isFb ? (
                    <div className="grid grid-cols-2 gap-3 rounded-2xl p-4 stitch-surface-muted text-sm">
                      <div>
                        <p className="text-xs text-app-soft">Page ID</p>
                        <p className="mt-0.5 font-medium text-app truncate">{item.pageId || "All pages"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-soft">Form</p>
                        <p className="mt-0.5 font-medium text-app truncate">{item.formId || "All forms"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl p-4 stitch-surface-muted">
                      <p className="text-xs text-app-soft mb-2">API Endpoint</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-xl px-3 py-1.5 text-xs text-orange-400" style={{ background: "var(--app-surface-low)" }}>
                          {serverBase}{endpointPath}
                        </code>
                        <button className="btn-secondary rounded-xl shrink-0" onClick={() => copyEndpoint(`${serverBase}${endpointPath}`)}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button className="btn-secondary rounded-xl" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    {item.externalSourceUrl && (
                      <a href={item.externalSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary rounded-xl">
                        <ExternalLink className="h-4 w-4" /> Open
                      </a>
                    )}
                    <button className="btn-danger rounded-xl ml-auto" onClick={() => setDeleting(item)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Facebook Wizard */}
      <FacebookWizard
        open={fbWizardOpen}
        onClose={() => setFbWizardOpen(false)}
        onSaved={handleSaved}
        editingItem={fbEditingItem}
        apiBase={apiBase}
      />

      {/* Non-FB Source Modal */}
      <SourceModal
        open={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        editingItem={sourceEditingItem}
        onSaved={handleSaved}
        apiBase={apiBase}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Remove Connection"
        message={deleting ? `Remove "${deleting.name}" from your connections?` : ""}
      />
    </div>
  );
}

function MetricCard({ label, value, note, accent = "text-app" }) {
  return (
    <div className="card p-5">
      <p className="stitch-kicker mb-2">{label}</p>
      <p className={`text-3xl font-black tracking-tight ${accent}`}>{value}</p>
      <p className="mt-2 text-xs text-app-soft">{note}</p>
    </div>
  );
}

function FacebookIcon2() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}
