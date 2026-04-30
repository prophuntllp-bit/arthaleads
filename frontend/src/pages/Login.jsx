import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Spinner } from "../components/UI";
import toast from "react-hot-toast";
import { useGoogleLogin } from "@react-oauth/google";

export default function Login() {
  useEffect(() => { document.title = "Sign In — Arthaleads Real Estate CRM"; }, []);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // useGoogleLogin gives a callable function — no hidden-button hack needed
  const triggerGoogle = useGoogleLogin({
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

    // Retry up to 3 times on network errors (Railway cold-start takes ~20-30s)
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
          (isNetworkErr
            ? "Could not reach the server. Check your internet connection and tap Sign In again."
            : "Login failed. Please check your credentials.")
        );
        break;
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-shell flex items-center justify-center p-4 overflow-x-hidden">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div
          className="hidden rounded-[2.25rem] border p-10 lg:flex lg:flex-col lg:justify-between"
          style={{
            borderColor: "var(--app-border)",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 88%, transparent), color-mix(in srgb, var(--app-surface-low) 92%, transparent))",
            boxShadow: "var(--app-shadow)",
          }}
        >
          <div>
            {/* Brand block */}
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

        <div className="w-full max-w-md lg:ml-auto lg:max-w-none min-w-0 flex flex-col">
          {/* Mobile logo/heading — shown only on small screens */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl overflow-hidden shadow-lg">
              <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-app">Welcome to Arthaleads</h1>
            <p className="mt-2 text-sm text-app-soft">Sign in to your premium real estate workspace</p>
          </div>

          <div className="auth-card flex-1">
            {/* Desktop heading inside card */}
            <div className="hidden lg:block mb-6 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl overflow-hidden shadow-lg">
                <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-app">Welcome to Arthaleads</h1>
              <p className="mt-2 text-sm text-app-soft">Sign in to your premium real estate workspace</p>
            </div>
            <div className="mb-6 flex items-center gap-3 rounded-2xl px-4 py-3 stitch-surface-muted">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-semibold text-app">Secure access</p>
                <p className="text-xs text-app-soft">Your dashboard and team activity are protected with role-based access.</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@company.com"
                  required
                  autoComplete="username"
                  name="email"
                />
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
            </form>

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
