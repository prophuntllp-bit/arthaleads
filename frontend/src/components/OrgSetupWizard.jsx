// OrgSetupWizard.jsx
// First-run overlay wizard for completing org profile (phone, address, tax info).
// Shown only when org has no phone AND no address set.
// Once saved or permanently skipped, localStorage prevents it from reappearing.
import { useState } from "react";
import { Building2, Receipt, User, ChevronRight, X, Check, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import toast from "react-hot-toast";

function dismissKey(orgId) {
  return `org_setup_done_${orgId}`;
}

export function shouldShowOrgSetupWizard(org) {
  if (!org?._id) return false;
  if (localStorage.getItem(dismissKey(org._id)) === "1") return false;
  // Show only when both phone AND address are missing
  return !org.phone && !org.address;
}

const STEPS = [
  { id: "business", label: "About your business", Icon: Building2 },
  { id: "tax",      label: "Tax & compliance",    Icon: Receipt },
  { id: "profile",  label: "Your details",         Icon: User },
];

export default function OrgSetupWizard({ onClose }) {
  const { org, user, updateOrg, updateUserState } = useAuth();

  const [step,    setStep]    = useState(0);
  const [saving,  setSaving]  = useState(false);

  const [orgName,  setOrgName]  = useState(org?.name    || "");
  const [phone,    setPhone]    = useState(org?.phone   || "");
  const [address,  setAddress]  = useState(org?.address || "");

  const [gstNo,    setGstNo]    = useState(org?.gstNo || "");
  const [pan,      setPan]      = useState(org?.pan   || "");

  const [userName, setUserName] = useState(user?.name  || "");
  const [userPhone,setUserPhone]= useState(user?.phone || "");

  const markDone = () => {
    localStorage.setItem(dismissKey(org._id), "1");
    onClose?.();
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      if (step === 0) {
        if (!phone.trim() || !address.trim()) {
          toast.error("Business phone and address are required.");
          setSaving(false);
          return;
        }
        const patch = { phone: phone.trim(), address: address.trim() };
        if (orgName.trim() && orgName.trim() !== org?.name) {
          // Also update org name via PUT /org/me
          await api.put("/org/me", { name: orgName.trim() });
        }
        const { data } = await api.patch("/org/me/profile", patch);
        updateOrg({ ...org, ...data.org });
        setStep(1);
      } else if (step === 1) {
        // Tax fields are all optional — save whatever was entered
        const patch = {};
        if (gstNo.trim()) patch.gstNo = gstNo.trim().toUpperCase();
        if (pan.trim())   patch.pan   = pan.trim().toUpperCase();
        if (Object.keys(patch).length) {
          const { data } = await api.patch("/org/me/profile", patch);
          updateOrg({ ...org, ...data.org });
        }
        setStep(2);
      } else {
        // Step 2: update user profile
        if (userName.trim()) {
          const { data } = await api.put("/auth/me", {
            name:  userName.trim(),
            phone: userPhone.trim(),
            avatar: user?.avatar || "",
            role:  user?.role || "admin",
          });
          if (data.user) updateUserState(data.user);
        }
        toast.success("Setup complete! Welcome to Arthaleads.");
        markDone();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const pct = Math.round(((step) / STEPS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--app-primary)" }}>
                Quick Setup · Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="text-xl font-black text-app">{STEPS[step].label}</h2>
            </div>
            <button
              type="button"
              onClick={markDone}
              title="Skip setup"
              className="p-1.5 rounded-xl text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step pills */}
          <div className="flex gap-2">
            {STEPS.map((s, i) => {
              const done    = i < step;
              const current = i === step;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition"
                  style={{
                    background: done    ? "rgba(34,197,94,0.12)"                        :
                                current ? "rgba(var(--app-primary-rgb),0.12)"            :
                                          "var(--app-surface-low)",
                    color:      done    ? "#22c55e"                                      :
                                current ? "var(--app-primary)"                           :
                                          "var(--app-text-soft)",
                    border:     current ? "1px solid rgba(var(--app-primary-rgb),0.3)"   : "1px solid transparent",
                  }}
                >
                  {done
                    ? <Check className="h-3 w-3" />
                    : <s.Icon className="h-3 w-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 rounded-full" style={{ background: "var(--app-border)" }}>
            <div
              className="h-1 rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "var(--app-primary)" }}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">

          {step === 0 && (
            <>
              <p className="text-sm text-app-soft">
                Tell us about your business so we can personalise your CRM and generate proper invoices.
              </p>
              <div>
                <label className="label">Organisation Name</label>
                <input
                  className="input"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your company name"
                />
              </div>
              <div>
                <label className="label">Business Phone <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  className="input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="label">Business Address / City <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  className="input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full address or city, state"
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-app-soft">
                These details appear on your invoices. All fields are optional — you can fill them later in Settings.
              </p>
              <div>
                <label className="label">GST Number <span className="text-app-soft text-xs">(optional)</span></label>
                <input
                  className="input font-mono"
                  value={gstNo}
                  onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 27XXXXX0000X1ZX"
                  maxLength={15}
                />
              </div>
              <div>
                <label className="label">PAN <span className="text-app-soft text-xs">(optional)</span></label>
                <input
                  className="input font-mono"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                />
              </div>
              <p className="text-xs text-app-soft">
                More billing fields (CIN, RERA, bank details) are available in{" "}
                <strong>Settings → Organisation Billing</strong>.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-app-soft">
                Confirm your name and contact number so your team can reach you.
              </p>
              <div>
                <label className="label">Your Full Name</label>
                <input
                  className="input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="label">Your Phone <span className="text-app-soft text-xs">(optional)</span></label>
                <input
                  className="input"
                  type="tel"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}
        >
          <button
            type="button"
            onClick={step === 0 ? markDone : () => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-app-soft hover:text-app transition"
          >
            {step === 0
              ? <><X className="h-4 w-4" /> Skip for now</>
              : <><ArrowLeft className="h-4 w-4" /> Back</>}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-85 disabled:opacity-60"
            style={{ background: "var(--app-primary)" }}
          >
            {saving ? "Saving…" : step === STEPS.length - 1 ? "Finish Setup" : "Continue"}
            {!saving && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
