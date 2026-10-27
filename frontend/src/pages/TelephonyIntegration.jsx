// TelephonyIntegration.jsx — /integrations/telephony: which phone service
// click-to-call goes through, and a card for each. Each service's settings
// live on its own page (owner, 27 Oct 2026): /integrations/telephony/plivo
// and /integrations/telephony/enablex.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { IntegrationShell, IntegrationCard, LogoTile, SectionTitle, BrandLogo } from "../components/integrations/IntegrationUI";

const PhoneLogo = ({ size = 40 }) => (
  <LogoTile size={size} bg="rgba(249,115,22,0.10)"><Phone className="h-5 w-5" style={{ color: "#f97316" }} /></LogoTile>
);

// "918065492852" reads as "+91 80 6549 2852".
const showNumber = (n) => (/^91\d{10}$/.test(n || "") ? `+91 ${n.slice(2, 4)} ${n.slice(4, 8)} ${n.slice(8)}` : `+${n}`);

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

  // One service is always the one calls go through: switching one on turns the
  // other off; switching the one in use off hands calls to the other, if it's set up.
  const toggle = (key, next) => {
    if (next) return switchTo(key);
    const other = key === "plivo" ? "enablex" : "plivo";
    if (!ready[other]) { toast.error(`Click-to-call needs one phone service on. Set up ${PROVIDERS[other].label} before switching ${PROVIDERS[key].label} off.`); return; }
    return switchTo(other);
  };

  const ready = { plivo: !!(plivo?.hasAuthToken && plivo?.number), enablex: !!enablex?.connected };
  const footer = {
    plivo: ready.plivo ? `Calls go out from ${showNumber(plivo.number)}` : "Not set up yet",
    enablex: ready.enablex ? `Number ${enablex?.enablex?.virtualNumber || "saved"}` : "Not set up yet",
  };

  return (
    <IntegrationShell
      logo={<PhoneLogo size={52} />}
      name="Telephony"
      status={provider ? `Calls through ${PROVIDERS[provider].label}` : undefined}
      statusTone="on"
      description="Click-to-call from the CRM and the app, call recordings and AI call summaries. Call history stays the same whichever service you use."
    >
      <SectionTitle title="Phone services" note="Switch on the one your calls should go through; only one can be on. Open a card for its calls and settings." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {["plivo", "enablex"].map((key) => (
          <IntegrationCard key={key}
            logo={<BrandLogo brand={key} alt={PROVIDERS[key].label} />}
            name={PROVIDERS[key].label}
            category="Telephony"
            status={provider === key ? "In use" : ready[key] ? "Connected" : "Not connected"}
            statusTone={provider === key ? "on" : "off"}
            toggle={isAdmin && provider ? {
              on: provider === key,
              busy: !!switching,
              disabled: !ready[key] && provider !== key,
              title: !ready[key] && provider !== key ? `Set up ${PROVIDERS[key].label} first` : "",
              onChange: (next) => toggle(key, next),
            } : undefined}
            description={PROVIDERS[key].line}
            footer={footer[key]}
            action={ready[key] ? "Manage" : "Set up"}
            onOpen={() => navigate(PROVIDERS[key].path)} />
        ))}
      </div>
    </IntegrationShell>
  );
}
