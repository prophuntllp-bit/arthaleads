// pages/PublicBlog.jsx - /blog on the shared marketing theme (components/site/*).
// api/blog-index.js swaps the live list into the prerendered copy: it replaces
// the contents of <section id="blog-articles"> and the article count span, so
// keep that id, keep that section free of nested <section>s, and keep the
// count markup as it is.
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../services/api";
import { Search, ChevronLeft, ChevronRight, ChevronDown, BookOpen, X, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { SitePage, Section, Container, Card, SiteButton } from "../components/site/Site";
import { PageHero, DemoActions } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { authorOf, fmtDate, sizedImage } from "../components/BlogCard";

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

const inputCls = "w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-[color:var(--site-brand)]";
const inputStyle = { background: "var(--site-bg)", border: "1px solid var(--site-line-strong)", color: "var(--site-ink)" };

// ── Cards (SiteBlogCard is also used by PublicBlogPost's "Keep reading") ──────

/** Shown when a post has no image: the brand mark on a soft orange wash. */
export function CoverFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.16), rgba(255,170,0,0.05)), var(--site-chip)" }}>
      <img src="/logo.png" alt="" aria-hidden="true" className="w-14 h-14 object-contain opacity-70" />
    </div>
  );
}

export function PostCategory({ post, className = "" }) {
  if (!post.category?.name) return null;
  return <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${className}`} style={{ color: "var(--site-brand-ink)" }}>{post.category.name}</span>;
}

/** One article in a grid: cover, category + read time, title, summary, date and author. */
export function SiteBlogCard({ post, eager = false }) {
  return (
    <Card glow as={Link} to={`/blog/${post.slug}`}
      className="group h-full flex flex-col overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--site-brand)] focus-visible:outline-offset-2">
      <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
        {post.featuredImage ? (
          <img src={sizedImage(post.featuredImage, 720)} alt={post.featuredImageAlt || post.title}
            loading={eager ? "eager" : "lazy"} decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : <CoverFallback />}
      </div>
      <div className="flex flex-col flex-1 p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <PostCategory post={post} />
          <span className="text-xs shrink-0 site-muted">{post.readingTime || 1} min read</span>
        </div>
        <h3 className="font-display site-ink font-bold text-[1.15rem] leading-snug tracking-[-0.01em] mb-3 line-clamp-3 transition-colors group-hover:text-[color:var(--site-brand-ink)]"
          style={{ textWrap: "balance" }}>
          {post.title}
        </h3>
        {post.excerpt && <p className="text-[15px] leading-relaxed line-clamp-3 mb-5">{post.excerpt}</p>}
        <div className="mt-auto pt-4 flex items-center justify-between gap-3 text-xs site-muted" style={{ borderTop: "1px solid var(--site-line)" }}>
          <span>{fmtDate(post.publishedAt)} · {authorOf(post)}</span>
          <ArrowUpRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

/** The newest article, shown large above the grid. */
function FeaturedCard({ post }) {
  return (
    <Card glow as={Link} to={`/blog/${post.slug}`}
      className="site-feature-glow group grid lg:grid-cols-[1.05fr_1fr] overflow-hidden !rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--site-brand)] focus-visible:outline-offset-2">
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-12 order-2 lg:order-1">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
            <span className="site-eyebrow !text-xs">Latest</span>
            <PostCategory post={post} />
            <span className="text-xs site-muted">· {post.readingTime || 1} min read</span>
          </div>
          <h2 className="font-display site-ink font-extrabold text-[28px] sm:text-[36px] xl:text-[42px] leading-[1.1] tracking-[-0.02em] mb-5 transition-colors group-hover:text-[color:var(--site-brand-ink)]"
            style={{ textWrap: "balance" }}>
            {post.title}
          </h2>
          {post.excerpt && <p className="text-base sm:text-lg leading-relaxed line-clamp-4">{post.excerpt}</p>}
        </div>
        <div className="flex items-center justify-between gap-4 mt-8">
          <div>
            <div className="text-sm font-semibold site-ink">{authorOf(post)}</div>
            <div className="text-xs site-muted">{fmtDate(post.publishedAt)}</div>
          </div>
          <span className="site-link text-sm transition-all group-hover:gap-2">
            Read the article <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="relative order-1 lg:order-2 min-h-[220px] sm:min-h-[300px] lg:min-h-[420px] overflow-hidden">
        {post.featuredImage ? (
          <img src={sizedImage(post.featuredImage, 1200)} alt={post.featuredImageAlt || post.title} loading="eager" fetchpriority="high" decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : <CoverFallback />}
      </div>
    </Card>
  );
}

function Skeleton() {
  const block = { background: "var(--site-chip)" };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="site-card overflow-hidden animate-pulse">
          <div style={{ aspectRatio: "16 / 10", ...block }} />
          <div className="p-6 space-y-3">
            <div className="h-3 rounded w-1/3" style={block} />
            <div className="h-5 rounded w-5/6" style={block} />
            <div className="h-3 rounded w-full" style={block} />
            <div className="h-3 rounded w-2/3" style={block} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BlogPageInner() {
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
    api.get("/blog/categories?inUse=1").then((r) => setCategories(r.data.categories || [])).catch(() => {});
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
    <SitePage>
      {/* ── Header: title, intro and search ── */}
      <PageHero
        eyebrow="The Arthaleads Journal"
        title={<>How real estate teams <span className="site-dim">win more leads</span></>}
        lede="Practical guides on lead follow-up, WhatsApp selling, site visits and running a sales floor, written for Indian developers and channel partners."
        actions={null}
        trust={false}
      >
        <label className="relative block mt-7 max-w-xl mx-auto">
          <span className="sr-only">Search articles</span>
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 site-muted" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles"
            className={`${inputCls} !py-3.5 !pl-11 !text-[15px]`} style={{ ...inputStyle, boxShadow: "var(--site-shadow-sm)" }} />
        </label>
      </PageHero>

      <Section tone="tint" className="!pt-4 sm:!pt-6">
        <Container>
          {/* ── Toolbar: count, active filters, topic picker ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-5 mb-10 lg:mb-12" style={{ borderBottom: "1px solid var(--site-line)" }}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold tabular-nums" style={{ color: "var(--site-ink)" }}>{total}</span><span>{total === 1 ? "article" : "articles"}</span>
              {tagFilter && <Chip onClear={() => setTagFilter("")}>#{tagFilter}</Chip>}
              {search && <Chip onClear={() => setSearch("")}>"{search}"</Chip>}
              {hasFilters && <button type="button" onClick={clearFilters} className="text-xs underline underline-offset-2 ml-1 site-muted hover:text-[color:var(--site-ink)]">Clear all</button>}
            </div>
            {categories.length > 0 && (
              <TopicMenu categories={categories} value={catFilter} onChange={setCatFilter} />
            )}
          </div>

          {/* ── Articles (api/blog-index.js fills this section in the static HTML) ── */}
          <section id="blog-articles" aria-label="Articles">
            {loading ? (
              <Skeleton />
            ) : posts.length === 0 ? (
              <Card raised className="text-center px-6 py-16 sm:py-20 max-w-2xl mx-auto">
                <span className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
                  <BookOpen className="w-6 h-6" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                </span>
                <h2 className="font-display site-ink text-xl font-bold mb-2">{hasFilters ? "No articles match" : "New articles are on the way"}</h2>
                <p className="text-sm">{hasFilters ? `Nothing found${catName ? ` in ${catName}` : ""}. Try a different search or topic.` : "Check back soon."}</p>
                {hasFilters && <SiteButton onClick={clearFilters} className="mt-6">Show all articles</SiteButton>}
              </Card>
            ) : (
              <>
                {featured && (
                  <div className="mb-12 lg:mb-16">
                    <FeaturedCard post={featured} />
                  </div>
                )}
                {grid.length > 0 && (
                  <div>
                    {showFeatured && (
                      <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] text-[26px] sm:text-[32px] mb-7">More to read</h2>
                    )}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
                      {grid.map((p, i) => (
                        <Reveal key={p._id} delay={(i % 3) * 80} className="h-full">
                          <SiteBlogCard post={p} />
                        </Reveal>
                      ))}
                    </div>
                  </div>
                )}

                {pages > 1 && (
                  <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-2 mt-12">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition disabled:opacity-30 hover:border-[color:var(--site-brand)] site-ink"
                      style={{ border: "1px solid var(--site-line-strong)", background: "var(--site-card)" }}>
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                    {[...Array(pages)].map((_, i) => {
                      const on = page === i + 1;
                      return (
                        <button type="button" key={i} onClick={() => setPage(i + 1)} aria-current={on ? "page" : undefined}
                          className={`w-10 h-10 rounded-xl text-sm font-semibold tabular-nums transition ${on ? "text-white" : "hover:border-[color:var(--site-brand)] site-ink"}`}
                          style={on ? { background: "var(--brand-btn)" } : { border: "1px solid var(--site-line-strong)", background: "var(--site-card)" }}>
                          {i + 1}
                        </button>
                      );
                    })}
                    <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition disabled:opacity-30 hover:border-[color:var(--site-brand)] site-ink"
                      style={{ border: "1px solid var(--site-line-strong)", background: "var(--site-card)" }}>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </Container>
      </Section>

      {/* ── Closing call to action ── */}
      <Section tone="white">
        <Container>
          <Reveal>
            <div className="site-cta-panel relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12">
              <div className="max-w-xl">
                <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[28px] sm:text-[36px] lg:text-[40px]" style={{ textWrap: "balance" }}>
                  Put these ideas to work <span className="site-dim">on your own leads</span>
                </h2>
                <p className="mt-4 text-base sm:text-lg leading-relaxed">Arthaleads brings every enquiry, WhatsApp chat and follow-up into one workspace for your sales team.</p>
              </div>
              <div className="shrink-0 flex flex-col items-start lg:items-end gap-4">
                <DemoActions className="!justify-start" />
                <Link to="/features" className="site-link text-sm">See all features <ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    </SitePage>
  );
}

function Chip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)", color: "var(--site-brand-ink)" }}>
      {children}
      <button type="button" onClick={onClear} aria-label="Remove filter" className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#ff6b00]/20"><X className="w-3 h-3" /></button>
    </span>
  );
}

// Topic filter: a styled menu instead of the browser's native <select>, whose
// open list ignores the site's look (blue highlight, square corners).
function TopicMenu({ categories, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const options = [{ _id: "", name: "All topics" }, ...categories];
  const current = options.find((c) => c._id === value) || options[0];
  const pick = (id) => { onChange(id); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="inline-flex items-center gap-3 rounded-xl py-2.5 pl-4 pr-3 text-sm font-medium site-ink transition-colors hover:border-[color:var(--site-brand)]"
        style={{ background: "var(--site-card)", border: `1px solid ${open ? "var(--site-brand)" : "var(--site-line-strong)"}`, minWidth: 190 }}>
        <span className="flex-1 text-left">{current.name}</span>
        <ChevronDown className={`w-4 h-4 site-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Topic"
          className="absolute left-0 sm:left-auto sm:right-0 z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5"
          style={{ background: "var(--site-card)", border: "1px solid var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
          {options.map((c) => {
            const on = c._id === value;
            return (
              <li key={c._id || "all"} role="option" aria-selected={on}>
                <button type="button" onClick={() => pick(c._id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${on ? "font-semibold" : "font-medium site-ink hover:bg-[color:var(--site-chip)]"}`}
                  style={on ? { color: "var(--site-brand-ink)", background: "rgba(255,107,0,0.10)" } : undefined}>
                  {c.name}
                  {on && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function PublicBlog() {
  return <BlogPageInner />;
}
