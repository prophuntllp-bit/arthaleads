import { defineArrayMember, defineField, defineType } from "sanity";

// Keep this in step with backend/services/sanityBlogSync.js: the sync only
// understands the block types listed in `body`.
export const post = defineType({
  name: "post",
  title: "Blog post",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "Search & sharing" },
  ],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "content", validation: (r) => r.required().max(200) }),
    defineField({
      name: "slug", title: "Web address", type: "slug", group: "content",
      description: "The page will be at arthaleads.com/blog/<this>. Click Generate. Do not change it after the post is live.",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "publishedAt", title: "Publish at", type: "datetime", group: "content",
      description: "The post appears on the website at this date and time (and only after you click Publish). Set a future time to schedule it.",
      initialValue: () => new Date().toISOString(),
      validation: (r) => r.required(),
    }),
    defineField({
      name: "excerpt", title: "Summary", type: "text", rows: 3, group: "content",
      description: "Shown on the blog list and in search results. About 150 characters.",
      validation: (r) => r.max(500),
    }),
    defineField({
      name: "featuredImage", title: "Main image", type: "image", group: "content", options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Describe the image", type: "string", description: "For screen readers and Google Images." })],
    }),
    defineField({
      name: "category", title: "Category", type: "string", group: "content",
      options: { list: ["CRM Tips", "Lead Generation", "WhatsApp Marketing", "Real Estate Sales", "Product Updates"] },
    }),
    defineField({ name: "tags", title: "Tags", type: "array", of: [{ type: "string" }], options: { layout: "tags" }, group: "content" }),
    defineField({
      name: "body", title: "Article", type: "array", group: "content",
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
    defineField({
      name: "metaTitle", title: "Search title", type: "string", group: "seo",
      description: "What Google shows as the headline. Up to 60 characters. Leave empty to use the title.",
      validation: (r) => r.max(70).warning("Over 60 characters may be cut off in Google."),
    }),
    defineField({
      name: "metaDescription", title: "Search description", type: "text", rows: 3, group: "seo",
      description: "What Google shows under the headline. 120 to 155 characters. Leave empty to use the summary.",
      validation: (r) => r.max(160),
    }),
    defineField({ name: "focusKeyword", title: "Main keyword", type: "string", group: "seo", description: "The phrase this post should rank for, e.g. real estate CRM India." }),
  ],
  orderings: [{ title: "Newest first", name: "publishedDesc", by: [{ field: "publishedAt", direction: "desc" }] }],
  preview: {
    select: { title: "title", date: "publishedAt", media: "featuredImage" },
    prepare: ({ title, date, media }) => ({ title, subtitle: date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No date", media }),
  },
});
