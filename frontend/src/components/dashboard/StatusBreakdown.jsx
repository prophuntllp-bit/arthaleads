import { InfoTip } from "../Tooltip";

// Leads by Status for the selected range, one row per pipeline stage in
// pipeline order. Replaces both the old recharts bar chart (which dropped
// labels and left a tall empty card) and the separate "Pipeline Drop-off"
// card, which showed the same numbers a second time.
const STAGES = [
  { key: "New",         color: "#6366f1" },
  { key: "Contacted",   color: "#f59e0b" },
  { key: "Site Visit",  color: "#8b5cf6" },
  { key: "Negotiation", color: "#f97316" },
  { key: "Closed Won",  color: "#22c55e" },
  { key: "Closed Lost", color: "#ef4444" },
];

export default function StatusBreakdown({ byStatus, scope = "", onSelect }) {
  const total = STAGES.reduce((s, st) => s + (byStatus?.[st.key] || 0), 0);
  const max = Math.max(1, ...STAGES.map((st) => byStatus?.[st.key] || 0));

  return (
    <section className="card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="shrink-0">
          <p className="stitch-kicker mb-0.5">Pipeline</p>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-app">
            Leads by Status
            <InfoTip text="Where the leads from these dates are in your pipeline right now. Click a stage to see those leads." />
          </h3>
        </div>
        <span className="stitch-pill min-w-0 max-w-[60%] truncate text-xs">{total} leads{scope ? ` · ${scope}` : ""}</span>
      </div>

      {!total ? (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-app-soft">No leads in this period</p>
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-1">
          {STAGES.map(({ key, color }) => {
            const count = byStatus?.[key] || 0;
            const pct = Math.round((count / total) * 100);
            const width = count ? Math.max((count / max) * 100, 2) : 0;
            return (
              <li key={key}>
                <button type="button" onClick={() => onSelect && count && onSelect(key)} disabled={!onSelect || !count}
                  className="grid w-full grid-cols-[88px_minmax(0,1fr)_40px_40px] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition enabled:hover:bg-[color:var(--app-surface-low)] disabled:cursor-default">
                  <span className={`truncate text-xs ${count ? "text-app" : "text-app-soft"}`}>{key}</span>
                  <span className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--app-surface-low)" }}>
                    {count > 0 && (
                      <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${width}%`, background: color }} />
                    )}
                  </span>
                  <span className={`text-right text-sm font-semibold tabular-nums ${count ? "text-app" : "text-app-soft"}`}>{count}</span>
                  <span className="text-right text-xs tabular-nums text-app-soft">{pct}%</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
