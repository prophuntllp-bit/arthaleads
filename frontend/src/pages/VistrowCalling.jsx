import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import VistrowOutboundSection from "../components/VistrowOutboundSection";

// Dedicated page for "Vistrow calls my new leads" (reached from the Vistrow Voice
// card on Integrations). Admin only; everything is off until the owner confirms.
export default function VistrowCalling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div className="stitch-page space-y-6">
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/integrations")} className="btn-ghost" aria-label="Back to Integrations">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.12)" }}>
              <Mic className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <p className="stitch-kicker mb-0.5">Integrations</p>
              <h1 className="text-xl font-black tracking-tight text-app">Auto-call new leads</h1>
              <p className="text-xs text-app-soft">Vistrow Voice agents phone new leads you choose. Nothing is called until you switch it on.</p>
            </div>
          </div>
        </div>
      </div>

      {isAdmin
        ? <VistrowOutboundSection />
        : <p className="text-sm text-app-soft">Only an admin can change these settings.</p>}
    </div>
  );
}
