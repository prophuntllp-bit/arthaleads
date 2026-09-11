import { useOutletContext } from "react-router-dom";
import { ShieldCheck, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import AgentStudio from "../../components/AgentStudio";

/**
 * The AI agent's own tab, separate from connection/credentials (Settings).
 * Configuring what the assistant says and knows is a different job, done by
 * a different person at a different cadence, from wiring up a provider.
 *
 * Same admin gate as Settings — it saves through the same PATCH
 * /whatsapp/settings endpoint, which is admin-only on the server.
 */
export default function ConversationAgent() {
  const { isAdmin, connected } = useOutletContext();

  return (
    <div className="stitch-page !pt-2">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-app">AI Agent</h1>
        <p className="text-xs text-app-soft">What your WhatsApp assistant knows and how it talks</p>
      </div>

      {!isAdmin ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
            <ShieldCheck className="w-5 h-5 text-app-soft" />
          </div>
          <p className="text-sm font-bold text-app">Only admins can change the AI agent</p>
          <p className="text-xs text-app-soft mt-1">Ask an admin in your organisation if something here needs to change.</p>
        </div>
      ) : !connected ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
            <WifiOff className="w-5 h-5 text-app-soft" />
          </div>
          <p className="text-sm font-bold text-app">Connect WhatsApp first</p>
          <p className="text-xs text-app-soft mt-1 max-w-sm mx-auto">
            The AI agent replies over your WhatsApp number, so it needs one connected before there's
            anything for it to do.
          </p>
          <Link to="/conversations/settings"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full text-sm font-semibold text-white transition"
            style={{ background: "var(--app-primary)" }}>
            Go to Settings
          </Link>
        </div>
      ) : (
        <AgentStudio />
      )}
    </div>
  );
}
