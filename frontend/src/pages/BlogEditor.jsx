import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  ArrowLeft, Save, Globe, FileText, Image as ImageIcon, Quote, List, ListOrdered,
  Minus, ChevronDown, Plus, Trash2, Code, Heading2, Heading3,
  Heading4, AlignLeft, X, Tag, Search, Check, ExternalLink, Upload, RefreshCw,
  ClipboardPaste,
} from "lucide-react";

// ── Markdown → Blocks parser ───────────────────────────────────────────────────
function parseMarkdown(text) {
  const lines   = text.split("\n");
  const blocks  = [];
  let   title   = "";
  let   i       = 0;

  // Inline markdown → HTML (bold, italic, inline code, links)
  const inlineHtml = (s) =>
    s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
     .replace(/\*(.+?)\*/g,     "<em>$1</em>")
     .replace(/`(.+?)`/g,       "<code>$1</code>")
     .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  while (i < lines.length) {
    const raw  = lines[i];
    const line = raw.trim();

    // Skip empty
    if (!line) { i++; continue; }

    // H1 → post title (only first one)
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      if (!title) title = line.slice(2).trim();
      else blocks.push({ id: genId(), type: "h2", content: line.slice(2).trim() });
      i++; continue;
    }
    // H2
    if (line.startsWith("## ")) {
      blocks.push({ id: genId(), type: "h2", content: inlineHtml(line.slice(3).trim()), items: [""] });
      i++; continue;
    }
    // H3
    if (line.startsWith("### ")) {
      blocks.push({ id: genId(), type: "h3", content: inlineHtml(line.slice(4).trim()), items: [""] });
      i++; continue;
    }
    // H4
    if (line.startsWith("#### ")) {
      blocks.push({ id: genId(), type: "h4", content: inlineHtml(line.slice(5).trim()), items: [""] });
      i++; continue;
    }
    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ id: genId(), type: "divider", content: "", items: [""] });
      i++; continue;
    }
    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ id: genId(), type: "quote", content: inlineHtml(quoteLines.join(" ")), items: [""] });
      continue;
    }
    // Bullet list
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ id: genId(), type: "bulletList", content: "", items });
      continue;
    }
    // Numbered list
    if (/^\d+[.)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s/, ""));
        i++;
      }
      blocks.push({ id: genId(), type: "numberedList", content: "", items });
      continue;
    }
    // Paragraph - collect until blank line or next special line
    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l) { i++; break; }
      if (/^#{1,4} |^[-*] |^\d+[.)]\s|^> |^(-{3,}|\*{3,}|_{3,})$/.test(l)) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length) {
      blocks.push({ id: genId(), type: "paragraph", content: inlineHtml(paraLines.join(" ")), items: [""] });
    }
  }

  return { title, blocks: blocks.length ? blocks : [newBlock()] };
}

// ── Block type definitions ─────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: "paragraph",    label: "Paragraph",     icon: AlignLeft,   desc: "Plain text paragraph" },
  { type: "h2",           label: "Heading 2",      icon: Heading2,    desc: "Large section heading" },
  { type: "h3",           label: "Heading 3",      icon: Heading3,    desc: "Medium section heading" },
  { type: "h4",           label: "Heading 4",      icon: Heading4,    desc: "Small section heading" },
  { type: "image",        label: "Image",          icon: ImageIcon,   desc: "Image with caption" },
  { type: "quote",        label: "Quote",          icon: Quote,       desc: "Blockquote" },
  { type: "bulletList",   label: "Bullet List",    icon: List,        desc: "Unordered list" },
  { type: "numberedList", label: "Numbered List",  icon: ListOrdered, desc: "Ordered list" },
  { type: "code",         label: "Code Block",     icon: Code,        desc: "Code snippet" },
  { type: "divider",      label: "Divider",        icon: Minus,       desc: "Horizontal separator" },
];

function genId() { return Math.random().toString(36).slice(2, 10); }
function newBlock(type = "paragraph") {
  return { id: genId(), type, content: "", alt: "", caption: "", items: [""], language: "" };
}

// ── File → base64 helper ───────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Floating format toolbar ────────────────────────────────────────────────────
function FormatBar({ targetRef }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function onSelect() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !targetRef.current?.contains(sel.anchorNode)) {
        setVisible(false); return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setPos({ top: rect.top + window.scrollY - 48, left: Math.max(8, rect.left + window.scrollX + rect.width / 2 - 120) });
      setVisible(true);
    }
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [targetRef]);

  if (!visible) return null;
  const cmd = (c, v) => { document.execCommand(c, false, v || null); targetRef.current?.dispatchEvent(new Event("input", { bubbles: true })); };

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-xl shadow-2xl px-2 py-1.5"
      style={{ top: pos.top, left: pos.left, background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {[{ l: "B", c: "bold", s: "font-bold" }, { l: "I", c: "italic", s: "italic" }, { l: "U", c: "underline", s: "underline" }, { l: "S", c: "strikeThrough", s: "line-through" }].map(({ l, c, s }) => (
        <button key={c} onClick={() => cmd(c)} className={`w-7 h-7 rounded-lg text-sm hover:bg-orange-500/10 hover:text-orange-500 text-app transition ${s}`}>{l}</button>
      ))}
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />
      <button onClick={() => { const url = prompt("URL:", "https://"); if (url) cmd("createLink", url); }}
        className="px-2 h-7 rounded-lg text-xs hover:bg-orange-500/10 hover:text-orange-500 text-app transition">Link</button>
      <button onClick={() => cmd("removeFormat")}
        className="px-2 h-7 rounded-lg text-xs hover:bg-red-500/10 hover:text-red-500 text-app-soft transition">Clear</button>
    </div>
  );
}

// ── Block type picker popup ────────────────────────────────────────────────────
function BlockPicker({ onSelect, onClose }) {
  const [q, setQ] = useState("");
  const filtered = BLOCK_TYPES.filter(b => b.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="rounded-2xl shadow-2xl overflow-hidden w-64"
      style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
      <div className="p-2 border-b" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--app-surface-low)" }}>
          <Search className="w-3.5 h-3.5 text-app-soft" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            className="flex-1 bg-transparent text-xs text-app outline-none placeholder:text-app-soft"
            placeholder="Search blocks…" />
        </div>
      </div>
      <div className="py-1.5 max-h-64 overflow-y-auto">
        {filtered.map(b => {
          const Icon = b.icon;
          return (
            <button key={b.type} onClick={() => { onSelect(b.type); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-orange-500/5 transition text-left">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--app-surface-low)" }}>
                <Icon className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-app">{b.label}</p>
                <p className="text-[10px] text-app-soft">{b.desc}</p>
              </div>
            </button>
          );
        })}
        {!filtered.length && <p className="text-xs text-app-soft text-center py-4">No blocks found</p>}
      </div>
    </div>
  );
}

// ── Image upload button (shared - used in Block + Featured Image) ─────────────
function ImageUploadArea({ value, onChange, placeholder = "Upload image or paste URL" }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large - max 5 MB"); return; }
    setUploading(true);
    try {
      const dataUri = await fileToBase64(file);
      const r = await api.post("/blog/admin/upload-image", { dataUri });
      onChange(r.data.url);
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative rounded-xl overflow-hidden border group" style={{ borderColor: "var(--app-border)" }}>
          <img src={value} alt="" className="w-full max-h-52 object-cover" onError={e => { e.target.style.display = "none"; }} />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white text-gray-800 text-xs font-semibold flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Replace
            </button>
            <button onClick={() => onChange("")}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold">Remove</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 hover:border-orange-400 hover:bg-orange-500/5 transition"
          style={{ borderColor: "var(--app-border)" }}
        >
          {uploading ? (
            <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-app-soft" />
          )}
          <span className="text-xs text-app-soft font-medium">{uploading ? "Uploading…" : placeholder}</span>
          <span className="text-[10px] text-app-soft/60">PNG, JPG, WebP - max 5 MB</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

// ── Single Block ───────────────────────────────────────────────────────────────
function Block({ block, onChange, onDelete, onAddAfter, onMoveUp, onMoveDown, isFirst, isLast }) {
  const editRef = useRef(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const TypeIcon = BLOCK_TYPES.find(b => b.type === block.type)?.icon || AlignLeft;

  const handleInput = useCallback(() => {
    if (editRef.current) onChange({ ...block, content: editRef.current.innerHTML });
  }, [block, onChange]);

  useEffect(() => {
    if (editRef.current && editRef.current.innerHTML !== block.content) {
      editRef.current.innerHTML = block.content || "";
    }
  }, [block.id, block.type]);

  const ceProps = {
    ref: editRef,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: handleInput,
    onKeyDown: (e) => {
      if (e.key === "Enter" && !e.shiftKey && !["paragraph", "quote"].includes(block.type)) {
        e.preventDefault(); onAddAfter(block.id, "paragraph");
      }
    },
    style: { outline: "none", minHeight: "1.5em", wordBreak: "break-word" },
  };

  const updateItem = (idx, val) => { const items = [...(block.items || [])]; items[idx] = val; onChange({ ...block, items }); };
  const addItem    = (i) => { const items = [...(block.items || [])]; items.splice(i + 1, 0, ""); onChange({ ...block, items }); };
  const removeItem = (i) => { const items = [...(block.items || [])]; if (items.length === 1) return; items.splice(i, 1); onChange({ ...block, items }); };

  return (
    <div className="group relative">
      {/* Left controls */}
      <div className="absolute left-0 top-0 -translate-x-full pr-2 hidden group-hover:flex items-start gap-0.5 pt-1">
        <button onClick={() => setShowTypePicker(v => !v)}
          className="p-1 rounded-lg hover:bg-orange-500/10 text-app-soft hover:text-orange-500 transition" title="Change type">
          <TypeIcon className="w-3.5 h-3.5" />
        </button>
        <div className="flex flex-col gap-0.5">
          <button onClick={() => onMoveUp(block.id)} disabled={isFirst}
            className="p-0.5 rounded text-app-soft disabled:opacity-20 hover:text-orange-500 transition text-sm leading-none">▴</button>
          <button onClick={() => onMoveDown(block.id)} disabled={isLast}
            className="p-0.5 rounded text-app-soft disabled:opacity-20 hover:text-orange-500 transition text-sm leading-none">▾</button>
        </div>
      </div>

      {/* Type picker */}
      {showTypePicker && (
        <div className="absolute left-0 top-8 z-50">
          <div className="fixed inset-0 z-40" onClick={() => setShowTypePicker(false)} />
          <div className="relative z-50">
            <BlockPicker
              onSelect={type => { onChange({ ...block, type, content: "", items: [""] }); setShowTypePicker(false); }}
              onClose={() => setShowTypePicker(false)}
            />
          </div>
        </div>
      )}

      {/* Paragraph */}
      {block.type === "paragraph" && (
        <div {...ceProps} className="text-base leading-relaxed text-app"
          data-placeholder="Start writing…" style={{ ...ceProps.style, color: "var(--app-text)" }} />
      )}

      {/* Headings */}
      {["h2","h3","h4"].includes(block.type) && (
        <div {...ceProps}
          className={`font-bold text-app leading-tight ${block.type === "h2" ? "text-3xl" : block.type === "h3" ? "text-2xl" : "text-xl"}`}
          data-placeholder={block.type.toUpperCase()} />
      )}

      {/* Quote */}
      {block.type === "quote" && (
        <div className="border-l-4 border-orange-400 pl-5 py-1">
          <div {...ceProps} className="text-lg italic text-app-soft" data-placeholder="Type a quote…" />
        </div>
      )}

      {/* Code */}
      {block.type === "code" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e2e" }}>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
            <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Code</span>
            <input value={block.language || ""} onChange={e => onChange({ ...block, language: e.target.value })}
              className="ml-auto bg-white/5 rounded px-2 py-0.5 text-[10px] text-white/60 font-mono outline-none w-20" placeholder="language" />
          </div>
          <textarea value={block.content || ""} onChange={e => onChange({ ...block, content: e.target.value })}
            className="w-full bg-transparent text-sm font-mono text-green-300 p-4 outline-none resize-none"
            placeholder="// paste your code here" rows={5} />
        </div>
      )}

      {/* Image - uses full upload component */}
      {block.type === "image" && (
        <div className="space-y-2">
          <ImageUploadArea value={block.content} onChange={url => onChange({ ...block, content: url })} placeholder="Set image" />
          {block.content && (
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={block.alt || ""} onChange={e => onChange({ ...block, alt: e.target.value })}
                className="input text-xs" placeholder="Alt text (SEO)" />
              <input type="text" value={block.caption || ""} onChange={e => onChange({ ...block, caption: e.target.value })}
                className="input text-xs" placeholder="Caption (optional)" />
            </div>
          )}
        </div>
      )}

      {/* Lists */}
      {["bulletList","numberedList"].includes(block.type) && (
        <div className="space-y-1.5">
          {(block.items || [""]).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-app-soft text-sm w-5 text-right flex-shrink-0 select-none">
                {block.type === "numberedList" ? `${idx + 1}.` : "•"}
              </span>
              <input type="text" value={item} onChange={e => updateItem(idx, e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); addItem(idx); }
                  if (e.key === "Backspace" && !item && block.items.length > 1) { e.preventDefault(); removeItem(idx); }
                }}
                className="flex-1 bg-transparent text-base text-app outline-none border-b border-transparent focus:border-orange-300 py-0.5 transition"
                placeholder="List item…" />
              {(block.items || []).length > 1 && (
                <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-app-soft hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => addItem((block.items || []).length - 1)} className="text-xs text-orange-500 hover:underline ml-7">+ Add item</button>
        </div>
      )}

      {/* Divider */}
      {block.type === "divider" && (
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
          <span className="text-[10px] text-app-soft uppercase tracking-widest">•••</span>
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
        </div>
      )}

      {/* Add block below */}
      <button onClick={() => onAddAfter(block.id)}
        className="mt-1.5 flex items-center gap-1 text-[11px] text-app-soft hover:text-orange-500 opacity-0 group-hover:opacity-100 transition">
        <Plus className="w-3 h-3" /> Add block
      </button>

      {/* Delete block */}
      <button onClick={() => onDelete(block.id)}
        className="absolute right-0 top-0 p-1.5 rounded-lg text-app-soft hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── SEO score ─────────────────────────────────────────────────────────────────
function SeoScore({ title, metaTitle, metaDescription, focusKeyword, blocks, featuredImage }) {
  const checks = [
    { label: "Title set",          ok: !!title?.trim() },
    { label: "Meta title (≤70c)",  ok: !!metaTitle?.trim() && metaTitle.length <= 70 },
    { label: "Meta description",   ok: metaDescription?.length >= 50 && metaDescription.length <= 160 },
    { label: "Focus keyword",      ok: !!focusKeyword?.trim() },
    { label: "Featured image",     ok: !!featuredImage?.trim() },
    { label: "Has H2 heading",     ok: blocks.some(b => b.type === "h2") },
    { label: "Has content (>50w)", ok: blocks.some(b => b.type === "paragraph" && (b.content || "").replace(/<[^>]*>/g, "").length > 50) },
  ];
  const passed = checks.filter(c => c.ok).length;
  const score  = Math.round((passed / checks.length) * 100);
  const col    = score >= 80 ? "green" : score >= 50 ? "yellow" : "red";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-app">SEO Score</span>
        <span className={`text-sm font-bold text-${col}-500`}>{score}/100</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--app-surface-low)" }}>
        <div className={`h-full rounded-full bg-${col}-500`} style={{ width: `${score}%`, transition: "width .5s" }} />
      </div>
      <div className="space-y-1.5">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${c.ok ? "bg-green-500/15 text-green-500" : "bg-red-500/10 text-red-400"}`}>
              {c.ok ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
            </div>
            <span className={`text-[11px] ${c.ok ? "text-app-soft" : "text-app-soft/60"}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Paste & Import modal ──────────────────────────────────────────────────────
function ImportModal({ onImport, onClose }) {
  const [text, setText] = useState("");

  const handleImport = () => {
    if (!text.trim()) return;
    const result = parseMarkdown(text.trim());
    onImport(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--app-border)" }}>
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <ClipboardPaste className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-app">Paste & Import Content</h2>
            <p className="text-xs text-app-soft">Supports Markdown - headings, lists, quotes and dividers are auto-detected</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-app-soft">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cheatsheet */}
        <div className="px-5 py-3 border-b flex flex-wrap gap-x-5 gap-y-1" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
          {[
            ["# Title",    "→ Post title"],
            ["## Text",    "→ Heading 2"],
            ["### Text",   "→ Heading 3"],
            ["- item",     "→ Bullet list"],
            ["1. item",    "→ Numbered list"],
            ["> text",     "→ Quote"],
            ["---",        "→ Divider"],
            ["**bold**",   "→ Bold"],
            ["*italic*",   "→ Italic"],
          ].map(([code, label]) => (
            <span key={code} className="text-[10px] text-app-soft">
              <code className="font-mono text-orange-500 bg-orange-500/8 px-1 rounded">{code}</code> {label}
            </span>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          className="flex-1 w-full p-5 text-sm font-mono text-app bg-transparent outline-none resize-none"
          style={{ minHeight: 320 }}
          placeholder={"# Your Post Title\n\n## First Heading\n\nYour paragraph text here...\n\n## Second Heading\n\n- Bullet item one\n- Bullet item two\n\n> A great quote goes here\n\n---"}
        />

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--app-border)" }}>
          <p className="text-xs text-app-soft">
            {text.trim().split("\n").filter(Boolean).length} lines - will create approx.{" "}
            <strong>{Math.max(1, text.trim().split(/\n\n+/).filter(Boolean).length)}</strong> blocks
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border text-app-soft hover:text-app transition"
              style={{ borderColor: "var(--app-border)" }}>Cancel</button>
            <button onClick={handleImport} disabled={!text.trim()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition disabled:opacity-40">
              Import Content
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main BlogEditor ────────────────────────────────────────────────────────────
export default function BlogEditor() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const isEdit    = !!id;
  const editorRef = useRef(null);

  // Post fields
  const [title,           setTitle]           = useState("");
  const [blocks,          setBlocks]          = useState([newBlock("paragraph")]);
  const [status,          setStatus]          = useState("draft");
  const [featuredImage,   setFeaturedImage]   = useState("");
  const [featuredImageAlt,setFeaturedImageAlt]= useState("");
  const [excerpt,         setExcerpt]         = useState("");
  const [slug,            setSlug]            = useState("");
  const [slugEdited,      setSlugEdited]      = useState(false);
  const [metaTitle,       setMetaTitle]       = useState("");
  const [metaDesc,        setMetaDesc]        = useState("");
  const [focusKeyword,    setFocusKeyword]    = useState("");
  const [categoryId,      setCategoryId]      = useState("");
  const [tags,            setTags]            = useState([]);
  const [tagInput,        setTagInput]        = useState("");

  // UI state
  const [saving,         setSaving]         = useState(false);
  const [loading,        setLoading]        = useState(isEdit);
  const [categories,     setCategories]     = useState([]);
  const [showCatForm,    setShowCatForm]    = useState(false);
  const [newCatName,     setNewCatName]     = useState("");
  const [deletingCatId,  setDeletingCatId]  = useState(null);
  const [addingBlock,    setAddingBlock]    = useState(null);
  const [showBlockPicker,setShowBlockPicker]= useState(false);
  const [publishMenu,    setPublishMenu]    = useState(false);
  const [showImport,     setShowImport]     = useState(false);
  const [sidebarTab,     setSidebarTab]     = useState("post"); // "post" | "seo"

  // Auto-slug
  useEffect(() => {
    if (!slugEdited && title) {
      setSlug(title.toLowerCase().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80));
    }
  }, [title, slugEdited]);

  // Load categories
  const loadCategories = useCallback(() => {
    api.get("/blog/categories").then(r => setCategories(r.data.categories || [])).catch(() => {});
  }, []);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Load post for editing
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api.get(`/blog/admin/posts/${id}`)
      .then(r => {
        const p = r.data.post;
        setTitle(p.title || "");
        setBlocks(p.blocks?.length ? p.blocks : [newBlock("paragraph")]);
        setStatus(p.status || "draft");
        setFeaturedImage(p.featuredImage || "");
        setFeaturedImageAlt(p.featuredImageAlt || "");
        setExcerpt(p.excerpt || "");
        setSlug(p.slug || "");
        setSlugEdited(true);
        setMetaTitle(p.metaTitle || "");
        setMetaDesc(p.metaDescription || "");
        setFocusKeyword(p.focusKeyword || "");
        setCategoryId(p.category?._id || "");
        setTags(p.tags || []);
      })
      .catch(() => { toast.error("Failed to load post"); navigate("/super-admin/blog"); })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Block operations
  const updateBlock  = useCallback(u => setBlocks(p => p.map(b => b.id === u.id ? u : b)), []);
  const deleteBlock  = useCallback(id => setBlocks(p => p.length === 1 ? [newBlock()] : p.filter(b => b.id !== id)), []);
  const addBlockAfter = useCallback((afterId, type = null) => {
    if (!type) { setAddingBlock(afterId); setShowBlockPicker(true); return; }
    setBlocks(p => {
      const idx  = p.findIndex(b => b.id === afterId);
      const next = [...p];
      next.splice(idx + 1, 0, newBlock(type));
      return next;
    });
  }, []);
  const moveBlock = useCallback((id, dir) => {
    setBlocks(p => {
      const idx = p.findIndex(b => b.id === id);
      if (dir === "up" && idx === 0 || dir === "down" && idx === p.length - 1) return p;
      const n = [...p]; const o = idx + (dir === "up" ? -1 : 1);
      [n[idx], n[o]] = [n[o], n[idx]]; return n;
    });
  }, []);

  // Tags
  const addTag    = () => { const t = tagInput.trim().toLowerCase(); if (t && !tags.includes(t)) setTags(p => [...p, t]); setTagInput(""); };
  const removeTag = t => setTags(p => p.filter(x => x !== t));

  // Create category
  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const r = await api.post("/blog/admin/categories", { name: newCatName.trim() });
      setCategories(p => [...p, r.data.category]);
      setCategoryId(r.data.category._id);
      setNewCatName(""); setShowCatForm(false);
      toast.success("Category created");
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  // Delete category
  const deleteCategory = async (catId) => {
    setDeletingCatId(catId);
    try {
      await api.delete(`/blog/admin/categories/${catId}`);
      setCategories(p => p.filter(c => c._id !== catId));
      if (categoryId === catId) setCategoryId("");
      toast.success("Category deleted");
    } catch (err) { toast.error(err.response?.data?.message || "Cannot delete"); }
    finally { setDeletingCatId(null); }
  };

  // Save
  const save = async (overrideStatus) => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = {
        title, slug, excerpt, blocks, featuredImage, featuredImageAlt,
        category: categoryId || null, tags,
        status: overrideStatus ?? status,
        metaTitle: metaTitle || title,
        metaDescription: metaDesc || excerpt,
        focusKeyword,
      };
      if (isEdit) {
        await api.put(`/blog/admin/posts/${id}`, payload);
        if (overrideStatus) setStatus(overrideStatus);
        toast.success("Post updated");
      } else {
        const r = await api.post("/blog/admin/posts", payload);
        toast.success(overrideStatus === "published" ? "Post published! 🎉" : "Draft saved");
        navigate(`/super-admin/blog/${r.data.post._id}/edit`, { replace: true });
      }
    } catch (err) { toast.error(err.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); setPublishMenu(false); }
  };

  if (loading) return (
    <div className="stitch-page flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2.5 border-b"
        style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}>
        <button onClick={() => navigate("/super-admin/blog")}
          className="p-2 rounded-xl hover:bg-orange-500/10 text-app-soft hover:text-orange-500 transition">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-app truncate max-w-[180px]">{title || "Untitled post"}</span>
          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            status === "published" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
          }`}>{status === "published" ? "Published" : "Draft"}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {status === "published" && slug && (
            <a href={`/blog/${slug}`} target="_blank" rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border text-app-soft hover:text-orange-500 hover:border-orange-400 transition"
              style={{ borderColor: "var(--app-border)" }}>
              <ExternalLink className="w-3.5 h-3.5" /> Preview
            </a>
          )}
          <button onClick={() => setShowImport(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border text-app-soft hover:text-orange-500 hover:border-orange-400 transition"
            style={{ borderColor: "var(--app-border)" }}>
            <ClipboardPaste className="w-3.5 h-3.5" /> Import
          </button>
          <button onClick={() => save("draft")} disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border text-app-soft hover:text-orange-500 hover:border-orange-400 transition"
            style={{ borderColor: "var(--app-border)" }}>
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save Draft"}
          </button>
          <div className="relative">
            <div className="flex rounded-xl overflow-hidden">
              <button onClick={() => save("published")} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition">
                <Globe className="w-3.5 h-3.5" /> {status === "published" ? "Update" : "Publish"}
              </button>
              <button onClick={() => setPublishMenu(v => !v)}
                className="px-2 py-1.5 bg-orange-500 hover:bg-orange-600 text-white border-l border-orange-600 transition">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {publishMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPublishMenu(false)} />
                <div className="absolute right-0 top-10 rounded-xl shadow-xl overflow-hidden w-40 z-50"
                  style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
                  <button onClick={() => save("published")} className="w-full px-4 py-2.5 text-left text-xs font-semibold text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition">✓ Publish Now</button>
                  <button onClick={() => save("draft")} className="w-full px-4 py-2.5 text-left text-xs text-app-soft hover:bg-orange-500/5 transition">Save as Draft</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Editor ── */}
        <div ref={editorRef} className="flex-1 overflow-y-auto">
          <FormatBar targetRef={editorRef} />

          <div className="max-w-3xl mx-auto px-6 py-10">
            {/* Title */}
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Add title"
              className="w-full text-4xl font-extrabold text-app bg-transparent outline-none placeholder:text-app-soft/30 mb-2 leading-tight" />

            {/* Slug row */}
            <div className="flex items-center gap-1.5 mb-10">
              <span className="text-xs text-app-soft">arthaleads.com/blog/</span>
              <input type="text" value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")); setSlugEdited(true); }}
                className="text-xs text-orange-500 bg-transparent outline-none border-b border-dashed border-orange-300 focus:border-orange-500 py-0.5 min-w-[80px]"
                placeholder="post-slug" />
            </div>

            {/* Blocks */}
            <div className="space-y-5">
              {blocks.map((block, idx) => (
                <Block key={block.id} block={block}
                  onChange={updateBlock}
                  onDelete={deleteBlock}
                  onAddAfter={(bid, type) => type ? addBlockAfter(bid, type) : (() => { setAddingBlock(bid); setShowBlockPicker(true); })()}
                  onMoveUp={id => moveBlock(id, "up")}
                  onMoveDown={id => moveBlock(id, "down")}
                  isFirst={idx === 0} isLast={idx === blocks.length - 1}
                />
              ))}
            </div>

            {/* Add block button */}
            <div className="mt-8 pt-4 border-t border-dashed relative" style={{ borderColor: "var(--app-border)" }}>
              <button
                onClick={() => { setAddingBlock(blocks[blocks.length - 1]?.id); setShowBlockPicker(true); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-app-soft hover:text-orange-500 hover:bg-orange-500/5 border border-dashed transition"
                style={{ borderColor: "var(--app-border)" }}>
                <Plus className="w-4 h-4" /> Add Block
              </button>
              {showBlockPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBlockPicker(false)} />
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-50">
                    <BlockPicker
                      onSelect={type => {
                        if (addingBlock) addBlockAfter(addingBlock, type);
                        else setBlocks(p => [...p, newBlock(type)]);
                        setShowBlockPicker(false); setAddingBlock(null);
                      }}
                      onClose={() => { setShowBlockPicker(false); setAddingBlock(null); }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar - WordPress style ── */}
        <div className="w-72 flex-shrink-0 border-l flex flex-col"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}>

          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: "var(--app-border)" }}>
            {[
              { key: "post", label: "Post" },
              { key: "seo",  label: "SEO" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setSidebarTab(tab.key)}
                className={`flex-1 py-3 text-xs font-semibold transition border-b-2 ${
                  sidebarTab === tab.key
                    ? "border-orange-500 text-orange-500"
                    : "border-transparent text-app-soft hover:text-app"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ── POST TAB ── */}
            {sidebarTab === "post" && (
              <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>

                {/* Summary */}
                <div className="px-4 py-4">
                  <div className="text-[10px] text-app-soft space-y-0.5">
                    {blocks.length} block{blocks.length !== 1 ? "s" : ""}
                    {" · "}
                    {Math.max(1, Math.ceil(
                      blocks.filter(b => ["paragraph","h2","h3","h4","quote"].includes(b.type))
                        .map(b => (b.content || "").replace(/<[^>]*>/g,"")).join(" ")
                        .split(/\s+/).filter(Boolean).length / 200
                    ))} min read
                  </div>
                </div>

                {/* Status + publish */}
                <div className="px-4 py-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-soft">Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["draft","published"].map(s => (
                      <button key={s} onClick={() => setStatus(s)}
                        className={`py-2 rounded-xl text-xs font-semibold capitalize border transition ${
                          status === s
                            ? s === "published" ? "bg-green-500 text-white border-green-500" : "bg-amber-500 text-white border-amber-500"
                            : "text-app-soft hover:border-orange-400"
                        }`}
                        style={status !== s ? { borderColor: "var(--app-border)" } : {}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Featured image - WordPress button style */}
                <div className="px-4 py-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-soft">Featured Image</p>
                  <ImageUploadArea
                    value={featuredImage}
                    onChange={setFeaturedImage}
                    placeholder="Set featured image"
                  />
                  {featuredImage && (
                    <input type="text" value={featuredImageAlt} onChange={e => setFeaturedImageAlt(e.target.value)}
                      className="input w-full text-xs" placeholder="Alt text (for SEO)" />
                  )}
                </div>

                {/* Category */}
                <div className="px-4 py-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-soft">Category</p>
                  <div className="space-y-1.5">
                    {categories.map(c => (
                      <div key={c._id} className="flex items-center gap-2">
                        <input type="radio" id={`cat-${c._id}`} name="category"
                          checked={categoryId === c._id}
                          onChange={() => setCategoryId(c._id)}
                          className="accent-orange-500" />
                        <label htmlFor={`cat-${c._id}`} className="flex-1 text-sm text-app cursor-pointer select-none">{c.name}</label>
                        <button
                          onClick={() => deleteCategory(c._id)}
                          disabled={deletingCatId === c._id}
                          className="p-1 rounded text-app-soft hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                          title="Delete category"
                        >
                          {deletingCatId === c._id
                            ? <div className="w-3 h-3 rounded-full border border-red-400 border-t-transparent animate-spin" />
                            : <X className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                    {!categories.length && <p className="text-xs text-app-soft">No categories yet</p>}

                    {/* None option */}
                    <div className="flex items-center gap-2 pt-1">
                      <input type="radio" id="cat-none" name="category"
                        checked={!categoryId}
                        onChange={() => setCategoryId("")}
                        className="accent-orange-500" />
                      <label htmlFor="cat-none" className="text-sm text-app-soft cursor-pointer">Uncategorized</label>
                    </div>
                  </div>

                  {!showCatForm ? (
                    <button onClick={() => setShowCatForm(true)} className="text-xs text-orange-500 hover:underline">+ New category</button>
                  ) : (
                    <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--app-border)" }}>
                      <input autoFocus type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && createCategory()}
                        className="input w-full text-xs" placeholder="Category name" />
                      <div className="flex gap-2">
                        <button onClick={createCategory} className="flex-1 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition">Add</button>
                        <button onClick={() => { setShowCatForm(false); setNewCatName(""); }} className="flex-1 py-1.5 rounded-lg text-xs text-app-soft hover:bg-black/5 transition">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="px-4 py-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-soft">Tags</p>
                  <div className="flex gap-2">
                    <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                      className="input flex-1 text-xs" placeholder="Add tag, press Enter" />
                    <button onClick={addTag} className="px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-lg text-xs font-semibold hover:bg-orange-500/20 transition">+</button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400">
                          {t} <button onClick={() => removeTag(t)} className="hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Excerpt */}
                <div className="px-4 py-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-soft">Excerpt</p>
                  <textarea value={excerpt} onChange={e => setExcerpt(e.target.value.slice(0, 500))}
                    rows={3} className="input w-full text-xs resize-none"
                    placeholder="Short description shown in blog listing…" />
                  <p className="text-[10px] text-app-soft text-right">{excerpt.length}/500</p>
                </div>

              </div>
            )}

            {/* ── SEO TAB ── */}
            {sidebarTab === "seo" && (
              <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>

                {/* SEO score */}
                <div className="px-4 py-4">
                  <SeoScore title={title} metaTitle={metaTitle} metaDescription={metaDesc}
                    focusKeyword={focusKeyword} blocks={blocks} featuredImage={featuredImage} />
                </div>

                {/* Fields */}
                <div className="px-4 py-4 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-app-soft block mb-1.5">Focus Keyword</label>
                    <input type="text" value={focusKeyword} onChange={e => setFocusKeyword(e.target.value)}
                      className="input w-full text-xs" placeholder="e.g. real estate CRM India" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-1.5 flex justify-between">
                      <span>Meta Title</span>
                      <span className={metaTitle.length > 70 ? "text-red-400" : ""}>{metaTitle.length}/70</span>
                    </label>
                    <input type="text" value={metaTitle} onChange={e => setMetaTitle(e.target.value.slice(0,70))}
                      className="input w-full text-xs" placeholder="SEO title (defaults to post title)" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-1.5 flex justify-between">
                      <span>Meta Description</span>
                      <span className={metaDesc.length > 160 ? "text-red-400" : ""}>{metaDesc.length}/160</span>
                    </label>
                    <textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value.slice(0,160))}
                      rows={3} className="input w-full text-xs resize-none"
                      placeholder="Shown in Google search results…" />
                  </div>
                </div>

                {/* Google preview */}
                {(metaTitle || title) && (
                  <div className="px-4 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-3">Google Preview</p>
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                      <p className="text-[13px] text-blue-600 dark:text-blue-400 font-medium leading-snug line-clamp-1">{metaTitle || title}</p>
                      <p className="text-[11px] text-green-700 dark:text-green-400 mt-0.5">arthaleads.com › blog › {slug || "slug"}</p>
                      <p className="text-[11px] text-app-soft mt-1 line-clamp-2">{metaDesc || excerpt || "No description set"}</p>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>

      {/* contenteditable placeholder CSS */}
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--app-text-soft);
          opacity: 0.35;
          pointer-events: none;
        }
      `}</style>

      {/* Paste & Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={({ title: importedTitle, blocks: importedBlocks }) => {
            if (importedTitle && !title) setTitle(importedTitle);
            setBlocks(importedBlocks);
            toast.success(`Imported ${importedBlocks.length} blocks`);
          }}
        />
      )}
    </div>
  );
}
