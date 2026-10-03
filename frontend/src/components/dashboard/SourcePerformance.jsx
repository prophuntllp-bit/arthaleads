import { sourceSlot } from "./SourceDonut";
import { InfoTip } from "../Tooltip";

// Which source brings leads that actually go somewhere, for the selected
// range. The donut answers "how many from where"; this answers "and are they
// any good". Rows open the Leads page filtered to that source.
function Pct({ part, whole }) {
  if (!whole) return <span className="text-app-soft">-</span>;
  const pct = Math.round((part / whole) * 100);
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full sm:inline-block" style={{ background: "var(--app-surface-low)" }}>
        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-9 text-right tabular-nums">{pct}%</span>
    </span>
  );
}

export default function SourcePerformance({ rows = [], scope = "", onSelect }) {
  if (!rows.length) return null;
  const totals = rows.reduce((t, r) => ({
    leads: t.leads + r.leads, contacted: t.contacted + r.contacted, visits: t.visits + r.visits, won: t.won + r.won,
  }), { leads: 0, contacted: 0, visits: 0, won: 0 });

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="shrink-0">
          <p className="stitch-kicker mb-0.5">Source quality</p>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-app">
            Sources this period
            <InfoTip text="Which source brings leads that go somewhere, not just the most leads. Click a source to see its leads." />
          </h3>
        </div>
        {scope && <span className="stitch-pill min-w-0 max-w-[60%] truncate text-xs">{scope}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-app-soft">
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 text-right font-semibold">Leads</th>
              <th className="py-2 pr-3 text-right font-semibold">Contacted</th>
              <th className="py-2 pr-3 text-right font-semibold">Site visits</th>
              <th className="py-2 text-right font-semibold">Closed won</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} onClick={() => onSelect?.(r.source)}
                className={`border-t border-[color:var(--app-border)] ${onSelect ? "cursor-pointer hover:bg-[color:var(--app-surface-low)]" : ""}`}>
                <td className="py-2.5 pr-3">
                  <span className="inline-flex items-center gap-2 text-app">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--src-${sourceSlot(r.source)})` }} />
                    {r.source}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-app">{r.leads}</td>
                <td className="py-2.5 pr-3 text-right text-app"><Pct part={r.contacted} whole={r.leads} /></td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-app">{r.visits || <span className="text-app-soft">0</span>}</td>
                <td className="py-2.5 text-right tabular-nums text-app">{r.won || <span className="text-app-soft">0</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[color:var(--app-border)] font-semibold text-app">
              <td className="py-2.5 pr-3">All sources</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{totals.leads}</td>
              <td className="py-2.5 pr-3 text-right"><Pct part={totals.contacted} whole={totals.leads} /></td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{totals.visits}</td>
              <td className="py-2.5 text-right tabular-nums">{totals.won}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-app-soft">
        Contacted: moved past New. Site visits: reached the Site Visit stage or later, or has a visit date.
      </p>
    </section>
  );
}
