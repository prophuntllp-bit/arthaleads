// api/blog-post.js - serves /blog/<slug> with that post's own tags in the HTML.
//
// The site is a single-page app: every URL is the same app shell, and the real
// title is only set after JavaScript runs. Crawlers that do not run it (the
// previews WhatsApp, LinkedIn, Facebook and X build, and Google's first pass)
// would see the generic home tags. This function fetches the post and writes
// its title, description, canonical and share image into the shell. The page
// itself is unchanged: the app loads on top and renders the article as before.
//
// vercel.json routes /blog/:slug here. Any failure falls back to the plain shell.
const API = "https://api.arthaleads.com/api";
const SITE = "https://www.arthaleads.com";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

async function shell(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const res = await fetch(`${proto}://${req.headers.host}/app.html`);
  if (!res.ok) throw new Error(`shell ${res.status}`);
  return res.text();
}

const abs = (u) => (!u ? "" : u.startsWith("http") ? u : `${SITE}${u}`);

// The Studio's robots switches as one meta robots value.
function robotsValue(r = {}) {
  const parts = [r.index === false ? "noindex" : "index", r.follow === false ? "nofollow" : "follow"];
  if (r.noArchive) parts.push("noarchive");
  if (r.noImageIndex) parts.push("noimageindex");
  if (r.noSnippet) parts.push("nosnippet");
  else if (Number.isInteger(r.maxSnippet)) parts.push(`max-snippet:${r.maxSnippet}`);
  parts.push(`max-image-preview:${r.maxImagePreview || "large"}`);
  if (Number.isInteger(r.maxVideoPreview)) parts.push(`max-video-preview:${r.maxVideoPreview}`);
  return parts.join(", ");
}

function setTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function articleLd(post, { url, desc, image }) {
  const keywords = [post.focusKeyword, ...(post.secondaryKeywords || []), ...(post.tags || [])].filter(Boolean);
  const author = post.byline || post.author?.name;
  return {
    "@context": "https://schema.org",
    "@type": post.schemaType || "BlogPosting",
    headline: post.title,
    description: desc,
    image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    keywords: keywords.length ? keywords.join(", ") : undefined,
    articleSection: post.category?.name || undefined,
    author: author && author !== "Arthaleads Team"
      ? { "@type": "Person", name: author }
      : { "@type": "Organization", name: "Arthaleads", url: SITE },
    publisher: { "@type": "Organization", name: "Arthaleads", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/logo.png` } },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

// ── The article itself, in the HTML ─────────────────────────────────────────
// Without it the HTML that crawlers fetch first holds ~9 words: Google has to
// wait for its rendering pass, and crawlers that never run JavaScript (Bing's
// first pass, AI search bots, link previews) see no article at all. The copy
// goes into #root as a prerendered page (see "Prerendered pages" in main.jsx),
// hidden behind the usual splash until the live page replaces it, so visitors
// see exactly what they saw before.

// Block HTML comes from our own Sanity sync or the CRM editor. Keep only simple
// inline/text tags and safe links; everything else is dropped to plain text.
const KEEP = new Set(["b", "strong", "i", "em", "u", "s", "a", "br", "code", "mark", "div", "span"]);
function cleanHtml(html) {
  return String(html || "")
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-z0-9]+)\b([^>]*)>/gi, (tag, name, attrs) => {
      name = name.toLowerCase();
      if (!KEEP.has(name)) return "";
      if (tag.startsWith("</")) return `</${name}>`;
      if (name !== "a") return `<${name}>`;
      const href = (attrs.match(/\bhref\s*=\s*"([^"]*)"/i) || [])[1] || "";
      if (!/^(https?:|mailto:|tel:|\/(?!\/))/i.test(href)) return "<a>";
      const internal = /^\/(?!\/)/.test(href) || /^https?:\/\/(www\.)?arthaleads\.com(\/|$)/i.test(href);
      return internal ? `<a href="${esc(href)}">` : `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">`;
    });
}

function blockHtml(b) {
  switch (b.type) {
    case "paragraph": return `<p>${cleanHtml(b.content)}</p>`;
    case "h2": return `<h2>${cleanHtml(b.content)}</h2>`;
    case "h3": return `<h3>${cleanHtml(b.content)}</h3>`;
    case "h4": return `<h4>${cleanHtml(b.content)}</h4>`;
    case "quote": return `<blockquote><p>${cleanHtml(b.content)}</p></blockquote>`;
    case "bulletList": return `<ul>${(b.items || []).map((i) => `<li>${cleanHtml(i)}</li>`).join("")}</ul>`;
    case "numberedList": return `<ol>${(b.items || []).map((i) => `<li>${cleanHtml(i)}</li>`).join("")}</ol>`;
    case "image": return /^https?:/i.test(b.content || "")
      ? `<figure><img src="${esc(b.content)}" alt="${esc(b.alt || "")}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`
      : "";
    case "code": return `<pre><code>${esc(b.content)}</code></pre>`;
    case "divider": return "<hr>";
    default: return "";
  }
}

// The site menu and footer, as plain links, so the first HTML a crawler gets
// links to the main pages the way every other page on the site does (the live
// page draws the real PublicNav/PublicFooter over it). Keep in step with
// components/PublicNav.jsx and PublicFooter.jsx; only pages that are live.
const link = ([href, text]) => `<a href="${href}">${text}</a>`;
const SITE_NAV = [["/", "Home"], ["/features", "Features"], ["/whatsapp-crm", "WhatsApp CRM"], ["/pricing", "Pricing"],
  ["/compare", "Compare"], ["/blog", "Blog"], ["/contact", "Contact"]];
const SITE_FOOTER = [
  ["Product", [["/features", "Features"], ["/pricing", "Pricing"], ["/whatsapp-crm", "WhatsApp CRM"], ["/product-tour", "Product tour"],
    ["/download-app", "Download App"], ["/wordpress-plugin", "WordPress Plugin"], ["/api-docs", "API Docs"]]],
  ["Compare", [["/compare", "All comparisons"], ["/compare/sell-do-alternative", "Arthaleads vs Sell.Do"],
    ["/compare/leadrat-alternative", "Arthaleads vs Leadrat"], ["/compare/kylas-alternative", "Arthaleads vs Kylas"]]],
  ["Company", [["/about-us", "About Us"], ["/careers", "Careers"], ["/blog", "Blog"], ["/product-updates", "Product Updates"],
    ["/help-guide", "Help Guide"], ["/security", "Security"], ["/contact", "Contact Us"]]],
  ["Legal", [["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"], ["/refund", "Refund Policy"], ["/cookie-policy", "Cookie Policy"]]],
];
const siteNav = () => `<header><nav aria-label="Main">${SITE_NAV.map(link).join(" · ")}</nav></header>`;
const siteFooter = () => `<footer>${SITE_FOOTER.map(([h, items]) =>
  `<section><p><strong>${h}</strong></p><ul>${items.map((i) => `<li>${link(i)}</li>`).join("")}</ul></section>`).join("\n")}</footer>`;

function articleHtml(post) {
  const author = post.byline || post.author?.name || "Arthaleads Team";
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" })
    : "";
  const image = abs(post.featuredImage);
  return `${siteNav()}
<main><article>
<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/blog">Blog</a>${post.category?.name ? ` › ${esc(post.category.name)}` : ""}</nav>
<h1>${esc(post.title)}</h1>
${post.excerpt ? `<p>${esc(post.excerpt)}</p>` : ""}
<p>${esc(author)}${date ? ` · <time datetime="${esc(post.publishedAt)}">${esc(date)}</time>` : ""}${post.readingTime ? ` · ${post.readingTime} min read` : ""}</p>
${image ? `<img src="${esc(image)}" alt="${esc(post.featuredImageAlt || post.title)}">` : ""}
${(post.blocks || []).map(blockHtml).join("\n")}
<p><a href="/blog">More guides on the Arthaleads blog</a> · <a href="/features">Arthaleads features</a> · <a href="/pricing">Pricing</a></p>
</article></main>
${siteFooter()}`;
}

// Same switches the prerendered marketing pages use: the copy stays hidden and
// the splash stays up until the live page takes over.
const HIDE_UNTIL_LIVE = `    <style id="prerender-css">[data-prerender-hide] [data-prerendered] { visibility: hidden; }</style>
    <script>document.documentElement.setAttribute("data-prerender-hide","")</script>`;

export default async function handler(req, res) {
  const slug = String(req.query.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  let html;
  try { html = await shell(req); } catch { res.status(502).send("Temporarily unavailable"); return; }

  let post = null;
  let status = 200;
  try {
    // nocount: this lookup must not add to the post's view counter.
    const r = await fetch(`${API}/blog/posts/${encodeURIComponent(slug)}?nocount=1`, { headers: { Accept: "application/json" } });
    if (r.status === 404) status = 404;
    else if (r.ok) post = (await r.json()).post;
  } catch { /* fall back to the plain shell */ }

  if (post?.redirectUrl) {
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    res.redirect(post.redirectPermanent === false ? 302 : 301, post.redirectUrl);
    return;
  }

  if (post) {
    const title = clip(post.metaTitle || post.title, 70);
    const desc = clip(post.metaDescription || post.excerpt, 160);
    const url = post.canonicalUrl || `${SITE}/blog/${post.slug}`;
    const image = abs(post.ogImage || post.featuredImage) || `${SITE}/og-image.png`;
    const full = `${title} - Arthaleads`;
    const ogTitle = clip(post.ogTitle || full, 95);
    const ogDesc = clip(post.ogDescription || desc, 200);
    const twTitle = clip(post.twitterTitle || post.ogTitle || full, 70);
    const twDesc = clip(post.twitterDescription || post.ogDescription || desc, 200);
    const twImage = abs(post.twitterImage) || image;

    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(full)}</title>`);
    // Articles may be pinch-zoomed (the CRM shell this page is built from fixes the zoom).
    html = html.replace(/<meta name="viewport"[^>]*>/, `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`);
    html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`);
    html = setTag(html, /<meta name="robots"[^>]*>/, `<meta name="robots" content="${esc(robotsValue(post.robots))}" />`);
    html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
    html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(ogTitle)}">`);
    html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(ogDesc)}">`);
    html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(`${SITE}/blog/${post.slug}`)}">`);
    html = setTag(html, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="article">`);
    html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}">`);
    html = html.replace(/<meta property="og:image:(width|height|type)"[^>]*>\s*/g, "");   // sizes belong to the default image, not this one
    html = setTag(html, /<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(post.ogImageAlt || post.featuredImageAlt || post.title)}">`);
    html = setTag(html, /<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="${esc(post.twitterCard || "summary_large_image")}">`);
    html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(twTitle)}">`);
    html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(twDesc)}">`);
    html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(twImage)}">`);
    if (post.publishedAt) html = setTag(html, /<meta property="article:published_time"[^>]*>/, `<meta property="article:published_time" content="${esc(post.publishedAt)}">`);
    if (post.updatedAt) html = setTag(html, /<meta property="article:modified_time"[^>]*>/, `<meta property="article:modified_time" content="${esc(post.updatedAt)}">`);
    const keywords = [post.focusKeyword, ...(post.secondaryKeywords || [])].filter(Boolean);
    if (keywords.length) html = setTag(html, /<meta name="keywords"[^>]*>/, `<meta name="keywords" content="${esc(keywords.join(", "))}" />`);
    // Structured data in the source too; the app replaces it (same id) once it loads.
    // Every "<" is escaped so a title can never close the script tag early.
    const ld = articleLd(post, { url: `${SITE}/blog/${post.slug}`, desc, image });
    html = html.replace("</head>", `    <script type="application/ld+json" id="blog-jsonld">${JSON.stringify(ld).replace(/</g, "\u005Cu003c")}</script>\n  </head>`);
    // Breadcrumb too, built exactly like PublicBlogPost's (same id, so the app replaces it).
    const crumbs = [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
    ];
    if (post.category?.name) crumbs.push({ "@type": "ListItem", position: 3, name: post.category.name, item: `${SITE}/blog?category=${post.category._id}` });
    crumbs.push({ "@type": "ListItem", position: crumbs.length + 1, name: post.breadcrumbTitle || post.title, item: `${SITE}/blog/${post.slug}` });
    const bc = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs };
    html = html.replace("</head>", `    <script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(bc).replace(/</g, "\u005Cu003c")}</script>
  </head>`);
    if (html.includes('<div id="root"></div>')) {
      html = html
        .replace("</head>", `${HIDE_UNTIL_LIVE}
  </head>`)
        .replace('<div id="root"></div>', `<div id="root" data-prerendered>${articleHtml(post)}</div>`);
    }
  } else {
    // Unknown or unreachable: keep the shell, but never claim the home canonical.
    html = html.replace(/<link rel="canonical"[^>]*>\s*/g, "");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Edge-cache for 5 minutes; a post edit shows up in previews within that.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(status).send(html);
}
