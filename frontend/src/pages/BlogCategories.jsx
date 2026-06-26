import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";

const PRESET_COLORS = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#ef4444", // red
  "#eab308", // yellow
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function BlogCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    color: PRESET_COLORS[0],
  });

  async function fetchCategories() {
    try {
      const res = await api.get("/blog/categories");
      setCategories(res.data.categories || []);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  function handleNameChange(e) {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: slugify(name) }));
  }

  function handleSlugChange(e) {
    setForm((f) => ({ ...f, slug: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.slug.trim()) return toast.error("Slug is required");

    setSubmitting(true);
    try {
      await api.post("/blog/admin/categories", {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        color: form.color,
      });
      toast.success("Category created");
      setForm({ name: "", slug: "", description: "", color: PRESET_COLORS[0] });
      fetchCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this category? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/blog/admin/categories/${id}`);
      toast.success("Category deleted");
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/super-admin/blog"
          className="text-sm text-orange-500 hover:underline mb-2 inline-block"
        >
          &larr; Back to Blog
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "var(--app-text)" }}>
          Categories
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Category Form */}
        <div className="card p-5">
          <p className="stitch-kicker mb-4">Add Category</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--app-text)" }}
              >
                Name
              </label>
              <input
                className="input w-full"
                type="text"
                placeholder="Category name"
                value={form.name}
                onChange={handleNameChange}
                maxLength={100}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--app-text)" }}
              >
                Slug
              </label>
              <input
                className="input w-full"
                type="text"
                placeholder="category-slug"
                value={form.slug}
                onChange={handleSlugChange}
                maxLength={200}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--app-text)" }}
              >
                Description
              </label>
              <textarea
                className="input w-full resize-none"
                rows={3}
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={300}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--app-text)" }}
              >
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? "var(--app-text)" : "transparent",
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create Category"}
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div className="card p-5">
          <p className="stitch-kicker mb-4">Existing Categories</p>
          {loading ? (
            <p className="text-sm" style={{ color: "var(--app-text)" }}>
              Loading…
            </p>
          ) : categories.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--app-text)", opacity: 0.6 }}>
              No categories yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li
                  key={cat._id}
                  className="flex items-center justify-between gap-3 py-2 border-b"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color || "#f97316" }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--app-text)" }}
                      >
                        {cat.name}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--app-text)", opacity: 0.55 }}
                      >
                        {cat.postCount ?? 0} post{(cat.postCount ?? 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-danger text-xs flex-shrink-0"
                    onClick={() => handleDelete(cat._id)}
                    disabled={deletingId === cat._id}
                  >
                    {deletingId === cat._id ? "Deleting…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
