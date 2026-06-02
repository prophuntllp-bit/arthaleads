import { useRef, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Zap, Bell, Users, BarChart3, Shield, PhoneCall, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/UI";
import { useGoogleLogin } from "@react-oauth/google";
import api from "../services/api";

// phone step states
const IDLE     = "idle";     // user hasn't clicked "Send OTP" yet
const SENDING  = "sending";  // waiting for send OTP response
const SENT     = "sent";     // OTP sent, waiting for user to enter code
const VERIFYING= "verifying";// waiting for verify OTP response
const VERIFIED = "verified"; // phone is confirmed ✓

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, googleLogin } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError]       = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [form, setForm] = useState({ orgName: "", name: "", email: "", password: "", phone: "" });
  const [referralCode] = useState(() => searchParams.get("ref") || "");

  // Phone OTP verification states
  const [phoneStep, setPhoneStep] = useState(IDLE);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp]       = useState("");
  const [otpError, setOtpError] = useState("");
  const [phoneToken, setPhoneToken] = useState("");
  const otpRef = useRef(null);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    // If the user edits phone after verification, reset the verification
    if (key === "phone") {
      setPhoneStep(IDLE);
      setPhoneToken("");
      setOtp("");
      setOtpError("");
    }
  };

  const triggerGoogle = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      setError("");
      setGLoading(true);
      try {
        await googleLogin(tokenResponse.access_token);
        toast.success("Account ready! Welcome to Arthaleads.");
        navigate("/dashboard");
      } catch (e) {
        setError(e.response?.data?.message || "Google sign-up failed. Please try again.");
      } finally {
        setGLoading(false);
      }
    },
    onError: () => setError("Google sign-up failed. Please try again."),
  });

  // Step 1 - send OTP to the email the user typed
  const handleSendOtp = async () => {
    setOtpError("");
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!email) { setOtpError("Enter your email first so we know where to send the OTP."); return; }
    if (phone.replace(/\D/g, "").length < 10) { setOtpError("Enter a valid 10-digit mobile number first."); return; }

    setPhoneStep(SENDING);
    try {
      const { data } = await api.post("/auth/signup/send-otp", { phone, email });
      setMaskedEmail(data.maskedEmail);
      setPhoneStep(SENT);
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch (err) {
      setPhoneStep(IDLE);
      setOtpError(err.response?.data?.message || "Failed to send OTP. Please try again.");
    }
  };

  // Step 2 - verify the OTP the user entered
  const handleVerifyOtp = async () => {
    setOtpError("");
    if (otp.length !== 6) { setOtpError("Enter the 6-digit code from your email."); return; }

    setPhoneStep(VERIFYING);
    try {
      const { data } = await api.post("/auth/signup/verify-otp", { phone: form.phone, otp });
      setPhoneToken(data.phoneToken);
      setPhoneStep(VERIFIED);
      toast.success("Phone verified ✓");
    } catch (err) {
      setPhoneStep(SENT);
      setOtpError(err.response?.data?.message || "Invalid or expired OTP. Please try again.");
    }
  };

  const handleResend = () => {
    setOtp("");
    setOtpError("");
    setPhoneStep(IDLE);
    setTimeout(handleSendOtp, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const pwdOk = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+{};:,<.>?/\\|[\]~`])/.test(form.password);
    if (form.password.length < 8 || !pwdOk) { setError("Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character"); return; }
    if (phoneStep !== VERIFIED) { setError("Please verify your phone number before creating your account."); return; }

    setLoading(true);
    try {
      await signup({ ...form, phoneToken, ...(referralCode ? { referralCode } : {}) });
      toast.success("Account created! Welcome to Arthaleads.");
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message ||
        (err.request ? "Could not reach the server. Please check your connection and try again." : "Something went wrong. Please try again.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Zap,       text: "Access your leads and pipeline instantly" },
    { icon: Bell,      text: "Get notified on follow-ups and site visits" },
    { icon: Users,     text: "Collaborate with your team in real time" },
    { icon: PhoneCall, text: "Track every call, WhatsApp and site visit" },
    { icon: BarChart3, text: "Monitor team performance and conversions" },
    { icon: Shield,    text: "Role-based access for admins, managers & agents" },
  ];

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2 lg:items-stretch">

        {/* Left panel */}
        <div
          className="hidden rounded-[2rem] border p-8 lg:flex lg:flex-col"
          style={{
            borderColor: "var(--app-border)",
            background: "linear-gradient(145deg, color-mix(in srgb, var(--app-surface) 88%, transparent), color-mix(in srgb, var(--app-surface-low) 92%, transparent))",
            boxShadow: "var(--app-shadow)",
          }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
              <img src="/logo.png" alt="ArthaLeads" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-black text-base leading-none tracking-tight">
                <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
              </p>
              <p className="text-[8px] font-semibold tracking-[0.15em] text-app-soft uppercase mt-0.5">
                Turning Opportunities Into Value
              </p>
            </div>
          </div>
          <p className="stitch-kicker mb-2">Team Onboarding</p>
          <h2 className="text-3xl font-black leading-tight tracking-tight text-app mb-2">
            Join your real estate team on Arthaleads.
          </h2>
          <p className="text-sm leading-6 text-app-soft mb-6">
            One workspace for all your leads, follow-ups, projects and team activity.
          </p>
          <div className="grid grid-cols-1 gap-2.5 flex-1">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 rounded-2xl p-3 stitch-surface-muted">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500/10 flex-shrink-0">
                  <Icon className="h-3.5 w-3.5 text-orange-500" />
                </div>
                <span className="text-sm text-app">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col w-full">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg mb-3">
              <img src="/logo.png" alt="ArthaLeads" className="w-full h-full object-cover" />
            </div>
            <p className="font-black text-xl leading-none tracking-tight">
              <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
            </p>
          </div>

          <div className="mb-5 text-center lg:hidden">
            <h1 className="text-2xl font-black tracking-tight text-app">Create your account</h1>
            <p className="mt-1 text-sm text-app-soft">Start managing real estate leads with your team.</p>
          </div>

          <div className="auth-card flex-1">
            <div className="hidden lg:block mb-5 text-center">
              <h1 className="text-2xl font-black tracking-tight text-app">Create your account</h1>
              <p className="mt-1 text-sm text-app-soft">Start managing real estate leads with your team.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">

              <div>
                <label className="label">Company / Organization Name</label>
                <input className="input" value={form.orgName} onChange={set("orgName")} placeholder="Your company or organization name" autoComplete="organization" required minLength={2} />
              </div>

              <div>
                <label className="label">Your Full Name</label>
                <input className="input" value={form.name} onChange={set("name")} placeholder="Enter your full name" autoComplete="name" required minLength={2} />
              </div>

              <div>
                <label className="label">Work Email</label>
                <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="your@email.com" autoComplete="username" required />
              </div>

              {/* ── Phone + OTP verification ───────────────────────────────────── */}
              <div>
                <label className="label">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      className={`input pr-8 ${phoneStep === VERIFIED ? "border-green-500/60 focus:border-green-500" : ""}`}
                      type="tel"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="10-digit mobile number"
                      autoComplete="tel"
                      required
                      minLength={10}
                      disabled={phoneStep === VERIFIED}
                      style={phoneStep === VERIFIED ? { opacity: 0.85 } : {}}
                    />
                    {phoneStep === VERIFIED && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
                    )}
                  </div>

                  {phoneStep !== VERIFIED && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={phoneStep === SENDING || phoneStep === VERIFYING}
                      className="btn-secondary shrink-0 px-4 text-xs font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap"
                    >
                      {phoneStep === SENDING ? <><Spinner size="sm" /> Sending…</> : phoneStep === SENT ? "Resend" : "Send OTP"}
                    </button>
                  )}

                  {phoneStep === VERIFIED && (
                    <button
                      type="button"
                      onClick={() => { setPhoneStep(IDLE); setPhoneToken(""); setOtp(""); setOtpError(""); }}
                      className="btn-secondary shrink-0 px-3 text-xs rounded-xl"
                      title="Change number"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* OTP input - shown while in SENT or VERIFYING state */}
                {(phoneStep === SENT || phoneStep === VERIFYING) && (
                  <div className="mt-2 rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                    <p className="text-xs text-app-soft">
                      OTP sent to <span className="font-semibold text-app">{maskedEmail}</span>. Enter the 6-digit code below.
                    </p>
                    <div className="flex gap-2">
                      <input
                        ref={otpRef}
                        className="input flex-1 tracking-[0.25em] font-semibold text-center text-base"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                        placeholder="• • • • • •"
                        autoComplete="one-time-code"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={phoneStep === VERIFYING || otp.length !== 6}
                        className="btn-primary shrink-0 px-4 text-xs disabled:opacity-50"
                      >
                        {phoneStep === VERIFYING ? <><Spinner size="sm" /> Verifying…</> : "Verify"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-xs text-orange-500 hover:underline"
                    >
                      Didn't receive it? Resend OTP
                    </button>
                  </div>
                )}

                {/* Verified badge */}
                {phoneStep === VERIFIED && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-500">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Phone number verified
                  </p>
                )}

                {/* OTP-step errors */}
                {otpError && (
                  <p className="mt-1.5 text-xs text-red-400">{otpError}</p>
                )}
              </div>
              {/* ── end phone OTP ─────────────────────────────────────────────── */}

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    className="input pr-11"
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special char"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app transition"
                    onClick={() => setShowPwd((v) => !v)}>
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-app-soft">
                  8+ characters · 1 uppercase · 1 number · 1 special character (e.g. !@#$)
                </p>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center py-3 mt-2 disabled:opacity-50"
                disabled={loading || phoneStep !== VERIFIED}
                title={phoneStep !== VERIFIED ? "Verify your phone number first" : undefined}
              >
                {loading ? (
                  <><Spinner size="sm" /><span>Creating account…</span></>
                ) : (
                  "Create Account"
                )}
              </button>

              {phoneStep !== VERIFIED && (
                <p className="text-center text-xs text-app-soft -mt-1">
                  Verify your mobile number above to enable account creation.
                </p>
              )}
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: "var(--app-border)" }} />
              <span className="text-xs text-app-soft">or sign up with</span>
              <div className="h-px flex-1" style={{ background: "var(--app-border)" }} />
            </div>

            <button
              type="button"
              onClick={() => triggerGoogle()}
              disabled={gLoading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-semibold text-app transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-60"
              style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
            >
              {gLoading ? (
                <><Spinner size="sm" /> Signing up…</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.2 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13 17.7 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                    <path fill="#FBBC05" d="M10.5 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/>
                    <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
                  </svg>
                  Sign up with Google
                </>
              )}
            </button>

            <p className="mt-6 text-center text-sm text-app-soft">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-orange-500 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
