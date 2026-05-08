import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Clock, Calendar, ArrowLeft, Tag, BookOpen, Share2, ChevronRight } from "lucide-react";

// ── SEO meta helper ────────────────────────────────────────────────────────────
function useSEO(post) {
  useEffect(() => {
    if (!post) return;
    const title = post.metaTitle || post.title;
    const desc  = post.metaDescription || post.excerpt;
    const url   = `https://www.arthaleads.com/blog/${post.slug}`;

    document.title = `${title} — Arthaleads`;
    setMeta("description",       desc);
    setMeta("og:title",          title);
    setMeta("og:description",    desc);
    setMeta("og:url",            url);
    setMeta("og:type",           "article");
    if (post.featuredImage) setMeta("og:image", post.featuredImage);
    setMeta("twitter:card",      "summary_large_image");
    setMeta("twitter:title",     title);
    setMeta("twitter:description", desc);

    // Canonical link
    let canon = document.querySelector("link[rel='canonical']");
    if (!canon) { canon = document.createElement("link"); canon.setAttribute("rel", "canonical"); document.head.appendChild(canon); }
    canon.setAttribute("href", url);

    // JSON-LD Article schema
    const existing = document.getElementById("blog-jsonld");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "blog-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type":    "Article",
      "headline": post.title,
      "description": desc,
      "image": post.featuredImage || "",
      "datePublished": post.publishedAt,
      "dateModified":  post.updatedAt,
      "author":        { "@type": "Organization", "name": "Arthaleads" },
      "publisher":     { "@type": "Organization", "name": "Arthaleads", "url": "https://www.arthaleads.com" },
      "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    });
    document.head.appendChild(script);

    return () => {
      document.title = "Arthaleads — Real Estate CRM";
      const s = document.getElementById("blog-jsonld");
      if (s) s.remove();
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

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// ── Block renderer ─────────────────────────────────────────────────────────────
function RenderBlock({ block }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p
          className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 text-base"
          dangerouslySetInnerHTML={{ __html: block.content || "" }}
        />
      );
    case "h2":
      return (
        <h2
          className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-10 mb-4 leading-tight"
          dangerouslySetInnerHTML={{ __html: block.content || "" }}
        />
      );
    case "h3":
      return (
        <h3
          className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-3 leading-tight"
          dangerouslySetInnerHTML={{ __html: block.content || "" }}
        />
      );
    case "h4":
      return (
        <h4
          className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-6 mb-2 leading-tight"
          dangerouslySetInnerHTML={{ __html: block.content || "" }}
        />
      );
    case "image":
      return block.content ? (
        <figure className="my-8">
          <img
            src={block.content}
            alt={block.alt || ""}
            className="rounded-2xl w-full shadow-md"
            loading="lazy"
          />
          {block.caption && (
            <figcaption className="text-center text-xs text-gray-500 mt-2 italic">
              {block.caption}
            </figcaption>
          )}
        </figure>
      ) : null;
    case "quote":
      return (
        <blockquote className="border-l-4 border-orange-400 pl-6 py-2 my-6 bg-orange-50 dark:bg-orange-500/5 rounded-r-xl">
          <p
            className="text-lg italic text-gray-600 dark:text-gray-400 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: block.content || "" }}
          />
        </blockquote>
      );
    case "bulletList":
      return (
        <ul className="list-none space-y-2 my-4 pl-0">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
              <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    case "numberedList":
      return (
        <ol className="space-y-2 my-4 pl-0">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
              <span className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      );
    case "code":
      return (
        <div className="my-6 rounded-xl overflow-hidden shadow-inner" style={{ background: "#1e1e2e" }}>
          {block.language && (
            <div className="px-4 py-2 border-b border-white/10">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{block.language}</span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-sm font-mono text-green-300 leading-relaxed">
            <code>{block.content}</code>
          </pre>
        </div>
      );
    case "divider":
      return (
        <div className="flex items-center gap-4 my-10">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>
      );
    default:
      return null;
  }
}

// ── Table of Contents from headings ───────────────────────────────────────────
function TableOfContents({ blocks }) {
  const headings = blocks.filter((b) => b.type === "h2" || b.type === "h3");
  if (headings.length < 2) return null;
  return (
    <nav className="rounded-2xl border p-5 mb-8" style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-app-soft mb-3">Table of Contents</h3>
      <ol className="space-y-1.5">
        {headings.map((h, i) => (
          <li key={i} className={`flex items-center gap-2 ${h.type === "h3" ? "pl-4" : ""}`}>
            <ChevronRight className="w-3 h-3 text-orange-400 flex-shrink-0" />
            <span
              className="text-sm text-app-soft hover:text-orange-500 cursor-pointer transition leading-snug"
              dangerouslySetInnerHTML={{ __html: h.content || `Section ${i + 1}` }}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function PublicBlogPost() {
  const { slug }      = useParams();
  const navigate      = useNavigate();
  const [post, setPost]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSEO(post);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.get(`/blog/posts/${slug}`)
      .then((r) => setPost(r.data.post))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: post.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
        <div className="w-10 h-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ background: "var(--app-bg)" }}>
        <BookOpen className="w-16 h-16 text-orange-200 mb-6" />
        <h1 className="text-2xl font-bold text-app mb-2">Post Not Found</h1>
        <p className="text-app-soft mb-6">This article doesn't exist or has been removed.</p>
        <Link to="/blog" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: "rgba(var(--app-surface-rgb, 255,255,255), 0.95)", borderColor: "var(--app-border)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/blog" className="flex items-center gap-2 text-app-soft hover:text-orange-500 transition text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Blog
          </Link>
          <div className="flex-1 h-px" style={{ background: "var(--app-border)" }} />
          <Link to="/" className="text-sm font-bold text-orange-500">Arthaleads</Link>
        </div>
      </nav>

      {/* ── Article ── */}
      <article className="max-w-3xl mx-auto px-4 py-10">
        {/* Category + breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-xs text-app-soft">
          <Link to="/blog" className="hover:text-orange-500 transition">Blog</Link>
          {post.category && (
            <>
              <span>/</span>
              <Link
                to={`/blog?category=${post.category._id}`}
                className="font-semibold"
                style={{ color: post.category.color }}
              >{post.category.name}</Link>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight mb-6">
          {post.title}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b" style={{ borderColor: "var(--app-border)" }}>
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {fmtDate(post.publishedAt)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {post.readingTime || 1} min read
          </span>
          {post.views > 0 && (
            <span className="text-xs">{post.views.toLocaleString()} views</span>
          )}
          <button
            onClick={share}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold text-app-soft hover:text-orange-500 hover:border-orange-400 transition"
            style={{ borderColor: "var(--app-border)" }}
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>

        {/* Featured image */}
        {post.featuredImage && (
          <figure className="mb-10">
            <img
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              className="w-full rounded-2xl shadow-lg max-h-96 object-cover"
            />
          </figure>
        )}

        {/* Excerpt / lead */}
        {post.excerpt && (
          <p className="text-lg text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-8 p-5 rounded-2xl border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-500/5">
            {post.excerpt}
          </p>
        )}

        {/* Table of contents */}
        <TableOfContents blocks={post.blocks || []} />

        {/* Content blocks */}
        <div className="prose-content">
          {(post.blocks || []).map((block) => (
            <RenderBlock key={block.id} block={block} />
          ))}
        </div>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="mt-10 pt-8 border-t flex flex-wrap gap-2" style={{ borderColor: "var(--app-border)" }}>
            <span className="text-xs text-app-soft flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3" /> Tags:
            </span>
            {post.tags.map((tag) => (
              <Link
                key={tag}
                to={`/blog?tag=${tag}`}
                className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 hover:bg-orange-200 transition"
              >#{tag}</Link>
            ))}
          </div>
        )}

        {/* Back CTA */}
        <div className="mt-12 pt-8 border-t flex items-center justify-between flex-wrap gap-4" style={{ borderColor: "var(--app-border)" }}>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-600 transition"
          >
            <ArrowLeft className="w-4 h-4" /> More articles
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition shadow-sm"
          >
            Try Arthaleads CRM Free →
          </Link>
        </div>
      </article>

      {/* Footer */}
      <div className="border-t py-8 text-center text-xs text-app-soft mt-10" style={{ borderColor: "var(--app-border)" }}>
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
