import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, MessageCircle, Wifi, WifiOff, X } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const STEPS = [
  {
    n: 1,
    title: "Create a Meta App",
    body: "Go to Meta for Developers and create a Business app. Add the WhatsApp product.",
    link: "https://developers.facebook.com/apps",
    linkLabel: "Open Meta Developers →",
  },
  {
    n: 2,
    title: "Get a permanent Access Token",
    body: 'In Business Settings → System Users → Add System User → Generate Token with "whatsapp_business_messaging" permission. Copy the token.',
    link: "https://business.facebook.com/settings/system-users",
    linkLabel: "Open Business Settings →",
  },
  {
    n: 3,
    title: "Configure the Webhook",
    body: 'In WhatsApp → Configuration, set Callback URL to your CRM webhook URL below, set Verify Token to any secret string you choose, then subscribe to "messages".',
  },
];

export default function WhatsAppSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ phoneNumberId: "", accessToken: "", businessAccountId: "", verifyToken: "", botName: "Artha Assistant", botSystemPrompt: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [phoneDisplay, setPhoneDisplay] = useState("");

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

  useEffect(() => {
    api.get("/whatsapp/settings").then(r => {
      const s = r.data.whatsapp || {};
      setSettings(s);
      setConnected(r.data.connected);
      setForm(f => ({
        ...f,
        phoneNumberId:     s.phoneNumberId     || "",
        businessAccountId: s.businessAccountId || "",
        verifyToken:       s.verifyToken       || "",
        botName:           s.botName           || "Artha Assistant",
        botSystemPrompt:   s.botSystemPrompt   || "",
      }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/whatsapp/settings", form);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      await api.patch("/whatsapp/settings", form);
      const { data } = await api.post("/whatsapp/settings/test");
      setConnected(true);
      setPhoneDisplay(data.displayPhone || "");
      toast.success(`Connected! Phone: ${data.displayPhone || "verified"}`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Connection failed");
    } finally { setTesting(false); }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect WhatsApp? Conversations will remain in the database.")) return;
    await api.patch("/whatsapp/settings", { enabled: false });
    setConnected(false);
    toast.success("WhatsApp disconnected");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${connected ? "bg-green-500/8 border border-green-500/20" : "bg-orange-500/5 border border-orange-500/15"}`}>
        {connected
          ? <Wifi className="w-4 h-4 text-green-500 shrink-0" />
          : <WifiOff className="w-4 h-4 text-orange-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-app">
            {connected ? `WhatsApp Connected${phoneDisplay ? ` · ${phoneDisplay}` : ""}` : "WhatsApp not connected"}
          </p>
          <p className="text-xs text-app-soft">
            {connected ? "Incoming messages are being received. Outgoing sending is active." : "Complete the setup below to connect your WhatsApp Business number."}
          </p>
        </div>
        {connected && (
          <button onClick={disconnect} className="shrink-0 text-xs text-red-400 hover:text-red-500 font-semibold transition flex items-center gap-1">
            <X className="w-3 h-3" /> Disconnect
          </button>
        )}
      </div>

      {/* Setup Steps */}
      {!connected && (
        <section className="card p-4 space-y-4">
          <h3 className="text-sm font-bold text-app">Setup Guide</h3>
          {STEPS.map(step => (
            <div key={step.n} className="flex gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                {step.n}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-app">{step.title}</p>
                <p className="text-xs text-app-soft mt-0.5">{step.body}</p>
                {step.link && (
                  <a href={step.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-orange-500 hover:underline">
                    {step.linkLabel} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {step.n === 3 && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-xs"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                    <span className="truncate text-orange-500">{webhookUrl}</span>
                    <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}
                      className="shrink-0 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-lg text-app-soft hover:text-app"
                      style={{ background: "var(--app-border)" }}>Copy</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Credentials */}
      <section className="card p-4 space-y-4">
        <h3 className="text-sm font-bold text-app">API Credentials</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Phone Number ID</label>
            <input className="input w-full" placeholder="e.g. 123456789012345"
              value={form.phoneNumberId} onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Permanent Access Token</label>
            <input className="input w-full" type="password" placeholder="EAAxxxxxxx..."
              value={form.accessToken} onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))} />
            <p className="text-[11px] text-app-soft mt-1">Leave blank to keep your existing token.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Business Account ID</label>
            <input className="input w-full" placeholder="e.g. 987654321098765"
              value={form.businessAccountId} onChange={e => setForm(f => ({ ...f, businessAccountId: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Webhook Verify Token</label>
            <input className="input w-full" placeholder="Any secret string you chose (e.g. artha_wh_secret)"
              value={form.verifyToken} onChange={e => setForm(f => ({ ...f, verifyToken: e.target.value }))} />
            <p className="text-[11px] text-app-soft mt-1">Must match what you entered in Meta Webhook configuration.</p>
          </div>
        </div>
      </section>

      {/* Bot Settings */}
      <section className="card p-4 space-y-4">
        <h3 className="text-sm font-bold text-app">AI Bot Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Bot Name</label>
            <input className="input w-full" placeholder="Artha Assistant"
              value={form.botName} onChange={e => setForm(f => ({ ...f, botName: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Custom Bot Instructions (optional)</label>
            <textarea className="input w-full resize-none" rows={4}
              placeholder="Leave blank to use the default real estate assistant prompt. Or write custom instructions for your bot's personality and knowledge."
              value={form.botSystemPrompt} onChange={e => setForm(f => ({ ...f, botSystemPrompt: e.target.value }))} />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={testConnection} disabled={testing || !form.phoneNumberId || !form.verifyToken}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition disabled:opacity-40"
          style={{ background: "#25D366", color: "#fff" }}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          {testing ? "Testing…" : "Test & Connect"}
        </button>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition disabled:opacity-40 btn-secondary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
