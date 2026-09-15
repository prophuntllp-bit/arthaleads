// components/ProjectForm.jsx
import { useEffect, useRef, useState } from "react";
import { Modal, Spinner, AppDatePicker, SmartImage } from "./UI";
import CustomSelect from "./CustomSelect";
import { ChevronDown, FileText, ImageOff, Plus, Search, Trash2, Upload, X } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const PROJECT_TYPE_GROUPS = {
  Apartment: ["1BHK", "2BHK", "3BHK", "4BHK", "4BHK+", "5BHK+", "Studio", "Duplex", "Penthouse"],
  Plot: ["Residential Plot", "Farm Plot", "NA Plot", "Collector NA Plot", "Bungalow Plot", "Commercial Plot", "Agricultural Land"],
  Villa: ["2BHK Villa", "3BHK Villa", "4BHK Villa", "5BHK+ Villa", "Row House", "Twin Bungalow", "Independent Villa"],
  Commercial: ["Office Space", "Shop", "Showroom", "Retail Space", "Co-working Space", "Commercial Unit"],
};

const PROPERTY_TYPES = Object.keys(PROJECT_TYPE_GROUPS);
const BHK_OPTIONS = PROJECT_TYPE_GROUPS.Apartment;

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
  propertyType: "Apartment", unitTypes: [], bhkTypes: [], area: "", amenities: [],
  possessionDate: "", reraNumber: "",
  assignedTo: [], // array of { _id, name } objects for display
};

function toForm(p) {
  if (!p) return { ...empty };
  return {
    name: p.name || "", description: p.description || "", location: p.location || "",
    images: p.images || [], priceMin: p.priceMin || "", priceMax: p.priceMax || "",
    propertyType: p.propertyType || inferPropertyType(p.unitTypes || p.bhkTypes || []),
    unitTypes: p.unitTypes?.length ? p.unitTypes : p.bhkTypes || [],
    bhkTypes: p.bhkTypes || [], area: p.area || "", amenities: p.amenities || [],
    possessionDate: p.possessionDate ? p.possessionDate.slice(0, 10) : "",
    reraNumber: p.reraNumber || "",
    // assignedTo from API is array of populated objects { _id, name, avatar } or IDs
    assignedTo: Array.isArray(p.assignedTo)
      ? p.assignedTo.map((m) => (typeof m === "object" ? { _id: m._id, name: m.name } : { _id: m, name: m }))
      : [],
  };
}

function inferPropertyType(types = []) {
  const joined = types.join(" ").toLowerCase();
  if (joined.includes("plot") || joined.includes("land")) return "Plot";
  if (joined.includes("villa") || joined.includes("bungalow") || joined.includes("row house")) return "Villa";
  if (joined.includes("office") || joined.includes("shop") || joined.includes("showroom") || joined.includes("commercial")) return "Commercial";
  return "Apartment";
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
  const [customAmenity, setCustomAmenity] = useState("");
  const [uploadingImg, setUploadingImg]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const imgFileRef = useRef(null);

  // ── Brochure ──────────────────────────────────────────────────────────────
  // Uploaded immediately on file select rather than deferred to form submit —
  // a PDF goes to B2 through its own dedicated endpoint (not stored as base64
  // in the project document the way a compressed thumbnail is), and that
  // endpoint needs a real project id that a brand-new "Add Project" form does
  // not have yet. So this section only appears when editing an existing one.
  const [brochureUrl, setBrochureUrl] = useState(project?.brochureUrl || "");
  const [uploadingBrochure, setUploadingBrochure] = useState(false);
  const brochureFileRef = useRef(null);

  useEffect(() => { if (open) setBrochureUrl(project?.brochureUrl || ""); }, [open, project]);

  const handleBrochureFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !project) return;
    if (file.type !== "application/pdf") return toast.error("Brochure must be a PDF");
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10MB for a brochure");
    setUploadingBrochure(true);
    try {
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.post(`/projects/${project._id}/brochure`, { dataUri });
      setBrochureUrl(data.brochureUrl);
      toast.success("Brochure uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload brochure");
    } finally { setUploadingBrochure(false); }
  };

  const removeBrochure = async () => {
    if (!project) return;
    try {
      await api.delete(`/projects/${project._id}/brochure`);
      setBrochureUrl("");
      toast.success("Brochure removed");
    } catch { toast.error("Failed to remove brochure"); }
  };

  // Re-sync form whenever the modal opens or the project prop changes
  useEffect(() => {
    if (open) setForm(toForm(project));
  }, [open, project]);

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

  // ── Project type / unit configuration ─────────────────────────────────────
  const setPropertyType = (propertyType) =>
    setForm((f) => ({
      ...f,
      propertyType,
      unitTypes: [],
      bhkTypes: propertyType === "Apartment" ? [] : [],
    }));

  const toggleUnitType = (val) =>
    setForm((f) => ({
      ...f,
      unitTypes: f.unitTypes.includes(val)
        ? f.unitTypes.filter((v) => v !== val)
        : [...f.unitTypes, val],
      bhkTypes: f.propertyType === "Apartment"
        ? (f.bhkTypes.includes(val) ? f.bhkTypes.filter((v) => v !== val) : [...f.bhkTypes, val])
        : [],
    }));

  // ── Amenities ─────────────────────────────────────────────────────────────
  const addAmenity = (val) => {
    if (!val || form.amenities.includes(val)) return;
    setForm((f) => ({ ...f, amenities: [...f.amenities, val] }));
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
      unitTypes: form.unitTypes,
      bhkTypes: form.propertyType === "Apartment" ? form.unitTypes : [],
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
      <form onSubmit={handleSubmit} className="space-y-5 -mx-2 sm:mx-0">

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

        {/* ── Images + Brochure — side by side once editing, each was its own
             full-width row before, which was most of the extra scrolling on
             this form for two things that are both just "attach a file". ── */}
        <div className={project ? "grid gap-5 sm:grid-cols-2 sm:items-stretch" : ""}>
          {/* h-full + the card border is what makes the leftover space when
              this column is shorter than its sibling (e.g. Brochure once
              Images has a photo in it) read as "empty room inside this
              card" instead of a stray gap floating on the page. */}
          <div className={`space-y-3 ${project ? "h-full rounded-2xl border p-4" : ""}`}
            style={project ? { borderColor: "var(--app-border)" } : {}}>
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
                    <SmartImage
                      src={url} alt=""
                      className="h-20 w-20 rounded-2xl object-cover border"
                      style={{ borderColor: "var(--app-border)" }}
                      fallback={
                        <div className="flex h-20 w-20 rounded-2xl items-center justify-center stitch-surface-muted">
                          <ImageOff className="h-6 w-6 text-app-soft" />
                        </div>
                      }
                    />
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

          {/* ── Brochure (PDF) — only once the project exists ── */}
          {project && (
            <div className="space-y-3 h-full rounded-2xl border p-4"
              style={{ borderColor: "var(--app-border)" }}>
              <p className="stitch-kicker">Brochure</p>
              <p className="text-xs text-app-soft">
                Sent by the WhatsApp AI agent when its "Can send the brochure" permission is on
                (Conversations → AI Agents).
              </p>
              {brochureUrl ? (
                <div className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                  <FileText className="h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
                  <a href={brochureUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-app hover:underline flex-1 min-w-0 truncate">
                    {form.name || "Brochure"}.pdf
                  </a>
                  <button type="button" onClick={() => brochureFileRef.current?.click()} disabled={uploadingBrochure}
                    className="text-xs font-semibold text-app-soft hover:text-app transition disabled:opacity-40">
                    Replace
                  </button>
                  <button type="button" onClick={removeBrochure} title="Remove brochure"
                    className="p-1.5 rounded-lg text-app-soft hover:text-red-500 transition shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => brochureFileRef.current?.click()} disabled={uploadingBrochure}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition disabled:opacity-40"
                  style={{ background: "var(--app-surface-low)", border: "1px dashed var(--app-border-strong)", color: "var(--app-text-soft)" }}>
                  {uploadingBrochure ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
                  {uploadingBrochure ? "Uploading…" : "Upload brochure PDF"}
                </button>
              )}
              <input ref={brochureFileRef} type="file" accept="application/pdf" className="hidden" onChange={handleBrochureFile} />
            </div>
          )}
        </div>

        {/* ── Pricing & Config ── */}
        <div className="space-y-4">
          <p className="stitch-kicker">Pricing & Configuration</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <label className="label">{form.propertyType === "Plot" ? "Plot Area Range" : "Area Range"}</label>
              <input className="input" value={form.area} onChange={set("area")}
                placeholder={form.propertyType === "Plot" ? "1,000 to 10,000 sqft" : "1200–1800 sq ft"} />
            </div>
            <div>
              <label className="label">Possession Date</label>
              <AppDatePicker value={form.possessionDate} onChange={v => setForm(f => ({ ...f, possessionDate: v }))} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start">
            <div>
              <label className="label">Property Type</label>
              <CustomSelect
                value={form.propertyType}
                onChange={setPropertyType}
                options={PROPERTY_TYPES}
                style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
              />
            </div>
            <div>
              <label className="label">
                {form.propertyType === "Apartment" ? "Apartment Configurations"
                  : form.propertyType === "Plot" ? "Plot Types Available"
                  : form.propertyType === "Villa" ? "Villa Types Available"
                  : "Commercial Types Available"}
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(PROJECT_TYPE_GROUPS[form.propertyType] || BHK_OPTIONS).map((unit) => (
                  <button key={unit} type="button" onClick={() => toggleUnitType(unit)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    form.unitTypes.includes(unit)
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "text-app-soft hover:border-orange-500/50"
                  }`}
                  style={!form.unitTypes.includes(unit) ? { borderColor: "var(--app-border)" } : {}}
                >
                  {unit}
                </button>
              ))}
              </div>
            </div>
          </div>

          {/* Amenities - dropdown + custom */}
          <div>
            <label className="label">Amenities</label>
            <CustomSelect
              value=""
              onChange={addAmenity}
              options={AMENITY_OPTIONS.filter((a) => !form.amenities.includes(a))}
              placeholder="Select amenity..."
              style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
            />
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
                  // Same rounded-full/px-3/py-1.5/text-xs pill as a selected
                  // Plot Type chip just above — one visual language for "this
                  // is on" across the form, instead of a second pill style.
                  <span key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white">
                    {a}
                    <button type="button" onClick={() => removeAmenity(i)}
                      className="text-white/80 hover:text-white transition-colors">
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
              // var(--app-surface) is only ~58-75% opaque — this panel sits
              // right on top of the assigned-member chips below it (it's
              // absolutely positioned, so that row never moves out of the
              // way), and the chip text was bleeding through, reading as the
              // two merging together. A fully opaque surface fixes it.
              <div
                className="absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-xl overflow-hidden"
                style={{ background: "var(--app-surface-solid)", border: "1px solid var(--app-border)" }}
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
            // Tailwind's /10 and /30 opacity utilities read as barely-there
            // against this modal's own translucent surface — solid rgba
            // values and a literal text color keep this legible regardless
            // of what's behind it, same fix as the amenity tags above.
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)" }}>
              <span className="text-sm" style={{ color: "#b91c1c" }}>⚠</span>
              <p className="text-xs font-medium" style={{ color: "#b91c1c" }}>
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
