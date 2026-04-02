import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Copy, ExternalLink, Globe2, Link2, MessageCircle, Pencil, Plus, SearchCheck, ShieldCheck, Trash2, Webhook } from "lucide-react";
import api from "../services/api";
import { ConfirmDialog, EmptyState, Modal, PageLoader } from "../components/UI";

const PLATFORM_PRESETS = {
  Facebook: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Facebook",
    webhookPath: "/webhook",
    description: "Connect Meta Lead Ads and receive leads directly into your CRM.",
    icon: Webhook,
    tone: "bg-blue-500/10 text-blue-400",
    steps: [
      "Click Connect with Facebook.",
      "Log in to Facebook and approve the required permissions.",
      "Choose the page and lead form from dropdowns and save the connection.",
    ],
  },
  Google: {
    mode: "api",
    status: "draft",
    leadSourceLabel: "Google",
    webhookPath: "/api/leads",
    description: "Connect Google Ads landing pages or lead bridges into the CRM API.",
    icon: SearchCheck,
    tone: "bg-red-500/10 text-red-400",
    steps: [
      "Create a landing page or lead bridge that POSTs to the CRM endpoint.",
      "Set source to Google and map name, phone, and email.",
      "Save this connection so your team knows which source is live.",
    ],
  },
  WhatsApp: {
    mode: "api",
    status: "draft",
    leadSourceLabel: "WhatsApp",
    webhookPath: "/api/leads",
    description: "Route WhatsApp enquiries from a bot or form into the CRM.",
    icon: MessageCircle,
    tone: "bg-green-500/10 text-green-400",
    steps: [
      "Connect your WhatsApp form, chatbot, or bridge to the API endpoint.",
      "Pass source as WhatsApp for proper analytics.",
      "Save mapping notes so your team knows what fields are being sent.",
    ],
  },
  "Website Form": {
    mode: "form",
    status: "draft",
    leadSourceLabel: "Website",
    webhookPath: "/api/leads",
    description: "Use the CRM API endpoint directly from your website or landing page.",
    icon: Globe2,
    tone: "bg-cyan-500/10 text-cyan-400",
    steps: [
      "Add a simple form on your landing page.",
      "Send the form data to the API endpoint below.",
      "Save the page URL here so your team knows where leads are coming from.",
    ],
  },
  Custom: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Other",
    webhookPath: "/api/leads",
    description: "Connect any other partner, broker, or vendor lead source.",
    icon: Link2,
    tone: "bg-orange-500/10 text-orange-400",
    steps: [
      "Paste the source details and the endpoint you plan to use.",
      "Document field mapping for your team.",
      "Mark it connected once test leads are flowing into the CRM.",
    ],
  },
};

const emptyForm = {
  name: "",
  platform: "Facebook",
  mode: "webhook",
  status: "draft",
  description: "",
  leadSourceLabel: "Facebook",
  externalSourceId: "",
  pageId: "",
  formId: "",
  externalSourceUrl: "",
  webhookPath: "/webhook",
  verifyToken: "",
  accessToken: "",
  mappingNotes: "",
  isActive: true,
};

export default function Automation() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [facebookPages, setFacebookPages] = useState([]);
  const [connectingFacebook, setConnectingFacebook] = useState(false);

  const apiBase = useMemo(() => {
    const baseURL = api.defaults.baseURL || "http://localhost:5000/api";
    return baseURL.replace(/\/api\/?$/, "");
  }, []);

  const selectedPreset = PLATFORM_PRESETS[form.platform] || PLATFORM_PRESETS.Custom;
  const SelectedIcon = selectedPreset.icon;
  const selectedFacebookPage = facebookPages.find((page) => page.id === form.pageId);
  const currentForms = selectedFacebookPage?.forms || [];

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/automations");
      setItems(data.automations || []);
    } catch {
      toast.error("Failed to load automation sources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (!location.state?.presetPlatform) return;
    openCreate(location.state.presetPlatform);
  }, [location.state]);

  useEffect(() => {
    const handler = (event) => {
      const allowedOrigin = apiBase.replace(/\/api$/, "");
      if (event.origin !== allowedOrigin) return;

      if (event.data?.type === "facebook_oauth_success") {
        setConnectingFacebook(false);
        setFacebookPages(event.data.pages || []);
        if (event.data.pages?.length) {
          const firstPage = event.data.pages[0];
          const firstForm = firstPage.forms?.[0];
          setForm((current) => ({
            ...current,
            platform: "Facebook",
            pageId: firstPage.id,
            formId: firstForm?.id || "",
            accessToken: firstPage.accessToken || "",
            externalSourceUrl: "https://business.facebook.com/",
            status: current.status === "draft" ? "connected" : current.status,
          }));
          toast.success("Facebook connected. Choose your page and form.");
        } else {
          toast.error("No Facebook pages were returned for this account");
        }
      }

      if (event.data?.type === "facebook_oauth_error") {
        setConnectingFacebook(false);
        toast.error(event.data.message || "Facebook connection failed");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [apiBase]);

  const openCreate = (platform = "Facebook") => {
    const preset = PLATFORM_PRESETS[platform];
    setEditingItem(null);
    setFacebookPages([]);
    setForm({
      ...emptyForm,
      name: `${platform} Lead Source`,
      platform,
      mode: preset.mode,
      status: preset.status,
      leadSourceLabel: preset.leadSourceLabel,
      webhookPath: preset.webhookPath,
      description: preset.description,
      verifyToken: platform === "Facebook" ? `propcrm_${Date.now()}` : "",
    });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFacebookPages([]);
    setForm({
      name: item.name || "",
      platform: item.platform || "Facebook",
      mode: item.mode || "webhook",
      status: item.status || "draft",
      description: item.description || "",
      leadSourceLabel: item.leadSourceLabel || "",
      externalSourceId: item.externalSourceId || "",
      pageId: item.pageId || "",
      formId: item.formId || "",
      externalSourceUrl: item.externalSourceUrl || "",
      webhookPath: item.webhookPath || "",
      verifyToken: item.verifyToken || "",
      accessToken: item.accessToken || "",
      mappingNotes: item.mappingNotes || "",
      isActive: item.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleChange = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handlePlatformChange = (event) => {
    const platform = event.target.value;
    const preset = PLATFORM_PRESETS[platform];
    setFacebookPages([]);
    setForm((current) => ({
      ...current,
      platform,
      mode: preset.mode,
      leadSourceLabel: preset.leadSourceLabel,
      webhookPath: preset.webhookPath,
      description: preset.description,
      pageId: "",
      formId: "",
      accessToken: "",
      verifyToken: platform === "Facebook" ? current.verifyToken || `propcrm_${Date.now()}` : "",
    }));
  };

  const handleFacebookPageChange = (event) => {
    const nextPageId = event.target.value;
    const nextPage = facebookPages.find((page) => page.id === nextPageId);
    setForm((current) => ({
      ...current,
      pageId: nextPageId,
      formId: nextPage?.forms?.[0]?.id || "",
      accessToken: nextPage?.accessToken || "",
    }));
  };

  const openFacebookConnect = () => {
    const token = localStorage.getItem("crm_token");
    if (!token) {
      toast.error("Please log in again to connect Facebook");
      return;
    }

    setConnectingFacebook(true);
    const url = `${apiBase}/api/automations/facebook/connect?token=${encodeURIComponent(token)}`;
    const popup = window.open(url, "propcrm-facebook-oauth", "width=720,height=760,resizable=yes,scrollbars=yes");
    if (!popup) {
      setConnectingFacebook(false);
      toast.error("Please allow popups to connect Facebook");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        const { data } = await api.patch(`/automations/${editingItem._id}`, form);
        setItems((current) => current.map((item) => (item._id === editingItem._id ? data.automation : item)));
        toast.success("Automation source updated");
      } else {
        const { data } = await api.post("/automations", form);
        setItems((current) => [data.automation, ...current]);
        toast.success("Automation source added");
      }
      setShowModal(false);
      setEditingItem(null);
      setForm(emptyForm);
      setFacebookPages([]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save automation source");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/automations/${deleting._id}`);
      setItems((current) => current.filter((item) => item._id !== deleting._id));
      toast.success("Automation source removed");
      setDeleting(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove automation source");
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyText = async (text, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Could not copy");
    }
  };

  const summary = useMemo(() => ({
    connected: items.filter((item) => item.status === "connected").length,
    webhook: items.filter((item) => item.mode === "webhook").length,
    api: items.filter((item) => item.mode === "api" || item.mode === "form").length,
  }), [items]);

  const recommendedEndpoint = `${apiBase}${form.webhookPath || selectedPreset.webhookPath}`;

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="stitch-kicker mb-2">Automation Hub</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Lead Source Automation</h1>
            <p className="mt-2 max-w-2xl text-sm text-app-soft">
              Connect Facebook, Google, WhatsApp, website forms, and custom lead sources from inside the CRM. No backend file edits needed for your end users.
            </p>
          </div>
          <button className="btn-primary rounded-xl" onClick={() => openCreate("Facebook")}>
            <Plus className="h-4 w-4" /> Add Source
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Connected Sources" value={summary.connected} note="Live inbound channels" />
        <MetricCard label="Webhook Sources" value={summary.webhook} note="Meta and custom webhooks" />
        <MetricCard label="API/Form Sources" value={summary.api} note="Google, website, and messaging flows" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {Object.entries(PLATFORM_PRESETS).map(([platform, preset]) => {
          const Icon = preset.icon;
          return (
            <button key={platform} type="button" className="card p-5 text-left transition hover:-translate-y-1 hover:border-orange-500/30" onClick={() => openCreate(platform)}>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${preset.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-app">{platform}</h3>
              <p className="mt-2 text-sm text-app-soft">{preset.description}</p>
            </button>
          );
        })}
      </section>

      {items.length === 0 ? (
        <section className="card">
          <EmptyState title="No automation sources yet" desc="Create your first Facebook, Google, WhatsApp, or website lead connection." action={<button className="btn-primary" onClick={() => openCreate("Facebook")}><Plus className="h-4 w-4" /> Add Source</button>} />
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const preset = PLATFORM_PRESETS[item.platform] || PLATFORM_PRESETS.Custom;
            const Icon = preset.icon;
            const endpointPath = item.webhookPath || "/api/leads";
            return (
              <article key={item._id} className="card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${preset.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-app">{item.name}</h3>
                      <p className="truncate text-sm text-app-soft">{item.platform} • {item.mode}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <span className={`badge ${item.status === "connected" ? "bg-emerald-500/10 text-emerald-400" : item.status === "paused" ? "bg-amber-500/10 text-amber-400" : "bg-white/5 text-app-soft"}`}>{item.status}</span>
                    <span className={`badge ${item.isActive ? "bg-orange-500/10 text-orange-400" : "bg-red-500/10 text-red-400"}`}>{item.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>

                <div className="rounded-[1.15rem] p-4 stitch-surface-muted space-y-3">
                  <div>
                    <p className="text-xs text-app-soft">Lead Source Label</p>
                    <p className="mt-1 text-sm text-app">{item.leadSourceLabel || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-app-soft">Recommended Endpoint</p>
                    <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <code className="rounded-xl px-3 py-2 text-xs text-orange-400" style={{ background: "var(--app-surface-low)" }}>{apiBase}{endpointPath}</code>
                      <button className="btn-secondary rounded-xl" onClick={() => copyText(`${apiBase}${endpointPath}`, "Endpoint copied")}>
                        <Copy className="h-4 w-4" /> Copy
                      </button>
                    </div>
                  </div>
                  {item.platform === "Facebook" && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <InfoField label="Page ID" value={item.pageId || "Not saved"} />
                      <InfoField label="Form ID" value={item.formId || "All forms on page"} />
                    </div>
                  )}
                  {item.externalSourceUrl && (
                    <div>
                      <p className="text-xs text-app-soft">External Source URL</p>
                      <a href={item.externalSourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 text-sm text-orange-500 underline-offset-4 hover:underline">
                        {item.externalSourceUrl}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary rounded-xl" onClick={() => openEdit(item)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button className="btn-secondary rounded-xl" onClick={() => copyText(`${apiBase}${endpointPath}`, "Endpoint copied")}>
                    <Copy className="h-4 w-4" /> Copy Endpoint
                  </button>
                  <button className="btn-danger rounded-xl" onClick={() => setDeleting(item)}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingItem ? "Edit Automation Source" : "Add Automation Source"} size="xl">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.85fr]">
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div>
              <label className="label">Source Name</label>
              <input className="input" value={form.name} onChange={handleChange("name")} required />
            </div>
            <div>
              <label className="label">Platform</label>
              <select className="select" value={form.platform} onChange={handlePlatformChange}>
                {Object.keys(PLATFORM_PRESETS).map((platform) => <option key={platform}>{platform}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Connection Mode</label>
              <select className="select" value={form.mode} onChange={handleChange("mode")}>
                <option value="webhook">Webhook</option>
                <option value="api">API</option>
                <option value="form">Form</option>
                <option value="spreadsheet">Spreadsheet</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={handleChange("status")}>
                <option value="draft">Draft</option>
                <option value="connected">Connected</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div>
              <label className="label">Lead Source Label</label>
              <input className="input" value={form.leadSourceLabel} onChange={handleChange("leadSourceLabel")} placeholder="Facebook / Google / WhatsApp" />
            </div>
            <div>
              <label className="label">Endpoint Path</label>
              <input className="input" value={form.webhookPath} onChange={handleChange("webhookPath")} placeholder="/webhook or /api/leads" />
            </div>

            {form.platform === "Facebook" ? (
              <>
                <div className="md:col-span-2 rounded-[1.25rem] border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-app">Facebook Login Connection</p>
                      <p className="mt-1 text-sm text-app-soft">Use OAuth to fetch the user’s pages and forms automatically.</p>
                    </div>
                    <button type="button" className="btn-primary rounded-xl" onClick={openFacebookConnect} disabled={connectingFacebook}>
                      <Webhook className="h-4 w-4" /> {connectingFacebook ? "Connecting..." : "Connect with Facebook"}
                    </button>
                  </div>
                  <p className="text-xs text-app-soft">This opens Facebook login in a popup and fills the pages/forms automatically after approval.</p>
                </div>
                <div>
                  <label className="label">Page</label>
                  <select className="select" value={form.pageId} onChange={handleFacebookPageChange}>
                    <option value="">Select Facebook Page</option>
                    {facebookPages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Lead Form</label>
                  <select className="select" value={form.formId} onChange={handleChange("formId")}>
                    <option value="">All forms on this page</option>
                    {currentForms.map((formOption) => <option key={formOption.id} value={formOption.id}>{formOption.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Facebook Page ID</label>
                  <input className="input" value={form.pageId} onChange={handleChange("pageId")} placeholder="Fetched automatically after OAuth" />
                </div>
                <div>
                  <label className="label">Verify Token</label>
                  <input className="input" value={form.verifyToken} onChange={handleChange("verifyToken")} placeholder="Generated automatically, editable if needed" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">External Source ID</label>
                  <input className="input" value={form.externalSourceId} onChange={handleChange("externalSourceId")} placeholder="Campaign, page, or partner ID" />
                </div>
                <div>
                  <label className="label">External Source URL</label>
                  <input className="input" value={form.externalSourceUrl} onChange={handleChange("externalSourceUrl")} placeholder="Landing page or source URL" />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea className="input min-h-[100px]" value={form.description} onChange={handleChange("description")} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Mapping Notes</label>
              <textarea className="input min-h-[100px]" value={form.mappingNotes} onChange={handleChange("mappingNotes")} placeholder="Example: map full_name, phone_number, email into CRM lead fields." />
            </div>
            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-app" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
              <input type="checkbox" checked={form.isActive} onChange={handleChange("isActive")} />
              This source is active and should keep receiving leads
            </label>
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editingItem ? "Update Source" : "Save Source"}</button>
            </div>
          </form>

          <aside className="rounded-[1.5rem] border p-5 space-y-5 stitch-surface-muted" style={{ borderColor: "var(--app-border)" }}>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selectedPreset.tone}`}>
                <SelectedIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="stitch-kicker">Guided Setup</p>
                <h3 className="text-lg font-semibold text-app">{form.platform}</h3>
              </div>
            </div>

            <div className="space-y-3">
              {selectedPreset.steps.map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-500">{index + 1}</div>
                  <p className="text-sm text-app-soft">{step}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.15rem] border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-app"><ShieldCheck className="h-4 w-4 text-orange-500" /> CRM Callback Details</div>
              <div>
                <p className="text-xs text-app-soft">Callback URL</p>
                <code className="mt-2 block rounded-xl px-3 py-2 text-xs text-orange-400" style={{ background: "var(--app-surface-low)" }}>{recommendedEndpoint}</code>
              </div>
              {form.platform === "Facebook" && (
                <>
                  <div>
                    <p className="text-xs text-app-soft">Webhook Field</p>
                    <p className="mt-1 text-sm text-app">Subscribe to the <span className="text-orange-500">leadgen</span> field in Meta Webhooks.</p>
                  </div>
                  <button type="button" className="btn-secondary rounded-xl w-full" onClick={() => copyText(recommendedEndpoint, "Callback URL copied")}>
                    <Copy className="h-4 w-4" /> Copy Callback URL
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Remove Automation Source"
        message={deleting ? `Remove ${deleting.name} from your automation list?` : ""}
      />
    </div>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <div className="card p-5">
      <p className="stitch-kicker mb-2">{label}</p>
      <p className="text-3xl font-black tracking-tight text-app">{value}</p>
      <p className="mt-2 text-xs text-app-soft">{note}</p>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-app-soft">{label}</p>
      <p className="mt-1 text-sm text-app">{value}</p>
    </div>
  );
}
