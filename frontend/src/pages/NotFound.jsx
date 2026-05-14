import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function NotFound() {
  useEffect(() => { document.title = "404 — Page Not Found · Arthaleads"; }, []);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--app-bg)" }}
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #ff6b00 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, #ff6b00 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-md text-center">
        {/* Icon badge */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{
            background: "rgba(255,107,0,0.08)",
            border: "1px solid rgba(255,107,0,0.18)",
            boxShadow: "0 0 32px rgba(255,107,0,0.08)",
          }}>
          <Compass className="h-9 w-9 text-orange-500" />
        </div>

        {/* 404 number */}
        <p
          className="mb-2 text-[88px] font-black leading-none tracking-tighter"
          style={{
            background: "linear-gradient(135deg, var(--app-text) 30%, rgba(255,107,0,0.6) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          404
        </p>

        {/* Heading & description */}
        <h1 className="mb-3 text-2xl font-bold text-app">Page not found</h1>
        <p className="mb-8 text-sm leading-relaxed text-app-soft">
          The page you're looking for doesn't exist, was moved, or you may not have
          permission to view it.
        </p>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
          <Link
            to={user ? "/dashboard" : "/"}
            className="btn-primary inline-flex items-center gap-2"
          >
            {user ? "Back to Dashboard" : "Go to Home"}
          </Link>
        </div>

        {/* Subtle help text */}
        <p className="mt-10 text-xs text-app-soft">
          Still lost?{" "}
          <a href="mailto:contact@arthaleads.com" className="text-orange-500 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
