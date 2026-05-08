import { useState, useEffect, useRef, useCallback, useId } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  ArrowLeft, Save, Eye, Globe, FileText, Image, Quote, List, ListOrdered,
  Minus, ChevronDown, Plus, Trash2, GripVertical, Code, Heading2, Heading3,
  Heading4, AlignLeft, X, Tag, Search, Check, Info, ExternalLink,
} from "lucide-react";

// ── Block type definitions ─────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: "paragraph",     label: "Paragraph",      icon: AlignLeft,    desc: "Plain text paragraph" },
  { type: "h2",            label: "Heading 2",       icon: Heading2,     desc: "Large section heading" },
  { type: "h3",            label: "Heading 3",       icon: Heading3,     desc: "Medium section heading" },
  { type: "h4",            label: "Heading 4",       icon: Heading4,     desc: "Small section heading" },
  { type: "image",         label: "Image",           icon: Image,        desc: "Image with caption" },
  { type: "quote",         label: "Quote",           icon: Quote,        desc: "Blockquote" },
  { type: "bulletList",    label: "Bullet List",     icon: List,         desc: "Unordered list" },
  { type: "numberedList",  label: "Numbered List",   icon: ListOrdered,  desc: "Ordered list" },
  { type: "code",          label: "Code Block",      icon: Code,         desc: "Code snippet" },
  { type: "divider",       label: "Divider",         icon: Minus,        desc: "Horizontal separator" },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function newBlock(type = "paragraph") {
  return { id: genId(), type, content: "", alt: "", caption: "", items: [""], language: "" };
}

// ── Formatting toolbar (floats when text is selected) ─────────────────────────
function FormatBar({ targetRef }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const barRef = useRef(null);

  useEffect(() => {
    function onSelect() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !targetRef.current?.contains(sel.anchorNode)) {
        setVisible(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const barW = 240;
      setPos({
        top:  rect.top + window.scrollY - 44,
        left: Math.max(8, rect.left + window.scrollX + rect.width / 2 - barW / 2),
      });
      setVisible(true);
    }
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [targetRef]);

  if (!visible) return null;

  const cmd = (command, val) => {
    document.execCommand(command, false, val || null);
    targetRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const insertLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const url = prompt("Enter link URL:", "https://");
    if (url) cmd("createLink", url);
  };

  return (
    <div
      ref={barRef}
      className="fixed z-50 flex items-center gap-0.5 rounded-xl shadow-xl px-2 py-1.5"
      style={{
        top: pos.top, left: pos.left, width: 240,
        background: "var(--app-surface)",
        border: "1px solid var(--app-border)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {[
        { label: "B",  cmd: "bold",      style: "font-bold" },
        { label: "I",  cmd: "italic",    style: "italic" },
        { label: "U",  cmd: "underline", style: "underline" },
        { label: "S",  cmd: "strikeThrough", style: "line-through" },
      ].map(({ label, cmd: c, style }) => (
        <button
          key={c}
          onClick={() => cmd(c)}
          className={`w-7 h-7 rounded-lg text-sm hover:bg-orange-500/10 hover:text-orange-500 text-app transition ${style}`}
          title={c}
        >{label}</button>
      ))}
      <div className="w-px h-4 bg-app-border mx-1" />
      <button
        onClick={insertLink}
        className="px-2 h-7 rounded-lg text-xs hover:bg-orange-500/10 hover:text-orange-500 text-app transition"
        title="Insert link"
      >Link</button>
      <button
        onClick={() => cmd("removeFormat")}
        className="px-2 h-7 rounded-lg text-xs hover:bg-red-500/10 hover:text-red-500 text-app-soft transition"
        title="Remove formatting"
      >Clear</button>
    </div>
  );
}

// ── Block picker popup ─────────────────────────────────────────────────────────
function BlockPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const filtered = BLOCK_TYPES.filter(
    (b) => b.label.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div
      className="rounded-2xl shadow-2xl overflow-hidden w-72"
      style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
    >
      <div className="p-2 border-b" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--app-surface-low)" }}>
          <Search className="w-3.5 h-3.5 text-app-soft flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-xs text-app outline-none placeholder:text-app-soft"
            placeholder="Search blocks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="py-2 max-h-72 overflow-y-auto">
        {filtered.map((b) => {
          const Icon = b.icon;
          return (
            <button
              key={b.type}
              onClick={() => { onSelect(b.type); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-orange-500/5 transition"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--app-surface-low)" }}>
                <Icon className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-app leading-none">{b.label}</p>
                <p className="text-[10px] text-app-soft mt-0.5">{b.desc}</p>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-app-soft text-center py-4">No blocks found</p>
        )}
      </div>
    </div>
  );
}

// ── Single Block component ─────────────────────────────────────────────────────
function Block({ block, onChange, onDelete, onAddAfter, onMoveUp, onMoveDown, isFirst, isLast }) {
  const editRef = useRef(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [focused, setFocused] = useState(false);
  const TypeIcon = BLOCK_TYPES.find((b) => b.type === block.type)?.icon || AlignLeft;

  // Sync contenteditable → state
  const handleInput = useCallback(() => {
    if (editRef.current) {
      onChange({ ...block, content: editRef.current.innerHTML });
    }
  }, [block, onChange]);

  // Init contenteditable value on mount / type change
  useEffect(() => {
    if (editRef.current && editRef.current.innerHTML !== block.content) {
      editRef.current.innerHTML = block.content || "";
    }
  }, [block.id, block.type]);

  // Common text block props
  const ceProps = {
    ref: editRef,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: handleInput,
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
    onKeyDown: (e) => {
      if (e.key === "Enter" && !e.shiftKey && block.type !== "paragraph" && block.type !== "quote") {
        e.preventDefault();
        onAddAfter(block.id, "paragraph");
      }
    },
    style: { outline: "none", minHeight: "1.5em", wordBreak: "break-word" },
  };

  const updateItem = (idx, val) => {
    const items = [...(block.items || [])];
    items[idx] = val;
    onChange({ ...block, items });
  };
  const addItem = (afterIdx) => {
    const items = [...(block.items || [])];
    items.splice(afterIdx + 1, 0, "");
    onChange({ ...block, items });
  };
  const removeItem = (idx) => {
    const items = [...(block.items || [])];
    if (items.length === 1) return;
    items.splice(idx, 1);
    onChange({ ...block, items });
  };

  return (
    <div className="group relative">
      {/* Block controls — show on hover */}
      <div className="absolute left-0 top-0 -translate-x-full pr-2 hidden group-hover:flex items-start gap-0.5 pt-1">
        <button
          onClick={() => setShowTypePicker((v) => !v)}
          className="p-1 rounded-lg hover:bg-orange-500/10 text-app-soft hover:text-orange-500 transition"
          title="Change block type"
        >
          <TypeIcon className="w-3.5 h-3.5" />
        </button>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMoveUp(block.id)}
            disabled={isFirst}
            className="p-0.5 rounded hover:bg-orange-500/10 text-app-soft disabled:opacity-20 transition"
            title="Move up"
          >▴</button>
          <button
            onClick={() => onMoveDown(block.id)}
            disabled={isLast}
            className="p-0.5 rounded hover:bg-orange-500/10 text-app-soft disabled:opacity-20 transition"
            title="Move down"
          >▾</button>
        </div>
      </div>

      {/* Block type picker */}
      {showTypePicker && (
        <div className="absolute left-0 top-8 z-50">
          <BlockPicker
            onSelect={(type) => {
              const updated = { ...block, type, content: "", items: block.items?.length ? block.items : [""], };
              onChange(updated);
              setShowTypePicker(false);
            }}
            onClose={() => setShowTypePicker(false)}
          />
        </div>
      )}

      {/* Paragraph */}
      {block.type === "paragraph" && (
        <div
          {...ceProps}
          className="text-base leading-relaxed text-app"
          data-placeholder="Start writing…"
          style={{
            ...ceProps.style,
            color: "var(--app-text)",
          }}
        />
      )}

      {/* Headings */}
      {(block.type === "h2" || block.type === "h3" || block.type === "h4") && (
        <div
          {...ceProps}
          className={`font-bold text-app leading-tight ${
            block.type === "h2" ? "text-3xl" : block.type === "h3" ? "text-2xl" : "text-xl"
          }`}
          data-placeholder={block.type === "h2" ? "Heading 2" : block.type === "h3" ? "Heading 3" : "Heading 4"}
        />
      )}

      {/* Quote */}
      {block.type === "quote" && (
        <div className="border-l-4 border-orange-400 pl-5 py-1">
          <div
            {...ceProps}
            className="text-lg italic text-app-soft leading-relaxed"
            data-placeholder="Type a quote…"
          />
        </div>
      )}

      {/* Code */}
      {block.type === "code" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e2e" }}>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
            <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Code</span>
            <input
              value={block.language || ""}
              onChange={(e) => onChange({ ...block, language: e.target.value })}
              className="ml-auto bg-white/5 rounded px-2 py-0.5 text-[10px] text-white/60 font-mono outline-none w-20"
              placeholder="language"
            />
          </div>
          <textarea
            value={block.content || ""}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            className="w-full bg-transparent text-sm font-mono text-green-300 p-4 outline-none resize-none"
            placeholder="// paste your code here"
            rows={6}
          />
        </div>
      )}

      {/* Image */}
      {block.type === "image" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={block.content || ""}
              onChange={(e) => onChange({ ...block, content: e.target.value })}
              className="input flex-1 text-sm"
              placeholder="Paste image URL (https://…)"
            />
          </div>
          {block.content && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--app-border)" }}>
              <img
                src={block.content}
                alt={block.alt || ""}
                className="w-full max-h-96 object-contain"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={block.alt || ""}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
              className="input text-xs"
              placeholder="Alt text (for SEO)"
            />
            <input
              type="text"
              value={block.caption || ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              className="input text-xs"
              placeholder="Caption (optional)"
            />
          </div>
        </div>
      )}

      {/* Lists */}
      {(block.type === "bulletList" || block.type === "numberedList") && (
        <div className="space-y-1.5">
          {(block.items || [""]).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-app-soft text-sm w-5 flex-shrink-0 text-right select-none">
                {block.type === "numberedList" ? `${idx + 1}.` : "•"}
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addItem(idx); }
                  if (e.key === "Backspace" && !item && block.items.length > 1) { e.preventDefault(); removeItem(idx); }
                }}
                className="flex-1 bg-transparent text-base text-app outline-none border-b border-transparent focus:border-orange-300 py-0.5 transition"
                placeholder="List item…"
              />
              {(block.items || []).length > 1 && (
                <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-app-soft hover:text-red-400 transition">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => addItem((block.items || []).length - 1)}
            className="text-xs text-orange-500 hover:underline ml-7"
          >+ Add item</button>
        </div>
      )}

      {/* Divider */}
      {block.type === "divider" && (
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
          <span className="text-[10px] text-app-soft uppercase tracking-widest">divider</span>
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
        </div>
      )}

      {/* Add block below */}
      <button
        onClick={() => onAddAfter(block.id)}
        className="mt-2 flex items-center gap-1.5 text-[11px] text-app-soft hover:text-orange-500 opacity-0 group-hover:opacity-100 transition"
        title="Add block below"
      >
        <Plus className="w-3 h-3" /> Add block
      </button>

      {/* Delete block */}
      <button
        onClick={() => onDelete(block.id)}
        className="absolute right-0 top-0 p-1.5 rounded-lg text-app-soft hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition"
        title="Delete block"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── SEO score indicator ────────────────────────────────────────────────────────
function SeoScore({ title, metaTitle, metaDescription, focusKeyword, blocks, featuredImage }) {
  const checks = [
    { label: "Title set",          ok: !!title?.trim() },
    { label: "Meta title (≤70c)",  ok: metaTitle?.trim().length > 0 && metaTitle.length <= 70 },
    { label: "Meta description",   ok: metaDescription?.trim().length >= 50 && metaDescription.length <= 160 },
    { label: "Focus keyword",      ok: !!focusKeyword?.trim() },
    { label: "Featured image",     ok: !!featuredImage?.trim() },
    { label: "Has H2 heading",     ok: blocks.some((b) => b.type === "h2") },
    { label: "Has content",        ok: blocks.some((b) => b.type === "paragraph" && b.content?.length > 50) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const color = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const bgColor = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-app">SEO Score</span>
        <span className={`text-sm font-bold ${color}`}>{score}/100</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--app-surface-low)" }}>
        <div className={`h-full rounded-full transition-all ${bgColor}`} style={{ width: `${score}%` }} />
      </div>
      <div className="space-y-1.5">
        {checks.map((c) => (
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

// ── Main BlogEditor ────────────────────────────────────────────────────────────
export default function BlogEditor() {
  const navigate  = useNavigate();
  const { id }    = useParams(); // present when editing
  const isEdit    = !!id;
  const editorRef = useRef(null);

  // ── Post state ──
  const [title,           setTitle]           = useState("");
  const [blocks,          setBlocks]          = useState([newBlock("paragraph")]);
  const [status,          setStatus]          = useState("draft");
  const [featuredImage,   setFeaturedImage]   = useState("");
  const [featuredImageAlt,setFeaturedImageAlt]= useState("");
  const [excerpt,         setExcerpt]         = useState("");
  const [slug,            setSlug]            = useState("");
  const [slugEdited,      setSlugEdited]      = useState(false);
  const [metaTitle,       setMetaTitle]       = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [focusKeyword,    setFocusKeyword]    = useState("");
  const [categoryId,      setCategoryId]      = useState("");
  const [tags,            setTags]            = useState([]);
  const [tagInput,        setTagInput]        = useState("");

  // ── UI state ──
  const [saving,          setSaving]          = useState(false);
  const [loading,         setLoading]         = useState(isEdit);
  const [categories,      setCategories]      = useState([]);
  const [showCatForm,     setShowCatForm]     = useState(false);
  const [newCatName,      setNewCatName]      = useState("");
  const [newCatColor,     setNewCatColor]     = useState("#f97316");
  const [addingBlock,     setAddingBlock]     = useState(null); // block id after which to add
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [publishMenu,     setPublishMenu]     = useState(false);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugEdited && title) {
      setSlug(
        title.toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80)
      );
    }
  }, [title, slugEdited]);

  // Load categories
  useEffect(() => {
    api.get("/blog/categories").then((r) => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  // Load post if editing
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api.get(`/blog/admin/posts/${id}`)
      .then((r) => {
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
        setMetaDescription(p.metaDescription || "");
        setFocusKeyword(p.focusKeyword || "");
        setCategoryId(p.category?._id || "");
        setTags(p.tags || []);
      })
      .catch(() => { toast.error("Failed to load post"); navigate("/super-admin/blog"); })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Block operations
  const updateBlock = useCallback((updated) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  const addBlockAfter = useCallback((afterId, type = null) => {
    if (!type) {
      setAddingBlock(afterId);
      setShowBlockPicker(true);
      return;
    }
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock(type));
      return next;
    });
  }, []);

  const deleteBlock = useCallback((id) => {
    setBlocks((prev) => {
      if (prev.length === 1) return [newBlock("paragraph")];
      return prev.filter((b) => b.id !== id);
    });
  }, []);

  const moveBlock = useCallback((id, dir) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if ((dir === "up" && idx === 0) || (dir === "down" && idx === prev.length - 1)) return prev;
      const next = [...prev];
      const other = idx + (dir === "up" ? -1 : 1);
      [next[idx], next[other]] = [next[other], next[idx]];
      return next;
    });
  }, []);

  // Tags
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };
  const removeTag = (t) => setTags((prev) => prev.filter((x) => x !== t));

  // Create category
  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const r = await api.post("/blog/admin/categories", { name: newCatName.trim(), color: newCatColor });
      setCategories((prev) => [...prev, r.data.category]);
      setCategoryId(r.data.category._id);
      setNewCatName("");
      setShowCatForm(false);
      toast.success("Category created");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create category");
    }
  };

  // Save
  const save = async (overrideStatus) => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload = {
      title, slug, excerpt, blocks, featuredImage, featuredImageAlt,
      category: categoryId || null,
      tags, status: overrideStatus ?? status,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt,
      focusKeyword,
    };
    try {
      if (isEdit) {
        await api.put(`/blog/admin/posts/${id}`, payload);
        toast.success("Post updated");
        if (overrideStatus) setStatus(overrideStatus);
      } else {
        const r = await api.post("/blog/admin/posts", payload);
        toast.success(overrideStatus === "published" ? "Post published! 🎉" : "Draft saved");
        navigate(`/super-admin/blog/${r.data.post._id}/edit`, { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save post");
    } finally {
      setSaving(false);
      setPublishMenu(false);
    }
  };

  if (loading) {
    return (
      <div className="stitch-page">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      {/* ── Top bar ── */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-4 lg:px-6 py-3 border-b"
        style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
      >
        <button
          onClick={() => navigate("/super-admin/blog")}
          className="p-2 rounded-xl hover:bg-orange-500/10 text-app-soft hover:text-orange-500 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-app truncate max-w-[200px]">
            {title || "Untitled post"}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            status === "published"
              ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
          }`}>
            {status === "published" ? "Published" : "Draft"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Preview */}
          {status === "published" && slug && (
            <a
              href={`/blog/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-app-soft hover:text-orange-500 transition border"
              style={{ borderColor: "var(--app-border)" }}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Preview
            </a>
          )}

          {/* Save draft */}
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save Draft"}
          </button>

          {/* Publish button */}
          <div className="relative">
            <div className="flex rounded-xl overflow-hidden">
              <button
                onClick={() => save("published")}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition"
              >
                <Globe className="w-3.5 h-3.5" />
                {status === "published" ? "Update" : "Publish"}
              </button>
              <button
                onClick={() => setPublishMenu((v) => !v)}
                className="px-2 py-1.5 bg-orange-500 hover:bg-orange-600 text-white border-l border-orange-600 transition"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {publishMenu && (
              <div
                className="absolute right-0 top-10 rounded-xl shadow-xl overflow-hidden w-40 z-50"
                style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
              >
                <button
                  onClick={() => save("published")}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition"
                >
                  ✓ Publish Now
                </button>
                <button
                  onClick={() => save("draft")}
                  className="w-full px-4 py-2.5 text-left text-xs text-app-soft hover:bg-orange-500/5 transition"
                >
                  Save as Draft
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Editor area ── */}
        <div ref={editorRef} className="flex-1 overflow-y-auto">
          <FormatBar targetRef={editorRef} />

          <div className="max-w-3xl mx-auto px-6 py-10">
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title…"
              className="w-full text-4xl font-extrabold text-app bg-transparent outline-none placeholder:text-app-soft/40 mb-2 leading-tight"
            />

            {/* Slug */}
            <div className="flex items-center gap-2 mb-8">
              <span className="text-xs text-app-soft">arthaleads.com/blog/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); }}
                className="text-xs text-orange-500 bg-transparent outline-none border-b border-dashed border-orange-300 focus:border-orange-500 py-0.5 min-w-[80px]"
                placeholder="post-url-slug"
              />
            </div>

            {/* Blocks */}
            <div className="space-y-6">
              {blocks.map((block, idx) => (
                <Block
                  key={block.id}
                  block={block}
                  onChange={updateBlock}
                  onDelete={deleteBlock}
                  onAddAfter={(blockId, type) => {
                    if (type) addBlockAfter(blockId, type);
                    else { setAddingBlock(blockId); setShowBlockPicker(true); }
                  }}
                  onMoveUp={(id)   => moveBlock(id, "up")}
                  onMoveDown={(id) => moveBlock(id, "down")}
                  isFirst={idx === 0}
                  isLast={idx === blocks.length - 1}
                />
              ))}
            </div>

            {/* Add first / bottom block */}
            <div className="mt-8 pt-4 border-t border-dashed" style={{ borderColor: "var(--app-border)" }}>
              <div className="relative">
                <button
                  onClick={() => { setAddingBlock(blocks[blocks.length - 1]?.id); setShowBlockPicker(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-app-soft hover:text-orange-500 hover:bg-orange-500/5 border border-dashed transition w-full justify-center"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <Plus className="w-4 h-4" /> Add Block
                </button>

                {showBlockPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBlockPicker(false)} />
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
                      <BlockPicker
                        onSelect={(type) => {
                          if (addingBlock) {
                            addBlockAfter(addingBlock, type);
                          } else {
                            setBlocks((prev) => [...prev, newBlock(type)]);
                          }
                          setShowBlockPicker(false);
                          setAddingBlock(null);
                        }}
                        onClose={() => { setShowBlockPicker(false); setAddingBlock(null); }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div
          className="w-80 flex-shrink-0 border-l overflow-y-auto"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}
        >
          <div className="p-4 space-y-6">

            {/* Status */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-3">Status</h3>
              <div className="flex gap-2">
                {["draft", "published"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition border ${
                      status === s
                        ? s === "published"
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-amber-500 text-white border-amber-500"
                        : "border-app-border text-app-soft hover:border-orange-400"
                    }`}
                    style={status !== s ? { borderColor: "var(--app-border)" } : {}}
                  >{s}</button>
                ))}
              </div>
            </section>

            <div className="border-t" style={{ borderColor: "var(--app-border)" }} />

            {/* Category */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-3">Category</h3>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input w-full text-sm mb-2"
              >
                <option value="">— Uncategorized —</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>

              {!showCatForm ? (
                <button
                  onClick={() => setShowCatForm(true)}
                  className="text-xs text-orange-500 hover:underline"
                >+ New category</button>
              ) : (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--app-border)" }}>
                  <input
                    autoFocus
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createCategory()}
                    className="input w-full text-xs"
                    placeholder="Category name"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border cursor-pointer"
                      style={{ borderColor: "var(--app-border)" }}
                    />
                    <span className="text-[10px] text-app-soft">Badge color</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createCategory} className="flex-1 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition">Create</button>
                    <button onClick={() => setShowCatForm(false)} className="flex-1 py-1.5 rounded-lg text-xs text-app-soft hover:bg-black/5 transition">Cancel</button>
                  </div>
                </div>
              )}
            </section>

            <div className="border-t" style={{ borderColor: "var(--app-border)" }} />

            {/* Tags */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-3">Tags</h3>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                  className="input flex-1 text-xs"
                  placeholder="Add tag, press Enter"
                />
                <button onClick={addTag} className="px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-lg text-xs font-semibold hover:bg-orange-500/20 transition">Add</button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-red-500 transition"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            <div className="border-t" style={{ borderColor: "var(--app-border)" }} />

            {/* Featured Image */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-3">Featured Image</h3>
              <input
                type="url"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                className="input w-full text-xs mb-2"
                placeholder="https://example.com/image.jpg"
              />
              {featuredImage && (
                <div className="rounded-xl overflow-hidden mb-2 border" style={{ borderColor: "var(--app-border)" }}>
                  <img src={featuredImage} alt="" className="w-full h-32 object-cover" onError={(e) => { e.target.style.display = "none"; }} />
                </div>
              )}
              {featuredImage && (
                <input
                  type="text"
                  value={featuredImageAlt}
                  onChange={(e) => setFeaturedImageAlt(e.target.value)}
                  className="input w-full text-xs"
                  placeholder="Alt text for image (SEO)"
                />
              )}
            </section>

            <div className="border-t" style={{ borderColor: "var(--app-border)" }} />

            {/* Excerpt */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-3">Excerpt</h3>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value.slice(0, 500))}
                rows={3}
                className="input w-full text-xs resize-none"
                placeholder="Short summary shown in blog listing…"
              />
              <p className="text-[10px] text-app-soft mt-1 text-right">{excerpt.length}/500</p>
            </section>

            <div className="border-t" style={{ borderColor: "var(--app-border)" }} />

            {/* SEO */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-soft mb-3">SEO Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-app-soft mb-1 block">Focus Keyword</label>
                  <input
                    type="text"
                    value={focusKeyword}
                    onChange={(e) => setFocusKeyword(e.target.value)}
                    className="input w-full text-xs"
                    placeholder="e.g. real estate CRM India"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-app-soft mb-1 flex items-center justify-between">
                    <span>Meta Title</span>
                    <span className={`text-[10px] ${metaTitle.length > 70 ? "text-red-400" : "text-app-soft"}`}>{metaTitle.length}/70</span>
                  </label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value.slice(0, 70))}
                    className="input w-full text-xs"
                    placeholder="SEO title (defaults to post title)"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-app-soft mb-1 flex items-center justify-between">
                    <span>Meta Description</span>
                    <span className={`text-[10px] ${metaDescription.length > 160 ? "text-red-400" : "text-app-soft"}`}>{metaDescription.length}/160</span>
                  </label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
                    rows={3}
                    className="input w-full text-xs resize-none"
                    placeholder="Shown in Google search results…"
                  />
                </div>
              </div>

              {/* Google preview */}
              {(metaTitle || title) && (
                <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                  <p className="text-[10px] text-app-soft uppercase tracking-wide mb-2">Google Preview</p>
                  <p className="text-[13px] text-blue-600 dark:text-blue-400 font-medium leading-snug line-clamp-2">{metaTitle || title}</p>
                  <p className="text-[11px] text-green-700 dark:text-green-400 mt-0.5">arthaleads.com › blog › {slug || "post-slug"}</p>
                  <p className="text-[11px] text-app-soft mt-1 line-clamp-2">{metaDescription || excerpt || "No description set"}</p>
                </div>
              )}
            </section>

            <div className="border-t" style={{ borderColor: "var(--app-border)" }} />

            {/* SEO score */}
            <section>
              <SeoScore
                title={title}
                metaTitle={metaTitle}
                metaDescription={metaDescription}
                focusKeyword={focusKeyword}
                blocks={blocks}
                featuredImage={featuredImage}
              />
            </section>

          </div>
        </div>
      </div>

      {/* Placeholder CSS for contenteditable */}
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--app-text-soft);
          opacity: 0.4;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
