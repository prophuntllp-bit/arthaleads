// components/ProjectForm.jsx
import { useEffect, useRef, useState } from "react";
import { Modal, Spinner } from "./UI";
import { ChevronDown, ImageOff, Plus, Search, Upload, X } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const BHK_OPTIONS = ["1BHK", "2BHK", "3BHK", "4BHK", "4BHK+", "Studio", "Duplex", "Penthouse"];

const AMENITY_OPTIONS = [
  "Swimming Pool", "Gymnasium", "Clubhouse", "24/7 Security", "CCTV Surveillance",
  "Covered Parking", "Visitor Parking", "Lift / Elevator", "Power Backup",
  "24/7 Water Supply", "Garden / Landscape", "Children's Play Area", "Sports Facility",
  "Jogging Track", "Intercom", "Fire Safety", "Rainwater Harvesting",
  "Solar Panels", "EV Charging", "Shopping Complex", "School Nearby",
  "Hospital Nearby", "Metro Connectivity", "Vastu Compliant",
];

const empty = {
  name: "", description: "", location: "",
  images: [], priceMin: "", priceMax: "",
  bhkTypes: [], area: "", amenities: [],
  possessionDate: "", reraNumber: "",
  assignedTo: [], // array of { _id, name } objects for display
};

function toForm(p) {
  if (!p) return { ...empty };
  return {
    name: p.name || "", description: p.description || "", location: p.location || "",
    images: p.images || [], priceMin: p.priceMin || "", priceMax: p.priceMax || "",
    bhkTypes: p.bhkTypes || [], area: p.area || "", amenities: p.amenities || [],
    possessionDate: p.possessionDate ? p.possessionDate.slice(0, 10) : "",
    reraNumber: p.reraNumber || "",
    // assignedTo from API is array of populated objects { _id, name, avatar } or IDs
    assignedTo: Array.isArray(p.assignedTo)
      ? p.assignedTo.map((m) => (typeof m === "object" ? { _id: m._id, name: m.name } : { _id: m, name: m }))
      : [],
  };
}

// Resize + compress uploaded image to a small base64 thumbnail
// Max 640px on longest side, JPEG quality 0.60 → each image ~25-50KB base64
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 640;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.60));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ProjectForm({ open, onClose, project, onSaved }) {
  const [form, setForm]           = useState(() => toForm(project));
  const [urlInput, setUrlInput]   = useState("");
  const [amenitySelect, setAmenitySelect] = useState("");
  const [customAmenity, setCustomAmenity] = useState("");
  const [uploadingImg, setUploadingImg]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const imgFileRef = useRef(null);

  // Assign agents
  const [allAgents, setAllAgents]         = useState([]);
  const [agentDropOpen, setAgentDropOpen] = useState(false);
  const [agentSearch, setAgentSearch]     = useState("");
  const agentDropRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (agentDropRef.current && !agentDropRef.current.contains(e.target)) {
        setAgentDropOpen(false);
        setAgentSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    api.get("/auth/agents")
      .then((r) => setAllAgents(r.data.agents || []))
      .catch(() => {}); // silently fail - not critical
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Images ────────────────────────────────────────────────────────────────
  const addImageUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setForm((f) => ({ ...f, images: [...f.images, url] }));
    setUrlInput("");
  };

  const handleImageFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    const remaining = 5 - form.images.length;
    if (remaining <= 0) return toast.error("Max 5 images per project");
    const toProcess = files.slice(0, remaining);
    setUploadingImg(true);
    try {
      const b64s = await Promise.all(toProcess.map(fileToBase64));
      setForm((f) => ({ ...f, images: [...f.images, ...b64s] }));
    } catch { toast.error("Failed to process image"); }
    finally { setUploadingImg(false); }
  };

  const removeImage = (i) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  // ── BHK ───────────────────────────────────────────────────────────────────
  const toggleBhk = (val) =>
    setForm((f) => ({
      ...f,
      bhkTypes: f.bhkTypes.includes(val)
        ? f.bhkTypes.filter((v) => v !== val)
        : [...f.bhkTypes, val],
    }));

  // ── Amenities ─────────────────────────────────────────────────────────────
  const addAmenityFromSelect = () => {
    if (!amenitySelect || form.amenities.includes(amenitySelect)) return;
    setForm((f) => ({ ...f, amenities: [...f.amenities, amenitySelect] }));
    setAmenitySelect("");
  };

  const addCustomAmenity = () => {
    const val = customAmenity.trim();
    if (!val || form.amenities.includes(val)) return;
    setForm((f) => ({ ...f, amenities: [...f.amenities, val] }));
    setCustomAmenity("");
  };

  const removeAmenity = (i) =>
    setForm((f) => ({ ...f, amenities: f.amenities.filter((_, idx) => idx !== i) }));

  // ── Assign Agents ─────────────────────────────────────────────────────────
  const addMember = (agent) => {
    if (!agent) return;
    if (form.assignedTo.some((m) => m._id === agent._id)) return;
    setForm((f) => ({ ...f, assignedTo: [...f.assignedTo, { _id: agent._id, name: agent.name, role: agent.role }] }));
    setAgentDropOpen(false);
    setAgentSearch("");
  };

  const removeMember = (id) =>
    setForm((f) => ({ ...f, assignedTo: f.assignedTo.filter((m) => m._id !== id) }));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Project name is required");

    const payload = {
      ...form,
      priceMin: form.priceMin ? Number(form.priceMin) : 0,
      priceMax: form.priceMax ? Number(form.priceMax) : 0,
      possessionDate: form.possessionDate || null,
      // Send only IDs to the backend
      assignedTo: form.assignedTo.map((m) => m._id),
    };

    setSaving(true);
    try {
      const res = project
        ? await api.put(`/projects/${project._id}`, payload)
        : await api.post("/projects", payload);
      toast.success(project ? "Project updated" : "Project created");
      onSaved(res.data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={project ? "Edit Project" : "New Project"} size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Basic Info ── */}
        <div className="space-y-4">
          <p className="stitch-kicker">Basic Info</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Project Name *</label>
              <input className="input" value={form.name} onChange={set("name")}
                placeholder="e.g. Skyline Heights Phase 2" required />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={set("location")}
                placeholder="e.g. Andheri West, Mumbai" />
            </div>
            <div>
              <label className="label">RERA Number</label>
              <input className="input" value={form.reraNumber} onChange={set("reraNumber")}
                placeholder="e.g. P51800047795" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="textarea" rows={3} value={form.description} onChange={set("description")}
                placeholder="Brief overview for telecallers..." />
            </div>
          </div>
        </div>

        {/* ── Images ── */}
        <div className="space-y-3">
          <p className="stitch-kicker">Project Images</p>

          {/* Upload from device */}
          <div className="flex gap-2">
            <input ref={imgFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageFiles} />
            <button type="button" onClick={() => imgFileRef.current?.click()}
              className="btn-secondary flex items-center gap-2" disabled={uploadingImg}>
              {uploadingImg ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
              Upload Photos
            </button>
          </div>

          {/* OR paste URL */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-app-soft flex-shrink-0">Or paste URL:</span>
            <input
              className="input flex-1"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }}
            />
            <button type="button" onClick={addImageUrl} className="btn-secondary flex-shrink-0">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          {form.images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {form.images.map((url, i) => (
                <div key={i} className="relative group flex-shrink-0">
                  <img
                    src={url} alt=""
                    className="h-20 w-20 rounded-2xl object-cover border"
                    style={{ borderColor: "var(--app-border)" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                  <div className="hidden h-20 w-20 rounded-2xl items-center justify-center stitch-surface-muted">
                    <ImageOff className="h-6 w-6 text-app-soft" />
                  </div>
                  <button
                    type="button" onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pricing & Config ── */}
        <div className="space-y-4">
          <p className="stitch-kicker">Pricing & Configuration</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Min Price (₹)</label>
              <input className="input" type="number" min="0" value={form.priceMin} onChange={set("priceMin")}
                placeholder="5000000" />
            </div>
            <div>
              <label className="label">Max Price (₹)</label>
              <input className="input" type="number" min="0" value={form.priceMax} onChange={set("priceMax")}
                placeholder="12000000" />
            </div>
            <div>
              <label className="label">Area Range</label>
              <input className="input" value={form.area} onChange={set("area")} placeholder="1200–1800 sq ft" />
            </div>
            <div>
              <label className="label">Possession Date</label>
              <input className="input" type="date" value={form.possessionDate} onChange={set("possessionDate")} />
            </div>
          </div>

          {/* BHK chips */}
          <div>
            <label className="label">BHK Types Available</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {BHK_OPTIONS.map((bhk) => (
                <button key={bhk} type="button" onClick={() => toggleBhk(bhk)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    form.bhkTypes.includes(bhk)
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "text-app-soft hover:border-orange-500/50"
                  }`}
                  style={!form.bhkTypes.includes(bhk) ? { borderColor: "var(--app-border)" } : {}}
                >
                  {bhk}
                </button>
              ))}
            </div>
          </div>

          {/* Amenities - dropdown + custom */}
          <div>
            <label className="label">Amenities</label>
            <div className="flex gap-2">
              <select
                className="select flex-1"
                value={amenitySelect}
                onChange={(e) => setAmenitySelect(e.target.value)}
              >
                <option value="">Select amenity...</option>
                {AMENITY_OPTIONS.filter((a) => !form.amenities.includes(a)).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button type="button" onClick={addAmenityFromSelect} className="btn-secondary flex-shrink-0">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                className="input flex-1"
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                placeholder="Or type a custom amenity..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAmenity(); } }}
              />
              <button type="button" onClick={addCustomAmenity} className="btn-secondary flex-shrink-0">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {form.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.amenities.map((a, i) => (
                  <span key={i} className="stitch-pill gap-1">
                    {a}
                    <button type="button" onClick={() => removeAmenity(i)}
                      className="hover:text-red-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Assign Agents ── */}
        <div className="space-y-3">
          <div>
            <p className="stitch-kicker">Assign Agents</p>
            <p className="text-xs text-app-soft mt-0.5">
              Agents assigned here will see this project and receive follow-up notifications.
              Their performance is tracked under this project.
            </p>
          </div>

          {/* Custom searchable dropdown */}
          <div className="relative" ref={agentDropRef}>
            <button
              type="button"
              onClick={() => { setAgentDropOpen((o) => !o); setAgentSearch(""); }}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-sm text-left transition"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}
            >
              <span className="text-app-soft">
                {allAgents.filter(a => !form.assignedTo.some(m => m._id === a._id)).length === 0
                  ? "All team members added"
                  : "Select a team member to assign…"}
              </span>
              <ChevronDown className={`h-4 w-4 text-app-soft flex-shrink-0 transition-transform ${agentDropOpen ? "rotate-180" : ""}`} />
            </button>

            {agentDropOpen && (
              <div
                className="absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-xl overflow-hidden"
                style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
              >
                {/* Search box */}
                <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--app-border)" }}>
                  <Search className="h-3.5 w-3.5 text-app-soft flex-shrink-0" />
                  <input
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-app outline-none placeholder:text-app-soft"
                    placeholder="Search by name…"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                  />
                </div>

                {/* List */}
                <ul className="max-h-48 overflow-y-auto">
                  {allAgents
                    .filter((a) => !form.assignedTo.some((m) => m._id === a._id))
                    .filter((a) => agentSearch === "" || a.name.toLowerCase().includes(agentSearch.toLowerCase()))
                    .map((a) => (
                      <li key={a._id}>
                        <button
                          type="button"
                          onClick={() => addMember(a)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition hover:bg-orange-500/10"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15 text-orange-500 text-xs font-bold flex-shrink-0">
                            {a.name?.[0]?.toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-app truncate">{a.name}</p>
                            <p className="text-[11px] text-app-soft capitalize">{a.role}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  {allAgents
                    .filter((a) => !form.assignedTo.some((m) => m._id === a._id))
                    .filter((a) => agentSearch === "" || a.name.toLowerCase().includes(agentSearch.toLowerCase()))
                    .length === 0 && (
                    <li className="px-4 py-3 text-sm text-app-soft text-center">
                      {agentSearch ? "No members match your search" : "All team members already added"}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Assigned member chips */}
          {form.assignedTo.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {form.assignedTo.map((m) => (
                <span key={m._id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-orange-500 text-[10px] font-bold">
                    {m.name?.[0]?.toUpperCase()}
                  </span>
                  <span className="text-app">{m.name}</span>
                  <button type="button" onClick={() => removeMember(m._id)}
                    className="text-app-soft hover:text-red-500 transition-colors ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-400/30">
              <span className="text-red-500 text-sm">⚠</span>
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                No agents assigned - agents won't see this project and notifications won't be sent.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner size="sm" /> : project ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
