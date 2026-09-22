import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../services/api";
import WhatsAppIcon from "../components/WhatsAppIcon";
import WhatsAppSettings from "../components/WhatsAppSettings";
import WhatsAppOperations from "../components/WhatsAppOperations";
import { Spinner } from "../components/UI";
import { useAuth } from "../context/AuthContext";

/**
 * WhatsApp Business connection, reached from Integrations — same job as
 * /conversations/settings (same two components, same endpoints), just
 * without leaving the Integrations section the way Telephony doesn't either.
 * /conversations/settings keeps working on its own for anyone who lands
 * there from the Inbox tab; this page is the second door into the same room.
 */
export default function WhatsAppIntegration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [connected, setConnected] = useState(null); // null = still checking

  const reloadStatus = useCallback(() => {
    api.get("/whatsapp/status")
      .then((r) => setConnected(r.data.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => { reloadStatus(); }, [reloadStatus]);

  return (
    <div className="stitch-page space-y-6">
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/integrations")} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(37,211,102,0.12)" }}>
              <WhatsAppIcon className="w-5 h-5" style={{ color: "#25D366" }} />
            </div>
            <div>
              <p className="stitch-kicker mb-0.5">Integrations</p>
              <h1 className="text-xl font-black tracking-tight text-app">WhatsApp Business</h1>
              <p className="text-xs text-app-soft">Connection, message delivery, business hours and compliance</p>
            </div>
          </div>
        </div>
      </div>

      {connected === null ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : isAdmin ? (
        <div className="space-y-5">
          <WhatsAppSettings onConnected={reloadStatus} onDisconnected={reloadStatus} />
          {connected && <WhatsAppOperations />}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <p className="text-sm font-bold text-app">Only admins can change WhatsApp settings</p>
          <p className="text-xs text-app-soft mt-1">Ask an admin in your organisation if something here needs to change.</p>
        </div>
      )}
    </div>
  );
}
