import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, FileText, Globe, Megaphone, Minus } from "lucide-react";

// Source filter as a checkbox tree: tick any mix of sources, website domains
// and single pages. Website › domain › page; a parent shows a dash when only
// some of what's under it is ticked. The value is a list of tokens the API
// understands (GET /leads/unified?sourceSel=...):
//   src:<source>   dom:<domain>   page:<domain/path>
//   ad:<adId> (one WhatsApp ad)   form:<formId> (one Facebook lead form)
export const encodeSel = (tokens) => tokens.map((t) => {
  const i = t.indexOf(":");
  return `${t.slice(0, i)}:${encodeURIComponent(t.slice(i + 1))}`;
}).join(",");
export const decodeSel = (str) => String(str || "").split(",").filter(Boolean).map((t) => {
  const i = t.indexOf(":");
  let v = t.slice(i + 1);
  try { v = decodeURIComponent(v); } catch { /* keep raw */ }
  return `${t.slice(0, i)}:${v}`;
});

function Box({ state }) {
  // state: "on" | "some" | "off"
  const on = state !== "off";
  return (
    <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] transition"
      style={on ? { background: "var(--app-primary)", border: "1px solid var(--app-primary)" } : { border: "1.5px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }}>
      {state === "on" && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      {state === "some" && <Minus className="h-3 w-3 text-white" strokeWidth={3} />}
    </span>
  );
}

function Count({ n }) {
  if (!n) return null;
  return (
    <span className="shrink-0 rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums text-app-soft"
      style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }}>{n}</span>
  );
}

function Row({ label, title, icon: Icon, count, state, expandable, expanded, onToggleOpen, onTick }) {
  return (
    <div className="flex items-center gap-1 rounded-lg pr-2 transition-colors hover:bg-[color:var(--app-surface-low)]">
      {expandable ? (
        <button type="button" aria-label={expanded ? `Hide ${label}` : `Show ${label}`} aria-expanded={expanded} onClick={onToggleOpen}
          className="flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-app-soft hover:text-app">
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150" style={{ transform: expanded ? "rotate(90deg)" : "none" }} />
        </button>
      ) : <span className="w-6 shrink-0" />}
      <button type="button" role="checkbox" aria-checked={state === "on" ? "true" : state === "some" ? "mixed" : "false"} onClick={onTick} title={title}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px] font-medium text-app">
        <Box state={state} />
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-55" />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Count n={count} />
      </button>
    </div>
  );
}

function Branch({ children }) {
  return <div className="ml-3 border-l pl-2" style={{ borderColor: "var(--app-border-strong)" }}>{children}</div>;
}

export default function SourceTreeSelect({ value = [], onChange, options = [], domains = [], pages = [], ads = [], forms = [], placeholder = "All sources", style = {} }) {
  const [open, setOpen] = useState(false);
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [openDomains, setOpenDomains] = useState({});
  const [openKids, setOpenKids] = useState({});
  const [pos, setPos] = useState({ top: 0, left: 0, width: 300 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const sel = new Set(value);
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const pagesOf = (d) => pages.filter((p) => p.domain === String(d).toLowerCase());
  const domainCount = (d) => pagesOf(d).reduce((n, p) => n + p.count, 0);
  const pageLabel = (p) => (p.path === "/" ? "Home page" : p.path);

  // ── state of each node
  const websiteOn = sel.has("src:Website");
  const domainState = (d) => {
    if (websiteOn || sel.has(`dom:${d}`)) return "on";
    return pagesOf(d).some((p) => sel.has(`page:${p.key}`)) ? "some" : "off";
  };
  const pageState = (d, p) => (websiteOn || sel.has(`dom:${d}`) || sel.has(`page:${p.key}`) ? "on" : "off");
  const websiteState = websiteOn ? "on" : domains.some((d) => domainState(d) !== "off") ? "some" : "off";

  // Sources that open into their own items: WhatsApp into its ads, Facebook into its lead forms.
  const kids = { WhatsApp: { kind: "ad", items: ads, icon: Megaphone }, Facebook: { kind: "form", items: forms, icon: FileText } };
  const hasKids = (v) => (kids[v]?.items?.length || 0) > 0;
  const kidTok = (v, it) => `${kids[v].kind}:${it.value}`;
  const kidState = (v, it) => (sel.has(`src:${v}`) || sel.has(kidTok(v, it)) ? "on" : "off");
  const srcState = (v) => (sel.has(`src:${v}`) ? "on" : kids[v]?.items.some((it) => sel.has(kidTok(v, it))) ? "some" : "off");
  const kidLabel = (v, it) => (it.label && it.label !== it.value ? it.label : `${v} ${it.value}`);
  // Facebook forms often share a name, so the id's tail tells them apart.
  const kidShown = (v, it) => (v === "Facebook" ? `${kidLabel(v, it)} · …${String(it.value).slice(-4)}` : kidLabel(v, it));
  const tickKidSource = (v) => {
    const next = new Set(sel);
    const toks = kids[v].items.map((it) => kidTok(v, it));
    if (srcState(v) !== "off") { next.delete(`src:${v}`); toks.forEach((t) => next.delete(t)); }
    else { toks.forEach((t) => next.delete(t)); next.add(`src:${v}`); }
    commit([...next]);
  };
  const tickKid = (v, it) => {
    const next = new Set(sel);
    const t = kidTok(v, it);
    if (next.has(`src:${v}`)) { next.delete(`src:${v}`); kids[v].items.forEach((x) => next.add(kidTok(v, x))); next.delete(t); }
    else next.has(t) ? next.delete(t) : next.add(t);
    commit([...next]);
  };

  // ── ticking
  const commit = (next) => onChange?.([...next]);
  const withoutSites = (set) => new Set([...set].filter((t) => !t.startsWith("dom:") && !t.startsWith("page:")));
  const tickSource = (v) => {
    const next = new Set(sel);
    if (v === "Website") {
      if (websiteState !== "off") { commit([...withoutSites(next)].filter((t) => t !== "src:Website")); return; }
      const w = withoutSites(next); w.add("src:Website"); commit([...w]); return;
    }
    const t = `src:${v}`;
    next.has(t) ? next.delete(t) : next.add(t);
    commit([...next]);
  };
  // Unticking something under a fully ticked parent keeps everything else ticked.
  const expandWebsite = (next) => { next.delete("src:Website"); domains.forEach((d) => next.add(`dom:${d}`)); };
  const expandDomain = (next, d) => { next.delete(`dom:${d}`); pagesOf(d).forEach((p) => next.add(`page:${p.key}`)); };
  const tickDomain = (d) => {
    const next = new Set(sel);
    const st = domainState(d);
    if (st === "off") {
      pagesOf(d).forEach((p) => next.delete(`page:${p.key}`));
      next.add(`dom:${d}`);
    } else {
      if (next.has("src:Website")) expandWebsite(next);
      next.delete(`dom:${d}`);
      pagesOf(d).forEach((p) => next.delete(`page:${p.key}`));
    }
    commit([...next]);
  };
  const tickPage = (d, p) => {
    const next = new Set(sel);
    const t = `page:${p.key}`;
    if (pageState(d, p) === "off") { next.add(t); commit([...next]); return; }
    if (next.has("src:Website")) expandWebsite(next);
    if (next.has(`dom:${d}`)) expandDomain(next, d);
    next.delete(t);
    commit([...next]);
  };

  // ── trigger label
  const nameOf = (t) => {
    const [k, ...rest] = t.split(":");
    const v = rest.join(":");
    if (k === "page") { const p = pages.find((x) => x.key === v); return p ? `${p.domain}${p.path === "/" ? "" : p.path}` : v; }
    if (k === "ad") { const a = ads.find((x) => x.value === v); return a ? `WhatsApp ad: ${a.label}` : `WhatsApp ad ${v}`; }
    if (k === "form") { const f = forms.find((x) => x.value === v); return f ? `Facebook form: ${f.label}` : `Facebook form ${v}`; }
    return v;
  };
  const triggerLabel = value.length === 0 ? placeholder : value.length === 1 ? nameOf(value[0]) : `${nameOf(value[0])} +${value.length - 1}`;

  // ── open / position / close
  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(Math.max(r.width, 320), vw - 16);
    const h = 420;
    const up = r.bottom + h > vh - 8 && r.top > h + 8;
    setPos({ ...(up ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 }), ...(r.left + w > vw - 8 ? { right: vw - r.right } : { left: r.left }), width: w });
  };
  useEffect(() => {
    if (!open) return undefined;
    place();
    // Start with the ticked parts unfolded.
    setWebsiteOpen(websiteState !== "off");
    setOpenDomains(Object.fromEntries(domains.filter((d) => domainState(d) === "some").map((d) => [d, true])));
    setOpenKids(Object.fromEntries(Object.keys(kids).filter((v) => srcState(v) === "some").map((v) => [v, true])));
    const away = (e) => { if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", place);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); window.removeEventListener("resize", place); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center justify-between gap-1.5 transition-colors"
        style={{ padding: "5px 10px", borderRadius: 10, fontSize: 13, border: open ? "1px solid var(--app-primary)" : "1px solid var(--app-border)",
          background: "var(--app-surface-low)", color: value.length ? "var(--app-text)" : "var(--app-text-soft)", whiteSpace: "nowrap", minWidth: 0, ...style }}>
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="shrink-0" style={{ width: 13, height: 13, opacity: 0.6, transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && createPortal(
        <div ref={panelRef} role="tree" aria-label="Sources" aria-multiselectable="true"
          className="fixed z-[9999] flex flex-col"
          style={{ ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }), ...(pos.right !== undefined ? { right: pos.right } : { left: pos.left }),
            width: pos.width, maxHeight: 420, borderRadius: 14, border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)" }}>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {items.map((item) => {
              if (item.value === "Website" && domains.length > 0) {
                return (
                  <div key="Website">
                    <Row label="Website" icon={Globe} count={domains.reduce((n, d) => n + domainCount(d), 0)} state={websiteState}
                      expandable expanded={websiteOpen} onToggleOpen={() => setWebsiteOpen((v) => !v)} onTick={() => tickSource("Website")} />
                    {websiteOpen && (
                      <Branch>
                        {domains.map((d) => {
                          const dp = pagesOf(d);
                          const expandable = dp.length > 1;
                          const expanded = !!openDomains[d];
                          return (
                            <div key={d}>
                              <Row label={d} icon={Globe} count={domainCount(d)} state={domainState(d)}
                                expandable={expandable} expanded={expanded}
                                onToggleOpen={() => setOpenDomains((o) => ({ ...o, [d]: !o[d] }))} onTick={() => tickDomain(d)} />
                              {expandable && expanded && (
                                <Branch>
                                  {dp.map((p) => (
                                    <Row key={p.key} label={pageLabel(p)} title={`${p.domain}${p.path === "/" ? "" : p.path}`} icon={FileText}
                                      count={p.count} state={pageState(d, p)} onTick={() => tickPage(d, p)} />
                                  ))}
                                </Branch>
                              )}
                            </div>
                          );
                        })}
                      </Branch>
                    )}
                  </div>
                );
              }
              if (hasKids(item.value)) {
                const k = kids[item.value];
                return (
                  <div key={item.value}>
                    <Row label={item.label} count={k.items.reduce((n, it) => n + (it.count || 0), 0)} state={srcState(item.value)}
                      expandable expanded={!!openKids[item.value]} onToggleOpen={() => setOpenKids((o) => ({ ...o, [item.value]: !o[item.value] }))}
                      onTick={() => tickKidSource(item.value)} />
                    {openKids[item.value] && (
                      <Branch>
                        {k.items.map((it) => (
                          <Row key={it.value} label={kidShown(item.value, it)} title={`${kidLabel(item.value, it)} (${it.value})`} icon={k.icon}
                            count={it.count} state={kidState(item.value, it)} onTick={() => tickKid(item.value, it)} />
                        ))}
                      </Branch>
                    )}
                  </div>
                );
              }
              return <Row key={item.value} label={item.label} state={sel.has(`src:${item.value}`) ? "on" : "off"} onTick={() => tickSource(item.value)} />;
            })}
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderTop: "1px solid var(--app-border)" }}>
            <span className="text-xs text-app-soft">{value.length ? `${value.length} selected` : "Nothing selected: all sources"}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={!value.length} onClick={() => commit([])}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-app-soft hover:text-app disabled:opacity-40">Clear</button>
              <button type="button" onClick={() => setOpen(false)} className="btn-primary rounded-lg px-3 py-1 text-xs font-semibold">Done</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
