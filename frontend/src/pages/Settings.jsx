import { useEffect, useMemo, useState, useRef } from "react";
import toast from "react-hot-toast";
import { Camera, Eye, EyeOff, ImagePlus, KeyRound, ShieldCheck, UserRound, Shuffle,
         Building2, FileText, AlertCircle, CheckCircle2, Upload, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import CustomSelect from "../components/CustomSelect";

// ── Indian Banks list ─────────────────────────────────────────────────────────
const INDIAN_BANKS = [
  "Axis Bank","AU Small Finance Bank","Bandhan Bank","Bank of Baroda","Bank of India",
  "Bank of Maharashtra","Canara Bank","Central Bank of India","City Union Bank",
  "CSB Bank","DCB Bank","Dhanlaxmi Bank","Equitas Small Finance Bank",
  "ESAF Small Finance Bank","Federal Bank","Fincare Small Finance Bank",
  "HDFC Bank","ICICI Bank","IDBI Bank","IDFC First Bank","Indian Bank",
  "Indian Overseas Bank","IndusInd Bank","J&K Bank","Jana Small Finance Bank",
  "Karnataka Bank","Karur Vysya Bank","Kotak Mahindra Bank","Lakshmi Vilas Bank",
  "Nainital Bank","North East Small Finance Bank","Punjab & Sind Bank",
  "Punjab National Bank","RBL Bank","Saraswat Bank","South Indian Bank",
  "State Bank of India","Suryoday Small Finance Bank","Tamilnad Mercantile Bank",
  "UCO Bank","Ujjivan Small Finance Bank","Union Bank of India","Utkarsh Small Finance Bank",
  "YES Bank",
];

// Searchable bank dropdown
function BankSearchInput({ value, onChange, className }) {
  const [query, setQuery]   = useState(value || "");
  const [open, setOpen]     = useState(false);
  const wrapRef             = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  const matches = query.trim()
    ? INDIAN_BANKS.filter(b => b.toLowerCase().includes(query.toLowerCase()))
    : [];

  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => query && setOpen(true)}
        placeholder="e.g. State Bank of India"
        className={className}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-2xl shadow-xl overflow-hidden overflow-y-auto"
          style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", maxHeight: 220 }}>
          {matches.map(bank => (
            <button
              key={bank}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(bank); setQuery(bank); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition text-app"
            >
              {bank}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Compress image to JPEG ≤ 400×400 before upload
function compressImage(dataUri, maxPx = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

// Logo upload widget used inside OrgBillingSection
function OrgLogoUpload({ logo, onUpdated }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(logo || "");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setPreview(logo || ""); }, [logo]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Only image files supported");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const compressed = await compressImage(ev.target.result);
        setPreview(compressed);
        const { data } = await api.patch("/org/me/logo", { logo: compressed });
        onUpdated(data.org);
        toast.success("Logo updated.");
      } catch (err) {
        toast.error(err.response?.data?.message || "Upload failed.");
        setPreview(logo || "");
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async () => {
    if (!confirm("Remove organisation logo?")) return;
    setUploading(true);
    try {
      const { data } = await api.patch("/org/me/logo", { logo: "" });
      setPreview("");
      onUpdated(data.org);
      toast.success("Logo removed.");
    } catch { toast.error("Failed to remove logo."); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Preview */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="w-20 h-16 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer transition border-2"
        style={{ background: "var(--app-surface-low)",
          borderColor: preview ? "var(--app-primary)" : "var(--app-border)",
          borderStyle: preview ? "solid" : "dashed" }}
        title="Click to upload logo"
      >
        {uploading ? (
          <span className="h-5 w-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        ) : preview ? (
          <img src={preview} alt="org logo" className="max-w-full max-h-full object-contain p-1"
            onError={() => setPreview("")} />
        ) : (
          <Upload className="h-5 w-5 text-app-soft" />
        )}
      </div>

      <div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="btn-secondary rounded-xl text-xs px-3 py-2 flex items-center gap-1.5 disabled:opacity-50">
          <Upload className="h-3.5 w-3.5" /> {preview ? "Change Logo" : "Upload Logo"}
        </button>
        {preview && (
          <button type="button" onClick={handleRemove} disabled={uploading}
            className="mt-1 text-[11px] text-app-soft hover:text-red-500 transition flex items-center gap-1">
            <X className="h-3 w-3" /> Remove
          </button>
        )}
        <p className="text-[10px] text-app-soft mt-1">PNG, JPG or SVG · appears on invoice letterhead</p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Organisation Billing Section ─────────────────────────────────────────────
const BILLING_REQUIRED = ["address", "gstNo", "pan", "bankAccountName", "bankAccountNo", "bankIfsc"];
const BILLING_FIELDS = [
  { section: "Organisation Identity", fields: [
    { key: "address",   label: "Registered Address", placeholder: "e.g. Plot No. 12, Sector 5, Mumbai 400001", col: 2 },
    { key: "phone",     label: "Contact Number",      placeholder: "e.g. 9800000000" },
    { key: "email",     label: "Official Email",      placeholder: "e.g. accounts@yourcompany.com" },
  ]},
  { section: "Tax & Compliance", fields: [
    { key: "gstNo", label: "GST Number",    placeholder: "e.g. 27XXXXX0000X1ZX", mono: true },
    { key: "pan",   label: "PAN Number",    placeholder: "e.g. XXXXX0000X",      mono: true },
    { key: "cin",   label: "CIN",           placeholder: "e.g. U70200MH2020OPC000000", mono: true },
    { key: "rera",  label: "RERA Reg. No.", placeholder: "e.g. A51800000000",    mono: true },
  ]},
  { section: "Bank Details (for invoice payment section)", fields: [
    { key: "bankAccountName", label: "Account Name",     placeholder: "e.g. Your Company Name" },
    { key: "bankAccountNo",   label: "Account Number",   placeholder: "e.g. 000000000000", mono: true },
    { key: "bankIfsc",        label: "IFSC Code",        placeholder: "e.g. SBIN0000000",  mono: true },
    { key: "bankName",        label: "Bank Name",        placeholder: "e.g. State Bank of India", bankSearch: true },
    { key: "bankBranch",      label: "Branch / Address", placeholder: "e.g. MG Road Branch, Mumbai", col: 2 },
  ]},
];

function OrgBillingSection({ org, updateOrg }) {
  const [form, setForm] = useState({
    address: "", phone: "", email: "", gstNo: "", pan: "", cin: "", rera: "",
    bankAccountName: "", bankAccountNo: "", bankIfsc: "", bankName: "", bankBranch: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org) {
      setForm({
        address:         org.address         || "",
        phone:           org.phone           || "",
        email:           org.email           || "",
        gstNo:           org.gstNo           || "",
        pan:             org.pan             || "",
        cin:             org.cin             || "",
        rera:            org.rera            || "",
        bankAccountName: org.bankAccountName || "",
        bankAccountNo:   org.bankAccountNo   || "",
        bankIfsc:        org.bankIfsc        || "",
        bankName:        org.bankName        || "",
        bankBranch:      org.bankBranch      || "",
      });
    }
  }, [org]);

  const filledCount  = BILLING_REQUIRED.filter(k => form[k]?.trim()).length;
  const isComplete   = filledCount === BILLING_REQUIRED.length;
  const completePct  = Math.round((filledCount / BILLING_REQUIRED.length) * 100);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch("/org/me/billing", form);
      updateOrg(data.org);
      toast.success("Billing details saved.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <section className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
          <Building2 className="h-5 w-5" style={{ color: "var(--app-primary)" }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-app">Organisation &amp; Billing Details</p>
            {isComplete
              ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </span>
              : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                  <AlertCircle className="h-3 w-3" /> {filledCount}/{BILLING_REQUIRED.length} required fields
                </span>
            }
          </div>
          <p className="text-sm text-app-soft mt-0.5">
            These details appear on every brokerage invoice sent to developers. Required fields must be filled to generate invoices.
          </p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)", maxWidth: 280 }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completePct}%`, background: isComplete ? "#10b981" : "var(--app-primary)" }} />
          </div>
        </div>
      </div>

      {/* Required fields banner */}
      {!isComplete && (
        <div className="rounded-2xl px-4 py-3 flex items-start gap-3 text-sm"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
          <p style={{ color: "#92400e" }} className="dark:text-yellow-300">
            <strong>Required to generate invoices:</strong> Address, GST Number, PAN, and all Bank Details must be filled.
          </p>
        </div>
      )}

      {/* Logo upload */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-app-soft uppercase tracking-wider">Organisation Logo</span>
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
        </div>
        <OrgLogoUpload logo={org?.logo} onUpdated={updateOrg} />
      </div>

      {/* Field sections */}
      {BILLING_FIELDS.map(({ section, fields }) => (
        <div key={section}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-app-soft uppercase tracking-wider">{section}</span>
            <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(({ key, label, placeholder, mono, col, bankSearch }) => (
              <div key={key} className={col === 2 ? "sm:col-span-2" : ""}>
                <label className="text-xs font-semibold text-app-soft mb-1 flex items-center gap-1 block">
                  {label}
                  {BILLING_REQUIRED.includes(key) && (
                    <span style={{ color: "#ef4444" }}>*</span>
                  )}
                </label>
                {bankSearch ? (
                  <BankSearchInput
                    value={form[key]}
                    onChange={v => set(key, v)}
                    className={`input w-full text-sm${BILLING_REQUIRED.includes(key) && !form[key]?.trim() ? " border-yellow-400/60" : ""}`}
                  />
                ) : (
                  <input
                    value={form[key]}
                    onChange={e => set(key, ["gstNo","pan","cin","bankIfsc"].includes(key)
                      ? e.target.value.toUpperCase()
                      : e.target.value)}
                    placeholder={placeholder}
                    className={`input w-full text-sm ${mono ? "font-mono" : ""}`}
                    style={BILLING_REQUIRED.includes(key) && !form[key]?.trim()
                      ? { borderColor: "rgba(245,158,11,0.6)" }
                      : {}}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-1">
        <button onClick={save} disabled={saving}
          className="btn-primary rounded-xl px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
          {saving
            ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            : <FileText className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Billing Details"}
        </button>
      </div>
    </section>
  );
}

export default function Settings() {
  useEffect(() => { document.title = "Settings - Arthaleads CRM"; }, []);
  const { user, org, updateOrg, updateUserState, refreshUser } = useAuth();
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd]         = useState(false);
  const [autoAssign, setAutoAssign]         = useState(org?.autoAssign ?? true);
  const [togglingAA, setTogglingAA]         = useState(false);

  // Sync toggle state whenever org data loads/changes (e.g. after auth/me refresh)
  useEffect(() => {
    if (org && typeof org.autoAssign === "boolean") {
      setAutoAssign(org.autoAssign);
    }
  }, [org?.autoAssign]);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    avatar: "",
    role: "agent",
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      avatar: user?.avatar || "",
      role: user?.role || "agent",
      currentPassword: "",
      newPassword: "",
    });
  }, [user]);

  const profilePreview = useMemo(() => form.avatar || user?.avatar || "", [form.avatar, user?.avatar]);

  const setValue = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please choose an image under 2 MB");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, avatar: reader.result }));
      toast.success("Profile image ready to save");
    };
    reader.onerror = () => toast.error("Could not read that image");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleAutoAssignToggle = async () => {
    const next = !autoAssign;
    setTogglingAA(true);
    try {
      await api.patch("/org/me/auto-assign", { autoAssign: next });
      setAutoAssign(next);
      updateOrg({ ...org, autoAssign: next });
      toast.success(`Auto-assignment ${next ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update setting");
    } finally {
      setTogglingAA(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        avatar: form.avatar,
        role: form.role,
      };

      if (form.newPassword) {
        const pwdOk = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+{};:,<.>?/\\|[\]~`])/.test(form.newPassword);
        if (form.newPassword.length < 8 || !pwdOk) {
          toast.error("New password must be 8+ characters with 1 uppercase, 1 number, and 1 special character");
          setSaving(false);
          return;
        }
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const { data } = await api.put("/auth/me", payload);
      updateUserState(data.user);
      await refreshUser();
      setForm((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      toast.success("Settings updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <p className="stitch-kicker mb-2">Profile Control</p>
        <h1 className="text-3xl font-black tracking-tight text-app">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-app-soft">
          Update your profile, refresh your password, and manage the permissions tied to your CRM identity.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1.5fr]">
        <section className="card p-6 space-y-5">
          <div className="flex items-center gap-4">
            {profilePreview ? (
              <img src={profilePreview} alt={form.name} className="h-20 w-20 rounded-[1.5rem] object-cover border" style={{ borderColor: "var(--app-border)" }} />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-orange-500/10 text-2xl font-bold text-orange-500">
                {form.name?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-app">{form.name || user?.name}</p>
              <p className="text-sm text-app-soft">{user?.email}</p>
              <span className="badge mt-3 bg-orange-500/10 text-orange-400 capitalize">{form.role}</span>
            </div>
          </div>

          <div className="rounded-[1.25rem] p-4 stitch-surface-muted space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-app"><ShieldCheck className="h-4 w-4 text-orange-500" /> Role Access</div>
            <p className="text-sm text-app-soft">This role controls what you can see across team, analytics, and lead assignment workflows.</p>
            <div>
              <label className="label">Role</label>
              <CustomSelect
                value={form.role}
                onChange={(v) => setValue("role")({ target: { value: v } })}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "manager", label: "Manager" },
                  { value: "agent", label: "Sales Agent" },
                ]}
                style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
              />
            </div>
          </div>
        </section>

        <section className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={form.name} onChange={setValue("name")} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={setValue("phone")} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Email</label>
                <input className="input text-app-soft" style={{ background: "var(--app-surface-low)" }} value={user?.email || ""} disabled />
              </div>
              <div className="md:col-span-2">
                <label className="label flex items-center gap-2"><Camera className="h-4 w-4 text-orange-500" /> Profile Picture URL</label>
                <input className="input" value={form.avatar} onChange={setValue("avatar")} placeholder="https://example.com/avatar.jpg" />
              </div>
              <div className="md:col-span-2">
                <label className="label flex items-center gap-2"><ImagePlus className="h-4 w-4 text-orange-500" /> Or Upload Profile Picture</label>
                <label className="btn-secondary inline-flex cursor-pointer rounded-xl">
                  <ImagePlus className="h-4 w-4" /> Choose Image
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
                </label>
                <p className="mt-2 text-xs text-app-soft">PNG, JPG, WEBP, or GIF up to 2 MB. The image is stored directly in your CRM profile.</p>
              </div>
            </div>

            <div className="rounded-[1.25rem] p-5 stitch-surface-muted space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-app"><KeyRound className="h-4 w-4 text-orange-500" /> Change Password</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Current Password</label>
                  <div className="relative">
                    <input className="input pr-10" type={showCurrentPwd ? "text" : "password"} value={form.currentPassword} onChange={setValue("currentPassword")} placeholder="Required to set a new password" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app" onClick={() => setShowCurrentPwd((v) => !v)}>
                      {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input className="input pr-10" type={showNewPwd ? "text" : "password"} value={form.newPassword} onChange={setValue("newPassword")} placeholder="8+ chars, uppercase, number, special" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app" onClick={() => setShowNewPwd((v) => !v)}>
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] p-5 stitch-surface-muted space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-app"><UserRound className="h-4 w-4 text-orange-500" /> Permission Notes</div>
              <p className="text-sm text-app-soft">Admins can change roles directly. Managers and agents can click the role field, but the backend will still protect restricted updates.</p>
            </div>

            <div className="flex justify-end">
              <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </section>
      </div>

      {/* Organisation & Billing Details - admin only */}
      {user?.role === "admin" && (
        <OrgBillingSection org={org} updateOrg={updateOrg} />
      )}

      {/* Auto-assign toggle - admin + super_admin */}
      {(user?.role === "admin" || user?.role === "super_admin") && (
        <section className="card p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
                <Shuffle className="h-5 w-5" style={{ color: "var(--app-primary)" }} />
              </div>
              <div>
                <p className="font-semibold text-app">Auto Lead Assignment</p>
                <p className="text-sm text-app-soft mt-1 max-w-lg">
                  When enabled, new leads (manual, imported, or from Facebook/website) are automatically
                  assigned to agents in round-robin rotation - always to the agent with the fewest leads.
                  Turn off if you prefer to assign all leads manually.
                </p>
                <p className="text-xs mt-2 font-medium" style={{ color: autoAssign ? "var(--app-primary)" : "var(--app-text-soft)" }}>
                  {autoAssign ? "✅ Currently enabled - leads auto-assign on creation" : "⏸ Currently disabled - leads are unassigned until manually set"}
                </p>
              </div>
            </div>
            {/* Toggle switch */}
            <button
              onClick={handleAutoAssignToggle}
              disabled={togglingAA}
              className="shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50"
              style={{ background: autoAssign ? "var(--app-primary)" : "var(--app-border-strong)" }}
              title={autoAssign ? "Disable auto-assignment" : "Enable auto-assignment"}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200"
                style={{ transform: autoAssign ? "translateX(22px)" : "translateX(4px)" }}
              />
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
