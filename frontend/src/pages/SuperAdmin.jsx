// pages/SuperAdmin.jsx - Saurabh's platform-level dashboard
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader, Spinner } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import { Building2, Users, BarChart3, Upload, CheckCircle2, XCircle, Image as ImageIcon, RefreshCw, Clock, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Phone, Mail, Shield } from "lucide-react";

function PlanBadge({ plan }) {
  const cls = {
    trial:      "bg-yellow-500/10 text-yellow-600 border-yellow-500/25",
    starter:    "bg-blue-500/10 text-blue-600 border-blue-500/25",
    pro:        "bg-violet-500/10 text-violet-600 border-violet-500/25",
    enterprise: "bg-orange-500/10 text-orange-600 border-orange-500/25",
  }[plan] || "bg-gray-500/10 text-gray-500 border-gray-500/25";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {plan}
    </span>
  );
}

// ── PlanSwitcher ───────────────────────────────────────────────────────────────
// Lets super admin toggle an org's plan between trial / pro / enterprise inline.
function PlanSwitcher({ org, onUpdated }) {
  const PLANS = ["trial", "pro", "enterprise"];
  const [saving, setSaving] = useState(false);

  const switchPlan = async (newPlan) => {
    if (newPlan === org.plan) return;
    if (!window.confirm(`Switch "${org.name}" from ${org.plan.toUpperCase()} → ${newPlan.toUpperCase()}?`)) return;
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
    <div className="flex items-center gap-1">
      {saving ? (
        <span className="text-[10px] text-app-soft animate-pulse">Saving…</span>
      ) : (
        PLANS.map((p) => {
          const active = p === org.plan;
          const cls = {
            trial:      active ? "bg-yellow-500 text-white border-yellow-500" : "text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/10",
            pro:        active ? "bg-violet-600 text-white border-violet-600" : "text-violet-600 border-violet-500/30 hover:bg-violet-500/10",
            enterprise: active ? "bg-orange-500 text-white border-orange-500" : "text-orange-600 border-orange-500/30 hover:bg-orange-500/10",
          }[p];
          return (
            <button
              key={p}
              onClick={() => switchPlan(p)}
              className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide transition ${cls}`}
            >{p === "enterprise" ? "Ent." : p}</button>
          );
        })
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
          <img src={preview} alt="logo" className="max-w-full max-h-full object-contain p-1" />
        ) : (
          <ImageIcon className="w-5 h-5 text-app-soft" />
        )}
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
  if (!d) return <span className="text-app-soft">—</span>;
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
function UsersPanel() {
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
                    ) : <span className="text-app-soft text-xs">—</span>}
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>
                    {u.orgId ? (
                      <div>
                        <p className="text-xs font-semibold text-app">{u.orgId.name}</p>
                        <p className="text-[10px] text-app-soft">{u.orgId.slug}</p>
                      </div>
                    ) : <span className="text-app-soft text-xs">—</span>}
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
  useEffect(() => { document.title = "Super Admin - Arthaleads"; }, []);
  const { user } = useAuth();

  const [tab, setTab]         = useState("orgs"); // "orgs" | "users"
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

  const totalUsers = orgs.reduce((s, o) => s + (o.userCount || 0), 0);
  const totalLeads = orgs.reduce((s, o) => s + (o.leadCount || 0), 0);
  // Active = isActive AND not trial-expired
  const activeOrgs = orgs.filter((o) => o.isActive && !o.trialExpired).length;

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #a04100, #ff6b00)" }}>
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app">Super Admin</h1>
            <p className="text-xs text-app-soft">Platform-level management · Logged in as <span className="font-semibold text-orange-500">{user?.name}</span></p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MigrateLogosButton />
            <button onClick={load} className="btn-secondary gap-1.5 text-xs px-3 py-2">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Organizations", value: total,      icon: Building2,  color: "text-orange-500" },
          { label: "Active Orgs",          value: activeOrgs, icon: CheckCircle2, color: "text-green-500" },
          { label: "Total Users",          value: totalUsers, icon: Users,      color: "text-blue-500" },
          { label: "Total Leads",          value: totalLeads, icon: BarChart3,  color: "text-violet-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <p className="stitch-kicker mb-1">{label}</p>
            <div className="flex items-end justify-between">
              <p className={`text-3xl font-black ${color}`}>{value}</p>
              <Icon className={`w-6 h-6 opacity-30 ${color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-2xl mb-4 w-fit" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
        {[
          { key: "orgs",  label: "Organizations", icon: Building2 },
          { key: "users", label: "Users",          icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === key ? "bg-orange-500 text-white shadow-sm" : "text-app-soft hover:text-app"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Orgs tab ── */}
      {tab === "orgs" && (
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
                  <th>Plan</th>
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
                        <div>
                          <p className="font-semibold text-sm text-app">{org.name}</p>
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

      {/* ── Users tab ── */}
      {tab === "users" && <UsersPanel />}
    </div>
  );
}
