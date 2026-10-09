// components/BlogCard.jsx - shared by the blog index and the article page.
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight } from "lucide-react";

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const authorOf = (post) => post.author?.name || "Arthaleads Team";

// Theme tokens for blog surfaces, so both pages agree.
export function blogTheme(isDark) {
  return {
    bg:        isDark ? "#0d0d1a" : "#ffffff",
    soft:      isDark ? "#11111f" : "#faf8f5",
    heading:   isDark ? "#ffffff" : "#111827",
    body:      isDark ? "rgba(255,255,255,0.62)" : "#5b6170",
    text:      isDark ? "rgba(255,255,255,0.82)" : "#374151",   // long-form reading text
    muted:     isDark ? "rgba(255,255,255,0.42)" : "#9ca3af",
    rule:      isDark ? "rgba(255,255,255,0.09)" : "#ece8e3",
    card:      isDark ? "rgba(255,255,255,0.035)" : "#ffffff",
    cardBorder:isDark ? "rgba(255,255,255,0.09)" : "#ebe5dd",
    field:     isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
  };
}

// Shown when a post has no image: the brand mark on a soft orange wash.
export function CoverFallback({ isDark }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center"
      style={{ background: isDark ? "linear-gradient(135deg,#2a1608,#14101c)" : "linear-gradient(135deg,#fff3e8,#ffe0c4)" }}>
      <img src="/logo.png" alt="" aria-hidden="true" className="w-16 h-16 object-contain opacity-70" />
    </div>
  );
}

export function CategoryLabel({ post, className = "" }) {
  if (!post.category?.name) return null;
  return <span className={`text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff6b00] ${className}`}>{post.category.name}</span>;
}

/** One article in the grid: cover, category + read time, title, summary, date and author. */
export default function BlogCard({ post, isDark, eager = false }) {
  const t = blogTheme(isDark);
  return (
    <Link to={`/blog/${post.slug}`}
      className="group flex flex-col rounded-[26px] overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
      style={{ background: t.card, borderColor: t.cardBorder }}>
      <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
        {post.featuredImage ? (
          <img src={post.featuredImage} alt={post.featuredImageAlt || post.title}
            loading={eager ? "eager" : "lazy"} decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : <CoverFallback isDark={isDark} />}
      </div>
      <div className="flex flex-col flex-1 p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <CategoryLabel post={post} />
          <span className="text-xs shrink-0" style={{ color: t.muted }}>{post.readingTime || 1} min read</span>
        </div>
        <h2 className="font-extrabold text-[1.2rem] leading-snug tracking-tight mb-3 line-clamp-3 transition-colors group-hover:text-[#ff6b00]"
          style={{ color: t.heading, textWrap: "balance" }}>
          {post.title}
        </h2>
        {post.excerpt && <p className="text-[15px] leading-relaxed line-clamp-3 mb-5" style={{ color: t.body }}>{post.excerpt}</p>}
        <div className="mt-auto pt-4 flex items-center justify-between text-xs" style={{ borderTop: `1px solid ${t.rule}`, color: t.muted }}>
          <span>{fmtDate(post.publishedAt)} · {authorOf(post)}</span>
          <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#ff6b00]" />
        </div>
      </div>
    </Link>
  );
}

/** The newest article, shown large above the grid. */
export function FeaturedCard({ post, isDark }) {
  const t = blogTheme(isDark);
  return (
    <Link to={`/blog/${post.slug}`}
      className="group grid lg:grid-cols-[1.05fr_1fr] rounded-[30px] overflow-hidden border transition-shadow duration-300 hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
      style={{ background: t.card, borderColor: t.cardBorder }}>
      <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12 order-2 lg:order-1">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ff6b00]/10 text-[#ff6b00]">Latest</span>
            <CategoryLabel post={post} />
            <span className="text-xs" style={{ color: t.muted }}>· {post.readingTime || 1} min read</span>
          </div>
          <h2 className="text-3xl sm:text-4xl xl:text-[2.75rem] font-black leading-[1.08] tracking-tight mb-5 transition-colors group-hover:text-[#ff6b00]"
            style={{ color: t.heading, textWrap: "balance" }}>
            {post.title}
          </h2>
          {post.excerpt && <p className="text-base sm:text-lg leading-relaxed line-clamp-4" style={{ color: t.body }}>{post.excerpt}</p>}
        </div>
        <div className="flex items-center justify-between gap-4 mt-8">
          <div>
            <div className="text-sm font-semibold" style={{ color: t.heading }}>{authorOf(post)}</div>
            <div className="text-xs" style={{ color: t.muted }}>{fmtDate(post.publishedAt)}</div>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[#ff6b00] transition-all group-hover:gap-3">
            Read the article <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
      <div className="relative order-1 lg:order-2 min-h-[220px] sm:min-h-[300px] lg:min-h-[420px]">
        {post.featuredImage ? (
          <img src={post.featuredImage} alt={post.featuredImageAlt || post.title} loading="eager" decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : <CoverFallback isDark={isDark} />}
      </div>
    </Link>
  );
}
