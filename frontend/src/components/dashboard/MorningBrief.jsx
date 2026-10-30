import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, MessageCircle, AlarmClock, Sparkles, Clock, ChevronDown, Users, AlertTriangle, Flame, CalendarX, UserX, Hourglass } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import useAppRefresh from "../../hooks/useAppRefresh";
import { PhoneActions, WhatsAppLink } from "../UI";
import { InfoTip } from "../Tooltip";

// Artha's morning brief (Phase 3): who to call first today, worked out by the
// server from follow-ups, site visits, unread chats and new leads. No AI call.
// Only shown to pilot companies; the endpoint answers brief: null otherwise.
const TAG = {
  visit:   { label: "Site visit", Icon: CalendarCheck, color: "#16a34a", bg: "rgba(34,197,94,0.12)" },
  chat:    { label: "WhatsApp",   Icon: MessageCircle, color: "#16a34a", bg: "rgba(34,197,94,0.12)" },
  overdue: { label: "Missed",     Icon: AlarmClock,    color: "#dc2626", bg: "rgba(239,68,68,0.12)" },
  new:     { label: "New lead",   Icon: Sparkles,      color: "#ea580c", bg: "rgba(249,115,22,0.12)" },
  today:   { label: "Due today",  Icon: Clock,         color: "#2563eb", bg: "rgba(59,130,246,0.12)" },
};

// Deals slipping (backend copilot/risks.js).
const RISK = {
  chat_closing:       { label: "Reply window closing", Icon: Hourglass },
  unassigned_waiting: { label: "No owner",             Icon: UserX },
  visit_missed:       { label: "Visit not updated",    Icon: CalendarX },
  hot_cold:           { label: "Hot lead gone quiet",  Icon: Flame },
  visit_silent:       { label: "No follow-up after visit", Icon: CalendarCheck },
  new_waiting:        { label: "New lead waiting",     Icon: AlarmClock },
};

const COUNTS = [
  { key: "visits", label: "site visits today" },
  { key: "chats", label: "unread chats" },
  { key: "overdue", label: "missed follow-ups" },
  { key: "today", label: "due today" },
  { key: "fresh", label: "new, not contacted" },
];

// Below 640px the WhatsApp button shows its icon only, so the lead's name
// has room (font-size 0 hides the "WhatsApp" text node and the chevron is
// hidden; the text stays in the DOM, so screen readers still read it).
const ICON_ONLY_BELOW_SM = "max-sm:[&_button]:text-[0px] max-sm:[&_button]:gap-0 max-sm:[&_button]:px-2 max-sm:[&_button]:py-2 max-sm:[&_button>svg:last-child:not(:first-child)]:hidden";

// "Team today" columns (managers see one row per person).
const TEAM_COLS = [
  { key: "atRisk",  label: "At risk",            short: "at risk",            color: "#dc2626" },
  { key: "overdue", label: "Missed follow-ups",  short: "missed follow-ups",  color: "#dc2626" },
  { key: "fresh",   label: "New, not contacted", short: "new, not contacted", color: "#ea580c" },
  { key: "today",   label: "Due today",          short: "due today" },
  { key: "visits",  label: "Site visits",        short: "site visits" },
];

const hideKey = (date) => `al.brief.hidden.${date}`;
const CACHE_KEY = "al.brief.last";   // sessionStorage: the last brief, shown instantly
const ON_KEY = "al.brief.on";        // localStorage: this person gets a brief (show a placeholder)
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const store = (kind, key, value) => { try { if (value === undefined) return window[kind].getItem(key); if (value === null) window[kind].removeItem(key); else window[kind].setItem(key, value); } catch { /* storage blocked */ } return null; };

// The Dashboard starts this the moment it opens, so the brief loads alongside
// the other cards instead of after them. One request is shared for 20 s.
// Everything is keyed by the signed-in person, so after a switch of account
// nobody sees someone else's brief.
let pending = null;
export function prefetchBrief(userId) {
  if (!pending || pending.userId !== userId || Date.now() - pending.at > 20000) {
    pending = { userId, at: Date.now(), promise: api.get("/copilot/brief").then(({ data }) => data.brief || null) };
  }
  return pending.promise;
}

function cachedBrief(userId) {
  try {
    const c = JSON.parse(store("sessionStorage", CACHE_KEY) || "null");
    return c && c.userId === userId && c.brief?.date === todayIST() ? c.brief : null;
  } catch { return null; }
}

export default function MorningBrief() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?._id || user?.id || "";
  const [brief, setBrief] = useState(() => cachedBrief(uid));
  const [loading, setLoading] = useState(() => !cachedBrief(uid) && store("localStorage", ON_KEY) === uid);
  const [collapsed, setCollapsed] = useState(() => { const c = cachedBrief(uid); return !!c && store("localStorage", hideKey(c.date)) === "1"; });

  const apply = (b) => {
    setBrief(b);
    setLoading(false);
    store("localStorage", ON_KEY, b ? uid : null);
    store("sessionStorage", CACHE_KEY, b ? JSON.stringify({ userId: uid, brief: b }) : null);
    if (b) setCollapsed(store("localStorage", hideKey(b.date)) === "1");
  };
  useEffect(() => { prefetchBrief(uid).then(apply).catch(() => setLoading(false)); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useAppRefresh(() => { pending = null; prefetchBrief(uid).then(apply).catch(() => {}); }, ["leads", "projects"]);

  if (!brief && loading) {
    return (
      <section className="card p-4 sm:p-5" aria-busy="true" aria-label="Loading your day">
        <div className="h-3 w-40 rounded-full animate-pulse" style={{ background: "var(--app-surface-low)" }} />
        <div className="mt-2 h-4 w-64 rounded-full animate-pulse" style={{ background: "var(--app-surface-low)" }} />
        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--app-surface-low)" }} />)}
        </div>
      </section>
    );
  }
  if (!brief) return null;
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    store("localStorage", hideKey(brief.date), next ? "1" : "0");
  };

  const open = (it) => {
    if (it.kind === "summary") { navigate("/leads"); return; }
    if ((it.tag === "chat" || it.type === "chat_closing") && it.conversationId) { navigate("/conversations", { state: { openConversationId: it.conversationId } }); return; }
    navigate("/leads", { state: { openLeadId: it.id, openLeadKind: it.kind } });
  };
  const askArtha = () => window.dispatchEvent(new CustomEvent("helpbot:ask", { detail: { question: "Who should I call first today?" } }));

  const counts = COUNTS.filter((c) => brief.counts[c.key] > 0);
  const risks = brief.risks?.list || [];
  const nothing = !brief.items.length && !risks.length && !(brief.team || []).length;
  const dateLabel = new Date(`${brief.date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="card p-4 sm:p-5" aria-label="Your day">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-base font-bold text-app">
            {nothing ? "Nothing urgent today" : "Your day: who to call first"}
            <InfoTip text="Worked out from your follow-ups, site visits, unread WhatsApp chats and new leads. 'Needs attention' flags deals slipping: hot leads gone quiet, visits with no follow-up or not updated, new leads waiting, and WhatsApp chats about to lose the reply window. Updates when your leads change." />
          </h3>
          <p className="mt-1 text-xs text-app-soft">
            {dateLabel}
            {counts.map((c) => <span key={c.key}>{" · "}<b className="text-app">{brief.counts[c.key]}</b> {c.label}</span>)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!nothing && (
            <button type="button" onClick={askArtha}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition hover:opacity-90"
              style={{ background: "rgba(249,115,22,0.12)", color: "#ea580c", border: "1px solid rgba(249,115,22,0.3)" }}>
              <Sparkles className="h-3.5 w-3.5" /> Plan my day with Artha
            </button>
          )}
          {!nothing && (
            <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? "Show the list" : "Hide the list"}
              className="flex h-8 w-8 items-center justify-center rounded-xl cursor-pointer text-app-soft transition hover:text-app"
              style={{ border: "1px solid var(--app-border)" }}>
              <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && risks.length > 0 && (
        <div className="mt-3 rounded-2xl p-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)" }}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold" style={{ color: "#dc2626" }}>
            <AlertTriangle className="h-3.5 w-3.5" /> Needs attention
            <span className="font-semibold text-app-soft">
              · {brief.risks.total} {brief.risks.total === 1 ? "deal" : "deals"} slipping{brief.risks.total > risks.length ? `, top ${risks.length} shown` : ""}
            </span>
          </p>
          <ol className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {risks.map((it) => {
              const t = RISK[it.type] || RISK.hot_cold;
              return (
                <li key={`${it.kind}:${it.id}`} className="flex items-center gap-2.5 rounded-xl p-2.5"
                  style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626" }} title={t.label}>
                    <t.Icon className="h-4 w-4" />
                  </span>
                  <button type="button" onClick={() => open(it)} className="min-w-0 flex-1 text-left cursor-pointer">
                    <span className="block truncate text-sm font-semibold text-app hover:underline">
                      {it.name}{it.owner ? <span className="font-normal text-app-soft"> · {it.owner}</span> : null}
                    </span>
                    <span className="block truncate text-[11px] text-app-soft" title={it.reason}>{it.reason}</span>
                  </button>
                  {it.phone && it.kind === "lead" && (
                    <span className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ border: "1px solid var(--app-border)" }}>
                        <PhoneActions compact phone={it.phone} lead={{ _id: it.id, name: it.name }} />
                      </span>
                      <span className={ICON_ONLY_BELOW_SM}><WhatsAppLink phone={it.phone} name={it.name} leadId={it.id} /></span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!collapsed && brief.items.length > 0 && (
        <ol className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {brief.items.map((it) => {
            const t = TAG[it.tag] || TAG.today;
            return (
              <li key={`${it.kind}:${it.id}`} className="flex items-center gap-2.5 rounded-xl p-2.5"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: t.bg, color: t.color }} title={t.label}>
                  <t.Icon className="h-4 w-4" />
                </span>
                <button type="button" onClick={() => open(it)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <span className="block truncate text-sm font-semibold text-app hover:underline">
                    {it.name}{it.projectName ? <span className="font-normal text-app-soft"> · {it.projectName}</span> : null}
                  </span>
                  <span className="block truncate text-[11px] text-app-soft" title={it.reason}>{it.reason}</span>
                </button>
                {it.phone && it.kind !== "chat" && (
                  <span className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ border: "1px solid var(--app-border)" }}>
                      <PhoneActions compact phone={it.phone} {...(it.kind === "projectLead" ? { projectLead: { _id: it.id, name: it.name, projectId: it.projectId } } : { lead: { _id: it.id, name: it.name } })} />
                    </span>
                    <span className={ICON_ONLY_BELOW_SM}><WhatsAppLink phone={it.phone} name={it.name} leadId={it.id} projectId={it.kind === "projectLead" ? it.projectId : undefined} /></span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {!collapsed && brief.more > 0 && (
        <button type="button" onClick={() => navigate("/followups")} className="mt-2 text-xs font-semibold cursor-pointer" style={{ color: "#ea580c" }}>
          {brief.more} more in Follow-ups
        </button>
      )}

      {!collapsed && (brief.team || []).length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-app-soft"><Users className="h-3.5 w-3.5" /> Team today</p>
          {/* Phones: one block per person, only the numbers that are not zero. */}
          <ul className="space-y-2 sm:hidden">
            {brief.team.map((r) => {
              const cells = TEAM_COLS.filter((c) => (r[c.key] || 0) > 0);
              return (
                <li key={r.id} className="rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--app-border)" }}>
                  <p className="truncate text-sm font-semibold text-app">{r.name}</p>
                  {cells.length === 0 ? (
                    <p className="mt-0.5 text-[11px] text-app-soft">Nothing pending</p>
                  ) : (
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-app-soft">
                      {cells.map((c) => (
                        <span key={c.key}><b className="tabular-nums" style={{ color: c.color || "var(--app-text)" }}>{r[c.key]}</b> {c.short}</span>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl sm:block" style={{ border: "1px solid var(--app-border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-app-soft" style={{ background: "var(--app-surface-low)" }}>
                  <th className="px-3 py-2 font-semibold">Person</th>
                  {TEAM_COLS.map((c) => <th key={c.key} className="px-3 py-2 font-semibold text-right">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {brief.team.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--app-border)" }}>
                    <td className="px-3 py-2 font-semibold text-app">{r.name}</td>
                    {TEAM_COLS.map((c) => (
                      <td key={c.key} className={`px-3 py-2 text-right tabular-nums ${c.key === "atRisk" ? "font-semibold" : ""} ${r[c.key] && c.color ? "" : "text-app"}`}
                        style={{ color: r[c.key] && c.color ? c.color : undefined }}>{r[c.key] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
