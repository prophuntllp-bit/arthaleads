import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HDRS = ["Mo","Tu","We","Th","Fr","Sa","Su"];
const ITEM_H   = 36;

function pad2(n) { return String(n).padStart(2, "0"); }

function buildCells(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const offset   = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
  const total    = new Date(year, month + 1, 0).getDate();
  const cells    = Array(offset).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}

function fmtDisplay(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d)) return null;
  const h = d.getHours(), m = d.getMinutes();
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}  ${h % 12 || 12}:${pad2(m)} ${h < 12 ? "AM" : "PM"}`;
}

function parseToState(isoStr) {
  const now = new Date();
  if (!isoStr) return {
    year: now.getFullYear(), month: now.getMonth(), day: null,
    hour12: now.getHours() % 12 || 12, minute: now.getMinutes(),
    ampm: now.getHours() < 12 ? "AM" : "PM",
  };
  const d = new Date(isoStr);
  if (isNaN(d)) return parseToState(null);
  return {
    year: d.getFullYear(), month: d.getMonth(), day: d.getDate(),
    hour12: d.getHours() % 12 || 12, minute: d.getMinutes(),
    ampm: d.getHours() < 12 ? "AM" : "PM",
  };
}

export default function DateTimePicker({ value, onChange, placeholder = "dd-mm-yyyy  --:-- --" }) {
  const today  = new Date();
  const [open, setOpen]     = useState(false);
  const [st, setSt]         = useState(() => parseToState(value));
  const [popPos, setPopPos] = useState({ top: 0, left: 0 });

  const btnRef = useRef(null);
  const popRef = useRef(null);
  const hrRef  = useRef(null);
  const minRef = useRef(null);

  useEffect(() => { setSt(parseToState(value)); }, [value]);

  // Scroll selected items to center when picker opens
  useEffect(() => {
    if (!open) return;
    const scrollToIdx = (ref, idx) => {
      if (ref.current) ref.current.scrollTop = idx * ITEM_H - ref.current.clientHeight / 2 + ITEM_H / 2;
    };
    const t = setTimeout(() => {
      scrollToIdx(hrRef,  st.hour12 - 1);
      scrollToIdx(minRef, st.minute);
    }, 30);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const openPicker = () => {
    setSt(parseToState(value));
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const popW = 370, popH = 320;
      const left = Math.min(rect.left, window.innerWidth - popW - 8);
      const top  = rect.bottom + popH > window.innerHeight - 8
        ? rect.top - popH - 4
        : rect.bottom + 4;
      setPopPos({ top, left: Math.max(8, left) });
    }
    setOpen(true);
  };

  const navMonth = (dir) => setSt(s => {
    let m = s.month + dir, y = s.year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    return { ...s, month: m, year: y };
  });

  const scrollToIdx = (ref, idx) => {
    if (ref.current) ref.current.scrollTop = idx * ITEM_H - ref.current.clientHeight / 2 + ITEM_H / 2;
  };

  const pickHour = (h) => { setSt(s => ({ ...s, hour12: h })); scrollToIdx(hrRef,  h - 1); };
  const pickMin  = (m) => { setSt(s => ({ ...s, minute:  m })); scrollToIdx(minRef, m);     };

  const handleSave = () => {
    if (!st.day) return;
    let h = st.hour12 % 12;
    if (st.ampm === "PM") h += 12;
    onChange(new Date(st.year, st.month, st.day, h, st.minute).toISOString());
    setOpen(false);
  };

  const handleClear = () => { onChange(null); setOpen(false); };

  const handleNow = () => {
    const n = new Date();
    const next = {
      year: n.getFullYear(), month: n.getMonth(), day: n.getDate(),
      hour12: n.getHours() % 12 || 12, minute: n.getMinutes(),
      ampm: n.getHours() < 12 ? "AM" : "PM",
    };
    setSt(next);
    setTimeout(() => {
      scrollToIdx(hrRef,  next.hour12 - 1);
      scrollToIdx(minRef, next.minute);
    }, 30);
  };

  const cells  = buildCells(st.year, st.month);
  const hours  = Array.from({ length: 12 }, (_, i) => i + 1);
  const mins   = Array.from({ length: 60 }, (_, i) => i);
  const todayD = today.getDate(), todayM = today.getMonth(), todayY = today.getFullYear();

  const cellBtn = (style, base) => ({
    ...base,
    onMouseEnter: e => { if (style.background === "transparent") e.currentTarget.style.background = "rgba(128,128,128,0.08)"; },
    onMouseLeave: e => { if (style.background === "rgba(128,128,128,0.08)") e.currentTarget.style.background = "transparent"; },
  });

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPicker}
        className="rounded-lg border text-xs transition focus:outline-none focus:border-orange-400 text-left whitespace-nowrap"
        style={{
          padding: "4px 8px",
          borderColor: "var(--app-border)",
          background: "var(--app-surface-low)",
          color: value ? "var(--app-text)" : "#94a3b8",
          minWidth: 160,
        }}
      >
        {fmtDisplay(value) || placeholder}
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          style={{
            position: "fixed", zIndex: 9999,
            top: popPos.top, left: popPos.left,
            width: 370,
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: 16,
            boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex" }}>

            {/* ── Calendar ── */}
            <div style={{ flex: 1, padding: "12px 10px 10px" }}>
              {/* Month nav */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <button type="button" onClick={() => navMonth(-1)}
                  style={{ padding: 4, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "var(--app-text-soft)" }}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>
                  {MONTHS[st.month]}, {st.year}
                </span>
                <button type="button" onClick={() => navMonth(1)}
                  style={{ padding: 4, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "var(--app-text-soft)" }}>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
                {DAY_HDRS.map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--app-text-soft)", textTransform: "uppercase", padding: "2px 0" }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px 0" }}>
                {cells.map((d, i) => {
                  if (!d) return <div key={`e${i}`} />;
                  const isSel   = d === st.day;
                  const isToday = d === todayD && st.month === todayM && st.year === todayY;
                  const bg = isSel ? "var(--app-primary, #f97316)" : "transparent";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSt(s => ({ ...s, day: d }))}
                      style={{
                        height: 28, borderRadius: "50%", fontSize: 12,
                        fontWeight: isSel || isToday ? 700 : 400,
                        background: bg,
                        color: isSel ? "#fff" : isToday ? "var(--app-primary, #f97316)" : "var(--app-text)",
                        border: "none", cursor: "pointer", transition: "background 0.12s",
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(128,128,128,0.08)"; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {/* Clear / Now footer */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--app-border)" }}>
                <button type="button" onClick={handleClear}
                  style={{ fontSize: 12, color: "var(--app-text-soft)", border: "none", background: "transparent", cursor: "pointer", padding: "2px 6px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--app-text-soft)"}
                >Clear</button>
                <button type="button" onClick={handleNow}
                  style={{ fontSize: 12, color: "var(--app-primary, #f97316)", border: "none", background: "transparent", cursor: "pointer", padding: "2px 6px", fontWeight: 600 }}
                >Today</button>
              </div>
            </div>

            {/* ── Time picker ── */}
            <div style={{ borderLeft: "1px solid var(--app-border)", display: "flex", flexDirection: "column", width: 116 }}>

              {/* Hour + Minute scroll columns */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

                {/* Hours 1–12 */}
                <div
                  ref={hrRef}
                  style={{ flex: 1, overflowY: "auto", maxHeight: 216, scrollbarWidth: "none" }}
                >
                  {hours.map(h => {
                    const sel = st.hour12 === h;
                    return (
                      <button key={h} type="button" onClick={() => pickHour(h)}
                        style={{
                          width: "100%", height: ITEM_H, fontSize: 13,
                          fontWeight: sel ? 700 : 400,
                          background: sel ? "var(--app-primary, #f97316)" : "transparent",
                          color: sel ? "#fff" : "var(--app-text)",
                          border: "none", cursor: "pointer", transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "rgba(128,128,128,0.08)"; }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>

                {/* Minutes 00–59 */}
                <div
                  ref={minRef}
                  style={{ flex: 1, overflowY: "auto", maxHeight: 216, borderLeft: "1px solid var(--app-border)", scrollbarWidth: "none" }}
                >
                  {mins.map(m => {
                    const sel = st.minute === m;
                    return (
                      <button key={m} type="button" onClick={() => pickMin(m)}
                        style={{
                          width: "100%", height: ITEM_H, fontSize: 13,
                          fontWeight: sel ? 700 : 400,
                          background: sel ? "var(--app-primary, #f97316)" : "transparent",
                          color: sel ? "#fff" : "var(--app-text)",
                          border: "none", cursor: "pointer", transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "rgba(128,128,128,0.08)"; }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                      >
                        {pad2(m)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AM / PM */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid var(--app-border)" }}>
                {["AM", "PM"].map(ap => (
                  <button key={ap} type="button" onClick={() => setSt(s => ({ ...s, ampm: ap }))}
                    style={{
                      padding: "9px 0", fontSize: 11, fontWeight: 700,
                      background: st.ampm === ap ? "var(--app-primary, #f97316)" : "transparent",
                      color: st.ampm === ap ? "#fff" : "var(--app-text-soft)",
                      border: "none", cursor: "pointer", transition: "background 0.1s",
                    }}
                  >
                    {ap}
                  </button>
                ))}
              </div>

              {/* Set button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={!st.day}
                style={{
                  width: "100%", padding: "9px 0", fontSize: 12, fontWeight: 700,
                  background: "var(--app-primary, #f97316)", color: "#fff",
                  border: "none", cursor: st.day ? "pointer" : "not-allowed",
                  opacity: st.day ? 1 : 0.45,
                  borderTop: "1px solid var(--app-border)",
                  transition: "opacity 0.1s",
                }}
              >
                Set Time
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
