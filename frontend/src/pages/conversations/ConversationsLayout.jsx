import { useEffect, useState, useCallback } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { MessagesSquare, LayoutTemplate, Megaphone, Zap, Settings as SettingsIcon } from "lucide-react";
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
 * The connect gate also lives here rather than in each page. Inbox used to run
 * it alone and returned bare `null` while the settings call was in flight,
 * which rendered as a blank white screen — every sub-page would have inherited
 * that same bug. Credits are fetched once here too and handed down through the
 * outlet, so the inbox pill and the credits page cannot disagree.
 *
 * Builders (new template, new campaign) are NOT tabs. They are their own
 * routes with a back button, because a multi-step form does not belong in a
 * tab strip you can accidentally navigate away from mid-edit.
 */

const TABS = [
  { to: "/conversations",           label: "Inbox",     icon: MessagesSquare, end: true },
  { to: "/conversations/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/conversations/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/conversations/credits",   label: "Credits",   icon: Zap },
  // PATCH /whatsapp/settings is admin-only, so a manager opening this would
  // get a 403 on save. Hide rather than tease.
  { to: "/conversations/settings",  label: "Settings",  icon: SettingsIcon, roles: ["admin", "super_admin"] },
];

export default function ConversationsLayout() {
  const [connected, setConnected] = useState(null); // null = still checking
  const [credits, setCredits]     = useState(null);
  const { user } = useAuth();
  const location = useLocation();

  const refreshCredits = useCallback(() => {
    api.get("/credits/balance").then(r => setCredits(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/whatsapp/settings")
      .then(r => setConnected(r.data.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => { refreshCredits(); }, [refreshCredits]);

  const tabs = TABS.filter(t => !t.roles || t.roles.includes(user?.role));

  // Builder routes hide the tab strip — they own the full width and provide
  // their own back button.
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(37,211,102,0.12)" }}>
            <WhatsAppIcon className="w-5 h-5" style={{ color: "#25D366" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-app">WhatsApp Conversations</h1>
            <p className="text-xs text-app-soft">Connect your number to start receiving and sending messages</p>
          </div>
        </div>
        <WhatsAppSettings onConnected={() => { setConnected(true); refreshCredits(); }} />
      </div>
    );
  }

  const ctx = { credits, refreshCredits, connected, setConnected };

  if (isBuilder) return <Outlet context={ctx} />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Tab strip — scrolls horizontally on narrow screens rather than wrapping
          into two rows and stealing height from the chat below. */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition"
              style={({ isActive }) => isActive
                ? { background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }
                : { color: "var(--app-text-soft)" }}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {to === "/conversations/credits" && credits && credits.availablePaise <= 0 && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#ef4444" }} />
              )}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Outlet context={ctx} />
      </div>
    </div>
  );
}
