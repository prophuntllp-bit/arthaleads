import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Calendar, Clock } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import api from "../services/api";

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function PostCard({ post, isDark }) {
  const cardBg     = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const titleColor = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const placeholderBg = isDark ? "rgba(255,255,255,0.03)" : "#f3f4f6";

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden border hover:border-orange-300 transition-all hover:shadow-lg"
      style={{ background: cardBg, borderColor: cardBorder }}
    >
      {post.featuredImage ? (
        <div className="h-48 overflow-hidden">
          <img
            src={post.featuredImage}
            alt={post.featuredImageAlt || post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center" style={{ background: placeholderBg }}>
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
        <h2
          className="font-bold text-base leading-snug mb-2 group-hover:text-orange-500 transition-colors line-clamp-2"
          style={{ color: titleColor }}
        >
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-sm leading-relaxed line-clamp-3 mb-4" style={{ color: softText }}>{post.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] mt-auto" style={{ color: softText }}>
          {post.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {fmtDate(post.publishedAt)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {post.readingTime || 1} min read
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

function CaseStudiesInner() {
  const { isDark } = usePublicTheme();
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty]     = useState(false);

  useSEO({
    title: "Case Studies - How Real Estate Teams Win with Arthaleads CRM",
    description: "Discover how real estate developers, builders, and brokers across India use Arthaleads CRM to capture more leads, track site visits, and close more property deals faster.",
    canonical: "https://www.arthaleads.com/case-studies",
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const catRes = await api.get("/blog/categories");
        const categories = catRes.data.categories || [];
        const csCat = categories.find((c) => /case.stud/i.test(c.name));

        if (!csCat) {
          setEmpty(true);
          return;
        }

        const postsRes = await api.get(`/blog/posts?category=${csCat._id}&limit=20`);
        const fetchedPosts = postsRes.data.posts || [];
        if (fetchedPosts.length === 0) setEmpty(true);
        else setPosts(fetchedPosts);
      } catch {
        setEmpty(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.08)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Case Studies</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5" style={{ color: textColor }}>
            Real Estate Teams.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Real Results.
            </span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: softText }}>
            How developers, channel partners, and agencies across India use Arthaleads to capture more leads,
            respond faster, and close more property deals.
          </p>
        </div>
      </section>

      {/* Posts or empty state */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border animate-pulse"
                  style={{
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
                    background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
                    height: 280,
                  }}
                />
              ))}
            </div>
          ) : empty ? (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 text-orange-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2" style={{ color: textColor }}>No case studies published yet.</h3>
              <p style={{ color: softText }}>Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post._id} post={post} isDark={isDark} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: textColor }}>
            See Arthaleads in Action
          </h2>
          <p className="text-base mb-8" style={{ color: softText }}>
            Start a free trial and set up your first lead pipeline today. No credit card required.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default function CaseStudies() {
  return <CaseStudiesInner />;
}
