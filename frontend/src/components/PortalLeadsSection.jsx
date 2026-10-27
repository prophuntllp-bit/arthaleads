// PortalLeadsSection.jsx — leads from 99acres, Housing.com and MagicBricks
// (27 Oct 2026, Growth). The portals don't let a CRM sign in like Facebook
// does: the company's account manager at each portal points enquiries at the
// company's private link, and Housing.com can also be fetched with the ID and
// key it issues. Backend: /api/portal-leads (routes/portalRoutes.js).
//
// A short card on Integrations; the links and steps open in a popup, like
// Conversion tracking, so the page stays short.
import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Lock, Settings2, Copy, Check, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/plan";
import { Modal } from "./UI";

const DOT = { "99acres": "#65A30D", housing: "#7C3AED", magicbricks: "#4F46E5" };
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

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

export default function PortalLeadsSection() {
  const { user, org } = useAuth();
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("99acres");
  const [hForm, setHForm] = useState({ profileId: "", secretKey: "" });
  const [busy, setBusy] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);

  const allowed = user?.role === "super_admin" || (user?.role === "admin" && canAccess(org, "growth"));
  const apply = useCallback((data) => { setD(data); setHForm({ profileId: data.housing.profileId, secretKey: "" }); }, []);
  const load = useCallback(() => { api.get("/portal-leads/settings").then((r) => apply(r.data)).catch(() => {}); }, [apply]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (user?.role === "admin" && !canAccess(org, "growth")) {
    return (
      <section className="card p-6 flex items-start gap-3">
        <Lock className="w-4 h-4 mt-1 text-app-soft shrink-0" />
        <div>
          <h3 className="text-base font-bold text-app">Property portals</h3>
          <p className="text-sm text-app-soft mt-1">Get 99acres, Housing.com and MagicBricks enquiries straight into your leads. Available on Growth and above.</p>
        </div>
      </section>
    );
  }
  if (!allowed || !d) return null;

  const saveHousing = async (patch) => {
    setBusy("save");
    try {
      const { data } = await api.put("/portal-leads/settings/housing", patch);
      apply(data);
      toast.success("Saved.");
    } catch (e) { toast.error(e?.response?.data?.message || "Could not save."); }
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

  const current = d.portals.find((p) => p.slug === tab) || d.portals[0];
  const h = d.housing;

  return (
    <section className="card p-6 space-y-4">
      <div>
        <p className="stitch-kicker mb-1">Property portals</p>
        <h3 className="text-base font-bold text-app">99acres, Housing.com and MagicBricks</h3>
        <p className="text-sm text-app-soft mt-1 max-w-xl">
          Portal enquiries arrive in Leads by themselves, tagged with the portal and project. A buyer who is already a lead gets the new enquiry on their existing lead.
        </p>
      </div>

      <div className="space-y-1.5">
        {d.portals.map((p) => (
          <div key={p.slug} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOT[p.slug] }} />
            <b className="text-app w-24">{p.label}</b>
            <span className="text-app-soft">
              {p.lastLeadAt ? <>Last enquiry {when(p.lastLeadAt)} · <b className="text-app">{p.leads30d}</b> in 30 days</> : "No enquiries yet"}
              {p.slug === "housing" && h.enabled ? " · fetched every 15 minutes" : ""}
            </span>
          </div>
        ))}
      </div>

      {h.enabled && h.lastError && (
        <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-2" style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2">Housing.com fetch failed: {h.lastError}</span>
        </div>
      )}

      <button type="button" onClick={() => setOpen(true)} className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2">
        <Settings2 className="w-4 h-4" /> Set up portals
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setConfirmNew(false); load(); }} title="Property portal leads" size="lg">
        <div className="space-y-5">
          <div role="tablist" aria-label="Portal" className="inline-flex flex-wrap gap-1 rounded-xl p-1"
            style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-low)" }}>
            {d.portals.map((p) => {
              const on = tab === p.slug;
              return (
                <button key={p.slug} type="button" role="tab" aria-selected={on} onClick={() => setTab(p.slug)}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
                  style={on
                    ? { color: "var(--app-text)", background: "var(--app-surface-solid)", boxShadow: "0 0 0 1px rgba(var(--app-primary-rgb),0.45), 0 1px 2px rgba(16,24,40,0.06)" }
                    : { color: "var(--app-text-soft)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: DOT[p.slug] }} /> {p.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-app-soft block">Your {current.label} link</label>
            <div className="flex items-center gap-2">
              <input className="input w-full font-mono text-xs" readOnly value={current.link} onFocus={(e) => e.target.select()} aria-label={`${current.label} link`} />
              <CopyButton text={current.link} />
            </div>
            <p className="text-xs text-app-soft">Keep this link private: anything sent to it becomes a lead in your account.</p>
          </div>

          <ol className="space-y-1.5 text-sm text-app list-decimal pl-5">
            <li>Send the message below to your {current.label} account manager. {current.slug === "magicbricks" ? "" : `If your ${current.label} dashboard has a CRM or webhook setting, you can paste the link there instead.`}</li>
            <li>Ask them to send a test lead. It shows up in Leads with the source {current.slug === "housing" ? "Housing.com" : current.label}.</li>
            <li>From then on every enquiry arrives within seconds.</li>
          </ol>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-app-soft">Message for your account manager</label>
              <CopyButton text={managerMessage(current.label, current.link)} label="Copy message" />
            </div>
            <pre className="rounded-2xl px-4 py-3 text-xs whitespace-pre-wrap break-words text-app-soft" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              {managerMessage(current.label, current.link)}
            </pre>
          </div>

          <p className="text-xs text-app-soft">
            Portals usually include CRM delivery only on builder or higher packages. If your account manager says it isn't included, ask which package adds it.
          </p>

          {tab === "housing" && (
            <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--app-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-app">Or fetch with the Housing.com API</p>
                  <p className="text-xs text-app-soft mt-0.5">For builder accounts: Housing.com gives you an ID and a secret key. We check for new enquiries every 15 minutes.</p>
                </div>
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
                {h.lastPullAt && <span className="text-xs text-app-soft">Last checked {when(h.lastPullAt)}</span>}
              </div>
              {h.lastError && <p className="text-xs" style={{ color: "#dc2626" }}>{h.lastError}</p>}
            </div>
          )}

          <div className="pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--app-border)" }}>
            {confirmNew ? (
              <>
                <span className="text-xs text-app-soft">The current links for all three portals stop working. Make new ones?</span>
                <button type="button" disabled={!!busy} onClick={newLink} className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: "#dc2626" }}>
                  {busy === "link" ? "Making..." : "Yes, new links"}
                </button>
                <button type="button" onClick={() => setConfirmNew(false)} className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold">Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmNew(true)} className="text-xs font-semibold text-app-soft underline underline-offset-2">
                Link shared by mistake? Make new links
              </button>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
