// pages/ResetPassword.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import toast from "react-hot-toast";

export default function ResetPassword() {
  useEffect(() => { document.title = "Reset Password — Arthaleads"; }, []);

  const { token }      = useParams();
  const navigate       = useNavigate();
  const { refreshUser } = useAuth();

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [showConf, setShowConf]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [err, setErr]               = useState("");

  // Strength rules
  const rules = [
    { label: "At least 6 characters", ok: password.length >= 6 },
    { label: "Contains a number",     ok: /\d/.test(password) },
    { label: "Passwords match",       ok: password && password === confirm },
  ];
  const allOk = rules.every((r) => r.ok);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!allOk) return setErr("Please meet all the requirements above.");
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      // Store token then refresh auth context (calls /auth/me with new token)
      localStorage.setItem("crm_token", data.token);
      await refreshUser();
      setDone(true);
      toast.success("Password reset! Welcome back.");
      setTimeout(() => navigate("/dashboard"), 1800);
    } catch (e) {
      setErr(e.response?.data?.message || "Something went wrong. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="rounded-[2rem] border p-8 space-y-6"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}>

          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg">
              <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
            </div>
          </div>

          {done ? (
            /* ── Success ── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(34,197,94,0.1)" }}>
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-black text-app mb-2">Password updated!</h2>
                <p className="text-sm text-app-soft">Redirecting you to your dashboard…</p>
              </div>
              <Spinner size="sm" />
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-2xl font-black text-app mb-1">Set new password</h1>
                <p className="text-sm text-app-soft">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {/* New password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-soft uppercase tracking-wide">
                    New password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-app-soft pointer-events-none" />
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      autoFocus
                      className="input w-full pl-10 pr-10"
                      disabled={loading}
                    />
                    <button type="button" tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-app-soft hover:text-app"
                      onClick={() => setShowPwd((v) => !v)}>
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-soft uppercase tracking-wide">
                    Confirm password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-app-soft pointer-events-none" />
                    <input
                      type={showConf ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      className="input w-full pl-10 pr-10"
                      disabled={loading}
                    />
                    <button type="button" tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-app-soft hover:text-app"
                      onClick={() => setShowConf((v) => !v)}>
                      {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Strength checklist — only shows once user starts typing */}
                {password && (
                  <ul className="space-y-1.5 px-1">
                    {rules.map((r) => (
                      <li key={r.label} className="flex items-center gap-2 text-xs">
                        {r.ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          : <XCircle     className="w-3.5 h-3.5 text-app-soft flex-shrink-0" />}
                        <span className={r.ok ? "text-app" : "text-app-soft"}>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {err && (
                  <p className="text-xs font-medium text-red-500 rounded-xl px-3 py-2"
                    style={{ background: "rgba(239,68,68,0.07)" }}>
                    {err}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !allOk}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: "var(--app-primary)" }}
                >
                  {loading ? <Spinner size="sm" /> : "Update Password"}
                </button>
              </form>
            </>
          )}

          <div className="flex justify-center">
            <Link to="/login" className="text-sm text-app-soft hover:text-app transition">
              Back to Sign In
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
