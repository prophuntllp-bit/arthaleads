import { useState, useEffect, useCallback, useRef } from "react";
import { BookMarked, Plus, FileText, X, Check, IndianRupee, Trash2, ExternalLink } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { AppSelect, AppDatePicker } from "../components/UI";
import { useNavigate } from "react-router-dom";

const UNIT_TYPES = ["Flat", "Plot", "Villa", "Shop", "Office", "Other"];
const STATUS_LABELS = { new: "New", invoiced: "Invoiced", payment_received: "Paid" };
const STATUS_COLORS = {
  new:              { bg: "rgba(99,102,241,0.1)",   color: "#6366f1" },
  invoiced:         { bg: "rgba(255,107,0,0.1)",    color: "#ff6b00" },
  payment_received: { bg: "rgba(16,185,129,0.1)",   color: "#10b981" },
};

function fmtINR(n) {
  if (!n && n !== 0) return "-";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function CalcPreview({ form }) {
  const cv   = Number(form.considerationValue) || 0;
  const pct  = Number(form.brokeragePercent)   || 0;
  const brok = form.manualBrokerage
    ? (Number(form.brokerageAmount) || 0)
    : Math.round(cv * pct / 100 * 100) / 100;
  const adj  = Number(form.brokerageAdjustment) || 0;
  const fos  = Number(form.fosIncentive)        || 0;
  const eoi  = Number(form.eoiIncentive)        || 0;
  const total = Math.round((brok - adj + fos + eoi) * 100) / 100;
  const gst  = form.gstType === "IGST";
  const tax  = Math.round(total * 0.18 * 100) / 100;
  const cgst = gst ? 0 : Math.round(total * 0.09 * 100) / 100;
  const sgst = cgst;
  const igst = gst ? tax : 0;
  const bill = Math.round((total + cgst + sgst + igst) * 100) / 100;

  return (
    <div className="rounded-xl p-3 space-y-1.5 text-xs"
      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
      <p className="font-bold text-app text-[11px] uppercase tracking-wide mb-2">Live Calculation</p>
      <Row label="Brokerage Amount" value={fmtINR(brok)} />
      {adj > 0    && <Row label="Adjustment (-)"  value={`-${fmtINR(adj)}`} />}
      {fos > 0    && <Row label="FOS Incentive"   value={fmtINR(fos)}  color="#6366f1" />}
      {eoi > 0    && <Row label="EOI Incentive"   value={fmtINR(eoi)}  color="#10b981" />}
      <Row label="Total Brokerage" value={fmtINR(total)} bold />
      {cgst > 0 && <Row label="CGST @9%"  value={fmtINR(cgst)} />}
      {sgst > 0 && <Row label="SGST @9%"  value={fmtINR(sgst)} />}
      {igst > 0 && <Row label="IGST @18%" value={fmtINR(igst)} />}
      <div className="pt-1.5 mt-1" style={{ borderTop: "1px solid var(--app-border)" }}>
        <Row label="Total Bill" value={fmtINR(bill)} bold bigger />
      </div>
    </div>
  );
}
function Row({ label, value, bold, bigger, color }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-app-soft ${bold ? "font-semibold text-app" : ""}`}>{label}</span>
      <span className={`font-${bold ? "bold" : "medium"} ${bigger ? "text-sm" : ""}`}
        style={{ color: color || (bold ? "var(--app-text)" : undefined) }}>{value}</span>
    </div>
  );
}

// Formats number with Indian commas while typing — shows raw digits when focused
function FormattedNumberInput({ value, onChange, placeholder, className, step }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const raw = value === "" || value === undefined ? "" : String(value);
  const display = focused || !raw
    ? raw
    : Number(raw).toLocaleString("en-IN");
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      step={step}
      value={display}
      onChange={e => {
        const stripped = e.target.value.replace(/[^0-9.]/g, "");
        onChange(stripped);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className={className}
    />
  );
}

const EMPTY_FORM = {
  customerName: "", jointBuyerName: "", projectName: "",
  phase: "", unitType: "Flat", unitNo: "", tower: "",
  bookingDate: new Date().toISOString().slice(0, 10),
  considerationValue: "", brokeragePercent: 2,
  manualBrokerage: false, brokerageAmount: "",
  brokerageAdjustment: 0, fosIncentive: 0, eoiIncentive: 0,
  gstType: "CGST_SGST", developerId: "", notes: "",
};

function BookingModal({ booking, developers, onClose, onSaved }) {
  const editing = !!booking;
  const [form, setForm] = useState(() => {
    if (booking) {
      return {
        ...EMPTY_FORM, ...booking,
        developerId: booking.developerId?._id || booking.developerId || "",
        bookingDate: booking.bookingDate ? new Date(booking.bookingDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        manualBrokerage: false,
      };
    }
    return { ...EMPTY_FORM };
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Pre-fill brokerage % when developer changes
  useEffect(() => {
    if (!editing && form.developerId) {
      const dev = developers.find(d => d._id === form.developerId);
      if (dev) {
        setForm(f => ({
          ...f,
          brokeragePercent: dev.defaultBrokeragePercent,
          fosIncentive:     dev.defaultFosIncentive,
          eoiIncentive:     dev.defaultEoiIncentive,
        }));
      }
    }
  }, [form.developerId, developers, editing]);

  const submit = async () => {
    if (!form.customerName.trim()) return toast.error("Customer name is required.");
    if (!form.projectName.trim())  return toast.error("Project name is required.");
    if (!form.unitNo.trim())       return toast.error("Unit / Plot number is required.");
    if (!form.developerId)         return toast.error("Please select a developer.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        brokerageAmount: form.manualBrokerage ? form.brokerageAmount : undefined,
      };
      const { data } = editing
        ? await api.put(`/bookings/${booking._id}`, payload)
        : await api.post("/bookings", payload);
      toast.success(editing ? "Booking updated." : "Booking created.");
      onSaved(data.data);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <h2 className="text-base font-bold text-app">{editing ? "Edit Booking" : "New Booking"}</h2>
          <button onClick={onClose} className="text-app-soft hover:text-app cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "75vh" }}>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* LEFT COLUMN */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-app-soft uppercase tracking-wide">Customer Details</p>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Customer Name *</label>
                <input value={form.customerName} onChange={e => set("customerName", e.target.value)}
                  placeholder="Anand Y Patil" className="input w-full text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Joint Buyer (optional)</label>
                <input value={form.jointBuyerName} onChange={e => set("jointBuyerName", e.target.value)}
                  placeholder="Kavish Shaikh" className="input w-full text-sm" />
              </div>

              <p className="text-xs font-bold text-app-soft uppercase tracking-wide pt-1">Unit Details</p>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Developer *</label>
                <AppSelect
                  value={form.developerId}
                  onChange={v => set("developerId", v)}
                  placeholder="-- Select developer --"
                  options={developers.map(d => ({ value: d._id, label: d.name }))}
                  triggerStyle={{ padding: "11px 16px", borderRadius: "1rem", fontSize: 14 }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Project Name *</label>
                <input value={form.projectName} onChange={e => set("projectName", e.target.value)}
                  placeholder="Regency Astra / Treetopia" className="input w-full text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Phase</label>
                  <input value={form.phase} onChange={e => set("phase", e.target.value)}
                    placeholder="1" className="input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Unit Type</label>
                  <AppSelect
                    value={form.unitType}
                    onChange={v => set("unitType", v)}
                    options={UNIT_TYPES}
                    triggerClassName="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Unit / Plot No. *</label>
                  <input value={form.unitNo} onChange={e => set("unitNo", e.target.value)}
                    placeholder="305 / 232" className="input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Tower / Block</label>
                  <input value={form.tower} onChange={e => set("tower", e.target.value)}
                    placeholder="B1" className="input w-full text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Booking Date</label>
                <AppDatePicker value={form.bookingDate} onChange={v => set("bookingDate", v)} triggerStyle={{ padding: "11px 16px", borderRadius: "1rem", fontSize: 14 }} />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-app-soft uppercase tracking-wide">Brokerage Details</p>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Consideration Value (₹)</label>
                <FormattedNumberInput value={form.considerationValue}
                  onChange={v => set("considerationValue", v)}
                  placeholder="72,36,350" className="input w-full text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block flex items-center justify-between">
                  <span>Brokerage %</span>
                  <label className="flex items-center gap-1.5 font-normal cursor-pointer">
                    <input type="checkbox" checked={form.manualBrokerage}
                      onChange={e => set("manualBrokerage", e.target.checked)} className="cursor-pointer" />
                    <span className="text-[10px]">Enter amount directly</span>
                  </label>
                </label>
                {form.manualBrokerage ? (
                  <FormattedNumberInput value={form.brokerageAmount}
                    onChange={v => set("brokerageAmount", v)}
                    placeholder="1,73,100" className="input w-full text-sm" />
                ) : (
                  <input type="number" step="0.25" min="0" max="20" value={form.brokeragePercent}
                    onChange={e => set("brokeragePercent", e.target.value)}
                    className="input w-full text-sm" />
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Brokerage Adjustment (-)</label>
                <FormattedNumberInput value={form.brokerageAdjustment}
                  onChange={v => set("brokerageAdjustment", v)}
                  placeholder="0" className="input w-full text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">FOS Incentive (₹)</label>
                  <FormattedNumberInput value={form.fosIncentive}
                    onChange={v => set("fosIncentive", v)}
                    placeholder="25,000" className="input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">EOI Incentive (₹)</label>
                  <FormattedNumberInput value={form.eoiIncentive}
                    onChange={v => set("eoiIncentive", v)}
                    placeholder="30,000" className="input w-full text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">GST Type</label>
                <div className="flex gap-2">
                  {["CGST_SGST", "IGST"].map(t => (
                    <button key={t} type="button"
                      onClick={() => set("gstType", t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition ${form.gstType === t ? "text-white" : "text-app-soft"}`}
                      style={form.gstType === t
                        ? { background: "var(--app-primary)", borderColor: "var(--app-primary)" }
                        : { background: "var(--app-surface-low)", borderColor: "var(--app-border)" }}>
                      {t === "CGST_SGST" ? "CGST + SGST" : "IGST (Interstate)"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Notes (internal)</label>
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                  rows={2} className="input w-full text-sm resize-none" placeholder="Any internal remarks…" />
              </div>
              <CalcPreview form={form} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--app-border)" }}>
          <button onClick={onClose} className="btn-secondary flex-1 rounded-xl text-sm cursor-pointer">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="btn-primary flex-1 rounded-xl text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Check className="h-4 w-4" />}
            {editing ? "Save Changes" : "Create Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [filter, setFilter]     = useState("all");
  const [genLoading, setGenLoading] = useState(null);

  const load = useCallback(async () => {
    try {
      const [bRes, dRes] = await Promise.all([
        api.get("/bookings"),
        api.get("/developers"),
      ]);
      setBookings(bRes.data.data);
      setDevelopers(dRes.data.data);
    } catch { toast.error("Failed to load bookings."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateInvoice = async (booking) => {
    setGenLoading(booking._id);
    try {
      const { data } = await api.post("/invoices", { bookingId: booking._id });
      toast.success(`Invoice #${data.data.invoiceNumber} created!`);
      setBookings(b => b.map(x => x._id === booking._id ? { ...x, status: "invoiced", invoiceId: data.data._id } : x));
      navigate("/invoices");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to generate invoice.");
    } finally { setGenLoading(null); }
  };

  const handleDelete = async (b) => {
    const msg = b.invoiceId
      ? "Delete this booking and its linked invoice? This cannot be undone."
      : "Delete this booking? This cannot be undone.";
    if (!confirm(msg)) return;
    try {
      await api.delete(`/bookings/${b._id}`);
      setBookings(x => x.filter(b2 => b2._id !== b._id));
      toast.success("Booking deleted.");
    } catch (e) { toast.error(e.response?.data?.message || "Cannot delete."); }
  };

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  // Stats
  const totalBill    = bookings.reduce((s, b) => s + (b.totalBill || 0), 0);
  const countPending = bookings.filter(b => b.status === "new").length;
  const countPaid    = bookings.filter(b => b.status === "payment_received").length;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-app flex items-center gap-2">
            <BookMarked className="h-5 w-5" style={{ color: "var(--app-primary)" }} />
            Bookings
          </h1>
          <p className="text-sm text-app-soft mt-0.5">Track every closed deal and generate brokerage invoices</p>
        </div>
        <button onClick={() => setModal("new")}
          className="btn-primary rounded-2xl px-4 py-2 text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0">
          <Plus className="h-4 w-4" /> New Booking
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Bookings",  value: bookings.length,   color: "#6366f1" },
          { label: "Total Brokerage", value: "₹" + (totalBill / 1e5).toFixed(1) + "L", color: "#ff6b00" },
          { label: "Invoice Pending", value: countPending,      color: "#f59e0b" },
          { label: "Payment Received",value: countPaid,         color: "#10b981" },
        ].map(s => (
          <div key={s.label} className="card rounded-2xl p-4"
            style={{ border: "1px solid var(--app-border)" }}>
            <p className="text-xs text-app-soft">{s.label}</p>
            <p className="text-xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[["all", "All"], ["new", "New"], ["invoiced", "Invoiced"], ["payment_received", "Paid"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition"
            style={filter === k
              ? { background: "var(--app-primary)", color: "#fff" }
              : { background: "var(--app-surface-low)", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--app-border)", borderTopColor: "var(--app-primary)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookMarked className="h-12 w-12 mx-auto mb-3 text-app-soft opacity-30" />
          <p className="text-app font-semibold mb-1">No bookings yet</p>
          <p className="text-sm text-app-soft mb-4">Create a booking when a lead is Closed Won and a deal is finalised.</p>
          <button onClick={() => setModal("new")} className="btn-primary rounded-xl px-4 py-2 text-sm cursor-pointer">
            New Booking
          </button>
        </div>
      ) : (
        <div className="card rounded-2xl overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
                  {["Customer", "Developer", "Project / Unit", "Booking Date", "Total Bill", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-app-soft">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b._id} style={{ borderBottom: "1px solid var(--app-border)" }}
                    className="hover:bg-black/2 dark:hover:bg-white/2 transition">
                    <td className="px-4 py-3">
                      <p
                        className="font-semibold text-sm cursor-pointer hover:text-orange-500 transition-colors"
                        style={{ color: "var(--app-text)" }}
                        onClick={() => setModal(b)}
                      >{b.customerName}</p>
                      {b.jointBuyerName && <p className="text-xs text-app-soft">{b.jointBuyerName}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-app-soft">{b.developerId?.name || "-"}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-app">{b.projectName}</p>
                      <p className="text-xs text-app-soft">
                        {b.unitType} {b.unitNo}{b.tower ? ` • ${b.tower}` : ""}{b.phase ? ` • Ph.${b.phase}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-app-soft">{fmtDate(b.bookingDate)}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-app">{fmtINR(b.totalBill)}</p>
                      <p className="text-[10px] text-app-soft">Brok: {fmtINR(b.totalBrokerage)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold"
                        style={STATUS_COLORS[b.status] || STATUS_COLORS.new}>
                        {STATUS_LABELS[b.status] || b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {b.status === "new" && (
                          <button
                            onClick={() => generateInvoice(b)}
                            disabled={genLoading === b._id}
                            title="Generate Invoice"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer disabled:opacity-50 transition"
                            style={{ background: "rgba(255,107,0,0.1)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.25)" }}>
                            {genLoading === b._id
                              ? <span className="h-3 w-3 rounded-full border border-orange-500 border-t-transparent animate-spin" />
                              : <FileText className="h-3 w-3" />}
                            Invoice
                          </button>
                        )}
                        {b.invoiceId && (
                          <button
                            onClick={() => navigate("/invoices")}
                            title="View Invoice"
                            className="p-1.5 rounded-xl text-app-soft hover:text-app cursor-pointer transition">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(b)} title="Delete booking"
                          className="p-1.5 rounded-xl text-app-soft hover:text-red-500 cursor-pointer transition">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <BookingModal
          booking={modal === "new" ? null : modal}
          developers={developers}
          onClose={() => setModal(null)}
          onSaved={saved => {
            setBookings(b => {
              const idx = b.findIndex(x => x._id === saved._id);
              return idx >= 0 ? b.map((x, i) => i === idx ? saved : x) : [saved, ...b];
            });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
