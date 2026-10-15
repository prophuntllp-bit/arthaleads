import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, MessageCircle, AlarmClock, Sparkles, Clock, ChevronDown, Users } from "lucide-react";
import api from "../../services/api";
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

const COUNTS = [
  { key: "visits", label: "site visits today" },
  { key: "chats", label: "unread chats" },
  { key: "overdue", label: "missed follow-ups" },
  { key: "today", label: "due today" },
  { key: "fresh", label: "new, not contacted" },
];

const hideKey = (date) => `al.brief.hidden.${date}`;

export default function MorningBrief() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = () => api.get("/copilot/brief").then(({ data }) => {
    setBrief(data.brief || null);
    if (data.brief) { try { setCollapsed(localStorage.getItem(hideKey(data.brief.date)) === "1"); } catch { /* storage blocked */ } }
  }).catch(() => setBrief(null));
  useEffect(() => { load(); }, []);
  useAppRefresh(load, ["leads", "projects"]);

  if (!brief) return null;
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(hideKey(brief.date), next ? "1" : "0"); } catch { /* storage blocked */ }
  };

  const open = (it) => {
    if (it.tag === "chat" && it.conversationId) { navigate("/conversations", { state: { openConversationId: it.conversationId } }); return; }
    navigate("/leads", { state: { openLeadId: it.id, openLeadKind: it.kind } });
  };
  const askArtha = () => window.dispatchEvent(new CustomEvent("helpbot:ask", { detail: { question: "Who should I call first today?" } }));

  const counts = COUNTS.filter((c) => brief.counts[c.key] > 0);
  const nothing = !brief.items.length && !(brief.team || []).length;
  const dateLabel = new Date(`${brief.date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="card p-4 sm:p-5" aria-label="Your day">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="stitch-kicker mb-1">Artha · {dateLabel}</p>
          <h3 className="flex items-center gap-1.5 text-base font-bold text-app">
            {nothing ? "Nothing urgent today" : "Your day: who to call first"}
            <InfoTip text="Worked out from your follow-ups, site visits, unread WhatsApp chats and new leads. Updates when your leads change." />
          </h3>
          {counts.length > 0 && (
            <p className="mt-1 text-xs text-app-soft">
              {counts.map((c, i) => <span key={c.key}>{i > 0 && " · "}<b className="text-app">{brief.counts[c.key]}</b> {c.label}</span>)}
            </p>
          )}
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
                    <WhatsAppLink phone={it.phone} name={it.name} leadId={it.id} projectId={it.kind === "projectLead" ? it.projectId : undefined} />
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
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--app-border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-app-soft" style={{ background: "var(--app-surface-low)" }}>
                  <th className="px-3 py-2 font-semibold">Person</th>
                  <th className="px-3 py-2 font-semibold text-right">Missed follow-ups</th>
                  <th className="px-3 py-2 font-semibold text-right">New, not contacted</th>
                  <th className="px-3 py-2 font-semibold text-right">Due today</th>
                  <th className="px-3 py-2 font-semibold text-right">Site visits</th>
                </tr>
              </thead>
              <tbody>
                {brief.team.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--app-border)" }}>
                    <td className="px-3 py-2 font-semibold text-app">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: r.overdue ? "#dc2626" : undefined }}>{r.overdue}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: r.fresh ? "#ea580c" : undefined }}>{r.fresh}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-app">{r.today}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-app">{r.visits}</td>
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
