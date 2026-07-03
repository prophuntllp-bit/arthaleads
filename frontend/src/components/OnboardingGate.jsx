// components/OnboardingGate.jsx
// First-run blocking onboarding screen. Rendered on top of the app shell when a
// freshly-signed-up org owner hasn't completed setup, or when any team member is
// missing their personal mobile number. Cannot be dismissed until completed.
//
// Kept intentionally to a single screen with only the fields the CRM actually
// needs to function (org name + contact numbers). Everything else — business
// type, team size, GST/PAN/RERA, billing address — lives in Settings, where an
// admin can fill it in at their own pace instead of being blocked by it.
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { Spinner } from "./UI";
import { Check } from "lucide-react";
import toast from "react-hot-toast";

// Light client-side validators (server re-validates the required ones)
const phoneOk = (v) => v.replace(/\D/g, "").length >= 10;

export default function OnboardingGate() {
  const { user, org, updateOrg, updateUserState } = useAuth();

  // Non-admins only need their personal mobile — they didn't create the org.
  const profileOnly = user?.role !== "admin";

  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [completed, setCompleted] = useState(false);

  const [form, setForm] = useState({
    name:          org?.name && !/'s Workspace$/.test(org.name) ? org.name : "",
    phone:         org?.phone || "",
    fullName:      user?.name || "",
    personalPhone: user?.phone || "",
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError("");
  };

  const validate = () => {
    if (!profileOnly) {
      if (form.name.trim().length < 2) return "Please enter your organisation name.";
      if (!phoneOk(form.phone))        return "Please enter a valid business phone number.";
    }
    if (form.fullName.trim().length < 2) return "Please enter your full name.";
    if (!phoneOk(form.personalPhone))    return "Please enter a valid 10-digit mobile number.";
    return "";
  };

  const finish = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError("");
    setSaving(true);
    try {
      if (profileOnly) {
        const { data } = await api.put("/auth/me", {
          name: form.fullName.trim(),
          phone: form.personalPhone.trim(),
        });
        updateUserState(data.user || { ...user, name: form.fullName.trim(), phone: form.personalPhone.trim() });
      } else {
        const { data } = await api.post("/org/me/onboarding", {
          name:          form.name.trim(),
          phone:         form.phone.trim(),
          fullName:      form.fullName.trim(),
          personalPhone: form.personalPhone.trim(),
        });
        if (data.org)  updateOrg(data.org);
        if (data.user) updateUserState(data.user);
      }
      toast.success("All set! Welcome to Arthaleads 🎉");
      setSaving(false);
      setCompleted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your details. Please try again.");
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (completed) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(8,8,14,0.92)", backdropFilter: "blur(10px)" }}>
      <div className="my-auto w-full max-w-md rounded-3xl shadow-2xl"
        style={{
          background: "var(--app-surface-high)",
          border: "1px solid var(--app-border-strong)",
          backdropFilter: "blur(48px) saturate(140%)",
          WebkitBackdropFilter: "blur(48px) saturate(140%)",
        }}>

        {/* Header */}
        <div className="px-7 pt-7 pb-5 text-center">
          <div className="h-12 w-12 rounded-2xl overflow-hidden shadow-lg mx-auto mb-4">
            <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-app">
            {profileOnly ? "Welcome aboard!" : "Welcome to ArthaLeads"}
          </h2>
          <p className="mt-1.5 text-sm text-app-soft">
            {profileOnly
              ? "Just a couple of details to finish setting up your account."
              : "Just a couple of details and you're straight into your CRM."}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={finish} className="px-7 pb-2 space-y-4">
          {!profileOnly && (
            <>
              <div>
                <label className="label">Organisation Name <span className="text-orange-500">*</span></label>
                <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Skyline Realty Pvt Ltd" autoFocus />
              </div>
              <div>
                <label className="label">Business Phone <span className="text-orange-500">*</span></label>
                <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="Office contact number" />
              </div>
            </>
          )}
          <div>
            <label className="label">Your Full Name <span className="text-orange-500">*</span></label>
            <input className="input" value={form.fullName} onChange={set("fullName")} placeholder="Enter your full name"
              autoFocus={profileOnly} />
          </div>
          <div>
            <label className="label">Your Mobile Number <span className="text-orange-500">*</span></label>
            <input className="input" type="tel" value={form.personalPhone} onChange={set("personalPhone")} placeholder="10-digit mobile number" />
          </div>

          {!profileOnly && (
            <p className="text-xs text-app-soft">
              GST, PAN, RERA and billing details can be added anytime later from Settings.
            </p>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-medium"
              style={{ color: "#ef4444" }}>
              {error}
            </div>
          )}

          <div className="pt-2 pb-5">
            <button type="submit" disabled={saving}
              className="btn-primary w-full px-6 py-3 text-sm rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <><Spinner size="sm" /> Saving…</> : <>Enter your CRM <Check className="h-4 w-4" /></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
