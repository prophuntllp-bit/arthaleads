import { useEffect, useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import api from "../../services/api";
import WhatsAppSettings from "../../components/WhatsAppSettings";
import WhatsAppIcon from "../../components/WhatsAppIcon";
import { Spinner } from "../../components/UI";

/**
 * Shell for everything under /conversations.
 *
 * The connect gate lives here rather than in each page: before this existed
 * Inbox ran it alone and returned bare `null` while the settings call was in
 * flight, which showed as a blank white screen. Sub-pages would each have
 * needed their own copy of the same check, and each would have got that same
 * bug.
 *
 * Credits are fetched once here too and handed down through the outlet, so the
 * inbox pill and the credits page never disagree about the balance.
 */
export default function ConversationsLayout() {
  const [connected, setConnected] = useState(null); // null = still checking
  const [credits, setCredits]     = useState(null);

  const refreshCredits = useCallback(() => {
    api.get("/credits/balance").then(r => setCredits(r.data)).catch(() => {});
  }, []);

  const checkConnection = useCallback(() => {
    api.get("/whatsapp/settings")
      .then(r => setConnected(r.data.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);
  useEffect(() => { refreshCredits(); }, [refreshCredits]);

  if (connected === null) {
    return (
      <div className="stitch-page flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // Not connected: no sub-page is reachable or meaningful yet, so the whole
  // section collapses to setup. The sidebar children stay visible but every
  // one of them lands here until a number is connected.
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

  return <Outlet context={{ credits, refreshCredits, connected, setConnected }} />;
}
