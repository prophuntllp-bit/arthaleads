import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import DOMPurify from "dompurify";
import api from "../services/api";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Link2, Linkedin, MessageCircle, Search, Tag } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import BlogCard, { CategoryLabel, authorOf, blogTheme, fmtDate, sizedImage } from "../components/BlogCard";
import { usePublicTheme } from "../context/PublicThemeContext";

const SITE = "https://www.arthaleads.com";

// ── SEO meta helper ────────────────────────────────────────────────────────────
function robotsValue(r = {}) {
  const parts = [r.index === false ? "noindex" : "index", r.follow === false ? "nofollow" : "follow"];
  if (r.noArchive) parts.push("noarchive");
  if (r.noImageIndex) parts.push("noimageindex");
  if (r.noSnippet) parts.push("nosnippet");
  else if (Number.isInteger(r.maxSnippet)) parts.push(`max-snippet:${r.maxSnippet}`);
  parts.push(`max-image-preview:${r.maxImagePreview || "large"}`);
  if (Number.isInteger(r.maxVideoPreview)) parts.push(`max-video-preview:${r.maxVideoPreview}`);
  return parts.join(", ");
}

function useSEO(post) {
  useEffect(() => {
    if (!post) return;
    const title = post.metaTitle || post.title;
    const desc  = post.metaDescription || post.excerpt;
    const url   = `${SITE}/blog/${post.slug}`;
    const full  = `${title} - Arthaleads`;
    const image = post.ogImage || post.featuredImage;
    const prevRobots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "index, follow";

    document.title = full;
    setMeta("description",       desc);
    setMeta("robots",            robotsValue(post.robots));
    const keywords = [post.focusKeyword, ...(post.secondaryKeywords || [])].filter(Boolean);
    if (keywords.length) setMeta("keywords", keywords.join(", "));
    setMeta("og:title",          post.ogTitle || full);
    setMeta("og:description",    post.ogDescription || desc);
    setMeta("og:url",            url);
    setMeta("og:type",           "article");
    if (image) setMeta("og:image", image);
    setMeta("twitter:card",      post.twitterCard || "summary_large_image");
    setMeta("twitter:title",     post.twitterTitle || post.ogTitle || full);
    setMeta("twitter:description", post.twitterDescription || post.ogDescription || desc);
    if (post.twitterImage || image) setMeta("twitter:image", post.twitterImage || image);

    let canon = document.querySelector("link[rel='canonical']");
    if (!canon) { canon = document.createElement("link"); canon.setAttribute("rel", "canonical"); document.head.appendChild(canon); }
    canon.setAttribute("href", post.canonicalUrl || url);

    const author = post.authorName || post.author?.name;
    const allKeywords = [...keywords, ...(post.tags || [])];
    document.getElementById("blog-jsonld")?.remove();
    const script = document.createElement("script");
    script.id = "blog-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type":    post.schemaType || "BlogPosting",
      "headline": post.title,
      "description": desc,
      "image": image || "",
      "datePublished": post.publishedAt,
      "dateModified":  post.updatedAt,
      "wordCount": post.readingTime ? post.readingTime * 200 : undefined,
      "keywords": allKeywords.length ? allKeywords.join(", ") : "real estate CRM, lead management, property CRM India",
      "articleSection": post.category?.name || undefined,
      "author": author && author !== "Arthaleads Team"
        ? { "@type": "Person", "name": author }
        : { "@type": "Organization", "name": "Arthaleads", "url": SITE },
      "publisher": {
        "@type": "Organization",
        "name": "Arthaleads",
        "url": SITE,
        "logo": { "@type": "ImageObject", "url": `${SITE}/logo.png` },
      },
      "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    });
    document.head.appendChild(script);

    document.getElementById("breadcrumb-jsonld")?.remove();
    const bcScript = document.createElement("script");
    bcScript.id = "breadcrumb-jsonld";
    bcScript.type = "application/ld+json";
    const crumb = post.breadcrumbTitle || post.title;
    const breadcrumbs = [
      { "@type": "ListItem", "position": 1, "name": "Home",  "item": SITE },
      { "@type": "ListItem", "position": 2, "name": "Blog",  "item": `${SITE}/blog` },
    ];
    if (post.category?.name) {
      breadcrumbs.push({ "@type": "ListItem", "position": 3, "name": post.category.name, "item": `${SITE}/blog?category=${post.category._id}` });
      breadcrumbs.push({ "@type": "ListItem", "position": 4, "name": crumb, "item": url });
    } else {
      breadcrumbs.push({ "@type": "ListItem", "position": 3, "name": crumb, "item": url });
    }
    bcScript.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": breadcrumbs });
    document.head.appendChild(bcScript);

    return () => {
      document.title = "Arthaleads - Real Estate CRM";
      setMeta("robots", prevRobots);
      document.getElementById("blog-jsonld")?.remove();
      document.getElementById("breadcrumb-jsonld")?.remove();
    };
  }, [post]);
}

function setMeta(name, content) {
  if (!content) return;
  const isProp = name.startsWith("og:") || name.startsWith("twitter:");
  const attr = isProp ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

// ── HTML sanitizer - uses DOMPurify for robust XSS protection ─────────────────
function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "a", "br", "span", "code", "mark"],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
    FORCE_BODY: false,
  });
}

const stripTags = (html) => String(html || "").replace(/<[^>]*>/g, "").trim();

// ── Block renderer ─────────────────────────────────────────────────────────────
function RenderBlock({ block, t, isDark }) {
  const link = "[&_a]:text-[#e85d04] [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-[#ff6b00]/40 hover:[&_a]:decoration-[#ff6b00]";
  switch (block.type) {
    case "paragraph":
      return <p className={`leading-[1.85] mb-5 text-[17px] ${link}`} style={{ color: t.text }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />;
    case "h2":
      return <h2 id={`sec-${block.id}`} className={`scroll-mt-28 text-[1.7rem] sm:text-3xl font-black mt-14 mb-5 leading-tight tracking-tight ${link}`} style={{ color: t.heading, textWrap: "balance" }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />;
    case "h3":
      return <h3 id={`sec-${block.id}`} className="scroll-mt-28 text-xl sm:text-2xl font-extrabold mt-10 mb-3 leading-tight tracking-tight" style={{ color: t.heading }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />;
    case "h4":
      return <h4 className="text-lg font-bold mt-8 mb-2 leading-tight" style={{ color: t.heading }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />;
    case "image":
      return block.content ? (
        <figure className="my-10">
          <img src={sizedImage(block.content, 1200)} alt={block.alt || ""} loading="lazy" decoding="async" className="rounded-[22px] w-full" />
          {block.caption && <figcaption className="text-center text-xs mt-3" style={{ color: t.muted }}>{block.caption}</figcaption>}
        </figure>
      ) : null;
    case "quote":
      return (
        <blockquote className="my-9 pl-6 py-1 border-l-[3px] border-[#ff6b00]">
          <p className="text-xl sm:text-[1.4rem] font-semibold leading-snug" style={{ color: t.heading }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} />
        </blockquote>
      );
    case "bulletList":
      return (
        <ul className="list-none space-y-3 my-6 pl-0">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[17px] leading-relaxed" style={{ color: t.text }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b00] shrink-0 mt-[0.7em]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "numberedList":
      return (
        <ol className="space-y-3 my-6 pl-0">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex items-start gap-3.5 text-[17px] leading-relaxed" style={{ color: t.text }}>
              <span className="w-7 h-7 rounded-full bg-[#ff6b00]/12 text-[#e85d04] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case "code":
      return (
        <div className="my-8 rounded-2xl overflow-hidden" style={{ background: "#1e1e2e" }}>
          {block.language && <div className="px-4 py-2 border-b border-white/10"><span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{block.language}</span></div>}
          <pre className="p-5 overflow-x-auto text-sm font-mono text-green-300 leading-relaxed"><code>{block.content}</code></pre>
        </div>
      );
    case "divider":
      return <hr className="my-12 border-0 h-px" style={{ background: t.rule }} />;
    default:
      return null;
  }
}

// ── Sidebar pieces ────────────────────────────────────────────────────────────
function useActiveHeading(ids) {
  const [active, setActive] = useState(ids[0] || "");
  const key = ids.join("|");
  useEffect(() => {
    if (!ids.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-110px 0px -65% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

function Contents({ headings, t }) {
  const active = useActiveHeading(headings.map((h) => h.id));
  if (headings.length < 2) return null;
  return (
    <nav aria-label="In this article">
      <h3 className="text-sm font-bold mb-3" style={{ color: t.heading }}>In this article</h3>
      <ol className="space-y-1">
        {headings.map((h, i) => {
          const on = active === h.id;
          return (
            <li key={h.id}>
              <a href={`#${h.id}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="flex gap-3 py-1.5 text-sm leading-snug transition-colors"
                style={{ color: on ? "#e85d04" : t.body, fontWeight: on ? 600 : 400 }}>
                <span className="font-bold tabular-nums text-[#ff6b00] shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span>{h.text}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Sidebar({ post, headings, related, categories, t }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <aside className="lg:sticky lg:top-28 self-start rounded-[26px] border p-6 space-y-6" style={{ background: t.card, borderColor: t.cardBorder }}>
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff6b00] mb-3">Explore the blog</h3>
        <form onSubmit={(e) => { e.preventDefault(); navigate(`/blog${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); }} className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: t.muted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" aria-label="Search articles"
            className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ff6b00]" style={{ background: t.field, borderColor: t.cardBorder, color: t.heading }} />
        </form>
        {categories.length > 0 && (
          <label className="relative flex items-center mt-3">
            <span className="sr-only">Topic</span>
            <select defaultValue="" onChange={(e) => navigate(e.target.value ? `/blog?category=${e.target.value}` : "/blog")}
              className="w-full appearance-none rounded-xl border py-2.5 pl-3.5 pr-9 text-sm outline-none cursor-pointer focus:border-[#ff6b00]" style={{ background: t.field, borderColor: t.cardBorder, color: t.heading }}>
              <option value="">All topics</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 pointer-events-none" style={{ color: t.muted }} />
          </label>
        )}
      </div>

      {headings.length >= 2 && <div className="pt-6" style={{ borderTop: `1px solid ${t.rule}` }}><Contents headings={headings} t={t} /></div>}

      {related.length > 0 && (
        <div className="pt-6" style={{ borderTop: `1px solid ${t.rule}` }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: t.heading }}>Suggested reading</h3>
          <ul className="space-y-4">
            {related.slice(0, 3).map((p) => (
              <li key={p._id}>
                <Link to={`/blog/${p.slug}`} className="group block">
                  <CategoryLabel post={p} className="!text-[10px]" />
                  <span className="block text-sm font-semibold leading-snug mt-1 group-hover:text-[#ff6b00] transition-colors" style={{ color: t.heading }}>{p.title}</span>
                  <span className="block text-xs mt-1" style={{ color: t.muted }}>{p.readingTime || 1} min read</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function ShareButtons({ post, t }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE}/blog/${post.slug}`;
  const base = "w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:border-[#ff6b00] hover:text-[#ff6b00]";
  const style = { borderColor: t.cardBorder, color: t.body };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center gap-2" aria-label="Share this article">
      <a className={base} style={style} aria-label="Share on LinkedIn" target="_blank" rel="noopener noreferrer"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}><Linkedin className="w-4 h-4" /></a>
      <a className={base} style={style} aria-label="Share on WhatsApp" target="_blank" rel="noopener noreferrer"
        href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`}><MessageCircle className="w-4 h-4" /></a>
      <button type="button" className={base} style={style} onClick={copy} aria-label={copied ? "Link copied" : "Copy link"}>
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

function BlogPostInner() {
  const { isDark } = usePublicTheme();
  const t = blogTheme(isDark);
  const { slug } = useParams();
  const [post, setPost]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated]   = useState([]);
  const [categories, setCategories] = useState([]);

  useSEO(post);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    window.scrollTo(0, 0);
    api.get(`/blog/posts/${slug}`)
      .then((r) => {
        // Studio "Redirect Destination": the server already redirects on a full page load.
        const to = r.data.post?.redirectUrl;
        if (to) { window.location.replace(to); return; }
        setPost(r.data.post);
      })
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    api.get("/blog/categories").then((r) => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  // Same-topic articles first, then the newest to fill the row.
  useEffect(() => {
    if (!post) return;
    api.get("/blog/posts?limit=9").then((r) => {
      const others = (r.data.posts || []).filter((p) => p._id !== post._id);
      const same = others.filter((p) => p.category?._id && p.category._id === post.category?._id);
      setRelated([...same, ...others.filter((p) => !same.includes(p))].slice(0, 3));
    }).catch(() => setRelated([]));
  }, [post]);

  const headings = useMemo(
    () => (post?.blocks || []).filter((b) => b.type === "h2").map((b) => ({ id: `sec-${b.id}`, text: stripTags(b.content) })).filter((h) => h.text),
    [post]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.bg }}>
        <div className="w-10 h-10 rounded-full border-2 border-[#ff6b00] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen" style={{ background: t.bg }}>
        <PublicNav />
        <div className="flex flex-col items-center justify-center px-4 text-center min-h-[70vh]">
          <BookOpen className="w-16 h-16 text-[#ff6b00]/40 mb-6" />
          <h1 className="text-2xl font-bold mb-2" style={{ color: t.heading }}>Article not found</h1>
          <p className="mb-6" style={{ color: t.body }}>This article doesn't exist or has been removed.</p>
          <Link to="/blog" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#ff6b00] hover:bg-[#e85d04] text-white font-semibold transition">
            <ArrowLeft className="w-4 h-4" /> Back to the blog
          </Link>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const initials = authorOf(post).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: t.bg }}>
      <PublicNav />

      {/* ── Article header ── */}
      <header className="pt-28 lg:pt-36" style={{ background: isDark ? "#0d0d1a" : "linear-gradient(180deg,#fff7f0 0%,#ffffff 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm mb-6" style={{ color: t.muted }}>
            <Link to="/" className="hover:text-[#ff6b00] transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/blog" className="hover:text-[#ff6b00] transition-colors">Blog</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="truncate max-w-[60ch]" style={{ color: t.body }} aria-current="page">{post.title}</span>
          </nav>

          <div className="max-w-4xl">
            {post.category && (
              <Link to={`/blog?category=${post.category._id}`}
                className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] bg-[#ff6b00]/10 text-[#e85d04] hover:bg-[#ff6b00]/20 transition-colors mb-5">
                {post.category.name}
              </Link>
            )}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black leading-[1.07] tracking-tight" style={{ color: t.heading, textWrap: "balance" }}>
              {post.title}
            </h1>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-5 max-w-4xl">
            <div className="flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-full bg-[#ff6b00] text-white font-bold flex items-center justify-center" aria-hidden="true">{initials}</span>
              <div>
                <div className="font-semibold" style={{ color: t.heading }}>{authorOf(post)}</div>
                <div className="text-sm" style={{ color: t.muted }}>{fmtDate(post.publishedAt)} · {post.readingTime || 1} min read</div>
              </div>
            </div>
            <ShareButtons post={post} t={t} />
          </div>

          {post.excerpt && (
            <p className="mt-9 max-w-4xl text-lg sm:text-xl leading-relaxed pl-5 border-l-[3px] border-[#ff6b00]" style={{ color: t.body }}>
              {post.excerpt}
            </p>
          )}

          {post.featuredImage && (
            <figure className="mt-10 max-w-5xl">
              <img src={sizedImage(post.featuredImage, 1400)} alt={post.featuredImageAlt || post.title} loading="eager" fetchpriority="high"
                className="w-full rounded-[26px] sm:rounded-[32px] object-cover max-h-[520px]" />
            </figure>
          )}
        </div>
      </header>

      {/* ── Body + sidebar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10 xl:gap-16">
        <article className="min-w-0 max-w-[44rem]">
          {(post.blocks || []).map((block) => <RenderBlock key={block.id} block={block} t={t} isDark={isDark} />)}

          {post.tags?.length > 0 && (
            <div className="mt-12 pt-7 flex flex-wrap items-center gap-2" style={{ borderTop: `1px solid ${t.rule}` }}>
              <Tag className="w-3.5 h-3.5" style={{ color: t.muted }} />
              {post.tags.map((tag) => (
                <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-colors hover:bg-[#ff6b00]/20"
                  style={{ background: isDark ? "rgba(255,107,0,0.14)" : "#fff0e3", color: isDark ? "#fda462" : "#c2410c" }}>#{tag}</Link>
              ))}
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-[#e85d04] hover:gap-3 transition-all">
              <ArrowLeft className="w-4 h-4" /> Back to all articles
            </Link>
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#ff6b00] hover:bg-[#e85d04] text-white text-sm font-bold transition shadow-lg shadow-orange-500/25">
              Try Arthaleads free <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="mt-12 rounded-[26px] border p-7" style={{ background: t.card, borderColor: t.cardBorder }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: t.heading }}>About Arthaleads</h3>
            <p className="text-sm leading-relaxed" style={{ color: t.body }}>
              Arthaleads is a CRM for Indian real estate sales teams, by Vistrow Technologies. It brings enquiries from ads, portals, your website and WhatsApp into one workspace,
              with follow-ups, projects, bookings and invoices. These articles are educational and are not a substitute for advice based on your own business and data.
            </p>
          </div>
        </article>

        <Sidebar post={post} headings={headings} related={related} categories={categories} t={t} />
      </div>

      {/* ── Keep reading ── */}
      {related.length > 0 && (
        <section aria-label="Suggested articles" className="py-14 lg:py-20" style={{ background: t.soft, borderTop: `1px solid ${t.rule}` }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b00]">Keep reading</span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-3 mb-8" style={{ color: t.heading }}>Suggested articles for you</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {related.map((p) => <BlogCard key={p._id} post={p} isDark={isDark} />)}
            </div>
          </div>
        </section>
      )}

      <PublicFooter />
    </div>
  );
}

export default function PublicBlogPost() {
  return <BlogPostInner />;
}
