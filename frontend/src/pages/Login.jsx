import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Spinner } from "../components/UI";
import toast from "react-hot-toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
      navigate("/");
    } catch (e) {
      setErr(
        e.response?.data?.message ||
        (e.request ? "Backend is not reachable. Run the CRM launcher and try again." : "Login failed")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center p-4">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className="hidden rounded-[2.25rem] border p-10 lg:flex lg:flex-col lg:justify-between"
          style={{
            borderColor: "var(--app-border)",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 88%, transparent), color-mix(in srgb, var(--app-surface-low) 92%, transparent))",
            boxShadow: "var(--app-shadow)",
          }}
        >
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a04100] to-[#ff6b00] shadow-lg">
              <Building2 className="h-7 w-7 text-white" />
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

        <div className="w-full max-w-md lg:ml-auto lg:max-w-none">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a04100] to-[#ff6b00] shadow-lg">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-app">Welcome to PropCRM</h1>
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

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
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

            <p className="mt-6 text-center text-sm text-app-soft">
              Don't have an account? <Link to="/signup" className="font-semibold text-orange-500 hover:underline">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
