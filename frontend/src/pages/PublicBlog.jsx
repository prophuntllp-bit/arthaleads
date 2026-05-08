import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { Clock, Tag, Search, ChevronLeft, ChevronRight, ArrowRight, BookOpen, Calendar } from "lucide-react";

// ── SEO meta updater ───────────────────────────────────────────────────────────
function useSEO({ title, description, url, image }) {
  useEffect(() => {
    document.title = title || "Blog — Arthaleads Real Estate CRM";
    setMeta("description", description || "Expert real estate insights, CRM tips and lead management strategies from Arthaleads.");
    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:url", url || window.location.href);
    if (image) setMeta("og:image", image);
    return () => { document.title = "Arthaleads — Real Estate CRM"; };
  }, [title, description, url, image]);
}
function setMeta(name, content) {
  if (!content) return;
  const isProp = name.startsWith("og:");
  const attr = isProp ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden border hover:border-orange-300 transition-all hover:shadow-lg"
      style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
    >
      {post.featuredImage && (
        <div className="h-48 overflow-hidden">
          <img
            src={post.featuredImage}
            alt={post.featuredImageAlt || post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      {!post.featuredImage && (
        <div className="h-40 flex items-center justify-center" style={{ background: "var(--app-surface-low)" }}>
          <BookOpen className="w-10 h-10 text-orange-200" />
        </div>
      )}
      <div className="flex-1 p-5">
        {post.category && (
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mb-3"
            style={{ background: `${post.category.color}20`, color: post.category.color }}
          >
            {post.category.name}
          </span>
        )}
        <h2 className="font-bold text-app text-base leading-snug mb-2 group-hover:text-orange-500 transition-colors line-clamp-2">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-sm text-app-soft leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-app-soft mt-auto">
          {post.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmtDate(post.publishedAt)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {post.readingTime || 1} min read
          </span>
        </div>
      </div>
      <div className="px-5 pb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 group-hover:gap-2.5 transition-all">
          Read more <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

export default function PublicBlog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts,       setPosts]       = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [pages,       setPages]       = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState(searchParams.get("q") || "");
  const [catFilter,   setCatFilter]   = useState(searchParams.get("category") || "");
  const [tagFilter,   setTagFilter]   = useState(searchParams.get("tag") || "");

  useSEO({
    title: "Blog — Arthaleads | Real Estate CRM Insights",
    description: "Expert tips on lead management, real estate sales, and CRM strategies from Arthaleads — India's modern real estate CRM platform.",
    url: "https://www.arthaleads.com/blog",
  });

  useEffect(() => {
    api.get("/blog/categories").then((r) => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 9 });
      if (search) params.set("search", search);
      if (catFilter) params.set("category", catFilter);
      if (tagFilter) params.set("tag", tagFilter);
      const r = await api.get(`/blog/posts?${params}`);
      setPosts(r.data.posts || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, catFilter, tagFilter]);

  useEffect(() => { setPage(1); }, [search, catFilter, tagFilter]);
  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const clearFilters = () => { setSearch(""); setCatFilter(""); setTagFilter(""); setSearchParams({}); };
  const hasFilters = search || catFilter || tagFilter;

  return (
    <div className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden py-20 px-4 text-center" style={{
        background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)",
      }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #f97316 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ea580c 0%, transparent 50%)" }} />
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-orange-500 text-white uppercase tracking-widest mb-4">
            Arthaleads Blog
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Real Estate CRM<br />
            <span className="text-orange-500">Insights & Tips</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Expert strategies for lead management, sales automation, and growing your real estate business.
          </p>
          {/* Search */}
          <div className="flex max-w-md mx-auto rounded-2xl overflow-hidden shadow-lg border border-orange-100 bg-white">
            <div className="flex items-center pl-4">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="flex-1 px-3 py-3 text-sm text-gray-800 outline-none bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch("")} className="px-3 text-gray-400 hover:text-orange-500 transition text-sm">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Posts grid */}
          <div className="flex-1">
            {/* Active filters */}
            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-xs text-app-soft">Filters:</span>
                {search && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                    "{search}" <button onClick={() => setSearch("")}>×</button>
                  </span>
                )}
                {catFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                    {categories.find((c) => c._id === catFilter)?.name || catFilter} <button onClick={() => setCatFilter("")}>×</button>
                  </span>
                )}
                {tagFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                    #{tagFilter} <button onClick={() => setTagFilter("")}>×</button>
                  </span>
                )}
                <button onClick={clearFilters} className="text-xs text-app-soft hover:text-red-400 transition">Clear all</button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl border animate-pulse" style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}>
                    <div className="h-48" style={{ background: "var(--app-surface-low)" }} />
                    <div className="p-5 space-y-3">
                      <div className="h-3 rounded w-1/4" style={{ background: "var(--app-surface-low)" }} />
                      <div className="h-4 rounded w-3/4" style={{ background: "var(--app-surface-low)" }} />
                      <div className="h-3 rounded w-full" style={{ background: "var(--app-surface-low)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="w-12 h-12 text-orange-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-app mb-2">No posts found</h3>
                <p className="text-sm text-app-soft">{hasFilters ? "Try adjusting your filters." : "No blog posts published yet."}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-app-soft">{total} article{total !== 1 ? "s" : ""}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map((post) => <PostCard key={post._id} post={post} />)}
                </div>
              </>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-2 rounded-xl border transition disabled:opacity-30 hover:border-orange-400"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <ChevronLeft className="w-4 h-4 text-app" />
                </button>
                {[...Array(pages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-9 h-9 rounded-xl text-sm font-semibold transition ${
                      page === i + 1 ? "bg-orange-500 text-white" : "border text-app-soft hover:border-orange-400"
                    }`}
                    style={page !== i + 1 ? { borderColor: "var(--app-border)" } : {}}
                  >{i + 1}</button>
                ))}
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-xl border transition disabled:opacity-30 hover:border-orange-400"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <ChevronRight className="w-4 h-4 text-app" />
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 flex-shrink-0 space-y-6">
            {/* Categories */}
            {categories.length > 0 && (
              <div className="rounded-2xl p-5 border" style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}>
                <h3 className="text-sm font-bold text-app mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-orange-500" /> Categories
                </h3>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setCatFilter("")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${!catFilter ? "bg-orange-500 text-white font-semibold" : "text-app-soft hover:text-app hover:bg-orange-500/5"}`}
                  >All Categories</button>
                  {categories.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => setCatFilter(catFilter === c._id ? "" : c._id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition flex items-center gap-2 ${
                        catFilter === c._id ? "font-semibold" : "text-app-soft hover:text-app hover:bg-orange-500/5"
                      }`}
                      style={catFilter === c._id ? { background: `${c.color}20`, color: c.color } : {}}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-2xl p-5 text-center overflow-hidden relative"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle at 70% 30%, white 0%, transparent 60%)" }} />
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Manage Leads Better</h3>
                <p className="text-xs text-orange-100 mb-4 leading-relaxed">
                  Try Arthaleads CRM — built for Indian real estate teams.
                </p>
                <Link
                  to="/signup"
                  className="inline-block px-5 py-2.5 rounded-xl bg-white text-orange-600 text-xs font-bold hover:bg-orange-50 transition"
                >
                  Start Free Trial →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-8 text-center text-xs text-app-soft" style={{ borderColor: "var(--app-border)" }}>
        <p>© {new Date().getFullYear()} Arthaleads (Prophunt LLP). All rights reserved.</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <Link to="/privacy" className="hover:text-orange-500 transition">Privacy</Link>
          <Link to="/terms" className="hover:text-orange-500 transition">Terms</Link>
          <Link to="/login" className="hover:text-orange-500 transition">CRM Login</Link>
        </div>
      </div>
    </div>
  );
}
