// components/UI.jsx — Shared reusable components
import { STATUS_COLORS, PRIORITY_COLORS, SOURCE_COLORS } from "../utils/constants";
import { X, Loader2, Phone, MessageCircle } from "lucide-react";

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
        <div className="flex items-center justify-between p-6" style={{ borderBottom: "1px solid var(--app-border)" }}>
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

// ── Phone + WhatsApp action pair ──────────────────────────────────────────────
// Normalises phone → international format for wa.me (defaults to +91 India)
function toWaNumber(phone = "") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;           // bare 10-digit IN
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`; // 0XXXXXXXXXX
  return digits;                                             // already has country code
}

export function PhoneActions({ phone, showNumber = true }) {
  if (!phone) return <span className="text-xs text-app-soft">—</span>;
  const waNumber = toWaNumber(phone);
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <a
        href={`tel:${phone}`}
        className="flex items-center gap-1.5 text-xs text-app-soft hover:text-orange-500 transition"
        title={`Call ${phone}`}
      >
        <Phone className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
        {showNumber && phone}
      </a>
      <a
        href={`https://wa.me/${waNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 hover:bg-green-500/20 transition"
        title={`WhatsApp ${phone}`}
      >
        <MessageCircle className="h-3.5 w-3.5 text-green-500" />
      </a>
    </div>
  );
}
