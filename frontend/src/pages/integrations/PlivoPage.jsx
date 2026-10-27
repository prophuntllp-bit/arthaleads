// PlivoPage.jsx — /integrations/telephony/plivo: Plivo click-to-call on its
// own page (owner, 27 Oct 2026). Overview, Settings (the credentials form),
// Setup help. Backend: /api/plivo.
import { useCallback, useEffect, useState } from "react";
import { PhoneIncoming, PhoneCall, Clock, Link2, Mic, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PlivoSettings from "../../components/PlivoSettings";
import { IntegrationShell, BrandLogo, Panel, KeyValues, Steps, ago, istWhen } from "../../components/integrations/IntegrationUI";

const showNumber = (n) => (/^91\d{10}$/.test(n || "") ? `+91 ${n.slice(2, 4)} ${n.slice(4, 8)} ${n.slice(8)}` : n ? `+${n}` : "-");

export default function PlivoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [tab, setTab] = useState("overview");
  const [d, setD] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    api.get("/plivo/settings").then((r) => setD(r.data)).catch(() => {});
    api.get("/plivo/call-stats", { params: { provider: "plivo" } }).then((r) => setStats(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const p = d?.plivo || {};
  const ready = !!(p.hasAuthToken && p.number);
  const inUse = d?.provider === "plivo";

  const test = async () => {
    setBusy("test"); setNote(null);
    try { const { data } = await api.post("/plivo/settings/test"); setNote({ ok: true, text: data.message }); load(); }
    catch (e) { setNote({ ok: false, text: e?.response?.data?.message || "Could not reach Plivo." }); }
    finally { setBusy(""); }
  };
  const use = async () => {
    setBusy("use");
    try {
      const { data } = await api.patch("/plivo/settings", { provider: "plivo" });
      toast.success("Calls now go through Plivo.");
      if (data?.inbound && data.inbound !== "connected") toast.error(`Incoming calls ${data.inbound}.`);
      load();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not switch."); }
    finally { setBusy(""); }
  };

  return (
    <IntegrationShell
      back="/integrations/telephony" backLabel="Telephony"
      logo={<BrandLogo brand="plivo" alt="Plivo" size={52} />}
      name="Plivo"
      status={!d ? undefined : inUse ? "In use" : ready ? "Connected" : "Not connected"}
      statusTone={inUse ? "on" : "off"}
      description="Your phone rings first; when you answer, the lead is dialled from your Plivo number. Each side is recorded on its own channel, so the transcript shows who said what."
      actions={isAdmin && d ? (
        <>
          {note && (
            <span className="text-xs flex items-center gap-1.5 max-w-xs" style={{ color: note.ok ? "#15803d" : "#dc2626" }}>
              {note.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />} {note.text}
            </span>
          )}
          {p.hasAuthToken && (
            <button type="button" onClick={test} disabled={!!busy} className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {busy === "test" && <Loader2 className="h-4 w-4 animate-spin" />} Test connection
            </button>
          )}
          {ready && !inUse && (
            <button type="button" onClick={use} disabled={!!busy} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {busy === "use" && <Loader2 className="h-4 w-4 animate-spin" />} Use Plivo for calls
            </button>
          )}
        </>
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
          <div className="space-y-4">
            <Panel icon={Link2} title="Connection">
              <KeyValues rows={[
                ["Status", inUse ? "In use for calls" : ready ? "Connected, not in use" : "Not connected"],
                ["Auth ID", p.authId || "-"],
                ["Calls go out from", showNumber(p.number)],
                ["Incoming calls", p.inboundConnected ? "Connected" : "Not connected"],
                stats?.lastAt ? ["Last call", istWhen(stats.lastAt)] : null,
              ]} />
            </Panel>
            <Panel icon={PhoneIncoming} title="Incoming calls">
              <p className="text-sm text-app-soft">
                A lead who calls your Plivo number rings the team member who last called them (or the next one in rotation). The call is logged on the lead and recorded.
              </p>
            </Panel>
          </div>
          <Panel icon={Mic} title="Recordings and transcripts">
            <KeyValues rows={[
              ["Recording", "Both sides, on separate channels"],
              ["Transcript", "Each line labelled agent or lead"],
              ["Summary", "AI summary after every answered call"],
              ["Stored", "On Plivo, with a copy in your file space where it is set up"],
            ]} />
          </Panel>
        </div>
      )}

      {tab === "settings" && isAdmin && <PlivoSettings bare onSaved={load} />}

      {tab === "help" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <Panel title="Set it up">
            <Steps items={[
              "In the Plivo console, open the Overview page and copy the Auth ID and Auth Token.",
              "Paste both on the Settings tab and save. Your Plivo number is picked up from the account.",
              "Click Use Plivo for calls. Incoming calls to the number are connected at the same time.",
              "Call a lead from the CRM: your phone rings first, then the lead's.",
            ]} />
          </Panel>
          <Panel title="Rules in India">
            <p className="text-sm text-app-soft">
              The Plivo account must be in the India data region with KYC approved, and calls stay within India. Use a landline (Local) number for calls to people who enquired. Cold or promotional calls are not allowed under TRAI rules.
            </p>
          </Panel>
        </div>
      )}
    </IntegrationShell>
  );
}
