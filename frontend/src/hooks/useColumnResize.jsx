import { useState } from "react";

/**
 * Universal column-resize hook with localStorage persistence.
 * storageKey: unique string per table (e.g. "leads", "followups", "projects")
 * defaults:   { colName: defaultWidthPx, ... }
 */
export function useColumnResize(storageKey, defaults) {
  const [widths, setWidths] = useState(() => {
    try {
      const saved = localStorage.getItem("col_widths_" + storageKey);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return { ...defaults };
  });

  const startResize = (col, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widths[col] ?? defaults[col] ?? 100;
    const onMove = (mv) => {
      const nw = Math.max(48, startW + mv.clientX - startX);
      setWidths((prev) => {
        const next = { ...prev, [col]: nw };
        try { localStorage.setItem("col_widths_" + storageKey, JSON.stringify(next)); } catch {}
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return [widths, startResize];
}

/** Resizable <th> — drop-in for any table header cell. */
export function RTh({ k, colW, startResize, children, className = "", style = {} }) {
  return (
    <th
      className={className}
      style={{ width: colW[k], minWidth: 60, position: "relative", overflow: "hidden", ...style }}
    >
      <span className="truncate block pr-3">{children}</span>
      <div
        onMouseDown={(e) => startResize(k, e)}
        title="Drag to resize"
        style={{
          position: "absolute", right: 0, top: "20%", bottom: "20%",
          width: 3, cursor: "col-resize", zIndex: 2, borderRadius: 2,
          background: "var(--app-border)", transition: "background 150ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--app-primary)";
          e.currentTarget.style.top = "0%";
          e.currentTarget.style.bottom = "0%";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--app-border)";
          e.currentTarget.style.top = "20%";
          e.currentTarget.style.bottom = "20%";
        }}
      />
    </th>
  );
}
