// pages/CaseStudies.jsx - /case-studies on the shared marketing theme (components/site/*).
// Lists blog posts from the "Case Studies" blog category. None are published
// yet, so the page shows an honest empty state and stays noindex (see useSEO).
// No invented customers or results here: only real, published case studies.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Calendar, Clock } from "lucide-react";
import { SitePage, Section, Container, Card, SiteButton } from "../components/site/Site";
import { PageHero, ClosingCta } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";
import api from "../services/api";

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function PostCard({ post }) {
  return (
    <Card as={Link} to={`/blog/${post.slug}`} glow className="group h-full flex flex-col overflow-hidden">
      {post.featuredImage ? (
        <div className="h-48 overflow-hidden">
          <img
            src={post.featuredImage}
            alt={post.featuredImageAlt || post.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center" style={{ background: "var(--site-chip)" }}>
          <BookOpen className="w-10 h-10" style={{ color: "var(--site-brand-ink)", opacity: 0.5 }} aria-hidden="true" />
        </div>
      )}
      <div className="flex-1 p-5 sm:p-6">
        {post.category && <p className="site-eyebrow !text-[11px] mb-2.5">{post.category.name}</p>}
        <h2 className="font-display text-[17px] font-bold site-ink leading-snug mb-2 line-clamp-2 group-hover:text-[color:var(--site-brand-ink)] transition-colors">
          {post.title}
        </h2>
        {post.excerpt && <p className="text-[14px] leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>}
        <div className="flex items-center gap-3 text-[12px] site-muted">
          {post.publishedAt && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> {fmtDate(post.publishedAt)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {post.readingTime || 1} min read
          </span>
        </div>
      </div>
      <div className="px-5 sm:px-6 pb-5">
        <span className="site-link text-sm">Read more <ArrowRight className="w-4 h-4" /></span>
      </div>
    </Card>
  );
}

function CaseStudiesInner() {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty]     = useState(false);

  useSEO({
    title: "Case Studies - How Real Estate Teams Win with Arthaleads CRM",
    description: "How real estate developers, builders and brokers across India use Arthaleads CRM to capture more leads, track site visits and close more deals.",
    canonical: "https://www.arthaleads.com/case-studies",
    // No case studies are published yet, and an empty page reads to Google as
    // thin content. When the first one goes live (a blog post in a category
    // named "Case Studies"), remove this line and add /case-studies back to the
    // sitemap in backend/controllers/blogController.js.
    robots: "noindex, follow",
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

  return (
    <SitePage>
      <PageHero
        eyebrow="Case studies"
        title={<>How real estate teams <span className="site-dim">use Arthaleads</span></>}
        lede="How developers, channel partners and agencies across India use Arthaleads to capture their leads, reply faster and keep every follow-up on track."
        actions={null}
      />

      {/* Posts or empty state */}
      <Section tone="tint" className="!pt-12 sm:!pt-16">
        <Container>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="site-card animate-pulse" style={{ height: 280 }} />
              ))}
            </div>
          ) : empty ? (
            <Reveal className="max-w-xl mx-auto">
              <Card raised className="p-8 sm:p-10 text-center">
                <span className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
                  <BookOpen className="w-6 h-6" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-bold site-ink mb-2">No case studies published yet.</h2>
                <p className="text-[15px] leading-relaxed">Check back soon!</p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <SiteButton to="/book-demo">Book a Demo <ArrowRight className="w-4 h-4" /></SiteButton>
                  <SiteButton to="/blog" variant="secondary">Read the blog</SiteButton>
                </div>
              </Card>
            </Reveal>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((post, i) => (
                <Reveal key={post._id} delay={(i % 3) * 80} className="min-w-0">
                  <PostCard post={post} />
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </Section>

      <ClosingCta title="See Arthaleads" dim="in action."
        body="Start a free trial and set up your first lead pipeline today. No credit card required." />
    </SitePage>
  );
}

export default function CaseStudies() {
  return <CaseStudiesInner />;
}
