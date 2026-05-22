import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Zap, Bell, Users, BarChart3, Shield, PhoneCall, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/UI";
import { useGoogleLogin } from "@react-oauth/google";
import { auth, firebaseReady } from "../utils/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

function toE164(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export default function Signup() {
  const navigate = useNavigate();
  const { signup, googleLogin } = useAuth();
  const [loading, setLoading]     = useState(false);
  const [gLoading, setGLoading]   = useState(false);
  const [error, setError]         = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [form, setForm] = useState({ orgName: "", name: "", email: "", password: "", phone: "" });

  // OTP state
  const [otpSent, setOtpSent]         = useState(false);
  const [otp, setOtp]                 = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpLoading, setOtpLoading]   = useState(false);
  const [otpErr, setOtpErr]           = useState("");
  const [resendTimer, setTimer]       = useState(0);
  const confirmRef                    = useRef(null);
  const recaptchaRef                  = useRef(null);
  const timerRef                      = useRef(null);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    // Reset phone verification if user changes phone
    if (key === "phone") { setPhoneVerified(false); setOtpSent(false); setOtp(""); setOtpErr(""); }
  };

  const startCountdown = () => {
    setTimer(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
  };

  const sendOtp = async () => {
    setOtpErr("");
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10) { setOtpErr("Enter a valid 10-digit mobile number first."); return; }
    setOtpLoading(true);
    try {
      if (recaptchaRef.current) { try { recaptchaRef.current.clear(); } catch {} recaptchaRef.current = null; }
      const verifier = new RecaptchaVerifier(auth, "signup-recaptcha-container", { size: "invisible", callback: () => {} });
      recaptchaRef.current = verifier;
      const confirmation = await signInWithPhoneNumber(auth, toE164(form.phone), verifier);
      confirmRef.current = confirmation;
      setOtpSent(true);
      startCountdown();
      toast.success("OTP sent to " + toE164(form.phone));
    } catch (e) {
      setOtpErr(
        e.message?.includes("invalid-phone") ? "Invalid phone number." :
        e.message?.includes("too-many-requests") ? "Too many attempts. Wait a few minutes." :
        "Could not send OTP. Please try again."
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    setOtpErr("");
    if (otp.length !== 6) { setOtpErr("Enter the 6-digit OTP."); return; }
    setOtpLoading(true);
    try {
      await confirmRef.current.confirm(otp);
      setPhoneVerified(true);
      setOtpSent(false);
      toast.success("Phone number verified!");
    } catch (e) {
      setOtpErr(
        e.message?.includes("invalid-verification-code") ? "Wrong OTP. Please check and try again." :
        e.message?.includes("code-expired") ? "OTP expired. Please resend." :
        "Verification failed. Please try again."
      );
    } finally {
      setOtpLoading(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // OTP verification only required when Firebase is configured
    if (firebaseReady && !phoneVerified) { setError("Please verify your mobile number before creating the account."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await signup(form);
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
      {/* Hidden reCAPTCHA anchor */}
      <div id="signup-recaptcha-container" />

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

              {/* Phone — OTP verification when Firebase is configured, plain field otherwise */}
              <div>
                <label className="label flex items-center gap-2">
                  Mobile Number
                  {firebaseReady && phoneVerified && (
                    <span className="inline-flex items-center gap-1 text-green-500 text-[10px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  )}
                </label>

                {firebaseReady ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        className={`input flex-1 ${phoneVerified ? "border-green-500/50 bg-green-500/5" : ""}`}
                        type="tel"
                        value={form.phone}
                        onChange={set("phone")}
                        placeholder="10-digit mobile number"
                        autoComplete="tel"
                        required
                        minLength={10}
                        disabled={phoneVerified}
                      />
                      {!phoneVerified && (
                        <button
                          type="button"
                          onClick={sendOtp}
                          disabled={otpLoading || form.phone.replace(/\D/g, "").length < 10 || (otpSent && resendTimer > 0)}
                          className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap flex-shrink-0 disabled:opacity-40"
                        >
                          {otpLoading ? <Spinner size="sm" /> : otpSent ? (resendTimer > 0 ? `${resendTimer}s` : "Resend") : "Get OTP"}
                        </button>
                      )}
                      {phoneVerified && (
                        <button
                          type="button"
                          onClick={() => { setPhoneVerified(false); setOtp(""); setOtpSent(false); }}
                          className="btn-secondary rounded-xl px-3 py-2 text-xs flex-shrink-0"
                        >
                          Change
                        </button>
                      )}
                    </div>
                    {otpSent && !phoneVerified && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <input
                            className="input flex-1 text-center text-lg tracking-[0.3em] font-bold"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setOtpErr(""); }}
                            placeholder="------"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={verifyOtp}
                            disabled={otpLoading || otp.length < 6}
                            className="btn-primary rounded-xl px-4 text-sm disabled:opacity-40 flex-shrink-0"
                          >
                            {otpLoading ? <Spinner size="sm" /> : "Verify"}
                          </button>
                        </div>
                        <p className="text-[11px] text-app-soft">OTP sent to {toE164(form.phone)}</p>
                        {otpErr && <p className="text-xs text-red-400">{otpErr}</p>}
                      </div>
                    )}
                    {!otpSent && !phoneVerified && otpErr && <p className="mt-1 text-xs text-red-400">{otpErr}</p>}
                  </>
                ) : (
                  /* Firebase not configured — plain phone field, no OTP required */
                  <input
                    className="input"
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    required
                    minLength={10}
                  />
                )}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    className="input pr-11"
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app transition"
                    onClick={() => setShowPwd((v) => !v)}>
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-app-soft">
                  You'll be the admin of your workspace. Add your team after signing in.
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
                disabled={loading || (firebaseReady && !phoneVerified)}
                title={firebaseReady && !phoneVerified ? "Verify your mobile number first" : ""}
              >
                {loading ? (
                  <><Spinner size="sm" /><span>Creating account…</span></>
                ) : (
                  "Create Account"
                )}
              </button>

              {firebaseReady && !phoneVerified && (
                <p className="text-center text-xs text-app-soft">Verify your mobile number to enable account creation.</p>
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
