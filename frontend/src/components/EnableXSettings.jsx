import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, ExternalLink, Loader2, Phone, Wifi, WifiOff, X, Sparkles, Headphones } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

export default function EnableXSettings() {
  const [appId,          setAppId]          = useState("");
  const [apiKey,         setApiKey]         = useState("");
  const [virtualNumber,  setVirtualNumber]  = useState("");
  const [hasApiKey,      setHasApiKey]      = useState(false);
  const [connected,      setConnected]      = useState(false);
  const [orgId,          setOrgId]          = useState("");
  const [saving,         setSaving]         = useState(false);
  const [testing,        setTesting]        = useState(false);
  const [showApiKey,     setShowApiKey]     = useState(false);
  const [aiAutoStatus,   setAiAutoStatus]   = useState(false);
  const [togglingAI,     setTogglingAI]     = useState(false);
  const [inboundUrl,     setInboundUrl]     = useState("");
  // In-app soft phone (EnableX Video API) — separate credentials from Voice above.
  const [webrtcEnabled,  setWebrtcEnabled]  = useState(false);
  const [videoAppId,     setVideoAppId]     = useState("");
  const [videoAppKey,    setVideoAppKey]    = useState("");
  const [hasVideoAppKey, setHasVideoAppKey] = useState(false);
  const [showVideoKey,   setShowVideoKey]   = useState(false);
  const [savingWebrtc,   setSavingWebrtc]   = useState(false);

  // Must point at the API server (api.arthaleads.com), not the CRM web app's own
  // origin (www.arthaleads.com) - the web app has no /api proxy, so EnableX's
  // webhook calls would silently fail to reach the backend if pasted from there.
  const serverBase = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  const webhookUrl = orgId
    ? `${serverBase}/api/calls/webhook/${orgId}`
    : `${serverBase}/api/calls/webhook`;

  useEffect(() => {
    api.get("/calls/settings").then(r => {
      const s = r.data.enablex || {};
      setConnected(r.data.connected);
      setHasApiKey(!!s.hasApiKey);
      setOrgId(r.data.orgId || "");
      setAppId(s.appId  || "");
      setApiKey(s.apiKey || "");
      setVirtualNumber(s.virtualNumber || "");
      setAiAutoStatus(!!s.aiAutoStatus);
      setInboundUrl(r.data.inboundUrl || "");
      const w = s.webrtc || {};
      setWebrtcEnabled(!!w.enabled);
      setVideoAppId(w.videoAppId || "");
      setHasVideoAppKey(!!w.hasVideoAppKey);
    }).catch(() => {});
  }, []);

  const saveWebrtc = async () => {
    if (!videoAppId.trim()) { toast.error("Enter your EnableX Video App ID"); return; }
    if (!videoAppKey.trim() && !hasVideoAppKey) { toast.error("Enter your EnableX Video App Key"); return; }
    setSavingWebrtc(true);
    try {
      const patch = { webrtcEnabled: true, videoAppId: videoAppId.trim() };
      if (videoAppKey.trim()) patch.videoAppKey = videoAppKey.trim();
      await api.patch("/calls/settings", patch);
      setWebrtcEnabled(true);
      setHasVideoAppKey(true);
      setVideoAppKey("");
      toast.success("In-app calling enabled.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Save failed.");
    } finally { setSavingWebrtc(false); }
  };

  const toggleWebrtc = async () => {
    const next = !webrtcEnabled;
    if (next && (!videoAppId.trim() || !hasVideoAppKey)) {
      toast.error("Add your Video App ID and Key first.");
      return;
    }
    try {
      await api.patch("/calls/settings", { webrtcEnabled: next });
      setWebrtcEnabled(next);
      toast.success(next ? "In-app calling enabled" : "In-app calling disabled");
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const toggleAiAutoStatus = async () => {
    setTogglingAI(true);
    const next = !aiAutoStatus;
    try {
      await api.patch("/calls/settings", { aiAutoStatus: next });
      setAiAutoStatus(next);
      toast.success(next ? "AI auto-status enabled" : "AI auto-status disabled");
    } catch {
      toast.error("Failed to update setting");
    } finally { setTogglingAI(false); }
  };

  const save = async () => {
    if (!appId.trim())          { toast.error("Enter your EnableX APP ID"); return; }
    if (!apiKey.trim() && !hasApiKey) { toast.error("Enter your EnableX APP KEY"); return; }
    setSaving(true);
    try {
      const patch = { appId: appId.trim() };
      if (apiKey.trim())         patch.apiKey        = apiKey.trim();
      if (virtualNumber.trim())  patch.virtualNumber = virtualNumber.trim();
      await api.patch("/calls/settings", patch);
      setHasApiKey(true);
      toast.success("Credentials saved.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Save failed.");
    } finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      await api.post("/calls/settings/test");
      setConnected(true);
      toast.success("EnableX connected successfully!");
    } catch (e) {
      toast.error(e.response?.data?.message || "Connection failed. Check credentials.");
    } finally { setTesting(false); }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect EnableX telephony? Call history will be kept.")) return;
    await api.patch("/calls/settings", { enabled: false });
    setConnected(false);
    toast.success("Disconnected.");
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied!");
  };

  const copyInboundUrl = () => {
    navigator.clipboard.writeText(inboundUrl);
    toast.success("Answer URL copied!");
  };

  return (
    <div className="space-y-5">

      {/* Status */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={connected
          ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }
          : { background: "rgba(var(--app-primary-rgb),0.05)", border: "1px solid var(--app-border)" }}>
        {connected
          ? <Wifi    className="w-4 h-4 text-green-500 shrink-0" />
          : <WifiOff className="w-4 h-4 text-app-soft shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-app">{connected ? "EnableX Connected" : "EnableX not connected"}</p>
          <p className="text-sm text-app-soft">{connected ? "Click-to-call and call recording are active." : "Enter your credentials below to enable telephony."}</p>
        </div>
        {connected && (
          <button onClick={disconnect} className="shrink-0 text-sm text-red-400 hover:text-red-500 font-semibold flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Disconnect
          </button>
        )}
      </div>

      {/* Step 1: Credentials */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: "var(--app-primary)" }}>1</span>
          <h3 className="text-base font-bold text-app">Enter EnableX credentials</h3>
        </div>
        <p className="text-sm text-app-soft pl-8">
          From your{" "}
          <a href="https://portal.enablex.io" target="_blank" rel="noopener noreferrer"
            className="text-orange-500 hover:underline inline-flex items-center gap-0.5">
            EnableX dashboard <ExternalLink className="w-3 h-3" />
          </a>{" "}
          → select your project → <strong>Settings</strong> to get the APP ID and APP KEY.
        </p>

        <div className="pl-8 space-y-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">APP ID</label>
            <input className="input w-full" placeholder="e.g. f4a1b2c3d5..."
              autoComplete="off"
              value={appId} onChange={e => setAppId(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">APP KEY</label>
            <div className="relative">
              <input className="input w-full pr-10" type={showApiKey ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Paste your APP KEY"
                value={apiKey} onChange={e => setApiKey(e.target.value)} />
              <button type="button" onClick={() => setShowApiKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app transition">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Virtual Phone Number</label>
            <input className="input w-full" type="tel" placeholder="e.g. +919876543210"
              value={virtualNumber} onChange={e => setVirtualNumber(e.target.value)} />
            <p className="text-xs text-app-soft mt-1">The DID number assigned to your EnableX project (calls will show this number).</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition disabled:opacity-40 btn-secondary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Credentials"}
            </button>
            {hasApiKey && (
              <button onClick={testConnection} disabled={testing}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition disabled:opacity-40 text-white"
                style={{ background: "#22c55e" }}>
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {testing ? "Testing…" : "Test & Enable"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: Webhook */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: "var(--app-primary)" }}>2</span>
          <h3 className="text-base font-bold text-app">Set Webhook URL in EnableX</h3>
        </div>
        <p className="text-sm text-app-soft pl-8">
          In EnableX dashboard → your project → <strong>Voice → Webhook</strong>, paste this URL so call recordings reach Arthaleads:
        </p>
        <div className="pl-8">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <code className="flex-1 text-xs text-orange-500 truncate">{webhookUrl}</code>
            <button onClick={copyWebhook}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-app-soft hover:text-app transition"
              style={{ background: "var(--app-border)" }}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>
      </div>

      {/* Step 3: Inbound Answer URL */}
      {inboundUrl && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
              style={{ background: "var(--app-primary)" }}>3</span>
            <h3 className="text-base font-bold text-app">Set Answer URL for inbound calls</h3>
          </div>
          <p className="text-sm text-app-soft pl-8">
            When a lead calls your virtual number, the call is automatically routed to the agent who last spoke with them.
            Share this URL with <strong>EnableX support</strong> and ask them to set it as the <strong>Inbound Webhook / Answer URL</strong> for your DID number, or find it in EnableX portal → your <strong>Voice App</strong> → <strong>Settings</strong> → Inbound Webhook:
          </p>
          <div className="pl-8">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <code className="flex-1 text-xs text-orange-500 truncate">{inboundUrl}</code>
              <button onClick={copyInboundUrl}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-app-soft hover:text-app transition"
                style={{ background: "var(--app-border)" }}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
            <p className="text-xs text-app-soft mt-2">
              Inbound calls are automatically bridged to the right agent. If no prior contact exists, the call goes to any available team member.
            </p>
          </div>
        </div>
      )}

      {/* What you get */}
      {connected && (
        <div className="rounded-2xl px-4 py-3 space-y-1.5"
          style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Active features</p>
          {[
            "Click-to-call from any lead profile",
            "Automatic call recording saved to lead timeline",
            "AI transcription + summary after each call",
            "Sentiment detection (positive / neutral / negative)",
          ].map(f => (
            <div key={f} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <p className="text-sm text-app">{f}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Auto-Status toggle */}
      {connected && (
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(99,102,241,0.10)" }}>
                <Sparkles className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-app">AI Auto-Status Updates</p>
                <p className="text-xs text-app-soft mt-0.5 max-w-xs">
                  When AI detects intent from a call, automatically advance the lead status
                  (e.g. "site visit" → <strong>Site Visit</strong>, "negotiation" → <strong>Negotiation</strong>).
                  Disable if the AI makes too many mistakes.
                </p>
              </div>
            </div>
            <button
              onClick={toggleAiAutoStatus}
              disabled={togglingAI}
              className="shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50"
              style={{ background: aiAutoStatus ? "var(--app-primary)" : "var(--app-border)" }}
              title={aiAutoStatus ? "Click to disable" : "Click to enable"}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                style={{ transform: aiAutoStatus ? "translateX(1.375rem)" : "translateX(0.25rem)" }}
              />
            </button>
          </div>
          {aiAutoStatus && (
            <div className="mt-3 ml-12 rounded-xl px-3 py-2 text-xs text-app-soft"
              style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
              <strong className="text-app">Active:</strong> AI will update lead status after each analysed call.
              If a lead says "book a site visit" the status moves to <strong>Site Visit</strong> automatically.
            </div>
          )}
        </div>
      )}

      {/* In-app calling (WebRTC soft phone) — optional, separate from the DID flow */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(249,115,22,0.10)" }}>
              <Headphones className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-app">In-app calling (browser phone)</p>
              <p className="text-xs text-app-soft mt-0.5 max-w-md">
                Let agents talk to leads directly from the browser — no phone rings on the agent's side, so it
                avoids the carrier "no answer" drops. Uses your EnableX <strong>Video API</strong> credentials
                (separate from the Voice APP ID/KEY above). Leave off to keep using the standard call flow.
              </p>
            </div>
          </div>
          <button
            onClick={toggleWebrtc}
            className="shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
            style={{ background: webrtcEnabled ? "var(--app-primary)" : "var(--app-border)" }}
            title={webrtcEnabled ? "Click to disable" : "Click to enable"}
          >
            <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: webrtcEnabled ? "translateX(1.375rem)" : "translateX(0.25rem)" }} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Video App ID</label>
            <input className="input w-full" placeholder="EnableX Video API App ID"
              autoComplete="off"
              value={videoAppId} onChange={e => setVideoAppId(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">
              Video App Key {hasVideoAppKey && <span className="text-green-500">(saved)</span>}
            </label>
            <div className="relative">
              <input className="input w-full pr-10" type={showVideoKey ? "text" : "password"}
                autoComplete="new-password"
                placeholder={hasVideoAppKey ? "Leave blank to keep current key" : "Paste your Video App Key"}
                value={videoAppKey} onChange={e => setVideoAppKey(e.target.value)} />
              <button type="button" onClick={() => setShowVideoKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app transition">
                {showVideoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={saveWebrtc} disabled={savingWebrtc}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition disabled:opacity-40 btn-secondary">
            {savingWebrtc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {savingWebrtc ? "Saving…" : "Save & Enable In-app Calling"}
          </button>

          <div className="rounded-xl px-3 py-2.5 text-xs text-app-soft"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <p className="font-semibold text-app mb-1">Setup on EnableX's side:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>In your EnableX <strong>Video</strong> project → <strong>PSTN Integration</strong>, add a phone number — it becomes the caller ID and lets the browser dial leads out.</li>
              <li>The <strong>EnxRtc.js</strong> Web SDK is already bundled with the app — nothing to download.</li>
            </ol>
            <p className="mt-1.5">No domain whitelisting is needed: call tokens are minted server-side with your Video App ID/Key.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
