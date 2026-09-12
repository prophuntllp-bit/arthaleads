import { useEffect, useState, useCallback } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Mail, FileText, Megaphone, Wallet, Settings as SettingsIcon, ShieldCheck, Sparkles } from "lucide-react";
import api from "../../services/api";
import WhatsAppSettings from "../../components/WhatsAppSettings";
import WhatsAppIcon from "../../components/WhatsAppIcon";
import { Spinner } from "../../components/UI";
import { useAuth } from "../../context/AuthContext";

/**
 * Shell for everything under /conversations.
 *
 * Navigation lives here as in-page tabs rather than sidebar children: five
 * WhatsApp screens in a sidebar flyout buried the ones that earn money and
 * split navigation across two places.
 *
 * The connect gate lives here too, and it asks /whatsapp/status rather than
 * /whatsapp/settings. /settings is admin/manager-only, so an agent's 403 used
 * to read as "not connected" and lock them out of the inbox entirely. Credits
 * are fetched once and handed down through the outlet, so the inbox pill and
 * the credits page cannot disagree.
 *
 * Builders (new template, new campaign) are NOT tabs. They are their own
 * routes with a back button, because a multi-step form does not belong in a
 * tab strip you can wander out of mid-edit.
 */

const TABS = [
  { to: "/conversations",           label: "Inbox",     icon: Mail, end: true },
  { to: "/conversations/templates", label: "Templates", icon: FileText },
  { to: "/conversations/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/conversations/credits",   label: "Credits",   icon: Wallet },
  // PATCH /whatsapp/settings is admin-only, so a manager opening this would
  // get a 403 on save. Hide rather than tease. Same gate on Agent — it saves
  // through the same endpoint.
  { to: "/conversations/agent",     label: "AI Agents", icon: Sparkles,     roles: ["admin", "super_admin"] },
  { to: "/conversations/settings",  label: "Settings",  icon: SettingsIcon, roles: ["admin", "super_admin"] },
];

const PROVIDER_NAME = { meta: "Meta Cloud API", aisensy: "AiSensy", wati: "Wati", interakt: "Interakt" };

export default function ConversationsLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [connected, setConnected] = useState(null); // null = still checking
  const [channel, setChannel]     = useState(null);
  const [credits, setCredits]     = useState(null);
  const [unread, setUnread]       = useState(0);

  const refreshCredits = useCallback(() => {
    api.get("/credits/balance").then((r) => setCredits(r.data)).catch(() => {});
  }, []);

  const reloadStatus = useCallback(() => {
    api.get("/whatsapp/status")
      .then((r) => { setConnected(r.data.connected); setChannel(r.data); })
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => { reloadStatus(); }, [reloadStatus]);
  useEffect(() => { refreshCredits(); }, [refreshCredits]);

  // The Inbox tab's unread number. Polled slowly — the inbox itself refreshes
  // every few seconds; this is only the glance-at count on the tab.
  useEffect(() => {
    if (!connected) return undefined;
    let alive = true;
    const tick = () => api.get("/whatsapp/unread")
      .then((r) => { if (alive) setUnread(r.data.unread || 0); })
      .catch(() => {});
    tick();
    const iv = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(iv); };
  }, [connected]);

  const tabs = TABS.filter((t) => !t.roles || t.roles.includes(user?.role));

  // Builder routes own the full width and bring their own back button.
  const isBuilder = /\/(new|[a-f0-9]{24})$/i.test(location.pathname);

  if (connected === null) {
    return (
      <div className="stitch-page flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (connected === false) {
    return (
      <div className="stitch-page">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(37,211,102,0.12)" }}>
            <WhatsAppIcon className="w-5 h-5" style={{ color: "#25D366" }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-app">WhatsApp Conversations</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
                Disconnected
              </span>
            </div>
            <p className="text-xs text-app-soft">Connect your number to start receiving and sending messages</p>
          </div>
        </div>

        {isAdmin ? (
          <WhatsAppSettings onConnected={() => { reloadStatus(); refreshCredits(); }} />
        ) : (
          // Only an admin can save WhatsApp credentials, so anyone else gets an
          // explanation instead of a form that would 403 on submit.
          <div className="card p-10 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
              <ShieldCheck className="w-5 h-5 text-app-soft" />
            </div>
            <p className="text-sm font-bold text-app">WhatsApp is not connected yet</p>
            <p className="text-xs text-app-soft mt-1 max-w-sm mx-auto">
              An admin needs to connect your organisation&apos;s WhatsApp number. Conversations will appear here once they do.
            </p>
          </div>
        )}
      </div>
    );
  }

  const ctx = { credits, refreshCredits, connected, setConnected, reloadStatus, channel, isAdmin };

  if (isBuilder) return <Outlet context={ctx} />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* One row that never wraps — a second row would steal height from the
          chat below. It scrolls sideways on narrow screens instead. */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-4" style={{ borderBottom: "1px solid var(--app-border)" }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 overflow-x-auto pb-3 flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition"
                style={({ isActive }) => (isActive
                  ? { background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }
                  : { color: "var(--app-text-soft)" })}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {to === "/conversations" && unread > 0 && (
                  <span className="text-[10px] font-bold min-w-[20px] px-1.5 py-px rounded-full text-center"
                    style={{ background: "rgba(var(--app-primary-rgb),0.16)", color: "var(--app-primary)" }}>
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
                {to === "/conversations/credits" && credits && credits.availablePaise <= 0 && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#b91c1c" }} />
                )}
              </NavLink>
            ))}
          </div>

          {channel?.provider && (
            <span className="hidden md:inline-flex items-center gap-1.5 mb-3 shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(37,211,102,0.10)", color: "#15803d", border: "1px solid rgba(37,211,102,0.25)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#25D366" }} />
              {PROVIDER_NAME[channel.provider] || channel.provider}
              {channel.displayPhoneNumber ? ` · ${channel.displayPhoneNumber}` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-4">
        <Outlet context={ctx} />
      </div>
    </div>
  );
}
