import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Spinner } from "../components/UI";
import toast from "react-hot-toast";
import { GoogleLogin } from "@react-oauth/google";

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

  const handleGoogleSuccess = async (credentialResponse) => {
    setErr("");
    setGLoading(true);
    try {
      await googleLogin(credentialResponse.credential);
      toast.success("Welcome back!");
      navigate("/");
    } catch (e) {
      setErr(e.response?.data?.message || "Google sign-in failed. Please try again.");
    } finally {
      setGLoading(false);
    }
  };

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
        navigate("/");
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
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className="hidden rounded-[2.25rem] border p-10 lg:flex lg:flex-col lg:items-center lg:justify-center"
          style={{
            borderColor: "var(--app-border)",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 88%, transparent), color-mix(in srgb, var(--app-surface-low) 92%, transparent))",
            boxShadow: "var(--app-shadow)",
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 h-24 w-24 rounded-3xl overflow-hidden shadow-2xl">
              <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-app mb-2">Arthaleads</h1>
            <p className="stitch-kicker mb-6">Premium Real Estate CRM</p>
            <p className="max-w-xs text-sm leading-6 text-app-soft text-center">
              Manage every property lead in one premium workspace. Facebook ads, Google campaigns, WhatsApp enquiries, and team follow-ups — all in one place.
            </p>
          </div>
        </div>

        <div className="w-full max-w-md lg:ml-auto lg:max-w-none min-w-0">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl overflow-hidden shadow-lg">
              <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-app">Welcome to Arthaleads</h1>
            <p className="mt-2 text-sm text-app-soft">Sign in to your premium real estate workspace</p>
          </div>

          <div className="auth-card">
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

            <div className="flex justify-center overflow-hidden w-full">
              {gLoading ? (
                <div className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border text-sm text-app-soft" style={{ borderColor: "var(--app-border)" }}>
                  <Spinner size="sm" /> Signing in with Google…
                </div>
              ) : (
                <div className="w-full overflow-hidden">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setErr("Google sign-in failed. Please try again.")}
                    theme="filled_black"
                    shape="rectangular"
                    size="large"
                    text="signin_with"
                  />
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-app-soft">
              Don't have an account? <Link to="/signup" className="font-semibold text-orange-500 hover:underline">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
