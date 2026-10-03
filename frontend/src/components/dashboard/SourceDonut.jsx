import { useState } from "react";
import { InfoTip } from "../Tooltip";

// Leads by Source as a donut that always fits its card: drawn in a fixed
// viewBox, so it scales with the container instead of being clipped by it.
//
// Colour follows the source, never its rank, so "WhatsApp" is the same green
// whatever the date range. Five named slots, then everything else folds into
// "Other" (see dataviz rules: a series past the palette is folded, never given
// a generated hue). Colours are CSS tokens (--src-1..6 in styles.css) with
// their own validated dark-mode steps.
const SLOT = { Facebook: 1, Website: 2, WhatsApp: 3, "Vistrow Voice": 4, Google: 5 };
const OTHER = 6;
export function sourceSlot(name) { return SLOT[name] || OTHER; }

function buildRows(bySource) {
  const rows = [];
  const other = { name: "Other", value: 0, slot: OTHER, parts: [] };
  for (const [name, value] of Object.entries(bySource || {})) {
    if (!value) continue;
    if (SLOT[name]) rows.push({ name, value, slot: SLOT[name] });
    else { other.value += value; other.parts.push(`${name || "Unknown"} ${value}`); }
  }
  rows.sort((a, b) => a.slot - b.slot);
  if (other.value) rows.push(other);
  return rows;
}

export default function SourceDonut({ bySource, scope = "", onSelect }) {
  const [active, setActive] = useState(null);
  const rows = buildRows(bySource);
  const total = rows.reduce((s, r) => s + r.value, 0);

  const R = 76, SW = 24, C = 2 * Math.PI * R;
  const GAP = rows.length > 1 ? 2.5 : 0; // surface gap between segments
  let offset = 0;
  const segs = rows.map((r) => {
    const len = (r.value / total) * C;
    const seg = { ...r, dash: Math.max(len - GAP, 0.5), offset };
    offset += len;
    return seg;
  });
  const focus = active ? rows.find((r) => r.name === active) : null;

  return (
    <section className="card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="shrink-0">
          <p className="stitch-kicker mb-0.5">Acquisition mix</p>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-app">
            Leads by Source
            <InfoTip text="Where the leads from these dates came from. Click a source to see its leads." />
          </h3>
        </div>
        {scope && <span className="stitch-pill min-w-0 max-w-[60%] truncate text-xs">{scope}</span>}
      </div>

      {!total ? (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-app-soft">No leads in this period</p>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-[200px] shrink-0">
            <svg viewBox="0 0 200 200" className="block h-auto w-full" role="img"
              aria-label={`Leads by source: ${rows.map((r) => `${r.name} ${r.value}`).join(", ")}`}>
              <circle cx="100" cy="100" r={R} fill="none" stroke="var(--app-surface-low)" strokeWidth={SW} />
              {segs.map((s) => (
                <circle key={s.name} cx="100" cy="100" r={R} fill="none"
                  stroke={`var(--src-${s.slot})`} strokeWidth={active === s.name ? SW + 6 : SW}
                  strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={-s.offset}
                  transform="rotate(-90 100 100)"
                  opacity={active && active !== s.name ? 0.35 : 1}
                  style={{ transition: "opacity .15s, stroke-width .15s", cursor: onSelect ? "pointer" : "default" }}
                  onMouseEnter={() => setActive(s.name)} onMouseLeave={() => setActive(null)}
                  onClick={() => onSelect && s.slot !== OTHER && onSelect(s.name)}>
                  <title>{`${s.name}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
                </circle>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black tabular-nums text-app">{focus ? focus.value : total}</span>
              <span className="max-w-[90px] truncate text-[11px] text-app-soft">{focus ? focus.name : "leads"}</span>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 space-y-1">
            {rows.map((r) => {
              const pct = Math.round((r.value / total) * 100);
              const clickable = onSelect && r.slot !== OTHER;
              return (
                <li key={r.name}>
                  <button type="button" disabled={!clickable}
                    onMouseEnter={() => setActive(r.name)} onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(r.name)} onBlur={() => setActive(null)}
                    onClick={() => clickable && onSelect(r.name)}
                    title={r.parts?.length ? r.parts.join(", ") : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${clickable ? "hover:bg-[color:var(--app-surface-low)]" : "cursor-default"} ${active === r.name ? "bg-[color:var(--app-surface-low)]" : ""}`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--src-${r.slot})` }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-app">{r.name}</span>
                    <span className="text-sm font-semibold tabular-nums text-app">{r.value}</span>
                    <span className="w-10 text-right text-xs tabular-nums text-app-soft">{pct}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
