// pages/PublicBlogPost.jsx - /blog/:slug on the shared marketing theme (components/site/*).
// The article body is drawn from the post's blocks inside .blog-prose (styles.css).
// api/blog-post.js serves each post as this page's own HTML (built once by
// scripts/prerender.mjs from `initial`, a placeholder post, and filled in per
// post), plus the blog-jsonld / breadcrumb-jsonld scripts this page replaces
// (same ids) once it loads. The live page always fetches the post itself.
import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CRM_SIGNUP_URL } from "../utils/crmLinks";
import DOMPurify from "dompurify";
import api from "../services/api";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Link2, Search, Tag } from "lucide-react";
import { WhatsAppLogo } from "../components/site/BrandLogos";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { Reveal } from "../components/motion/Motion";
import { authorOf, fmtDate, sizedImage } from "../components/BlogCard";
import { SiteBlogCard, PostCategory } from "./PublicBlog";

const SITE = "https://www.arthaleads.com";

const inputCls = "w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-[color:var(--site-brand)]";
const inputStyle = { background: "var(--site-bg)", border: "1px solid var(--site-line-strong)", color: "var(--site-ink)" };
const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

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
    const full  = title.length > 47 ? title : `${title} - Arthaleads`;   // same rule as api/blog-post.js
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

    const author = post.byline || post.author?.name;
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
  // Build time (renderBlogTemplate) has no DOM for DOMPurify; its content is our own placeholders.
  if (typeof DOMPurify.sanitize !== "function") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "a", "br", "span", "code", "mark"],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
    FORCE_BODY: false,
  });
}

const stripTags = (html) => String(html || "").replace(/<[^>]*>/g, "").trim();

// ── Block renderer ─────────────────────────────────────────────────────────────
// Plain semantic elements; .blog-prose (styles.css) gives them their look.
function RenderBlock({ block }) {
  const html = (s) => ({ __html: sanitizeHtml(s) });
  switch (block.type) {
    case "paragraph":
      return <p dangerouslySetInnerHTML={html(block.content)} />;
    case "h2":
      return <h2 id={`sec-${block.id}`} className="font-display" dangerouslySetInnerHTML={html(block.content)} />;
    case "h3":
      return <h3 id={`sec-${block.id}`} className="font-display" dangerouslySetInnerHTML={html(block.content)} />;
    case "h4":
      return <h4 className="font-display" dangerouslySetInnerHTML={html(block.content)} />;
    case "image":
      return block.content ? (
        <figure>
          <img src={sizedImage(block.content, 1200)} alt={block.alt || ""} loading="lazy" decoding="async" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      ) : null;
    case "quote":
      return (
        <blockquote>
          <p className="font-display" dangerouslySetInnerHTML={html(block.content)} />
        </blockquote>
      );
    case "bulletList":
      return (
        <ul>
          {(block.items || []).map((item, i) => <li key={i} dangerouslySetInnerHTML={html(item)} />)}
        </ul>
      );
    case "numberedList":
      return (
        <ol>
          {(block.items || []).map((item, i) => <li key={i} dangerouslySetInnerHTML={html(item)} />)}
        </ol>
      );
    case "code":
      return (
        <div className="blog-code">
          {block.language && <div className="blog-code__lang">{block.language}</div>}
          <pre><code>{block.content}</code></pre>
        </div>
      );
    case "divider":
      return <hr />;
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

function Contents({ headings }) {
  const active = useActiveHeading(headings.map((h) => h.id));
  if (headings.length < 2) return null;
  return (
    <nav aria-label="In this article">
      <h3 className="font-display text-sm font-bold site-ink mb-3">In this article</h3>
      <ol className="space-y-1">
        {headings.map((h, i) => {
          const on = active === h.id;
          return (
            <li key={h.id}>
              <a href={`#${h.id}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="flex gap-3 py-1.5 text-sm leading-snug transition-colors hover:text-[color:var(--site-ink)]"
                style={{ color: on ? "var(--site-brand-ink)" : undefined, fontWeight: on ? 600 : 400 }}>
                <span className="font-bold tabular-nums shrink-0" style={{ color: "var(--site-brand-ink)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{h.text}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Sidebar({ headings, related, categories }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const rule = { borderTop: "1px solid var(--site-line)" };
  return (
    <Card as="aside" raised className="lg:sticky lg:top-28 self-start p-6 space-y-6 min-w-0">
      <div>
        <h3 className="site-eyebrow !text-[11px] mb-3">Explore the blog</h3>
        <form onSubmit={(e) => { e.preventDefault(); navigate(`/blog${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); }} className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 site-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" aria-label="Search articles"
            className={`${inputCls} !py-2.5 !pl-10 !rounded-xl`} style={inputStyle} />
        </form>
        {categories.length > 0 && (
          <label className="relative flex items-center mt-3">
            <span className="sr-only">Topic</span>
            <select defaultValue="" onChange={(e) => navigate(e.target.value ? `/blog?category=${e.target.value}` : "/blog")}
              className={`${inputCls} !py-2.5 !pl-3.5 !pr-9 !rounded-xl appearance-none cursor-pointer`} style={inputStyle}>
              <option value="">All topics</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 pointer-events-none site-muted" aria-hidden="true" />
          </label>
        )}
      </div>

      {headings.length >= 2 && <div className="pt-6" style={rule}><Contents headings={headings} /></div>}

      {related.length > 0 && (
        <div className="pt-6" style={rule}>
          <h3 className="font-display text-sm font-bold site-ink mb-3">Suggested reading</h3>
          <ul className="space-y-4">
            {related.slice(0, 3).map((p) => (
              <li key={p._id}>
                <Link to={`/blog/${p.slug}`} className="group block">
                  <PostCategory post={p} className="!text-[10px]" />
                  <span className="block text-sm font-semibold site-ink leading-snug mt-1 group-hover:text-[color:var(--site-brand-ink)] transition-colors">{p.title}</span>
                  <span className="block text-xs site-muted mt-1">{p.readingTime || 1} min read</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function LinkedInLogo({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function ShareButtons({ post }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE}/blog/${post.slug}`;
  const base = "w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:border-[color:var(--site-brand)]";
  const style = { border: "1px solid var(--site-line-strong)", background: "var(--site-card)" };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center gap-2" aria-label="Share this article">
      <a className={`${base} text-[#0A66C2]`} style={style} aria-label="Share on LinkedIn" target="_blank" rel="noopener noreferrer"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}><LinkedInLogo /></a>
      <a className={base} style={style} aria-label="Share on WhatsApp" target="_blank" rel="noopener noreferrer"
        href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`}><WhatsAppLogo className="w-4 h-4" /></a>
      <button type="button" className={`${base} site-ink`} style={style} onClick={copy} aria-label={copied ? "Link copied" : "Copy link"}>
        {copied ? <Check className="w-4 h-4" style={{ color: "#16a34a" }} /> : <Link2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

function BlogPostInner({ initial }) {
  const { slug } = useParams();
  const [post, setPost]         = useState(initial?.post || null);
  const [loading, setLoading]   = useState(!initial);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated]   = useState([]);
  const [categories, setCategories] = useState(initial?.categories || []);

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

  const fromBlocks = useMemo(
    () => (post?.blocks || []).filter((b) => b.type === "h2").map((b) => ({ id: `sec-${b.id}`, text: stripTags(b.content) })).filter((h) => h.text),
    [post]
  );
  const headings = initial?.headings || fromBlocks;

  // No nav/footer while loading: main.jsx swaps out the server's static copy
  // of the article once the live page renders its footer.
  if (loading) {
    return (
      <div className="site min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: "var(--site-brand)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <SitePage>
        <Section tone="white" className="!pt-[6.5rem] sm:!pt-32 overflow-x-clip">
          <div aria-hidden="true" className="hero-warm" style={{ opacity: 0.55 }} />
          <Container className="relative flex flex-col items-center justify-center text-center min-h-[50vh]">
            <span className="site-icon w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={iconTile}>
              <BookOpen className="w-7 h-7" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
            </span>
            <h1 className="font-display site-ink font-extrabold tracking-[-0.02em] text-[28px] sm:text-[36px] mb-3">Article not found</h1>
            <p className="mb-7 text-base sm:text-lg">This article doesn't exist or has been removed.</p>
            <SiteButton to="/blog"><ArrowLeft className="w-4 h-4" /> Back to the blog</SiteButton>
          </Container>
        </Section>
      </SitePage>
    );
  }

  const initials = authorOf(post).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SitePage>
      {/* ── Article header ── */}
      <Section tone="white" className="!pt-[6.5rem] sm:!pt-32 !pb-10 sm:!pb-14 overflow-x-clip">
        <div aria-hidden="true" className="hero-warm" style={{ opacity: 0.55 }} />
        <Container className="relative">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm site-muted mb-6">
            <Link to="/" className="hover:text-[color:var(--site-brand-ink)] transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <Link to="/blog" className="hover:text-[color:var(--site-brand-ink)] transition-colors">Blog</Link>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="truncate max-w-[60ch]" style={{ color: "var(--site-text)" }} aria-current="page">{post.title}</span>
          </nav>

          <div className="max-w-4xl">
            {post.category && (
              <Link to={`/blog?category=${post.category._id}`} className="site-eyebrow inline-block hover:underline underline-offset-4 mb-5">
                {post.category.name}
              </Link>
            )}
            <h1 className="font-display site-ink font-extrabold tracking-[-0.03em] text-[34px] leading-[1.08] sm:text-[46px] lg:text-[52px]" style={{ textWrap: "balance" }}>
              {post.title}
            </h1>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-5 max-w-4xl">
            <div className="flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-full text-white font-bold flex items-center justify-center" style={{ background: "var(--brand-btn)" }} aria-hidden="true">{initials}</span>
              <div>
                <div className="font-semibold site-ink">{authorOf(post)}</div>
                <div className="text-sm site-muted">{fmtDate(post.publishedAt)} · {post.readingTime || 1} min read</div>
              </div>
            </div>
            <ShareButtons post={post} />
          </div>

          {post.excerpt && (
            <p className="mt-9 max-w-4xl text-lg sm:text-xl leading-relaxed pl-5" style={{ borderLeft: "3px solid var(--site-brand)" }}>
              {post.excerpt}
            </p>
          )}

          {post.featuredImage && (
            <figure className="blog-cover mt-10 max-w-5xl overflow-hidden !rounded-[24px] sm:!rounded-[28px]" style={{ boxShadow: "var(--site-shadow-lg)" }}>
              {/* Sanity image URLs end in -<width>x<height>.<ext>: give the browser the size up front so nothing shifts. */}
              <img src={sizedImage(post.featuredImage, 1400)} alt={post.featuredImageAlt || post.title} loading="eager" fetchpriority="high"
                srcSet={`${sizedImage(post.featuredImage, 700)} 700w, ${sizedImage(post.featuredImage, 1400)} 1400w`}
                sizes="(min-width: 1100px) 1024px, 92vw"
                {...imageSize(post.featuredImage)}
                className="block w-full h-auto object-cover aspect-video" />
            </figure>
          )}
        </Container>
      </Section>

      {/* ── Body + sidebar ── */}
      <Section tone="white" className="!pt-2 sm:!pt-4">
        <Container className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10 xl:gap-16">
          <article className="min-w-0 max-w-[44rem]">
            <div className="blog-prose">
              {(post.blocks || []).map((block) => <RenderBlock key={block.id} block={block} />)}
            </div>

            {post.tags?.length > 0 && (
              <div className="mt-12 pt-7 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--site-line)" }}>
                <Tag className="w-3.5 h-3.5 site-muted" aria-hidden="true" />
                {post.tags.map((tag) => (
                  <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="site-chip px-3 py-1 rounded-full text-xs font-medium transition-colors hover:text-[color:var(--site-brand-ink)]">#{tag}</Link>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
              <Link to="/blog" className="site-link text-sm hover:gap-2 transition-all">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to all articles
              </Link>
              <div className="flex flex-wrap gap-2.5">
                <SiteButton to="/book-demo">Book a Demo <ArrowRight className="w-4 h-4" /></SiteButton>
                <SiteButton href={CRM_SIGNUP_URL} external variant="secondary">Try Arthaleads free</SiteButton>
              </div>
            </div>

            <Card className="mt-12 p-6 sm:p-7">
              <h3 className="font-display text-lg font-bold site-ink mb-2">About Arthaleads</h3>
              <p className="text-sm leading-relaxed">
                Arthaleads is a CRM for Indian real estate sales teams, by Vistrow Technologies. It brings enquiries from ads, portals, your website and WhatsApp into one workspace,
                with follow-ups, projects, bookings and invoices. These articles are educational and are not a substitute for advice based on your own business and data.
              </p>
            </Card>
          </article>

          <Sidebar headings={headings} related={related} categories={categories} />
        </Container>
      </Section>

      {/* ── Keep reading ── */}
      {related.length > 0 && (
        <Section tone="tint" aria-label="Suggested articles">
          <Container>
            <SectionHeader eyebrow="Keep reading" title="Suggested articles for you" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {related.map((p, i) => (
                <Reveal key={p._id} delay={i * 80} className="h-full">
                  <SiteBlogCard post={p} />
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      )}
    </SitePage>
  );
}

const imageSize = (url) => { const m = /-(\d+)x(\d+)\.\w+(?:\?|$)/.exec(url || ""); return m ? { width: Number(m[1]), height: Number(m[2]) } : {}; };

export default function PublicBlogPost({ initial }) {
  return <BlogPostInner initial={initial} />;
}
