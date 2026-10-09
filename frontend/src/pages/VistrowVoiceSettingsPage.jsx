import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import VistrowOutboundSection from "../components/VistrowOutboundSection";
import { VistrowVoiceIcon, VoiceConnectionPanel } from "../components/VistrowVoiceSettings";

// Dedicated settings page for the Vistrow Voice integration (replaces the old popup).
//   /integrations/vistrow-voice    -> Connection (the token Vistrow uses to send calls in)
//   /integrations/vistrow-calling  -> Auto-call new leads (off until an admin confirms)
export default function VistrowVoiceSettingsPage({ tab = "connection" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const tabs = [
    { key: "connection", label: "Connection", path: "/integrations/vistrow-voice" },
    { key: "calling", label: "Auto-call new leads", path: "/integrations/vistrow-calling" },
  ];

  return (
    <div className="stitch-page space-y-6">
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/integrations")} className="btn-ghost" aria-label="Back to Integrations">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"><VistrowVoiceIcon size={36} /></div>
            <div>
              <p className="stitch-kicker mb-0.5">Integrations</p>
              <h1 className="text-xl font-black tracking-tight text-app">Vistrow Voice settings</h1>
              <p className="text-xs text-app-soft">AI calling platform. Nothing is called until you switch it on.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-testid={`tab-${t.key}`}
            onClick={() => navigate(t.path, { replace: true })}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === t.key ? "btn-primary" : "btn-secondary"}`}>{t.label}</button>
        ))}
      </div>

      {!isAdmin
        ? <p className="text-sm text-app-soft">Only an admin can change these settings.</p>
        : tab === "connection" ? <VoiceConnectionPanel /> : <VistrowOutboundSection />}
    </div>
  );
}
