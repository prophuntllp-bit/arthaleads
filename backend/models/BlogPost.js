const mongoose = require("mongoose");

// Each content block in the editor
const blockSchema = new mongoose.Schema(
  {
    id:      { type: String, required: true },
    type:    { type: String, enum: ["paragraph", "h2", "h3", "h4", "image", "quote", "bulletList", "numberedList", "checklist", "table", "steps", "divider", "code"], required: true },
    content: { type: String, default: "" },   // HTML for text blocks, URL for image
    alt:     { type: String, default: "" },   // image alt text
    caption: { type: String, default: "" },   // image or table caption
    items:   [{ type: String }],              // list and checklist items
    language:{ type: String, default: "" },   // code block language
    rows:    [[{ type: String }]],            // table: first row is the header
    steps:   [{ title: { type: String, default: "" }, text: { type: String, default: "" }, _id: false }],
  },
  { _id: false }
);

// "Key takeaways" box and the FAQ under the article (FAQPage structured data).
const faqSchema = new mongoose.Schema(
  { question: { type: String, default: "", maxlength: 300 }, answer: { type: String, default: "", maxlength: 2000 } },
  { _id: false }
);

const blogPostSchema = new mongoose.Schema(
  {
    title:             { type: String, required: true, trim: true, maxlength: 200 },
    slug:              { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    excerpt:           { type: String, default: "", maxlength: 500 },
    blocks:            [blockSchema],
    keyTakeaways:      [{ type: String, trim: true, maxlength: 400 }],
    faqs:              [faqSchema],
    featuredImage:     { type: String, default: "" },
    featuredImageAlt:  { type: String, default: "" },
    category:          { type: mongoose.Schema.Types.ObjectId, ref: "BlogCategory", default: null },
    tags:              [{ type: String, trim: true, maxlength: 60 }],
    status:            { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt:       { type: Date, default: null },
    // SEO fields
    metaTitle:         { type: String, default: "", maxlength: 70 },
    metaDescription:   { type: String, default: "", maxlength: 160 },
    focusKeyword:      { type: String, default: "", maxlength: 100 },
    canonicalUrl:      { type: String, default: "" },
    secondaryKeywords: [{ type: String, trim: true, maxlength: 100 }],
    breadcrumbTitle:   { type: String, default: "", maxlength: 60 },
    // Social sharing (each falls back to the SEO title / description / featured image)
    ogTitle:           { type: String, default: "", maxlength: 95 },
    ogDescription:     { type: String, default: "", maxlength: 200 },
    ogImage:           { type: String, default: "" },
    ogImageAlt:        { type: String, default: "" },
    twitterCard:       { type: String, enum: ["summary_large_image", "summary"], default: "summary_large_image" },
    twitterTitle:      { type: String, default: "", maxlength: 70 },
    twitterDescription:{ type: String, default: "", maxlength: 200 },
    twitterImage:      { type: String, default: "" },
    // Advanced SEO
    schemaType:        { type: String, enum: ["BlogPosting", "Article", "NewsArticle"], default: "BlogPosting" },
    robots: {
      index:           { type: Boolean, default: true },
      follow:          { type: Boolean, default: true },
      noArchive:       { type: Boolean, default: false },
      noImageIndex:    { type: Boolean, default: false },
      noSnippet:       { type: Boolean, default: false },
      maxSnippet:      { type: Number, default: -1 },
      maxVideoPreview: { type: Number, default: -1 },
      maxImagePreview: { type: String, enum: ["large", "standard", "none"], default: "large" },
    },
    excludeFromSitemap:{ type: Boolean, default: false },
    redirectUrl:       { type: String, default: "" },
    redirectPermanent: { type: Boolean, default: true },
    // Name shown on the article when it came from Sanity (CRM-editor posts use `author`)
    byline:            { type: String, default: "", maxlength: 100 },
    // Author
    author:            { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Set when the post is written in Sanity Studio and copied here by
    // services/sanityBlogSync.js. Posts without it were written in the CRM editor.
    sanityId:          { type: String, default: undefined },
    sanityUpdatedAt:   { type: Date, default: null },
    // Bumped (SYNC_VERSION in services/sanityBlogSync.js) when the sync learns
    // something new, so every post is copied once more even if Sanity is unchanged.
    sanitySyncVersion: { type: Number, default: 0 },
    // Engagement
    readingTime:       { type: Number, default: 1 },
    views:             { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-calculate reading time before save
blogPostSchema.pre("save", function (next) {
  const text = this.blocks
    .filter((b) => ["paragraph", "h2", "h3", "h4", "quote"].includes(b.type))
    .map((b) => (b.content || "").replace(/<[^>]*>/g, ""))
    .concat(this.blocks.filter((b) => ["bulletList", "numberedList", "checklist"].includes(b.type)).flatMap((b) => (b.items || []).map((i) => String(i).replace(/<[^>]*>/g, ""))))
    .concat(this.blocks.filter((b) => b.type === "table").flatMap((b) => (b.rows || []).flat()))
    .concat(this.blocks.filter((b) => b.type === "steps").flatMap((b) => (b.steps || []).flatMap((s) => [s.title, s.text])))
    .concat(this.keyTakeaways || [], (this.faqs || []).flatMap((f) => [f.question, f.answer]))
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  this.readingTime = Math.max(1, Math.ceil(words / 200));
  next();
});

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ sanityId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("BlogPost", blogPostSchema);
