import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, ShieldCheck, Phone, Mail } from "lucide-react";
import { Spinner } from "../components/UI";
import toast from "react-hot-toast";
import { useGoogleLogin } from "@react-oauth/google";
import { auth, firebaseReady } from "../utils/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

// Format a raw phone string to E.164 for Firebase (+91XXXXXXXXXX)
function toE164(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.startsWith("+")) return raw.replace(/[^\d+]/g, "");
  return `+${digits}`;
}

// ── Phone OTP panel ───────────────────────────────────────────────────────────
function PhoneOtpPanel({ onSuccess }) {
  const [phone, setPhone]         = useState("");
  const [otp, setOtp]             = useState("");
  const [step, setStep]           = useState("phone"); // "phone" | "otp"
  const [loading, setLoading]     = useState(false);
  const [resendTimer, setTimer]   = useState(0);
  const [err, setErr]             = useState("");
  const confirmRef                = useRef(null);
  const recaptchaRef              = useRef(null);
  const timerRef                  = useRef(null);

  // Countdown after sending OTP
  const startCountdown = () => {
    setTimer(30);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { clearInterval(timerRef.current); }, []);

  const setupRecaptcha = () => {
    if (recaptchaRef.current) {
      try { recaptchaRef.current.clear(); } catch {}
      recaptchaRef.current = null;
    }
    recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {},
    });
    return recaptchaRef.current;
  };

  const sendOtp = async () => {
    setErr("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setErr("Enter a valid 10-digit mobile number."); return; }
    setLoading(true);
    try {
      const verifier = setupRecaptcha();
      const formatted = toE164(phone);
      const confirmation = await signInWithPhoneNumber(auth, formatted, verifier);
      confirmRef.current = confirmation;
      setStep("otp");
      startCountdown();
      toast.success("OTP sent to " + formatted);
    } catch (e) {
      const msg = e.message || "";
      setErr(msg.includes("invalid-phone") ? "Invalid phone number format." :
             msg.includes("too-many-requests") ? "Too many attempts. Wait a few minutes." :
             msg.includes("missing-phone-number") ? "Please enter a valid phone number." :
             `Failed: ${msg.split("(")[0].trim() || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setErr("");
    if (otp.length !== 6) { setErr("Enter the 6-digit OTP."); return; }
    setLoading(true);
    try {
      const result = await confirmRef.current.confirm(otp);
      const idToken = await result.user.getIdToken();
      await onSuccess(idToken);
    } catch (e) {
      setErr(e.message?.includes("invalid-verification-code") ? "Wrong OTP. Please check and try again." :
             e.message?.includes("code-expired") ? "OTP expired. Please request a new one." :
             "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden reCAPTCHA anchor — Firebase uses this div */}
      <div id="recaptcha-container" />

      {step === "phone" && (
        <>
          <div>
            <label className="label">Mobile Number</label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErr(""); }}
              placeholder="10-digit mobile number"
              onKeyDown={(e) => e.key === "Enter" && sendOtp()}
              autoFocus
              maxLength={15}
            />
            <p className="mt-1 text-[11px] text-app-soft">We'll send a 6-digit OTP via SMS.</p>
          </div>
          {err && <p className="text-sm text-red-400 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">{err}</p>}
          <button
            onClick={sendOtp}
            disabled={loading || !phone}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50"
          >
            {loading ? <><Spinner size="sm" /> Sending OTP…</> : "Send OTP"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <div className="rounded-2xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-500 text-center">
            OTP sent to <span className="font-bold">{toE164(phone)}</span>
          </div>

          <div>
            <label className="label">Enter 6-digit OTP</label>
            <input
              className="input text-center text-xl tracking-[0.35em] font-bold"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              autoFocus
              placeholder="------"
            />
          </div>

          {err && <p className="text-sm text-red-400 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">{err}</p>}

          <button
            onClick={verifyOtp}
            disabled={loading || otp.length < 6}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50"
          >
            {loading ? <><Spinner size="sm" /> Verifying…</> : "Verify & Sign In"}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              onClick={() => { setStep("phone"); setOtp(""); setErr(""); }}
              className="text-app-soft hover:text-app transition"
            >
              ← Change number
            </button>
            {resendTimer > 0 ? (
              <span className="text-app-soft">Resend in {resendTimer}s</span>
            ) : (
              <button
                onClick={sendOtp}
                disabled={loading}
                className="text-orange-500 hover:underline font-semibold disabled:opacity-50"
              >
                Resend OTP
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Login page ───────────────────────────────────────────────────────────
export default function Login() {
  useEffect(() => { document.title = "Sign In - Arthaleads Real Estate CRM"; }, []);
  const { login, googleLogin, phoneLogin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]         = useState("email"); // "email" | "phone"
  const [form, setForm]       = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [err, setErr]         = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const triggerGoogle = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      setErr("");
      setGLoading(true);
      try {
        await googleLogin(tokenResponse.access_token);
        toast.success("Welcome back!");
        navigate("/dashboard");
      } catch (e) {
        setErr(e.response?.data?.message || "Google sign-in failed. Please try again.");
      } finally {
        setGLoading(false);
      }
    },
    onError: () => setErr("Google sign-in failed. Please try again."),
  });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const RETRY_DELAYS = [6000, 10000, 15000];
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        await login(form.email, form.password);
        toast.success("Welcome back!");
        navigate("/dashboard");
        return;
      } catch (e) {
        const isNetworkErr = !e.response && e.request;
        if (isNetworkErr && attempt < RETRY_DELAYS.length) {
          const secs = RETRY_DELAYS[attempt] / 1000;
          setErr(`Server is warming up… retrying in ${secs}s`);
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
          setErr("");
          continue;
        }
        setErr(
          e.response?.data?.message ||
          (isNetworkErr ? "Could not reach the server. Check your connection and try again." : "Login failed. Please check your email/phone and password.")
        );
        break;
      }
    }
    setLoading(false);
  };

  const handlePhoneSuccess = async (idToken) => {
    try {
      await phoneLogin(idToken);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (e) {
      toast.error(e.response?.data?.message || "Sign-in failed. Please try again.");
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center p-4 overflow-x-hidden">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">

        {/* Left panel - desktop only */}
        <div
          className="hidden rounded-[2.25rem] border p-10 lg:flex lg:flex-col lg:justify-between"
          style={{
            borderColor: "var(--app-border)",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 88%, transparent), color-mix(in srgb, var(--app-surface-low) 92%, transparent))",
            boxShadow: "var(--app-shadow)",
          }}
        >
          <div>
            <div className="flex flex-col items-center text-center mb-10">
              <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg mb-4">
                <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-3xl font-black tracking-tight leading-none">
                <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span style={{ display: "block", width: 28, height: 2, background: "#FF6B00", borderRadius: 1 }} />
                <p className="text-[10px] font-semibold tracking-[0.18em] text-app-soft uppercase">Turning Opportunities Into Value</p>
                <span style={{ display: "block", width: 28, height: 2, background: "#FF6B00", borderRadius: 1 }} />
              </div>
            </div>
            <p className="stitch-kicker mb-3">Premium Real Estate CRM</p>
            <h1 className="max-w-md text-5xl font-black leading-[1.02] tracking-tight text-app">
              Manage every property lead in one premium workspace.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-app-soft">
              Facebook ads, Google campaigns, WhatsApp enquiries, team follow-ups, and conversions all stitched into one dark-mode-ready CRM.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Live Leads", value: "128" },
              { label: "Hot Sources", value: "3" },
              { label: "Active Agents", value: "12" },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.5rem] p-4 stitch-surface-muted">
                <p className="stitch-kicker mb-2">{item.label}</p>
                <p className="text-2xl font-black text-app">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full max-w-md lg:ml-auto lg:max-w-none min-w-0 flex flex-col">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl overflow-hidden shadow-lg">
              <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-app">Welcome to Arthaleads</h1>
            <p className="mt-2 text-sm text-app-soft">Sign in to your premium real estate workspace</p>
          </div>

          <div className="auth-card flex-1">
            <div className="hidden lg:block mb-6 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl overflow-hidden shadow-lg">
                <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-app">Welcome to Arthaleads</h1>
              <p className="mt-2 text-sm text-app-soft">Sign in to your premium real estate workspace</p>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 stitch-surface-muted">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-semibold text-app">Secure access</p>
                <p className="text-xs text-app-soft">Protected with role-based access and OTP verification.</p>
              </div>
            </div>

            {/* Tab switcher — Phone OTP only shown when Firebase env vars are configured */}
            {firebaseReady && (
              <div className="flex gap-1 p-1 rounded-2xl mb-5" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                <button
                  onClick={() => { setTab("email"); setErr(""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    tab === "email" ? "bg-orange-500 text-white shadow-sm" : "text-app-soft hover:text-app"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button
                  onClick={() => { setTab("phone"); setErr(""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    tab === "phone" ? "bg-orange-500 text-white shadow-sm" : "text-app-soft hover:text-app"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" /> Phone OTP
                </button>
              </div>
            )}

            {/* Email/Password form */}
            {tab === "email" && (
              <form onSubmit={submit} className="space-y-4" autoComplete="off">
                <div>
                  <label className="label">Email or Phone</label>
                  <input
                    className="input"
                    type="text"
                    inputMode="email"
                    value={form.email}
                    onChange={(e) => {
                      // Switch inputMode to numeric when user types digits only
                      set("email")(e);
                    }}
                    placeholder="you@company.com or 9876543210"
                    required
                    autoComplete="username"
                    name="email"
                  />
                  <p className="mt-1 text-[11px] text-app-soft">Enter your email address or registered mobile number.</p>
                </div>
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      className="input pr-10"
                      type={showPwd ? "text" : "password"}
                      value={form.password}
                      onChange={set("password")}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      name="password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app"
                      onClick={() => setShowPwd(!showPwd)}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {err}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : "Sign In"}
                </button>

                <div className="flex justify-end">
                  <Link to="/forgot-password"
                    className="text-xs font-medium hover:underline underline-offset-2 transition-colors"
                    style={{ color: "var(--app-primary)" }}>
                    Forgot password?
                  </Link>
                </div>
              </form>
            )}

            {/* Phone OTP form — only renders when firebaseReady */}
            {tab === "phone" && firebaseReady && (
              <PhoneOtpPanel onSuccess={handlePhoneSuccess} />
            )}

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: "var(--app-border)" }} />
              <span className="text-xs text-app-soft">or continue with</span>
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
                <><Spinner size="sm" /> Signing in…</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.2 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13 17.7 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                    <path fill="#FBBC05" d="M10.5 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/>
                    <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

            <p className="mt-6 text-center text-sm text-app-soft">
              Don't have an account? <Link to="/signup" className="font-semibold text-orange-500 hover:underline">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
