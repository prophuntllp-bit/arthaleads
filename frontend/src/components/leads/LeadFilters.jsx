import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, SlidersHorizontal, User, X } from "lucide-react";
import CustomSelect from "../CustomSelect";
import SourceTreeSelect, { decodeSel, encodeSel } from "./SourceTreeSelect";
import DateRangePicker from "../DateRangePicker";

// The Leads page filters, kept simple:
//   1. one search box (name, phone, email, website)
//   2. status as tabs with live counts
//   3. one row: search, dates, My Leads, Filters
//   4. everything else (agent, project, source, priority, outcome) behind Filters
//   5. what's applied, as removable chips, with Clear all
// Every filter works exactly as before; only where they live changed.

const SECONDARY_KEYS = ["assignedTo", "projectId", "source", "siteFilter", "sitePage", "sourceSel", "priority", "booking", "consent", "followUpToday"];

const CONSENT_OPTIONS = [
  { value: "granted", label: "Consent given" },
  { value: "unknown", label: "Consent not recorded" },
  { value: "denied",  label: "Consent refused" },
];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-app-soft">{label}</span>
      {children}
    </label>
  );
}

// Clear, even borders on every control (the shared default is very faint).
const EDGE = "1px solid var(--app-border-strong)";
const LIFT = "0 1px 2px rgba(16,24,40,0.05)";
const selectStyle = { width: "100%", padding: "8px 12px", borderRadius: 12, fontSize: 13, borderColor: "var(--app-border-strong)", boxShadow: LIFT, background: "var(--app-surface-solid)" };

export default function LeadFilters({
  filters, setFilter, isAdmin, agents = [], projects = [], domains = [], sitePages = [], adOptions = [], formOptions = [],
  statusCounts, statusOptions, sourceOptions, priorityOptions, bookingOptions,
  dateRangeValue, onDateRangeChange, onToggleMyOnly, onClearAll,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const searchRef = useRef(null);

  // Sliding highlight behind the selected status tab.
  const stripRef = useRef(null);
  const tabRefs = useRef({});
  const [pill, setPill] = useState(null); // { left, width }
  const [pillReady, setPillReady] = useState(false); // no slide on first paint
  const activeStatus = filters.status || "";
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[activeStatus];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && stripRef.current) ro.observe(stripRef.current);
    return () => ro?.disconnect();
  }, [activeStatus, statusCounts]);
  useEffect(() => { const t = setTimeout(() => setPillReady(true), 50); return () => clearTimeout(t); }, []);

  // "/" jumps to this search (Ctrl/Cmd+K stays the app-wide search).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPanel = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setOpen((v) => !v);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Chips for whatever is applied (status and dates show in their own controls)
  const label = (opts, v) => (opts.find((o) => (o.value ?? o) === v)?.label) ?? v;
  const chips = [];
  if (filters.assignedTo) chips.push({ key: "assignedTo", text: `Agent: ${agents.find((a) => a._id === filters.assignedTo)?.name || "Selected"}` });
  if (filters.projectId) chips.push({ key: "projectId", text: `Project: ${projects.find((p) => p._id === filters.projectId)?.name || "Selected"}` });
  if (filters.source || filters.siteFilter) {
    const parts = [filters.source, filters.siteFilter, filters.sitePage].filter(Boolean);
    chips.push({ key: "source", clear: ["source", "siteFilter", "sitePage"], text: `Source: ${parts.join(" › ")}` });
  }
  // One chip per ticked source / domain / page, each removable on its own.
  const ticked = decodeSel(filters.sourceSel);
  ticked.forEach((t) => {
    const [k, ...rest] = t.split(":");
    const v = rest.join(":");
    const pg = k === "page" ? sitePages.find((x) => x.key === v) : null;
    const ad = k === "ad" ? adOptions.find((x) => x.value === v && !x.kind) : null;
    const fm = k === "form" ? formOptions.find((x) => x.value === v) : null;
    const name = pg ? `${pg.domain}${pg.path === "/" ? "" : pg.path}` : ad ? `WhatsApp ad: ${ad.label}` : k === "noad" ? v.replace(/^Facebook Ad · /, "") : fm ? `Facebook form: ${fm.label}` : v;
    chips.push({ key: `sel-${t}`, text: `Source: ${name}`, onClear: () => setFilter("sourceSel", encodeSel(ticked.filter((x) => x !== t))) });
  });
  if (filters.priority) chips.push({ key: "priority", text: `Priority: ${filters.priority}` });
  if (filters.booking) chips.push({ key: "booking", text: `Outcome: ${label(bookingOptions, filters.booking)}` });
  if (filters.consent) chips.push({ key: "consent", text: `WhatsApp: ${label(CONSENT_OPTIONS, filters.consent)}` });
  if (filters.followUpToday) chips.push({ key: "followUpToday", text: "Follow-ups due today" });
  const panelCount = SECONDARY_KEYS.filter((k) => filters[k] && !["siteFilter", "sitePage", "sourceSel"].includes(k)).length
    + (!filters.source && filters.siteFilter ? 1 : 0) + ticked.length;
  const anything = Object.entries(filters).some(([k, v]) => v && k !== "myOnly") || filters.myOnly === "true";

  const clearChip = (c) => (c.onClear ? c.onClear() : (c.clear || [c.key]).forEach((k) => setFilter(k, "")));

  const tabs = [{ value: "", label: "All", count: statusCounts?.all }, ...statusOptions.map((s) => ({ value: s, label: s, count: statusCounts?.[s] }))];

  return (
    <div className="space-y-3 border-t pt-3" style={{ borderColor: "var(--app-border)" }} data-tour="leads-search">
      {/* 3. One row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Same look as the header search, but it searches these leads only. */}
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-app-soft" />
          <input
            ref={searchRef}
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setFilter("search", ""); e.currentTarget.blur(); } }}
            placeholder="Search leads by name, phone, email or website…"
            aria-label="Search leads"
            className="w-full rounded-xl py-2 pl-9 pr-10 text-sm text-app outline-none transition placeholder:text-app-soft focus:border-orange-400"
            style={{ border: EDGE, background: "var(--app-surface-low)", boxShadow: LIFT }}
          />
          {filters.search ? (
            <button type="button" aria-label="Clear search" onClick={() => setFilter("search", "")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-app-soft hover:text-app">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-app-soft"
              style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }} title="Press / to search">/</kbd>
          )}
        </label>

        <div className="w-[170px]">
          <DateRangePicker
            compact
            value={dateRangeValue}
            onChange={onDateRangeChange}
            triggerClassName="w-full justify-between"
            triggerStyle={{ width: "100%", padding: "8px 12px", borderRadius: 12, fontSize: 13, backdropFilter: "none", WebkitBackdropFilter: "none", border: EDGE, background: "var(--app-surface-solid)", boxShadow: LIFT }}
          />
        </div>

        {isAdmin && (
          <button type="button" onClick={onToggleMyOnly} aria-pressed={filters.myOnly === "true"}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition"
            style={{ border: EDGE, background: "var(--app-surface-solid)", boxShadow: LIFT, color: filters.myOnly === "true" ? "var(--app-primary)" : "var(--app-text)" }}>
            <User className="h-4 w-4" />
            My Leads
            <span className="relative inline-flex h-[18px] w-8 items-center rounded-full transition"
              style={{ background: filters.myOnly === "true" ? "var(--app-primary)" : "rgba(128,128,128,0.25)" }}>
              <span className="absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all" style={{ left: filters.myOnly === "true" ? 16 : 2 }} />
            </span>
          </button>
        )}

        <button ref={btnRef} type="button" onClick={openPanel} aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition"
          style={panelCount
            ? { border: "1px solid var(--app-primary)", background: "rgba(var(--app-primary-rgb),0.08)", color: "var(--app-primary)", boxShadow: LIFT }
            : { border: EDGE, background: "var(--app-surface-solid)", color: "var(--app-text)", boxShadow: LIFT }}>
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {panelCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: "var(--app-primary)" }}>{panelCount}</span>
          )}
        </button>
      </div>

      {/* 2. Status tabs with counts: a bordered strip, the selected tab raised */}
      <div className="hidden w-full overflow-x-auto sm:block">
        {/* Full width of the card, tabs left-aligned (min-w-max lets it scroll when narrow). */}
        <div ref={stripRef} role="tablist" aria-label="Status" className="relative flex w-full min-w-max gap-1 rounded-xl p-1"
          style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-low)" }}>
          {/* The raised highlight is one element that slides to the selected tab. */}
          {pill && (
            <span aria-hidden="true" className={`tab-pill pointer-events-none absolute bottom-1 top-1 rounded-lg ${pillReady ? "tab-pill-animate" : ""}`}
              style={{ left: pill.left, width: pill.width, background: "var(--app-surface-solid)",
                boxShadow: "0 0 0 1px rgba(var(--app-primary-rgb),0.45), 0 1px 2px rgba(16,24,40,0.06)" }} />
          )}
          {tabs.map((t) => {
            const on = activeStatus === t.value;
            return (
              <button key={t.label} ref={(el) => { tabRefs.current[t.value] = el; }} type="button" role="tab" aria-selected={on} onClick={() => setFilter("status", t.value)}
                className={`relative z-[1] inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${on ? "" : "hover:text-app"}`}
                style={{ color: on ? "var(--app-text)" : "var(--app-text-soft)" }}>
                {t.label}
                {t.count != null && (
                  <span className="rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums transition-colors duration-200"
                    style={on
                      ? { border: "1px solid rgba(var(--app-primary-rgb),0.4)", color: "var(--app-primary)", background: "rgba(var(--app-primary-rgb),0.06)" }
                      : { border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }}>
                    {t.count.toLocaleString("en-IN")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {/* Phones: the same choice as a dropdown */}
      <select aria-label="Status" value={filters.status || ""} onChange={(e) => setFilter("status", e.target.value)}
        className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-app sm:hidden"
        style={{ border: EDGE, background: "var(--app-surface-solid)", boxShadow: LIFT }}>
        {tabs.map((t) => <option key={t.label} value={t.value}>{t.label}{t.count != null ? ` (${t.count})` : ""}</option>)}
      </select>

      {/* 5. What's applied */}
      {(chips.length > 0 || anything) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium text-app"
              style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }}>
              <span className="truncate">{c.text}</span>
              <button type="button" aria-label={`Remove ${c.text}`} onClick={() => clearChip(c)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-app-soft hover:bg-black/5 hover:text-app dark:hover:bg-white/5">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {anything && (
            <button type="button" onClick={onClearAll} className="text-xs font-semibold text-red-500 hover:underline">Clear all</button>
          )}
        </div>
      )}

      {/* 4. Everything else, in one panel */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9980]" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Filters"
            className="fixed z-[9990] w-[min(360px,calc(100vw-16px))] rounded-2xl p-4"
            style={{ top: pos.top, right: pos.right, background: "var(--app-surface-solid)", border: "1px solid var(--app-border-strong)", boxShadow: "var(--app-shadow-lg)" }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-app">Filters</p>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-soft hover:text-app">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {isAdmin && agents.length > 0 && (
                <Field label="Agent">
                  <CustomSelect value={filters.assignedTo || ""} onChange={(v) => setFilter("assignedTo", v)} placeholder="All agents"
                    options={agents.map((a) => ({ value: a._id, label: a.name }))} style={selectStyle} />
                </Field>
              )}
              {projects.length > 0 && (
                <Field label="Project">
                  <CustomSelect value={filters.projectId || ""} onChange={(v) => setFilter("projectId", v)} placeholder="All projects"
                    options={projects.map((p) => ({ value: p._id, label: `${p.name} (${p.leadCount || 0})` }))} style={selectStyle} />
                </Field>
              )}
              <Field label="Source">
                <SourceTreeSelect value={ticked} domains={domains} pages={sitePages} ads={adOptions} forms={formOptions} options={sourceOptions} placeholder="All sources" style={selectStyle}
                  onChange={(tokens) => {
                    // The tree replaces any single source set by a link (e.g. from the dashboard).
                    setFilter("source", ""); setFilter("siteFilter", ""); setFilter("sitePage", "");
                    setFilter("sourceSel", encodeSel(tokens));
                  }} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <CustomSelect value={filters.priority} onChange={(v) => setFilter("priority", v)} placeholder="Any" options={priorityOptions} style={selectStyle} />
                </Field>
                <Field label="Outcome">
                  <CustomSelect value={filters.booking} onChange={(v) => setFilter("booking", v)} placeholder="Any"
                    options={bookingOptions} style={selectStyle} />
                </Field>
              </div>
              {filters.consent && (
                <Field label="WhatsApp consent">
                  <CustomSelect value={filters.consent} onChange={(v) => setFilter("consent", v)} placeholder="Any" options={CONSENT_OPTIONS} style={selectStyle} />
                </Field>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--app-border)" }}>
              <button type="button" disabled={!panelCount} onClick={() => SECONDARY_KEYS.forEach((k) => setFilter(k, ""))}
                className="text-xs font-semibold text-app-soft hover:text-app disabled:opacity-40">Reset these</button>
              <button type="button" onClick={() => setOpen(false)} className="btn-primary rounded-xl px-4 py-1.5 text-xs font-semibold">Done</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
