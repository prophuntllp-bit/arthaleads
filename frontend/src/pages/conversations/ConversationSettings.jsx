import { useOutletContext } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import WhatsAppSettings from "../../components/WhatsAppSettings";
import WhatsAppOperations from "../../components/WhatsAppOperations";

/**
 * Settings as its own route, not only a modal: linkable, survives a refresh,
 * and has room for the connection, delivery check and operational settings
 * together. The AI assistant's own configuration lives on its own tab
 * (Conversations → AI Agent) — a different job, done by a different person.
 *
 * The tab is hidden from non-admins, but the URL can still be typed. Saving is
 * admin-only on the server, so anyone else gets an explanation rather than a
 * form that fails on submit.
 */
export default function ConversationSettings() {
  const { reloadStatus, refreshCredits, isAdmin, connected } = useOutletContext();

  return (
    <div className="stitch-page !pt-2">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-app">WhatsApp settings</h1>
        <p className="text-xs text-app-soft">Connection, message delivery, business hours and compliance</p>
      </div>

      {isAdmin ? (
        <div className="space-y-5">
          <WhatsAppSettings
            onConnected={() => { reloadStatus?.(); refreshCredits?.(); }}
            onDisconnected={() => reloadStatus?.()} />
          {connected && <WhatsAppOperations />}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
            <ShieldCheck className="w-5 h-5 text-app-soft" />
          </div>
          <p className="text-sm font-bold text-app">Only admins can change WhatsApp settings</p>
          <p className="text-xs text-app-soft mt-1">Ask an admin in your organisation if something here needs to change.</p>
        </div>
      )}
    </div>
  );
}
