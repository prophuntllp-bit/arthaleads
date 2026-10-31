// CallAnalytics.jsx — the "Daily calls" chart (last 14 days, answered and
// missed stacked, table view) and "Answered calls by agent", shared by the
// Calls and Performance pages so both show the same thing (owner, 31 Oct 2026).
import { useState } from "react";

/** Seconds as "36s" or "1m 47s". */
export function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Call analytics ────────────────────────────────────────────────────────────
// Answered / missed colours: validated pair (dataviz validator, 26 Oct 2026):
// the usual green #22c55e vs red fails red-green colour blindness. Light
// #1baf7a/#d03b3b, dark #199e70/#d03b3b (vars in styles.css). Stacked with a
// 2px gap, legend and tooltip, so colour is never the only cue.
const IST_DAY = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "numeric", day: "numeric" })
  .formatToParts(date).reduce((o, p) => (p.type === "literal" ? o : { ...o, [p.type]: Number(p.value) }), {});

/** The last 14 days ending today (IST), every day present, zeros where there were no calls. */
function lastFourteenDays(volumeByDay) {
  const byKey = new Map(volumeByDay.map((d) => [`${d._id.y}-${d._id.m}-${d._id.d}`, d]));
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const at = new Date(Date.now() - i * 86400000);
    const { year, month, day } = IST_DAY(at);
    const d = byKey.get(`${year}-${month}-${day}`) || { total: 0, answered: 0, missed: 0 };
    const date = new Date(Date.UTC(year, month - 1, day, 6, 30));
    out.push({
      key: `${year}-${month}-${day}`,
      answered: d.answered || 0,
      missed: d.missed || 0,
      other: Math.max(0, (d.total || 0) - (d.answered || 0) - (d.missed || 0)),
      day: date.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }),
      label: date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }),
      short: date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }),
      today: i === 0,
    });
  }
  return out;
}

/** Clean y-axis: a round top (5, 10, 20, 25, 50, 100...) and four steps. */
function niceScale(max) {
  if (max <= 4) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw);
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => Math.round(i * step * 10) / 10) };
}

function CallVolumeChart({ volumeByDay }) {
  const days = lastFourteenDays(volumeByDay);
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const peak = Math.max(...days.map((d) => d.answered + d.missed), 0);
  const { top, ticks } = niceScale(peak);
  const totals = days.reduce((t, d) => ({ answered: t.answered + d.answered, missed: t.missed + d.missed, all: t.all + d.answered + d.missed + d.other }), { answered: 0, missed: 0, all: 0 });
  const rate = totals.answered + totals.missed ? Math.round((totals.answered / (totals.answered + totals.missed)) * 100) : null;
  const PLOT_H = 168;
  const h = (n) => (n / top) * PLOT_H;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
        <div>
          <p className="text-sm font-bold text-app">Daily calls</p>
          <p className="text-xs text-app-soft mt-0.5">
            Last 14 days · {totals.all.toLocaleString("en-IN")} calls{rate !== null ? ` · ${rate}% answered` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-app-soft">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-answered)" }} /> Answered</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-missed)" }} /> Missed</span>
          <button type="button" onClick={() => setAsTable((v) => !v)} className="font-semibold hover:text-app transition-colors" style={{ color: "var(--app-primary)" }}>
            {asTable ? "Chart" : "Table"}
          </button>
        </div>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-app-soft text-left">
                <th className="py-1.5 pr-3 font-semibold">Day</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Answered</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Missed</th>
                <th className="py-1.5 font-semibold text-right">All calls</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.key} style={{ borderTop: "1px solid var(--app-border)" }}>
                  <td className="py-1.5 pr-3 text-app">{d.label}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-app">{d.answered}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-app">{d.missed}</td>
                  <td className="py-1.5 text-right tabular-nums text-app-soft">{d.answered + d.missed + d.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* y-axis */}
          <div className="relative shrink-0 w-7" style={{ height: PLOT_H }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 text-[10px] tabular-nums text-app-soft leading-none" style={{ bottom: h(t) - 4 }}>{t}</span>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="relative" style={{ height: PLOT_H }} onMouseLeave={() => setHover(null)}>
              {/* gridlines: hairline, recessive */}
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0" style={{ bottom: h(t), height: 1, background: "var(--app-border)" }} />
              ))}
              <div className="absolute inset-0 flex">
                {days.map((d, i) => {
                  const a = h(d.answered), m = h(d.missed);
                  const dim = hover !== null && hover !== i;
                  return (
                    <button key={d.key} type="button"
                      className="relative flex-1 h-full flex flex-col justify-end items-center outline-none focus-visible:bg-[var(--app-surface-low)] rounded-md"
                      aria-label={`${d.label}: ${d.answered} answered, ${d.missed} missed`}
                      onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                      onClick={() => setHover((v) => (v === i ? null : i))}>
                      <div className="flex flex-col items-center w-[min(24px,62%)] transition-opacity" style={{ opacity: dim ? 0.35 : 1 }}>
                        {d.missed > 0 && (
                          <div className="w-full" style={{ height: Math.max(m, 2), background: "var(--viz-missed)", borderRadius: "4px 4px 0 0" }} />
                        )}
                        {d.missed > 0 && d.answered > 0 && <div className="w-full" style={{ height: 2 }} />}
                        {d.answered > 0 && (
                          <div className="w-full" style={{ height: Math.max(a, 2), background: "var(--viz-answered)", borderRadius: d.missed > 0 ? 0 : "4px 4px 0 0" }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {hover !== null && (() => {
                const d = days[hover];
                const left = ((hover + 0.5) / days.length) * 100;
                const total = d.answered + d.missed + d.other;
                return (
                  <div className="pointer-events-none absolute z-10 rounded-xl px-3 py-2 text-xs shadow-lg whitespace-nowrap"
                    // Beside the column at the top of the plot, so it never covers the column.
                    style={{ left: `${left}%`, top: 0, transform: hover >= days.length / 2 ? "translateX(calc(-100% - 18px))" : "translateX(18px)",
                      background: "var(--app-surface-solid, var(--app-surface))", border: "1px solid var(--app-border)" }}>
                    <p className="font-semibold text-app mb-1">{d.label}{d.today ? " (today)" : ""}</p>
                    <p className="flex items-center gap-1.5 text-app-soft"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--viz-answered)" }} /> Answered <b className="ml-auto pl-3 text-app tabular-nums">{d.answered}</b></p>
                    <p className="flex items-center gap-1.5 text-app-soft"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--viz-missed)" }} /> Missed <b className="ml-auto pl-3 text-app tabular-nums">{d.missed}</b></p>
                    {d.other > 0 && <p className="flex items-center gap-1.5 text-app-soft"><span className="h-2 w-2" /> Not connected <b className="ml-auto pl-3 text-app tabular-nums">{d.other}</b></p>}
                    <p className="mt-1 pt-1 text-app-soft flex" style={{ borderTop: "1px solid var(--app-border)" }}>All calls <b className="ml-auto pl-3 text-app tabular-nums">{total}</b></p>
                  </div>
                );
              })()}
            </div>
            {/* x-axis: every day on wide screens, every other day on phones */}
            <div className="flex mt-1.5">
              {days.map((d, i) => (
                <span key={d.key} className={`flex-1 text-center text-[10px] tabular-nums ${d.today ? "font-bold text-app" : "text-app-soft"} ${i % 2 && !d.today ? "hidden sm:block" : ""}`}>
                  {i === 0 || d.day === "1" ? d.short : d.day}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallAnalytics({ data }) {
  if (!data) return null;
  const { volumeByDay = [], durationByAgent = [] } = data;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <CallVolumeChart volumeByDay={volumeByDay} />

      <div className="card p-5">
        <p className="text-sm font-bold text-app">Answered calls by agent</p>
        <p className="text-xs text-app-soft mt-0.5 mb-3">Last 30 days · average talk time</p>
        {durationByAgent.length === 0 ? (
          <p className="text-sm text-app-soft">No answered calls with duration yet.</p>
        ) : durationByAgent.map((a) => (
          <div key={a._id} className="flex items-center justify-between py-2 border-b last:border-0"
            style={{ borderColor: "var(--app-border)" }}>
            <span className="text-sm text-app font-medium truncate pr-3">{a.name || "Unknown"}</span>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-app tabular-nums">{a.totalCalls}</span>
              {a.avgDuration > 0 && (
                <span className="text-xs text-app-soft ml-1.5">{fmtDuration(Math.round(a.avgDuration))} avg</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

