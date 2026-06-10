// components/UI.jsx - Shared reusable components
import { STATUS_COLORS, PRIORITY_COLORS, SOURCE_COLORS } from "../utils/constants";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Phone, MessageCircle, ChevronDown, Check, Calendar, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`badge ${PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-600"}`}>
      {priority}
    </span>
  );
}

export function SourceBadge({ source }) {
  return (
    <span className={`badge ${SOURCE_COLORS[source] || "bg-gray-100 text-gray-600"}`}>
      {source}
    </span>
  );
}

export function Spinner({ size = "md" }) {
  const sz = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-5 h-5";
  return <Loader2 className={`${sz} animate-spin text-orange-500`} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = "md" }) {
  // Escape-to-close + lock body scroll while open (hooks must run every render)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Dialog"}
    >
      {/* Backdrop — separate element so backdrop-filter is never clipped by a parent */}
      <div
        className="absolute inset-0 bg-black/50"
        style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <div
        className={`relative w-full ${widths[size]} rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden`}
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <h2 className="text-base font-bold text-app">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-app-soft hover:text-app transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6" style={{ maxHeight: "75vh" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-12 h-12 text-app-soft mb-4 opacity-40" />}
      <p className="text-app font-medium">{title}</p>
      {desc && <p className="text-app-soft text-sm mt-1">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, delta, color = "text-brand-600", icon: Icon, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={`card p-4 sm:p-6 text-left w-full ${onClick ? "hover:-translate-y-1 hover:border-orange-500/30 transition-all cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="stitch-kicker mb-1 sm:mb-2 text-[9px] sm:text-[11px]">{label}</p>
          <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-[10px] sm:text-xs text-app-soft mt-1 sm:mt-2 truncate">{sub}</p>}
          {delta !== null && delta !== undefined && (
            <p className={`text-[10px] font-semibold mt-0.5 ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs last month
            </p>
          )}
        </div>
        {Icon && (
          <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center ml-2" style={{ background: "color-mix(in srgb, var(--app-primary) 10%, transparent)" }}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
          </div>
        )}
      </div>
    </Tag>
  );
}

export function FormField({ label, error, children }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-app-soft text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

// ── Phone helpers ─────────────────────────────────────────────────────────────
// Normalises phone → international format for wa.me (defaults to +91 India)
export function toWaNumber(phone = "") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

// Orange call icon + phone number - tap to dial
export function PhoneActions({ phone, onContact }) {
  if (!phone) return <span className="text-xs text-app-soft">-</span>;
  return (
    <a
      href={`tel:${phone}`}
      className="flex items-center gap-1.5 text-xs text-app-soft hover:text-orange-500 transition whitespace-nowrap"
      title={`Call ${phone}`}
      onClick={() => onContact?.()}
    >
      <Phone className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
      {phone}
    </a>
  );
}

// Detect platform for deep-link strategy
function getPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

// Open WhatsApp Personal specifically (package=com.whatsapp on Android)
function openWAPersonal(waNumber, text = "") {
  const platform = getPlatform();
  const encodedText = text ? encodeURIComponent(text) : "";
  if (platform === "android") {
    const fallback = encodeURIComponent(`https://wa.me/${waNumber}${encodedText ? `?text=${encodedText}` : ""}`);
    window.location.href =
      `intent://send?phone=${waNumber}${encodedText ? `&text=${encodedText}` : ""}` +
      `#Intent;package=com.whatsapp;scheme=whatsapp;` +
      `S.browser_fallback_url=${fallback};end`;
  } else if (platform === "ios") {
    window.location.href = `whatsapp://send?phone=${waNumber}${encodedText ? `&text=${encodedText}` : ""}`;
  } else {
    window.open(`https://wa.me/${waNumber}${encodedText ? `?text=${encodedText}` : ""}`, "_blank", "noopener,noreferrer");
  }
}

// Open WhatsApp Business specifically (package=com.whatsapp.w4b on Android)
function openWABusiness(waNumber, text = "", onNotInstalled) {
  const platform = getPlatform();
  const encodedText = text ? encodeURIComponent(text) : "";
  if (platform === "android") {
    const intentUrl =
      `intent://send?phone=${waNumber}${encodedText ? `&text=${encodedText}` : ""}` +
      `#Intent;package=com.whatsapp.w4b;scheme=whatsapp;` +
      `S.browser_fallback_url=${encodeURIComponent("about:blank")};end`;

    let launched = false;
    const onVisibilityChange = () => { if (document.hidden) { launched = true; } };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.location.href = intentUrl;
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!launched) onNotInstalled?.();
    }, 2000);
  } else if (platform === "ios") {
    window.location.href = `whatsapp://send?phone=${waNumber}${encodedText ? `&text=${encodedText}` : ""}`;
  } else {
    window.open(`https://wa.me/${waNumber}${encodedText ? `?text=${encodedText}` : ""}`, "_blank", "noopener,noreferrer");
  }
}

// Build the default pre-filled message from lead name + logged-in agent + org name
function buildWAMessage(leadName) {
  try {
    const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
    const org  = JSON.parse(localStorage.getItem("crm_org")  || "{}");
    const agentName = user.name || "";
    const orgName   = org.name  || "";
    const firstName = (leadName || "").split(" ")[0].trim();
    const greeting  = firstName ? `Hi ${firstName}! 👋` : "Hi! 👋";
    const from = agentName && orgName
      ? ` I'm ${agentName} from ${orgName}.`
      : agentName
        ? ` I'm ${agentName}.`
        : orgName ? ` I'm from ${orgName}.` : "";
    return `${greeting}${from} I'm following up on your property enquiry. Are you still looking? 🏠`;
  } catch {
    return "";
  }
}

// Green "Chat on WhatsApp" button - pre-filled message + editable before send.
// Dropdown is portal-rendered at document.body with position:fixed so it
// always floats above tables regardless of overflow:hidden or z-index stacking.
export function WhatsAppLink({ phone, name, leadId, projectId, onContact }) {
  const [open, setOpen]               = useState(false);
  const [wabNotInstalled, setWabNotInstalled] = useState(false);
  const [msgText, setMsgText]         = useState("");
  const [dropPos, setDropPos]         = useState({ top: 0, left: 0 });
  const [generating, setGenerating]   = useState(false);
  const btnRef  = useRef(null);
  const dropRef = useRef(null);

  const handleAIDraft = async (e) => {
    e.stopPropagation();
    if (!leadId || generating) return;
    setGenerating(true);
    try {
      const url = projectId
        ? `/projects/${projectId}/leads/${leadId}/draft-message`
        : `/leads/${leadId}/draft-message`;
      const { data } = await api.post(url);
      if (data.message) setMsgText(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "AI draft failed");
    } finally {
      setGenerating(false);
    }
  };

  // Build default message and compute dropdown position each time it opens
  const handleToggle = () => {
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) {
        const dropW = 288;
        const estimatedDropH = 260; // message box + 2 buttons + footer ≈ 260px

        // Horizontal: flush right edge if overflows
        const left = rect.left + dropW > window.innerWidth - 8
          ? Math.max(8, rect.right - dropW)
          : rect.left;

        // Vertical: flip ABOVE the button if not enough space below
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const top = spaceBelow < estimatedDropH
          ? Math.max(8, rect.top - estimatedDropH - 4)
          : rect.bottom + 4;

        setDropPos({ top, left, flipped: spaceBelow < estimatedDropH });
      }
      setMsgText(buildWAMessage(name));
    } else {
      setWabNotInstalled(false);
    }
    setOpen((v) => !v);
  };

  // Close on outside click (checks both button and portal dropdown)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on scroll outside the dropdown (scrolling inside the message textarea must not close it)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  if (!phone) return <span className="text-xs text-app-soft">-</span>;

  const waNumber = toWaNumber(phone);

  const handlePersonal = (e) => {
    e.preventDefault();
    setOpen(false);
    onContact?.();
    openWAPersonal(waNumber, msgText);
  };

  const handleBusiness = (e) => {
    e.preventDefault();
    onContact?.();
    openWABusiness(waNumber, msgText, () => setWabNotInstalled(true));
    if (getPlatform() !== "android") setOpen(false);
  };

  const btnCls = "inline-flex items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-500/8 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-500/15 hover:border-green-500/40 transition whitespace-nowrap dark:text-green-400";

  const dropdown = (
    <div
      ref={dropRef}
      style={{
        position: "fixed",
        top: dropPos.top,
        left: dropPos.left,
        width: 288,
        zIndex: 99999,
        background: "var(--app-surface-high)",
        backdropFilter: "blur(24px) saturate(140%)",
        border: "1px solid var(--app-border-strong, var(--app-border))",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.40), 0 2px 8px rgba(0,0,0,0.20)",
        overflow: "hidden",
        maxHeight: "min(340px, 90dvh)",
        overflowY: "auto",
      }}
    >
      {/* Pre-filled message editor */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-app-soft">
            Message - edit before sending
          </p>
          {(leadId) && (
            <button
              type="button"
              onClick={handleAIDraft}
              disabled={generating}
              title="AI draft"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition disabled:opacity-50"
              style={{ background: "rgba(255,107,0,0.10)", color: "var(--app-primary)" }}
            >
              {generating
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Sparkles className="h-3 w-3" />}
              {generating ? "Drafting…" : "AI Draft"}
            </button>
          )}
        </div>
        <textarea
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-2.5 py-2 text-xs resize-none focus:outline-none focus:border-green-400 leading-relaxed"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
          placeholder="Type a message…"
        />
      </div>

      <div className="mx-3 mb-1 border-t" style={{ borderColor: "var(--app-border)" }} />

      {/* WhatsApp Personal */}
      <button type="button" onClick={handlePersonal}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-app hover:bg-green-500/8 transition">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-500/15 flex-shrink-0">
          <MessageCircle className="h-3.5 w-3.5 text-green-600" />
        </span>
        <div className="text-left">
          <p className="font-semibold">Send via WhatsApp</p>
          <p className="text-[10px] text-app-soft">Personal account</p>
        </div>
      </button>

      {/* WhatsApp Business */}
      <button type="button" onClick={handleBusiness}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-app hover:bg-green-500/8 transition">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-600/15 flex-shrink-0">
          <MessageCircle className="h-3.5 w-3.5 text-green-700" />
        </span>
        <div className="text-left">
          <p className="font-semibold">Send via WhatsApp Business</p>
          <p className="text-[10px] text-app-soft">Business account</p>
        </div>
      </button>

      {wabNotInstalled && (
        <>
          <div className="mx-3 my-0.5 border-t" style={{ borderColor: "var(--app-border)" }} />
          <a href="https://play.google.com/store/apps/details?id=com.whatsapp.w4b"
            target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-orange-500/8 transition"
            style={{ color: "var(--app-primary)" }}>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0" style={{ background: "rgba(255,107,0,0.12)" }}>
              <MessageCircle className="h-3.5 w-3.5" style={{ color: "var(--app-primary)" }} />
            </span>
            <div className="text-left">
              <p className="font-semibold">Download WA Business</p>
              <p className="text-[10px] text-app-soft">App not found on device</p>
            </div>
          </a>
        </>
      )}

      <div className="px-3 pb-2.5 pt-1">
        <p className="text-[9px] text-app-soft text-center">
          Message opens in WhatsApp - you send it manually
        </p>
      </div>
    </div>
  );

  return (
    <div className="inline-block">
      <button ref={btnRef} type="button" onClick={handleToggle} className={btnCls}>
        <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
        WhatsApp
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}

// ── AppSelect ─────────────────────────────────────────────────────────────────
// Themed custom dropdown matching the CustomSelect design system.
// options: string[] | { value, label, color? }[]
// If an option with value="" is included it becomes the placeholder row label.
export function AppSelect({
  value, onChange, options = [], disabled, placeholder = "Select…",
  className = "", style, triggerStyle,
  // legacy props accepted but unused — callers can be cleaned up over time
  raw: _raw, triggerClassName: _tc,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({});
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const items = options.map(o =>
    (typeof o === "string" || typeof o === "number")
      ? { value: String(o), label: String(o) }
      : { value: String(o.value ?? ""), label: String(o.label ?? ""), color: o.color }
  );

  // If options include a blank item, use its label as placeholder and exclude from list
  const blankItem = items.find(o => o.value === "");
  const effectivePlaceholder = blankItem?.label || placeholder;
  const listItems = items.filter(o => o.value !== "");

  const selectedItem = listItems.find(o => o.value === String(value ?? ""));
  const isBlank = !value || value === "";

  const calcPos = (r) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dropW = Math.min(Math.max(r.width, 180), vw - 16);
    const estH  = Math.min(260, listItems.length * 36 + 60);
    const openUp = (r.bottom + estH > vh - 8) && (r.top > estH + 8);
    const posV = openUp ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 };
    const posH = r.left + dropW > vw - 8 ? { right: vw - r.right } : { left: r.left };
    return { ...posV, ...posH, width: dropW };
  };

  const openDropdown = () => {
    if (disabled) return;
    if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect()));
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect()));
    };
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropRef.current?.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={className} style={style}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        className="inline-flex items-center justify-between gap-1.5 transition-colors w-full"
        style={{
          padding: "5px 10px",
          borderRadius: 10,
          fontSize: 13,
          border: open ? "1px solid var(--app-primary)" : "1px solid var(--app-border)",
          background: "var(--app-surface-low)",
          color: selectedItem?.color || (selectedItem ? "var(--app-text)" : "var(--app-text-soft)"),
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          opacity: disabled ? 0.6 : 1,
          ...triggerStyle,
        }}
      >
        {selectedItem?.color && (
          <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: selectedItem.color }} />
        )}
        <span className="flex-1 truncate text-left min-w-0">
          {selectedItem ? selectedItem.label : effectivePlaceholder}
        </span>
        <ChevronDown
          className="shrink-0 transition-transform duration-150"
          style={{ width: 13, height: 13, opacity: 0.6, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] overflow-hidden"
          style={{
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
            ...(pos.right  !== undefined ? { right: pos.right  } : { left: pos.left  }),
            minWidth: pos.width,
            maxWidth: pos.width,
            maxHeight: 260,
            overflowY: "auto",
            borderRadius: 12,
            border: "1px solid var(--app-border)",
            background: "var(--app-surface)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Placeholder / all row */}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
            style={{
              background: isBlank ? "rgba(249,115,22,0.10)" : "transparent",
              color: isBlank ? "var(--app-primary)" : "var(--app-text-soft)",
              fontWeight: isBlank ? 600 : 400,
            }}
            onMouseEnter={(e) => { if (!isBlank) e.currentTarget.style.background = "var(--app-surface-low)"; }}
            onMouseLeave={(e) => { if (!isBlank) e.currentTarget.style.background = "transparent"; }}
            onClick={() => { onChange(""); setOpen(false); }}
          >
            <span className="flex-1">{effectivePlaceholder}</span>
            {isBlank && <Check style={{ width: 13, height: 13, color: "var(--app-primary)" }} />}
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--app-border)", margin: "2px 0" }} />

          {listItems.map(item => {
            const isSelected = item.value === String(value ?? "");
            return (
              <button
                key={item.value}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
                style={{
                  background: isSelected ? "rgba(249,115,22,0.10)" : "transparent",
                  color: isSelected ? "var(--app-primary)" : "var(--app-text)",
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--app-surface-low)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                onClick={() => { onChange(item.value); setOpen(false); }}
              >
                {item.color && (
                  <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: item.color }} />
                )}
                <span className="flex-1 truncate" style={item.color ? { color: item.color, fontWeight: isSelected ? 700 : 500 } : {}}>
                  {item.label}
                </span>
                {isSelected && <Check style={{ width: 13, height: 13, color: "var(--app-primary)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── AppDatePicker ─────────────────────────────────────────────────────────────
// Custom themed calendar that replaces native type="date" inputs.
// value: "YYYY-MM-DD" string | ""
// onChange: fn("YYYY-MM-DD" | "")
// min/max: "YYYY-MM-DD" optional constraints
export function AppDatePicker({ value, onChange, placeholder = "Pick date", className = "", style, triggerStyle, min, max }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    if (value) { const d = new Date(value + "T00:00:00"); return { year: d.getFullYear(), month: d.getMonth() }; }
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [pos, setPos] = useState({});
  const triggerRef = useRef(null);
  const calRef     = useRef(null);

  useEffect(() => {
    if (value) { const d = new Date(value + "T00:00:00"); setView({ year: d.getFullYear(), month: d.getMonth() }); }
  }, [value]);

  const calcPos = (r) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const calW = 280, calH = 340;
    const openUp = (r.bottom + calH > vh - 8) && (r.top > calH + 8);
    const posV = openUp ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 };
    const posH = r.left + calW > vw - 8 ? { right: vw - r.right } : { left: r.left };
    return { ...posV, ...posH };
  };

  const toggleOpen = () => {
    if (!open && triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect()));
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const update = () => { if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect())); };
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !calRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fmtDisplay = (v) => {
    if (!v) return null;
    return new Date(v + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const startDow = (new Date(view.year, view.month, 1).getDay() + 6) % 7; // Mon-first

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setView(v => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const nextMonth = () => setView(v => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });

  const selectDay = (d) => {
    const yyyy = view.year, mm = String(view.month + 1).padStart(2, "0"), dd = String(d).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    onChange(dateStr);
    setOpen(false);
  };

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAY_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

  return (
    <div className={className} style={style}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="inline-flex items-center gap-2 transition-colors w-full"
        style={{
          padding: "12px 16px",
          borderRadius: 16,
          fontSize: 14,
          border: open ? "1px solid var(--app-primary)" : "1px solid var(--app-border)",
          background: "var(--app-surface-low)",
          color: value ? "var(--app-text)" : "var(--app-text-soft)",
          outline: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
          ...triggerStyle,
        }}
      >
        <Calendar style={{ width: 13, height: 13, opacity: 0.55, flexShrink: 0 }} />
        <span className="flex-1 truncate text-left">{value ? fmtDisplay(value) : placeholder}</span>
        <ChevronDown
          className="shrink-0 transition-transform duration-150"
          style={{ width: 13, height: 13, opacity: 0.6, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && createPortal(
        <div
          ref={calRef}
          className="fixed z-[9999]"
          style={{
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
            ...(pos.right  !== undefined ? { right: pos.right  } : { left: pos.left  }),
            width: 280,
            borderRadius: 14,
            border: "1px solid var(--app-border)",
            background: "var(--app-surface)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            overflow: "hidden",
          }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--app-border)" }}>
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/8">
              <ChevronLeft style={{ width: 15, height: 15, color: "var(--app-text)" }} />
            </button>
            <span className="text-sm font-bold" style={{ color: "var(--app-text)" }}>
              {MONTHS[view.month]} {view.year}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/8">
              <ChevronRight style={{ width: 15, height: 15, color: "var(--app-text)" }} />
            </button>
          </div>

          {/* Grid */}
          <div className="p-3">
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold py-1" style={{ color: "var(--app-text-soft)" }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const yyyy = view.year, mm = String(view.month + 1).padStart(2, "0"), dd = String(day).padStart(2, "0");
                const dateStr = `${yyyy}-${mm}-${dd}`;
                const isSel  = dateStr === value;
                const isToday = dateStr === todayStr;
                const isDisabled = (min && dateStr < min) || (max && dateStr > max);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDay(day)}
                    className="flex items-center justify-center rounded-lg text-[12px] font-medium transition-colors"
                    style={{
                      height: 30,
                      background: isSel ? "var(--app-primary)" : "transparent",
                      color: isSel ? "#fff" : isToday ? "var(--app-primary)" : isDisabled ? "var(--app-text-soft)" : "var(--app-text)",
                      fontWeight: isSel || isToday ? 700 : 400,
                      border: isToday && !isSel ? "1.5px solid var(--app-primary)" : "1px solid transparent",
                      opacity: isDisabled ? 0.38 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e) => { if (!isSel && !isDisabled) e.currentTarget.style.background = "rgba(249,115,22,0.10)"; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-3 pb-3">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="flex-1 text-[12px] font-semibold rounded-lg py-1.5 transition"
              style={{ color: "var(--app-text-soft)", border: "1px solid var(--app-border)", background: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--app-surface-low)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => { onChange(todayStr); setOpen(false); }}
              className="flex-1 text-[12px] font-semibold rounded-lg py-1.5 transition"
              style={{ color: "var(--app-primary)", border: "1px solid rgba(249,115,22,0.25)", background: "rgba(249,115,22,0.08)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(249,115,22,0.08)"; }}
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
