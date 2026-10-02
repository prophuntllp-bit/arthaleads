import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

// A tab opened before a deploy keeps running the old code until it is
// reloaded, so a fix can be live for everyone else and still "not work" in a
// tab left open since the morning. Each build writes its id to /version.json
// (see vite.config.js); this checks it now and then, and when a newer build
// is live it offers a one-click refresh instead of leaving people on old code.
const CHECK_EVERY_MS = 5 * 60 * 1000;
const CURRENT = typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : "";

export default function UpdateBanner() {
  const [newer, setNewer] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!CURRENT || import.meta.env.DEV) return undefined;
    let stopped = false;
    const check = async () => {
      if (stopped || document.hidden) return;
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const { build } = await r.json();
        if (build && build !== CURRENT) setNewer(true);
      } catch { /* offline or blocked: try again next time */ }
    };
    const t = setInterval(check, CHECK_EVERY_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    check();
    return () => {
      stopped = true;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  if (!newer || hidden) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[10001] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 shadow-xl"
      style={{ background: "var(--app-surface-solid)", border: "1px solid var(--app-border-strong)" }}>
      <RefreshCw className="h-4 w-4 shrink-0 text-orange-500" />
      <p className="min-w-0 flex-1 text-sm text-app">A new version of ArthaLeads is ready.</p>
      <button type="button" onClick={() => window.location.reload()}
        className="btn-primary shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold">
        Refresh
      </button>
      <button type="button" onClick={() => setHidden(true)} aria-label="Later"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-soft hover:text-app">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
