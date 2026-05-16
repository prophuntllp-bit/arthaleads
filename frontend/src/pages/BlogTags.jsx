import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function BlogTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
  });

  async function fetchTags() {
    try {
      const res = await api.get("/blog/tags");
      setTags(res.data.tags || []);
    } catch {
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTags();
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
      await api.post("/blog/admin/tags", {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
      });
      toast.success("Tag created");
      setForm({ name: "", slug: "", description: "" });
      fetchTags();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create tag");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this tag? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/blog/admin/tags/${id}`);
      toast.success("Tag deleted");
      setTags((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete tag");
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
          Tags
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Tag Form */}
        <div className="card p-5">
          <p className="stitch-kicker mb-4">Add Tag</p>
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
                placeholder="Tag name"
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
                placeholder="tag-slug"
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

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create Tag"}
            </button>
          </form>
        </div>

        {/* Tags List */}
        <div className="card p-5">
          <p className="stitch-kicker mb-4">Existing Tags</p>
          {loading ? (
            <p className="text-sm" style={{ color: "var(--app-text)" }}>
              Loading…
            </p>
          ) : tags.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--app-text)", opacity: 0.6 }}>
              No tags yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {tags.map((tag) => (
                <li
                  key={tag._id}
                  className="flex items-center justify-between gap-3 py-2 border-b"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--app-text)" }}
                    >
                      {tag.name}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--app-text)", opacity: 0.55 }}
                    >
                      {tag.postCount ?? 0} post{(tag.postCount ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    className="btn-danger text-xs flex-shrink-0"
                    onClick={() => handleDelete(tag._id)}
                    disabled={deletingId === tag._id}
                  >
                    {deletingId === tag._id ? "Deleting…" : "Delete"}
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
