// WebsitesPage.jsx — /integrations/websites: the WordPress sites sending their
// form enquiries in (owner, 28 Oct 2026). Replaces the old "WordPress / Website
// Forms" popup on /integrations with a page in the same frame as Plivo and the
// portals. Each site has its own key, pasted into the ArthaLeads plugin.
// Backend: /api/automations/website/* (controllers/automationController.js).
import { useCallback, useEffect, useState } from "react";
import { Globe, FileText, Clock, Copy, Check, Download, Plus, Trash2, ExternalLink, Loader2, KeyRound, Puzzle, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { ConfirmDialog, Modal } from "../../components/UI";
import { isGenericSiteName } from "../../utils/leadSource";
import { IntegrationShell, Panel, Steps, StatusChip, LogoTile, SiteFavicon, WordPressIcon, FORM_PLUGINS, ago, istWhen } from "../../components/integrations/IntegrationUI";

const PLUGIN_ZIP = "/arthaleads-integration.zip";

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => toast.error("Could not copy. Select the key and copy it."));
    }} className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0">
      {done ? <Check className="w-3.5 h-3.5" style={{ color: "#16a34a" }} /> : <Copy className="w-3.5 h-3.5" />} {done ? "Copied" : "Copy"}
    </button>
  );
}

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url || ""; } };

// The name you gave the site wins; then the name its plugin reports; then its address.
const siteTitle = (site) => (!isGenericSiteName(site.name) && site.name)
  || (!isGenericSiteName(site.siteName) && site.siteName)
  || (site.siteUrl ? hostOf(site.siteUrl) : site.name);

/**
 * Add a site (name and address, then its key) or edit one (name and address).
 * After adding, the key stays on screen so it can be copied before going to WordPress.
 */
function SiteForm({ open, site, onClose, onSaved }) {
  const editing = !!site?.id;
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(editing ? siteTitle(site) : "");
    setUrl(editing ? site.siteUrl || "" : "");
    setError(""); setCreated(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Give the site a name."); return; }
    setBusy(true); setError("");
    try {
      if (editing) {
        const { data } = await api.patch(`/automations/website/${site.id}`, { name: name.trim(), siteUrl: url.trim() });
        const moved = data.connection.siteUrl !== (site.siteUrl || "");
        onSaved({ ...site, ...data.connection, ...(moved ? { siteIconUrl: "", siteIconKind: "" } : {}) });
        toast.success("Site saved.");
        onClose();
      } else {
        const { data } = await api.post("/automations/website/create", { name: name.trim(), siteUrl: url.trim() });
        onSaved(data.connection, true);
        setCreated(data.connection);
      }
    } catch (err) { setError(err?.response?.data?.message || "Could not save. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={created ? "Site added" : editing ? "Edit site" : "Add a site"} size="sm">
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-app-soft">Paste this key into the ArthaLeads plugin on <b className="text-app">{created.name}</b>. It turns Connected here once the plugin is saved.</p>
          <div className="flex items-center gap-2">
            <input className="input w-full font-mono text-xs" readOnly value={created.token} onFocus={(e) => e.target.select()} aria-label="Connection key" />
            <CopyButton text={created.token} />
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn-primary rounded-full px-5 py-2 text-sm font-semibold" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="site-name" className="text-xs font-semibold text-app-soft">Site name</label>
            <input id="site-name" className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Green Valley Homes" maxLength={120} autoFocus />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="site-url" className="text-xs font-semibold text-app-soft">Website address <span className="font-normal">(optional)</span></label>
            <input id="site-url" className="input w-full" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="greenvalleyhomes.com" inputMode="url" />
            <p className="text-xs text-app-soft">Used for the site's icon. The plugin fills it in when it connects.</p>
          </div>
          {editing && <p className="text-xs text-app-soft">New leads from this site show this name as their source.</p>}
          {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary rounded-full px-5 py-2 text-sm font-semibold inline-flex items-center gap-1.5" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save" : "Add site"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function SiteCard({ site, onRemove, onEdit }) {
  const connected = site.status === "connected";
  const title = siteTitle(site);
  return (
    <section className="card p-5 flex flex-col gap-4" style={{ boxShadow: site.justAdded ? "0 0 0 2px rgba(var(--app-primary-rgb),0.45)" : "none" }}>
      <div className="flex items-start gap-3">
        <LogoTile size={44} bg="#fff">
          <SiteFavicon iconUrl={site.siteIconUrl} kind={site.siteIconKind} name={site.siteName || site.siteUrl || site.name} size={26} />
        </LogoTile>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-app leading-tight truncate">{title}</p>
          {site.siteUrl ? (
            <a href={site.siteUrl} target="_blank" rel="noopener noreferrer"
              className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-app-soft hover:text-app">
              <span className="truncate">{hostOf(site.siteUrl)}</span> <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : <p className="text-xs text-app-soft mt-0.5">Site address appears once the plugin is saved</p>}
        </div>
        <StatusChip tone={connected ? "on" : "warn"}>{connected ? "Connected" : "Waiting for plugin"}</StatusChip>
      </div>

      <dl className="text-sm">
        <div className="flex items-center justify-between gap-4 py-1.5">
          <dt className="text-app-soft">Last lead</dt>
          <dd className="text-app font-semibold text-right">{site.lastSyncAt ? `${istWhen(site.lastSyncAt)} · ${ago(site.lastSyncAt)}` : "None yet"}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-1.5" style={{ borderTop: "1px solid var(--app-border)" }}>
          <dt className="text-app-soft pt-0.5">Forms</dt>
          <dd className="flex flex-wrap justify-end gap-1.5 min-w-0">
            {site.connectedForms?.length
              ? site.connectedForms.map((f) => (
                <span key={f} className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-app"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>{f}</span>
              ))
              : <span className="text-app font-semibold">{connected ? "Any form on the site" : "-"}</span>}
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-app-soft flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Connection key</label>
        <div className="flex items-center gap-2">
          <input className="input w-full font-mono text-xs" readOnly value={site.token} onFocus={(e) => e.target.select()} aria-label={`${title} connection key`} />
          <CopyButton text={site.token} />
        </div>
        {!connected && <p className="text-xs text-app-soft">Paste this key into the ArthaLeads plugin on the site. This page updates by itself once it connects.</p>}
      </div>

      <div className="flex justify-end gap-1 pt-3 -mb-1" style={{ borderTop: "1px solid var(--app-border)" }}>
        <button type="button" onClick={() => onEdit(site)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-app-soft hover:text-app transition">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button type="button" onClick={() => onRemove(site)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-app-soft hover:text-red-500 transition">
          <Trash2 className="h-3.5 w-3.5" /> Remove site
        </button>
      </div>
    </section>
  );
}

export default function WebsitesPage() {
  const [tab, setTab] = useState("sites");
  const [sites, setSites] = useState(null);
  const [form, setForm] = useState(null); // {} to add a site, a site to edit it
  const [removing, setRemoving] = useState(null);
  const [busyRemove, setBusyRemove] = useState(false);

  const load = useCallback(() => api.get("/automations/website/token")
    .then(({ data }) => {
      const list = data.connections || [];
      setSites((prev) => {
        const fresh = new Set((prev || []).filter((x) => x.justAdded).map((x) => x.id));
        return [...list.filter((x) => fresh.has(x.id)).map((x) => ({ ...x, justAdded: true })), ...list.filter((x) => !fresh.has(x.id))];
      });
      return list;
    })
    .catch(() => { setSites((s) => s || []); return null; }), []);

  useEffect(() => { load(); }, [load]);

  // While a site is waiting for its plugin, check every 4 seconds so it turns
  // Connected on its own.
  const waiting = (sites || []).some((s) => s.status !== "connected");
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [waiting, load]);

  const addSite = () => setForm({});
  // A new site goes to the top, outlined, so it is seen without scrolling.
  const onSaved = (conn, isNew) => {
    if (isNew) { setTab("sites"); setSites((prev) => [{ ...conn, justAdded: true }, ...(prev || [])]); }
    else setSites((prev) => prev.map((x) => (x.id === conn.id ? { ...x, ...conn } : x)));
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusyRemove(true);
    try {
      await api.delete(`/automations/${removing.id}`);
      setSites((prev) => prev.filter((s) => s.id !== removing.id));
      toast.success("Site removed.");
      setRemoving(null);
    } catch (e) { toast.error(e?.response?.data?.message || "Could not remove the site."); }
    finally { setBusyRemove(false); }
  };

  const list = sites || [];
  const connected = list.filter((s) => s.status === "connected");
  const forms = new Set(list.flatMap((s) => s.connectedForms || [])).size;
  const last = list.map((s) => s.lastSyncAt).filter(Boolean).sort().pop();

  return (
    <IntegrationShell
      logo={<LogoTile size={52} bg="#21759b"><WordPressIcon /></LogoTile>}
      name="Website forms"
      status={!sites ? undefined : connected.length ? `${connected.length} connected` : list.length ? "Waiting for plugin" : "Not connected"}
      statusTone={connected.length ? "on" : list.length ? "warn" : "off"}
      description="Enquiries from the contact forms on your WordPress sites arrive in Leads by themselves, with the site and page they came from. Each site has its own key."
      actions={<>
        <a href={PLUGIN_ZIP} download className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5">
          <Download className="h-4 w-4" /> Download plugin
        </a>
        <button type="button" onClick={addSite} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add a site
        </button>
      </>}
      stats={[
        { icon: Globe, label: "Sites connected", value: sites ? `${connected.length} of ${list.length}` : "-" },
        { icon: FileText, label: "Forms sending", value: sites ? forms : "-" },
        { icon: Clock, label: "Last lead", value: last ? ago(last) : "None yet", note: last ? istWhen(last) : undefined },
      ]}
      tabs={[{ key: "sites", label: "Sites", count: sites ? list.length : undefined }, { key: "help", label: "Setup help" }]}
      tab={tab} onTab={setTab}
    >
      {tab === "sites" && !sites && (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-app-soft" /></div>
      )}

      {tab === "sites" && sites && list.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <LogoTile size={48} bg="#21759b"><WordPressIcon /></LogoTile>
            <p className="text-base font-bold text-app">No websites connected yet</p>
            <p className="text-sm text-app-soft max-w-md">Add a site to get its key, install the ArthaLeads plugin on that WordPress site and paste the key in. Its form enquiries then come straight into Leads.</p>
            <button type="button" onClick={addSite} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add a site
            </button>
          </div>
        </Panel>
      )}

      {tab === "sites" && list.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          {list.map((s) => <SiteCard key={s.id} site={s} onRemove={setRemoving} onEdit={setForm} />)}
        </div>
      )}

      {tab === "help" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <Panel icon={Puzzle} title="Connect a WordPress site">
            <Steps items={[
              <>Click <b>Add a site</b> above, give it a name and copy its key.</>,
              <>In WordPress go to <b>Plugins → Add New</b>, search for <b>ArthaLeads</b> and install it. Or download the plugin here and use <b>Upload Plugin</b>.</>,
              <>Activate it and open <b>ArthaLeads CRM</b> in the WordPress menu.</>,
              <>Paste the key into <b>Account Token</b>, enter the site's name and click <b>Save</b>.</>,
              <>The site shows <b>Connected</b> here. Every form enquiry now comes into Leads.</>,
            ]} />
          </Panel>
          <Panel icon={FileText} title="Form plugins it reads">
            <div className="flex flex-wrap gap-2">
              {FORM_PLUGINS.map((p) => (
                <span key={p} className="rounded-full px-3 py-1 text-xs font-semibold text-app"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>{p}</span>
              ))}
            </div>
            <p className="text-xs text-app-soft">Name, phone, email and message are picked up whatever the fields are called. Each lead keeps the page it was sent from, and the ad that brought the visitor when the link carried one.</p>
            <p className="text-xs text-app-soft">One key per site. Removing a site here stops its leads; the plugin on that site will need a new key.</p>
          </Panel>
        </div>
      )}

      <SiteForm open={!!form} site={form} onClose={() => setForm(null)} onSaved={onSaved} />

      <ConfirmDialog
        open={!!removing}
        title="Remove this site?"
        message={removing ? `${siteTitle(removing)} will stop sending leads. Leads already in your CRM stay.` : ""}
        confirmLabel="Remove"
        loading={busyRemove}
        onConfirm={confirmRemove}
        onClose={() => !busyRemove && setRemoving(null)}
      />
    </IntegrationShell>
  );
}
