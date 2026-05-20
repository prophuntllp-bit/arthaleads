// components/UI.jsx - Shared reusable components
import { STATUS_COLORS, PRIORITY_COLORS, SOURCE_COLORS } from "../utils/constants";
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Phone, MessageCircle, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

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
  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative rounded-[1.75rem] w-full ${widths[size]} max-h-[90vh] overflow-y-auto modal-glass`}>
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 rounded-t-[1.75rem]"
          style={{
            borderBottom: "1px solid var(--app-border)",
            background: "var(--app-surface)",
            backdropFilter: "var(--glass-blur-heavy)",
            WebkitBackdropFilter: "var(--glass-blur-heavy)",
          }}
        >
          <h2 className="text-lg font-semibold text-app">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5">
            <X className="w-5 h-5 text-app-soft" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
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

export function StatCard({ label, value, sub, color = "text-brand-600", icon: Icon, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={`card p-6 text-left w-full ${onClick ? "hover:-translate-y-1 hover:border-orange-500/30 transition-all cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="stitch-kicker mb-2">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-app-soft mt-2">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--app-primary) 10%, transparent)" }}>
            <Icon className="w-5 h-5 text-orange-500" />
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
function openWAPersonal(waNumber) {
  const platform = getPlatform();
  if (platform === "android") {
    // Android intent URL - targets com.whatsapp package only (personal WA)
    // fallback_url is wa.me so if only WA Business is installed it still works via browser
    const fallback = encodeURIComponent(`https://wa.me/${waNumber}`);
    window.location.href =
      `intent://send?phone=${waNumber}` +
      `#Intent;package=com.whatsapp;scheme=whatsapp;` +
      `S.browser_fallback_url=${fallback};end`;
  } else if (platform === "ios") {
    // iOS - both WA and WA Business share the whatsapp:// scheme
    window.location.href = `whatsapp://send?phone=${waNumber}`;
  } else {
    // Desktop - open WhatsApp Web
    window.open(`https://wa.me/${waNumber}`, "_blank", "noopener,noreferrer");
  }
}

// Open WhatsApp Business specifically (package=com.whatsapp.w4b on Android)
// Returns true if app launch was attempted (false = not on Android)
function openWABusiness(waNumber, onNotInstalled) {
  const platform = getPlatform();
  if (platform === "android") {
    // Use about:blank as fallback so Play Store never opens.
    // We detect "not installed" by watching if the page regains focus.
    const intentUrl =
      `intent://send?phone=${waNumber}` +
      `#Intent;package=com.whatsapp.w4b;scheme=whatsapp;` +
      `S.browser_fallback_url=${encodeURIComponent("about:blank")};end`;

    let launched = false;
    const onVisibilityChange = () => {
      // If the document becomes hidden, the app opened successfully
      if (document.hidden) { launched = true; }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    window.location.href = intentUrl;

    // After 2 s - if we never went hidden, the app is not installed
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!launched) onNotInstalled?.();
    }, 2000);
  } else if (platform === "ios") {
    // iOS has no separate WA Business deep-link scheme - try wa.me with a note
    window.location.href = `whatsapp://send?phone=${waNumber}`;
  } else {
    // Desktop - open WhatsApp Web (no Business-specific web client)
    window.open(`https://wa.me/${waNumber}`, "_blank", "noopener,noreferrer");
  }
}

// Green "Chat on WhatsApp" button - shows a dropdown to choose WhatsApp or WhatsApp Business
export function WhatsAppLink({ phone, onContact }) {
  const [open, setOpen] = useState(false);
  const [wabNotInstalled, setWabNotInstalled] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset "not installed" hint whenever dropdown closes
  useEffect(() => { if (!open) setWabNotInstalled(false); }, [open]);

  if (!phone) return <span className="text-xs text-app-soft">-</span>;

  const waNumber = toWaNumber(phone);

  const handlePersonal = (e) => {
    e.preventDefault();
    setOpen(false);
    onContact?.();
    openWAPersonal(waNumber);
  };

  const handleBusiness = (e) => {
    e.preventDefault();
    onContact?.();
    openWABusiness(waNumber, () => setWabNotInstalled(true));
    // Keep dropdown open on Android so the "Download" hint can appear
    if (getPlatform() !== "android") setOpen(false);
  };

  const btnCls = "inline-flex items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-500/8 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-500/15 hover:border-green-500/40 transition whitespace-nowrap dark:text-green-400";

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={btnCls}
      >
        <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
        WhatsApp
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border py-1 shadow-2xl"
          style={{
            background: "var(--wa-dropdown-bg, #ffffff)",
            borderColor: "var(--app-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          {/* WhatsApp Personal - targets com.whatsapp only */}
          <button
            type="button"
            onClick={handlePersonal}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-app hover:bg-orange-500/8 transition"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-500/15 flex-shrink-0">
              <MessageCircle className="h-3.5 w-3.5 text-green-600" />
            </span>
            <div className="text-left">
              <p className="font-semibold">WhatsApp</p>
              <p className="text-[10px] text-app-soft">Personal account</p>
            </div>
          </button>

          <div className="mx-3 my-0.5 border-t" style={{ borderColor: "var(--app-border)" }} />

          {/* WhatsApp Business - targets com.whatsapp.w4b only */}
          <button
            type="button"
            onClick={handleBusiness}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-app hover:bg-orange-500/8 transition"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-600/15 flex-shrink-0">
              <MessageCircle className="h-3.5 w-3.5 text-green-700" />
            </span>
            <div className="text-left">
              <p className="font-semibold">WhatsApp Business</p>
              <p className="text-[10px] text-app-soft">Business account</p>
            </div>
          </button>

          {/* Show download link if WA Business wasn't detected on Android */}
          {wabNotInstalled && (
            <>
              <div className="mx-3 my-0.5 border-t" style={{ borderColor: "var(--app-border)" }} />
              <a
                href="https://play.google.com/store/apps/details?id=com.whatsapp.w4b"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-orange-500/8 transition"
                style={{ color: "var(--app-primary)" }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: "rgba(255,107,0,0.12)" }}>
                  <MessageCircle className="h-3.5 w-3.5" style={{ color: "var(--app-primary)" }} />
                </span>
                <div className="text-left">
                  <p className="font-semibold">Download WA Business</p>
                  <p className="text-[10px] text-app-soft">App not found on device</p>
                </div>
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
