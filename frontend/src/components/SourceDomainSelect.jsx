import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, FileText, Globe } from "lucide-react";

/**
 * SourceDomainSelect — like CustomSelect, but the "Website" row expands into
 * an inline sub-list of the actual domains leads have come in from, and each
 * domain expands again into the pages on it. One domain often hosts several
 * projects' landing pages, each with its own ad campaign, so the domain alone
 * cannot separate them.
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

  const selectedLabel = value === "Website" && selectedPage
    ? pageLabel(selectedPage)
    : value === "Website" && domain
      ? domain
      : (items.find((o) => o.value === value)?.label || placeholder);

  const calcPos = (r) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dropW = Math.min(Math.max(r.width, 260), vw - 16);
    const estH  = Math.min(360, items.length * 38 + domains.length * 32 + 60);
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
    if (!open) return;
    const handler = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => { if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect())); };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, websiteOpen, openDomain]);

  // Reopening starts collapsed — except down to whatever is selected, so the
  // current choice is visible instead of hidden two levels deep.
  useEffect(() => {
    if (open) {
      setWebsiteOpen(value === "Website" && !!domain);
      setOpenDomain(selectedPage ? selectedPage.domain : "");
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
            maxHeight: 360,
            overflowY: "auto",
            borderRadius: 12,
            border: "1px solid var(--app-border)",
            background: "var(--app-surface)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* All Sources */}
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
            onClick={() => pick("")}
          >
            <span className="flex-1">{placeholder}</span>
            {value === "" && <Check style={{ width: 13, height: 13, color: "var(--app-primary)" }} />}
          </button>

          <div style={{ height: 1, background: "var(--app-border)", margin: "2px 0" }} />

          {items.map((item) => {
            if (item.value === "Website") {
              const selected = value === "Website";
              return (
                <div key="Website">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
                    style={{
                      background: (selected && !domain) ? "rgba(249,115,22,0.10)" : "transparent",
                      color: selected ? "var(--app-primary)" : "var(--app-text)",
                      fontWeight: selected ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--app-surface-low)"; }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                    onClick={() => {
                      if (domains.length === 0) { pick("Website"); return; }
                      setWebsiteOpen((w) => !w);
                    }}
                  >
                    <span className="flex-1 truncate">Website</span>
                    {domains.length > 0 && (
                      <ChevronRight
                        className="shrink-0 transition-transform duration-150"
                        style={{ width: 13, height: 13, opacity: 0.6, transform: websiteOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                      />
                    )}
                    {selected && !domain && <Check style={{ width: 13, height: 13, color: "var(--app-primary)", flexShrink: 0 }} />}
                  </button>

                  {domains.length > 0 && websiteOpen && (
                    <div style={{ borderTop: "1px solid var(--app-border)", borderBottom: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
                      {/* Bare "Website" — every website lead, regardless of domain */}
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 py-1.5 text-left text-[12.5px] transition-colors"
                        style={{
                          paddingLeft: 30, paddingRight: 12,
                          background: (selected && !domain) ? "rgba(249,115,22,0.10)" : "transparent",
                          color: (selected && !domain) ? "var(--app-primary)" : "var(--app-text-soft)",
                          fontStyle: "italic",
                        }}
                        onClick={() => pick("Website")}
                      >
                        <span className="flex-1">All Website domains</span>
                        {selected && !domain && <Check style={{ width: 12, height: 12, color: "var(--app-primary)", flexShrink: 0 }} />}
                      </button>
                      {domains.map((d) => {
                        const domSelected = selected && domain === d && !page;
                        const dPages = pagesOf(d);
                        // Only worth a second level when there is more than one page to tell apart.
                        const expandable = dPages.length > 1;
                        const expanded = openDomain === d.toLowerCase();
                        const total = domainCount(d);
                        return (
                          <div key={d}>
                            <div className="flex w-full items-center" style={{ background: domSelected ? "rgba(249,115,22,0.10)" : "transparent" }}>
                              <button
                                type="button"
                                className="flex flex-1 min-w-0 items-center gap-2 py-1.5 text-left text-[12.5px] transition-colors"
                                style={{
                                  paddingLeft: 30, paddingRight: 6,
                                  color: domSelected ? "var(--app-primary)" : "var(--app-text)",
                                  fontWeight: domSelected ? 600 : 400,
                                }}
                                onClick={() => pick("Website", d)}
                              >
                                <Globe style={{ width: 12, height: 12, flexShrink: 0, opacity: 0.6 }} />
                                <span className="flex-1 truncate">{d}</span>
                                {total > 0 && <span className="text-[11px] tabular-nums" style={{ color: "var(--app-text-soft)" }}>{total}</span>}
                                {domSelected && <Check style={{ width: 12, height: 12, color: "var(--app-primary)", flexShrink: 0 }} />}
                              </button>
                              {expandable && (
                                <button
                                  type="button"
                                  title={expanded ? "Hide pages" : `Show ${dPages.length} pages`}
                                  className="shrink-0 flex items-center justify-center rounded-md transition-colors"
                                  style={{ width: 26, height: 26, marginRight: 6 }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--app-border)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                  onClick={() => setOpenDomain(expanded ? "" : d.toLowerCase())}
                                >
                                  <ChevronRight
                                    className="transition-transform duration-150"
                                    style={{ width: 13, height: 13, opacity: 0.6, transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
                                  />
                                </button>
                              )}
                            </div>

                            {expandable && expanded && dPages.map((p) => {
                              const pgSelected = selected && page === p.key;
                              return (
                                <button
                                  key={p.key}
                                  type="button"
                                  title={`${p.domain}${p.path === "/" ? "" : p.path}`}
                                  className="flex w-full items-center gap-2 py-1.5 text-left text-[12px] transition-colors"
                                  style={{
                                    paddingLeft: 50, paddingRight: 12,
                                    background: pgSelected ? "rgba(249,115,22,0.10)" : "transparent",
                                    color: pgSelected ? "var(--app-primary)" : "var(--app-text)",
                                    fontWeight: pgSelected ? 600 : 400,
                                  }}
                                  onMouseEnter={(e) => { if (!pgSelected) e.currentTarget.style.background = "var(--app-border)"; }}
                                  onMouseLeave={(e) => { if (!pgSelected) e.currentTarget.style.background = "transparent"; }}
                                  onClick={() => pick("Website", d, p.key)}
                                >
                                  <FileText style={{ width: 11, height: 11, flexShrink: 0, opacity: 0.55 }} />
                                  <span className="flex-1 truncate">{pageLabel(p)}</span>
                                  <span className="text-[11px] tabular-nums" style={{ color: "var(--app-text-soft)" }}>{p.count}</span>
                                  {pgSelected && <Check style={{ width: 12, height: 12, color: "var(--app-primary)", flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

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
                onClick={() => pick(item.value)}
              >
                <span className="flex-1 truncate">{item.label}</span>
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
