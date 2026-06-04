// pages/SuperAdmin.jsx - Saurabh's platform-level dashboard
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader, Spinner } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  Building2, Users, BarChart3, Upload, CheckCircle2, XCircle, Image as ImageIcon,
  RefreshCw, Clock, CalendarClock, ChevronDown, ChevronLeft, ChevronRight,
  Phone, Mail, Shield, TicketIcon, AlertCircle, X, Save, Inbox,
  Send, Paperclip, FileText, Loader2,
} from "lucide-react";

function PlanBadge({ plan }) {
  const cls = {
    trial:      "bg-yellow-500/10 text-yellow-600 border-yellow-500/25",
    starter:    "bg-blue-500/10 text-blue-600 border-blue-500/25",
    growth:     "bg-violet-500/10 text-violet-600 border-violet-500/25",
    pro:        "bg-violet-500/10 text-violet-600 border-violet-500/25",
    enterprise: "bg-orange-500/10 text-orange-600 border-orange-500/25",
  }[plan] || "bg-gray-500/10 text-gray-500 border-gray-500/25";
  const label = plan === "pro" ? "growth" : plan;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// ── PlanSwitcher ───────────────────────────────────────────────────────────────
// Lets super admin toggle an org's plan between trial / starter / growth / enterprise.
function PlanSwitcher({ org, onUpdated }) {
  const PLANS = [
    { id: "trial",      label: "Trial",   activeClr: "bg-yellow-500 text-white border-yellow-500",   inactiveClr: "text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/10" },
    { id: "starter",    label: "Starter", activeClr: "bg-blue-500 text-white border-blue-500",        inactiveClr: "text-blue-600 border-blue-500/30 hover:bg-blue-500/10" },
    { id: "growth",     label: "Growth",  activeClr: "bg-violet-600 text-white border-violet-600",    inactiveClr: "text-violet-600 border-violet-500/30 hover:bg-violet-500/10" },
    { id: "enterprise", label: "Ent.",    activeClr: "bg-orange-500 text-white border-orange-500",    inactiveClr: "text-orange-600 border-orange-500/30 hover:bg-orange-500/10" },
  ];
  const [saving, setSaving] = useState(false);

  // treat legacy "pro" as "growth" for active highlight
  const currentPlan = org.plan === "pro" ? "growth" : org.plan;

  const switchPlan = async (newPlan) => {
    if (newPlan === currentPlan) return;
    if (!window.confirm(`Switch "${org.name}" → ${newPlan.toUpperCase()}?`)) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}`, { plan: newPlan });
      onUpdated(data.org);
      toast.success(`Plan switched to ${newPlan}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to switch plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {saving ? (
        <span className="text-[10px] text-app-soft animate-pulse">Saving…</span>
      ) : (
        PLANS.map(({ id, label, activeClr, inactiveClr }) => {
          const active = id === currentPlan;
          return (
            <button
              key={id}
              onClick={() => switchPlan(id)}
              className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide transition cursor-pointer ${active ? activeClr : inactiveClr}`}
            >{label}</button>
          );
        })
      )}
    </div>
  );
}

// ── OrgNameEditor ─────────────────────────────────────────────────────────────
function OrgNameEditor({ org, onUpdated, isTrialExpired }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(org.name);
  const [saving, setSaving]   = useState(false);
  const inputRef              = useRef(null);

  const open = () => { setName(org.name); setEditing(true); setTimeout(() => inputRef.current?.select(), 30); };
  const cancel = () => { setEditing(false); setName(org.name); };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === org.name) { cancel(); return; }
    setSaving(true);
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}`, { name: trimmed });
      onUpdated(data.org);
      toast.success("Organisation name updated");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update name");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-w-[160px]">
      {editing ? (
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
            className="text-sm font-semibold text-app bg-transparent border-b-2 border-[#ff6b00] outline-none w-full pb-0.5"
            disabled={saving}
            autoFocus
          />
          <div className="flex items-center gap-2 mt-0.5">
            <button onClick={save} disabled={saving}
              className="text-[10px] font-bold text-[#ff6b00] hover:text-[#e05f00] transition disabled:opacity-50 cursor-pointer">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} disabled={saving}
              className="text-[10px] text-app-soft hover:text-app transition cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="group flex items-start gap-1">
          <div>
            <p className="font-semibold text-sm text-app leading-snug">{org.name}</p>
            <p className="text-[10px] text-app-soft">{org.slug}</p>
            <p className="text-[10px] text-app-soft">{new Date(org.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            {org.plan === "trial" && org.trialEndsAt && (
              <p className={`text-[10px] mt-0.5 font-semibold ${isTrialExpired ? "text-red-500" : "text-amber-500"}`}>
                {isTrialExpired
                  ? `Expired ${new Date(org.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                  : `Trial ends ${new Date(org.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
              </p>
            )}
          </div>
          <button onClick={open}
            className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer flex-shrink-0"
            title="Edit organisation name">
            <Save className="w-3 h-3 text-app-soft" style={{ display: "none" }} />
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-app-soft">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Compress + normalise any image format to a compact JPEG data-URI ─────────
// Resizes to max 400px on the longest side, exports as JPEG quality 0.88.
// This converts WebP / HEIC-alike / PNG / GIF → JPEG before upload,
// keeping MongoDB documents small and bypassing any server-side format quirks.
function compressImage(dataUri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 400;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h / w) * MAX); w = MAX; }
        else        { w = Math.round((w / h) * MAX); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      // Fill white background so transparent PNGs don't go black in JPEG
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => resolve(null); // resolve null so callers can fallback gracefully
    img.src = dataUri;
  });
}

// ── Extract dominant vibrant colour from a base64 image via Canvas ────────────
function extractDominantColor(dataUri) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Downsample to 40×40 for speed - enough colour resolution
        const SIZE = 40;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        // Score each pixel: skip transparent, near-white, near-black, near-gray
        const freq = {};
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 100) continue;                  // transparent
          const brightness = (r + g + b) / 3;
          if (brightness > 230) continue;         // near-white
          if (brightness < 25)  continue;         // near-black

          // Saturation: max-min distance; skip grays (low saturation)
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.25) continue;               // near-gray / desaturated

          // Quantise to 24-step buckets (10px resolution) for grouping
          const qr = Math.round(r / 24) * 24;
          const qg = Math.round(g / 24) * 24;
          const qb = Math.round(b / 24) * 24;
          const key = `${qr},${qg},${qb}`;
          // Weight by saturation so more vibrant colours win
          freq[key] = (freq[key] || 0) + sat;
        }

        if (!Object.keys(freq).length) { resolve(null); return; }

        const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
        const [r, g, b] = best.split(",").map(Number);
        const toHex = (n) => Math.min(255, n).toString(16).padStart(2, "0");
        resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUri;
  });
}

function LogoUploader({ org, onUpdated }) {
  const inputRef  = useRef(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(org.logo || "");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after an error
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Only image files are supported");
    if (file.size > 10 * 1024 * 1024) return toast.error("Logo must be under 10 MB");

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawDataUri = ev.target.result;
      setLoading(true);
      try {
        // Compress + convert to JPEG (handles WebP, PNG, GIF, etc.)
        // compressImage resolves null if the image can't be loaded - fall back to raw
        const compressed = await compressImage(rawDataUri);
        const dataUri = compressed || rawDataUri;
        setPreview(dataUri);

        // Upload compressed logo
        const { data } = await api.patch(`/super-admin/orgs/${org._id}/logo`, { logo: dataUri });

        // Extract dominant colour from the logo and auto-apply as brand colour
        const dominant = await extractDominantColor(dataUri);
        if (dominant) {
          try {
            const { data: colorData } = await api.patch(`/super-admin/orgs/${org._id}`, { brandColor: dominant });
            onUpdated(colorData.org);
            toast.success(`Logo uploaded · Brand colour auto-set to ${dominant}`);
          } catch {
            // Colour update failed - still show logo success
            onUpdated(data.org);
            toast.success(`Logo updated for ${org.name}`);
          }
        } else {
          onUpdated(data.org);
          toast.success(`Logo updated for ${org.name}`);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || "Upload failed");
        setPreview(org.logo || "");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove logo for ${org.name}?`)) return;
    setLoading(true);
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}/logo`, { logo: "" });
      setPreview("");
      onUpdated(data.org);
      toast.success("Logo removed");
    } catch (err) {
      toast.error("Failed to remove logo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Logo preview / placeholder */}
      <div
        className="w-12 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer border transition hover:border-orange-400/60"
        style={{ background: "var(--app-surface-low)", borderColor: "var(--app-border)" }}
        onClick={() => inputRef.current?.click()}
        title="Click to upload logo"
      >
        {loading ? (
          <Spinner size="sm" />
        ) : preview ? (
          <img
            src={preview}
            alt=""
            className="max-w-full max-h-full object-contain p-1"
            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
          />
        ) : null}
        <ImageIcon className="w-5 h-5 text-app-soft" style={{ display: preview ? "none" : "block" }} />
      </div>

      <div className="flex flex-col gap-1">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-400 transition disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {preview ? "Change" : "Upload logo"}
        </button>
        {preview && (
          <button
            onClick={handleRemove}
            disabled={loading}
            className="text-[10px] text-app-soft hover:text-red-500 transition"
          >
            Remove
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function BrandColorPicker({ org, onUpdated }) {
  const original = org.brandColor || "";
  const [hex, setHex]       = useState(original);
  const [saving, setSaving] = useState(false);

  const isValidHex = (v) => /^#[0-9A-Fa-f]{6}$/.test(v);
  const textValid  = hex === "" || isValidHex(hex);
  const isDirty    = hex !== original;
  const canSave    = isDirty && textValid;

  // Keep input in sync if parent passes a new org prop (after external update)
  useEffect(() => { setHex(org.brandColor || ""); }, [org.brandColor]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}`, { brandColor: hex });
      onUpdated(data.org);
      toast.success(hex ? `Brand colour applied to ${org.name}` : `Brand colour cleared for ${org.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update colour");
      setHex(original); // revert on error
    } finally {
      setSaving(false);
    }
  };

  // Swatch colour - what to show in the circle preview
  const swatchColor = isValidHex(hex) ? hex : (isValidHex(original) ? original : "#ff6b00");

  return (
    <div className="flex items-center gap-2.5">
      {/* Colour swatch - clicking opens the native OS colour picker */}
      <label className="relative flex-shrink-0 cursor-pointer" title="Click to open colour picker">
        <input
          type="color"
          value={swatchColor}
          onChange={(e) => setHex(e.target.value.toLowerCase())}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-xl"
        />
        <span
          className="w-8 h-8 rounded-xl border-2 block transition-transform hover:scale-110"
          style={{
            background: swatchColor,
            borderColor: "var(--app-border-strong)",
            boxShadow: `0 0 8px ${swatchColor}55`,
          }}
        />
      </label>

      {/* Hex input + action */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <input
          value={hex}
          onChange={(e) => {
            let v = e.target.value.toLowerCase().replace(/[^#0-9a-f]/g, "");
            if (v && !v.startsWith("#")) v = `#${v}`;
            setHex(v.slice(0, 7));
          }}
          onBlur={() => { if (!textValid && hex !== "") setHex(original); }}
          placeholder="#ff6b00"
          maxLength={7}
          style={{
            width: "5.5rem",
            borderRadius: "0.5rem",
            padding: "3px 8px",
            fontSize: "11px",
            fontFamily: "monospace",
            background: "var(--app-surface-low)",
            border: `1px solid ${!textValid ? "#ef4444" : "var(--app-border)"}`,
            color: "var(--app-text)",
            outline: "none",
          }}
        />
        <div className="h-4 flex items-center">
          {canSave ? (
            <button
              onClick={save}
              disabled={saving}
              className="text-[10px] font-bold text-orange-500 hover:text-orange-400 disabled:opacity-40 transition leading-none"
            >
              {saving ? "Saving…" : hex ? "Apply →" : "Clear →"}
            </button>
          ) : original && !isDirty ? (
            <button
              onClick={() => { setHex(""); }}
              className="text-[10px] text-app-soft hover:text-red-400 transition leading-none"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── TrialExtender ─────────────────────────────────────────────────────────────
// Dropdown with preset durations + "Other" custom-date picker.
// Rendered via a portal so it isn't clipped by the table's overflow container.
function TrialExtender({ org, onUpdated }) {
  const PRESETS = [
    { label: "7 days",   days: 7 },
    { label: "14 days",  days: 14 },
    { label: "1 month",  days: 30 },
    { label: "3 months", days: 90 },
    { label: "Other…",   days: null },
  ];

  const [open,   setOpen]   = useState(false);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef  = useRef(null);
  const dropRef = useRef(null);

  // Position the portal dropdown below the button
  const openDropdown = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setDropPos({
        top:  rect.bottom + window.scrollY + 6,
        left: rect.left   + window.scrollX,
      });
    }
    setOpen((v) => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const extend = async (days) => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}/extend-trial`, { days });
      onUpdated(data.org);
      toast.success(data.message);
      setOpen(false);
      setCustom("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to extend trial");
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSubmit = () => {
    if (!custom) return toast.error("Pick a date first");
    const target = new Date(custom);
    target.setHours(23, 59, 59, 999);
    const days = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 1) return toast.error("Date must be in the future");
    extend(days);
  };

  const minDate    = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const expiryLabel = org.trialEndsAt
    ? new Date(org.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "-";

  return (
    <>
      <button
        ref={btnRef}
        onClick={openDropdown}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold border transition whitespace-nowrap"
        style={{
          background:   "rgba(234,88,12,0.06)",
          borderColor:  "rgba(234,88,12,0.25)",
          color:        "#ea580c",
        }}
        title={`Current expiry: ${expiryLabel}`}
      >
        {saving ? <Spinner size="sm" /> : <CalendarClock className="w-3 h-3" />}
        Extend Trial
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            position:    "absolute",
            top:         dropPos.top,
            left:        dropPos.left,
            width:       220,
            zIndex:      9999,
            background:  "var(--app-surface)",
            border:      "1px solid var(--app-border)",
            boxShadow:   "0 8px 32px rgba(0,0,0,0.22)",
          }}
        >
          {/* Expiry hint */}
          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-app-soft">
            Expires: {expiryLabel}
          </p>
          <div className="mx-4 mb-1 border-t" style={{ borderColor: "var(--app-border)" }} />

          {PRESETS.map((p) =>
            p.days ? (
              <button
                key={p.label}
                onClick={() => extend(p.days)}
                disabled={saving}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-app hover:bg-orange-500/5 transition disabled:opacity-40"
              >
                <Clock className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                {p.label}
              </button>
            ) : (
              <div key="other" className="px-4 py-3 space-y-2 border-t" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-[11px] font-semibold text-app-soft">Custom end date</p>
                <input
                  type="date"
                  min={minDate}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="input w-full text-xs py-1.5 px-2"
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!custom || saving}
                  className="w-full btn-primary text-xs py-1.5 rounded-xl disabled:opacity-40"
                >
                  {saving ? "Extending…" : "Apply custom date"}
                </button>
              </div>
            )
          )}
        </div>,
        document.body
      )}
    </>
  );
}

const ROLE_COLORS = {
  admin:   "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  agent:   "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ROLE_COLORS[role] || "bg-gray-100 text-gray-500"}`}>
      <Shield className="w-2.5 h-2.5" />
      {role}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return <span className="text-app-soft">-</span>;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return <span className="text-app-soft">Never</span>;
  return (
    <span title={new Date(d).toLocaleString("en-IN")}>
      {new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      <span className="text-app-soft ml-1 text-[10px]">
        {new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </span>
  );
}

// ── Users panel ───────────────────────────────────────────────────────────────
export function UsersPanel() {
  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [inputVal, setInputVal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search) params.set("search", search);
      const { data } = await api.get(`/super-admin/users?${params}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setSearch(inputVal); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [inputVal]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "var(--app-border)" }}>
        <h2 className="font-bold text-app flex-1">All Users <span className="text-app-soft font-normal text-sm">({total})</span></h2>
        <input
          className="input text-xs px-3 py-2 w-52"
          placeholder="Search name, email, phone…"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <button onClick={load} className="btn-secondary gap-1.5 text-xs px-3 py-2">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="stitch-table min-w-[860px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Organization</th>
                <th>Last Login</th>
                <th>Signed Up</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-app-soft text-sm">No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-8 h-8 rounded-xl object-cover border flex-shrink-0"
                          style={{ borderColor: "var(--app-border)" }}
                          onError={(e) => {
                            // If image fails to load, swap to letter initial
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="w-8 h-8 rounded-xl items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #a04100, #ff6b00)",
                          display: u.avatar ? "none" : "flex",
                        }}
                      >
                        {u.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="font-semibold text-app text-sm">{u.name}</span>
                    </div>
                  </td>
                  <td>
                    <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {u.email}
                    </a>
                  </td>
                  <td>
                    {u.phone ? (
                      <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 text-xs text-app hover:text-orange-500 transition">
                        <Phone className="w-3 h-3 text-app-soft flex-shrink-0" />
                        {u.phone}
                      </a>
                    ) : <span className="text-app-soft text-xs">-</span>}
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>
                    {u.orgId ? (
                      <div>
                        <p className="text-xs font-semibold text-app">{u.orgId.name}</p>
                        <p className="text-[10px] text-app-soft">{u.orgId.slug}</p>
                      </div>
                    ) : <span className="text-app-soft text-xs">-</span>}
                  </td>
                  <td className="text-xs">{fmtDateTime(u.lastLogin)}</td>
                  <td className="text-xs text-app-soft">{fmtDate(u.createdAt)}</td>
                  <td className="text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      u.isActive
                        ? "bg-green-500/10 text-green-600 border-green-500/25"
                        : "bg-red-500/10 text-red-500 border-red-500/25"
                    }`}>
                      {u.isActive ? <><CheckCircle2 className="w-2.5 h-2.5" /> Active</> : <><XCircle className="w-2.5 h-2.5" /> Inactive</>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
          <p className="text-xs text-app-soft">Page {page} of {pages} · {total} users</p>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
              disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft className="w-4 h-4 text-app" />
            </button>
            <span className="text-xs font-semibold text-app px-2">{page}</span>
            <button className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
              disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
              <ChevronRight className="w-4 h-4 text-app" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tickets Panel ────────────────────────────────────────────────────────────

const TICKET_STATUSES = [
  { value: "all",         label: "All",         cls: "" },
  { value: "open",        label: "Open",        cls: "bg-blue-500/10 text-blue-600 border-blue-500/25" },
  { value: "in-progress", label: "In Progress", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/25" },
  { value: "resolved",    label: "Resolved",    cls: "bg-green-500/10 text-green-600 border-green-500/25" },
  { value: "closed",      label: "Closed",      cls: "bg-gray-500/10 text-gray-500 border-gray-500/25" },
];

const TICKET_PRIORITY_COLORS = {
  low:    "bg-gray-500/10 text-gray-500",
  medium: "bg-blue-500/10 text-blue-600",
  high:   "bg-orange-500/10 text-orange-600",
  urgent: "bg-red-500/10 text-red-600",
};

function TicketStatusBadge({ status }) {
  const s = TICKET_STATUSES.find(t => t.value === status) || TICKET_STATUSES[1];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.cls || "bg-gray-500/10 text-gray-500 border-gray-500/25"}`}>
      {s.label}
    </span>
  );
}

// ── Admin Attachment Picker (same logic as user-side) ─────────────────────────
function AdminAttachChip({ a }) {
  const ext = a.name?.split(".").pop()?.toLowerCase();
  const isImg = ["jpg","jpeg","png","gif","webp"].includes(ext);
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:opacity-80 transition"
      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
      {isImg
        ? <Image className="h-3.5 w-3.5" style={{ color: "var(--app-primary)" }} />
        : <FileText className="h-3.5 w-3.5 text-app-soft" />}
      <span className="text-app max-w-[120px] truncate">{a.name || "attachment"}</span>
    </a>
  );
}

function AdminAttachmentPicker({ attachments, onChange }) {
  const ref = useRef();
  const MAX = 3;
  const MAX_BYTES = 600 * 1024;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX - attachments.length;
    if (remaining <= 0) { toast.error("Maximum 3 attachments"); return; }
    const results = [];
    for (const f of files.slice(0, remaining)) {
      if (f.size > MAX_BYTES) { toast.error(`${f.name} too large (max 600 KB)`); continue; }
      const url = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(f);
      }).catch(() => null);
      if (url) results.push({ url, name: f.name, size: f.size });
    }
    if (results.length) onChange([...attachments, ...results]);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {attachments.map((a, i) => (
        <div key={i} className="flex items-center gap-1">
          <AdminAttachChip a={a} />
          <button type="button" onClick={() => onChange(attachments.filter((_, j) => j !== i))}
            className="text-app-soft hover:text-red-500 transition">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {attachments.length < MAX && (
        <>
          <input ref={ref} type="file" accept="image/*,.pdf,.txt,.doc,.docx" multiple className="hidden" onChange={handleFiles} />
          <button type="button" onClick={() => ref.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-app-soft hover:text-app transition"
            style={{ border: "1px dashed var(--app-border)" }}>
            <Paperclip className="h-3.5 w-3.5" /> Attach
          </button>
        </>
      )}
    </div>
  );
}

// ── Ticket Detail Modal ───────────────────────────────────────────────────────
function TicketDetailModal({ ticket: initialTicket, onClose, onUpdated }) {
  const [ticket,     setTicket]     = useState(initialTicket);
  const [status,     setStatus]     = useState(initialTicket.status);
  const [priority,   setPriority]   = useState(initialTicket.priority);
  const [adminNotes, setAdminNotes] = useState(initialTicket.adminNotes || "");
  const [saving,     setSaving]     = useState(false);
  const [replyBody,  setReplyBody]  = useState("");
  const [replyAtts,  setReplyAtts]  = useState([]);
  const [sending,    setSending]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const bottomRef = useRef();

  // Load full ticket (with replies) on open
  useEffect(() => {
    api.get(`/super-admin/tickets/${initialTicket._id}/thread`)
      .then(({ data }) => {
        setTicket(data.ticket);
        setStatus(data.ticket.status);
        setAdminNotes(data.ticket.adminNotes || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialTicket._id]);

  useEffect(() => {
    if (!loading) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [loading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/super-admin/tickets/${ticket._id}`, {
        status, priority, adminNotes,
      });
      setTicket(t => ({ ...t, ...data.ticket }));
      onUpdated(data.ticket);
      toast.success("Ticket updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/super-admin/tickets/${ticket._id}/reply`, {
        body: replyBody.trim(),
        attachments: replyAtts,
      });
      setTicket(data.ticket);
      setStatus(data.ticket.status);
      setReplyBody("");
      setReplyAtts([]);
      onUpdated(data.ticket);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const fmtFull = (iso) => iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "94vh", background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl flex-shrink-0"
              style={{ background: "rgba(var(--app-primary-rgb),0.10)" }}>
              <TicketIcon className="h-4 w-4" style={{ color: "var(--app-primary)" }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-black" style={{ color: "var(--app-primary)" }}>
                  {ticket.ticketNumber}
                </span>
                <TicketStatusBadge status={status} />
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TICKET_PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-500"}`}>
                  {priority}
                </span>
              </div>
              <p className="text-sm font-bold text-app mt-0.5 truncate">{ticket.subject}</p>
              <p className="text-[10px] text-app-soft mt-0.5">
                {ticket.orgName} · {ticket.userName} · {ticket.category?.replace("-", " ")} · {fmtFull(ticket.createdAt)}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 transition flex-shrink-0 ml-3">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left: conversation thread */}
          <div className="flex-1 flex flex-col min-w-0 border-r" style={{ borderColor: "var(--app-border)" }}>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-app-soft" />
                </div>
              ) : (
                <>
                  {/* Initial description */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-black"
                      style={{ background: "#64748b" }}>
                      {ticket.userName?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-bold text-app">{ticket.userName}</span>
                        <span className="text-[10px] text-app-soft">{ticket.userEmail}</span>
                        <span className="text-[10px] text-app-soft">{fmtFull(ticket.createdAt)}</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-app leading-relaxed whitespace-pre-wrap"
                        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                        {ticket.description}
                      </div>
                      {ticket.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {ticket.attachments.map((a, i) => <AdminAttachChip key={i} a={a} />)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Replies */}
                  {ticket.replies?.map((r, i) => (
                    <div key={i} className={`flex gap-3 ${!r.isAdmin ? "" : "flex-row-reverse"}`}>
                      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-black ${
                        r.isAdmin ? "text-white" : "bg-slate-200 dark:bg-slate-700 text-app"
                      }`} style={r.isAdmin ? { background: "var(--app-primary)" } : {}}>
                        {r.isAdmin ? "A" : (r.authorName?.[0]?.toUpperCase() || "U")}
                      </div>
                      <div className={`flex-1 min-w-0 ${r.isAdmin ? "flex flex-col items-end" : ""}`}>
                        <div className={`flex items-baseline gap-2 mb-1 ${r.isAdmin ? "flex-row-reverse" : ""}`}>
                          <span className="text-xs font-bold text-app">
                            {r.isAdmin ? "Support Team (Admin)" : r.authorName}
                          </span>
                          <span className="text-[10px] text-app-soft">{fmtFull(r.createdAt)}</span>
                        </div>
                        <div className={`inline-block max-w-full rounded-2xl px-4 py-3 text-sm text-app leading-relaxed whitespace-pre-wrap ${
                          r.isAdmin ? "rounded-tr-sm" : "rounded-tl-sm"
                        }`} style={{
                          background: r.isAdmin ? "rgba(var(--app-primary-rgb),0.09)" : "var(--app-surface-low)",
                          border: "1px solid var(--app-border)",
                        }}>
                          {r.body}
                        </div>
                        {r.attachments?.length > 0 && (
                          <div className={`flex flex-wrap gap-2 mt-2 ${r.isAdmin ? "justify-end" : ""}`}>
                            {r.attachments.map((a, j) => <AdminAttachChip key={j} a={a} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Admin reply box */}
            {!loading && ticket.status !== "closed" && (
              <div className="flex-shrink-0 border-t p-4 space-y-3" style={{ borderColor: "var(--app-border)" }}>
                <textarea
                  className="input w-full resize-none text-sm"
                  rows={3}
                  placeholder="Reply to this ticket… (visible to the customer)"
                  value={replyBody}
                  maxLength={3000}
                  onChange={e => setReplyBody(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply(); }}
                />
                <div className="flex items-center justify-between gap-3">
                  <AdminAttachmentPicker attachments={replyAtts} onChange={setReplyAtts} />
                  <button
                    onClick={handleReply}
                    disabled={sending || !replyBody.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                    style={{ background: "var(--app-primary)" }}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Reply
                  </button>
                </div>
                <p className="text-[10px] text-app-soft">Ctrl+Enter to send · Reply is visible to the customer</p>
              </div>
            )}
            {!loading && ticket.status === "closed" && (
              <div className="flex-shrink-0 border-t px-4 py-3 text-center" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs text-app-soft">Ticket is closed — update status to re-open for replies</p>
              </div>
            )}
          </div>

          {/* Right: admin controls */}
          <div className="w-72 flex-shrink-0 overflow-y-auto p-5 space-y-5">
            <div>
              <label className="block text-xs font-bold text-app-soft uppercase tracking-wide mb-1.5">Status</label>
              <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
                {TICKET_STATUSES.filter(s => s.value !== "all").map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-app-soft uppercase tracking-wide mb-1.5">Priority</label>
              <select className="input w-full" value={priority} onChange={e => setPriority(e.target.value)}>
                {["low", "medium", "high", "urgent"].map(p => (
                  <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-app-soft uppercase tracking-wide mb-1.5">
                Internal Notes
                <span className="ml-1 normal-case font-normal text-app-soft/70">(admin only)</span>
              </label>
              <textarea
                className="input w-full resize-none text-xs"
                rows={5}
                placeholder="Internal notes, investigation steps…"
                value={adminNotes}
                maxLength={2000}
                onChange={e => setAdminNotes(e.target.value)}
              />
              <p className="text-[10px] text-app-soft text-right mt-0.5">{adminNotes.length}/2000</p>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--app-primary)" }}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Changes</>}
            </button>

            {/* Metadata */}
            <div className="space-y-3 pt-1 border-t" style={{ borderColor: "var(--app-border)" }}>
              {[
                { label: "Organization", value: ticket.orgName },
                { label: "Submitted By", value: ticket.userName },
                { label: "Email", value: ticket.userEmail },
                { label: "Raised On", value: fmtFull(ticket.createdAt) },
                { label: "Category", value: ticket.category?.replace("-", " ") },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-app-soft uppercase tracking-wide">{label}</p>
                  <p className="text-xs text-app mt-0.5 break-all">{value || "-"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TicketsPanel ──────────────────────────────────────────────────────────────
export function TicketsPanel() {
  const [tickets,      setTickets]      = useState([]);
  const [total,        setTotal]        = useState(0);
  const [pages,        setPages]        = useState(1);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const [inputVal,     setInputVal]     = useState("");
  const [counts,       setCounts]       = useState({});
  const [selected,     setSelected]     = useState(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 50 });
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const { data } = await api.get(`/super-admin/tickets?${params}`);
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      if (data.statusCounts) setCounts(data.statusCounts);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { load(1); setPage(1); }, [statusFilter, search]);
  useEffect(() => { load(page); }, [page]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(inputVal), 400);
    return () => clearTimeout(t);
  }, [inputVal]);

  const handleUpdated = (updated) => {
    setTickets(prev => prev.map(t => t._id === updated._id ? { ...t, ...updated } : t));
    setCounts(c => {
      const nc = { ...c };
      const old = tickets.find(t => t._id === updated._id);
      if (old && old.status !== updated.status) {
        nc[old.status]     = Math.max(0, (nc[old.status] || 0) - 1);
        nc[updated.status] = (nc[updated.status] || 0) + 1;
      }
      return nc;
    });
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <div className="space-y-4">
      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={(t) => { handleUpdated(t); setSelected(null); }}
        />
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TICKET_STATUSES.map(({ value, label }) => {
          const count = value === "all" ? total : (counts[value] || 0);
          const active = statusFilter === value;
          return (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                active ? "text-white border-transparent shadow-sm" : "text-app-soft border-transparent hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={active ? { background: "var(--app-primary)" } : {}}
            >
              {label}
              <span className={`inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-black ${
                active ? "bg-white/20 text-white" : "bg-black/8 dark:bg-white/10 text-app-soft"
              }`}>{count}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <input
            className="input text-xs px-3 py-2 w-52"
            placeholder="Search tickets…"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <button onClick={() => load(page)} className="btn-secondary gap-1.5 text-xs px-3 py-2" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="h-12 w-12 text-app-soft/30 mb-3" />
            <p className="text-sm font-semibold text-app-soft">No tickets found</p>
            <p className="text-xs text-app-soft/60 mt-1">
              {statusFilter !== "all" ? `No ${statusFilter} tickets at the moment` : "No support tickets have been raised yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="stitch-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Organization</th>
                    <th>Raised By</th>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Raised On</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t._id} className="cursor-pointer" onClick={() => setSelected(t)}>
                      <td>
                        <span className="font-mono text-xs font-black" style={{ color: "var(--app-primary)" }}>
                          {t.ticketNumber}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs font-semibold text-app">{t.orgName}</p>
                      </td>
                      <td>
                        <div>
                          <p className="text-xs font-semibold text-app">{t.userName}</p>
                          <p className="text-[10px] text-app-soft">{t.userEmail}</p>
                        </div>
                      </td>
                      <td>
                        <p className="text-xs font-semibold text-app max-w-[180px] truncate">{t.subject}</p>
                        {t.adminNotes && (
                          <p className="text-[10px] text-app-soft truncate max-w-[180px] italic">Note: {t.adminNotes}</p>
                        )}
                      </td>
                      <td>
                        <span className="text-xs text-app-soft capitalize">{t.category?.replace("-", " ")}</span>
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TICKET_PRIORITY_COLORS[t.priority] || "bg-gray-100 text-gray-500"}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td><TicketStatusBadge status={t.status} /></td>
                      <td>
                        <span className="text-xs text-app-soft">{fmtDate(t.createdAt)}</span>
                      </td>
                      <td>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(t); }}
                          className="text-xs font-semibold transition hover:underline"
                          style={{ color: "var(--app-primary)" }}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs text-app-soft">Page {page} of {pages} · {total} tickets total</p>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                    disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-4 h-4 text-app" />
                  </button>
                  <span className="text-xs font-semibold text-app px-2">{page}</span>
                  <button className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                    disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                    <ChevronRight className="w-4 h-4 text-app" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── MigrateLogosButton ────────────────────────────────────────────────────────
// One-time action: uploads all base64 logos to Cloudinary so they persist
// across refreshes without bloating localStorage.
function MigrateLogosButton() {
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!window.confirm("Migrate all base64 org logos to Cloudinary? This is safe to run multiple times.")) return;
    setRunning(true);
    try {
      const { data } = await api.post("/super-admin/migrate-logos");
      toast.success(data.message);
      if (data.results?.length) {
        data.results.forEach((r) => {
          if (r.status === "failed") toast.error(`${r.org}: ${r.reason}`);
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Migration failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <button onClick={run} disabled={running} className="btn-secondary gap-1.5 text-xs px-3 py-2 disabled:opacity-50">
      {running ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Migrating…</> : <><Upload className="w-3.5 h-3.5" /> Migrate Logos</>}
    </button>
  );
}

export default function SuperAdmin() {
  useEffect(() => { document.title = "Organizations · Arthaleads Admin"; }, []);

  const [orgs, setOrgs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/super-admin/orgs");
      setOrgs(data.orgs);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOrgUpdated = (updated) => {
    setOrgs((prev) => prev.map((o) => o._id === updated._id ? { ...o, ...updated } : o));
  };

  const toggleActive = async (org) => {
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}`, { isActive: !org.isActive });
      handleOrgUpdated(data.org);
      toast.success(`${data.org.name} ${data.org.isActive ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Update failed");
    }
  };

  const filtered = orgs.filter((o) =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-black text-app">Organizations</h1>
            <p className="text-xs text-app-soft mt-0.5">{total} organisation{total !== 1 ? "s" : ""} on the platform</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MigrateLogosButton />
            <button onClick={load} className="btn-secondary gap-1.5 text-xs px-3 py-2">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Orgs table ── */}
      {(
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "var(--app-border)" }}>
            <h2 className="font-bold text-app flex-1">Organizations</h2>
            <input
              className="input text-xs px-3 py-2 w-48"
              placeholder="Search org…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="stitch-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th className="text-center">Users</th>
                  <th className="text-center">Leads</th>
                  <th>Logo</th>
                  <th>Brand Colour</th>
                  <th>Change Plan</th>
                  <th className="text-center">Status</th>
                  <th>Extend Trial</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-app-soft text-sm">No organizations found</td>
                  </tr>
                ) : filtered.map((org) => {
                  const isTrialExpired = !!org.trialExpired;
                  const effectivelyActive = org.isActive && !isTrialExpired;

                  return (
                    <tr key={org._id}>
                      <td>
                        <div className="space-y-1">
                          <OrgNameEditor org={org} onUpdated={handleOrgUpdated} isTrialExpired={isTrialExpired} />
                          <Link to={`/super-admin/orgs/${org._id}`}
                            className="text-[10px] font-semibold hover:underline"
                            style={{ color: "var(--app-primary)" }}>
                            View details →
                          </Link>
                        </div>
                      </td>
                      <td><PlanBadge plan={org.plan} /></td>
                      <td className="text-center font-bold text-app">{org.userCount}</td>
                      <td className="text-center font-bold text-app">{org.leadCount}</td>
                      <td>
                        <LogoUploader org={org} onUpdated={handleOrgUpdated} />
                      </td>
                      <td>
                        <BrandColorPicker org={org} onUpdated={handleOrgUpdated} />
                      </td>
                      <td>
                        <PlanSwitcher org={org} onUpdated={handleOrgUpdated} />
                      </td>
                      <td className="text-center">
                        {/* Trial Expired takes priority over Active/Inactive */}
                        {isTrialExpired ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border bg-amber-500/10 text-amber-600 border-amber-500/25">
                              <Clock className="w-3 h-3" /> Trial Expired
                            </span>
                            <button
                              onClick={() => toggleActive(org)}
                              className="text-[9px] text-app-soft hover:text-red-500 transition"
                              title="Click to deactivate org entirely"
                            >
                              Deactivate org
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleActive(org)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border transition ${
                              effectivelyActive
                                ? "bg-green-500/10 text-green-600 border-green-500/25 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/25"
                                : "bg-red-500/10 text-red-500 border-red-500/25 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/25"
                            }`}
                            title={effectivelyActive ? "Click to deactivate" : "Click to activate"}
                          >
                            {effectivelyActive
                              ? <><CheckCircle2 className="w-3 h-3" /> Active</>
                              : <><XCircle className="w-3 h-3" /> Inactive</>}
                          </button>
                        )}
                      </td>
                      <td>
                        {/* Only show for trial-plan orgs */}
                        {org.plan === "trial" ? (
                          <TrialExtender org={org} onUpdated={handleOrgUpdated} />
                        ) : (
                          <span className="text-xs text-app-soft">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
