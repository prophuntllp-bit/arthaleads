// components/OnboardingGate.jsx
// First-run blocking onboarding wizard. Rendered on top of the app shell when a
// freshly-signed-up org owner hasn't completed setup, or when any team member is
// missing their personal mobile number. Cannot be dismissed until completed.
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { Spinner, AppSelect } from "./UI";
import { Building2, IdCard, UserRound, Check, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

const INDUSTRIES = [
  "Real Estate", "Construction", "Property Management",
  "Mortgage / Finance", "Interior Design", "Other",
];
const COMPANY_SIZES = ["1-5", "6-20", "21-50", "51-200", "200+"];

// Make the AppSelect trigger match the height/shape of the `.input` fields
// (.input = px-4 py-3 text-sm rounded-2xl) so selects line up with text inputs.
const SELECT_TRIGGER_STYLE = { padding: "12px 16px", fontSize: 14, borderRadius: 16 };

// Light client-side validators (server re-validates the required ones)
const phoneOk = (v) => v.replace(/\D/g, "").length >= 10;

export default function OnboardingGate() {
  const { user, org, updateOrg, updateUserState } = useAuth();

  // Non-admins only need their personal mobile — they didn't create the org.
  const profileOnly = user?.role !== "admin";

  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const [form, setForm] = useState({
    // Business
    name:        org?.name && !/'s Workspace$/.test(org.name) ? org.name : "",
    industry:    org?.industry || "Real Estate",
    companySize: org?.companySize || "",
    phone:       org?.phone || "",
    email:       org?.email || user?.email || "",
    city:        org?.city || "",
    address:     org?.address || "",
    // Compliance (optional)
    gstNo:       org?.gstNo || "",
    pan:         org?.pan || "",
    rera:        org?.rera || "",
    // Personal
    fullName:     user?.name || "",
    personalPhone: user?.phone || "",
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
    setError("");
  };

  // ── Step definitions ──────────────────────────────────────────────────────
  const STEPS = profileOnly
    ? [{ key: "profile", title: "Complete your profile", icon: UserRound }]
    : [
        { key: "business",   title: "About your business",   icon: Building2 },
        { key: "compliance", title: "Tax & compliance",      icon: IdCard },
        { key: "profile",    title: "Your details",          icon: UserRound },
      ];

  const isLast  = step === STEPS.length - 1;
  const current = STEPS[step];

  // ── Per-step validation before advancing ──────────────────────────────────
  const validateStep = () => {
    if (current.key === "business") {
      if (form.name.trim().length < 2)    return "Please enter your organisation name.";
      if (form.address.trim().length < 4) return "Please enter your business address.";
      if (!phoneOk(form.phone))           return "Please enter a valid business phone number.";
    }
    if (current.key === "profile") {
      if (form.fullName.trim().length < 2)   return "Please enter your full name.";
      if (!phoneOk(form.personalPhone))      return "Please enter a valid 10-digit mobile number.";
    }
    return "";
  };

  const next = () => {
    const msg = validateStep();
    if (msg) { setError(msg); return; }
    setStep((s) => s + 1);
  };
  const back = () => { setError(""); setStep((s) => Math.max(0, s - 1)); };

  const finish = async () => {
    const msg = validateStep();
    if (msg) { setError(msg); return; }
    setError("");
    setSaving(true);
    try {
      if (profileOnly) {
        // Team member — just save their personal mobile + name on their profile.
        const { data } = await api.put("/auth/me", {
          name: form.fullName.trim(),
          phone: form.personalPhone.trim(),
        });
        updateUserState(data.user || { ...user, name: form.fullName.trim(), phone: form.personalPhone.trim() });
      } else {
        const { data } = await api.post("/org/me/onboarding", {
          name:        form.name.trim(),
          industry:    form.industry,
          companySize: form.companySize,
          phone:       form.phone.trim(),
          email:       form.email.trim(),
          city:        form.city.trim(),
          address:     form.address.trim(),
          gstNo:       form.gstNo.trim(),
          pan:         form.pan.trim(),
          rera:        form.rera.trim(),
          fullName:      form.fullName.trim(),
          personalPhone: form.personalPhone.trim(),
        });
        if (data.org)  updateOrg(data.org);
        if (data.user) updateUserState(data.user);
      }
      toast.success("All set! Welcome to Arthaleads 🎉");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your details. Please try again.");
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(8,8,14,0.82)", backdropFilter: "blur(10px)" }}>
      <div className="my-auto w-full max-w-xl rounded-3xl shadow-2xl"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>

        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b" style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
              <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-base font-black tracking-tight leading-none">
                <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
              </p>
              <p className="text-[11px] text-app-soft mt-1">
                {profileOnly ? "Finish setting up your account" : "Let's set up your workspace"}
              </p>
            </div>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition"
                      style={{
                        background: active ? "var(--app-primary)" : done ? "rgba(34,197,94,0.15)" : "var(--app-surface-low)",
                        color: active ? "#fff" : done ? "#22c55e" : "var(--app-soft)",
                        border: active ? "none" : "1px solid var(--app-border)",
                      }}>
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    {!profileOnly && (
                      <span className={`text-xs font-semibold truncate hidden sm:block ${active ? "text-app" : "text-app-soft"}`}>
                        {s.title}
                      </span>
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="h-px flex-1" style={{ background: done ? "#22c55e" : "var(--app-border)" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-app">{current.title}</h2>
            <p className="mt-1 text-sm text-app-soft">
              {current.key === "business"   && "Tell us about your company so we can tailor your CRM."}
              {current.key === "compliance" && "Used on your invoices and letterheads. You can skip and add these later in Settings."}
              {current.key === "profile"    && "We use your mobile number for important account and lead alerts."}
            </p>
          </div>

          {/* Business step */}
          {current.key === "business" && (
            <div className="space-y-4">
              <div>
                <label className="label">Organisation Name <span className="text-orange-500">*</span></label>
                <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Skyline Realty Pvt Ltd" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Industry</label>
                  <AppSelect value={form.industry} onChange={set("industry")} options={INDUSTRIES}
                    triggerStyle={SELECT_TRIGGER_STYLE} />
                </div>
                <div>
                  <label className="label">Team Size</label>
                  <AppSelect value={form.companySize} onChange={set("companySize")}
                    placeholder="Select…" options={COMPANY_SIZES} triggerStyle={SELECT_TRIGGER_STYLE} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Business Phone <span className="text-orange-500">*</span></label>
                  <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="Office contact number" />
                </div>
                <div>
                  <label className="label">Business Email</label>
                  <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="info@company.com" />
                </div>
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={form.city} onChange={set("city")} placeholder="e.g. Mumbai" />
              </div>
              <div>
                <label className="label">Business Address <span className="text-orange-500">*</span></label>
                <textarea className="input min-h-[72px] resize-none" value={form.address} onChange={set("address")}
                  placeholder="Office address — shown on invoices" />
              </div>
            </div>
          )}

          {/* Compliance step */}
          {current.key === "compliance" && (
            <div className="space-y-4">
              <div>
                <label className="label">GST Number</label>
                <input className="input uppercase" value={form.gstNo} onChange={set("gstNo")} placeholder="22AAAAA0000A1Z5" maxLength={15} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">PAN</label>
                  <input className="input uppercase" value={form.pan} onChange={set("pan")} placeholder="ABCDE1234F" maxLength={10} />
                </div>
                <div>
                  <label className="label">RERA Registration</label>
                  <input className="input" value={form.rera} onChange={set("rera")} placeholder="RERA ID (optional)" />
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl px-4 py-3 stitch-surface-muted">
                <ShieldCheck className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <p className="text-xs text-app-soft">These are optional and only used on billing documents. You can add or edit them anytime in Settings.</p>
              </div>
            </div>
          )}

          {/* Profile step */}
          {current.key === "profile" && (
            <div className="space-y-4">
              <div>
                <label className="label">Your Full Name <span className="text-orange-500">*</span></label>
                <input className="input" value={form.fullName} onChange={set("fullName")} placeholder="Enter your full name" />
              </div>
              <div>
                <label className="label">Your Mobile Number <span className="text-orange-500">*</span></label>
                <input className="input" type="tel" value={form.personalPhone} onChange={set("personalPhone")} placeholder="10-digit mobile number" />
                <p className="mt-1 text-[11px] text-app-soft">Used for login, lead notifications and account recovery.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-7 py-5 border-t" style={{ borderColor: "var(--app-border)" }}>
          {step > 0 ? (
            <button type="button" onClick={back} disabled={saving}
              className="btn-secondary px-4 py-2.5 text-sm rounded-xl inline-flex items-center gap-1.5 disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : <span />}

          {isLast ? (
            <button type="button" onClick={finish} disabled={saving}
              className="btn-primary px-6 py-2.5 text-sm rounded-xl inline-flex items-center gap-2 disabled:opacity-60">
              {saving ? <><Spinner size="sm" /> Saving…</> : <>Finish setup <Check className="h-4 w-4" /></>}
            </button>
          ) : (
            <button type="button" onClick={next}
              className="btn-primary px-6 py-2.5 text-sm rounded-xl inline-flex items-center gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
