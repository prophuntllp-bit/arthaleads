import { useState, useEffect, useRef } from "react";
import { Building2, Plus, Pencil, Trash2, X, Check, Upload } from "lucide-react";
import { AppSelect } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";

const EMPTY = {
  name: "", address: "", pan: "", cin: "", gstNo: "",
  reraNumbers: [], defaultBrokeragePercent: 2,
  defaultFosIncentive: 0, defaultEoiIncentive: 0,
  invoiceTemplate: "detailed", logo: "",
};

function compressImage(dataUri, maxPx = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

function DevLogoUpload({ value, onChange }) {
  const inputRef    = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Only image files supported");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const compressed = await compressImage(ev.target.result);
        onChange(compressed);
      } finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-3">
      <div
        onClick={() => !busy && inputRef.current?.click()}
        className="w-16 h-12 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer shrink-0"
        style={{ background: "var(--app-surface-low)",
          border: value ? "2px solid var(--app-primary)" : "2px dashed var(--app-border)" }}
        title="Click to upload logo"
      >
        {busy ? (
          <span className="h-4 w-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        ) : value ? (
          <img src={value} alt="logo" className="max-w-full max-h-full object-contain p-1"
            onError={() => onChange("")} />
        ) : (
          <Upload className="h-4 w-4 text-app-soft" />
        )}
      </div>
      <div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="btn-secondary rounded-xl text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
          <Upload className="h-3 w-3" /> {value ? "Change Logo" : "Upload Logo"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")}
            className="mt-1 text-[11px] text-app-soft hover:text-red-500 transition flex items-center gap-1">
            <X className="h-3 w-3" /> Remove
          </button>
        )}
        <p className="text-[10px] text-app-soft mt-0.5">Optional · PNG, JPG or SVG</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function ReraInput({ value, onChange }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setInput("");
  };
  return (
    <div>
      <div className="flex gap-2 mb-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Add RERA number…"
          className="input flex-1 text-sm"
        />
        <button type="button" onClick={add}
          className="btn-primary px-3 rounded-xl text-sm">Add</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((r, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            {r}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-app-soft hover:text-red-500 cursor-pointer">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function DevModal({ dev, onClose, onSaved }) {
  const [form, setForm] = useState(dev ? { ...dev } : { ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Developer name is required.");
    setSaving(true);
    try {
      const { data } = dev
        ? await api.put(`/developers/${dev._id}`, form)
        : await api.post("/developers", form);
      toast.success(dev ? "Developer updated." : "Developer added.");
      onSaved(data.data);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--app-border)" }}>
          <h2 className="text-base font-bold text-app">{dev ? "Edit Developer" : "Add Developer"}</h2>
          <button onClick={onClose} className="text-app-soft hover:text-app cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Developer Logo <span className="font-normal opacity-60">(optional)</span></label>
              <DevLogoUpload value={form.logo} onChange={v => set("logo", v)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Developer / Builder Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="e.g. Regency Aawishkar Sarsan Developers LLP"
                className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Address</label>
              <textarea value={form.address} onChange={e => set("address", e.target.value)}
                rows={2} placeholder="Full address" className="input w-full text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">PAN</label>
                <input value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())}
                  placeholder="AAFCM3756K" className="input w-full text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">GST No.</label>
                <input value={form.gstNo} onChange={e => set("gstNo", e.target.value.toUpperCase())}
                  placeholder="27AAFCM3756K1Z3" className="input w-full text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">CIN</label>
              <input value={form.cin} onChange={e => set("cin", e.target.value.toUpperCase())}
                placeholder="U01210MH2007PTC174746" className="input w-full text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">RERA Numbers</label>
              <ReraInput value={form.reraNumbers} onChange={v => set("reraNumbers", v)} />
            </div>

            <div className="pt-1" style={{ borderTop: "1px solid var(--app-border)" }}>
              <p className="text-xs font-bold text-app mb-2">Default Brokerage Settings</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Brokerage %</label>
                  <input type="number" step="0.25" min="0" max="10"
                    value={form.defaultBrokeragePercent}
                    onChange={e => set("defaultBrokeragePercent", e.target.value)}
                    className="input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">FOS Incentive</label>
                  <input type="number" min="0" value={form.defaultFosIncentive}
                    onChange={e => set("defaultFosIncentive", e.target.value)}
                    className="input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">EOI Incentive</label>
                  <input type="number" min="0" value={form.defaultEoiIncentive}
                    onChange={e => set("defaultEoiIncentive", e.target.value)}
                    className="input w-full text-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Invoice Template</label>
              <AppSelect
                value={form.invoiceTemplate}
                onChange={v => set("invoiceTemplate", v)}
                options={[
                  { value: "detailed", label: "Detailed (with brokerage breakdown)" },
                  { value: "simple",   label: "Simple (flat amount)" },
                ]}
                triggerClassName="text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--app-border)" }}>
          <button onClick={onClose} className="btn-secondary flex-1 rounded-xl text-sm cursor-pointer">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="btn-primary flex-1 rounded-xl text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Check className="h-4 w-4" />}
            {dev ? "Save Changes" : "Add Developer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Developers() {
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "add" | devObject

  useEffect(() => {
    api.get("/developers").then(r => setDevs(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (dev) => {
    if (!confirm(`Remove ${dev.name}? This will not affect existing bookings or invoices.`)) return;
    try {
      await api.delete(`/developers/${dev._id}`);
      setDevs(d => d.filter(x => x._id !== dev._id));
      toast.success("Developer removed.");
    } catch { toast.error("Failed to remove."); }
  };

  const handleSaved = (saved) => {
    setDevs(d => {
      const idx = d.findIndex(x => x._id === saved._id);
      return idx >= 0 ? d.map((x, i) => i === idx ? saved : x) : [saved, ...d];
    });
    setModal(null);
  };

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-app flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: "var(--app-primary)" }} />
            Developers
          </h1>
          <p className="text-sm text-app-soft mt-0.5">Builder profiles used for brokerage invoices</p>
        </div>
        <button onClick={() => setModal("add")}
          className="btn-primary rounded-2xl px-4 py-2 text-sm flex items-center gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Add Developer
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--app-border)", borderTopColor: "var(--app-primary)" }} />
        </div>
      ) : devs.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-app-soft opacity-30" />
          <p className="text-app font-semibold mb-1">No developers added yet</p>
          <p className="text-sm text-app-soft mb-4">Add your first builder/developer to start creating invoices.</p>
          <button onClick={() => setModal("add")} className="btn-primary rounded-xl px-4 py-2 text-sm cursor-pointer">
            Add Developer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devs.map(dev => (
            <div key={dev._id} className="card rounded-2xl p-4"
              style={{ border: "1px solid var(--app-border)" }}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {dev.logo ? (
                    <img src={dev.logo} alt={dev.name}
                      className="w-10 h-8 rounded-lg object-contain shrink-0"
                      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", padding: 3 }}
                      onError={e => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="w-10 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                      <Building2 className="h-4 w-4 text-app-soft opacity-50" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-app text-sm leading-tight">{dev.name}</p>
                    {dev.address && <p className="text-xs text-app-soft mt-0.5 line-clamp-2">{dev.address}</p>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setModal(dev)}
                    className="p-1.5 rounded-xl text-app-soft hover:text-app hover:bg-black/5 transition cursor-pointer">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(dev)}
                    className="p-1.5 rounded-xl text-app-soft hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                {dev.pan && <span className="text-app-soft">PAN: <span className="text-app font-mono">{dev.pan}</span></span>}
                {dev.gstNo && <span className="text-app-soft">GST: <span className="text-app font-mono">{dev.gstNo}</span></span>}
                {dev.cin && <span className="text-app-soft col-span-2">CIN: <span className="text-app font-mono">{dev.cin}</span></span>}
                <span className="text-app-soft">Brokerage: <span className="text-app font-semibold">{dev.defaultBrokeragePercent}%</span></span>
                <span className="text-app-soft">Template: <span className="text-app capitalize">{dev.invoiceTemplate}</span></span>
              </div>

              {dev.reraNumbers?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {dev.reraNumbers.slice(0, 3).map((r, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded-lg"
                      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>{r}</span>
                  ))}
                  {dev.reraNumbers.length > 3 && (
                    <span className="text-[10px] text-app-soft px-2 py-0.5">+{dev.reraNumbers.length - 3} more</span>
                  )}
                </div>
              )}

              <div className="mt-2 pt-2 flex gap-2" style={{ borderTop: "1px solid var(--app-border)" }}>
                {dev.defaultFosIncentive > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                    FOS ₹{dev.defaultFosIncentive.toLocaleString("en-IN")}
                  </span>
                )}
                {dev.defaultEoiIncentive > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                    EOI ₹{dev.defaultEoiIncentive.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DevModal
          dev={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
