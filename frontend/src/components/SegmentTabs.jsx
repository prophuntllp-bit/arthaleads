// SegmentTabs.jsx — the CRM's tab strip, taken from the Leads status tabs
// (components/leads/LeadFilters.jsx, owner's reference, 27 Oct 2026): a
// bordered strip, the selected tab raised by one highlight that slides to it,
// and an optional count chip on each tab. Use this for every new tab bar.
//
//   <SegmentTabs ariaLabel="Section" value={tab} onChange={setTab}
//     tabs={[{ value: "all", label: "All", count: 8 }, ...]} />
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function SegmentTabs({ tabs, value, onChange, ariaLabel, fullWidth = false }) {
  const stripRef = useRef(null);
  const tabRefs = useRef({});
  const [pill, setPill] = useState(null); // { left, width }
  const [pillReady, setPillReady] = useState(false); // no slide on first paint

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[value];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && stripRef.current) ro.observe(stripRef.current);
    return () => ro?.disconnect();
  }, [value, tabs]);
  useEffect(() => { const t = setTimeout(() => setPillReady(true), 50); return () => clearTimeout(t); }, []);

  return (
    <div className={`overflow-x-auto ${fullWidth ? "w-full" : "max-w-full"}`} style={{ scrollbarWidth: "none" }}>
      <div ref={stripRef} role="tablist" aria-label={ariaLabel} className={`relative flex min-w-max gap-1 rounded-xl p-1 ${fullWidth ? "w-full" : "w-max"}`}
        style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-low)" }}>
        {pill && (
          <span aria-hidden="true" className={`tab-pill pointer-events-none absolute bottom-1 top-1 rounded-lg ${pillReady ? "tab-pill-animate" : ""}`}
            style={{ left: pill.left, width: pill.width, background: "var(--app-surface-solid)",
              boxShadow: "0 0 0 1px rgba(var(--app-primary-rgb),0.45), 0 1px 2px rgba(16,24,40,0.06)" }} />
        )}
        {tabs.map((t) => {
          const on = value === t.value;
          return (
            <button key={t.value} ref={(el) => { tabRefs.current[t.value] = el; }} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.value)}
              className={`relative z-[1] inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${on ? "" : "hover:text-app"}`}
              style={{ color: on ? "var(--app-text)" : "var(--app-text-soft)" }}>
              {t.label}
              {t.count != null && (
                <span className="rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums transition-colors duration-200"
                  style={on
                    ? { border: "1px solid rgba(var(--app-primary-rgb),0.4)", color: "var(--app-primary)", background: "rgba(var(--app-primary-rgb),0.06)" }
                    : { border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }}>
                  {Number(t.count).toLocaleString("en-IN")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
