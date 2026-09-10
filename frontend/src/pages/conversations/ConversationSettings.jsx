import { useOutletContext } from "react-router-dom";
import WhatsAppSettings from "../../components/WhatsAppSettings";

/**
 * Settings as its own route rather than only a modal.
 *
 * The modal stays — it is the right affordance for a quick credential fix
 * without losing your place in a conversation. This route exists so the screen
 * is linkable, survives a refresh, and has somewhere to grow: business profile,
 * quality rating and messaging tier all belong here and none of them fit
 * comfortably in a dialog.
 */
export default function ConversationSettings() {
  const { setConnected, refreshCredits } = useOutletContext();

  return (
    <div className="stitch-page">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-app">WhatsApp settings</h1>
        <p className="text-xs text-app-soft">Connection, credentials and the AI assistant</p>
      </div>

      <WhatsAppSettings
        onConnected={() => { setConnected(true); refreshCredits(); }}
      />
    </div>
  );
}
