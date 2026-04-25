import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/UI";
import { GoogleLogin } from "@react-oauth/google";

export default function Signup() {
  const navigate = useNavigate();
  const { signup, googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    orgName: "",
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setGLoading(true);
    try {
      await googleLogin(credentialResponse.credential);
      toast.success("Account ready! Welcome to Arthaleads.");
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.message || "Google sign-up failed. Please try again.");
    } finally {
      setGLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signup(form);
      toast.success("Account created! Welcome to Arthaleads.");
      navigate("/");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.request
          ? "Could not reach the server. Please check your connection and try again."
          : "Something went wrong. Please try again.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2 lg:items-stretch">

        {/* ── Left panel — desktop only ── */}
        <div
          className="hidden rounded-[2rem] border p-10 lg:flex lg:flex-col lg:justify-between"
          style={{
            borderColor: "var(--app-border)",
            background: "linear-gradient(145deg, color-mix(in srgb, var(--app-surface) 88%, transparent), color-mix(in srgb, var(--app-surface-low) 92%, transparent))",
            boxShadow: "var(--app-shadow)",
          }}
        >
          <div>
            {/* Logo */}
            <div className="mb-7 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                <img src="/logo.png" alt="ArthaLeads" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="font-black text-lg leading-none tracking-tight">
                  <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
                </p>
                <p className="text-[9px] font-semibold tracking-[0.15em] text-app-soft uppercase mt-0.5">
                  Turning Opportunities Into Value
                </p>
              </div>
            </div>

            <p className="stitch-kicker mb-3">Team Onboarding</p>
            <h2 className="max-w-sm text-4xl font-black leading-[1.05] tracking-tight text-app">
              Join your real estate team on Arthaleads.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-app-soft">
              Create your account to start managing leads, tracking follow-ups, and closing deals with your team.
            </p>
          </div>

          <div className="space-y-3 mt-10">
            {[
              "Access your leads and pipeline instantly",
              "Get notified on follow-ups and site visits",
              "Collaborate with your team in real time",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-[1.35rem] p-4 stitch-surface-muted">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-500" />
                <span className="text-sm text-app">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel — form ── */}
        <div className="flex flex-col w-full">
          {/* Mobile logo header */}
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg mb-3">
              <img src="/logo.png" alt="ArthaLeads" className="w-full h-full object-cover" />
            </div>
            <p className="font-black text-xl leading-none tracking-tight">
              <span style={{ color: "#FF6B00" }}>Artha</span><span className="text-app">Leads</span>
            </p>
          </div>

          {/* Desktop heading above card */}
          <div className="hidden lg:block mb-6 text-center">
            <h1 className="text-2xl font-black tracking-tight text-app">Create your account</h1>
            <p className="mt-1 text-sm text-app-soft">Start managing real estate leads with your team.</p>
          </div>

          {/* Mobile heading */}
          <div className="mb-5 text-center lg:hidden">
            <h1 className="text-2xl font-black tracking-tight text-app">Create your account</h1>
            <p className="mt-1 text-sm text-app-soft">Start managing real estate leads with your team.</p>
          </div>

          <div className="auth-card flex-1">
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">

              <div>
                <label className="label">Company / Organization Name</label>
                <input
                  className="input"
                  value={form.orgName}
                  onChange={set("orgName")}
                  placeholder="Your company or organization name"
                  autoComplete="organization"
                  required
                  minLength={2}
                />
              </div>

              <div>
                <label className="label">Your Full Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>

              <div>
                <label className="label">Work Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="your@email.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="label">
                  Phone <span className="text-app-soft font-normal">(optional)</span>
                </label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                />
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
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app transition"
                    onClick={() => setShowPwd((v) => !v)}
                  >
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
                className="btn-primary w-full justify-center py-3 mt-2"
                disabled={loading}
              >
                {loading ? (
                  <><Spinner size="sm" /><span>Creating account…</span></>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: "var(--app-border)" }} />
              <span className="text-xs text-app-soft">or sign up with</span>
              <div className="h-px flex-1" style={{ background: "var(--app-border)" }} />
            </div>

            <div className="flex justify-center">
              {gLoading ? (
                <div
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border text-sm text-app-soft"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <Spinner size="sm" /> Signing up with Google…
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-up failed. Please try again.")}
                  theme="filled_black"
                  shape="rectangular"
                  size="large"
                  width="400"
                  text="signup_with"
                />
              )}
            </div>

            <p className="mt-6 text-center text-sm text-app-soft">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-orange-500 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
