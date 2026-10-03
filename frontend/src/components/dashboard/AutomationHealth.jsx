import { useState } from "react";
import { InfoTip } from "../Tooltip";
import { AlertTriangle } from "lucide-react";
import { connectionTitle, hostOf } from "../ConnectionCard";

// Is every lead source actually sending leads? A connection can look
// "connected" for days while nothing arrives (the website form that silently
// dropped every lead did exactly that), so each one shows when its last lead
// came in, and goes amber after a day of silence.
const QUIET_HOURS = 24;

function ago(date) {
  if (!date) return null;
  const min = (Date.now() - new Date(date).getTime()) / 60000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.floor(min)} min ago`;
  if (min < 1440) return `${Math.floor(min / 60)} hr ago`;
  const d = Math.floor(min / 1440);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function Icon({ item, Logo }) {
  const [failed, setFailed] = useState(false);
  const host = item.platform === "Website Form" && item.siteUrl ? hostOf(item.siteUrl) : "";
  if (host && !failed) {
    return <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" width={20} height={20}
      className="h-5 w-5 rounded object-contain" onError={() => setFailed(true)} />;
  }
  return <Logo platform={item.platform} size={18} />;
}

export default function AutomationHealth({ automations, Logo, onOpen }) {
  if (!automations || automations.length === 0) return null;

  const rows = automations.map((a) => {
    const hrs = a.lastSyncAt ? (Date.now() - new Date(a.lastSyncAt).getTime()) / 3600000 : null;
    const state = a.isActive === false || a.status === "paused" || a.status === "error" ? "off"
      : a.status !== "connected" ? "setup"
      : hrs === null ? "never" : hrs > QUIET_HOURS ? "quiet" : "ok";
    return { a, state, title: connectionTitle(a) };
  });
  // Problems first, so the thing to fix is at the top.
  const rank = { off: 0, quiet: 1, never: 2, setup: 3, ok: 4 };
  rows.sort((x, y) => rank[x.state] - rank[y.state]);
  const problems = rows.filter((r) => r.state === "off" || r.state === "quiet").length;

  const tone = {
    ok:    { dot: "#22c55e", text: "text-app-soft" },
    quiet: { dot: "#f59e0b", text: "text-amber-600 dark:text-amber-400" },
    never: { dot: "#94a3b8", text: "text-app-soft" },
    setup: { dot: "#94a3b8", text: "text-app-soft" },
    off:   { dot: "#ef4444", text: "text-red-500" },
  };

  return (
    <section className="card flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="stitch-kicker mb-1">Integrations</p>
          <h3 className="flex items-center gap-1.5 text-base font-bold text-app">
            Lead Sources Health
            <InfoTip text="Each connected lead source and when its last lead arrived. Amber means no lead for 24 hours, which can mean a connection has broken." />
          </h3>
        </div>
        {problems > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(245,158,11,0.14)", color: "#d97706" }}>
            <AlertTriangle className="h-3 w-3" /> {problems} need a look
          </span>
        ) : (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(34,197,94,0.12)", color: "#16a34a" }}>
            All sending
          </span>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(({ a, state, title }) => (
          <li key={a._id}>
            <button type="button" onClick={onOpen}
              className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition hover:border-orange-500/30"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--app-border)] bg-white">
                <Icon item={a} Logo={Logo} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-app">{title}</span>
                <span className={`block truncate text-[11px] ${tone[state].text}`}>
                  {state === "off" ? (a.status === "paused" ? "Paused" : "Turned off")
                    : state === "setup" ? "Not set up yet"
                    : state === "never" ? "No leads yet"
                    : `Last lead ${ago(a.lastSyncAt)}`}
                </span>
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone[state].dot }} title={state} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-app-soft">Amber: no lead in the last {QUIET_HOURS} hours.</p>
    </section>
  );
}
