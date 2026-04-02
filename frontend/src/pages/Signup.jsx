import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Building2, BadgePlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/UI";

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "agent"
  });

  const setValue = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signup(form);
      toast.success("Account created");
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center p-4">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[0.98fr_1.02fr]">
        <div className="hidden rounded-[2.25rem] border p-10 lg:flex lg:flex-col lg:justify-between"
          style={{ borderColor: "var(--app-border)", background: "linear-gradient(145deg, color-mix(in srgb, var(--app-surface) 88%, transparent), color-mix(in srgb, var(--app-surface-low) 92%, transparent))", boxShadow: "var(--app-shadow)" }}>
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a04100] to-[#ff6b00] shadow-lg">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <p className="stitch-kicker mb-3">Team Onboarding</p>
            <h1 className="max-w-md text-5xl font-black leading-[1.02] tracking-tight text-app">
              Bring your sales team into one elegant workflow.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-app-soft">
              Create accounts for admins, managers, and agents with the same premium dark interface your sales team will use every day.
            </p>
          </div>

          <div className="space-y-4">
            {[
              "Role-based CRM access",
              "Lead assignment and pipeline visibility",
              "Shared notes, follow-ups, and analytics",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-[1.35rem] p-4 stitch-surface-muted">
                <BadgePlus className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-app">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-2xl lg:ml-auto lg:max-w-none">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a04100] to-[#ff6b00] shadow-lg">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-app">Create your account</h1>
            <p className="mt-2 text-sm text-app-soft">Start managing real estate leads with your team.</p>
          </div>

          <div className="auth-card">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label">Name</label>
                <input className="input" value={form.name} onChange={setValue("name")} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={setValue("email")} required />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={setValue("phone")} />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={form.password} onChange={setValue("password")} required />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="select" value={form.role} onChange={setValue("role")}>
                  <option value="agent">Sales Agent</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {error && (
                <div className="md:col-span-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="md:col-span-2">
                <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : "Create Account"}
                </button>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-app-soft">
              Already have an account? <Link to="/login" className="font-semibold text-orange-500 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
