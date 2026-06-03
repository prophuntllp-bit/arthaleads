import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/**
 * CustomSelect — fully-styled dropdown that matches the app design system.
 * Props:
 *   value        string  — current selected value
 *   onChange     fn(v)   — called with the new value string
 *   options      Array<{value: string, label: string} | string>
 *   placeholder  string  — label shown when value is ""
 *   style        object  — extra styles for the trigger button
 */
export default function CustomSelect({ value, onChange, options, placeholder = "Select…", style = {} }) {
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 });
  const triggerRef        = useRef(null);
  const dropdownRef       = useRef(null);

  // Normalise options to { value, label, color? }
  const items = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  const selectedItem  = items.find((o) => o.value === value);
  const selectedLabel = selectedItem?.label || placeholder;
  const selectedColor = selectedItem?.color || null;

  const calcPos = (r) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dropW = Math.min(Math.max(r.width, 200), vw - 16);
    // Estimate dropdown height to decide open direction
    const estH  = Math.min(260, items.length * 38 + 60);
    const openUp = (r.bottom + estH > vh - 8) && (r.top > estH + 8);

    const posV = openUp ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 };
    // Flip to right-align when left-align would overflow the viewport
    const posH = r.left + dropW > vw - 8
      ? { right: vw - r.right }
      : { left: r.left };

    return { ...posV, ...posH, width: dropW };
  };

  const openDropdown = () => {
    if (triggerRef.current) {
      setPos(calcPos(triggerRef.current.getBoundingClientRect()));
    }
    setOpen((o) => !o);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) {
        setPos(calcPos(triggerRef.current.getBoundingClientRect()));
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className="inline-flex items-center justify-between gap-1.5 transition-colors"
        style={{
          padding: "5px 10px",
          borderRadius: 10,
          fontSize: 13,
          border: open ? "1px solid var(--app-primary)" : "1px solid var(--app-border)",
          background: "var(--app-surface-low)",
          color: (value && selectedColor) ? selectedColor : (value ? "var(--app-text)" : "var(--app-text-soft)"),
          outline: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
          minWidth: 0,
          ...style,
        }}
      >
        {selectedColor && value && (
          <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: selectedColor }} />
        )}
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className="shrink-0 transition-transform duration-150"
          style={{ width: 13, height: 13, opacity: 0.6, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
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
          {/* Placeholder / all option */}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
            style={{
              background: value === "" ? "rgba(249,115,22,0.10)" : "transparent",
              color: value === "" ? "var(--app-primary)" : "var(--app-text-soft)",
              fontWeight: value === "" ? 600 : 400,
            }}
            onMouseEnter={(e) => { if (value !== "") e.currentTarget.style.background = "var(--app-surface-low)"; }}
            onMouseLeave={(e) => { if (value !== "") e.currentTarget.style.background = "transparent"; }}
            onClick={() => { onChange(""); setOpen(false); }}
          >
            <span className="flex-1">{placeholder}</span>
            {value === "" && <Check style={{ width: 13, height: 13, color: "var(--app-primary)" }} />}
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--app-border)", margin: "2px 0" }} />

          {items.map((item) => {
            const selected = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
                style={{
                  background: selected ? "rgba(249,115,22,0.10)" : "transparent",
                  color: selected ? "var(--app-primary)" : "var(--app-text)",
                  fontWeight: selected ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--app-surface-low)"; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                onClick={() => { onChange(item.value); setOpen(false); }}
              >
                {item.color && (
                  <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: item.color }} />
                )}
                <span className="flex-1 truncate" style={item.color ? { color: item.color, fontWeight: selected ? 700 : 500 } : {}}>{item.label}</span>
                {selected && <Check style={{ width: 13, height: 13, color: "var(--app-primary)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
