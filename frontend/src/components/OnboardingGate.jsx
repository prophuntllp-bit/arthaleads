// components/OnboardingGate.jsx
// First-run blocking onboarding. Rendered over the app shell when a freshly
// signed-up org owner hasn't completed setup, or when any team member is
// missing their personal mobile number. Cannot be dismissed until completed.
//
// Admins get a three-step flow; everyone else gets a single screen. That split
// is deliberate — a team member only supplies their own name and number, and
// wrapping two fields in a wizard would add ceremony without reducing effort.
//
// The card is a solid surface. It previously sat on
// backdrop-filter: blur(48px) saturate(140%), and the frosted panel read as
// unfinished rather than premium — that treatment is what this replaces.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { Spinner } from "./UI";
import { Check, ArrowRight, ArrowLeft, Facebook, MessageCircle, Globe, FileUp } from "lucide-react";
import toast from "react-hot-toast";

// Light client-side validators (server re-validates the required ones)
const phoneOk = (v) => v.replace(/\D/g, "").length >= 10;

const TEAM_SIZES = ["Just me", "2–5", "6–15", "16+"];

// Where each pick sends the admin once setup finishes. Selections are not
// persisted — their value is getting the person to the right screen while
// intent is still high, which needs no schema change.
const LEAD_SOURCES = [
  { id: "facebook",   label: "Facebook Lead Ads",   desc: "Auto-import leads from your ad campaigns",  icon: Facebook,      tint: "#1877F2", to: "/integrations" },
  { id: "whatsapp",   label: "WhatsApp",            desc: "Capture enquiries from chats",              icon: MessageCircle, tint: "#25D366", to: "/integrations" },
  { id: "website",    label: "Website form",        desc: "Add a form or our WordPress plugin",        icon: Globe,         tint: "#71717A", to: "/integrations" },
  { id: "import",     label: "Import a spreadsheet", desc: "Bring in your existing leads from CSV or Excel", icon: FileUp,   tint: "#FF6B00", to: "/leads" },
];

export default function OnboardingGate() {
  const { user, org, updateOrg, updateUserState } = useAuth();
  const navigate = useNavigate();

  // Non-admins only need their personal mobile — they didn't create the org.
  const profileOnly = user?.role !== "admin";

  const [step, setStep]           = useState(1);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [completed, setCompleted] = useState(false);
  const [done, setDone]           = useState(false);   // success screen

  const [form, setForm] = useState({
    name:          org?.name && !/'s Workspace$/.test(org.name) ? org.name : "",
    phone:         org?.phone || "",
    companySize:   org?.companySize || "",
    fullName:      user?.name || "",
    personalPhone: user?.phone || "",
    sources:       [],
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError("");
  };

  const toggleSource = (id) =>
    setForm((f) => ({
      ...f,
      sources: f.sources.includes(id) ? f.sources.filter((s) => s !== id) : [...f.sources, id],
    }));

  // Validate only what the current step asks for, so someone is never told
  // about a problem on a screen they cannot see.
  const validateStep = (s) => {
    if (s === 1) {
      if (form.fullName.trim().length < 2) return "Please enter your full name.";
      if (!phoneOk(form.personalPhone))    return "Please enter a valid 10-digit mobile number.";
    }
    if (s === 2) {
      if (form.name.trim().length < 2) return "Please enter your organisation name.";
      if (!phoneOk(form.phone))        return "Please enter a valid business phone number.";
      if (!form.companySize)           return "Please pick your team size.";
    }
    return "";
  };

  const next = () => {
    const msg = validateStep(step);
    if (msg) { setError(msg); return; }
    setError("");
    setStep((s) => s + 1);
  };

  const back = () => { setError(""); setStep((s) => Math.max(1, s - 1)); };

  const submit = async () => {
    // Re-check every step, not just the visible one: someone can reach the
    // last screen and go Back, and a stale value must not slip through.
    for (const s of profileOnly ? [1] : [1, 2]) {
      const msg = validateStep(s);
      if (msg) { setStep(s); setError(msg); return; }
    }
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
          companySize:   form.companySize,
          fullName:      form.fullName.trim(),
          personalPhone: form.personalPhone.trim(),
        });
        if (data.org)  updateOrg(data.org);
        if (data.user) updateUserState(data.user);
      }
      setSaving(false);
      if (profileOnly) {
        toast.success("All set! Welcome to Arthaleads 🎉");
        setCompleted(true);
      } else {
        setDone(true);   // show the success screen before handing over
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your details. Please try again.");
      setSaving(false);
    }
  };

  const finishAndGo = () => {
    const first = LEAD_SOURCES.find((s) => form.sources.includes(s.id));
    setCompleted(true);
    if (first) navigate(first.to);
  };

  if (completed) return null;

  const totalSteps = 3;
  const firstName = (form.fullName.trim().split(/\s+/)[0]) || "there";

  // ── Shared bits ────────────────────────────────────────────────────────────
  const Progress = () => (
    <div className="flex items-center gap-1.5 mb-7" aria-hidden="true">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-300"
          style={{ background: i < step ? "#ff6b00" : "var(--app-border)" }} />
      ))}
    </div>
  );

  const Field = ({ label, children, helper }) => (
    <div>
      <label className="label">{label} <span className="text-orange-500">*</span></label>
      {children}
      {helper && <p className="text-xs text-app-soft mt-1.5">{helper}</p>}
    </div>
  );

  // Fixed +91 chip rather than a typed prefix — country-code formatting is the
  // single most common cause of a rejected number here.
  const PhoneInput = ({ value, onChange, placeholder, autoFocus }) => (
    <div className="flex items-stretch gap-2">
      <span className="flex items-center px-3 rounded-2xl text-sm font-semibold flex-shrink-0"
        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft)" }}>
        +91
      </span>
      <input className="input flex-1" type="tel" value={value} onChange={onChange}
        placeholder={placeholder} autoComplete="tel" autoFocus={autoFocus} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(8,8,14,0.88)" }}>
      <div className="my-auto w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        style={{
          // Solid, not frosted. This is the change: the panel used to be
          // translucent with a heavy backdrop blur behind it.
          background: "var(--app-surface-solid)",
          border: "1px solid var(--app-border)",
        }}>
        <div className="px-7 pt-7 pb-6">

          {/* ── Success ── */}
          {done ? (
            <>
              <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(34,197,94,0.12)" }}>
                <Check className="h-7 w-7" style={{ color: "#22c55e" }} />
              </div>
              <h2 className="text-xl font-black tracking-tight text-app text-center">
                You&apos;re all set, {firstName}
              </h2>
              <p className="mt-1.5 text-sm text-app-soft text-center">
                Your workspace is ready. Here&apos;s what we&apos;d do first.
              </p>

              <div className="mt-6 space-y-0">
                {[
                  ["Add your first lead", "Start tracking an enquiry in under a minute"],
                  ["Invite your team", "Assign leads to agents and track their follow-ups"],
                  ["Connect a lead source", "New leads land in your CRM automatically"],
                ].map(([title, desc], i) => (
                  <div key={title} className="flex items-start gap-3 py-3"
                    style={{ borderTop: i ? "1px solid var(--app-border)" : "none" }}>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "rgba(var(--app-primary-rgb),0.10)" }}>
                      <span className="text-[11px] font-black text-[#ff6b00]">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-app">{title}</p>
                      <p className="text-xs text-app-soft mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={finishAndGo}
                className="btn-primary w-full mt-6 px-6 py-3 text-sm rounded-2xl inline-flex items-center justify-center gap-2">
                Go to dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              {/* ── Header ── */}
              <div className="h-12 w-12 rounded-2xl overflow-hidden shadow-sm mx-auto mb-5">
                <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
              </div>

              {!profileOnly && <Progress />}

              {/* ── Step 1: who they are ── */}
              {(profileOnly || step === 1) && (
                <>
                  <h2 className="text-xl font-black tracking-tight text-app">
                    {profileOnly ? "Welcome aboard!" : "Let's set up your workspace"}
                  </h2>
                  <p className="mt-1.5 text-sm text-app-soft">
                    {profileOnly
                      ? "Just a couple of details to finish setting up your account."
                      : "This takes about a minute. We'll only ask for what the CRM actually needs."}
                  </p>

                  <div className="mt-6 space-y-4">
                    <Field label="Your full name">
                      <input className="input" value={form.fullName} onChange={set("fullName")}
                        placeholder="e.g. Priya Sharma" autoComplete="name" autoFocus />
                    </Field>
                    <Field label="Your mobile number" helper="Used for lead alerts and login verification.">
                      <PhoneInput value={form.personalPhone} onChange={set("personalPhone")}
                        placeholder="98765 43210" />
                    </Field>
                  </div>
                </>
              )}

              {/* ── Step 2: the business ── */}
              {!profileOnly && step === 2 && (
                <>
                  <h2 className="text-xl font-black tracking-tight text-app">Tell us about your business</h2>
                  <p className="mt-1.5 text-sm text-app-soft">
                    This is what appears on your invoices and lead forms.
                  </p>

                  <div className="mt-6 space-y-4">
                    <Field label="Organisation name">
                      <input className="input" value={form.name} onChange={set("name")}
                        placeholder="e.g. Skyline Realty Pvt Ltd" autoComplete="organization" autoFocus />
                    </Field>
                    <Field label="Business phone">
                      <PhoneInput value={form.phone} onChange={set("phone")} placeholder="Office contact number" />
                    </Field>
                    <div>
                      <label className="label">Team size <span className="text-orange-500">*</span></label>
                      <div className="flex flex-wrap gap-2">
                        {TEAM_SIZES.map((s) => {
                          const active = form.companySize === s;
                          return (
                            <button key={s} type="button"
                              onClick={() => { setForm((f) => ({ ...f, companySize: s })); setError(""); }}
                              className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                              style={{
                                background: active ? "rgba(var(--app-primary-rgb),0.10)" : "transparent",
                                border: `1px solid ${active ? "#ff6b00" : "var(--app-border)"}`,
                                color: active ? "#ff6b00" : "var(--app-text-soft)",
                              }}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-app-soft mt-1.5">
                        We&apos;ll suggest a plan that fits — you can change it any time.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 3: activation ── */}
              {!profileOnly && step === 3 && (
                <>
                  <h2 className="text-xl font-black tracking-tight text-app">Where do your leads come from?</h2>
                  <p className="mt-1.5 text-sm text-app-soft">
                    Connect one now and your leads start flowing in immediately. You can add more later.
                  </p>

                  <div className="mt-6 space-y-2.5">
                    {LEAD_SOURCES.map(({ id, label, desc, icon: Icon, tint }) => {
                      const active = form.sources.includes(id);
                      return (
                        <button key={id} type="button" onClick={() => toggleSource(id)}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all cursor-pointer"
                          style={{
                            background: active ? "rgba(var(--app-primary-rgb),0.07)" : "transparent",
                            border: `1px solid ${active ? "#ff6b00" : "var(--app-border)"}`,
                          }}>
                          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${tint}18` }}>
                            <Icon className="h-4 w-4" style={{ color: tint }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-app">{label}</p>
                            <p className="text-xs text-app-soft truncate">{desc}</p>
                          </div>
                          <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              background: active ? "#ff6b00" : "transparent",
                              border: `1.5px solid ${active ? "#ff6b00" : "var(--app-border)"}`,
                            }}>
                            {active && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {error && (
                <div className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium"
                  style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444" }}
                  role="alert">
                  {error}
                </div>
              )}

              {/* ── Actions ── */}
              <div className="mt-6 flex items-center gap-2.5">
                {!profileOnly && step > 1 && (
                  <button type="button" onClick={back} disabled={saving}
                    className="px-4 py-3 rounded-2xl text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    style={{ border: "1px solid var(--app-border)", color: "var(--app-text-soft)" }}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
                <button type="button" disabled={saving}
                  onClick={profileOnly || step === totalSteps ? submit : next}
                  className="btn-primary flex-1 px-6 py-3 text-sm rounded-2xl inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving
                    ? <><Spinner size="sm" /> Setting up…</>
                    : profileOnly
                      ? <>Enter your CRM <Check className="h-4 w-4" /></>
                      : step === totalSteps
                        ? <>Finish setup <Check className="h-4 w-4" /></>
                        : <>Continue <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>

              {/* Skipping is a plain link, never a button — it must not compete
                  with the primary action. */}
              {!profileOnly && step === totalSteps && !saving && (
                <button type="button" onClick={submit}
                  className="w-full mt-3 text-xs text-app-soft hover:text-app transition-colors cursor-pointer">
                  Skip for now
                </button>
              )}

              {!profileOnly && (
                <p className="text-center text-[11px] text-app-soft mt-4">
                  Step {step} of {totalSteps}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
