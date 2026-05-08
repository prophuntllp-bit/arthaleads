const mongoose = require("mongoose");

// Each content block in the editor
const blockSchema = new mongoose.Schema(
  {
    id:      { type: String, required: true },
    type:    { type: String, enum: ["paragraph", "h2", "h3", "h4", "image", "quote", "bulletList", "numberedList", "divider", "code"], required: true },
    content: { type: String, default: "" },   // HTML for text blocks, URL for image
    alt:     { type: String, default: "" },   // image alt text
    caption: { type: String, default: "" },   // image caption
    items:   [{ type: String }],              // list items
    language:{ type: String, default: "" },   // code block language
  },
  { _id: false }
);

const blogPostSchema = new mongoose.Schema(
  {
    title:             { type: String, required: true, trim: true, maxlength: 200 },
    slug:              { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    excerpt:           { type: String, default: "", maxlength: 500 },
    blocks:            [blockSchema],
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
    // Author
    author:            { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
    .concat(this.blocks.filter((b) => b.type === "bulletList" || b.type === "numberedList").flatMap((b) => b.items || []))
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  this.readingTime = Math.max(1, Math.ceil(words / 200));
  next();
});

blogPostSchema.index({ slug: 1 });
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1 });

module.exports = mongoose.model("BlogPost", blogPostSchema);
