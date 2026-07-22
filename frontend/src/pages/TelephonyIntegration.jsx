import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone } from "lucide-react";
import EnableXSettings from "../components/EnableXSettings";

export default function TelephonyIntegration() {
  const navigate = useNavigate();

  return (
    <div className="stitch-page space-y-6">
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/automation")} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.12)" }}>
              <Phone className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="stitch-kicker mb-0.5">Automation</p>
              <h1 className="text-xl font-black tracking-tight text-app">Telephony Integration</h1>
              <p className="text-xs text-app-soft">Connect EnableX for click-to-call, recordings and AI summaries</p>
            </div>
          </div>
        </div>
      </div>

      <EnableXSettings />
    </div>
  );
}
