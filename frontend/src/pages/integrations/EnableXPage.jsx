// EnableXPage.jsx — /integrations/telephony/enablex: EnableX click-to-call on
// its own page (owner, 27 Oct 2026). Overview, Settings (the existing form),
// Setup help. Backend: /api/calls/settings.
import { useCallback, useEffect, useState } from "react";
import { PhoneIncoming, PhoneCall, Clock, Link2, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import EnableXSettings from "../../components/EnableXSettings";
import { IntegrationShell, BrandLogo, Panel, KeyValues, Steps, ago, istWhen } from "../../components/integrations/IntegrationUI";

export default function EnableXPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [tab, setTab] = useState("overview");
  const [d, setD] = useState(null);
  const [provider, setProvider] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/calls/settings").then((r) => setD(r.data)).catch(() => setD({ connected: false }));
    api.get("/plivo/settings").then((r) => setProvider(r.data.provider)).catch(() => setProvider("enablex"));
    api.get("/plivo/call-stats", { params: { provider: "enablex" } }).then((r) => setStats(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const e = d?.enablex || {};
  const ready = !!d?.connected;
  const inUse = provider === "enablex";

  const use = async () => {
    setBusy(true);
    try { await api.patch("/plivo/settings", { provider: "enablex" }); toast.success("Calls now go through EnableX."); load(); }
    catch (err) { toast.error(err?.response?.data?.message || "Could not switch."); }
    finally { setBusy(false); }
  };

  return (
    <IntegrationShell
      back="/integrations/telephony" backLabel="Telephony"
      logo={<BrandLogo brand="enablex" alt="EnableX" size={52} />}
      name="EnableX"
      status={!d ? undefined : inUse ? "In use" : ready ? "Connected" : "Not connected"}
      statusTone={inUse ? "on" : "off"}
      description="Click-to-call through your EnableX number, with call recordings, AI summaries and the in-app browser phone."
      actions={isAdmin && d && ready && !inUse ? (
        <button type="button" onClick={use} disabled={busy} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Use EnableX for calls
        </button>
      ) : null}
      stats={[
        { icon: PhoneCall, label: "Calls · 7 days", value: stats ? stats.total.toLocaleString("en-IN") : "-" },
        { icon: CheckCircle2, label: "Answered · 7 days", value: stats ? stats.answered.toLocaleString("en-IN") : "-" },
        { icon: PhoneIncoming, label: "Incoming · 7 days", value: stats ? stats.inbound.toLocaleString("en-IN") : "-" },
        { icon: Clock, label: "Last call", value: stats?.lastAt ? ago(stats.lastAt) : "None yet" },
      ]}
      tabs={[{ key: "overview", label: "Overview" }, ...(isAdmin ? [{ key: "settings", label: "Settings" }] : []), { key: "help", label: "Setup help" }]}
      tab={tab} onTab={setTab}
    >
      {tab === "overview" && d && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <Panel icon={Link2} title="Connection">
            <KeyValues rows={[
              ["Status", inUse ? "In use for calls" : ready ? "Connected, not in use" : "Not connected"],
              ["App ID", e.appId || "-"],
              ["Virtual number", e.virtualNumber || "-"],
              ["In-app browser phone", e.webrtc?.enabled ? "On" : "Off"],
              ["AI status updates", e.aiAutoStatus ? "On" : "Off"],
              stats?.lastAt ? ["Last call", istWhen(stats.lastAt)] : null,
            ]} />
          </Panel>
          <Panel icon={PhoneIncoming} title="Incoming calls">
            <p className="text-sm text-app-soft">
              A lead who calls your EnableX number is connected to the team member who last spoke with them, or to anyone available if there is no earlier call.
              EnableX support sets the answer URL from the Settings tab on your number.
            </p>
          </Panel>
        </div>
      )}

      {tab === "settings" && isAdmin && <section className="card p-6" style={{ boxShadow: "none" }}><EnableXSettings /></section>}

      {tab === "help" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <Panel title="Set it up">
            <Steps items={[
              "In the EnableX dashboard, open your project's Settings and copy the APP ID and APP KEY.",
              "Paste them with your virtual number on the Settings tab and save.",
              "Paste the webhook URL from the Settings tab into EnableX (Voice, then Webhook) so recordings reach you.",
              "Ask EnableX support to set the inbound answer URL on your number for incoming calls.",
            ]} />
          </Panel>
          <Panel title="In-app browser phone">
            <p className="text-sm text-app-soft">
              Optional. Agents talk from the browser instead of their phone ringing first. It uses your EnableX Video API App ID and Key, which are separate from the Voice keys.
            </p>
          </Panel>
        </div>
      )}
    </IntegrationShell>
  );
}
