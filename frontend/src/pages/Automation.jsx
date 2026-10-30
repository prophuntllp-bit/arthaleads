import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2, ChevronRight, Copy, ExternalLink, Globe2,
  Link2, MessageCircle, Pencil, Plus, SearchCheck, Trash2, Webhook, RefreshCw, ShieldCheck, AlertTriangle, Mic, Phone, Lock, LayoutGrid, Plug,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/plan";
import { ConfirmDialog, EmptyState, Modal, PageLoader, Spinner } from "../components/UI";
import CustomSelect from "../components/CustomSelect";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { IntegrationCard, LogoTile, SectionTitle, StatTile, BrandLogo, ago, SiteFavicon, WordPressIcon } from "../components/integrations/IntegrationUI";
import SegmentTabs from "../components/SegmentTabs";
import { PortalLogo } from "./integrations/PortalsPage";
import { RoutingLogo } from "./integrations/RoutingRulesPage";
import { VistrowVoiceIcon } from "../components/VistrowVoiceSettings";
import ConnectionCard, { ConnectionGroups } from "../components/ConnectionCard";

/* ─── platform presets (non-Facebook) ─────────────────────────────────────── */
const PLATFORM_PRESETS = {
  Facebook: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Facebook",
    webhookPath: "/webhook",
    description: "Connect Meta Lead Ads. Leads flow in automatically - no setup required.",
    icon: Webhook,
    tone: "bg-blue-500/10 text-blue-400",
  },
  Google: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Google",
    webhookPath: "/webhook/google",
    description: "Google Ads Lead Form extension — no OAuth, just a webhook URL and key.",
    icon: SearchCheck,
    tone: "bg-red-500/10 text-red-400",
  },
  WhatsApp: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "WhatsApp",
    webhookPath: "/webhook/lead",
    description: "Route WhatsApp enquiries from a bot or provider (Wati, Interakt, Twilio, etc.) into the CRM.",
    icon: MessageCircle,
    tone: "bg-green-500/10 text-green-400",
    // Disambiguates from the "WhatsApp Business" tile above it, which
    // connects your own number for the Inbox/AI agent — this one is for a
    // 3rd-party bot platform sending leads in via webhook.
    label: "WhatsApp Bot Leads",
  },
  "Website Form": {
    mode: "form",
    status: "draft",
    leadSourceLabel: "Website",
    webhookPath: "/api/leads",
    description: "Auto-capture leads from any WordPress contact form.",
    icon: Globe2,
    tone: "bg-[#21759b]/10 text-[#21759b]",
    label: "WordPress / Website Forms",
  },
  Custom: {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Custom",
    webhookPath: "/webhook/lead",
    description: "Connect any other partner, broker, or vendor lead source.",
    icon: Link2,
    tone: "bg-orange-500/10 text-orange-400",
  },
  "Vistrow Voice": {
    mode: "webhook",
    status: "draft",
    leadSourceLabel: "Vistrow Voice",
    webhookPath: "/webhook/lead",
    description: "Qualified leads from the Vistrow Voice AI calling platform.",
    icon: Mic,
    tone: "bg-violet-500/10 text-violet-400",
    label: "Vistrow Voice",
  },
};

const emptyNonFbForm = {
  name: "",
  platform: "WhatsApp",
  mode: "webhook",
  status: "draft",
  leadSourceLabel: "WhatsApp",
  description: "",
  externalSourceId: "",
  externalSourceUrl: "",
  webhookPath: "/webhook/lead",
  verifyToken: "",
  accessToken: "",
  mappingNotes: "",
  isActive: true,
};

/* ─── FacebookWizard ───────────────────────────────────────────────────────── */
function FacebookWizard({ open, onClose, onSaved, editingItem, apiBase }) {
  // step: "connect" | "select" | "saving"
  const [step, setStep] = useState("connect");
  const [connecting, setConnecting] = useState(false);
  const [pages, setPages] = useState([]);
  const [pageId, setPageId] = useState("");
  const [formId, setFormId] = useState("");
  const [connName, setConnName] = useState("");
  const [saving, setSaving] = useState(false);
  const [freshToken, setFreshToken] = useState(""); // from latest OAuth
  const [systemToken, setSystemToken] = useState(""); // permanent system user token
  const [sysTokenInput, setSysTokenInput] = useState("");
  const [sysTokenLoading, setSysTokenLoading] = useState(false);
  const [showSysPanel, setShowSysPanel] = useState(false);
  const [noPagesWarning, setNoPagesWarning] = useState(false);

  const selectedPage = pages.find((p) => p.id === pageId);
  const formOptions = selectedPage?.forms || [];

  const popupTimerRef = useRef(null);

  // Pre-fill when editing
  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setStep("select");
      // Build a synthetic pages entry so dropdowns render properly without re-auth
      const syntheticPages = editingItem.pageId
        ? [{ id: editingItem.pageId, name: editingItem.pageName || editingItem.pageId, forms: [] }]
        : [];
      setPages(syntheticPages);
      setPageId(editingItem.pageId || "");
      setFormId(editingItem.formId || "");
      setConnName(editingItem.name || "");
    } else {
      setStep("connect");
      setPages([]);
      setPageId("");
      setFormId("");
      setConnName("");
    }
    setConnecting(false);
    setFreshToken("");
    setSystemToken("");
    setSysTokenInput("");
    setShowSysPanel(false);
    setNoPagesWarning(false);
  }, [open, editingItem]);

  // Listen for OAuth popup result via postMessage (primary) + storage event (fallback)
  useEffect(() => {
    const handleResult = (result) => {
      // Clear the popup-close watchdog immediately so it can't race with this result
      clearInterval(popupTimerRef.current);
      setConnecting(false);

      if (result.type === "facebook_oauth_success") {
        const fetchedPages = result.pages || [];
        setPages(fetchedPages);
        if (result.freshToken) setFreshToken(result.freshToken);

        if (fetchedPages.length > 0) {
          const first = fetchedPages[0];
          setPageId(first.id || "");
          setFormId(first.forms?.[0]?.id || "");
          setConnName((prev) => prev || `${first.name} - Lead Ads`);
          setNoPagesWarning(false);
          toast.success("Facebook connected! Choose your page and form.");
          setStep("select");
        } else {
          // OAuth returned 0 pages — most common cause: page is in Business Manager, not
          // directly on the personal profile. Auto-expand the System User Token panel so
          // the customer sees the permanent fix immediately without extra navigation.
          setNoPagesWarning(true);
          setShowSysPanel(true);
          // Stay on connect step so the System Token panel is visible
          toast.error("Facebook returned no Pages. Reconnect and choose \"Edit settings\" to pick your Page.");
        }
      }
      if (result.type === "facebook_oauth_error") {
        toast.error(result.message || "Facebook connection failed. Please try again.");
      }
    };

    // Primary: postMessage - fires synchronously before window.close()
    const onMessage = (e) => {
      // Only our own callback page (same origin) may hand over OAuth results.
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || typeof d.type !== "string" || !d.type.startsWith("facebook_oauth")) return;
      handleResult(d);
    };

    // Fallback: storage event - for when window.opener is unavailable
    const onStorage = (e) => {
      if (e.key !== "fb_oauth_result" || !e.newValue) return;
      let result;
      try { result = JSON.parse(e.newValue); } catch { return; }
      localStorage.removeItem("fb_oauth_result");
      handleResult(result);
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handlePageChange = (e) => {
    const id = e.target.value;
    setPageId(id);
    const pg = pages.find((p) => p.id === id);
    setFormId(pg?.forms?.[0]?.id || "");
    if (!connName || connName.endsWith("- Lead Ads")) {
      setConnName(pg ? `${pg.name} - Lead Ads` : "");
    }
  };

  // Clean up the popup monitor on unmount
  useEffect(() => () => clearInterval(popupTimerRef.current), []);

  const openOAuth = () => {
    setConnecting(true);
    const url = `${(apiBase || "").replace(/\/api\/?$/, "")}/api/automations/facebook/connect?origin=${encodeURIComponent(window.location.origin)}`;
    const popup = window.open(url, `arthaleads-fb-oauth-${Date.now()}`, "width=720,height=760,resizable=yes,scrollbars=yes");

    if (!popup) {
      setConnecting(false);
      toast.error("Please allow popups for this site, then try again.");
      return;
    }

    // Poll every 600ms - if the popup closes WITHOUT sending a result,
    // reset the button so the user can retry instead of being stuck forever.
    clearInterval(popupTimerRef.current);
    popupTimerRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupTimerRef.current);
        // Only reset if we haven't already received a result (handleResult sets connecting=false)
        setConnecting((prev) => {
          if (prev) toast("Facebook window closed. Click 'Continue with Facebook' to try again.", { icon: "ℹ️" });
          return false;
        });
      }
    }, 600);
  };

  // The source saves fine even when Facebook refuses to subscribe the Page to
  // leadgen events — but in that state it never receives a single lead. A plain
  // "connected!" toast there is actively misleading, so say what actually failed.
  const reportSaveOutcome = (webhookWarning, successMessage) => {
    if (!webhookWarning) { toast.success(successMessage); return; }
    toast.error(
      `Saved, but Facebook would not subscribe this Page — no leads will arrive. ${webhookWarning}`,
      { duration: 10000 }
    );
  };

  const handleSave = async () => {
    if (!pageId) { toast.error("Please enter a Facebook Page ID"); return; }
    if (!connName.trim()) { toast.error("Please give this connection a name"); return; }
    setSaving(true);
    const selectedPageData = pages.find((p) => p.id === pageId);
    // System user token: use it as both access token and user token (permanent, never expires)
    // OAuth token: page-specific token > fresh user token > existing stored token
    const isSystemToken = !!systemToken;
    const accessToken = isSystemToken
      ? (selectedPageData?.accessToken || systemToken)
      : (selectedPageData?.accessToken || freshToken || editingItem?.accessToken || "");
    const userToken = systemToken || freshToken || editingItem?.userToken || "";
    const payload = {
      name: connName.trim(),
      platform: "Facebook",
      mode: "webhook",
      status: "connected",
      leadSourceLabel: "Facebook",
      webhookPath: "/webhook",
      pageId,
      pageName: selectedPageData?.name || editingItem?.pageName || "",
      formId,
      accessToken,
      userToken,
      isSystemToken,
      verifyToken: editingItem?.verifyToken || `arthaleads_${Date.now()}`,
      isActive: true,
    };
    try {
      if (editingItem) {
        const { data } = await api.patch(`/automations/${editingItem._id}`, payload);
        onSaved("update", data.automation);
        reportSaveOutcome(data.webhookWarning, "Facebook connection updated");
      } else {
        const { data } = await api.post("/automations", payload);
        onSaved("create", data.automation);
        reportSaveOutcome(data.webhookWarning, "Facebook Lead Ads connected!");
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    /* Outer: fixed full-screen, flex centering, safe bottom padding for mobile */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop: fixed inset-0 (not absolute) so it fully covers viewport incl. iOS status bar */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel: sheet-style on mobile (slides from bottom), dialog on sm+ */}
      <div className="relative w-full sm:max-w-md sm:rounded-[1.75rem] rounded-t-[1.75rem] shell-panel flex flex-col"
        style={{ maxHeight: "92dvh" }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-5 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2] overflow-hidden">
            <FacebookIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-app leading-tight">Facebook Lead Ads</h2>
            <p className="text-xs text-app-soft">Connect your ad account in seconds</p>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-1 flex-shrink-0">
          <StepDot n={1} label="Connect" active={step === "connect"} done={step === "select"} />
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
          <StepDot n={2} label="Choose Page & Form" active={step === "select"} done={false} />
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── STEP 1: Connect ── */}
          {step === "connect" && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-5 space-y-3">
                <p className="text-sm font-semibold text-app">What happens when you click below:</p>
                <ul className="space-y-2">
                  {[
                    "A Facebook login window opens",
                    "You approve access to your pages",
                    "Your pages and lead forms load automatically",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-app-soft">
                      <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Facebook login button - icon contained, text centered, chevron right */}
              <button
                type="button"
                onClick={openOAuth}
                disabled={connecting}
                className="w-full flex items-center gap-3 px-4 rounded-2xl py-3.5 text-sm font-semibold text-white transition disabled:opacity-70"
                style={{ background: "#1877F2" }}
              >
                {connecting ? (
                  <>
                    <Spinner size="sm" />
                    <span className="flex-1 text-center text-white">Waiting for Facebook…</span>
                  </>
                ) : (
                  <>
                    {/* Icon in a fixed-size shrink-0 wrapper - never overflows button */}
                    <span className="shrink-0 flex items-center justify-center w-5 h-5">
                      <FacebookIcon />
                    </span>
                    <span className="flex-1 text-center">Continue with Facebook</span>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-app-soft">
                No technical setup needed. We handle everything securely.
              </p>

              {/* ── System User Token alternative ── */}
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowSysPanel((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-app-soft hover:text-app transition"
                  style={{ background: "var(--app-surface-low)" }}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Using Facebook Business Manager? Paste a System User Token (never expires)
                  </span>
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showSysPanel ? "rotate-90" : ""}`} />
                </button>
                {showSysPanel && (
                  <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: "var(--app-surface-low)" }}>
                    <p className="text-xs text-app-soft leading-relaxed">
                      In your <strong className="text-app">Facebook Business Manager → System users</strong>, create a System User, assign your Page to it, then click <strong className="text-app">Generate Token</strong>.
                      Select the <em>Arthaleads</em> app and enable: <code className="bg-black/20 px-1 rounded">leads_retrieval</code>, <code className="bg-black/20 px-1 rounded">pages_show_list</code>, <code className="bg-black/20 px-1 rounded">pages_read_engagement</code>, <code className="bg-black/20 px-1 rounded">pages_manage_metadata</code>. This token never expires.
                    </p>
                    <input
                      className="input text-xs font-mono"
                      placeholder="Paste system user token here…"
                      value={sysTokenInput}
                      onChange={(e) => setSysTokenInput(e.target.value.trim())}
                    />
                    <button
                      type="button"
                      disabled={!sysTokenInput || sysTokenLoading}
                      onClick={async () => {
                        setSysTokenLoading(true);
                        try {
                          const base = (apiBase || "").replace(/\/api\/?$/, "");
                          const resp = await fetch(`${base}/api/automations/facebook/verify-system-token`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("_at") || ""}` },
                            credentials: "include",
                            body: JSON.stringify({ token: sysTokenInput }),
                          });
                          const json = await resp.json();
                          if (!json.success) throw new Error(json.message || "Verification failed");
                          const fetchedPages = json.pages || [];
                          if (!fetchedPages.length) throw new Error("No Facebook pages found for this token. Check System User has page access.");
                          setSystemToken(sysTokenInput);
                          setPages(fetchedPages);
                          const first = fetchedPages[0];
                          setPageId(first.id || "");
                          setFormId(first.forms?.[0]?.id || "");
                          setConnName((prev) => prev || `${first.name} - Lead Ads`);
                          setStep("select");
                          toast.success(`System User Token verified — ${fetchedPages.length} page${fetchedPages.length !== 1 ? "s" : ""} found. Token never expires.`);
                        } catch (e) {
                          toast.error(e.message || "Token verification failed");
                        } finally {
                          setSysTokenLoading(false);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
                      style={{ background: "#16a34a" }}
                    >
                      {sysTokenLoading ? <><Spinner size="sm" /> Verifying…</> : <><ShieldCheck className="h-3.5 w-3.5" /> Verify & Use Permanent Token</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Select page + form ── */}
          {step === "select" && (
            <div className="space-y-4">
              {/* Success banner - fresh connect OR editing existing */}
              {pages.length > 0 && !editingItem && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-400 font-medium">
                    Facebook connected - {pages.length} page{pages.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              )}
              {/* Edit mode banner */}
              {editingItem && !freshToken && (
                <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium">Editing existing connection</p>
                    <p className="text-xs text-app-soft mt-0.5">
                      Reconnect below to switch to a different Facebook account or refresh your page list.
                    </p>
                  </div>
                </div>
              )}
              {noPagesWarning && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-orange-400">No Facebook Pages were returned</p>
                  <p className="text-xs text-app-soft leading-relaxed">
                    Facebook granted access to zero Pages. If the login window showed
                    <strong> "You've previously linked Arthaleads CRM… continue with your previous settings?"</strong>,
                    click <strong>"Edit settings"</strong> rather than "Continue" - Continue silently re-applies your
                    earlier selection, which had no Pages ticked. On the picker that follows, select your Page,
                    then approve every permission screen without unchecking anything.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setStep("connect"); setNoPagesWarning(false); }}
                    className="text-xs font-semibold text-blue-400 hover:underline"
                  >
                    → Try connecting again
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <label className="label">Facebook Page</label>
                {pages.length > 0 ? (
                  <CustomSelect
                    value={pageId}
                    onChange={(id) => {
                      setPageId(id);
                      const pg = pages.find((p) => p.id === id);
                      setFormId(pg?.forms?.[0]?.id || "");
                      if (!connName || connName.endsWith("- Lead Ads")) {
                        setConnName(pg ? `${pg.name} - Lead Ads` : "");
                      }
                    }}
                    placeholder="Select a page…"
                    options={pages.map((p) => ({ value: p.id, label: p.name }))}
                    style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
                  />
                ) : (
                  <input
                    className="input"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="Page ID (from Facebook Business)"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="label">Lead Form</label>
                {pages.length > 0 ? (
                  <CustomSelect
                    value={formId}
                    onChange={setFormId}
                    placeholder="All forms on this page"
                    options={formOptions.map((f) => ({ value: f.id, label: f.name }))}
                    style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
                  />
                ) : (
                  <input
                    className="input"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="All forms on this page"
                  />
                )}
                {/* Hint below form dropdown */}
                {pages.length > 0 && formOptions.length === 0 ? (
                  <div className="mt-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed"
                    style={{ background: "rgba(var(--app-primary-rgb),0.07)", color: "var(--app-soft)", border: "1px solid rgba(var(--app-primary-rgb),0.15)" }}>
                    No published lead forms found for this page.{" "}
                    <span className="font-semibold text-app">"All forms"</span> will automatically capture every lead that comes in.
                    To target a specific form, first{" "}
                    <a href="https://www.facebook.com/ads/leadads/" target="_blank" rel="noreferrer"
                      style={{ color: "var(--app-primary)" }} className="underline font-medium">
                      create a Lead Ad form on Facebook
                    </a>
                    , then reconnect here.
                  </div>
                ) : (
                  <p className="text-xs text-app-soft mt-1">
                    Leave as "All forms" to capture leads from every form on this page.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="label">Connection name</label>
                <input
                  className="input"
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                  placeholder="e.g. Sunrise Realty - Lead Ads"
                />
              </div>

              {/* Reconnect option */}
              <button
                type="button"
                onClick={() => { setStep("connect"); setPages([]); }}
                className="text-xs text-blue-400 hover:underline"
              >
                Use a different Facebook account
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid var(--app-border)" }}>
          <button type="button" className="btn-secondary rounded-xl" onClick={onClose}>Cancel</button>
          {step === "select" && (
            <button
              type="button"
              className="btn-primary rounded-xl"
              onClick={handleSave}
              disabled={saving || !pageId}
            >
              {saving ? <><Spinner size="sm" /> Saving…</> : "Save Connection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDot({ n, label, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition
        ${done ? "bg-emerald-500 text-white" : active ? "bg-[#1877F2] text-white" : "bg-white/10 text-app-soft"}`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={`text-xs font-medium ${active ? "text-app" : "text-app-soft"}`}>{label}</span>
    </div>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

/* ─── Non-Facebook source form ─────────────────────────────────────────────── */
function SourceModal({ open, onClose, editingItem, onSaved, apiBase }) {
  const [form, setForm] = useState(emptyNonFbForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setForm({
        name: editingItem.name || "",
        platform: editingItem.platform || "Google",
        mode: editingItem.mode || "api",
        status: editingItem.status || "draft",
        description: editingItem.description || "",
        leadSourceLabel: editingItem.leadSourceLabel || "",
        externalSourceId: editingItem.externalSourceId || "",
        externalSourceUrl: editingItem.externalSourceUrl || "",
        webhookPath: editingItem.webhookPath || "/api/leads",
        verifyToken: editingItem.verifyToken || "",
        accessToken: editingItem.accessToken || "",
        mappingNotes: editingItem.mappingNotes || "",
        isActive: editingItem.isActive ?? true,
      });
    } else {
      setForm(emptyNonFbForm);
    }
  }, [open, editingItem]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handlePlatformChange = (e) => {
    const platform = e.target.value;
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.Custom;
    setForm((f) => ({
      ...f,
      platform,
      mode: preset.mode,
      leadSourceLabel: preset.leadSourceLabel,
      webhookPath: preset.webhookPath,
      description: preset.description || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        // Pause and resume live on the card; the Status field here only has to agree with it.
        const { data } = await api.patch(`/automations/${editingItem._id}`, { ...form, isActive: form.status !== "paused" });
        onSaved("update", data.automation);
        toast.success("Source updated");
      } else {
        const { data } = await api.post("/automations", { ...form, isActive: form.status !== "paused" });
        onSaved("create", data.automation);
        toast.success("Source added");
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const endpoint = `${(apiBase || "").replace(/\/api\/?$/, "")}${ingestPath(form.platform, form.webhookPath)}`;

  return (
    <Modal open={open} onClose={onClose} title={editingItem ? "Edit Source" : "Add Lead Source"} size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Source Name</label>
            <input className="input" value={form.name} onChange={set("name")} required />
          </div>
          <div>
            <label className="label">Platform</label>
            <CustomSelect
              value={form.platform}
              onChange={(platform) => {
                const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.Custom;
                setForm((f) => ({
                  ...f,
                  platform,
                  mode: preset.mode,
                  leadSourceLabel: preset.leadSourceLabel,
                  webhookPath: preset.webhookPath,
                  description: preset.description || "",
                }));
              }}
              options={Object.keys(PLATFORM_PRESETS).filter((p) => p !== "Facebook" && p !== "Vistrow Voice" && p !== "Google")}
              style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <CustomSelect
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={[
                { value: "draft", label: "Draft" },
                { value: "connected", label: "Connected" },
                { value: "paused", label: "Paused" },
              ]}
              style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
            />
          </div>
          <div>
            <label className="label">Lead Source Label</label>
            <input className="input" value={form.leadSourceLabel} onChange={set("leadSourceLabel")} placeholder="Google / WhatsApp / Website" />
          </div>
          <div>
            <label className="label">External Source ID</label>
            <input className="input" value={form.externalSourceId} onChange={set("externalSourceId")} placeholder="Campaign or partner ID" />
          </div>
          <div>
            <label className="label">External Source URL</label>
            <input className="input" value={form.externalSourceUrl} onChange={set("externalSourceUrl")} placeholder="Landing page URL" />
          </div>
        </div>
        <div>
          <label className="label">API Endpoint</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl px-3 py-2 text-xs text-orange-400" style={{ background: "var(--app-surface-low)" }}>{endpoint}</code>
            <button type="button" className="btn-secondary rounded-xl" onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("Copied"); }}>
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-app-soft">POST leads to this endpoint with source set to <span className="text-orange-400">{form.leadSourceLabel || form.platform}</span>.</p>
          {form.platform === "Website Form" && (
            <p className="mt-1 text-xs text-app-soft">
              Website Form tokens are created under Integrations → WordPress / Website Forms and work for any website, not only WordPress.
              A Custom source's token will not work on this endpoint.
            </p>
          )}
        </div>
        {(form.platform === "Custom" || form.platform === "WhatsApp") && (
          <div>
            <label className="label">Auth Token</label>
            {form.verifyToken ? (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-xl px-3 py-2 text-xs font-mono font-semibold text-orange-400" style={{ background: "var(--app-surface-low)" }}>{form.verifyToken}</code>
                  <button type="button" className="btn-secondary rounded-xl" onClick={() => { navigator.clipboard.writeText(form.verifyToken); toast.success("Token copied"); }}>
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-app-soft">Send this in the request body as <code className="text-orange-400">token</code>. Keep it secret — anyone with it can post leads to your pipeline.</p>
              </>
            ) : (
              <p className="text-xs text-app-soft">A unique auth token will be generated when you save this source. Reopen it here to copy the token.</p>
            )}
          </div>
        )}
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" value={form.mappingNotes} onChange={set("mappingNotes")} placeholder="Notes about field mapping or setup details" />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : editingItem ? "Update" : "Save Source"}</button>
        </div>
      </form>
    </Modal>
  );
}

// Which endpoint actually accepts a source's token. The saved webhookPath is
// "/api/leads" for every manually added source, which no token has ever worked
// against, so the screen showed callers an address that always failed.
function ingestPath(platform, stored) {
  if (platform === "Website Form") return "/webhook/website";
  if (platform === "Custom" || platform === "Vistrow Voice" || platform === "WhatsApp") return "/webhook/lead";
  return stored || "/api/leads";
}

/* ─── Google Ads: per-connection card ──────────────────────────────────────── */
function GoogleCard({ conn, endpoint, onDelete, copyText }) {
  const [deleting, setDeleting] = useState(false);
  const isConnected = conn.status === "connected";

  const handleDelete = async () => {
    if (!confirm(`Remove "${conn.name}" from Arthaleads? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/automations/${conn.id}`);
      onDelete(conn.id);
      toast.success("Connection removed");
    } catch {
      toast.error("Failed to remove connection");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${isConnected ? "border-emerald-500/30" : "border-[var(--app-border)]"}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${isConnected ? "bg-emerald-500" : "bg-[var(--app-surface-low)]"}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${isConnected ? "bg-white/20" : "bg-red-500"}`}>
          <SearchCheck className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${isConnected ? "text-white" : "text-app"}`}>{conn.name}</p>
          {conn.lastSyncAt && <p className={`text-xs ${isConnected ? "text-white/70" : "text-app-soft"}`}>Last lead: {new Date(conn.lastSyncAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">✓ Connected</span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Pending</span>
          )}
          <button onClick={handleDelete} disabled={deleting} className={`p-1.5 rounded-lg hover:bg-black/10 transition ${isConnected ? "text-white/60 hover:text-white" : "text-app-soft hover:text-red-400"}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-soft mb-1">Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl px-3 py-1.5 text-xs text-red-400" style={{ background: "var(--app-surface-low)" }}>{endpoint}</code>
            <button onClick={() => copyText(endpoint, "Webhook URL")} className="btn-secondary rounded-xl px-2.5 py-1.5 shrink-0">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-soft mb-1">Key</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-red-400" style={{ background: "var(--app-surface-low)" }}>{conn.token}</code>
            <button onClick={() => copyText(conn.token, "Key")} className="btn-secondary rounded-xl px-2.5 py-1.5 shrink-0">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Google Ads: OAuth-connected account card ─────────────────────────────── */
const istDateTime = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Instant delivery = our webhook on the account's lead forms (set when connecting).
function deliveryText(d) {
  if (!d || !d.checkedAt) return "Instant delivery: checking";
  if (!d.total) return d.error ? "Instant delivery: couldn't check the lead forms" : "No lead forms yet. New ones get instant delivery automatically.";
  if (d.ours === d.total) return `Instant delivery on for ${d.total === 1 ? "the lead form" : `all ${d.total} lead forms`}`;
  const parts = [`Instant delivery on for ${d.ours} of ${d.total} lead forms`];
  if (d.other) parts.push(`${d.other} already send to another tool`);
  if (d.failed) parts.push(`${d.failed} need Standard or Admin access in Google Ads`);
  return `${parts.join("; ")}. The rest arrive within 5 minutes.`;
}

function GoogleOAuthCard({ conn, onDelete, onSync }) {
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isConnected = conn.status === "connected";

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync(conn.id);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${conn.name}" from Arthaleads? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/automations/${conn.id}`);
      onDelete(conn.id);
      toast.success("Connection removed");
    } catch {
      toast.error("Failed to remove connection");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${isConnected ? "border-emerald-500/30" : "border-[var(--app-border)]"}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${isConnected ? "bg-emerald-500" : "bg-[var(--app-surface-low)]"}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${isConnected ? "bg-white/20" : "bg-red-500"}`}>
          <SearchCheck className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${isConnected ? "text-white" : "text-app"}`}>{conn.name}</p>
          <p className={`text-xs truncate ${isConnected ? "text-white/70" : "text-app-soft"}`}>
            {conn.googleCustomerName || "Google Ads account"}{conn.googleCustomerId ? ` · ${conn.googleCustomerId}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white" style={!isConnected ? { background: "rgba(249,115,22,0.2)", color: "#fb923c" } : undefined}>
            {isConnected ? "✓ Connected" : "Pending"}
          </span>
          <button onClick={handleDelete} disabled={deleting} className={`p-1.5 rounded-lg hover:bg-black/10 transition ${isConnected ? "text-white/60 hover:text-white" : "text-app-soft hover:text-red-400"}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-semibold text-app">{deliveryText(conn.delivery)}</p>
          <p className="text-xs text-app-soft">
            {conn.polledAt || conn.lastSyncAt ? `Last checked: ${istDateTime(conn.polledAt || conn.lastSyncAt)}` : "Not checked yet"}
          </p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="btn-secondary rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0">
          {syncing ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </div>
  );
}

/* ─── Google Ads wizard ─────────────────────────────────────────────────────── */
function GoogleGIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
        c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
        c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039
        l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
        c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571
        c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
  );
}

function GoogleWizard({ open, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [adding, setAdding] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // OAuth ("Sign in with Google") state
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [pendingOAuth, setPendingOAuth] = useState(null); // { customers, accessToken, refreshToken }
  const [pendingCustomerId, setPendingCustomerId] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [savingOAuth, setSavingOAuth] = useState(false);
  const popupTimerRef = useRef(null);

  const serverBase = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  const endpoint = `${serverBase}/webhook/google`;

  const load = useCallback((isInitial = false) => {
    if (isInitial) setLoading(true);
    return api.get("/automations/google/connections")
      .then(({ data }) => setConnections(data.connections || []))
      .catch(() => isInitial && toast.error("Failed to load connections"))
      .finally(() => isInitial && setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    load(true);
    const interval = setInterval(() => load(false), 5000);
    return () => clearInterval(interval);
  }, [open, load]);

  useEffect(() => {
    if (!open) { setPendingOAuth(null); setOauthConnecting(false); }
  }, [open]);

  // Listen for the OAuth popup result (postMessage primary, storage fallback)
  useEffect(() => {
    const handleResult = (result) => {
      clearInterval(popupTimerRef.current);
      setOauthConnecting(false);

      if (result.type === "google_oauth_success") {
        const customers = result.customers || [];
        if (!customers.length) {
          toast.error("No Google Ads accounts found for this login. Make sure you signed in with an account that has access to an Ads account.");
          return;
        }
        setPendingOAuth({ customers, accessToken: result.accessToken, refreshToken: result.refreshToken });
        setPendingCustomerId(customers[0].id);
        setPendingName(customers[0].name !== customers[0].id ? customers[0].name : "Google Ads");
        toast.success("Google connected! Choose your Ads account.");
      }
      if (result.type === "google_oauth_error") {
        toast.error(result.message || "Google connection failed. Please try again.");
      }
    };

    const onMessage = (e) => {
      // Only our own callback page (same origin) may hand over OAuth results.
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || typeof d.type !== "string" || !d.type.startsWith("google_oauth")) return;
      handleResult(d);
    };
    const onStorage = (e) => {
      if (e.key !== "google_oauth_result" || !e.newValue) return;
      let result;
      try { result = JSON.parse(e.newValue); } catch { return; }
      localStorage.removeItem("google_oauth_result");
      handleResult(result);
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => () => clearInterval(popupTimerRef.current), []);

  const openGoogleOAuth = () => {
    setOauthConnecting(true);
    const url = `${serverBase}/api/automations/google/connect?origin=${encodeURIComponent(window.location.origin)}`;
    const popup = window.open(url, `arthaleads-google-oauth-${Date.now()}`, "width=520,height=680,resizable=yes,scrollbars=yes");

    if (!popup) {
      setOauthConnecting(false);
      toast.error("Please allow popups for this site, then try again.");
      return;
    }

    clearInterval(popupTimerRef.current);
    popupTimerRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupTimerRef.current);
        setOauthConnecting((prev) => {
          if (prev) toast("Google window closed. Click 'Sign in with Google' to try again.", { icon: "ℹ️" });
          return false;
        });
      }
    }, 600);
  };

  const handleSaveOAuth = async () => {
    if (!pendingCustomerId) { toast.error("Please choose a Google Ads account"); return; }
    if (!pendingName.trim()) { toast.error("Please give this connection a name"); return; }
    setSavingOAuth(true);
    try {
      const chosen = pendingOAuth.customers.find((c) => c.id === pendingCustomerId);
      const res = await api.post("/automations/google/oauth-create", {
        name: pendingName.trim(),
        customerId: pendingCustomerId,
        customerName: chosen?.name || pendingCustomerId,
        loginCustomerId: chosen?.loginCustomerId || "",
        accessToken: pendingOAuth.accessToken,
        refreshToken: pendingOAuth.refreshToken,
      });
      const d = res?.data?.delivery;
      toast.success(d?.total && d.ours === d.total
        ? "Google Ads connected. New leads arrive instantly."
        : "Google Ads connected. Leads arrive within 5 minutes.");
      setPendingOAuth(null);
      onChanged?.();
      await load(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSavingOAuth(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const { data } = await api.post("/automations/google/create", { name: `Google Ads ${connections.length + 1}` });
      setConnections((prev) => [...prev, data.connection]);
      onChanged?.();
      toast.success("New connection created — paste the URL and Key into Google Ads.");
    } catch {
      toast.error("Failed to create connection");
    } finally {
      setAdding(false);
    }
  };

  const handleSyncNow = async (id) => {
    try {
      const { data } = await api.post(`/automations/google/${id}/sync`);
      toast.success(data.message || "Synced");
      await load(false);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Sync failed");
    }
  };

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!open) return null;

  const oauthConns = connections.filter((c) => c.mode === "oauth");
  const webhookConns = connections.filter((c) => c.mode !== "oauth");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:rounded-[1.75rem] rounded-t-[1.75rem] shell-panel overflow-hidden">
        <div className="flex items-center gap-3 p-6" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500">
            <SearchCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-app">Google Ads</h2>
            <p className="text-xs text-app-soft">Sign in with Google — or connect manually via webhook</p>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : pendingOAuth ? (
            /* ── Step: choose which Ads account to link ── */
            <div className="space-y-4">
              <p className="text-sm text-app-soft">Choose the Google Ads account to pull leads from.</p>
              <div>
                <label className="label">Google Ads Account</label>
                <CustomSelect
                  value={pendingCustomerId}
                  onChange={setPendingCustomerId}
                  options={pendingOAuth.customers.map((c) => ({
                    value: c.id,
                    label: `${c.name !== c.id ? `${c.name} (${c.id})` : c.id}${c.managerName ? `, via ${c.managerName}` : ""}`,
                  }))}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
                />
              </div>
              <div>
                <label className="label">Connection Name</label>
                <input className="input" value={pendingName} onChange={(e) => setPendingName(e.target.value)} placeholder="e.g. Acme Realty Ads" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1 rounded-xl" onClick={() => setPendingOAuth(null)}>Cancel</button>
                <button type="button" className="btn-primary flex-1 rounded-xl" onClick={handleSaveOAuth} disabled={savingOAuth}>
                  {savingOAuth ? <><Spinner size="sm" /> Saving…</> : "Connect"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {oauthConns.map((conn) => (
                <GoogleOAuthCard
                  key={conn.id}
                  conn={conn}
                  onSync={handleSyncNow}
                  onDelete={(id) => { setConnections((prev) => prev.filter((c) => c.id !== id)); onChanged?.(); }}
                />
              ))}
              {webhookConns.map((conn) => (
                <GoogleCard
                  key={conn.id}
                  conn={conn}
                  endpoint={endpoint}
                  copyText={copyText}
                  onDelete={(id) => { setConnections((prev) => prev.filter((c) => c.id !== id)); onChanged?.(); }}
                />
              ))}

              <button
                type="button"
                onClick={openGoogleOAuth}
                disabled={oauthConnecting}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3 text-sm font-semibold border transition disabled:opacity-60"
                style={{ background: "var(--app-surface-low)", borderColor: "var(--app-border)", color: "var(--app-text)" }}
              >
                {oauthConnecting ? <Spinner size="sm" /> : <GoogleGIcon />}
                {oauthConnecting ? "Waiting for Google…" : "Sign in with Google"}
              </button>
              <p className="text-xs text-app-soft text-center -mt-2">
                Use the Google login that has your ad account. A manager account login works too: you then pick the ad account under it.
              </p>

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowManual((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-app-soft uppercase tracking-wider hover:text-app transition"
                >
                  <span>Or connect manually via webhook</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${showManual ? "rotate-90" : ""}`} />
                </button>
                {showManual && (
                  <div className="px-4 py-4 space-y-4" style={{ borderTop: "1px solid var(--app-border)" }}>
                    <p className="text-xs text-app-soft">No sign-in needed. Google sends each lead to a URL you paste into your lead form.</p>

                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={adding}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold border-2 border-dashed border-[var(--app-border)] text-app-soft hover:border-red-500 hover:text-red-400 transition"
                    >
                      {adding ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
                      {adding ? "Creating…" : webhookConns.length ? "Add Another Connection" : "Add Google Ads Connection"}
                    </button>

                    <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--app-surface-low)" }}>
                      {[
                        'Click "Add Google Ads Connection" to generate your Webhook URL and Key.',
                        "In Google Ads, open Tools & Settings → Conversions → Lead form extension.",
                        "Select your form → Webhook integration → paste the Webhook URL and Key → Save.",
                        'Click "Send test lead" in Google Ads to verify — it appears here labeled as a test.',
                      ].map((t, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xs font-bold mt-0.5">{i + 1}</span>
                          <p className="text-sm text-app-soft">{t}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-app-soft uppercase tracking-wider hover:text-app transition"
                      >
                        <span>Developer details (optional)</span>
                        <ChevronRight className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
                      </button>
                      {showAdvanced && (
                        <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--app-border)" }}>
                          <p className="text-xs text-app-soft">This is Google Ads' own webhook payload — you don't need to build anything, Google sends this automatically once connected.</p>
                          <p className="text-xs text-app-soft">Standard fields recognized: <span className="text-red-400 font-semibold">FULL_NAME</span> (or FIRST_NAME + LAST_NAME), <span className="text-red-400 font-semibold">PHONE_NUMBER</span>, <span className="text-red-400 font-semibold">EMAIL</span>. Any other question is saved as a custom answer on the lead.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 pb-6">
          <button type="button" className="btn-secondary rounded-xl" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── FormLabelsEditor ─────────────────────────────────────────────────────────
   Facebook's Graph API can't tell us a Lead Form's own name with the
   permissions this app has - reading a submitted lead's answers needs a
   different, narrower scope than reading the form object itself. So instead
   of waiting on a Meta App Review for a broader permission, admins map each
   form_id to a friendly name here once; the webhook uses it directly. */
function FormLabelsEditor({ item, onUpdated }) {
  const [formId, setFormId] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const addLabel = async () => {
    if (!formId.trim() || !label.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/automations/facebook/${item._id}/form-labels`, {
        formId: formId.trim(),
        label: label.trim(),
      });
      onUpdated(item._id, data.formLabels);
      setFormId("");
      setLabel("");
      toast.success("Form name saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save form name");
    } finally {
      setSaving(false);
    }
  };

  const removeLabel = async (fid) => {
    try {
      const { data } = await api.delete(`/automations/facebook/${item._id}/form-labels/${encodeURIComponent(fid)}`);
      onUpdated(item._id, data.formLabels);
    } catch {
      toast.error("Failed to remove form name");
    }
  };

  return (
    <div className="rounded-xl p-3 stitch-surface-muted space-y-2">
      <p className="text-xs font-semibold text-app">Form Names</p>
      <p className="text-[10px] leading-relaxed text-app-soft">
        Facebook can't auto-detect a lead form's name for us. Paste each form's ID (visible in Meta's Lead Ads tools, next to the form) and a label so agents know which campaign a lead came from.
      </p>
      {(item.formLabels || []).length > 0 && (
        <div className="space-y-1">
          {item.formLabels.map((f) => (
            <div key={f.formId} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs" style={{ background: "var(--app-surface-low)" }}>
              <span className="truncate"><strong>{f.label}</strong> · {f.formId}</span>
              <button onClick={() => removeLabel(f.formId)} className="shrink-0 text-app-soft hover:text-red-400">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}
          placeholder="Form ID"
          value={formId}
          onChange={(e) => setFormId(e.target.value)}
        />
        <input
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}
          placeholder="Name (e.g. Mahalunge NX)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          onClick={addLabel}
          disabled={saving || !formId.trim() || !label.trim()}
          className="btn-secondary rounded-lg px-2 shrink-0 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Automation page ─────────────────────────────────────────────────── */
// Google Ads, Vistrow Voice and the Custom webhook / API are Enterprise features.
const ENTERPRISE_SOURCES = ["Google", "Vistrow Voice", "Custom"];

export default function Automation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { org, user: authUser } = useAuth();
  const enterpriseOk = authUser?.role === "super_admin" || canAccess(org, "enterprise");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Facebook wizard state
  const [fbWizardOpen, setFbWizardOpen] = useState(false);
  const [fbEditingItem, setFbEditingItem] = useState(null);

  // WordPress wizard state

  // Vistrow Voice wizard state

  // Google Ads wizard state
  const [googleWizardOpen, setGoogleWizardOpen] = useState(false);

  // Facebook diagnostic state
  const [diagFor, setDiagFor] = useState(null);      // the automation being diagnosed
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState(null); // { checks, allOk, canResubscribe, ... }
  const [resubscribing, setResubscribing] = useState(false);

  // Non-FB source modal state
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceEditingItem, setSourceEditingItem] = useState(null);

  // Delete confirm
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Facebook token refresh (per-card)
  const [refreshingId, setRefreshingId] = useState(null);

  const handleRefreshFbTokens = async (automationId, orgId) => {
    setRefreshingId(automationId);
    try {
      const { data } = await api.post("/automations/facebook/refresh-tokens", { automationId, orgId });
      toast.success(data.message || "Facebook token refreshed");
      await loadItems(); // reload to show updated expiry dates
    } catch (err) {
      toast.error(err.response?.data?.message || "Token refresh failed. Try reconnecting Facebook.");
    } finally {
      setRefreshingId(null);
    }
  };

  const apiBase = useMemo(() => api.defaults.baseURL || "http://localhost:5000/api", []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/automations");
      setItems(data.automations || []);
    } catch {
      toast.error("Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  // WhatsApp Business (the real Inbox connection — Meta/AiSensy/Wati/Interakt
  // credentials, managed on /conversations/settings) is a different thing
  // from the "WhatsApp" quick-connect tile below, which is for routing leads
  // in from a 3rd-party bot's webhook. Only a live status badge is fetched
  // here; the actual connect/disconnect form is not duplicated on this page.
  const [waStatus, setWaStatus] = useState(null);
  useEffect(() => {
    api.get("/whatsapp/status").then((r) => setWaStatus(r.data)).catch(() => setWaStatus({ connected: false }));
  }, []);

  // Status for the telephony, portal, routing and conversion cards. Each call
  // may be refused (plan or role); the card then just shows "Not set up yet".
  const [extra, setExtra] = useState({});
  // Which group of integrations is shown: all, or one section (owner, 27 Oct 2026).
  const [group, setGroup] = useState("all");
  useEffect(() => {
    const put = (k) => (r) => setExtra((e) => ({ ...e, [k]: r.data }));
    api.get("/plivo/settings").then(put("telephony")).catch(() => {});
    api.get("/calls/settings").then(put("enablex")).catch(() => {});
    api.get("/portal-leads/settings").then(put("portals")).catch(() => {});
    api.get("/meta-conversions").then(put("capi")).catch(() => {});
    api.get("/routing-rules").then((r) => setExtra((e) => ({ ...e, rules: r.data.rules || [] }))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!location.state?.presetPlatform) return;
    const platform = location.state.presetPlatform;
    if (platform === "Facebook") {
      setFbEditingItem(null);
      setFbWizardOpen(true);
    } else {
      setSourceEditingItem(null);
      setSourceModalOpen(true);
    }
  }, [location.state]);

  const handleSaved = (action, automation) => {
    setItems((prev) =>
      action === "create"
        ? [automation, ...prev]
        : prev.map((item) => (item._id === automation._id ? automation : item))
    );
  };

  // Pause or resume one connection. Paused means the webhook ignores new leads
  // from it (isActive false); nothing already received is touched.
  const [togglingId, setTogglingId] = useState(null);
  const toggleActive = async (item) => {
    const next = item.isActive === false || item.status === "paused";
    setTogglingId(item._id);
    try {
      const { data } = await api.patch(`/automations/${item._id}`, { isActive: next, status: next ? "connected" : "paused" });
      setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, isActive: next, status: data.automation?.status || (next ? "connected" : "paused") } : i)));
      toast.success(next ? "Connection resumed" : "Connection paused: new leads from it are ignored");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not change this connection");
    } finally {
      setTogglingId(null);
    }
  };

  const openEdit = (item) => {
    if (item.platform === "Facebook") {
      setFbEditingItem(item);
      setFbWizardOpen(true);
    } else if (item.platform === "Vistrow Voice") {
      navigate("/integrations/vistrow-voice");
    } else if (item.platform === "Google") {
      setGoogleWizardOpen(true);
    } else {
      setSourceEditingItem(item);
      setSourceModalOpen(true);
    }
  };

  const runDiagnostic = async (item) => {
    setDiagFor(item);
    setDiagResult(null);
    setDiagLoading(true);
    try {
      const { data } = await api.post("/automations/facebook/diagnose", { automationId: item._id });
      setDiagResult(data.results?.[0] || { checks: [], allOk: false, message: data.message });
    } catch (err) {
      toast.error(err.response?.data?.message || "Diagnostic failed");
      setDiagFor(null);
    } finally {
      setDiagLoading(false);
    }
  };

  const resubscribeFb = async () => {
    if (!diagFor) return;
    setResubscribing(true);
    try {
      const { data } = await api.post("/automations/facebook/resubscribe", { automationId: diagFor._id });
      toast.success(data.message || "Page re-subscribed.");
      await runDiagnostic(diagFor); // re-check so the user sees it turn green
    } catch (err) {
      toast.error(err.response?.data?.message || "Re-subscribe failed");
    } finally {
      setResubscribing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/automations/${deleting._id}`);
      setItems((prev) => prev.filter((item) => item._id !== deleting._id));
      toast.success("Connection removed");
      setDeleting(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove");
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyEndpoint = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied!");
    } catch {
      toast.error("Could not copy");
    }
  };

  const summary = useMemo(() => ({
    connected: items.filter((i) => i.status === "connected").length,
    total: items.length,
  }), [items]);

  if (loading) return <PageLoader />;

  const serverBase = (apiBase || "").replace(/\/api\/?$/, "");

  // ── The cards on this page (owner, 27 Oct 2026: modelled on the Vistrow
  // Voice dashboard). Each one: logo, name, category, status, one line, and a
  // footer with what's live plus Set up / Manage.
  const byPlatform = (p) => items.filter((i) => i.platform === p);
  const liveOf = (p) => byPlatform(p).filter((i) => i.status === "connected" && i.isActive !== false);
  const lastSync = (p) => byPlatform(p).map((i) => i.lastSyncAt).filter(Boolean).sort().pop();
  const footerFor = (p, noun) => {
    const n = byPlatform(p).length;
    if (!n) return "Not set up yet";
    const last = lastSync(p);
    return `${n} ${noun}${n === 1 ? "" : "s"}${last ? ` · last lead ${ago(last)}` : ""}`;
  };
  const conn = (live) => (live ? { status: "Connected", statusTone: "on", action: "Manage" } : { status: "Not connected", statusTone: "off", action: "Set up" });
  const openLocked = (plan) => { toast(`This is part of the ${plan} plan.`); navigate("/plans"); };
  const growthOk = authUser?.role === "super_admin" || canAccess(org, "growth");

  const portalsLive = (extra.portals?.portals || []).filter((p) => p.lastLeadAt);
  const portalsLast = portalsLive.map((p) => p.lastLeadAt).sort().pop();
  const rulesActive = (extra.rules || []).filter((r) => r.isActive !== false).length;
  const telProvider = extra.telephony?.provider;
  const telReady = telProvider === "none" ? false : telProvider === "plivo" ? !!(extra.telephony?.plivo?.hasAuthToken && extra.telephony?.plivo?.number) : !!extra.enablex?.connected;

  const SECTIONS = [
    {
      key: "sources",
      tab: "Lead sources",
      title: "Lead sources",
      note: "Where your leads come from. Each one drops new leads straight into Leads.",
      cards: [
        { key: "fb", logo: <LogoTile bg="#1877F2"><FacebookIcon /></LogoTile>, name: "Facebook Lead Ads", category: "Facebook & Instagram",
          description: "Every Instant Form lead from your Facebook and Instagram ads, in one click. No technical setup.",
          ...conn(liveOf("Facebook").length), footer: footerFor("Facebook", "page"),
          onOpen: () => { setFbEditingItem(null); setFbWizardOpen(true); } },
        { key: "wa", logo: <LogoTile bg="rgba(37,211,102,0.12)"><WhatsAppIcon className="h-5 w-5" style={{ color: "#25D366" }} /></LogoTile>, name: "WhatsApp Business", category: "Messaging",
          description: "Your own number for WhatsApp chats, templates, campaigns and the AI agent. Chats become leads.",
          ...conn(waStatus?.connected), footer: waStatus?.connected ? "Number connected" : "Not set up yet",
          onOpen: () => navigate("/integrations/whatsapp") },
        { key: "web", logo: <LogoTile bg="#21759b"><WordPressIcon /></LogoTile>, name: "Website forms", category: "Lead sources",
          description: "Capture enquiries from WordPress contact forms with our plugin, or any site form.",
          ...conn(liveOf("Website Form").length), footer: footerFor("Website Form", "site"),
          onOpen: () => navigate("/integrations/websites") },
        { key: "portals", logo: <PortalLogo />, name: "Property portals", category: "99acres · Housing.com · MagicBricks",
          description: "Portal enquiries arrive in Leads by themselves, tagged with the portal and project.",
          ...conn(portalsLive.length || extra.portals?.housing?.enabled),
          footer: portalsLive.length ? `${portalsLive.length} of 3 sending · last ${ago(portalsLast)}` : "Not set up yet",
          locked: !growthOk, lockLabel: "Growth", onOpen: () => (growthOk ? navigate("/integrations/portals") : openLocked("Growth")) },
        { key: "google", logo: <LogoTile><GoogleGIcon /></LogoTile>, name: "Google Ads lead forms", category: "Lead sources",
          description: "Leads from Google Ads lead form assets, sent in as they are submitted.",
          ...conn(liveOf("Google").length), footer: footerFor("Google", "connection"),
          locked: !enterpriseOk, lockLabel: "Enterprise", onOpen: () => (enterpriseOk ? setGoogleWizardOpen(true) : openLocked("Enterprise")) },
        { key: "custom", logo: <LogoTile bg="rgba(249,115,22,0.10)"><Link2 className="h-5 w-5" style={{ color: "#f97316" }} /></LogoTile>, name: "Custom / API", category: "Developer",
          description: "Any partner, broker or vendor that can post a lead to a link: send it straight into your CRM.",
          ...conn(liveOf("Custom").length), footer: footerFor("Custom", "connection"),
          locked: !enterpriseOk, lockLabel: "Enterprise", onOpen: () => { if (!enterpriseOk) return openLocked("Enterprise"); setSourceEditingItem(null); setSourceModalOpen(true); } },
      ],
    },
    {
      key: "calling",
      tab: "Calling",
      title: "Calling",
      note: "Click-to-call, recordings, AI call summaries and AI calling.",
      cards: [
        { key: "tel", logo: telProvider && telProvider !== "none" ? <BrandLogo brand={telProvider} alt={telProvider} /> : <LogoTile bg="rgba(249,115,22,0.10)"><Phone className="h-5 w-5" style={{ color: "#f97316" }} /></LogoTile>, name: "Telephony", category: "Plivo · EnableX",
          description: "Call leads from the CRM and the app; every call is logged, recorded and summarised.",
          ...(telReady ? { status: "Connected", statusTone: "on", action: "Manage" } : { status: "Not connected", statusTone: "off", action: "Set up" }),
          footer: telProvider === "none" ? "Calling switched off" : telProvider ? `Calls through ${telProvider === "plivo" ? "Plivo" : "EnableX"}` : "Not set up yet",
          onOpen: () => navigate("/integrations/telephony") },
        { key: "vistrow", logo: <LogoTile><VistrowVoiceIcon size={40} /></LogoTile>, name: "Vistrow Voice", category: "AI calling",
          description: "AI calls your new leads in seconds and sends back qualified leads with the full transcript.",
          ...conn(liveOf("Vistrow Voice").length), footer: liveOf("Vistrow Voice").length ? "Connected" : "Not set up yet",
          locked: !enterpriseOk, lockLabel: "Enterprise", onOpen: () => (enterpriseOk ? navigate("/integrations/vistrow-calling") : openLocked("Enterprise")) },
      ],
    },
    {
      key: "ads",
      tab: "Ads and routing",
      title: "Ads and routing",
      note: "Send leads to the right person, and tell Meta which leads turn into buyers.",
      cards: [
        { key: "routing", logo: <RoutingLogo />, name: "Lead routing rules", category: "Routing",
          description: "Leads from a chosen campaign, WhatsApp ad or website page go straight to a team member or project.",
          ...(rulesActive ? { status: `${rulesActive} active`, statusTone: "on", action: "Manage" } : { status: "No rules", statusTone: "off", action: "Set up" }),
          footer: rulesActive ? "Everything else follows the rotation" : "Not set up yet",
          locked: !growthOk, lockLabel: "Growth", onOpen: () => (growthOk ? navigate("/integrations/routing") : openLocked("Growth")) },
        { key: "capi", logo: <BrandLogo brand="meta" alt="Meta" />, name: "Meta conversion tracking", category: "Ads",
          description: "Tells Meta which ad leads become serious buyers, so your ads find more people like them.",
          ...(extra.capi?.enabled ? { status: "On", statusTone: "on", action: "Manage" } : { status: "Off", statusTone: "off", action: "Set up" }),
          footer: extra.capi ? `${(extra.capi.stats?.sent || 0).toLocaleString("en-IN")} events sent` : "Not set up yet",
          locked: !growthOk, lockLabel: "Growth", onOpen: () => (growthOk ? navigate("/integrations/conversion-tracking") : openLocked("Growth")) },
      ],
    },
  ];
  const allCards = SECTIONS.flatMap((s) => s.cards);
  const liveCards = allCards.filter((c) => !c.locked && c.statusTone === "on").length;

  return (
    <div className="stitch-page space-y-5">
      {/* One main card, like the Leads page: title, totals, then the tabs. */}
      <section className="card px-5 py-4 space-y-4">
        <div className="pb-3" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <h1 className="text-[15px] sm:text-xl font-black tracking-tight text-app leading-none">Integrations</h1>
          <p className="text-xs text-app-soft mt-1.5">Connect where your leads come from, how you call them, and how your ads learn from them.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile inset icon={Link2} label="Connected" value={liveCards} note="live and sending" />
          <StatTile inset icon={LayoutGrid} label="Available" value={allCards.length} note="open one to set it up" />
          <StatTile inset icon={Plug} label="Your connections" value={items.length} note="pages, sites and links below" />
        </div>
        <SegmentTabs ariaLabel="Integrations" value={group} onChange={setGroup} fullWidth
          tabs={[
            { value: "all", label: "All", count: allCards.length },
            ...SECTIONS.map((s) => ({ value: s.key, label: s.tab, count: s.cards.length })),
            ...(items.length ? [{ value: "connections", label: "Your connections", count: items.length }] : []),
          ]} />
      </section>

      {SECTIONS.filter((s) => group === "all" || group === s.key).map((s) => (
        <section key={s.title} className="space-y-3">
          <SectionTitle title={s.title} note={s.note} />
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            {s.cards.map(({ key, ...c }) => <IntegrationCard key={key} {...c} />)}
          </div>
        </section>
      ))}

      {items.length > 0 && (group === "all" || group === "connections") && (
        <section className="space-y-3">
          <SectionTitle title="Your connections" note="Every Facebook page, website and link sending you leads. Pause or edit one here." />
          <ConnectionGroups
            items={items}
            renderCard={(item) => {
              const preset = PLATFORM_PRESETS[item.platform] || PLATFORM_PRESETS.Custom;
              const Icon = preset.icon;
              const isFb = item.platform === "Facebook";
              const isVistrowVoice = item.platform === "Vistrow Voice";
              const leading = isFb ? <div className="flex h-full w-full items-center justify-center bg-[#1877F2]"><FacebookIcon /></div>
                : isVistrowVoice ? <VistrowVoiceIcon size={40} />
                : item.platform === "Website Form"
                  ? <SiteFavicon iconUrl={item.siteIconUrl} kind={item.siteIconKind} name={item.siteName || item.siteUrl || item.name} size={28} />
                  : <Icon className="h-5 w-5" />;
              return (
                <ConnectionCard
                  key={item._id}
                  item={item}
                  leading={leading}
                  serverBase={serverBase}
                  endpointPath={ingestPath(item.platform, item.webhookPath)}
                  onCopy={copyEndpoint}
                  onEdit={() => openEdit(item)}
                  onSettings={isVistrowVoice ? () => navigate("/integrations/vistrow-voice") : null}
                  onDelete={() => setDeleting(item)}
                  onToggleActive={() => toggleActive(item)}
                  toggling={togglingId === item._id}
                  onDiagnose={() => runDiagnostic(item)}
                  onRefreshToken={() => handleRefreshFbTokens(item._id, item.orgId)}
                  onReconnect={() => { setFbEditingItem(item); setFbWizardOpen(true); }}
                  refreshing={refreshingId === item._id}
                  formNamesEditor={isFb ? (
                    <FormLabelsEditor
                      item={item}
                      onUpdated={(id, formLabels) =>
                        setItems((prev) => prev.map((i) => (i._id === id ? { ...i, formLabels } : i)))
                      }
                    />
                  ) : null}
                />
              );
            }}
          />
        </section>
      )}

      {/* Google Ads Wizard */}
      <GoogleWizard
        open={googleWizardOpen}
        onClose={() => setGoogleWizardOpen(false)}
        onChanged={loadItems}
      />

      {/* Facebook Diagnostic */}
      <Modal open={!!diagFor} onClose={() => { setDiagFor(null); setDiagResult(null); }} title="Facebook Lead Diagnostic" size="md">
        {diagLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Spinner />
            <p className="text-sm text-app-soft">Checking your connection with Meta…</p>
          </div>
        ) : diagResult ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${diagResult.allOk ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                {diagResult.allOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {diagResult.allOk ? "All checks passed" : "Problem found"}
              </span>
              <span className="text-sm text-app-soft truncate">{diagResult.pageName || diagResult.name}</span>
            </div>

            {(diagResult.checks || []).length === 0 && (
              <p className="text-sm text-app-soft">{diagResult.message || "No Facebook connection to diagnose."}</p>
            )}

            <div className="space-y-2">
              {(diagResult.checks || []).map((c) => (
                <div key={c.key} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "var(--app-surface-low)" }}>
                  {c.ok
                    ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
                    : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-app">{c.label}</p>
                    <p className="text-xs text-app-soft break-words">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {diagResult.allOk && (diagResult.checks || []).length > 0 && (
              <p className="text-xs text-app-soft">
                Everything checks out on our side. If leads still don't arrive, the Meta App may be in <span className="font-semibold text-app">Development</span> mode
                (real leads only deliver in Live mode), or the ad's lead form isn't the one selected here. Test with Meta's Lead Ads Testing Tool.
              </p>
            )}

            {diagResult.canResubscribe && (
              <button
                onClick={resubscribeFb}
                disabled={resubscribing}
                className="btn-primary w-full rounded-xl flex items-center justify-center gap-2"
              >
                {resubscribing ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
                {resubscribing ? "Re-subscribing…" : "Re-subscribe Page to leadgen webhook"}
              </button>
            )}

            <div className="flex justify-end">
              <button className="btn-secondary rounded-xl" onClick={() => runDiagnostic(diagFor)}>
                <RefreshCw className="h-4 w-4" /> Re-run
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Facebook Wizard */}
      <FacebookWizard
        open={fbWizardOpen}
        onClose={() => setFbWizardOpen(false)}
        onSaved={handleSaved}
        editingItem={fbEditingItem}
        apiBase={apiBase}
      />

      {/* Non-FB Source Modal */}
      <SourceModal
        open={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        editingItem={sourceEditingItem}
        onSaved={handleSaved}
        apiBase={apiBase}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Remove Connection"
        message={deleting ? `Remove "${deleting.name}" from your connections?` : ""}
      />

    </div>
  );
}

function FacebookIcon2() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}
