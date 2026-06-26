// pages/ForgotPassword.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Spinner } from "../components/UI";
import api from "../services/api";

export default function ForgotPassword() {
  useEffect(() => { document.title = "Forgot Password - Arthaleads"; }, []);

  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [err, setErr]       = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!email.trim()) return setErr("Please enter your email address.");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (e) {
      setErr(e.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="rounded-[2rem] border p-8 space-y-6"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}>

          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg">
              <img src="/logo.png" alt="Arthaleads" className="w-full h-full object-cover" />
            </div>
          </div>

          {sent ? (
            /* ── Success state ── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(34,197,94,0.1)" }}>
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-black text-app mb-2">Check your inbox</h2>
                <p className="text-sm text-app-soft leading-relaxed">
                  We've sent a password reset link to <span className="font-semibold text-app">{email}</span>.
                  The link expires in 1 hour.
                </p>
              </div>
              <p className="text-xs text-app-soft">
                Didn't receive it? Check your spam folder or{" "}
                <button
                  className="font-semibold underline underline-offset-2"
                  style={{ color: "var(--app-primary)" }}
                  onClick={() => { setSent(false); setErr(""); }}
                >
                  try again
                </button>.
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="text-center">
                <h1 className="text-2xl font-black text-app mb-1">Forgot password?</h1>
                <p className="text-sm text-app-soft">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-soft uppercase tracking-wide">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-app-soft pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoFocus
                      className="input w-full pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                {err && (
                  <p className="text-xs font-medium text-red-500 rounded-xl px-3 py-2"
                    style={{ background: "rgba(239,68,68,0.07)" }}>
                    {err}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60"
                  style={{ background: "var(--app-primary)" }}
                >
                  {loading ? <Spinner size="sm" /> : "Send Reset Link"}
                </button>
              </form>
            </>
          )}

          {/* Back to login */}
          <div className="flex justify-center pt-1">
            <Link to="/login"
              className="flex items-center gap-1.5 text-sm text-app-soft hover:text-app transition">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
