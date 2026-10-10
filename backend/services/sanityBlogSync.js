// services/sanityBlogSync.js
//
// Posts are written in Sanity Studio and copied into our own BlogPost
// collection, so the public blog, sitemap, SEO tags and view counts keep
// working exactly as before. Sanity is the editor; MongoDB is what the site
// serves.
//
// The Sanity dataset is public, which means anyone (including this server) can
// read PUBLISHED documents without a token. Drafts are never exposed. A post
// goes live on the site when it is published in Sanity and its "Publish at"
// time has passed, so posts can be written ahead and scheduled one per day.
//
// Removing or unpublishing a post in Sanity turns it back into a draft here.
const BlogPost = require("../models/BlogPost");
const BlogCategory = require("../models/BlogCategory");
const logger = require("../config/logger");

const PROJECT_ID = process.env.SANITY_PROJECT_ID || "2racdioq";
const DATASET    = process.env.SANITY_DATASET    || "production";
const API_VERSION = "2025-02-19";
// Optional. Only needed if the dataset is ever made private.
const TOKEN = process.env.SANITY_READ_TOKEN || "";

const QUERY = `*[_type == "post" && defined(slug.current) && defined(publishedAt) && publishedAt <= now()]{
  _id, _updatedAt, title, "slug": slug.current, excerpt,
  "featuredImage": featuredImage.asset->url,
  "featuredImageAlt": featuredImage.alt,
  category, tags, publishedAt, metaTitle, metaDescription, focusKeyword,
  author, secondaryKeywords, breadcrumbTitle, canonicalUrl, schemaType,
  openGraphTitle, openGraphDescription,
  "openGraphImage": openGraphImage.asset->url, "openGraphImageAlt": openGraphImage.alt,
  twitterCard, twitterTitle, twitterDescription, "twitterImage": twitterImage.asset->url,
  robotsIndex, robotsFollow, robotsNoArchive, robotsNoImageIndex, robotsNoSnippet,
  robotsMaxSnippet, robotsMaxVideoPreview, robotsMaxImagePreview,
  excludeFromSitemap, redirectUrl, redirectPermanent,
  body[]{ ..., _type == "image" => { ..., "url": asset->url } }
} | order(publishedAt desc)`;

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (t) => String(t || "").toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// Only these URL schemes may appear in a link.
const safeHref = (u) => (/^(https?:|mailto:|tel:|\/)/i.test(String(u || "").trim()) ? String(u).trim() : "");

/** One portable-text block's children -> inline HTML (strong, em, code, links). */
function inlineHtml(block) {
  const defs = {};
  for (const d of block.markDefs || []) defs[d._key] = d;
  return (block.children || []).map((span) => {
    if (span._type !== "span") return "";
    let html = esc(span.text).replace(/\n/g, "<br>");
    for (const mark of span.marks || []) {
      if (mark === "strong") html = `<strong>${html}</strong>`;
      else if (mark === "em") html = `<em>${html}</em>`;
      else if (mark === "underline") html = `<u>${html}</u>`;
      else if (mark === "code") html = `<code>${html}</code>`;
      else if (defs[mark]?._type === "link") {
        const href = safeHref(defs[mark].href);
        if (href) html = `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      }
    }
    return html;
  }).join("");
}

const plainText = (block) => (block.children || []).map((c) => c.text || "").join("");

/** Sanity portable text -> the block list our editor and renderer already use. */
function toBlocks(body) {
  const out = [];
  let list = null; // the list currently being built
  const flush = () => { if (list) { out.push(list); list = null; } };

  for (const b of body || []) {
    if (b._type === "block") {
      if (b.listItem) {
        const type = b.listItem === "number" ? "numberedList" : "bulletList";
        if (!list || list.type !== type) { flush(); list = { id: b._key, type, content: "", items: [] }; }
        const text = plainText(b).trim();
        if (text) list.items.push(text);
        continue;
      }
      flush();
      const html = inlineHtml(b);
      if (!plainText(b).trim()) continue;
      const style = b.style || "normal";
      if (style === "h1" || style === "h2") out.push({ id: b._key, type: "h2", content: html });
      else if (style === "h3") out.push({ id: b._key, type: "h3", content: html });
      else if (style === "h4" || style === "h5" || style === "h6") out.push({ id: b._key, type: "h4", content: html });
      else if (style === "blockquote") out.push({ id: b._key, type: "quote", content: html });
      else out.push({ id: b._key, type: "paragraph", content: html });
    } else if (b._type === "image") {
      flush();
      if (b.url) out.push({ id: b._key, type: "image", content: b.url, alt: b.alt || "", caption: b.caption || "" });
    } else if (b._type === "code") {
      flush();
      out.push({ id: b._key, type: "code", content: b.code || "", language: b.language || "" });
    } else if (b._type === "divider") {
      flush();
      out.push({ id: b._key, type: "divider", content: "" });
    }
  }
  flush();
  return out;
}

async function categoryId(name) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const slug = slugify(clean);
  if (!slug) return null;
  const existing = await BlogCategory.findOne({ slug });
  if (existing) return existing._id;
  return (await BlogCategory.create({ name: clean.slice(0, 100), slug })).id;
}

const str = (v, n) => String(v || "").trim().slice(0, n);
const httpsUrl = (u) => (/^https:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
const limit = (v) => (Number.isInteger(v) && v >= -1 ? v : -1);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

/** Social and advanced SEO fields from the Studio's SEO, Social and Advanced SEO tabs. */
function applySeo(post, d) {
  post.authorName = str(d.author, 100);
  post.secondaryKeywords = (d.secondaryKeywords || []).map((k) => str(k, 100)).filter(Boolean).slice(0, 8);
  post.breadcrumbTitle = str(d.breadcrumbTitle, 60);
  post.canonicalUrl = httpsUrl(d.canonicalUrl);
  post.schemaType = oneOf(d.schemaType, ["BlogPosting", "Article", "NewsArticle"], "BlogPosting");
  post.ogTitle = str(d.openGraphTitle, 95);
  post.ogDescription = str(d.openGraphDescription, 200);
  post.ogImage = d.openGraphImage || "";
  post.ogImageAlt = str(d.openGraphImageAlt, 200);
  post.twitterCard = oneOf(d.twitterCard, ["summary_large_image", "summary"], "summary_large_image");
  post.twitterTitle = str(d.twitterTitle, 70);
  post.twitterDescription = str(d.twitterDescription, 200);
  post.twitterImage = d.twitterImage || "";
  // Unset switches keep the safe default: indexed and followed.
  post.robots = {
    index: d.robotsIndex !== false,
    follow: d.robotsFollow !== false,
    noArchive: d.robotsNoArchive === true,
    noImageIndex: d.robotsNoImageIndex === true,
    noSnippet: d.robotsNoSnippet === true,
    maxSnippet: limit(d.robotsMaxSnippet),
    maxVideoPreview: limit(d.robotsMaxVideoPreview),
    maxImagePreview: oneOf(d.robotsMaxImagePreview, ["large", "standard", "none"], "large"),
  };
  post.excludeFromSitemap = d.excludeFromSitemap === true;
  const redirect = String(d.redirectUrl || "").trim();
  post.redirectUrl = /^(https:\/\/|\/(?!\/))/i.test(redirect) ? redirect : "";
  post.redirectPermanent = d.redirectPermanent !== false;
}

async function fetchPublished() {
  const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(QUERY)}&perspective=published`;
  const res = await fetch(url, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
  if (!res.ok) throw new Error(`Sanity responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.result || [];
}

/**
 * Copy every live Sanity post into MongoDB. Safe to run any number of times.
 * Returns counts so the caller (cron or a manual run) can report them.
 */
async function sync() {
  const docs = await fetchPublished();
  const stats = { fetched: docs.length, created: 0, updated: 0, unchanged: 0, skipped: 0, unpublished: 0 };

  for (const d of docs) {
    const slug = slugify(d.slug);
    if (!slug || !d.title) { stats.skipped++; continue; }

    let post = await BlogPost.findOne({ sanityId: d._id });
    if (!post) {
      const clash = await BlogPost.findOne({ slug });
      if (clash) {
        // A post written in the old editor owns this address. Never overwrite it.
        logger.warn(`[sanity-sync] slug "${slug}" already belongs to a post not from Sanity - skipped`);
        stats.skipped++;
        continue;
      }
      post = new BlogPost({ sanityId: d._id, slug, title: d.title, views: 0 });
      stats.created++;
    } else if (post.sanityUpdatedAt && new Date(post.sanityUpdatedAt).getTime() === new Date(d._updatedAt).getTime() && post.status === "published") {
      stats.unchanged++;
      continue;
    } else {
      stats.updated++;
    }

    const blocks = toBlocks(d.body);
    const firstText = blocks.filter((x) => x.type === "paragraph").map((x) => x.content.replace(/<[^>]*>/g, "")).join(" ");
    post.title = String(d.title).trim().slice(0, 200);
    post.slug = slug;
    post.excerpt = String(d.excerpt || firstText).trim().slice(0, 500);
    post.blocks = blocks;
    post.featuredImage = d.featuredImage || "";
    post.featuredImageAlt = d.featuredImageAlt || "";
    post.category = await categoryId(d.category);
    post.tags = (d.tags || []).map((t) => String(t).trim().slice(0, 60)).filter(Boolean);
    post.status = "published";
    post.publishedAt = new Date(d.publishedAt);
    post.metaTitle = String(d.metaTitle || d.title).trim().slice(0, 70);
    post.metaDescription = String(d.metaDescription || d.excerpt || firstText).trim().slice(0, 160);
    post.focusKeyword = String(d.focusKeyword || "").trim().slice(0, 100);
    applySeo(post, d);
    post.sanityUpdatedAt = new Date(d._updatedAt);
    await post.save();
  }

  // Anything we copied earlier that is no longer live in Sanity goes back to draft.
  const liveIds = docs.map((d) => d._id);
  const gone = await BlogPost.updateMany(
    { sanityId: { $exists: true, $nin: liveIds }, status: "published" },
    { $set: { status: "draft" } }
  );
  stats.unpublished = gone.modifiedCount || 0;

  if (stats.created || stats.updated || stats.unpublished) logger.info(`[sanity-sync] ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { sync, toBlocks, inlineHtml, applySeo };
