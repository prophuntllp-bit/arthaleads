// components/DateRangePicker.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const PRESETS = [
  { label: "Today",             value: "today" },
  { label: "Yesterday",         value: "yesterday" },
  { label: "Today & Yesterday", value: "todayYesterday" },
  { label: "Last 7 days",       value: "last7days" },
  { label: "Last 14 days",      value: "last14days" },
  { label: "Last 28 days",      value: "last28days" },
  { label: "Last 30 days",      value: "last30days" },
  { label: "This week",         value: "thisweek" },
  { label: "Last week",         value: "lastweek" },
  { label: "This month",        value: "thismonth" },
  { label: "Last month",        value: "lastmonth" },
  { label: "This year",         value: "thisyear" },
  { label: "Maximum",           value: "" },
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toIST(d) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function presetDates(value) {
  const now  = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (value) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { start: y, end: y };
    }
    case "todayYesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { start: y, end: today };
    }
    case "last7days": {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return { start: s, end: today };
    }
    case "last14days": {
      const s = new Date(today); s.setDate(s.getDate() - 13);
      return { start: s, end: today };
    }
    case "last28days": {
      const s = new Date(today); s.setDate(s.getDate() - 27);
      return { start: s, end: today };
    }
    case "last30days": {
      const s = new Date(today); s.setDate(s.getDate() - 29);
      return { start: s, end: today };
    }
    case "thisweek": {
      const s = new Date(today); s.setDate(s.getDate() - s.getDay());
      return { start: s, end: today };
    }
    case "lastweek": {
      const s = new Date(today); s.setDate(s.getDate() - s.getDay() - 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return { start: s, end: e };
    }
    case "thismonth": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: s, end: today };
    }
    case "lastmonth": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: s, end: e };
    }
    case "thisyear": {
      const s = new Date(today.getFullYear(), 0, 1);
      return { start: s, end: today };
    }
    default:
      return { start: null, end: null };
  }
}

function CalendarMonth({ year, month, rangeStart, rangeEnd, hoverDate, onDayClick, onDayHover, hideHeader = false, compact = false }) {
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const inRange = (d) => {
    if (!d) return false;
    const lo = rangeStart && (!rangeEnd || rangeStart <= rangeEnd) ? rangeStart : null;
    const hi = rangeEnd || hoverDate;
    if (!lo || !hi) return false;
    const a = lo < hi ? lo : hi;
    const b = lo < hi ? hi : lo;
    return d >= a && d <= b;
  };

  const isStart = (d) => d && rangeStart && d.getTime() === rangeStart.getTime();
  const isEnd   = (d) => d && rangeEnd   && d.getTime() === rangeEnd.getTime();
  const isToday = (d) => {
    const t = new Date(); t.setHours(0,0,0,0);
    return d && d.getTime() === t.getTime();
  };

  const cellH = compact ? "h-7" : "h-8";

  return (
    <div className="flex-1 min-w-0">
      {!hideHeader && (
        <div className={`${compact ? "mb-2" : "mb-3"} text-center text-sm font-semibold text-app`}>
          {MONTHS[month]} {year}
        </div>
      )}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS.map((d) => (
          <div key={d} className={`${compact ? "py-0.5" : "py-1"} text-center text-[10px] font-bold uppercase text-app-soft`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const start = isStart(d), end = isEnd(d), inR = inRange(d), tod = isToday(d);
          return (
            <button
              key={d.getDate()}
              type="button"
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
              className={`relative ${cellH} w-full text-xs font-medium transition-colors
                ${start || end ? "text-white z-10" : inR ? "text-orange-700" : tod ? "font-bold text-orange-500" : "text-app hover:text-orange-500"}
                ${inR && !start && !end ? "bg-orange-100 dark:bg-orange-500/15 rounded-none" : ""}
                ${start ? "rounded-l-full" : ""} ${end ? "rounded-r-full" : ""}
              `}
            >
              {(start || end) && (
                <span className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-orange-500" style={{ left: "50%", transform: "translateX(-50%)" }} />
              )}
              <span className="relative z-10">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ value, onChange, label }) {
  const [open, setOpen]         = useState(false);
  const [pending, setPending]   = useState(value);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd]     = useState(null);
  const [hoverDate, setHoverDate]   = useState(null);
  const [picking, setPicking]       = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });
  const [isMobile, setIsMobile]     = useState(false);
  const today = new Date(); today.setHours(0,0,0,0);
  const [leftMonth, setLeftMonth] = useState({ year: today.getFullYear(), month: today.getMonth() - 1 < 0 ? 11 : today.getMonth() - 1, adjYear: today.getMonth() - 1 < 0 ? today.getFullYear() - 1 : today.getFullYear() });
  const [rightMonth, setRightMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const ref = useRef(null);
  const btnRef = useRef(null);
  const popoverRef = useRef(null);

  const selectedLabel = PRESETS.find((p) => p.value === value)?.label || "Date Range";

  // Sync calendar display with preset
  useEffect(() => {
    if (!open) return;
    const dates = presetDates(pending);
    if (dates.start) {
      setRangeStart(dates.start);
      setRangeEnd(dates.end);
    }
  }, [open, pending]);

  useEffect(() => {
    const h = (e) => {
      const inBtn     = ref.current?.contains(e.target);
      const inPopover = popoverRef.current?.contains(e.target);
      if (!inBtn && !inPopover) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const shiftLeft = (dir) => {
    setLeftMonth((prev) => {
      let m = prev.month + dir, y = prev.adjYear;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { year: y, month: m, adjYear: y };
    });
    setRightMonth((prev) => {
      let m = prev.month + dir, y = prev.year;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  // Single-month nav for mobile
  const shiftSingle = (dir) => {
    setRightMonth((prev) => {
      let m = prev.month + dir, y = prev.year;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const handleDayClick = (d) => {
    if (!picking) {
      setRangeStart(d); setRangeEnd(null); setPicking(true);
      setPending("custom");
    } else {
      const s = rangeStart;
      setRangeEnd(d < s ? s : d);
      setRangeStart(d < s ? d : s);
      setPicking(false);
      setPending("custom");
    }
  };

  const handleUpdate = () => {
    onChange(pending);
    setOpen(false);
  };

  const displayDates = presetDates(value);

  const openPicker = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile) {
        // Full-width anchored just below the button
        const top = Math.min(rect.bottom + 8, window.innerHeight - 460);
        setPopoverPos({ top: Math.max(top, 8), left: 8, right: 8 });
      } else {
        setPopoverPos({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        });
      }
    }
    setPending(value);
    setOpen((o) => !o);
  };

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={openPicker}
        className="stitch-pill flex items-center gap-2"
      >
        <CalendarDays className="h-4 w-4 text-orange-500" />
        <span>{label || selectedLabel}</span>
        {displayDates.start && displayDates.end && (
          <span className="text-[10px] opacity-60 hidden sm:inline">
            {toIST(displayDates.start)} – {toIST(displayDates.end)}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] rounded-2xl shadow-2xl overflow-hidden"
          style={{
            top: popoverPos.top,
            ...(isMobile
              ? { left: popoverPos.left, right: popoverPos.right, maxWidth: 320, margin: "0 auto" }
              : { right: popoverPos.right, minWidth: 580 }),
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            backdropFilter: "var(--glass-blur-heavy)",
            WebkitBackdropFilter: "var(--glass-blur-heavy)",
            boxShadow: "var(--app-shadow-lg)",
            maxHeight: isMobile ? "70vh" : "80vh",
            overflowY: "auto",
          }}
        >
          {isMobile ? (
            /* ── Mobile layout: compact Zoho-style ── */
            <div className="flex flex-col">
              {/* Preset chips — 2-col grid, compact */}
              <div className="border-b px-3 py-2" style={{ borderColor: "var(--app-border)" }}>
                <div className="grid grid-cols-2 gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        setPending(p.value);
                        const d = presetDates(p.value);
                        setRangeStart(d.start);
                        setRangeEnd(d.end);
                        setPicking(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                        pending === p.value
                          ? "bg-orange-500 text-white"
                          : "text-app-soft hover:text-app hover:bg-orange-500/8"
                      }`}
                      style={pending !== p.value ? { background: "transparent" } : {}}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact calendar */}
              <div className="px-3 pt-2.5 pb-1">
                <div className="flex items-center justify-between mb-2">
                  <button type="button" onClick={() => shiftSingle(-1)} className="btn-ghost p-1">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-bold text-app tracking-wide">
                    {MONTHS[rightMonth.month]} {rightMonth.year}
                  </span>
                  <button type="button" onClick={() => shiftSingle(1)} className="btn-ghost p-1">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <CalendarMonth
                  year={rightMonth.year} month={rightMonth.month}
                  rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate}
                  onDayClick={handleDayClick} onDayHover={setHoverDate}
                  hideHeader compact
                />
              </div>

              {/* Footer */}
              <div className="border-t px-3 py-2.5 flex items-center justify-between gap-2" style={{ borderColor: "var(--app-border)" }}>
                <div className="min-w-0 flex-1">
                  {rangeStart ? (
                    <p className="text-[10px] text-app-soft truncate font-medium">
                      {toIST(rangeStart)}{rangeEnd ? ` → ${toIST(rangeEnd)}` : ""}
                    </p>
                  ) : (
                    <p className="text-[10px] text-app-soft">Tap a start date</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                  <button type="button" onClick={handleUpdate} className="btn-primary px-3 py-1.5 text-xs">Apply</button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Desktop layout: sidebar + dual calendar ── */
            <div className="flex">
              {/* Presets sidebar */}
              <div className="w-44 border-r flex-shrink-0 py-3" style={{ borderColor: "var(--app-border)" }}>
                <p className="stitch-kicker px-4 mb-2">Recently used</p>
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setPending(p.value); const d = presetDates(p.value); setRangeStart(d.start); setRangeEnd(d.end); setPicking(false); }}
                    className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                      pending === p.value ? "text-orange-500 font-semibold" : "text-app-soft hover:text-app"
                    }`}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                      pending === p.value ? "border-orange-500" : "border-app-soft/40"
                    }`}>
                      {pending === p.value && <span className="h-2 w-2 rounded-full bg-orange-500" />}
                    </span>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Calendar panel */}
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-4">
                  <button type="button" onClick={() => shiftLeft(-1)} className="btn-ghost p-1.5">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex gap-8">
                    <span className="text-sm font-semibold text-app">{MONTHS[leftMonth.month]} {leftMonth.adjYear}</span>
                    <span className="text-sm font-semibold text-app">{MONTHS[rightMonth.month]} {rightMonth.year}</span>
                  </div>
                  <button type="button" onClick={() => shiftLeft(1)} className="btn-ghost p-1.5">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-6">
                  <CalendarMonth
                    year={leftMonth.adjYear} month={leftMonth.month}
                    rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate}
                    onDayClick={handleDayClick} onDayHover={setHoverDate}
                  />
                  <div className="w-px self-stretch" style={{ background: "var(--app-border)" }} />
                  <CalendarMonth
                    year={rightMonth.year} month={rightMonth.month}
                    rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate}
                    onDayClick={handleDayClick} onDayHover={setHoverDate}
                  />
                </div>

                <div className="mt-4 border-t pt-3 flex items-center justify-between gap-4" style={{ borderColor: "var(--app-border)" }}>
                  <p className="text-[11px] text-app-soft">Dates shown in Kolkata Time (IST)</p>
                  <div className="flex items-center gap-2">
                    {rangeStart && (
                      <span className="text-xs text-app-soft">
                        {toIST(rangeStart)}{rangeEnd ? ` → ${toIST(rangeEnd)}` : ""}
                      </span>
                    )}
                    <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-4 py-2 text-xs">Cancel</button>
                    <button type="button" onClick={handleUpdate} className="btn-primary px-4 py-2 text-xs">Update</button>
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
