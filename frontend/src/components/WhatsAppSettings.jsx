import { useEffect, useState } from "react";
import {
  Check, CheckCircle2, ChevronRight, Copy, ExternalLink,
  Loader2, MessageCircle, Wifi, WifiOff, X,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const AISENSY_SIGNUP = "https://aisensy.com/?ref=arthaleads";
const AISENSY_DASHBOARD = "https://app.aisensy.com";

export default function WhatsAppSettings({ onConnected } = {}) {
  const [connected, setConnected]   = useState(false);
  const [hasKey, setHasKey]         = useState(false);
  const [apiKey, setApiKey]         = useState("");
  const [testPhone, setTestPhone]   = useState("");
  const [botName, setBotName]       = useState("Artha Assistant");
  const [botPrompt, setBotPrompt]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [step, setStep]             = useState(1); // 1 = connect, 2 = done

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

  useEffect(() => {
    api.get("/whatsapp/settings").then(r => {
      const s = r.data.whatsapp || {};
      setConnected(r.data.connected);
      setHasKey(!!s.hasApiKey);
      setBotName(s.botName || "Artha Assistant");
      setBotPrompt(s.botSystemPrompt || "");
      if (r.data.connected) setStep(2);
    }).catch(() => {});
  }, []);

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied!");
  };

  const connectAndTest = async () => {
    if (!apiKey.trim()) { toast.error("Paste your AiSensy API key first"); return; }
    if (!testPhone.trim()) { toast.error("Enter a phone number to send a test message to"); return; }
    setTesting(true);
    try {
      await api.patch("/whatsapp/settings", { apiKey: apiKey.trim() });
      await api.post("/whatsapp/settings/test", { testPhone: testPhone.replace(/\D/g, "") });
      setConnected(true);
      setHasKey(true);
      setStep(2);
      toast.success("WhatsApp connected! Check your phone for the test message.");
      onConnected?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Connection failed. Check your API key.");
    } finally { setTesting(false); }
  };

  const saveBotSettings = async () => {
    setSaving(true);
    try {
      await api.patch("/whatsapp/settings", { botName, botSystemPrompt: botPrompt });
      toast.success("Bot settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect WhatsApp? Your conversation history will be kept.")) return;
    await api.patch("/whatsapp/settings", { enabled: false });
    setConnected(false);
    setStep(1);
    toast.success("Disconnected");
  };

  return (
    <div className="space-y-5 max-w-xl">

      {/* Status badge */}
      <div className={`flex items-center gap-3 rounded-2xl px-4 py-3`}
        style={connected
          ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }
          : { background: "rgba(var(--app-primary-rgb),0.05)", border: "1px solid var(--app-border)" }}>
        {connected
          ? <Wifi className="w-4 h-4 text-green-500 shrink-0" />
          : <WifiOff className="w-4 h-4 text-app-soft shrink-0" />}
        <div className="flex-1">
          <p className="text-sm font-semibold text-app">{connected ? "WhatsApp Connected" : "WhatsApp not connected"}</p>
          <p className="text-xs text-app-soft">{connected ? "Receiving messages and AI bot is active." : "Follow the steps below to connect."}</p>
        </div>
        {connected && (
          <button onClick={disconnect} className="text-xs text-red-400 hover:text-red-500 font-semibold flex items-center gap-1 shrink-0">
            <X className="w-3 h-3" /> Disconnect
          </button>
        )}
      </div>

      {/* ── Step 1: Get AiSensy ─────────────────────────────────────────────── */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${connected ? "bg-green-500 text-white" : "text-white"}`}
            style={!connected ? { background: "var(--app-primary)" } : {}}>
            {connected ? <Check className="w-3.5 h-3.5" /> : "1"}
          </span>
          <h3 className="text-sm font-bold text-app">Sign up on AiSensy</h3>
        </div>
        <p className="text-xs text-app-soft pl-8">
          AiSensy manages all WhatsApp Business verification for you — no Meta developer setup needed. Create a free account, connect your WhatsApp number through their guided flow, and you're done.
        </p>
        <div className="pl-8 flex flex-wrap gap-2">
          <a href={AISENSY_SIGNUP} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition"
            style={{ background: "#25D366" }}>
            <MessageCircle className="w-3.5 h-3.5" />
            Create AiSensy account
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
          <a href={AISENSY_DASHBOARD} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-app-soft transition hover:text-app"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            Open AiSensy dashboard
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      </div>

      {/* ── Step 2: Webhook ─────────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${connected ? "bg-green-500 text-white" : "text-white"}`}
            style={!connected ? { background: "var(--app-primary)" } : {}}>
            {connected ? <Check className="w-3.5 h-3.5" /> : "2"}
          </span>
          <h3 className="text-sm font-bold text-app">Set your Webhook URL in AiSensy</h3>
        </div>
        <p className="text-xs text-app-soft pl-8">
          In AiSensy dashboard → Settings → Webhook, paste this URL so incoming WhatsApp messages reach your inbox:
        </p>
        <div className="pl-8">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <code className="flex-1 text-[11px] text-orange-500 truncate">{webhookUrl}</code>
            <button onClick={copyWebhook}
              className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-app-soft hover:text-app transition"
              style={{ background: "var(--app-border)" }}>
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
        </div>
      </div>

      {/* ── Step 3: Paste API key ────────────────────────────────────────────── */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${connected ? "bg-green-500 text-white" : "text-white"}`}
            style={!connected ? { background: "var(--app-primary)" } : {}}>
            {connected ? <Check className="w-3.5 h-3.5" /> : "3"}
          </span>
          <h3 className="text-sm font-bold text-app">Paste your AiSensy API key</h3>
        </div>
        <p className="text-xs text-app-soft pl-8">
          In AiSensy → Settings → API, copy your API key and paste it below.
        </p>
        <div className="pl-8 space-y-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">AiSensy API Key</label>
            <input className="input w-full" type="password"
              placeholder={hasKey ? "API key saved — enter new key to replace" : "Paste your AiSensy API key here"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Your WhatsApp number (to receive test message)</label>
            <input className="input w-full" type="tel" placeholder="e.g. 919876543210 (with country code, no +)"
              value={testPhone} onChange={e => setTestPhone(e.target.value)} />
          </div>
          <button onClick={connectAndTest} disabled={testing || (!apiKey.trim() && !hasKey)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition disabled:opacity-40 text-white"
            style={{ background: "#25D366" }}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {testing ? "Connecting…" : connected ? "Reconnect & Test" : "Connect & Test"}
          </button>
        </div>
      </div>

      {/* ── Bot settings (shown once connected) ─────────────────────────────── */}
      {(connected || hasKey) && (
        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-bold text-app">AI Bot Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Bot Name</label>
              <input className="input w-full" placeholder="Artha Assistant"
                value={botName} onChange={e => setBotName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Custom Instructions <span className="text-app-soft font-normal">(optional)</span></label>
              <textarea className="input w-full resize-none" rows={3}
                placeholder="Leave blank for default real estate assistant. Write custom personality or knowledge instructions here."
                value={botPrompt} onChange={e => setBotPrompt(e.target.value)} />
            </div>
            <button onClick={saveBotSettings} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-40 btn-secondary">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? "Saving…" : "Save Bot Settings"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
