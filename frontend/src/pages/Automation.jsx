import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2, ChevronRight, Copy, ExternalLink, Globe2,
  Link2, MessageCircle, Pencil, Plus, SearchCheck, Trash2, Webhook, Download, RefreshCw, ShieldCheck, AlertTriangle,
} from "lucide-react";
import api from "../services/api";
import { ConfirmDialog, EmptyState, Modal, PageLoader, Spinner } from "../components/UI";
import CustomSelect from "../components/CustomSelect";

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
    mode: "api",
    status: "draft",
    leadSourceLabel: "Google",
    webhookPath: "/api/leads",
    description: "Connect Google Ads landing pages or lead bridges into the CRM API.",
    icon: SearchCheck,
    tone: "bg-red-500/10 text-red-400",
  },
  WhatsApp: {
    mode: "api",
    status: "draft",
    leadSourceLabel: "WhatsApp",
    webhookPath: "/api/leads",
    description: "Route WhatsApp enquiries from a bot or form into the CRM.",
    icon: MessageCircle,
    tone: "bg-green-500/10 text-green-400",
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
    leadSourceLabel: "Other",
    webhookPath: "/api/leads",
    description: "Connect any other partner, broker, or vendor lead source.",
    icon: Link2,
    tone: "bg-orange-500/10 text-orange-400",
  },
};

const emptyNonFbForm = {
  name: "",
  platform: "Google",
  mode: "api",
  status: "draft",
  description: "",
  leadSourceLabel: "Google",
  externalSourceId: "",
  externalSourceUrl: "",
  webhookPath: "/api/leads",
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
          toast.error("No Facebook Pages found. Your page may be in Business Manager — use the System Token below.");
        }
      }
      if (result.type === "facebook_oauth_error") {
        toast.error(result.message || "Facebook connection failed. Please try again.");
      }
    };

    // Primary: postMessage - fires synchronously before window.close()
    const onMessage = (e) => {
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
    const url = `${(apiBase || "").replace(/\/api\/?$/, "")}/api/automations/facebook/connect`;
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
        toast.success("Facebook connection updated");
      } else {
        const { data } = await api.post("/automations", payload);
        onSaved("create", data.automation);
        toast.success("Facebook Lead Ads connected!");
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
                      Select the <em>Arthaleads</em> app and enable: <code className="bg-black/20 px-1 rounded">leads_retrieval</code>, <code className="bg-black/20 px-1 rounded">pages_show_list</code>, <code className="bg-black/20 px-1 rounded">pages_read_engagement</code>. This token never expires.
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
                    This usually means Facebook didn't grant Pages permission. When the login window opens,
                    make sure to click <strong>"Continue"</strong> on every permission screen - don't uncheck anything.
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
                  placeholder="e.g. PropHunt LLP - Lead Ads"
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
        const { data } = await api.patch(`/automations/${editingItem._id}`, form);
        onSaved("update", data.automation);
        toast.success("Source updated");
      } else {
        const { data } = await api.post("/automations", form);
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

  const endpoint = `${(apiBase || "").replace(/\/api\/?$/, "")}${form.webhookPath || "/api/leads"}`;

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
              options={Object.keys(PLATFORM_PRESETS).filter((p) => p !== "Facebook")}
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
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" value={form.mappingNotes} onChange={set("mappingNotes")} placeholder="Notes about field mapping or setup details" />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-app" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
          <input type="checkbox" checked={form.isActive} onChange={set("isActive")} />
          This source is active
        </label>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : editingItem ? "Update" : "Save Source"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── WordPress Wizard ─────────────────────────────────────────────────────── */
const FORM_PLUGINS = [
  "Contact Form 7", "WPForms", "Elementor", "Gravity Forms",
  "Ninja Forms", "Forminator", "Fluent Forms",
];

function WpSiteCard({ conn, onDelete }) {
  const [copiedId, setCopiedId] = useState(null);
  const isConnected = conn.status === "connected";
  const [deleting, setDeleting] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(conn.token);
    setCopiedId(conn.id);
    toast.success("Token copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${conn.name}" from Arthaleads? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/automations/${conn.id}`);
      onDelete(conn.id);
      toast.success("Site connection removed");
    } catch {
      toast.error("Failed to remove connection");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${isConnected ? "border-emerald-500/30" : "border-[var(--app-border)]"}`}>
      {/* Site header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${isConnected ? "bg-emerald-500" : "bg-[var(--app-surface-low)]"}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${isConnected ? "bg-white/20" : "bg-[#21759b]"}`}>
          <WordPressIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${isConnected ? "text-white" : "text-app"}`}>
            {conn.siteName || conn.name}
          </p>
          {conn.siteUrl && <p className={`text-xs truncate ${isConnected ? "text-white/70" : "text-app-soft"}`}>{conn.siteUrl}</p>}
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

      {/* Connected forms */}
      {conn.connectedForms?.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 py-2" style={{ borderBottom: "1px solid var(--app-border)" }}>
          {conn.connectedForms.map((f) => (
            <span key={f} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ {f}</span>
          ))}
        </div>
      )}

      {/* Token row */}
      <div className="flex items-center gap-2 px-4 py-3">
        <code className="flex-1 rounded-xl px-3 py-2 text-sm font-mono font-bold text-orange-400 tracking-wider min-w-0 truncate" style={{ background: "var(--app-surface-low)" }}>
          {conn.token}
        </code>
        <button onClick={copy} className="btn-secondary rounded-xl px-3 py-2 shrink-0 flex items-center gap-1.5 text-xs">
          {copiedId === conn.id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedId === conn.id ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function WordPressWizard({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [adding, setAdding] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const load = useCallback((isInitial = false) => {
    if (isInitial) setLoading(true);
    return api.get("/automations/website/token")
      .then(({ data }) => {
        setConnections(data.connections || []);
        return (data.connections || []);
      })
      .catch(() => isInitial && toast.error("Failed to load connections"))
      .finally(() => isInitial && setLoading(false));
  }, []);

  // Poll every 4s while any site is pending, stop when all connected
  useEffect(() => {
    if (!open) return;
    load(true);
    const interval = setInterval(() => {
      load(false).then((conns) => {
        if (conns.every((c) => c.status === "connected")) clearInterval(interval);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [open, load]);

  const handleAddSite = async () => {
    setAdding(true);
    try {
      const { data } = await api.post("/automations/website/create", { name: `WordPress Site ${connections.length + 1}` });
      setConnections((prev) => [...prev, data.connection]);
      toast.success("New site token created - copy it and paste it into the plugin on your new WordPress site.");
    } catch {
      toast.error("Failed to create connection");
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:rounded-[1.75rem] rounded-t-[1.75rem] shell-panel overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "#21759b" }}>
            <WordPressIcon />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-app">WordPress / Website Forms</h2>
            <p className="text-xs text-app-soft">Connect multiple WordPress sites - each gets its own token</p>
          </div>
          <a
            href="/arthaleads-integration.zip"
            download
            title="Download WordPress Plugin"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "#21759b1a", color: "#21759b", border: "1px solid #21759b33" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#21759b"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#21759b1a"; e.currentTarget.style.color = "#21759b"; }}
          >
            <Download className="h-3.5 w-3.5" />
            Download Plugin
          </a>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <>
              {/* Connected sites list */}
              {connections.map((conn) => (
                <WpSiteCard
                  key={conn.id}
                  conn={conn}
                  onDelete={(id) => setConnections((prev) => prev.filter((c) => c.id !== id))}
                />
              ))}

              {/* Add another site */}
              <button
                type="button"
                onClick={handleAddSite}
                disabled={adding}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold border-2 border-dashed border-[var(--app-border)] text-app-soft hover:border-[#21759b] hover:text-[#21759b] transition"
              >
                {adding ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
                {adding ? "Creating…" : "Add Another WordPress Site"}
              </button>

              {/* Setup steps (collapsible) */}
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowSteps((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-app-soft uppercase tracking-wider hover:text-app transition"
                  style={{ background: "var(--app-surface-low)" }}
                >
                  <span>Setup Steps</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${showSteps ? "rotate-90" : ""}`} />
                </button>
                {showSteps && [
                  "In your WordPress admin → Plugins → Add New",
                  'Search for "Arthaleads" and install the plugin',
                  'Activate it, then click "Arthaleads CRM" in the left sidebar',
                  "Copy your site's token above and paste it into the Account Token field",
                  "Enter your website name, then click Save",
                  "Leads will now flow into Arthaleads automatically",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--app-border)" }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold mt-0.5">{i + 1}</span>
                    <p className="text-sm text-app-soft">{text}</p>
                  </div>
                ))}
              </div>

              {/* Supported plugins */}
              <div className="flex flex-wrap gap-2">
                {FORM_PLUGINS.map((p) => (
                  <span key={p} className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">✓ {p}</span>
                ))}
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

function WordPressIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM3.5 12c0-1.232.252-2.405.7-3.471L7.942 19.1A8.5 8.5 0 013.5 12zm8.5 8.5a8.46 8.46 0 01-2.41-.349l2.56-7.438 2.622 7.186a.95.95 0 00.07.136A8.472 8.472 0 0112 20.5zm1.17-12.485c.512-.027.973-.08.973-.08.457-.054.403-.726-.054-.7 0 0-1.376.108-2.265.108-.835 0-2.238-.108-2.238-.108-.457-.027-.511.673-.054.7 0 0 .435.053.893.08l1.327 3.635-1.863 5.589-3.102-9.224c.511-.027.972-.08.972-.08.457-.054.403-.726-.054-.7 0 0-1.376.108-2.265.108a15.1 15.1 0 01-.548-.018A8.5 8.5 0 0120.338 9.2c-.027.001-.054.004-.082.004-.835 0-1.428.726-1.428 1.508 0 .7.403 1.292.835 1.992.323.566.7 1.293.7 2.346 0 .727-.28 1.57-.646 2.75l-.847 2.826-3.07-9.11zm2.832 10.934l2.607-7.533c.487-1.219.65-2.193.65-3.059 0-.314-.021-.607-.058-.883a8.5 8.5 0 01-3.199 11.475z"/>
    </svg>
  );
}

/* ─── Main Automation page ─────────────────────────────────────────────────── */
export default function Automation() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Facebook wizard state
  const [fbWizardOpen, setFbWizardOpen] = useState(false);
  const [fbEditingItem, setFbEditingItem] = useState(null);

  // WordPress wizard state
  const [wpWizardOpen, setWpWizardOpen] = useState(false);

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

  const openEdit = (item) => {
    if (item.platform === "Facebook") {
      setFbEditingItem(item);
      setFbWizardOpen(true);
    } else {
      setSourceEditingItem(item);
      setSourceModalOpen(true);
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

  return (
    <div className="stitch-page space-y-6">
      {/* Header */}
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="stitch-kicker mb-2">Lead Sources</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Connect Your Accounts</h1>
            <p className="mt-2 max-w-2xl text-sm text-app-soft">
              Connect Facebook Lead Ads, Google, WhatsApp, and more. Leads flow directly into your CRM automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary rounded-xl"
              onClick={() => { setFbEditingItem(null); setFbWizardOpen(true); }}
            >
              <FacebookIcon2 /> Connect Facebook
            </button>
            <button
              className="btn-secondary rounded-xl"
              onClick={() => { setSourceEditingItem(null); setSourceModalOpen(true); }}
            >
              <Plus className="h-4 w-4" /> Other Source
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Connected" value={summary.connected} note="Live channels" accent="text-emerald-400" />
        <MetricCard label="Total Sources" value={summary.total} note="All connections" />
        <MetricCard label="Facebook" value={items.filter((i) => i.platform === "Facebook").length} note="Meta Lead Ads" accent="text-blue-400" />
        <MetricCard label="Other" value={items.filter((i) => i.platform !== "Facebook").length} note="Google · WhatsApp · Web" />
      </section>

      {/* Quick connect tiles */}
      <section>
        <p className="mb-3 text-sm font-semibold text-app-soft">Quick connect</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
          {/* Facebook tile - special styling */}
          <button
            type="button"
            data-tour="fb-connect"
            className="card p-5 text-left transition hover:-translate-y-1 hover:border-blue-500/30 relative overflow-hidden"
            onClick={() => { setFbEditingItem(null); setFbWizardOpen(true); }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1877F2]">
              <FacebookIcon />
            </div>
            <h3 className="mt-4 text-base font-semibold text-app">Facebook</h3>
            <p className="mt-1 text-xs text-app-soft">Lead Ads · One click</p>
            <span className="absolute top-3 right-3 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">Popular</span>
          </button>

          {Object.entries(PLATFORM_PRESETS)
            .filter(([p]) => p !== "Facebook")
            .map(([platform, preset]) => {
              const Icon = preset.icon;
              const isWebsiteForm = platform === "Website Form";
              return (
                <button
                  key={platform}
                  type="button"
                  className="card p-5 text-left transition hover:-translate-y-1 hover:border-orange-500/30"
                  onClick={() => {
                    if (isWebsiteForm) {
                      setWpWizardOpen(true);
                    } else {
                      setSourceEditingItem(null);
                      setSourceModalOpen(true);
                    }
                  }}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isWebsiteForm ? "bg-[#21759b]" : preset.tone}`}>
                    {isWebsiteForm ? <WordPressIcon /> : <Icon className="h-5 w-5" />}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-app">{preset.label || platform}</h3>
                  <p className="mt-1 text-xs text-app-soft">{preset.description.split(".")[0]}</p>
                </button>
              );
            })}
        </div>
      </section>

      {/* Connected sources list */}
      {items.length === 0 ? (
        <section className="card">
          <EmptyState
            title="No connections yet"
            desc="Connect Facebook Lead Ads in one click - no technical setup needed."
            action={
              <button className="btn-primary" onClick={() => { setFbEditingItem(null); setFbWizardOpen(true); }}>
                <FacebookIcon2 /> Connect Facebook
              </button>
            }
          />
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-app-soft">Your connections ({items.length})</p>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => {
              const preset = PLATFORM_PRESETS[item.platform] || PLATFORM_PRESETS.Custom;
              const Icon = preset.icon;
              const isFb = item.platform === "Facebook";
              const endpointPath = item.webhookPath || "/api/leads";
              return (
                <article key={item._id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isFb ? "bg-[#1877F2]" : preset.tone}`}>
                        {isFb ? <FacebookIcon /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-app">{item.name}</h3>
                        <p className="text-xs text-app-soft">{item.platform}</p>
                      </div>
                    </div>
                    <span className={`badge shrink-0 ${item.status === "connected" ? "bg-emerald-500/10 text-emerald-400" : item.status === "paused" ? "bg-amber-500/10 text-amber-400" : "bg-white/5 text-app-soft"}`}>
                      {item.status}
                    </span>
                  </div>

                  {isFb ? (() => {
                    // Token health calculation
                    const expiresAt     = item.userTokenExpiresAt ? new Date(item.userTokenExpiresAt) : null;
                    const daysLeft      = expiresAt ? Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                    const isPermanent   = daysLeft !== null && daysLeft > 365 * 5; // 2099 sentinel
                    const tokenExpired  = !isPermanent && daysLeft !== null && daysLeft <= 0;
                    const tokenOk       = isPermanent || daysLeft === null || daysLeft > 20;
                    const tokenWarn     = !isPermanent && daysLeft !== null && daysLeft <= 20 && daysLeft > 5;
                    const tokenBad      = !isPermanent && daysLeft !== null && daysLeft <= 5;
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-3 rounded-xl p-3 stitch-surface-muted text-sm">
                          <div>
                            <p className="text-xs text-app-soft">Page ID</p>
                            <p className="mt-0.5 font-medium text-app truncate">{item.pageId || "All pages"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-app-soft">Form</p>
                            <p className="mt-0.5 font-medium text-app truncate">{item.formId || "All forms"}</p>
                          </div>
                        </div>
                        {/* Token health row */}
                        <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${tokenBad ? "bg-red-500/10 border border-red-500/30" : tokenWarn ? "bg-amber-500/10 border border-amber-400/30" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                          <div className="flex items-center gap-1.5">
                            {tokenBad ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> : tokenWarn ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                            <span className={tokenBad ? "text-red-400 font-semibold" : tokenWarn ? "text-amber-400 font-semibold" : "text-emerald-400"}>
                              {isPermanent
                                ? "Permanent System User Token — never expires"
                                : daysLeft === null
                                  ? "Token health unknown - click Refresh"
                                  : tokenExpired
                                    ? "Token expired — reconnect now to resume lead capture"
                                    : tokenBad
                                      ? `Token expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — refresh now!`
                                      : tokenWarn
                                        ? `Token expires in ${daysLeft} days — refresh soon`
                                        : `Token valid for ${daysLeft} days`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {tokenExpired ? (
                              <button
                                onClick={() => { setFbEditingItem(item); setFbWizardOpen(true); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500 text-white transition hover:bg-red-600"
                              >
                                <RefreshCw className="w-3 h-3" /> Reconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRefreshFbTokens(item._id, item.orgId)}
                                disabled={refreshingId === item._id}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition disabled:opacity-50 ${tokenBad ? "bg-red-500 text-white" : tokenWarn ? "bg-amber-500 text-white" : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"}`}
                              >
                                <RefreshCw className={`w-3 h-3 ${refreshingId === item._id ? "animate-spin" : ""}`} />
                                {refreshingId === item._id ? "Refreshing…" : "Refresh"}
                              </button>
                            )}
                          </div>
                        </div>
                        {item.tokenRefreshedAt && (
                          <p className="text-[10px] text-app-soft px-1">
                            Last refreshed: {new Date(item.tokenRefreshedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    );
                  })() : item.platform === "Website Form" ? (
                    <div className="rounded-xl p-3 stitch-surface-muted space-y-2">
                      {item.siteName || item.siteUrl ? (
                        <div>
                          <p className="text-xs text-app-soft mb-0.5">Connected Website</p>
                          <p className="font-semibold text-sm text-app">{item.siteName || "WordPress Site"}</p>
                          {item.siteUrl && <p className="text-xs text-app-soft">{item.siteUrl}</p>}
                        </div>
                      ) : null}
                      {item.connectedForms?.length > 0 && (
                        <div>
                          <p className="text-xs text-app-soft mb-1">Active Forms</p>
                          <div className="flex flex-wrap gap-1">
                            {item.connectedForms.map((f) => (
                              <span key={f} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ {f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-app-soft mb-1">API Endpoint</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate rounded-xl px-3 py-1.5 text-xs text-orange-400" style={{ background: "var(--app-surface-low)" }}>
                            {serverBase}{endpointPath}
                          </code>
                          <button className="btn-secondary rounded-xl shrink-0" onClick={() => copyEndpoint(`${serverBase}${endpointPath}`)}>
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl p-3 stitch-surface-muted">
                      <p className="text-xs text-app-soft mb-2">API Endpoint</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-xl px-3 py-1.5 text-xs text-orange-400" style={{ background: "var(--app-surface-low)" }}>
                          {serverBase}{endpointPath}
                        </code>
                        <button className="btn-secondary rounded-xl shrink-0" onClick={() => copyEndpoint(`${serverBase}${endpointPath}`)}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button className="btn-secondary rounded-xl" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    {item.externalSourceUrl && (
                      <a href={item.externalSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary rounded-xl">
                        <ExternalLink className="h-4 w-4" /> Open
                      </a>
                    )}
                    <button className="btn-danger rounded-xl ml-auto" onClick={() => setDeleting(item)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* WordPress Wizard */}
      <WordPressWizard
        open={wpWizardOpen}
        onClose={() => setWpWizardOpen(false)}
        apiBase={apiBase}
      />

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

      {/* Campaign Routing Rules */}
      <LeadRoutingSection />
    </div>
  );
}

/* ─── Lead Routing Rules ───────────────────────────────────────────────────── */
const SALES_AGENTS = [
  { id: "69d4ea3a01817aba627ef9b9", name: "Saurabh Sir" },
  { id: "69d4ea9601817aba627ef9c6", name: "Sandeep Sir" },
  { id: "69d35698556a7da63c6ca61f", name: "Sheetal Powar" },
];

const MATCH_FIELD_LABELS = {
  form_id:     "Form ID",
  campaign_id: "Campaign ID",
  adset_id:    "Ad Set ID",
  ad_id:       "Ad ID",
};

function LeadRoutingSection() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", matchField: "form_id", matchValue: "", assignTo: SALES_AGENTS[0].id });

  useEffect(() => {
    api.get("/routing-rules")
      .then(({ data }) => setRules(data.rules || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.matchValue.trim()) {
      toast.error("Please fill in all fields"); return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/routing-rules", form);
      setRules((prev) => [data.rule, ...prev]);
      setForm({ label: "", matchField: "form_id", matchValue: "", assignTo: SALES_AGENTS[0].id });
      setShowForm(false);
      toast.success("Routing rule added");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule) => {
    try {
      const { data } = await api.patch(`/routing-rules/${rule._id}`, { isActive: !rule.isActive });
      setRules((prev) => prev.map((r) => r._id === rule._id ? data.rule : r));
    } catch { toast.error("Failed to update rule"); }
  };

  const deleteRule = async (id) => {
    if (!confirm("Delete this routing rule?")) return;
    try {
      await api.delete(`/routing-rules/${id}`);
      setRules((prev) => prev.filter((r) => r._id !== id));
      toast.success("Rule deleted");
    } catch { toast.error("Failed to delete rule"); }
  };

  return (
    <section className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-app">Campaign Routing Rules</h2>
          <p className="text-sm text-app-soft mt-0.5">
            Route leads from specific Facebook campaigns or forms directly to a team member. All other leads follow the round-robin rotation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary rounded-xl shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {/* Add rule form */}
      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
          <p className="text-sm font-semibold text-app">New Routing Rule</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="label">Rule Name</label>
              <input
                className="input"
                placeholder="e.g. Joyville Hinjewadi Campaign"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="label">Assign To</label>
              <CustomSelect
                value={form.assignTo}
                onChange={(v) => setForm((f) => ({ ...f, assignTo: v }))}
                options={SALES_AGENTS.map((a) => ({ value: a.id, label: a.name }))}
                style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
              />
            </div>

            <div className="space-y-1">
              <label className="label">Match By</label>
              <CustomSelect
                value={form.matchField}
                onChange={(v) => setForm((f) => ({ ...f, matchField: v }))}
                options={Object.entries(MATCH_FIELD_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
              />
            </div>

            <div className="space-y-1">
              <label className="label">{MATCH_FIELD_LABELS[form.matchField]} Value</label>
              <input
                className="input font-mono text-sm"
                placeholder="e.g. 9655855458173381"
                value={form.matchValue}
                onChange={(e) => setForm((f) => ({ ...f, matchValue: e.target.value.trim() }))}
              />
              <p className="text-xs text-app-soft">Find this in Facebook Ads Manager → Campaign → {MATCH_FIELD_LABELS[form.matchField]}</p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-secondary rounded-xl" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary rounded-xl" disabled={saving}>
              {saving ? <><Spinner size="sm" /> Saving…</> : "Save Rule"}
            </button>
          </div>
        </form>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-app-soft" style={{ borderColor: "var(--app-border)" }}>
          No routing rules yet. Add one above to route specific campaigns to a team member.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule._id} className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition ${rule.isActive ? "border-[var(--app-border)]" : "border-dashed border-[var(--app-border)] opacity-50"}`}>
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleRule(rule)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${rule.isActive ? "bg-emerald-500" : "bg-white/10"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${rule.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-app truncate">{rule.label}</p>
                <p className="text-xs text-app-soft">
                  {MATCH_FIELD_LABELS[rule.matchField]} <code className="text-orange-400 font-mono">{rule.matchValue}</code>
                  {" → "}
                  <span className="text-emerald-400 font-medium">{rule.assignToName}</span>
                </p>
              </div>

              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${rule.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-app-soft"}`}>
                {rule.isActive ? "Active" : "Paused"}
              </span>

              <button onClick={() => deleteRule(rule._id)} className="text-app-soft hover:text-red-400 transition shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <p className="text-xs text-app-soft text-center pt-1">
            All other leads (no match) → round-robin between Saurabh Sir, Sandeep Sir, Sheetal Powar
          </p>
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, note, accent = "text-app" }) {
  return (
    <div className="card p-5">
      <p className="stitch-kicker mb-2">{label}</p>
      <p className={`text-3xl font-black tracking-tight ${accent}`}>{value}</p>
      <p className="mt-2 text-xs text-app-soft">{note}</p>
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
