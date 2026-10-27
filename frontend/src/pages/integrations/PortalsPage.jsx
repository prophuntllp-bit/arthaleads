// PortalsPage.jsx — /integrations/portals: leads from 99acres, Housing.com and
// MagicBricks (27 Oct 2026, Growth) on their own page. The portals don't let a
// CRM sign in like Facebook does: each portal's account manager points
// enquiries at the company's private link, and Housing.com can also be fetched
// with the ID and key it issues. Backend: /api/portal-leads (routes/portalRoutes.js).
import { useCallback, useEffect, useState } from "react";
import { Building2, Inbox, Clock, Link2, Copy, Check, RefreshCw, Loader2, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import SegmentTabs from "../../components/SegmentTabs";
import { useAuth } from "../../context/AuthContext";
import { canAccess } from "../../utils/plan";
import { IntegrationShell, Panel, KeyValues, Steps, PlanLocked, StatusChip, PortalsLogo, MiniLogo, ago, istWhen } from "../../components/integrations/IntegrationUI";

export const PortalLogo = PortalsLogo;

function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => toast.error("Could not copy. Select the text and copy it."));
    }} className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0">
      {done ? <Check className="w-3.5 h-3.5" style={{ color: "#16a34a" }} /> : <Copy className="w-3.5 h-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

const managerMessage = (label, link) => `Hi,

Please send our ${label} enquiries to our CRM (ArthaLeads) as they come in.

Webhook URL: ${link}

It accepts POST (JSON or form data) or GET with the values in the link. We read name, phone, email, project, locality, city, message and the enquiry ID, whatever the field names are.

Please send one test lead once it is set up. Thank you.`;

export default function PortalsPage() {
  const { user, org } = useAuth();
  const allowed = user?.role === "super_admin" || (user?.role === "admin" && canAccess(org, "growth"));
  const [tab, setTab] = useState("overview");
  const [portal, setPortal] = useState("99acres");
  const [d, setD] = useState(null);
  const [hForm, setHForm] = useState({ profileId: "", secretKey: "" });
  const [busy, setBusy] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);

  const apply = useCallback((data) => { setD(data); setHForm({ profileId: data.housing.profileId, secretKey: "" }); }, []);
  const load = useCallback(() => { api.get("/portal-leads/settings").then((r) => apply(r.data)).catch(() => {}); }, [apply]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const shell = { logo: <PortalLogo size={52} />, name: "Property portals", description: "99acres, Housing.com and MagicBricks enquiries arrive in Leads by themselves, tagged with the portal and project. A buyer who is already a lead gets the new enquiry on their existing lead." };
  if (!allowed) {
    return (
      <IntegrationShell {...shell}>
        {user?.role === "admin" ? <PlanLocked what="Property portal leads" /> : <Panel><p className="text-sm text-app-soft">Only an admin can set up property portals.</p></Panel>}
      </IntegrationShell>
    );
  }

  const saveHousing = async (patch) => {
    setBusy("save");
    try { const { data } = await api.put("/portal-leads/settings/housing", patch); apply(data); toast.success("Saved."); }
    catch (e) { toast.error(e?.response?.data?.message || "Could not save."); }
    finally { setBusy(""); }
  };
  const pullNow = async () => {
    setBusy("pull");
    try {
      const { data } = await api.post("/portal-leads/settings/housing/pull");
      apply(data.settings);
      const got = (data.created || 0) + (data.added || 0);
      toast.success(got ? `${got} new ${got === 1 ? "enquiry" : "enquiries"} from Housing.com.` : "Connected. No new enquiries right now.");
    } catch (e) { toast.error(e?.response?.data?.message || "Could not reach Housing.com."); load(); }
    finally { setBusy(""); }
  };
  const newLink = async () => {
    setBusy("link");
    try { const { data } = await api.post("/portal-leads/settings/new-link"); apply(data); setConfirmNew(false); toast.success("New links made. Send them to your portal account managers."); }
    catch (e) { toast.error(e?.response?.data?.message || "Could not make a new link."); }
    finally { setBusy(""); }
  };

  const portals = d?.portals || [];
  const total30 = portals.reduce((n, p) => n + (p.leads30d || 0), 0);
  const last = portals.map((p) => p.lastLeadAt).filter(Boolean).sort().pop();
  const live = portals.filter((p) => p.lastLeadAt).length + (d?.housing?.enabled && !portals.find((p) => p.slug === "housing")?.lastLeadAt ? 1 : 0);
  const current = portals.find((p) => p.slug === portal) || portals[0];
  const h = d?.housing || {};

  return (
    <IntegrationShell {...shell}
      status={!d ? undefined : live ? "Receiving leads" : "Not connected"}
      statusTone={live ? "on" : "off"}
      stats={[
        { icon: Inbox, label: "Enquiries · 30 days", value: d ? total30.toLocaleString("en-IN") : "-" },
        { icon: Building2, label: "Portals sending", value: d ? `${portals.filter((p) => p.lastLeadAt).length} of 3` : "-" },
        { icon: Clock, label: "Last enquiry", value: last ? ago(last) : "None yet" },
        { icon: RefreshCw, label: "Housing.com fetch", value: h.enabled ? "Every 15 min" : "Off" },
      ]}
      tabs={[{ key: "overview", label: "Overview" }, { key: "settings", label: "Settings" }, { key: "help", label: "Setup help" }]}
      tab={tab} onTab={setTab}
    >
      {tab === "overview" && d && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <Panel icon={Link2} title="Portals">
            <div className="text-sm">
              {portals.map((p, i) => (
                <div key={p.slug} className="flex items-center gap-3 py-2.5" style={i ? { borderTop: "1px solid var(--app-border)" } : undefined}>
                  <MiniLogo brand={p.slug} alt={p.label} size={20} />
                  <span className="font-semibold text-app w-28">{p.label}</span>
                  <span className="text-app-soft flex-1 min-w-0 truncate">
                    {p.lastLeadAt ? `Last enquiry ${istWhen(p.lastLeadAt)}` : "No enquiries yet"}
                  </span>
                  <span className="text-app font-semibold">{p.leads30d}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-app-soft">Count of new leads from each portal in the last 30 days. Repeat enquiries are added to the existing lead.</p>
          </Panel>
          <Panel title="What we read from each enquiry">
            <KeyValues rows={[
              ["Contact", "Name, phone, email"],
              ["Property", "Project, locality, city"],
              ["Enquiry", "Message, budget, enquiry ID"],
              ["Project match", "Filed into your project with the same name"],
              ["Repeat buyer", "Added to their existing lead"],
            ]} />
          </Panel>
        </div>
      )}

      {tab === "settings" && d && (
        <div className="space-y-4">
          <Panel>
            <SegmentTabs ariaLabel="Portal" value={portal} onChange={setPortal}
              tabs={portals.map((p) => ({ value: p.slug, label: <span className="inline-flex items-center gap-2"><MiniLogo brand={p.slug} size={16} /> {p.label}</span> }))} />
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-app-soft block">Your {current.label} link</label>
              <div className="flex items-center gap-2">
                <input className="input w-full font-mono text-xs" readOnly value={current.link} onFocus={(e) => e.target.select()} aria-label={`${current.label} link`} />
                <CopyButton text={current.link} />
              </div>
              <p className="text-xs text-app-soft">Keep this link private: anything sent to it becomes a lead in your account.</p>
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-app-soft">Message for your {current.label} account manager</label>
                <CopyButton text={managerMessage(current.label, current.link)} label="Copy message" />
              </div>
              <pre className="rounded-2xl px-4 py-3 text-xs whitespace-pre-wrap break-words text-app-soft" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                {managerMessage(current.label, current.link)}
              </pre>
            </div>
          </Panel>

          <Panel icon={KeyRound} title="Housing.com API (builder accounts)">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-app-soft max-w-xl">Housing.com gives builder accounts an ID and a secret key. With them saved, we check for new enquiries every 15 minutes, as well as anything sent to your link.</p>
              <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none" title={h.profileId && h.keySet ? "" : "Save the ID and key first"}>
                <span className="text-xs font-semibold text-app-soft">{h.enabled ? "On" : "Off"}</span>
                <input type="checkbox" className="sr-only peer" checked={h.enabled} disabled={!!busy || !(h.profileId && h.keySet)}
                  onChange={(e) => saveHousing({ enabled: e.target.checked })} />
                <span className="w-10 h-6 rounded-full relative transition peer-disabled:opacity-40" style={{ background: h.enabled ? "#16a34a" : "var(--app-border)" }}>
                  <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: h.enabled ? "translateX(16px)" : "none" }} />
                </span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1.5 block">Housing.com ID</label>
                <input className="input w-full" name="housing-profile-id" autoComplete="off" data-lpignore="true" data-1p-ignore placeholder="e.g. 4544"
                  value={hForm.profileId} onChange={(e) => setHForm((f) => ({ ...f, profileId: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1.5 block">Secret key</label>
                <input className="input w-full" name="housing-secret-key" type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore
                  placeholder={h.keySet ? "Saved. Paste a new one to replace it." : "Paste the key Housing.com gave you"}
                  value={hForm.secretKey} onChange={(e) => setHForm((f) => ({ ...f, secretKey: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!!busy || (!hForm.secretKey && hForm.profileId === h.profileId)}
                onClick={() => saveHousing({ profileId: hForm.profileId, ...(hForm.secretKey ? { secretKey: hForm.secretKey } : {}) })}
                className="btn-primary rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
              <button type="button" disabled={!!busy || !(h.profileId && h.keySet)} onClick={pullNow}
                className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {busy === "pull" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Fetch now
              </button>
              {h.lastPullAt && <span className="text-xs text-app-soft">Last checked {istWhen(h.lastPullAt)}</span>}
              {h.enabled && <StatusChip tone={h.lastError ? "warn" : "on"}>{h.lastError ? "Fetch failing" : "Fetching"}</StatusChip>}
            </div>
            {h.lastError && <p className="text-xs" style={{ color: "#dc2626" }}>{h.lastError}</p>}
          </Panel>

          <Panel title="Private links">
            {confirmNew ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-app-soft">The current links for all three portals stop working. Make new ones?</span>
                <button type="button" disabled={!!busy} onClick={newLink} className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: "#dc2626" }}>
                  {busy === "link" ? "Making..." : "Yes, new links"}
                </button>
                <button type="button" onClick={() => setConfirmNew(false)} className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold">Cancel</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-app-soft">Shared a link by mistake? Make new links; the old ones stop working.</p>
                <button type="button" onClick={() => setConfirmNew(true)} className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold">Make new links</button>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "help" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <Panel title="Set it up">
            <Steps items={[
              "On the Settings tab, pick the portal and copy the message for your account manager.",
              "Send it to your account manager at that portal. If your portal dashboard has a CRM or webhook setting, paste the link there instead.",
              "Ask them for a test lead. It shows up in Leads with the portal as the source.",
              "For Housing.com builder accounts, you can also save the ID and key they give you to fetch enquiries every 15 minutes.",
            ]} />
          </Panel>
          <Panel title="If something goes wrong">
            <KeyValues rows={[
              ["Portal says CRM delivery isn't included", "It usually comes with builder or higher packages; ask which one adds it"],
              ["Lead had no phone number", "Not saved; ask the portal to include the phone"],
              ["Housing.com fetch failing", "Check the ID and key with your account manager"],
            ]} />
          </Panel>
        </div>
      )}
    </IntegrationShell>
  );
}
