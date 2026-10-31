import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, FileText, Globe } from "lucide-react";

/**
 * SourceDomainSelect — like CustomSelect, but laid out as a tree: "Website"
 * opens into the domains leads came from, and each domain into the pages on
 * it. One domain often hosts several projects' landing pages, each with its
 * own ad campaign, so the domain alone cannot separate them.
 *
 * The chevron on the left of a row opens it; clicking the row itself picks it.
 * Guide lines show what belongs to what.
 *
 * Props:
 *   value    string          — current `source` filter value
 *   domain   string          — current `siteFilter` (domain) value
 *   page     string          — current `sitePage` key ("host/path"), "" for none
 *   domains  string[]        — distinct domains available to pick from
 *   pages    {domain,key,path,count}[] — pages per domain, from /leads/domains
 *   options  string[]        — source options (same shape as CustomSelect)
 *   onChange fn(source, domain, page) — called with the new selection
 */

function Count({ n, on }) {
  if (!n) return null;
  return (
    <span className="shrink-0 rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums"
      style={on
        ? { border: "1px solid rgba(var(--app-primary-rgb),0.4)", color: "var(--app-primary)" }
        : { border: "1px solid var(--app-border-strong)", color: "var(--app-text-soft)", background: "var(--app-surface-solid)" }}>
      {n}
    </span>
  );
}

// One row of the tree. `toggle` (if given) draws the chevron that opens the
// row; the rest of the row picks it.
function Row({ label, title, icon: Icon, count, selected, expandable, expanded, onToggle, onPick, muted }) {
  return (
    <div className="group flex items-center gap-1 rounded-lg pr-2 transition-colors"
      style={{ background: selected ? "rgba(var(--app-primary-rgb),0.10)" : undefined }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--app-surface-low)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = ""; }}>
      {expandable ? (
        <button type="button" aria-label={expanded ? `Hide ${label}` : `Show ${label}`} aria-expanded={expanded} onClick={onToggle}
          className="flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-app-soft hover:text-app">
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150" style={{ transform: expanded ? "rotate(90deg)" : "none" }} />
        </button>
      ) : (
        <span className="w-6 shrink-0" />
      )}
      <button type="button" onClick={onPick} title={title}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px]"
        style={{ color: selected ? "var(--app-primary)" : muted ? "var(--app-text-soft)" : "var(--app-text)", fontWeight: selected ? 600 : 500, fontStyle: muted ? "italic" : undefined }}>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ opacity: selected ? 1 : 0.55 }} />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Count n={count} on={selected} />
        {selected && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--app-primary)" }} />}
      </button>
    </div>
  );
}

// Children of a row, indented under its chevron with a guide line.
function Branch({ children }) {
  return (
    <div className="ml-3 border-l pl-2" style={{ borderColor: "var(--app-border-strong)" }}>
      {children}
    </div>
  );
}

export default function SourceDomainSelect({ value, domain, page = "", domains = [], pages = [], options, onChange, placeholder = "Select…", style = {} }) {
  const [open, setOpen]         = useState(false);
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [openDomain, setOpenDomain]   = useState("");
  const [pos, setPos]           = useState({ top: 0, left: 0, width: 0 });
  const triggerRef              = useRef(null);
  const dropdownRef             = useRef(null);

  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  const pagesOf = (d) => pages.filter((p) => p.domain === String(d).toLowerCase());
  const domainCount = (d) => pagesOf(d).reduce((n, p) => n + p.count, 0);
  const pageLabel = (p) => (p.path === "/" ? "Home page" : p.path);
  const selectedPage = page ? pages.find((p) => p.key === page) : null;
  const websiteTotal = domains.reduce((n, d) => n + domainCount(d), 0);

  const selectedLabel = value === "Website" && selectedPage
    ? pageLabel(selectedPage)
    : value === "Website" && domain
      ? domain
      : (items.find((o) => o.value === value)?.label || placeholder);

  const calcPos = (r) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dropW = Math.min(Math.max(r.width, 300), vw - 16);
    const estH  = Math.min(400, items.length * 36 + domains.length * 34 + 60);
    const openUp = (r.bottom + estH > vh - 8) && (r.top > estH + 8);
    const posV = openUp ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 };
    const posH = r.left + dropW > vw - 8 ? { right: vw - r.right } : { left: r.left };
    return { ...posV, ...posH, width: dropW };
  };

  const openDropdown = () => {
    if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect()));
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const update = () => { if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect())); };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open, websiteOpen, openDomain]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reopening starts collapsed — except down to whatever is selected, so the
  // current choice is visible instead of hidden two levels deep.
  useEffect(() => {
    if (open) {
      setWebsiteOpen(value === "Website" && !!domain);
      setOpenDomain(selectedPage ? selectedPage.domain : (value === "Website" && domain ? String(domain).toLowerCase() : ""));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (source, dom = "", pg = "") => { setOpen(false); onChange?.(source, dom, pg); };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        title={selectedPage ? `${selectedPage.domain}${selectedPage.path === "/" ? "" : selectedPage.path}` : undefined}
        className="inline-flex items-center justify-between gap-1.5 transition-colors"
        style={{
          padding: "5px 10px",
          borderRadius: 10,
          fontSize: 13,
          border: open ? "1px solid var(--app-primary)" : "1px solid var(--app-border)",
          background: "var(--app-surface-low)",
          color: value ? "var(--app-text)" : "var(--app-text-soft)",
          outline: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
          minWidth: 0,
          ...style,
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="shrink-0 transition-transform duration-150"
          style={{ width: 13, height: 13, opacity: 0.6, transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          role="tree"
          aria-label="Source"
          className="fixed z-[9999] p-1.5"
          style={{
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
            ...(pos.right  !== undefined ? { right: pos.right  } : { left: pos.left  }),
            minWidth: pos.width,
            maxWidth: pos.width,
            maxHeight: 400,
            overflowY: "auto",
            borderRadius: 14,
            border: "1px solid var(--app-border-strong)",
            background: "var(--app-surface-solid)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Row label={placeholder} selected={value === ""} onPick={() => pick("")} muted={value !== ""} />
          <div className="mx-2 my-1 h-px" style={{ background: "var(--app-border)" }} />

          {items.map((item) => {
            if (item.value === "Website" && domains.length > 0) {
              const selected = value === "Website";
              return (
                <div key="Website">
                  <Row label="Website" icon={Globe} count={websiteTotal} selected={selected && !domain}
                    expandable expanded={websiteOpen} onToggle={() => setWebsiteOpen((w) => !w)}
                    onPick={() => pick("Website")} />
                  {websiteOpen && (
                    <Branch>
                      {domains.map((d) => {
                        const dPages = pagesOf(d);
                        // A second level only when there is more than one page to tell apart.
                        const expandable = dPages.length > 1;
                        const expanded = openDomain === d.toLowerCase();
                        return (
                          <div key={d}>
                            <Row label={d} icon={Globe} count={domainCount(d)} selected={selected && domain === d && !page}
                              expandable={expandable} expanded={expanded}
                              onToggle={() => setOpenDomain(expanded ? "" : d.toLowerCase())}
                              onPick={() => pick("Website", d)} />
                            {expandable && expanded && (
                              <Branch>
                                {dPages.map((p) => (
                                  <Row key={p.key} label={pageLabel(p)} icon={FileText} count={p.count}
                                    title={`${p.domain}${p.path === "/" ? "" : p.path}`}
                                    selected={selected && page === p.key}
                                    onPick={() => pick("Website", d, p.key)} />
                                ))}
                              </Branch>
                            )}
                          </div>
                        );
                      })}
                    </Branch>
                  )}
                </div>
              );
            }
            return (
              <Row key={item.value} label={item.label} selected={item.value === value} onPick={() => pick(item.value)} />
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
