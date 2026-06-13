import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, ExternalLink, Loader2, Phone, Wifi, WifiOff, X } from "lucide-react";
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

  const webhookUrl = orgId
    ? `${window.location.origin}/api/calls/webhook/${orgId}`
    : `${window.location.origin}/api/calls/webhook`;

  useEffect(() => {
    api.get("/calls/settings").then(r => {
      const s = r.data.enablex || {};
      setConnected(r.data.connected);
      setHasApiKey(!!s.hasApiKey);
      setOrgId(r.data.orgId || "");
      setAppId(s.appId  || "");
      setVirtualNumber(s.virtualNumber || "");
    }).catch(() => {});
  }, []);

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
              value={appId} onChange={e => setAppId(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">APP KEY</label>
            <div className="relative">
              <input className="input w-full pr-10" type={showApiKey ? "text" : "password"}
                placeholder={hasApiKey ? "Saved — enter new key to replace" : "Paste your APP KEY"}
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
    </div>
  );
}
