import { Component } from "react";
import { TriangleAlert, RefreshCw } from "lucide-react";

// ── ErrorBoundary ─────────────────────────────────────────────────────────────
// Catches any unhandled React render errors (equivalent of a 500 page).
// Must be a class component — React only supports componentDidCatch in classes.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in dev; swap for Sentry / LogRocket in production
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/dashboard";
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;
    const message = this.state.error?.message;

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "var(--app-bg)" }}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.06]"
            style={{ background: "radial-gradient(circle, #ef4444 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative w-full max-w-md text-center">
          {/* Icon badge */}
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
              boxShadow: "0 0 32px rgba(239,68,68,0.08)",
            }}
          >
            <TriangleAlert className="h-9 w-9 text-red-400" />
          </div>

          {/* Code */}
          <p
            className="mb-2 text-[88px] font-black leading-none tracking-tighter"
            style={{
              background: "linear-gradient(135deg, var(--app-text) 30%, rgba(239,68,68,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            500
          </p>

          <h1 className="mb-3 text-2xl font-bold text-app">Something went wrong</h1>
          <p className="mb-8 text-sm leading-relaxed text-app-soft">
            An unexpected error occurred in the app. Our team has been notified.
            Try reloading — if the problem persists, contact support.
          </p>

          {/* Dev-only error details */}
          {isDev && message && (
            <div
              className="mb-6 rounded-2xl p-4 text-left"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-red-400">
                Error (dev only)
              </p>
              <p className="break-words font-mono text-xs text-red-300">{message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={this.handleReload}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reload page
            </button>
            <button
              onClick={this.handleReset}
              className="btn-primary inline-flex items-center gap-2"
            >
              Back to Dashboard
            </button>
          </div>

          <p className="mt-10 text-xs text-app-soft">
            Need help?{" "}
            <a href="mailto:hello@arthaleads.com" className="text-orange-500 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    );
  }
}
