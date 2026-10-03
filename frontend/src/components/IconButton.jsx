import Tooltip from "./Tooltip";

// Small square icon button with a border and a tooltip naming what it does,
// for row actions in tables (edit, move, delete). `tone="danger"` turns red on
// hover so a destructive action never looks like the others.
export default function IconButton({ icon: Icon, label, onClick, tone = "default", disabled = false, size = "sm" }) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const hover = tone === "danger"
    ? "hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
    : "hover:bg-black/5 hover:text-app dark:hover:bg-white/5";
  return (
    <Tooltip content={label} delay={200}>
      <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
        className={`flex ${box} items-center justify-center rounded-lg text-app-soft shadow-sm transition disabled:pointer-events-none disabled:opacity-40 ${hover}`}
        style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-solid)" }}>
        <Icon className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}
