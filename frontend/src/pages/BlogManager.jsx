import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  PenLine, Plus, Trash2, Eye, Globe, Clock, Search, ChevronLeft, ChevronRight,
  FileText, Tag, BarChart3, ExternalLink,
} from "lucide-react";
import { Spinner, EmptyState } from "../components/UI";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      status === "published"
        ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
        : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
    }`}>
      {status === "published" ? <Globe className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
      {status === "published" ? "Published" : "Draft"}
    </span>
  );
}

export default function BlogManager() {
  const navigate  = useNavigate();
  const [posts,   setPosts]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all"); // all | published | draft
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 15;

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, status: filter });
      if (search) params.set("search", search);
      const r = await api.get(`/blog/admin/posts?${params}`);
      setPosts(r.data.posts || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => { setPage(1); }, [filter, search]);
  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/blog/admin/posts/${deleteId}`);
      toast.success("Post deleted");
      setDeleteId(null);
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  // Stats
  const published = posts.filter((p) => p.status === "published").length;
  const drafts    = posts.filter((p) => p.status === "draft").length;

  return (
    <div className="stitch-page">
      {/* Top bar */}
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10">
            <PenLine className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-app leading-none">Posts</h1>
            <p className="text-xs text-app-soft mt-0.5">{total} post{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/blog"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Blog
          </a>
          <button
            onClick={() => navigate("/super-admin/blog/new")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New Post
          </button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="px-4 lg:px-6 pt-4 flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          {[
            { val: "all",       label: "All" },
            { val: "published", label: "Published" },
            { val: "draft",     label: "Drafts" },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === val ? "bg-orange-500 text-white shadow-sm" : "text-app-soft hover:text-app"
              }`}
            >{label}</button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 max-w-xs"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          <Search className="w-3.5 h-3.5 text-app-soft flex-shrink-0" />
          <input
            className="bg-transparent text-xs text-app outline-none placeholder:text-app-soft flex-1"
            placeholder="Search posts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Posts */}
      <div className="px-4 lg:px-6 pt-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No posts found"
            desc={filter === "all" ? "Create your first blog post to start ranking on Google." : `No ${filter} posts.`}
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Title</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Views</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Published</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Updated</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post._id}
                      className="border-b hover:bg-orange-500/5 transition"
                      style={{ borderColor: "var(--app-border)" }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-app text-xs leading-snug line-clamp-1 max-w-[280px]">{post.title}</p>
                          <p className="text-[10px] text-app-soft mt-0.5 font-mono">/blog/{post.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {post.category ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: `${post.category.color}20`, color: post.category.color }}>
                            <Tag className="w-2.5 h-2.5" /> {post.category.name}
                          </span>
                        ) : (
                          <span className="text-app-soft">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={post.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-app-soft">
                          <BarChart3 className="w-3 h-3" />
                          <span>{post.views?.toLocaleString() || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-app-soft whitespace-nowrap">{fmtDate(post.publishedAt)}</td>
                      <td className="px-4 py-3 text-app-soft whitespace-nowrap">{fmtDate(post.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/super-admin/blog/${post._id}/edit`)}
                            className="p-1.5 rounded-lg text-app-soft hover:text-orange-500 hover:bg-orange-500/10 transition"
                            title="Edit"
                          ><PenLine className="w-3.5 h-3.5" /></button>
                          {post.status === "published" && (
                            <a
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-app-soft hover:text-blue-500 hover:bg-blue-500/10 transition"
                              title="View live"
                            ><Eye className="w-3.5 h-3.5" /></a>
                          )}
                          <button
                            onClick={() => setDeleteId(post._id)}
                            className="p-1.5 rounded-lg text-app-soft hover:text-red-500 hover:bg-red-500/10 transition"
                            title="Delete"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs text-app-soft">Page {page} of {pages} · {total} total</p>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-orange-500/10 transition">
                    <ChevronLeft className="w-4 h-4 text-app" />
                  </button>
                  <span className="text-xs font-semibold text-app px-2">{page}</span>
                  <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-orange-500/10 transition">
                    <ChevronRight className="w-4 h-4 text-app" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="card p-6 max-w-sm w-full">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-app text-center mb-1">Delete Post?</h3>
            <p className="text-xs text-app-soft text-center mb-6">This action cannot be undone. The post will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-semibold text-app-soft hover:bg-black/5 transition" style={{ borderColor: "var(--app-border)" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
