// components/DateRangePicker.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

// What the list offers. The older presets below stay understood (a saved
// filter or a link may still carry one), they just are not listed any more.
const PRESETS = [
  { label: "Today",        value: "today" },
  { label: "Yesterday",    value: "yesterday" },
  { label: "Last 7 days",  value: "last7days" },
  { label: "Last 30 days", value: "last30days" },
  { label: "This week",    value: "thisweek" },
  { label: "Last week",    value: "lastweek" },
  { label: "This month",   value: "thismonth" },
  { label: "Last month",   value: "lastmonth" },
  { label: "This year",    value: "thisyear" },
  { label: "Last year",    value: "lastyear" },
  { label: "All time",     value: "" },
];
const LEGACY_LABELS = {
  todayYesterday: "Today & Yesterday",
  last14days: "Last 14 days",
  last28days: "Last 28 days",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) => !!a && !!b && a.getTime() === b.getTime();
const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtInput = (d) => (d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : "");
// A "YYYY-MM-DD" key as a local calendar day. new Date("YYYY-MM-DD") would be
// read as UTC midnight and can land on the previous day west of Greenwich.
const fromKey = (k) => { const [y, m, d] = String(k).split("-").map(Number); return new Date(y, m - 1, d); };

function toIST(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function parseInputDate(text) {
  const m = String(text).trim().match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})$/);
  if (!m) return null;
  const [mo, da, yr] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(yr, mo - 1, da);
  return d.getFullYear() === yr && d.getMonth() === mo - 1 && d.getDate() === da ? d : null;
}

function presetDates(value) {
  const today = startOfDay(new Date());
  const back = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  switch (value) {
    case "today":          return { start: today, end: today };
    case "yesterday":      return { start: back(1), end: back(1) };
    case "todayYesterday": return { start: back(1), end: today };
    case "last7days":      return { start: back(6), end: today };
    case "last14days":     return { start: back(13), end: today };
    case "last28days":     return { start: back(27), end: today };
    case "last30days":     return { start: back(29), end: today };
    case "thisweek":       return { start: back(today.getDay()), end: today };
    case "lastweek": {
      const s = back(today.getDay() + 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return { start: s, end: e };
    }
    case "thismonth": return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    case "lastmonth": return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 0) };
    case "thisyear":  return { start: new Date(today.getFullYear(), 0, 1), end: today };
    case "lastyear":  return { start: new Date(today.getFullYear() - 1, 0, 1), end: new Date(today.getFullYear() - 1, 11, 31) };
    default:          return { start: null, end: null };
  }
}

const BAND = "color-mix(in srgb, var(--app-primary, #f97316) 13%, transparent)";
const RING = "color-mix(in srgb, var(--app-primary, #f97316) 30%, transparent)";

function CalendarMonth({ year, month, rangeStart, rangeEnd, hoverDate, onDayClick, onDayHover, compact = false }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const lo0 = rangeStart;
  const hi0 = rangeEnd || hoverDate;
  const lo = lo0 && hi0 ? (lo0 <= hi0 ? lo0 : hi0) : null;
  const hi = lo0 && hi0 ? (lo0 <= hi0 ? hi0 : lo0) : null;
  const today = startOfDay(new Date());
  const size = compact ? 32 : 40;

  return (
    <div className="flex-1 min-w-0">
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-app-soft" style={{ height: compact ? 24 : 32, lineHeight: compact ? "24px" : "32px" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} style={{ height: size }} />;
          const isLo = sameDay(d, lo), isHi = sameDay(d, hi);
          const inBand = lo && hi && d >= lo && d <= hi && !sameDay(lo, hi);
          const edge = isLo || isHi;
          const dow = d.getDay();
          let background = "transparent";
          let borderRadius = 0;
          if (inBand) {
            if (isLo) background = `linear-gradient(to right, transparent 50%, ${BAND} 50%)`;
            else if (isHi) background = `linear-gradient(to left, transparent 50%, ${BAND} 50%)`;
            else {
              background = BAND;
              if (dow === 0 || d.getDate() === 1) borderRadius = "9999px 0 0 9999px";
              if (dow === 6 || d.getDate() === daysInMonth) borderRadius = dow === 0 || d.getDate() === 1 ? 9999 : "0 9999px 9999px 0";
            }
          }
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.getDate()}
              type="button"
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
              className="relative w-full text-sm font-medium"
              style={{ height: size, background, borderRadius }}
            >
              <span
                className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center rounded-full transition-colors"
                style={{
                  width: size - 2, height: size - 2, transform: "translate(-50%, -50%)",
                  background: edge ? "var(--app-primary, #f97316)" : "transparent",
                  color: edge ? "#fff" : "var(--app-text)",
                  boxShadow: isLo ? `0 0 0 3px ${RING}` : "none",
                  fontWeight: edge || inBand ? 600 : 500,
                }}
                onMouseEnter={(e) => { if (!edge) e.currentTarget.style.background = "var(--app-surface-low)"; }}
                onMouseLeave={(e) => { if (!edge) e.currentTarget.style.background = "transparent"; }}
              >
                {d.getDate()}
                {isToday && (
                  <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: compact ? 3 : 5, background: edge ? "#fff" : "var(--app-primary, #f97316)" }} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ value, onChange, label, compact = false, triggerClassName = "", triggerStyle = null }) {
  const today = startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(value);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [picking, setPicking] = useState(false);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileShowCalendar, setMobileShowCalendar] = useState(false);
  // The left calendar; the right one is always the month after it.
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() - 1 });

  const ref = useRef(null);
  const btnRef = useRef(null);
  const popoverRef = useRef(null);

  const isCustomObj = value && typeof value === "object" && value.preset === "custom";
  const selectedLabel = isCustomObj
    ? "Custom Range"
    : (PRESETS.find((p) => p.value === value)?.label || LEGACY_LABELS[value] || "Date Range");

  const normView = (y, m) => ({ year: y + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  const shift = (dir) => setView((v) => normView(v.year, v.month + dir));
  const right = normView(view.year, view.month + 1);

  const setRange = (s, e) => {
    setRangeStart(s); setRangeEnd(e);
    setStartText(fmtInput(s)); setEndText(fmtInput(e));
  };

  // Show the range that is currently selected when the popover opens or a
  // preset is chosen.
  useEffect(() => {
    if (!open) return;
    if (pending === "custom") return;
    const dates = presetDates(pending);
    setRange(dates.start, dates.end);
  }, [open, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e) => {
      if (!ref.current?.contains(e.target) && !popoverRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleDayClick = (d) => {
    if (!picking) {
      setRange(d, null); setPicking(true); setPending("custom");
    } else {
      const s = rangeStart;
      setRange(d < s ? d : s, d < s ? s : d);
      setPicking(false); setPending("custom");
    }
  };

  // Typing a date: applies as soon as it reads as a real date, and keeps start
  // before end.
  const commitText = (which, text) => {
    const d = parseInputDate(text);
    if (!d) { setStartText(fmtInput(rangeStart)); setEndText(fmtInput(rangeEnd)); return; }
    let s = which === "start" ? d : rangeStart;
    let e = which === "end" ? d : rangeEnd;
    if (s && e && s > e) [s, e] = [e, s];
    setRange(s, e || s); setPicking(false); setPending("custom");
    setView(normView(s.getFullYear(), s.getMonth()));
  };

  const handleApply = () => {
    if (pending === "custom" && rangeStart) {
      onChange({ preset: "custom", from: fmtKey(rangeStart), to: fmtKey(rangeEnd || rangeStart) });
    } else {
      onChange(pending);
    }
    setOpen(false);
  };

  const displayDates = isCustomObj
    ? { start: value.from ? fromKey(value.from) : null, end: value.to ? fromKey(value.to) : null }
    : presetDates(value);

  const WIDTH = 760;
  const openPicker = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile) {
        setPopoverPos({ top: Math.max(Math.min(rect.bottom + 8, window.innerHeight - 320), 8), left: 8 });
        setMobileShowCalendar(isCustomObj);
      } else {
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - WIDTH - 12));
        setPopoverPos({ top: rect.bottom + 8, left });
      }
    }
    const next = isCustomObj ? "custom" : value;
    setPending(next);
    if (isCustomObj && value.from) {
      const s = fromKey(value.from), e = value.to ? fromKey(value.to) : fromKey(value.from);
      setRange(s, e);
      setView(normView(s.getFullYear(), s.getMonth()));
    }
    setPicking(false);
    setOpen((o) => !o);
  };

  const pickPreset = (p) => {
    setPending(p.value);
    setPicking(false);
    const d = presetDates(p.value);
    setRange(d.start, d.end);
    // Bring a range that is out of view into view; otherwise leave the
    // calendar where the person left it.
    if (d.start && (d.start < new Date(view.year, view.month, 1) || d.start > new Date(right.year, right.month + 1, 0))) {
      setView(normView(d.start.getFullYear(), d.start.getMonth()));
    }
  };

  const inputStyle = {
    width: 128, padding: "9px 12px", borderRadius: 10, fontSize: 14, textAlign: "center",
    background: "var(--app-surface-solid)", border: "1px solid var(--app-border-strong, var(--app-border))", color: "var(--app-text)",
  };

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={openPicker}
        className={`stitch-pill flex items-center gap-2 whitespace-nowrap ${triggerClassName}`}
        style={triggerStyle || undefined}
      >
        <CalendarDays className="h-4 w-4 text-orange-500" />
        <span className={compact ? "hidden sm:inline" : ""}>{label || selectedLabel}</span>
        {!compact && displayDates.start && displayDates.end && (
          <span className="text-[10px] opacity-60 hidden sm:inline">
            {toIST(displayDates.start)} – {toIST(displayDates.end)}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] overflow-hidden"
          style={{
            top: popoverPos.top,
            ...(isMobile ? { left: popoverPos.left, right: 8, maxWidth: 340, margin: "0 auto" } : { left: popoverPos.left, width: WIDTH }),
            borderRadius: 18,
            background: "var(--app-surface-solid)",
            border: "1px solid var(--app-border)",
            boxShadow: "var(--app-shadow-lg)",
            maxHeight: isMobile ? "75vh" : "85vh",
            overflowY: "auto",
          }}
        >
          {isMobile ? (
            <div className="flex flex-col">
              {!mobileShowCalendar ? (
                <div className="p-2">
                  <div className="grid grid-cols-2 gap-0.5">
                    {PRESETS.map((p) => {
                      const active = p.value === value;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => { onChange(p.value); setOpen(false); }}
                          className="text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
                          style={{ background: active ? "var(--app-primary)" : "transparent", color: active ? "#fff" : "var(--app-text)" }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 pt-1 border-t" style={{ borderColor: "var(--app-border)" }}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold"
                      style={{ color: "var(--app-primary)" }}
                      onClick={() => { setPending("custom"); setRange(null, null); setPicking(false); setMobileShowCalendar(true); }}
                    >
                      Custom date range
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--app-border)" }}>
                    <button type="button" onClick={() => setMobileShowCalendar(false)} className="btn-ghost p-1"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-sm font-semibold text-app">Custom date range</span>
                  </div>
                  <div className="px-3 pt-3 pb-1">
                    <div className="flex items-center justify-between mb-2">
                      <button type="button" onClick={() => setView((v) => normView(v.year, v.month - 1))} className="btn-ghost p-1"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="text-sm font-semibold text-app">{MONTHS[right.month]} {right.year}</span>
                      <button type="button" onClick={() => setView((v) => normView(v.year, v.month + 1))} className="btn-ghost p-1"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <CalendarMonth
                      year={right.year} month={right.month}
                      rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate}
                      onDayClick={handleDayClick} onDayHover={setHoverDate} compact
                    />
                  </div>
                  <div className="border-t px-3 py-2 flex items-center justify-between gap-2" style={{ borderColor: "var(--app-border)" }}>
                    <p className="text-[11px] text-app-soft truncate flex-1">
                      {rangeStart ? `${toIST(rangeStart)}${rangeEnd ? ` – ${toIST(rangeEnd)}` : ""}` : "Tap a start date"}
                    </p>
                    <div className="flex gap-1.5 shrink-0">
                      <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                      <button type="button" onClick={handleApply} className="btn-primary px-3 py-1.5 text-xs">Apply</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex">
              {/* Presets */}
              <div className="flex flex-col justify-between shrink-0 py-3" style={{ width: 168, borderRight: "1px solid var(--app-border)" }}>
                <div>
                  {PRESETS.map((p) => {
                    const active = pending === p.value && pending !== "custom";
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => pickPreset(p)}
                        className="block w-full text-left px-5 py-2 text-sm transition-colors"
                        style={{
                          color: active ? "var(--app-primary)" : "var(--app-text)",
                          fontWeight: active ? 600 : 500,
                          background: active ? "color-mix(in srgb, var(--app-primary, #f97316) 10%, transparent)" : "transparent",
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--app-surface-low)"; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <p className="px-5 pt-3 text-[11px] text-app-soft">Dates are in Kolkata time (IST)</p>
              </div>

              {/* Calendar */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex gap-0 p-5 pb-4" style={{ minHeight: 0 }}>
                  <div className="flex-1 min-w-0 pr-5">
                    <div className="flex items-center justify-between mb-3">
                      <button type="button" onClick={() => shift(-1)} className="btn-ghost p-1.5" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="text-sm font-semibold text-app">{MONTHS[view.month]} {view.year}</span>
                      <span className="w-7" />
                    </div>
                    <CalendarMonth year={view.year} month={view.month} rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
                  </div>
                  <div className="self-stretch" style={{ width: 1, background: "var(--app-border)" }} />
                  <div className="flex-1 min-w-0 pl-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="w-7" />
                      <span className="text-sm font-semibold text-app">{MONTHS[right.month]} {right.year}</span>
                      <button type="button" onClick={() => shift(1)} className="btn-ghost p-1.5" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <CalendarMonth year={right.year} month={right.month} rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: "1px solid var(--app-border)" }}>
                  <div className="flex items-center gap-2.5">
                    <input
                      value={startText} placeholder="M/D/YYYY" inputMode="numeric" aria-label="Start date" style={inputStyle}
                      onChange={(e) => setStartText(e.target.value)}
                      onBlur={(e) => commitText("start", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitText("start", e.currentTarget.value); }}
                    />
                    <span className="text-app-soft">–</span>
                    <input
                      value={endText} placeholder="M/D/YYYY" inputMode="numeric" aria-label="End date" style={inputStyle}
                      onChange={(e) => setEndText(e.target.value)}
                      onBlur={(e) => commitText("end", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitText("end", e.currentTarget.value); }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                    <button type="button" onClick={handleApply} className="btn-primary px-5 py-2 text-sm">Apply</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
