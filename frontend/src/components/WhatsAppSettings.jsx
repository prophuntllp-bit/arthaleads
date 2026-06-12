import { useEffect, useState } from "react";
import {
  Check, Copy, ExternalLink, Loader2, MessageCircle, Wifi, WifiOff, X,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const PROVIDERS = [
  {
    id: "aisensy",
    name: "AiSensy",
    tagline: "Most popular in India",
    pricing: "Free tier · ₹999/mo starter",
    color: "#25D366",
    fields: ["apiKey"],
    signupUrl: "https://aisensy.com/?ref=arthaleads",
    dashboardUrl: "https://app.aisensy.com",
    webhookPath: "Settings → API → Webhook URL",
    apiKeyLabel: "AiSensy API Key",
    apiKeyPlaceholder: "Paste your AiSensy API key",
    apiKeyHelp: "AiSensy dashboard → Settings → API",
    testNote: null,
  },
  {
    id: "wati",
    name: "Wati",
    tagline: "Global · Easy BSP",
    pricing: "$49/mo starter",
    color: "#4f46e5",
    fields: ["apiKey", "accountEndpoint"],
    signupUrl: "https://wati.io",
    dashboardUrl: "https://app.wati.io",
    webhookPath: "Settings → API & Webhooks → Webhook URL",
    apiKeyLabel: "Wati API Token",
    apiKeyPlaceholder: "Paste your Wati Bearer token",
    apiKeyHelp: "Wati dashboard → Manage → API, Docs and Webhooks",
    endpointLabel: "Wati Account Endpoint",
    endpointPlaceholder: "https://live-mt-server.wati.io/123456",
    endpointHelp: "Your account URL from Wati (shown in dashboard top-right)",
    testNote: null,
  },
  {
    id: "interakt",
    name: "Interakt",
    tagline: "By Jio Haptik · India BSP",
    pricing: "₹999/mo starter",
    color: "#f97316",
    fields: ["apiKey"],
    signupUrl: "https://app.interakt.ai/signup",
    dashboardUrl: "https://app.interakt.ai",
    webhookPath: "Settings → Developers → Webhook URL",
    apiKeyLabel: "Interakt API Key",
    apiKeyPlaceholder: "Paste your Interakt API key",
    apiKeyHelp: "Interakt dashboard → Settings → Developers → API Key",
    testNote: null,
  },
  {
    id: "meta",
    name: "Meta Cloud API",
    tagline: "Direct · No middleman",
    pricing: "Free API · Requires Meta Business",
    color: "#1877F2",
    fields: ["apiKey", "phoneNumberId", "webhookVerifyToken"],
    signupUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    dashboardUrl: "https://developers.facebook.com",
    webhookPath: "WhatsApp → Configuration → Webhook URL + Verify Token",
    apiKeyLabel: "Permanent Access Token",
    apiKeyPlaceholder: "EAAxxxxx… (permanent system user token)",
    apiKeyHelp: "Meta Business Manager → System Users → Generate Token",
    testNote: "Meta requires the customer to have messaged your business first within the last 24 hours before you can send a free-form message.",
  },
];

export default function WhatsAppSettings({ onConnected } = {}) {
  const [provider, setProvider]       = useState("aisensy");
  const [connected, setConnected]     = useState(false);
  const [hasKey, setHasKey]           = useState(false);
  const [orgId, setOrgId]             = useState("");
  const [apiKey, setApiKey]           = useState("");
  const [accountEndpoint, setAccountEndpoint] = useState("");
  const [phoneNumberId, setPhoneNumberId]     = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [testPhone, setTestPhone]     = useState("");
  const [botName, setBotName]         = useState("Artha Assistant");
  const [botPrompt, setBotPrompt]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [testing, setTesting]         = useState(false);

  const prov = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  // Per-org webhook URL (works for all providers)
  const webhookUrl = orgId
    ? `${window.location.origin}/api/whatsapp/webhook/${orgId}`
    : `${window.location.origin}/api/whatsapp/webhook`;

  useEffect(() => {
    api.get("/whatsapp/settings").then(r => {
      const s = r.data.whatsapp || {};
      setConnected(r.data.connected);
      setHasKey(!!s.hasApiKey);
      setOrgId(r.data.orgId || "");
      setProvider(s.provider || "aisensy");
      setAccountEndpoint(s.accountEndpoint || "");
      setPhoneNumberId(s.phoneNumberId || "");
      setWebhookVerifyToken(s.webhookVerifyToken || "");
      setBotName(s.botName || "Artha Assistant");
      setBotPrompt(s.botSystemPrompt || "");
    }).catch(() => {});
  }, []);

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied!");
  };

  const connectAndTest = async () => {
    if (!apiKey.trim() && !hasKey) { toast.error("Enter your API key first"); return; }
    if (!testPhone.trim())          { toast.error("Enter a phone number for the test message"); return; }
    setTesting(true);
    try {
      const patch = { provider };
      if (apiKey.trim())            patch.apiKey            = apiKey.trim();
      if (accountEndpoint.trim())   patch.accountEndpoint   = accountEndpoint.trim();
      if (phoneNumberId.trim())     patch.phoneNumberId     = phoneNumberId.trim();
      if (webhookVerifyToken.trim()) patch.webhookVerifyToken = webhookVerifyToken.trim();
      await api.patch("/whatsapp/settings", patch);
      await api.post("/whatsapp/settings/test", { testPhone: testPhone.replace(/\D/g, "") });
      setConnected(true);
      setHasKey(true);
      toast.success("WhatsApp connected! Check your phone for the test message.");
      onConnected?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Connection failed. Check your credentials.");
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
    toast.success("Disconnected");
  };

  return (
    <div className="space-y-5 max-w-xl">

      {/* Status badge */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={connected
          ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }
          : { background: "rgba(var(--app-primary-rgb),0.05)", border: "1px solid var(--app-border)" }}>
        {connected
          ? <Wifi className="w-4 h-4 text-green-500 shrink-0" />
          : <WifiOff className="w-4 h-4 text-app-soft shrink-0" />}
        <div className="flex-1">
          <p className="text-sm font-semibold text-app">{connected ? "WhatsApp Connected" : "WhatsApp not connected"}</p>
          <p className="text-xs text-app-soft">{connected ? `Connected via ${prov.name}. AI bot is active.` : "Pick a provider below and follow the steps to connect."}</p>
        </div>
        {connected && (
          <button onClick={disconnect} className="text-xs text-red-400 hover:text-red-500 font-semibold flex items-center gap-1 shrink-0">
            <X className="w-3 h-3" /> Disconnect
          </button>
        )}
      </div>

      {/* ── Step 1: Choose provider ──────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: "var(--app-primary)" }}>1</span>
          <h3 className="text-sm font-bold text-app">Choose your WhatsApp provider</h3>
        </div>
        <p className="text-xs text-app-soft pl-8">All options let you send and receive WhatsApp messages. BSPs (AiSensy, Wati, Interakt) handle Meta verification for you — no developer setup needed.</p>
        <div className="pl-8 grid grid-cols-2 gap-2">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
              className="text-left rounded-xl p-3 transition-all"
              style={provider === p.id
                ? { background: `${p.color}18`, border: `1.5px solid ${p.color}55` }
                : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="text-xs font-bold text-app">{p.name}</span>
                {provider === p.id && <Check className="w-3 h-3 ml-auto" style={{ color: p.color }} />}
              </div>
              <p className="text-[10px] text-app-soft">{p.tagline}</p>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: p.color }}>{p.pricing}</p>
            </button>
          ))}
        </div>
        <div className="pl-8 flex flex-wrap gap-2">
          <a href={prov.signupUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition"
            style={{ background: prov.color }}>
            <MessageCircle className="w-3.5 h-3.5" />
            Create {prov.name} account
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
          <a href={prov.dashboardUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-app-soft hover:text-app transition"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            Open dashboard <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      </div>

      {/* ── Step 2: Webhook ──────────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: "var(--app-primary)" }}>2</span>
          <h3 className="text-sm font-bold text-app">Set your Webhook URL in {prov.name}</h3>
        </div>
        <p className="text-xs text-app-soft pl-8">
          In your {prov.name} dashboard → {prov.webhookPath}, paste this URL so incoming messages reach your inbox:
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

      {/* ── Step 3: Credentials ──────────────────────────────────────────────── */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: "var(--app-primary)" }}>3</span>
          <h3 className="text-sm font-bold text-app">Enter your {prov.name} credentials</h3>
        </div>

        {prov.testNote && (
          <div className="ml-8 rounded-xl px-3 py-2 text-xs text-amber-700"
            style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)" }}>
            {prov.testNote}
          </div>
        )}

        <div className="pl-8 space-y-3">
          {/* API Key (all providers) */}
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">{prov.apiKeyLabel}</label>
            <input className="input w-full" type="password"
              placeholder={hasKey ? "Saved — enter new key to replace" : prov.apiKeyPlaceholder}
              value={apiKey} onChange={e => setApiKey(e.target.value)} />
            <p className="text-[10px] text-app-soft mt-1">{prov.apiKeyHelp}</p>
          </div>

          {/* Wati: custom endpoint */}
          {prov.fields.includes("accountEndpoint") && (
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">{prov.endpointLabel}</label>
              <input className="input w-full" type="url"
                placeholder={prov.endpointPlaceholder}
                value={accountEndpoint} onChange={e => setAccountEndpoint(e.target.value)} />
              <p className="text-[10px] text-app-soft mt-1">{prov.endpointHelp}</p>
            </div>
          )}

          {/* Meta: phone number ID */}
          {prov.fields.includes("phoneNumberId") && (
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Phone Number ID</label>
              <input className="input w-full" placeholder="e.g. 123456789012345"
                value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} />
              <p className="text-[10px] text-app-soft mt-1">Meta Business Manager → WhatsApp → Phone Numbers → Phone Number ID</p>
            </div>
          )}

          {/* Meta: webhook verify token */}
          {prov.fields.includes("webhookVerifyToken") && (
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Webhook Verify Token</label>
              <input className="input w-full" placeholder="A secret string you choose (e.g. artha-webhook-2024)"
                value={webhookVerifyToken} onChange={e => setWebhookVerifyToken(e.target.value)} />
              <p className="text-[10px] text-app-soft mt-1">Set the same string in Meta dashboard when configuring the webhook</p>
            </div>
          )}

          {/* Test phone */}
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Your WhatsApp number (to receive test message)</label>
            <input className="input w-full" type="tel" placeholder="e.g. 919876543210 (with country code, no +)"
              value={testPhone} onChange={e => setTestPhone(e.target.value)} />
          </div>

          <button onClick={connectAndTest} disabled={testing || (!apiKey.trim() && !hasKey)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition disabled:opacity-40 text-white"
            style={{ background: prov.color }}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {testing ? "Connecting…" : connected ? "Reconnect & Test" : "Connect & Test"}
          </button>
        </div>
      </div>

      {/* ── Bot settings ─────────────────────────────────────────────────────── */}
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
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Custom Instructions <span className="text-app-soft font-normal">(optional)</span>
              </label>
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
