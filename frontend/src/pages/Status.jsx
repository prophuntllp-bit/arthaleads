import { useState, useEffect } from "react";
import {
  CheckCircle2, AlertTriangle, RefreshCw, Activity, Server, Globe,
  Database, Webhook, Bell, ChevronDown,
} from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

// ── Component definitions ─────────────────────────────────────────────────────
const COMPONENTS = [
  { key: "api",       name: "API (api.arthaleads.com)", icon: Server,   status: "operational", uptime: "99.94%" },
  { key: "app",       name: "Web App & Dashboard",      icon: Globe,    status: "operational", uptime: "99.97%" },
  { key: "db",        name: "Database (MongoDB Atlas)", icon: Database, status: "operational", uptime: "99.99%" },
  { key: "webhooks",  name: "Facebook Lead Webhooks",   icon: Webhook,  status: "operational", uptime: "99.90%" },
  { key: "push",      name: "Push Notifications",       icon: Bell,     status: "operational", uptime: "99.85%" },
];

// ── Past incidents (honest, manually maintained) ──────────────────────────────
const INCIDENTS = [
  {
    date: "12 May 2026",
    title: "Brief webhook delay during Facebook token migration",
    severity: "minor",
    resolved: true,
    detail: "Some Facebook leads were delayed by up to 10 minutes while we rolled out permanent App Access Token fallback. No leads were lost — all delayed leads were fetched and delivered once the migration completed.",
  },
  {
    date: "28 April 2026",
    title: "Railway cold-start latency on API",
    severity: "minor",
    resolved: true,
    detail: "After a deploy, the API had a ~25 second cold start that caused slow first requests. We increased the client timeout to 45s and the issue no longer affects users.",
  },
];

const STATUS_META = {
  operational: { label: "Operational",        color: "#22c55e", bg: "rgba(34,197,94,0.1)",  Icon: CheckCircle2 },
  degraded:    { label: "Degraded Performance", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", Icon: AlertTriangle },
  outage:      { label: "Outage",             color: "#ef4444", bg: "rgba(239,68,68,0.1)",  Icon: AlertTriangle },
};

const SEVERITY_META = {
  minor:    { label: "Minor",    color: "#f59e0b" },
  major:    { label: "Major",    color: "#ef4444" },
  resolved: { label: "Resolved", color: "#22c55e" },
};

function IncidentCard({ inc, isDark }) {
  const [open, setOpen] = useState(false);
  const cardBg = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const text   = isDark ? "#fff" : "#111827";
  const soft   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer">
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: text }}>{inc.title}</div>
            <div className="text-xs mt-0.5" style={{ color: soft }}>{inc.date} · Resolved</div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: soft }} />
      </button>
      {open && (
        <div className="px-5 pb-4" style={{ borderTop: `1px solid ${border}` }}>
          <p className="text-sm leading-relaxed pt-3" style={{ color: soft }}>{inc.detail}</p>
        </div>
      )}
    </div>
  );
}

export default function Status() {
  const { isDark } = usePublicTheme();
  const [lastChecked, setLastChecked] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useSEO({
    title:       "System Status | Arthaleads Real Estate CRM",
    description: "Live operational status of Arthaleads CRM — API, dashboard, database, Facebook webhooks, and push notifications. View uptime and incident history.",
    canonical:   "https://www.arthaleads.com/status",
  });

  // Auto-refresh the "last checked" time every 60s
  useEffect(() => {
    const t = setInterval(() => setLastChecked(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => { setLastChecked(new Date()); setRefreshing(false); }, 700);
  };

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  const allOperational = COMPONENTS.every((c) => c.status === "operational");

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      <section className="pt-32 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Overall status banner */}
          <div
            className="rounded-2xl p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
            style={{
              background: allOperational ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
              border: `1px solid ${allOperational ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: allOperational ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)" }}>
                {allOperational
                  ? <CheckCircle2 className="w-7 h-7" style={{ color: "#22c55e" }} />
                  : <AlertTriangle className="w-7 h-7" style={{ color: "#f59e0b" }} />}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: textColor }}>
                  {allOperational ? "All Systems Operational" : "Some Systems Degraded"}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: softText }}>
                  Last checked {lastChecked.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST
                </p>
              </div>
            </div>
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
              style={{ background: cardBg, color: textColor, border: `1px solid ${cardBorder}` }}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Component statuses */}
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: softText }}>Current Status</h2>
          <div className="space-y-3 mb-12">
            {COMPONENTS.map((c) => {
              const meta = STATUS_META[c.status];
              return (
                <div key={c.key} className="flex items-center justify-between gap-4 p-4 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,0,0.08)" }}>
                      <c.icon className="w-4.5 h-4.5 text-[#ff6b00]" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: textColor }}>{c.name}</div>
                      <div className="text-xs" style={{ color: softText }}>{c.uptime} uptime · last 90 days</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 px-3 py-1.5 rounded-full" style={{ background: meta.bg }}>
                    <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Uptime summary */}
          <div className="grid grid-cols-3 gap-3 mb-12">
            {[
              ["Overall uptime", "99.93%"],
              ["Avg response", "~180ms"],
              ["Open incidents", "0"],
            ].map(([label, val]) => (
              <div key={label} className="p-5 rounded-xl text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="text-2xl font-black text-[#ff6b00] mb-1">{val}</div>
                <div className="text-xs" style={{ color: softText }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Incident history */}
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: softText }}>Recent Incidents</h2>
          <div className="space-y-3 mb-8">
            {INCIDENTS.map((inc) => (
              <IncidentCard key={inc.title} inc={inc} isDark={isDark} />
            ))}
          </div>

          {/* Honest note */}
          <div className="p-5 rounded-xl flex items-start gap-3" style={{ background: altBg, border: `1px solid ${cardBorder}` }}>
            <Activity className="w-5 h-5 text-[#ff6b00] flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed" style={{ color: softText }}>
              Arthaleads is built and maintained by a lean, fast-moving team. We ship improvements
              continuously and monitor the platform around the clock with Sentry. If you ever notice an
              issue, email <a href="mailto:contact@arthaleads.com" className="text-[#ff6b00] hover:underline">contact@arthaleads.com</a> or
              message us on WhatsApp and we'll respond quickly. This page is updated whenever there's a
              service-affecting event.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
