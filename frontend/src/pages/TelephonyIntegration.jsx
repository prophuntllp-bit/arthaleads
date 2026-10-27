// TelephonyIntegration.jsx — /integrations/telephony: which phone service
// click-to-call goes through, and a card for each. Each service's settings
// live on its own page (owner, 27 Oct 2026): /integrations/telephony/plivo
// and /integrations/telephony/enablex.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { IntegrationShell, IntegrationCard, LogoTile, SectionTitle } from "../components/integrations/IntegrationUI";

const PhoneLogo = ({ size = 40 }) => (
  <LogoTile size={size} bg="rgba(249,115,22,0.10)"><Phone className="h-5 w-5" style={{ color: "#f97316" }} /></LogoTile>
);

const PROVIDERS = {
  plivo:   { label: "Plivo",   path: "/integrations/telephony/plivo",   line: "Your phone rings first, then the lead. Each side is recorded separately, so transcripts show who said what." },
  enablex: { label: "EnableX", path: "/integrations/telephony/enablex", line: "Click-to-call through your EnableX number, with recordings and the in-app browser phone." },
};

export default function TelephonyIntegration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [provider, setProvider] = useState(null);
  const [plivo, setPlivo] = useState(null);
  const [enablex, setEnablex] = useState(null);
  const [switching, setSwitching] = useState("");

  useEffect(() => {
    api.get("/plivo/settings").then((r) => { setProvider(r.data.provider); setPlivo(r.data.plivo); }).catch(() => setProvider("enablex"));
    api.get("/calls/settings").then((r) => setEnablex(r.data)).catch(() => setEnablex({ connected: false }));
  }, []);

  const switchTo = async (key) => {
    if (key === provider || switching) return;
    setSwitching(key);
    try {
      const { data } = await api.patch("/plivo/settings", { provider: key });
      setProvider(key);
      toast.success(`Calls now go through ${PROVIDERS[key].label}.`);
      if (data?.inbound && data.inbound !== "connected") toast.error(`Incoming calls ${data.inbound}. Open Plivo settings to connect them.`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not switch.");
    } finally { setSwitching(""); }
  };

  const ready = { plivo: !!(plivo?.hasAuthToken && plivo?.number), enablex: !!enablex?.connected };
  const footer = {
    plivo: ready.plivo ? `Calls go out from +${plivo.number}` : "Not set up yet",
    enablex: ready.enablex ? `Number ${enablex?.enablex?.virtualNumber || "saved"}` : "Not set up yet",
  };

  return (
    <IntegrationShell
      logo={<PhoneLogo size={52} />}
      name="Telephony"
      status={provider ? `Calls through ${PROVIDERS[provider].label}` : undefined}
      statusTone="on"
      description="Click-to-call from the CRM and the app, call recordings and AI call summaries. Call history stays the same whichever service you use."
      actions={isAdmin && provider ? (
        <div role="radiogroup" aria-label="Calls go through" className="inline-flex items-center gap-1 rounded-full p-1"
          style={{ border: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
          <span className="text-xs font-semibold text-app-soft px-2">Calls go through</span>
          {Object.entries(PROVIDERS).map(([key, p]) => {
            const on = provider === key;
            return (
              <button key={key} type="button" role="radio" aria-checked={on} onClick={() => switchTo(key)} disabled={!!switching}
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60"
                style={on ? { background: "var(--app-primary)", color: "#fff" } : { color: "var(--app-text-soft)" }}>
                {switching === key && <Loader2 className="h-3 w-3 animate-spin" />} {p.label}
              </button>
            );
          })}
        </div>
      ) : null}
    >
      <SectionTitle title="Phone services" note="Open one to see its calls, change its settings or set it up." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {["plivo", "enablex"].map((key) => (
          <IntegrationCard key={key}
            logo={<PhoneLogo />}
            name={PROVIDERS[key].label}
            category="Telephony"
            status={provider === key ? "In use" : ready[key] ? "Connected" : "Not connected"}
            statusTone={provider === key ? "on" : "off"}
            description={PROVIDERS[key].line}
            footer={footer[key]}
            action={ready[key] ? "Manage" : "Set up"}
            onOpen={() => navigate(PROVIDERS[key].path)} />
        ))}
      </div>
    </IntegrationShell>
  );
}
