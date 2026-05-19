const BlogPost     = require("../models/BlogPost");
const BlogCategory = require("../models/BlogCategory");
const BlogTag      = require("../models/BlogTag");
const { AppError } = require("../middlewares/errorHandler");
const { uploadBlogImage } = require("../utils/upload");

// ── Helpers ────────────────────────────────────────────────────────────────────

// Escape special regex characters in user-supplied search strings to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

// Convert blocks → plain text for excerpt auto-generation
function blocksToText(blocks = []) {
  return blocks
    .filter((b) => ["paragraph", "h2", "h3", "h4", "quote"].includes(b.type))
    .map((b) => (b.content || "").replace(/<[^>]*>/g, ""))
    .join(" ")
    .trim();
}

// ── Controller ─────────────────────────────────────────────────────────────────
const blogController = {

  // ── PUBLIC: list published posts ───────────────────────────────────────────
  async getPosts(req, res, next) {
    try {
      const { page = 1, limit = 12, category, tag, search } = req.query;
      const filter = { status: "published" };
      if (category) filter.category = category;
      if (tag)      filter.tags = tag;
      if (search)   filter.title = { $regex: escapeRegex(search), $options: "i" };

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [posts, total] = await Promise.all([
        BlogPost.find(filter)
          .populate("category", "name slug color")
          .populate("author", "name")
          .select("-blocks")
          .sort({ publishedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        BlogPost.countDocuments(filter),
      ]);

      res.json({ success: true, posts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { next(err); }
  },

  // ── PUBLIC: single post by slug ────────────────────────────────────────────
  async getPost(req, res, next) {
    try {
      const post = await BlogPost.findOne({ slug: req.params.slug, status: "published" })
        .populate("category", "name slug color")
        .populate("author", "name");
      if (!post) return next(new AppError("Post not found", 404));

      // Increment view count (fire-and-forget)
      BlogPost.updateOne({ _id: post._id }, { $inc: { views: 1 } }).catch(() => {});

      res.json({ success: true, post });
    } catch (err) { next(err); }
  },

  // ── PUBLIC: list categories ────────────────────────────────────────────────
  async getCategories(req, res, next) {
    try {
      const categories = await BlogCategory.find().sort({ name: 1 });
      res.json({ success: true, categories });
    } catch (err) { next(err); }
  },

  // ── PUBLIC: sitemap XML ────────────────────────────────────────────────────
  async getSitemap(req, res, next) {
    try {
      const baseUrl = "https://www.arthaleads.com";
      const posts = await BlogPost.find({ status: "published" })
        .select("slug publishedAt updatedAt")
        .sort({ publishedAt: -1 })
        .limit(1000);

      const staticPages = [
        { url: "/",     priority: "1.0", changefreq: "weekly" },
        { url: "/blog", priority: "0.9", changefreq: "daily"  },
      ];

      const blogEntries = posts.map((p) => ({
        url: `/blog/${p.slug}`,
        priority: "0.8",
        changefreq: "weekly",
        lastmod: (p.updatedAt || p.publishedAt || new Date()).toISOString().split("T")[0],
      }));

      const allEntries = [...staticPages, ...blogEntries];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries
  .map(
    (e) => `  <url>
    <loc>${baseUrl}${e.url}</loc>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`;

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600"); // cache 1 hour
      res.send(xml);
    } catch (err) { next(err); }
  },

  // ── ADMIN: list all posts (any status) ────────────────────────────────────
  async adminGetPosts(req, res, next) {
    try {
      const { page = 1, limit = 20, status, search } = req.query;
      const filter = {};
      if (status && status !== "all") filter.status = status;
      if (search) filter.title = { $regex: search, $options: "i" };

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [posts, total] = await Promise.all([
        BlogPost.find(filter)
          .populate("category", "name slug color")
          .populate("author", "name")
          .select("-blocks")
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        BlogPost.countDocuments(filter),
      ]);

      res.json({ success: true, posts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { next(err); }
  },

  // ── ADMIN: single post by ID (with blocks for editing) ────────────────────
  async adminGetPost(req, res, next) {
    try {
      const post = await BlogPost.findById(req.params.id)
        .populate("category", "name slug color")
        .populate("author", "name");
      if (!post) return next(new AppError("Post not found", 404));
      res.json({ success: true, post });
    } catch (err) { next(err); }
  },

  // ── ADMIN: create post ─────────────────────────────────────────────────────
  async createPost(req, res, next) {
    try {
      const {
        title, slug, excerpt, blocks, featuredImage, featuredImageAlt,
        category, tags, status, metaTitle, metaDescription, focusKeyword,
      } = req.body;

      if (!title?.trim()) return next(new AppError("Title is required", 400));

      const finalSlug = slug?.trim() ? slugify(slug.trim()) : slugify(title.trim());
      if (!finalSlug) return next(new AppError("Could not generate a valid slug", 400));

      const existing = await BlogPost.findOne({ slug: finalSlug });
      if (existing) return next(new AppError("A post with this slug already exists", 400));

      const text = blocksToText(blocks);
      const post = await BlogPost.create({
        title: title.trim(),
        slug: finalSlug,
        excerpt: excerpt?.trim() || text.slice(0, 200) || "",
        blocks: blocks || [],
        featuredImage: featuredImage || "",
        featuredImageAlt: featuredImageAlt || "",
        category: category || null,
        tags: (tags || []).filter(Boolean),
        status: status || "draft",
        publishedAt: status === "published" ? new Date() : null,
        metaTitle: metaTitle?.trim() || title.trim(),
        metaDescription: metaDescription?.trim() || (excerpt?.trim() || text).slice(0, 160) || "",
        focusKeyword: focusKeyword?.trim() || "",
        author: req.user._id,
      });

      res.status(201).json({ success: true, post });
    } catch (err) { next(err); }
  },

  // ── ADMIN: update post ─────────────────────────────────────────────────────
  async updatePost(req, res, next) {
    try {
      const post = await BlogPost.findById(req.params.id);
      if (!post) return next(new AppError("Post not found", 404));

      const {
        title, slug, excerpt, blocks, featuredImage, featuredImageAlt,
        category, tags, status, metaTitle, metaDescription, focusKeyword,
      } = req.body;

      // Slug change - check uniqueness
      if (slug !== undefined && slug.trim() !== "" && slugify(slug) !== post.slug) {
        const newSlug = slugify(slug.trim());
        const dup = await BlogPost.findOne({ slug: newSlug, _id: { $ne: post._id } });
        if (dup) return next(new AppError("A post with this slug already exists", 400));
        post.slug = newSlug;
      }

      if (title             !== undefined) post.title            = title.trim();
      if (excerpt           !== undefined) post.excerpt          = excerpt.trim();
      if (blocks            !== undefined) post.blocks           = blocks;
      if (featuredImage     !== undefined) post.featuredImage    = featuredImage;
      if (featuredImageAlt  !== undefined) post.featuredImageAlt = featuredImageAlt;
      if (category          !== undefined) post.category         = category || null;
      if (tags              !== undefined) post.tags             = tags.filter(Boolean);
      if (metaTitle         !== undefined) post.metaTitle        = metaTitle.trim();
      if (metaDescription   !== undefined) post.metaDescription  = metaDescription.trim();
      if (focusKeyword      !== undefined) post.focusKeyword     = focusKeyword.trim();

      if (status !== undefined && status !== post.status) {
        post.status = status;
        if (status === "published" && !post.publishedAt) post.publishedAt = new Date();
      }

      await post.save();
      res.json({ success: true, post });
    } catch (err) { next(err); }
  },

  // ── ADMIN: delete post ─────────────────────────────────────────────────────
  async deletePost(req, res, next) {
    try {
      const post = await BlogPost.findByIdAndDelete(req.params.id);
      if (!post) return next(new AppError("Post not found", 404));
      res.json({ success: true, message: "Post deleted" });
    } catch (err) { next(err); }
  },

  // ── ADMIN: upload blog image to Cloudinary ────────────────────────────────
  async uploadImage(req, res, next) {
    try {
      const { dataUri } = req.body;
      if (!dataUri || !dataUri.startsWith("data:image/")) {
        return next(new AppError("Invalid image data", 400));
      }
      // 5 MB limit (base64 is ~1.33× raw - so 5 MB base64 ≈ 3.7 MB raw)
      if (dataUri.length > 7 * 1024 * 1024) {
        return next(new AppError("Image too large - max 5 MB", 400));
      }
      const url = await uploadBlogImage(dataUri);
      res.json({ success: true, url });
    } catch (err) { next(err); }
  },

  // ── ADMIN: create category ─────────────────────────────────────────────────
  async createCategory(req, res, next) {
    try {
      const { name, description } = req.body;
      if (!name?.trim()) return next(new AppError("Category name is required", 400));
      const slug = slugify(name.trim());
      if (!slug) return next(new AppError("Invalid category name", 400));
      const existing = await BlogCategory.findOne({ slug });
      if (existing) return next(new AppError("Category with this name already exists", 400));
      const category = await BlogCategory.create({
        name: name.trim(),
        slug,
        description: description?.trim() || "",
      });
      res.status(201).json({ success: true, category });
    } catch (err) { next(err); }
  },

  // ── ADMIN: delete category ─────────────────────────────────────────────────
  async deleteCategory(req, res, next) {
    try {
      const inUse = await BlogPost.findOne({ category: req.params.id });
      if (inUse) return next(new AppError("Category is used by one or more posts - reassign them first", 400));
      await BlogCategory.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: "Category deleted" });
    } catch (err) { next(err); }
  },

  // ── PUBLIC: list tags ────────────────────────────────────────────────────────
  async getTags(req, res, next) {
    try {
      const tags = await BlogTag.find().sort({ name: 1 });
      res.json({ success: true, tags });
    } catch (err) { next(err); }
  },

  // ── ADMIN: create tag ────────────────────────────────────────────────────────
  async createTag(req, res, next) {
    try {
      const { name, description } = req.body;
      if (!name?.trim()) return next(new AppError("Tag name is required", 400));
      const slug = slugify(name.trim());
      if (!slug) return next(new AppError("Invalid tag name", 400));
      const existing = await BlogTag.findOne({ slug });
      if (existing) return next(new AppError("Tag with this name already exists", 400));
      const tag = await BlogTag.create({ name: name.trim(), slug, description: description?.trim() || "" });
      res.status(201).json({ success: true, tag });
    } catch (err) { next(err); }
  },

  // ── ADMIN: delete tag ────────────────────────────────────────────────────────
  async deleteTag(req, res, next) {
    try {
      await BlogTag.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: "Tag deleted" });
    } catch (err) { next(err); }
  },
};

module.exports = blogController;
