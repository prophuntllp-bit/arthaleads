// components/ProjectForm.jsx
import { useState } from "react";
import { Modal, Spinner } from "./UI";
import { ImageOff, Plus, X } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const BHK_OPTIONS = ["1BHK", "2BHK", "3BHK", "4BHK", "4BHK+", "Studio", "Duplex", "Penthouse"];

const empty = {
  name: "", description: "", location: "",
  images: [],
  priceMin: "", priceMax: "",
  bhkTypes: [], area: "", amenities: [],
  possessionDate: "", reraNumber: "",
};

function toForm(p) {
  if (!p) return { ...empty };
  return {
    name: p.name || "",
    description: p.description || "",
    location: p.location || "",
    images: p.images || [],
    priceMin: p.priceMin || "",
    priceMax: p.priceMax || "",
    bhkTypes: p.bhkTypes || [],
    area: p.area || "",
    amenities: p.amenities || [],
    possessionDate: p.possessionDate ? p.possessionDate.slice(0, 10) : "",
    reraNumber: p.reraNumber || "",
  };
}

export default function ProjectForm({ open, onClose, project, onSaved }) {
  const [form, setForm] = useState(() => toForm(project));
  const [imageInput, setImageInput] = useState("");
  const [amenityInput, setAmenityInput] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    setForm((f) => ({ ...f, images: [...f.images, url] }));
    setImageInput("");
  };

  const removeImage = (i) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const toggleBhk = (val) =>
    setForm((f) => ({
      ...f,
      bhkTypes: f.bhkTypes.includes(val)
        ? f.bhkTypes.filter((v) => v !== val)
        : [...f.bhkTypes, val],
    }));

  const addAmenity = () => {
    const val = amenityInput.trim();
    if (!val || form.amenities.includes(val)) return;
    setForm((f) => ({ ...f, amenities: [...f.amenities, val] }));
    setAmenityInput("");
  };

  const removeAmenity = (i) =>
    setForm((f) => ({ ...f, amenities: f.amenities.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Project name is required");

    const payload = {
      ...form,
      priceMin: form.priceMin ? Number(form.priceMin) : 0,
      priceMax: form.priceMax ? Number(form.priceMax) : 0,
      possessionDate: form.possessionDate || null,
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

        {/* Basic Info */}
        <div className="space-y-4">
          <p className="stitch-kicker">Basic Info</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Project Name *</label>
              <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Skyline Heights Phase 2" required />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={set("location")} placeholder="e.g. Andheri West, Mumbai" />
            </div>
            <div>
              <label className="label">RERA Number</label>
              <input className="input" value={form.reraNumber} onChange={set("reraNumber")} placeholder="e.g. P51800047795" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="textarea" rows={3} value={form.description} onChange={set("description")} placeholder="Brief overview of the project for telecallers..." />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="space-y-3">
          <p className="stitch-kicker">Project Images</p>
          <div className="flex gap-2">
            <input
              className="input"
              value={imageInput}
              onChange={(e) => setImageInput(e.target.value)}
              placeholder="Paste image URL and click Add"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImage())}
            />
            <button type="button" onClick={addImage} className="btn-secondary flex-shrink-0">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {form.images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {form.images.map((url, i) => (
                <div key={i} className="relative group">
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
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pricing & Config */}
        <div className="space-y-4">
          <p className="stitch-kicker">Pricing & Configuration</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Min Price (₹)</label>
              <input className="input" type="number" min="0" value={form.priceMin} onChange={set("priceMin")} placeholder="5000000" />
            </div>
            <div>
              <label className="label">Max Price (₹)</label>
              <input className="input" type="number" min="0" value={form.priceMax} onChange={set("priceMax")} placeholder="12000000" />
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

          {/* BHK Types */}
          <div>
            <label className="label">BHK Types Available</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {BHK_OPTIONS.map((bhk) => (
                <button
                  key={bhk} type="button"
                  onClick={() => toggleBhk(bhk)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    form.bhkTypes.includes(bhk)
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "border-app text-app-soft hover:border-orange-500/50"
                  }`}
                  style={!form.bhkTypes.includes(bhk) ? { borderColor: "var(--app-border)" } : {}}
                >
                  {bhk}
                </button>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="label">Amenities</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={amenityInput}
                onChange={(e) => setAmenityInput(e.target.value)}
                placeholder="e.g. Swimming Pool, Gym, Parking..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAmenity())}
              />
              <button type="button" onClick={addAmenity} className="btn-secondary flex-shrink-0">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {form.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.amenities.map((a, i) => (
                  <span key={i} className="stitch-pill gap-1">
                    {a}
                    <button type="button" onClick={() => removeAmenity(i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
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
