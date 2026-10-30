// pages/SuperAdminDemoRequests.jsx - "Book a Demo" requests from the website.
//
// Every request from /book-demo lands here (and is emailed to the super admins
// and contact@arthaleads.com). The team moves each one through New ->
// Contacted -> Scheduled -> Done, or marks it Not a fit, and keeps notes.
// Accounts are still approved under Organizations when the prospect signs up.
import { Fragment, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarCheck2, RefreshCw, Phone, Mail, MessageCircle, X } from "lucide-react";
import api from "../services/api";
import { Spinner } from "../components/UI";

const STATUSES = [
  { value: "all",       label: "All" },
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "done",      label: "Done" },
  { value: "not_a_fit", label: "Not a fit" },
];
const STATUS_STYLE = {
  new:       { background: "rgba(255,107,0,0.14)", color: "#ea580c" },
  contacted: { background: "rgba(37,99,235,0.14)", color: "#2563eb" },
  scheduled: { background: "rgba(147,51,234,0.14)", color: "#9333ea" },
  done:      { background: "rgba(22,163,74,0.14)", color: "#16a34a" },
  not_a_fit: { background: "rgba(107,114,128,0.16)", color: "#6b7280" },
};
const label = (s) => STATUSES.find((x) => x.value === s)?.label || s;
const fmt = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtDay = (ymd) => (ymd ? new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }) : "");
const waNumber = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };

function Detail({ item, onClose, onSaved }) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/super-admin/demo-requests/${item._id}`, { status, notes });
      toast.success("Saved");
      onSaved(data.item);
    } catch { toast.error("Could not save"); } finally { setSaving(false); }
  };
  const rows = [
    ["Company", item.company], ["Role", item.role], ["Business", item.businessType], ["Team size", item.teamSize],
    ["City", item.city], ["Leads per month", item.monthlyLeads], ["Lead sources", (item.leadSources || []).join(", ")],
    ["Uses today", item.currentTool], ["Preferred day", fmtDay(item.preferredDate)], ["Preferred time", item.preferredTime],
    ["Format", item.format], ["Language", item.language], ["Came from", item.source],
  ].filter(([, v]) => v);
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="modal-panel rounded-[1.5rem] w-full max-w-xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-app">{item.name}</h2>
            <p className="text-xs text-app-soft">Requested {fmt(item.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-app-soft hover:text-app" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <a href={`tel:${item.phone}`} className="btn-secondary text-xs px-3 py-2 gap-1.5"><Phone className="w-3.5 h-3.5" /> {item.phone}</a>
          <a href={`https://wa.me/${waNumber(item.phone)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-3 py-2 gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
          <a href={`mailto:${item.email}`} className="btn-secondary text-xs px-3 py-2 gap-1.5"><Mail className="w-3.5 h-3.5" /> {item.email}</a>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs mb-4">
          {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-app-soft">{k}</dt><dd className="font-semibold text-app">{v}</dd></Fragment>))}
        </dl>
        {item.message && (
          <div className="rounded-xl p-3 mb-4 text-xs text-app" style={{ background: "var(--app-surface-2, rgba(0,0,0,0.04))" }}>
            <p className="text-app-soft mb-1">What they want to see</p>{item.message}
          </div>
        )}
        <label className="block text-xs font-semibold text-app mb-1.5">Status</label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {STATUSES.filter((s) => s.value !== "all").map((s) => (
            <button key={s.value} type="button" onClick={() => setStatus(s.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition"
              style={status === s.value ? { ...STATUS_STYLE[s.value], borderColor: "currentColor" } : { borderColor: "transparent" }}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-semibold text-app mb-1.5" htmlFor="demo-notes">Notes</label>
        <textarea id="demo-notes" rows={3} className="input mb-4" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call notes, the time agreed, next step" />
        {item.handledBy?.name && <p className="text-[11px] text-app-soft mb-3">Last updated by {item.handledBy.name}{item.handledAt ? `, ${fmt(item.handledAt)}` : ""}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDemoRequests() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState("new");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  useEffect(() => { document.title = "Demo requests · Arthaleads Admin"; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/super-admin/demo-requests${filter !== "all" ? `?status=${filter}` : ""}`);
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch { toast.error("Could not load demo requests"); } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="stitch-page">
      {open && <Detail item={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
      <div className="mb-5">
        <h1 className="text-xl font-black text-app">Demo requests</h1>
        <p className="text-xs text-app-soft mt-0.5">From the Book a Demo page on the website. Accounts are approved under Organizations once they sign up.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {STATUSES.map(({ value, label: l }) => {
          const n = value === "all" ? total : (counts[value] || 0);
          const active = filter === value;
          return (
            <button key={value} type="button" onClick={() => setFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${active ? "text-white border-transparent shadow-sm" : "text-app-soft border-transparent hover:text-app hover:bg-black/5 dark:hover:bg-white/5"}`}
              style={active ? { background: "var(--app-primary)" } : {}}>
              {l}
              <span className={`inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-black ${active ? "bg-white/20 text-white" : "bg-black/8 dark:bg-white/10 text-app-soft"}`}>{n}</span>
            </button>
          );
        })}
        <button type="button" onClick={load} className="btn-secondary gap-1.5 text-xs px-3 py-2 ml-auto" title="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarCheck2 className="h-12 w-12 text-app-soft/30 mb-3" />
            <p className="text-sm font-semibold text-app-soft">No demo requests {filter !== "all" ? `marked ${label(filter)}` : "yet"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="stitch-table min-w-[900px]">
              <thead>
                <tr><th>Requested</th><th>Name</th><th>Company</th><th>Business</th><th>Team</th><th>Preferred</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id} className="cursor-pointer" onClick={() => setOpen(r)}>
                    <td className="text-xs text-app-soft whitespace-nowrap">{fmt(r.createdAt)}</td>
                    <td><p className="text-xs font-semibold text-app">{r.name}</p><p className="text-[10px] text-app-soft">{r.phone}</p></td>
                    <td><p className="text-xs font-semibold text-app">{r.company}</p><p className="text-[10px] text-app-soft">{r.city}</p></td>
                    <td className="text-xs text-app-soft">{r.businessType}</td>
                    <td className="text-xs text-app-soft">{r.teamSize}</td>
                    <td className="text-xs text-app-soft">{[fmtDay(r.preferredDate), r.preferredTime && r.preferredTime.split(" (")[0], r.format].filter(Boolean).join(" · ") || "-"}</td>
                    <td><span className="text-[11px] font-bold rounded-lg px-2 py-1 whitespace-nowrap" style={STATUS_STYLE[r.status]}>{label(r.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
