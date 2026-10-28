// pages/PublicBlog.jsx - /blog and each topic page /blog/category/<slug>, on the
// shared marketing theme (components/site/*). Layout after vistrow.com/blog
// (owner, 28 Oct 2026): title with a search card, a row of topic tabs with
// counts, then the latest guide, "Also recent" and "All guides".
//
// api/blog-index.js serves both URLs: it takes the prerendered copy of this page
// and fills four regions with the live list, in the same markup as below:
//   <header id="blog-head">, <dl id="blog-stats">, <nav id="blog-topics"> and
//   <section id="blog-articles">.
// Keep those ids, keep each region free of a nested element of its own tag
// (the function finds a region's end by the first closing tag), and change the
// markup here and there together.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams, useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { Search, ChevronLeft, ChevronRight, BookOpen, X, ArrowRight, ArrowUpRight } from "lucide-react";
import { SitePage, Section, Container, Card, SiteButton } from "../components/site/Site";
import { DemoActions } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { authorOf, fmtDate, sizedImage } from "../components/BlogCard";

const SITE = "https://www.arthaleads.com";

// The blog's own title and description; topics use their own (backend/config/blogCategories.js).
export const BLOG_TITLE = "Real Estate CRM Blog: Lead Management and Sales Guides | Arthaleads";
export const BLOG_DESCRIPTION = "Practical guides for Indian real estate teams on CRM software, lead generation, WhatsApp, follow-ups, site visits and running a sales floor.";
export const topicTitle = (t) => (t.seoTitle && t.seoTitle.length > 47 ? t.seoTitle : `${t.seoTitle || t.name} | Arthaleads`);

// ── SEO meta updater ───────────────────────────────────────────────────────────
function useSEO({ title, description, url }) {
  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:url", url);
    let canon = document.querySelector("link[rel='canonical']");
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.href = url;
    return () => {
      document.title = "Arthaleads - Real Estate CRM";
      document.querySelector("link[rel='canonical']")?.remove();
    };
  }, [title, description, url]);
}
function setMeta(name, content) {
  if (!content) return;
  const attr = name.startsWith("og:") ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

const PAGE_SIZE = 12;   // cards per page under "All guides"

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

/** One article in a grid: cover, topic + read time, title, summary, date and author. */
export function SiteBlogCard({ post, eager = false }) {
  return (
    <Card glow as={Link} to={`/blog/${post.slug}`}
      className="blog-card group h-full flex flex-col overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--site-brand)] focus-visible:outline-offset-2">
      <div className="p-3 pb-0">
      <div className="blog-cover relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
        {post.featuredImage ? (
          <img src={sizedImage(post.featuredImage, 720)} alt={post.featuredImageAlt || post.title} width="720" height="405"
            loading={eager ? "eager" : "lazy"} decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : <CoverFallback />}
      </div>
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

/** The newest article, shown large: cover on the left, words on the right. */
function FeaturedCard({ post }) {
  return (
    <Card glow as={Link} to={`/blog/${post.slug}`}
      className="blog-card site-feature-glow group grid lg:grid-cols-[1.15fr_1fr] overflow-hidden !rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--site-brand)] focus-visible:outline-offset-2">
      {/* Covers are designed 16:9 with text on them (outputs/blog-covers), so the image keeps that shape and is never cropped. */}
      <div className="blog-cover relative self-center overflow-hidden aspect-video m-3 sm:m-4 lg:m-5 !rounded-[18px] sm:!rounded-[22px]">
        {post.featuredImage ? (
          <img src={sizedImage(post.featuredImage, 1200)} alt={post.featuredImageAlt || post.title} width="1200" height="675" loading="eager" fetchpriority="high" decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : <CoverFallback />}
      </div>
      <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5">
            <span className="site-eyebrow !text-xs">Latest</span>
            <PostCategory post={post} />
          </div>
          <h3 className="font-display site-ink font-extrabold text-[26px] sm:text-[32px] xl:text-[36px] leading-[1.12] tracking-[-0.02em] mb-4 transition-colors group-hover:text-[color:var(--site-brand-ink)]"
            style={{ textWrap: "balance" }}>
            {post.title}
          </h3>
          {post.excerpt && <p className="text-base leading-relaxed line-clamp-3">{post.excerpt}</p>}
        </div>
        <div className="flex items-center justify-between gap-4 mt-7 pt-5" style={{ borderTop: "1px solid var(--site-line)" }}>
          <span className="text-xs site-muted">{fmtDate(post.publishedAt)} · {post.readingTime || 1} min read</span>
          <span className="site-link text-sm transition-all group-hover:gap-2">
            Read the guide <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Card>
  );
}

/** A section heading with an eyebrow and a note on the right. */
function ListHead({ eyebrow, title, note }) {
  return (
    <div className="mb-7">
      {eyebrow && <p className="site-eyebrow !text-xs mb-2">{eyebrow}</p>}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] text-[26px] sm:text-[32px]">{title}</h2>
        {note && <span className="text-sm site-muted">{note}</span>}
      </div>
    </div>
  );
}

function Skeleton() {
  const block = { background: "var(--site-chip)" };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="site-card overflow-hidden animate-pulse">
          <div style={{ aspectRatio: "16 / 9", ...block }} />
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

const articlesLabel = (n) => `${n} ${n === 1 ? "article" : "articles"}`;

function BlogPageInner() {
  const { slug: topicSlug = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts,      setPosts]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState(searchParams.get("q") || "");
  const [tagFilter,  setTagFilter]  = useState(searchParams.get("tag") || "");

  const topic = categories.find((c) => c.slug === topicSlug) || null;
  const totalAll = categories.reduce((n, c) => n + (c.count || 0), 0);

  useSEO(topic
    ? { title: topicTitle(topic), description: topic.description, url: `${SITE}/blog/category/${topic.slug}` }
    : { title: BLOG_TITLE, description: BLOG_DESCRIPTION, url: `${SITE}/blog` });

  useEffect(() => {
    api.get("/blog/categories?inUse=1")
      .then((r) => setCategories(r.data.categories || []))
      .catch(() => {})
      .finally(() => setTopicsLoaded(true));
  }, []);

  // Older links filtered by topic id (/blog?category=<id>): send them to the topic's page.
  useEffect(() => {
    const old = searchParams.get("category");
    if (!old || !categories.length) return;
    const t = categories.find((c) => c._id === old || c.slug === old);
    navigate(t ? `/blog/category/${t.slug}` : "/blog", { replace: true });
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setLoading(true);
    const params = new URLSearchParams({ page: 1, limit: 100 });
    if (search) params.set("search", search);
    if (topicSlug) params.set("category", topicSlug);
    if (tagFilter) params.set("tag", tagFilter);
    const t = setTimeout(() => {
      api.get(`/blog/posts?${params}`)
        .then((r) => { if (live) setPosts(r.data.posts || []); })
        .catch(() => { if (live) setPosts([]); })
        .finally(() => { if (live) setLoading(false); });
    }, search ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [search, topicSlug, tagFilter]);

  useEffect(() => { setPage(1); }, [search, topicSlug, tagFilter]);

  const filtering = !!(search || tagFilter);
  const clearFilters = () => { setSearch(""); setTagFilter(""); setSearchParams({}); };
  const unknownTopic = topicSlug && topicsLoaded && !topic;

  // All guides, first page: the latest large, the next three as "Also recent", the rest below.
  const sections = useMemo(() => {
    if (filtering || topicSlug) return { featured: null, recent: [], rest: posts };
    return { featured: posts[0] || null, recent: posts.slice(1, 4), rest: posts.slice(4) };
  }, [posts, filtering, topicSlug]);
  const pages = Math.max(1, Math.ceil(sections.rest.length / PAGE_SIZE));
  const shown = sections.rest.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const goTo = (p) => { setPage(p); document.getElementById("blog-all")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const restTitle = topicSlug ? `All ${topic?.name || ""} guides` : filtering ? "Search results" : "Keep exploring";

  return (
    <SitePage>
      {/* ── Title and search ── */}
      <Section tone="white" className="!pt-[6.5rem] sm:!pt-32 !pb-12 sm:!pb-16 overflow-x-clip">
        <div aria-hidden="true" className="hero-warm" style={{ opacity: 0.55 }} />
        <Container className="relative grid lg:grid-cols-[1.35fr_1fr] gap-10 lg:gap-14 items-end">
          <header id="blog-head">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm site-muted mb-6">
              <Link to="/" className="hover:text-[color:var(--site-brand-ink)] transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              {topic ? (
                <>
                  <Link to="/blog" className="hover:text-[color:var(--site-brand-ink)] transition-colors">Blog</Link>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span style={{ color: "var(--site-text)" }} aria-current="page">{topic.name}</span>
                </>
              ) : <span style={{ color: "var(--site-text)" }} aria-current="page">Blog</span>}
            </nav>
            <p className="site-eyebrow mb-4">{topic ? "Topic" : "The Arthaleads Journal"}</p>
            <h1 className="font-display site-ink font-extrabold tracking-[-0.03em] text-[34px] leading-[1.08] sm:text-[46px] lg:text-[52px]" style={{ textWrap: "balance" }}>
              {topic ? topic.name : <>How real estate teams <span className="site-dim">win more leads</span></>}
            </h1>
            <p className="mt-5 text-base sm:text-[17px] leading-relaxed max-w-[38rem]" style={{ textWrap: "pretty" }}>
              {topic ? topic.intro || topic.description : "Practical guides on CRM software, lead generation, WhatsApp, follow-ups, site visits and running a sales floor, written for Indian developers, brokers and channel partners."}
            </p>
          </header>

          <Card raised className="p-5 sm:p-6">
            <label htmlFor="blog-search" className="block font-display site-ink font-bold text-base mb-3">What do you want to solve?</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 site-muted" aria-hidden="true" />
              <input id="blog-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guides, e.g. site visits"
                className={`${inputCls} !py-3 !pl-11 !text-[15px]`} style={inputStyle} />
            </div>
            <dl id="blog-stats" className="grid grid-cols-2 mt-5 pt-5" style={{ borderTop: "1px solid var(--site-line)" }}>
              <div>
                <dt className="sr-only">Articles</dt>
                <dd className="font-display site-ink font-extrabold text-[28px] leading-none tabular-nums">{totalAll}</dd>
                <dd className="text-xs site-muted mt-1.5">Practical guides</dd>
              </div>
              <div className="pl-5" style={{ borderLeft: "1px solid var(--site-line)" }}>
                <dt className="sr-only">Topics</dt>
                <dd className="font-display site-ink font-extrabold text-[28px] leading-none tabular-nums">{categories.length}</dd>
                <dd className="text-xs site-muted mt-1.5">Topics</dd>
              </div>
            </dl>
          </Card>
        </Container>
      </Section>

      {/* ── Topic tabs ── */}
      <div className="blog-topics-bar">
        <Container>
          <nav id="blog-topics" aria-label="Topics" className="blog-topics">
            <TopicTab to="/blog" on={!topicSlug} label="All guides" count={totalAll} />
            {categories.map((c) => <TopicTab key={c._id} to={`/blog/category/${c.slug}`} on={c.slug === topicSlug} label={c.name} count={c.count} />)}
          </nav>
        </Container>
      </div>

      <Section tone="tint" className="!pt-12 sm:!pt-16">
        <Container>
          {/* ── Articles (api/blog-index.js fills this section in the static HTML) ── */}
          <section id="blog-articles" aria-label="Articles">
            {filtering && (
              <div className="flex flex-wrap items-center gap-2 text-sm mb-6">
                {tagFilter && <Chip onClear={() => setTagFilter("")}>#{tagFilter}</Chip>}
                {search && <Chip onClear={() => setSearch("")}>"{search}"</Chip>}
                <button type="button" onClick={clearFilters} className="text-xs underline underline-offset-2 ml-1 site-muted hover:text-[color:var(--site-ink)]">Clear all</button>
              </div>
            )}
            {loading ? (
              <Skeleton />
            ) : unknownTopic || posts.length === 0 ? (
              <Card raised className="text-center px-6 py-16 sm:py-20 max-w-2xl mx-auto">
                <span className="site-icon w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
                  <BookOpen className="w-6 h-6" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                </span>
                <h2 className="font-display site-ink text-xl font-bold mb-2">{unknownTopic ? "Topic not found" : filtering ? "No articles match" : "New articles are on the way"}</h2>
                <p className="text-sm">{unknownTopic ? "This topic does not exist or has no articles yet." : filtering ? "Try a different search or topic." : "Check back soon."}</p>
                {(filtering || unknownTopic) && <SiteButton to="/blog" onClick={clearFilters} className="mt-6">Show all guides</SiteButton>}
              </Card>
            ) : (
              <>
                {sections.featured && page === 1 && (
                  <div className="mb-14 lg:mb-16">
                    <ListHead eyebrow="Featured" title="The latest guide" />
                    <FeaturedCard post={sections.featured} />
                  </div>
                )}
                {sections.recent.length > 0 && page === 1 && (
                  <div className="mb-14 lg:mb-16">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] site-muted mb-5">Also recent</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
                      {sections.recent.map((p) => <SiteBlogCard key={p._id} post={p} />)}
                    </div>
                  </div>
                )}
                {sections.rest.length > 0 && (
                  <div id="blog-all" className="scroll-mt-28">
                    <ListHead eyebrow={topicSlug || filtering ? null : "All guides"} title={restTitle} note={articlesLabel(topicSlug || filtering ? posts.length : totalAll)} />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
                      {shown.map((p, i) => (
                        <Reveal key={p._id} delay={(i % 3) * 80} className="h-full">
                          <SiteBlogCard post={p} />
                        </Reveal>
                      ))}
                    </div>
                    {pages > 1 && <Pager page={page} pages={pages} onGo={goTo} />}
                  </div>
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

/** One topic in the tab row: a real link (crawlable), with its article count. */
function TopicTab({ to, on, label, count }) {
  return (
    <Link to={to} aria-current={on ? "page" : undefined} className={`blog-topic${on ? " is-on" : ""}`}>
      {label}<span className="blog-topic__count">{count}</span>
    </Link>
  );
}

function Pager({ page, pages, onGo }) {
  const btn = "w-10 h-10 rounded-xl flex items-center justify-center transition disabled:opacity-30 hover:border-[color:var(--site-brand)] site-ink";
  const plain = { border: "1px solid var(--site-line-strong)", background: "var(--site-card)" };
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-2 mt-12">
      <button type="button" disabled={page <= 1} onClick={() => onGo(page - 1)} aria-label="Previous page" className={btn} style={plain}>
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      {[...Array(pages)].map((_, i) => {
        const on = page === i + 1;
        return (
          <button type="button" key={i} onClick={() => onGo(i + 1)} aria-current={on ? "page" : undefined}
            className={`w-10 h-10 rounded-xl text-sm font-semibold tabular-nums transition ${on ? "text-white" : "hover:border-[color:var(--site-brand)] site-ink"}`}
            style={on ? { background: "var(--brand-btn)" } : plain}>
            {i + 1}
          </button>
        );
      })}
      <button type="button" disabled={page >= pages} onClick={() => onGo(page + 1)} aria-label="Next page" className={btn} style={plain}>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
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

export default function PublicBlog() {
  return <BlogPageInner />;
}
