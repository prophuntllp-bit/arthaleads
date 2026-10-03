import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, CornerDownLeft, Search, UserPlus, ListPlus, MessageCircle, CalendarClock, MoonStar, SunMedium, ArrowRight } from "lucide-react";
import api from "../services/api";

// Search everything from one box (Ctrl/Cmd+K): leads, teammates, pages and
// common actions. Arrow keys move, Enter opens, Esc closes.
const RECENT_KEY = "cmd_recent_leads";
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } };
const saveRecent = (lead) => {
  try {
    const next = [{ _id: lead._id, name: lead.name, phone: lead.phone, status: lead.status }, ...readRecent().filter((l) => l._id !== lead._id)].slice(0, 4);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage blocked */ }
};

function Avatar({ name, src }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
      style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name || "?")[0].toUpperCase()}
    </span>
  );
}

function Key({ children }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold text-app-soft"
      style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }}>
      {children}
    </kbd>
  );
}

export default function CommandMenu({ open, onClose, pages, user, navigate, location, isDark, onToggleTheme, onSearchAll }) {
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const canSeeTeam = ["admin", "manager", "super_admin"].includes(user?.role);

  useEffect(() => {
    if (!open) return;
    setQ(""); setLeads([]); setActive(0);
    setTimeout(() => inputRef.current?.focus(), 20);
    if (canSeeTeam && !people.length) {
      api.get("/auth/users").then(({ data }) => setPeople((data.users || []).filter((u) => u.isActive !== false && u.role !== "super_admin"))).catch(() => {});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live lead search, debounced.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setLeads([]); setLoading(false); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/leads/unified?search=${encodeURIComponent(term)}&limit=6&page=1`)
        .then(({ data }) => setLeads(data.leads || []))
        .catch(() => setLeads([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const openLead = (lead) => {
    saveRecent(lead);
    const stay = ["/leads", "/followups", "/calls"].some((p) => location.pathname.startsWith(p));
    navigate(stay ? location.pathname : "/leads", { state: { openLeadId: lead._id } });
  };

  const actions = useMemo(() => [
    { id: "a-lead", icon: UserPlus, label: "Add a lead", run: () => navigate("/leads", { state: { openAddLead: true } }) },
    ...(["admin", "manager", "super_admin"].includes(user?.role) ? [{ id: "a-task", icon: ListPlus, label: "Add a task", run: () => navigate("/tasks?new=1") }] : []),
    { id: "a-fu", icon: CalendarClock, label: "Follow-ups due today", run: () => navigate("/leads", { state: { presetFollowUpToday: true } }) },
    { id: "a-inbox", icon: MessageCircle, label: "Open WhatsApp inbox", run: () => navigate("/conversations") },
    { id: "a-theme", icon: isDark ? SunMedium : MoonStar, label: isDark ? "Switch to light mode" : "Switch to dark mode", run: onToggleTheme, keepOpen: true },
  ], [user?.role, isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sections, filtered by what has been typed.
  const sections = useMemo(() => {
    const term = q.trim().toLowerCase();
    const has = (s) => String(s || "").toLowerCase().includes(term);
    const out = [];
    if (!term) {
      out.push({ title: "Quick actions", items: actions.map((a) => ({ ...a, kind: "action" })) });
      const recent = readRecent();
      if (recent.length) out.push({ title: "Recent leads", items: recent.map((l) => ({ id: `r-${l._id}`, kind: "lead", lead: l, run: () => openLead(l) })) });
      out.push({ title: "Go to", items: pages.map((p) => ({ id: `p-${p.to}`, kind: "page", ...p, run: () => navigate(p.to) })) });
      return out;
    }
    if (leads.length || loading) {
      out.push({ title: loading && !leads.length ? "Leads · searching…" : "Leads", items: leads.map((l) => ({ id: `l-${l._id}`, kind: "lead", lead: l, run: () => openLead(l) })) });
    }
    const team = people.filter((p) => has(p.name) || has(p.email)).slice(0, 4);
    if (team.length) out.push({ title: "Team", items: team.map((p) => ({ id: `u-${p._id}`, kind: "person", person: p, run: () => navigate("/performance", { state: { focusUserId: p._id } }) })) });
    const pg = pages.filter((p) => has(p.label) || has(p.parent) || has(p.hint)).slice(0, 5);
    if (pg.length) out.push({ title: "Pages", items: pg.map((p) => ({ id: `p-${p.to}`, kind: "page", ...p, run: () => navigate(p.to) })) });
    const ac = actions.filter((a) => has(a.label));
    if (ac.length) out.push({ title: "Actions", items: ac.map((a) => ({ ...a, kind: "action" })) });
    if (term.length >= 2) out.push({ title: "", items: [{ id: "all", kind: "all", label: `See all leads matching "${q.trim()}"`, run: () => onSearchAll(q.trim()) }] });
    return out;
  }, [q, leads, loading, people, pages, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  const flat = sections.flatMap((s) => s.items);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (item) => {
    if (!item) return;
    item.run?.();
    if (!item.keepOpen) onClose();
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(flat[active]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  if (!open) return null;
  let idx = -1;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-center px-4 pt-[12vh]" onMouseDown={onClose}
      style={{ background: "rgba(10,10,12,0.45)", backdropFilter: "blur(2px)" }}>
      <div role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--app-surface-solid)", border: "1px solid var(--app-border-strong)", boxShadow: "0 24px 64px rgba(0,0,0,0.28)" }}>
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <Search className="h-5 w-5 shrink-0 text-app-soft" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search leads, people, pages or actions"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-app outline-none placeholder:text-app-soft" autoComplete="off" />
          <Key>esc</Key>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {sections.map((sec, si) => (
            <div key={`${sec.title}-${si}`} className={si ? "mt-1 pt-1" : ""} style={si && sec.title ? { borderTop: "1px solid var(--app-border)" } : undefined}>
              {sec.title && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-app-soft">{sec.title}</p>}
              {sec.items.map((item) => {
                idx += 1;
                const i = idx;
                const on = i === active;
                return (
                  <button key={item.id} type="button" data-idx={i} onMouseMove={() => setActive(i)} onClick={() => choose(item)}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left"
                    style={on ? { background: "var(--app-surface-low)", boxShadow: "inset 0 0 0 1px var(--app-border)" } : undefined}>
                    {item.kind === "lead" ? (
                      <>
                        <Avatar name={item.lead.name} />
                        <span className="min-w-0 flex-1 truncate text-sm text-app">
                          <span className="font-medium">{item.lead.name || "Unknown"}</span>
                          {item.lead.phone && <span className="ml-2 text-app-soft">{item.lead.phone}</span>}
                        </span>
                        {item.lead.status && (
                          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-app-soft" style={{ border: "1px solid var(--app-border)" }}>{item.lead.status}</span>
                        )}
                      </>
                    ) : item.kind === "person" ? (
                      <>
                        <Avatar name={item.person.name} src={item.person.avatar} />
                        <span className="min-w-0 flex-1 truncate text-sm text-app">
                          <span className="font-medium">{item.person.name}</span>
                          <span className="ml-2 capitalize text-app-soft">{item.person.role}</span>
                        </span>
                      </>
                    ) : item.kind === "page" ? (
                      <>
                        {item.icon ? <item.icon className="h-4 w-4 shrink-0 text-app-soft" /> : <span className="w-4" />}
                        <span className="min-w-0 flex-1 truncate text-sm text-app">
                          {item.parent && <span className="text-app-soft">{item.parent} › </span>}
                          <span className="font-medium">{item.label}</span>
                          {item.hint && <span className="ml-2 text-xs text-app-soft">{item.hint}</span>}
                        </span>
                        {on && <ArrowRight className="h-4 w-4 shrink-0 text-app-soft" />}
                      </>
                    ) : (
                      <>
                        {item.icon ? <item.icon className="h-4 w-4 shrink-0 text-app-soft" /> : <Search className="h-4 w-4 shrink-0 text-app-soft" />}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-app">{item.label}</span>
                        {on && <CornerDownLeft className="h-4 w-4 shrink-0 text-app-soft" />}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {!flat.length && !loading && (
            <p className="px-3 py-8 text-center text-sm text-app-soft">Nothing matches "{q}".</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-app-soft" style={{ borderTop: "1px solid var(--app-border)" }}>
          <span className="flex items-center gap-1.5"><Key><ArrowUp className="h-3 w-3" /></Key><Key><ArrowDown className="h-3 w-3" /></Key> to move</span>
          <span className="flex items-center gap-1.5"><Key><CornerDownLeft className="h-3 w-3" /></Key> to open</span>
          <span className="flex items-center gap-1.5"><Key>esc</Key> to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
