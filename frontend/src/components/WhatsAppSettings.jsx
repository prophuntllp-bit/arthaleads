import { useEffect, useState } from "react";
import {
  Check, Copy, ExternalLink, Eye, EyeOff, Loader2, RefreshCw, Wifi, WifiOff, X,
  CheckCircle2, AlertTriangle, Info, Stethoscope, XCircle, Settings2, Phone,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import WhatsAppIcon from "./WhatsAppIcon";

// One line of the credential check. Each piece is probed on its own because
// Meta reports every one of these failures with the same status code.
function DiagRow({ label, ok, detail, message }) {
  return (
    <div className="flex items-start gap-2">
      {ok
        ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" style={{ color: "#15803d" }} />
        : <XCircle className="w-4 h-4 shrink-0 mt-px" style={{ color: "#ef4444" }} />}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-app">{label}</p>
        {(detail || message) && (
          <p className="text-xs text-app-soft mt-0.5 break-words">{ok ? detail : message}</p>
        )}
      </div>
    </div>
  );
}

// Meta first: it is the only connection that supports templates, campaigns and
// the delivery check below. The BSPs still work for replying in the inbox.
const PROVIDERS = [
  {
    id: "meta",
    name: "Meta Cloud API",
    badge: "Official",
    tagline: "Direct · No middleman",
    pricing: "Templates, campaigns and inbox",
    color: "#1877F2",
    fields: ["apiKey", "wabaId", "phoneNumberId", "webhookVerifyToken"],
    signupUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    dashboardUrl: "https://developers.facebook.com",
    webhookPath: "WhatsApp → Configuration → Webhook URL + Verify Token",
    apiKeyLabel: "Permanent access token",
    apiKeyPlaceholder: "EAAxxxxx… (permanent system user token)",
    apiKeyHelp: "Business Settings → System users → Generate token, with the whatsapp_business_messaging and whatsapp_business_management permissions.",
  },
  {
    id: "aisensy",
    name: "AiSensy",
    tagline: "Most popular in India",
    pricing: "Free tier · ₹999/mo starter",
    color: "#25D366",
    fields: ["apiKey"],
    signupUrl: "https://wa.aisensy.com/short/ad5a3s",
    dashboardUrl: "https://app.aisensy.com",
    webhookPath: "Settings → API → Webhook URL",
    apiKeyLabel: "AiSensy API key",
    apiKeyPlaceholder: "Paste your AiSensy API key",
    apiKeyHelp: "AiSensy dashboard → Settings → API",
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
    apiKeyLabel: "Wati API token",
    apiKeyPlaceholder: "Paste your Wati Bearer token",
    apiKeyHelp: "Wati dashboard → Manage → API, Docs and Webhooks",
    endpointLabel: "Wati account endpoint",
    endpointPlaceholder: "https://live-mt-server.wati.io/123456",
    endpointHelp: "Your account URL from Wati (shown in dashboard top-right)",
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
    apiKeyLabel: "Interakt API key",
    apiKeyPlaceholder: "Paste your Interakt API key",
    apiKeyHelp: "Interakt dashboard → Settings → Developers → API Key",
  },
];

function StepHead({ n, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
        style={{ background: "var(--app-primary)" }}>{n}</span>
      <h3 className="text-base font-bold text-app">{children}</h3>
    </div>
  );
}

// Meta only delivers messages to apps actually subscribed to the WABA — a
// webhook URL that verified fine can still receive nothing. Shared between
// the full connect flow (step 2) and the compact "already connected" card so
// this stays checkable without switching provider.
function WebhookHealthCheck({ webhook, checking, onCheck, canCheck }) {
  return (
    <div className="rounded-xl px-3 py-3 space-y-2"
      style={webhook?.subscribed
        ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }
        : webhook
          ? { background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.3)" }
          : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
      <div className="flex items-start gap-2">
        {webhook?.subscribed
          ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#15803d" }} />
          : webhook
            ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
            : <Info className="w-4 h-4 shrink-0 mt-0.5 text-app-soft" />}
        <p className="text-xs flex-1" style={{ color: webhook?.subscribed ? "#15803d" : webhook ? "#b45309" : "var(--app-text-soft)" }}>
          {webhook?.subscribed
            ? `Incoming messages are set up${webhook.appName ? ` — ${webhook.appName} is subscribed to your business account` : ""}.`
            : webhook?.error
              ? webhook.error
              : webhook
                ? "Your app is not subscribed to this business account yet, so incoming messages will not arrive."
                : "Meta also has to be subscribed to your business account before any message arrives. Checking does that for you."}
        </p>
      </div>
      <button onClick={onCheck} disabled={checking || !canCheck}
        className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
        {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {webhook ? "Check again" : "Check incoming messages"}
      </button>
      {!canCheck && <p className="text-[11px] text-app-soft">Save your access token and Business Account ID first.</p>}
    </div>
  );
}

export default function WhatsAppSettings({ onConnected, onDisconnected } = {}) {
  // Starts unknown, not false — connected/not-connected now render two
  // completely different layouts (compact summary vs. the full connect
  // flow), so defaulting to false used to mean every page load flashed the
  // "not connected" form first and only swapped to the real state once
  // GET /whatsapp/settings resolved. On a slow or cold-starting API that
  // flash was slow enough to look like the page was stuck showing stale UI.
  const [loading, setLoading]         = useState(true);
  const [provider, setProvider]       = useState("meta");
  const [savedProvider, setSavedProvider] = useState("");
  const [connected, setConnected]     = useState(false);
  const [hasKeyRaw, setHasKeyRaw]     = useState(false);
  const [orgId, setOrgId]             = useState("");
  const [apiKey, setApiKey]           = useState("");
  const [showKey, setShowKey]         = useState(false);
  const [accountEndpoint, setAccountEndpoint] = useState("");
  const [phoneNumberId, setPhoneNumberId]     = useState("");
  const [wabaId, setWabaId]           = useState("");
  const [savedWabaId, setSavedWabaId] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [testPhone, setTestPhone]     = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [qualityRating, setQualityRating]           = useState("");
  // Once connected, switching provider is a deliberate, separate action — see
  // the "connected" render branch below — not something shown by default
  // alongside credentials that already work.
  const [showChangeProvider, setShowChangeProvider] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [testing, setTesting]         = useState(false);
  const [webhook, setWebhook]         = useState(null);   // last subscription check result
  const [checking, setChecking]       = useState(false);
  const [diag, setDiag]               = useState(null);   // last credential diagnosis
  const [diagging, setDiagging]       = useState(false);

  const prov = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];
  const isMeta = provider === "meta";

  // A saved key only counts for the provider it was saved under. Switching
  // provider (e.g. Meta → AiSensy) makes the old key useless, so force a
  // fresh one rather than letting "Connect & Test" fire with a stale token
  // the new provider will just reject.
  const hasKey = hasKeyRaw && savedProvider === provider;

  // Per-org webhook URL (works for all providers).
  //
  // Must be the API's own origin, not window.location.origin. This page is
  // served from app.arthaleads.com, which has no rewrite for /api/* — that
  // path 404s there, but Vercel's SPA catch-all turns the 404 into a 200
  // that returns index.html instead. A provider's webhook check reads that
  // 200 as success and never notices the body isn't its challenge echo, so
  // every provider using this URL (Meta included, which is stricter about
  // it) would silently fail verification while looking like it worked.
  const apiOrigin = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  const webhookUrl = orgId
    ? `${apiOrigin}/api/whatsapp/webhook/${orgId}`
    : `${apiOrigin}/api/whatsapp/webhook`;

  useEffect(() => {
    api.get("/whatsapp/settings").then(r => {
      const s = r.data.whatsapp || {};
      setConnected(r.data.connected);
      setHasKeyRaw(!!s.hasApiKey);
      setOrgId(r.data.orgId || "");
      // The stored provider defaults to "aisensy" even when nothing was ever
      // set up, so only trust it once a key has actually been saved.
      setProvider(s.hasApiKey ? (s.provider || "aisensy") : "meta");
      setSavedProvider(s.hasApiKey ? (s.provider || "aisensy") : "");
      setAccountEndpoint(s.accountEndpoint || "");
      setPhoneNumberId(s.phoneNumberId || "");
      setWabaId(s.wabaId || "");
      setSavedWabaId(s.wabaId || "");
      setWebhookVerifyToken(s.webhookVerifyToken || "");
      setDisplayPhoneNumber(s.displayPhoneNumber || "");
      setQualityRating(s.qualityRating || "");
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied");
  };

  const buildPatch = () => {
    const patch = { provider };
    if (apiKey.trim())             patch.apiKey             = apiKey.trim();
    if (accountEndpoint.trim())    patch.accountEndpoint    = accountEndpoint.trim();
    if (phoneNumberId.trim())      patch.phoneNumberId      = phoneNumberId.trim();
    if (webhookVerifyToken.trim()) patch.webhookVerifyToken = webhookVerifyToken.trim();
    if (isMeta)                    patch.wabaId             = wabaId.trim();
    return patch;
  };

  const afterSave = () => {
    setHasKeyRaw(true);
    setSavedProvider(provider);
    if (isMeta) setSavedWabaId(wabaId.trim());
    setApiKey("");
    setShowChangeProvider(false);
  };

  const connectAndTest = async () => {
    if (!apiKey.trim() && !hasKey) { toast.error("Enter your access key first"); return; }
    if (!testPhone.trim())          { toast.error("Enter a phone number for the test message"); return; }
    setTesting(true);
    try {
      await api.patch("/whatsapp/settings", buildPatch());
      afterSave();
      const { data } = await api.post("/whatsapp/settings/test", { testPhone: testPhone.replace(/\D/g, "") });
      setConnected(true);
      if (data?.webhook?.applicable) setWebhook(data.webhook);
      if (data?.webhook?.applicable && !data.webhook.subscribed) {
        toast("Test message sent — but incoming messages are not set up yet. See step 2.", { icon: "⚠️", duration: 8000 });
      } else {
        toast.success("WhatsApp connected. Check your phone for the test message.");
      }
      onConnected?.();
    } catch (e) {
      const d = e.response?.data;
      toast.error(d?.detail ? `${d.message} ${d.detail}` : (d?.message || "Connection failed. Check your credentials."), { duration: 8000 });
    } finally { setTesting(false); }
  };

  // For changing one field (a new WABA ID, a rotated token) without sending
  // another test message. Only offered once a key is already saved.
  const saveOnly = async () => {
    setSavingCreds(true);
    try {
      await api.patch("/whatsapp/settings", buildPatch());
      afterSave();
      toast.success("Saved");
      onConnected?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not save");
    } finally { setSavingCreds(false); }
  };

  // Checks the saved token and both IDs separately. Meta answers an expired
  // token, a WABA id that is really a phone number id, and a missing object all
  // with the same HTTP 400, so only a per-piece probe can say which it is.
  const runDiagnose = async () => {
    setDiagging(true);
    try {
      const { data } = await api.get("/whatsapp/settings/diagnose");
      setDiag(data);
      if (data.ok) toast.success("Connection looks good");
    } catch (e) {
      setDiag({ applicable: true, ok: false, token: { ok: false, message: e.response?.data?.message || "Check failed" }, warnings: [] });
    } finally { setDiagging(false); }
  };

  const checkWebhook = async () => {
    setChecking(true);
    try {
      const { data } = await api.post("/whatsapp/settings/webhook-check");
      setWebhook(data);
      if (data.subscribed) toast.success("Incoming messages are set up");
    } catch (e) {
      setWebhook({ applicable: true, subscribed: false, error: e.response?.data?.message || "Check failed" });
    } finally { setChecking(false); }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect WhatsApp? Your conversation history will be kept.")) return;
    try {
      await api.patch("/whatsapp/settings", { enabled: false });
      setConnected(false);
      toast.success("Disconnected");
      onDisconnected?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not disconnect");
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="card p-5 h-24 animate-pulse" style={{ background: "var(--app-surface-low)" }} />
        <div className="card p-5 h-40 animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      </div>
    );
  }

  // Already connected AND not deliberately changing provider: show a compact
  // summary instead of every other vendor's card. Seeing "Meta / AiSensy /
  // Wati / Interakt" side by side once you're live reads as "you could just
  // click one of these" — you can't, not safely, since it needs entirely new
  // credentials and interrupts delivery until reconnected. That choice is now
  // gated behind an explicit "Change provider" action instead of sitting in
  // front of you by default.
  if (connected && !showChangeProvider) {
    const connectedProv = PROVIDERS.find(p => p.id === savedProvider) || prov;
    return (
      <div className="space-y-5">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${connectedProv.color}18` }}>
                <WhatsAppIcon className="w-5 h-5" style={{ color: connectedProv.color }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-app">{connectedProv.name}</p>
                  {connectedProv.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: `${connectedProv.color}1f`, color: connectedProv.color }}>{connectedProv.badge}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(34,197,94,0.1)", color: "#15803d" }}>
                    <Wifi className="w-3 h-3" /> Connected
                  </span>
                </div>
                <p className="text-xs text-app-soft mt-0.5 flex items-center gap-2 flex-wrap">
                  {displayPhoneNumber && (
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{displayPhoneNumber}</span>
                  )}
                  {qualityRating && (
                    <span>Quality: <span style={{
                      color: qualityRating === "GREEN" ? "#15803d" : qualityRating === "RED" ? "#b91c1c" : "#b45309",
                      fontWeight: 600,
                    }}>{qualityRating}</span></span>
                  )}
                  {!displayPhoneNumber && !qualityRating && "Credentials saved and verified."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowChangeProvider(true)}
                className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Change provider
              </button>
              <button onClick={disconnect} className="text-sm text-red-400 hover:text-red-500 font-semibold flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          </div>

          {isMeta && (
            <WebhookHealthCheck webhook={webhook} checking={checking} onCheck={checkWebhook}
              canCheck={hasKey && !!savedWabaId} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Status */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={connected
          ? { background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.3)" }
          : { background: "rgba(var(--app-primary-rgb),0.05)", border: "1px solid var(--app-border)" }}>
        {connected
          ? <Wifi className="w-4 h-4 shrink-0" style={{ color: "#b45309" }} />
          : <WifiOff className="w-4 h-4 text-app-soft shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-app">{connected ? "Changing provider" : "WhatsApp not connected"}</p>
          <p className="text-sm text-app-soft">
            {connected
              ? `Your current ${(PROVIDERS.find(p => p.id === savedProvider) || prov).name} connection stays active until you test or save a new one below.`
              : "Pick a provider below and follow the steps to connect."}
          </p>
        </div>
        {connected && (
          <button onClick={() => setShowChangeProvider(false)} className="text-sm text-app-soft hover:text-app font-semibold shrink-0">
            Cancel
          </button>
        )}
      </div>

      {/* ── Step 1: Choose provider ──────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <StepHead n={1}>Choose your WhatsApp provider</StepHead>
        <p className="text-sm text-app-soft pl-8">
          Connect directly to Meta, or through a provider (AiSensy, Wati, Interakt) that handles
          Meta verification for you. Templates and campaigns need the direct Meta connection.
        </p>
        <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
              className="text-left rounded-xl p-3 transition-all"
              style={provider === p.id
                ? { background: `${p.color}18`, border: `1.5px solid ${p.color}55` }
                : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="text-sm font-bold text-app">{p.name}</span>
                {p.badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                    style={{ background: `${p.color}1f`, color: p.color }}>{p.badge}</span>
                )}
                {provider === p.id && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: p.color }} />}
              </div>
              <p className="text-xs text-app-soft">{p.tagline}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: p.color }}>{p.pricing}</p>
            </button>
          ))}
        </div>
        <div className="pl-8 flex flex-wrap gap-2">
          <a href={prov.signupUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white transition"
            style={{ background: prov.color }}>
            <WhatsAppIcon className="w-4 h-4" />
            {isMeta ? "Meta setup guide" : `Create ${prov.name} account`}
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
          <a href={prov.dashboardUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-app-soft hover:text-app transition"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            Open dashboard <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        </div>
      </div>

      {/* ── Step 2: Webhook ──────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <StepHead n={2}>Set your webhook URL in {prov.name}</StepHead>
        <p className="text-sm text-app-soft pl-8">
          In your {prov.name} dashboard → {prov.webhookPath}, paste this URL so incoming messages,
          delivery updates and read receipts reach your inbox:
        </p>
        <div className="pl-8 space-y-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <code className="flex-1 text-xs text-orange-500 truncate">{webhookUrl}</code>
            <button onClick={copyWebhook}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-app-soft hover:text-app transition"
              style={{ background: "var(--app-border)" }}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>

          {/* Meta verifies the URL and still delivers nothing until the app is
              subscribed to the business account — this checks that step. */}
          {isMeta && (
            <WebhookHealthCheck webhook={webhook} checking={checking} onCheck={checkWebhook}
              canCheck={hasKey && !!savedWabaId} />
          )}
        </div>
      </div>

      {/* ── Step 3: Credentials ──────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <StepHead n={3}>Enter your {prov.name} credentials</StepHead>

        <div className="pl-8 space-y-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">{prov.apiKeyLabel}</label>
            <div className="relative">
              <input className="input w-full pr-11" type={showKey ? "text" : "password"} autoComplete="off"
                placeholder={hasKey ? "Saved — enter a new one to replace it" : prov.apiKeyPlaceholder}
                value={apiKey} onChange={e => setApiKey(e.target.value)} />
              <button type="button" onClick={() => setShowKey(v => !v)} title={showKey ? "Hide" : "Show"}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-app-soft hover:text-app transition">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-app-soft mt-1">{prov.apiKeyHelp}</p>
          </div>

          {prov.fields.includes("wabaId") && (
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">WhatsApp Business Account ID</label>
              <input className="input w-full font-mono" placeholder="e.g. 102290129340398" inputMode="numeric"
                value={wabaId} onChange={e => setWabaId(e.target.value.replace(/\D/g, ""))} />
              <p className="text-xs text-app-soft mt-1">WhatsApp Manager → Account tools → the ID under your business name. Needed for templates and campaigns.</p>
            </div>
          )}

          {prov.fields.includes("accountEndpoint") && (
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">{prov.endpointLabel}</label>
              <input className="input w-full" type="url"
                placeholder={prov.endpointPlaceholder}
                value={accountEndpoint} onChange={e => setAccountEndpoint(e.target.value)} />
              <p className="text-xs text-app-soft mt-1">{prov.endpointHelp}</p>
            </div>
          )}

          {prov.fields.includes("phoneNumberId") && (
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Phone number ID</label>
              <input className="input w-full font-mono" placeholder="e.g. 123456789012345" inputMode="numeric"
                value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value.replace(/\D/g, ""))} />
              <p className="text-xs text-app-soft mt-1">WhatsApp Manager → Phone numbers → the ID beside your number (not the number itself).</p>
            </div>
          )}

          {prov.fields.includes("webhookVerifyToken") && (
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Webhook verify token</label>
              <input className="input w-full" placeholder="A secret string you choose (e.g. artha-webhook-2024)"
                value={webhookVerifyToken} onChange={e => setWebhookVerifyToken(e.target.value)} />
              <p className="text-xs text-app-soft mt-1">Enter the same string in Meta when you add the webhook URL.</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Your WhatsApp number (receives the test message)</label>
            <input className="input w-full" type="tel" placeholder="e.g. 919876543210 (with country code, no +)"
              value={testPhone} onChange={e => setTestPhone(e.target.value)} />
            {isMeta && (
              <p className="text-xs mt-1.5 rounded-xl px-3 py-2"
                style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#b45309" }}>
                Meta only delivers the test message if this phone has messaged your business number in
                the last 24 hours. Send it a quick “hi” first.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button onClick={connectAndTest} disabled={testing || savingCreds || (!apiKey.trim() && !hasKey)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition disabled:opacity-40 text-white"
              style={{ background: prov.color }}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
              {testing ? "Connecting…" : connected ? "Reconnect & test" : "Connect & test"}
            </button>
            {hasKey && (
              <button onClick={saveOnly} disabled={testing || savingCreds}
                className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40">
                {savingCreds ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save without testing
              </button>
            )}
            {isMeta && hasKey && (
              <button onClick={runDiagnose} disabled={diagging || testing || savingCreds}
                className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40">
                {diagging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
                Check credentials
              </button>
            )}
          </div>
          <p className="text-xs text-app-soft">
            {isMeta
              ? "Saves your credentials, sends a test message to the number above and subscribes your app to incoming messages."
              : "Saves your credentials and sends a test message to the number above."}
          </p>

          {diag?.applicable && (
            <div className="rounded-2xl p-3.5 space-y-2" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <DiagRow label="Access token" ok={diag.token?.ok} message={diag.token?.message}
                detail={diag.token?.ok ? "Valid" : null} />
              <DiagRow label="Business Account ID" ok={diag.waba?.ok} message={diag.waba?.message}
                detail={diag.waba?.ok ? [diag.waba.name, diag.waba.currency].filter(Boolean).join(" · ") : null} />
              <DiagRow label="Phone number ID" ok={diag.phone?.ok} message={diag.phone?.message}
                detail={diag.phone?.ok ? [diag.phone.displayPhoneNumber, diag.phone.verifiedName].filter(Boolean).join(" · ") : null} />
              {(diag.warnings || []).map((w, i) => (
                <p key={i} className="text-xs rounded-xl px-3 py-2 flex items-start gap-1.5"
                  style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.3)", color: "#b45309" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
