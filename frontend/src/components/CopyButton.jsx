import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, Copy } from "lucide-react";
import Tooltip from "./Tooltip";

// Small icon button that copies `value` to the clipboard, ticks for a moment,
// and says what was copied. Falls back to a hidden textarea where the
// clipboard API is blocked (plain http, some embedded browsers).
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}

export default function CopyButton({ value, label = "Copy", done = "Copied", className = "" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  if (!value) return null;

  const onClick = async (e) => {
    e.stopPropagation();
    if (await copyText(String(value))) {
      toast.success(done);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Could not copy. Select it and press Ctrl+C.");
    }
  };

  return (
    <Tooltip content={copied ? "Copied" : label} delay={200}>
      <button type="button" aria-label={label} onClick={onClick}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-app-soft transition hover:text-app ${className}`}
        style={{ borderColor: "var(--app-border-strong)", background: "var(--app-surface-solid)" }}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </Tooltip>
  );
}
