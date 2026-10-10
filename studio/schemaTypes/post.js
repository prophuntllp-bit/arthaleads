import { defineArrayMember, defineField, defineType } from "sanity";
import { SeoAudit } from "../components/SeoAudit";

// Keep this in step with backend/services/sanityBlogSync.js: the sync only
// understands the fields queried there and the block types listed in `body`.
// Layout follows the Vistrow studio: Content, SEO (live score), Social, Advanced SEO.
export const CATEGORIES = ["CRM Tips", "Lead Generation", "WhatsApp Marketing", "Real Estate Sales", "Product Updates"];

const robotsToggle = (name, title, initialValue) =>
  defineField({ name, title, type: "boolean", group: "advanced", fieldset: "robots", initialValue });

const altField = defineField({
  name: "alt", title: "Alternative Text", type: "string",
  description: "Describe the image for screen readers and Google Images.",
  validation: (r) => r.required(),
});

export const post = defineType({
  name: "post",
  title: "Blog post",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "SEO" },
    { name: "social", title: "Social" },
    { name: "advanced", title: "Advanced SEO" },
  ],
  fieldsets: [
    { name: "imageBrief", title: "Image brief (editor notes, not shown on the site)", options: { collapsible: true, collapsed: true } },
    { name: "openGraph", title: "Facebook, LinkedIn and WhatsApp", options: { collapsible: true, collapsed: false } },
    { name: "twitter", title: "X / Twitter", options: { collapsible: true, collapsed: false } },
    { name: "robots", title: "Robots Directives", options: { collapsible: true, collapsed: false } },
    { name: "previewLimits", title: "Search preview limits", options: { collapsible: true, collapsed: true } },
    { name: "redirect", title: "Redirect", options: { collapsible: true, collapsed: true } },
  ],
  fields: [
    // ── Content ──────────────────────────────────────────────────────────────
    defineField({ name: "title", title: "Title", type: "string", group: "content", validation: (r) => r.required().max(100) }),
    defineField({
      name: "slug", title: "URL Slug", type: "slug", group: "content",
      description: "The page will be at arthaleads.com/blog/<this>. Click Generate. Do not change it after the post is live.",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "excerpt", title: "Summary", type: "text", rows: 4, group: "content",
      description: "Displayed on the blog index and below the article title. 80 to 320 characters.",
      validation: (r) => r.required().min(80).max(320),
    }),
    defineField({
      name: "category", title: "Category", type: "string", group: "content",
      options: { list: CATEGORIES, layout: "dropdown" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "author", title: "Author", type: "string", group: "content",
      initialValue: "Arthaleads Team",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "publishedAt", title: "Publish at", type: "datetime", group: "content",
      description: "The post appears on the website at this date and time (and only after you click Publish). Set a future time to schedule it. Reading time is worked out automatically.",
      initialValue: () => new Date().toISOString(),
      validation: (r) => r.required(),
    }),
    defineField({
      name: "useRealProductScreenshot", title: "Use a real product screenshot", type: "boolean", group: "content", fieldset: "imageBrief",
      description: "On for posts about ArthaLeads itself: use a screenshot of the real CRM instead of an illustration.",
      initialValue: false,
    }),
    defineField({
      name: "screenshotGuidance", title: "Screenshot guidance", type: "text", rows: 3, group: "content", fieldset: "imageBrief",
      description: "Only when the switch above is on: exactly which screen or feature to capture.",
      hidden: ({ document }) => !document?.useRealProductScreenshot,
    }),
    defineField({
      name: "imageBrief", title: "Image brief", type: "text", rows: 4, group: "content", fieldset: "imageBrief",
      description: "What to find or create an image of for this post. 16:9, on-brand colours.",
    }),
    defineField({
      name: "imageAltSuggestion", title: "Suggested Alt Text", type: "string", group: "content", fieldset: "imageBrief",
      description: "Copy this into the Featured Image's alt text once you've added the image.",
    }),
    defineField({
      name: "featuredImage", title: "Featured Image", type: "image", group: "content", options: { hotspot: true },
      fields: [altField],
    }),
    defineField({ name: "tags", title: "Tags", type: "array", of: [{ type: "string" }], options: { layout: "tags" }, group: "content" }),
    defineField({
      name: "body", title: "Article", type: "array", group: "content",
      description: "Use Heading 2 for each main section and Heading 3 inside them. Link to other ArthaLeads pages where it helps.",
      validation: (r) => r.required().min(1),
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Paragraph", value: "normal" },
            { title: "Heading 2", value: "h2" },
            { title: "Heading 3", value: "h3" },
            { title: "Heading 4", value: "h4" },
            { title: "Quote", value: "blockquote" },
          ],
          lists: [{ title: "Bullets", value: "bullet" }, { title: "Numbered", value: "number" }],
          marks: {
            decorators: [
              { title: "Bold", value: "strong" },
              { title: "Italic", value: "em" },
              { title: "Underline", value: "underline" },
              { title: "Code", value: "code" },
            ],
            annotations: [{
              name: "link", type: "object", title: "Link",
              fields: [{ name: "href", type: "url", title: "Address", validation: (r) => r.uri({ scheme: ["http", "https", "mailto", "tel"], allowRelative: true }) }],
            }],
          },
        }),
        defineArrayMember({
          type: "image", options: { hotspot: true },
          fields: [
            defineField({ name: "alt", title: "Describe the image", type: "string" }),
            defineField({ name: "caption", title: "Caption", type: "string" }),
          ],
        }),
        defineArrayMember({
          type: "object", name: "code", title: "Code",
          fields: [defineField({ name: "language", type: "string", title: "Language" }), defineField({ name: "code", type: "text", title: "Code" })],
        }),
        defineArrayMember({ type: "object", name: "divider", title: "Divider line", fields: [defineField({ name: "label", type: "string", hidden: true })] }),
      ],
    }),

    // ── SEO ──────────────────────────────────────────────────────────────────
    defineField({
      name: "seoAudit", title: "SEO Analysis", type: "string", group: "seo",
      components: { input: SeoAudit },
    }),
    defineField({
      name: "focusKeyword", title: "Focus Keyword", type: "string", group: "seo",
      description: "The main search phrase this article should rank for, e.g. real estate CRM India.",
      validation: (r) => r.custom((v) => (v && v.trim() ? true : "Add a focus keyword so the SEO score can check the article.")).warning(),
    }),
    defineField({
      name: "secondaryKeywords", title: "Secondary Keywords", type: "array", group: "seo",
      description: "Related phrases and variations (up to 8).",
      of: [{ type: "string" }], options: { layout: "tags" },
      validation: (r) => r.max(8),
    }),
    defineField({
      name: "metaTitle", title: "SEO Title", type: "string", group: "seo",
      description: "The headline Google shows. Keep this near 50 to 60 characters.",
      validation: (r) => r.required().max(65),
    }),
    defineField({
      name: "metaDescription", title: "SEO Description", type: "text", rows: 3, group: "seo",
      description: "The text Google shows under the headline. Keep this near 140 to 160 characters.",
      validation: (r) => r.required().max(170),
    }),
    defineField({
      name: "breadcrumbTitle", title: "Breadcrumb Title", type: "string", group: "seo",
      description: "Optional shorter label used in breadcrumbs.",
      validation: (r) => r.max(60),
    }),

    // ── Social ───────────────────────────────────────────────────────────────
    defineField({
      name: "openGraphTitle", title: "Social Title", type: "string", group: "social", fieldset: "openGraph",
      description: "Falls back to the SEO title when empty.",
      validation: (r) => r.max(95),
    }),
    defineField({
      name: "openGraphDescription", title: "Social Description", type: "text", rows: 3, group: "social", fieldset: "openGraph",
      description: "Falls back to the SEO description when empty.",
      validation: (r) => r.max(200),
    }),
    defineField({
      name: "openGraphImage", title: "Social Sharing Image", type: "image", group: "social", fieldset: "openGraph",
      description: "1200 x 630 works best. Falls back to the featured image when empty.",
      options: { hotspot: true }, fields: [altField],
    }),
    defineField({
      name: "twitterCard", title: "Card Type", type: "string", group: "social", fieldset: "twitter",
      options: { layout: "radio", list: [{ title: "Large image", value: "summary_large_image" }, { title: "Compact summary", value: "summary" }] },
      initialValue: "summary_large_image",
    }),
    defineField({
      name: "twitterTitle", title: "X Title", type: "string", group: "social", fieldset: "twitter",
      description: "Falls back to the social title when empty.",
      validation: (r) => r.max(70),
    }),
    defineField({
      name: "twitterDescription", title: "X Description", type: "text", rows: 3, group: "social", fieldset: "twitter",
      description: "Falls back to the social description when empty.",
      validation: (r) => r.max(200),
    }),
    defineField({
      name: "twitterImage", title: "X Image", type: "image", group: "social", fieldset: "twitter",
      description: "Falls back to the social sharing image when empty.",
      options: { hotspot: true }, fields: [altField],
    }),

    // ── Advanced SEO ─────────────────────────────────────────────────────────
    defineField({
      name: "canonicalUrl", title: "Canonical URL", type: "url", group: "advanced",
      description: "Leave empty to use the article URL automatically. Only set this when the article first appeared somewhere else.",
      validation: (r) => r.uri({ scheme: ["https"] }),
    }),
    defineField({
      name: "schemaType", title: "Article Schema Type", type: "string", group: "advanced",
      description: "How Google is told to treat this page. Blog Posting suits almost every post.",
      options: { layout: "radio", list: [{ title: "Blog Posting", value: "BlogPosting" }, { title: "Article", value: "Article" }, { title: "News Article", value: "NewsArticle" }] },
      initialValue: "BlogPosting",
    }),
    robotsToggle("robotsIndex", "Allow search engines to index this article", true),
    robotsToggle("robotsFollow", "Allow search engines to follow links", true),
    robotsToggle("robotsNoArchive", "Prevent cached copies", false),
    robotsToggle("robotsNoImageIndex", "Prevent image indexing", false),
    robotsToggle("robotsNoSnippet", "Prevent text snippets", false),
    defineField({
      name: "robotsMaxSnippet", title: "Maximum Snippet Length", type: "number", group: "advanced", fieldset: "previewLimits",
      description: "Characters Google may show as a snippet. Use -1 for no limit.",
      initialValue: -1, validation: (r) => r.min(-1).integer(),
    }),
    defineField({
      name: "robotsMaxVideoPreview", title: "Maximum Video Preview", type: "number", group: "advanced", fieldset: "previewLimits",
      description: "Seconds of video Google may preview. Use -1 for no limit.",
      initialValue: -1, validation: (r) => r.min(-1).integer(),
    }),
    defineField({
      name: "robotsMaxImagePreview", title: "Maximum Image Preview", type: "string", group: "advanced", fieldset: "previewLimits",
      options: { layout: "radio", list: [{ title: "Large", value: "large" }, { title: "Standard", value: "standard" }, { title: "None", value: "none" }] },
      initialValue: "large",
    }),
    defineField({
      name: "excludeFromSitemap", title: "Exclude from XML sitemap", type: "boolean", group: "advanced",
      description: "Posts that are not indexed are always left out.",
      initialValue: false,
    }),
    defineField({
      name: "redirectUrl", title: "Redirect Destination", type: "url", group: "advanced", fieldset: "redirect",
      description: "Optional. Visitors to this article are sent here instead (for example after merging two posts).",
      validation: (r) => r.uri({ scheme: ["https"], allowRelative: true }),
    }),
    defineField({
      name: "redirectPermanent", title: "Permanent Redirect", type: "boolean", group: "advanced", fieldset: "redirect",
      description: "On uses a permanent (301) redirect. Off uses a temporary (302) redirect.",
      initialValue: true,
    }),
  ],
  orderings: [{ title: "Newest first", name: "publishedDesc", by: [{ field: "publishedAt", direction: "desc" }] }],
  preview: {
    select: { title: "title", date: "publishedAt", category: "category", media: "featuredImage" },
    prepare: ({ title, date, category, media }) => ({
      title,
      subtitle: [category, date ? new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "No date"].filter(Boolean).join(" | "),
      media,
    }),
  },
});
