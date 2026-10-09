import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import api from "../services/api";
import { Search, ChevronLeft, ChevronRight, ChevronDown, BookOpen, X, ArrowRight } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import BlogCard, { FeaturedCard, blogTheme } from "../components/BlogCard";
import { usePublicTheme } from "../context/PublicThemeContext";

// ── SEO meta updater ───────────────────────────────────────────────────────────
function useSEO({ title, description, url, image }) {
  useEffect(() => {
    document.title = title || "Blog - Arthaleads Real Estate CRM";
    setMeta("description", description || "Expert real estate insights, CRM tips and lead management strategies from Arthaleads.");
    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:url", url || window.location.href);
    if (image) setMeta("og:image", image);
    if (url) {
      let canon = document.querySelector("link[rel='canonical']");
      if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
      canon.href = url;
    }
    return () => {
      document.title = "Arthaleads - Real Estate CRM";
      const canon = document.querySelector("link[rel='canonical']");
      if (canon) canon.remove();
    };
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

const PAGE_SIZE = 10;

function Skeleton({ isDark }) {
  const t = blogTheme(isDark);
  const block = isDark ? "rgba(255,255,255,0.06)" : "#efeae3";
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-[26px] border overflow-hidden animate-pulse" style={{ borderColor: t.cardBorder, background: t.card }}>
          <div style={{ aspectRatio: "16 / 10", background: block }} />
          <div className="p-6 space-y-3">
            <div className="h-3 rounded w-1/3" style={{ background: block }} />
            <div className="h-5 rounded w-5/6" style={{ background: block }} />
            <div className="h-3 rounded w-full" style={{ background: block }} />
            <div className="h-3 rounded w-2/3" style={{ background: block }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BlogPageInner() {
  const { isDark } = usePublicTheme();
  const t = blogTheme(isDark);
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts,      setPosts]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState(searchParams.get("q") || "");
  const [catFilter,  setCatFilter]  = useState(searchParams.get("category") || "");
  const [tagFilter,  setTagFilter]  = useState(searchParams.get("tag") || "");

  useSEO({
    title: "Real Estate CRM Blog | Lead Management Tips & Insights – Arthaleads",
    description: "Expert guides on real estate lead management, CRM best practices, and property sales strategies. Helping Indian developers & brokers close more deals.",
    url: "https://www.arthaleads.com/blog",
  });

  useEffect(() => {
    api.get("/blog/categories").then((r) => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE });
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
  useEffect(() => { if (page > 1) window.scrollTo({ top: 360, behavior: "smooth" }); }, [page]);

  const hasFilters = !!(search || catFilter || tagFilter);
  const clearFilters = () => { setSearch(""); setCatFilter(""); setTagFilter(""); setSearchParams({}); };
  const showFeatured = !hasFilters && page === 1 && posts.length > 0;
  const featured = showFeatured ? posts[0] : null;
  const grid = showFeatured ? posts.slice(1) : posts;
  const catName = categories.find((c) => c._id === catFilter)?.name;

  return (
    <div className="min-h-screen" style={{ background: t.bg }}>
      <PublicNav />

      {/* ── Header: title on the left, search on the right ── */}
      <header className="relative overflow-hidden pt-32 pb-10 lg:pt-40 lg:pb-14"
        style={{ background: isDark ? "#0d0d1a" : "linear-gradient(180deg,#fff7f0 0%,#ffffff 100%)" }}>
        <div className="absolute -top-24 right-0 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,107,0,0.13), transparent 65%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-16 items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b00]">The Arthaleads Journal</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mt-4" style={{ color: t.heading, textWrap: "balance" }}>
              How real estate teams{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">win more leads</span>
            </h1>
          </div>
          <div>
            <p className="text-base sm:text-lg leading-relaxed mb-5" style={{ color: t.body }}>
              Practical guides on lead follow-up, WhatsApp selling, site visits and running a sales floor, written for Indian developers and channel partners.
            </p>
            <label className="relative block">
              <span className="sr-only">Search articles</span>
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: t.muted }} />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles"
                className="w-full rounded-2xl py-3.5 pl-11 pr-4 text-[15px] outline-none border transition-shadow focus:shadow-[0_0_0_3px_rgba(255,107,0,0.18)] focus:border-[#ff6b00]"
                style={{ background: t.field, borderColor: t.cardBorder, color: t.heading }} />
            </label>
          </div>
        </div>
      </header>

      {/* ── Toolbar: count, active filters, topic picker ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-5" style={{ borderTop: `1px solid ${t.rule}`, borderBottom: `1px solid ${t.rule}` }}>
          <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: t.body }}>
            <span className="font-semibold tabular-nums" style={{ color: t.heading }}>{total}</span>
            <span>{total === 1 ? "article" : "articles"}</span>
            {tagFilter && <Chip onClear={() => setTagFilter("")} isDark={isDark}>#{tagFilter}</Chip>}
            {search && <Chip onClear={() => setSearch("")} isDark={isDark}>"{search}"</Chip>}
            {hasFilters && <button onClick={clearFilters} className="text-xs underline underline-offset-2 ml-1" style={{ color: t.muted }}>Clear all</button>}
          </div>
          {categories.length > 0 && (
            <label className="relative inline-flex items-center">
              <span className="sr-only">Topic</span>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                className="appearance-none rounded-xl border py-2.5 pl-4 pr-10 text-sm font-medium outline-none cursor-pointer focus:border-[#ff6b00]"
                style={{ background: t.field, borderColor: t.cardBorder, color: t.heading }}>
                <option value="">All topics</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 pointer-events-none" style={{ color: t.muted }} />
            </label>
          )}
        </div>
      </div>

      {/* ── Articles ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {loading ? (
          <Skeleton isDark={isDark} />
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-[#ff6b00]/40" />
            <h2 className="text-lg font-bold mb-2" style={{ color: t.heading }}>{hasFilters ? "No articles match" : "New articles are on the way"}</h2>
            <p className="text-sm" style={{ color: t.body }}>{hasFilters ? `Nothing found${catName ? ` in ${catName}` : ""}. Try a different search or topic.` : "Check back soon."}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-5 px-5 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold">Show all articles</button>}
          </div>
        ) : (
          <>
            {featured && (
              <section aria-label="Latest article" className="mb-10 lg:mb-14">
                <FeaturedCard post={featured} isDark={isDark} />
              </section>
            )}
            {grid.length > 0 && (
              <section aria-label="Articles">
                {showFeatured && <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-7" style={{ color: t.heading }}>More to read</h2>}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
                  {grid.map((p) => <BlogCard key={p._id} post={p} isDark={isDark} />)}
                </div>
              </section>
            )}

            {pages > 1 && (
              <nav aria-label="Pages" className="flex items-center justify-center gap-2 mt-12">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"
                  className="p-2.5 rounded-xl border transition disabled:opacity-30 hover:border-[#ff6b00]" style={{ borderColor: t.cardBorder }}>
                  <ChevronLeft className="w-4 h-4" style={{ color: t.heading }} />
                </button>
                {[...Array(pages)].map((_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)} aria-current={page === i + 1 ? "page" : undefined}
                    className={`w-10 h-10 rounded-xl text-sm font-semibold transition ${page === i + 1 ? "bg-[#ff6b00] text-white" : "border hover:border-[#ff6b00]"}`}
                    style={page !== i + 1 ? { borderColor: t.cardBorder, color: t.body } : {}}>{i + 1}</button>
                ))}
                <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"
                  className="p-2.5 rounded-xl border transition disabled:opacity-30 hover:border-[#ff6b00]" style={{ borderColor: t.cardBorder }}>
                  <ChevronRight className="w-4 h-4" style={{ color: t.heading }} />
                </button>
              </nav>
            )}
          </>
        )}
      </main>

      {/* ── Closing call to action ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 lg:pb-24">
        <div className="relative overflow-hidden rounded-[30px] px-7 py-10 sm:px-12 sm:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
          style={{ background: "linear-gradient(135deg,#ff7a1a 0%,#e85d04 100%)" }}>
          <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">Put these ideas to work on your own leads</h2>
            <p className="text-white/85 mt-2 text-[15px]">Arthaleads brings every enquiry, WhatsApp chat and follow-up into one workspace for your sales team.</p>
          </div>
          <div className="relative flex flex-col sm:flex-row gap-3 shrink-0">
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-[#e85d04] font-bold text-[15px] hover:-translate-y-0.5 transition-transform">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </a>
            <Link to="/features" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-white/50 text-white font-semibold text-[15px] hover:bg-white/10 transition-colors">
              See all features
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

function Chip({ children, onClear, isDark }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: isDark ? "rgba(255,107,0,0.16)" : "#fff0e3", color: "#e85d04" }}>
      {children}
      <button onClick={onClear} aria-label="Remove filter" className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#ff6b00]/20"><X className="w-3 h-3" /></button>
    </span>
  );
}

export default function PublicBlog() {
  return <BlogPageInner />;
}
