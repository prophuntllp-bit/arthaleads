// api/blog-post.js - serves /blog/<slug> with that post's own tags in the HTML.
//
// The site is a single-page app: every URL is the same app shell, and the real
// title is only set after JavaScript runs. Crawlers that do not run it (the
// previews WhatsApp, LinkedIn, Facebook and X build, and Google's first pass)
// would see the generic home tags. This function fetches the post and writes
// its title, description, canonical and share image into the shell. The page
// itself is unchanged: the app loads on top and renders the article as before.
//
// The page itself is the real post page: scripts/prerender.mjs builds
// blog-post-template.html (PublicBlogPost rendered with placeholders) and
// fillTemplate() below puts this post into it, so visitors see the article at
// once instead of a splash while the app starts (audit, 28 Oct 2026). Without
// the template (or if anything is left unfilled) the older plain copy is used.
//
// vercel.json routes /blog/:slug here. Any failure falls back to the plain shell.
// The staging site reads the staging API, so its HTML matches the staging app.
const apiFor = (host) => (/staging/.test(String(host)) ? "https://api-staging.arthaleads.com/api" : "https://api.arthaleads.com/api");
const SITE = "https://www.arthaleads.com";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

async function shell(req, file = "app.html") {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const res = await fetch(`${proto}://${req.headers.host}/${file}`);
  if (!res.ok) throw new Error(`shell ${res.status}`);
  return res.text();
}

const abs = (u) => (!u ? "" : u.startsWith("http") ? u : `${SITE}${u}`);
// Same sizing as the live page (components/BlogCard.jsx sizedImage): WebP/AVIF at the width shown.
const sized = (u, w) => (u && u.includes("cdn.sanity.io") && !u.includes("?") ? `${u}?w=${w}&fit=max&auto=format&q=75` : u);

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
  // Function replacers throughout: "$" in a post's text must stay literal.
  return pattern.test(html) ? html.replace(pattern, () => tag) : html.replace("</head>", () => `    ${tag}\n  </head>`);
}

function articleLd(post, { url, desc, image, words }) {
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
    publisher: { "@id": `${SITE}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    "@id": `${url}#article`,
    inLanguage: "en-IN",
    wordCount: words || undefined,
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

// `num` numbers the main sections, as on the live page (see bodyHtml).
function blockHtml(b, num = 0) {
  switch (b.type) {
    case "paragraph": return `<p>${cleanHtml(b.content)}</p>`;
    // Same markup as RenderBlock in pages/PublicBlogPost.jsx (ids feed "In this article").
    case "h2": return `<h2 id="sec-${esc(b.id)}" class="font-display blog-h2"><span class="blog-h2__num" aria-hidden="true">${String(num).padStart(2, "0")}</span><span>${cleanHtml(b.content)}</span></h2>`;
    case "h3": return `<h3 id="sec-${esc(b.id)}" class="font-display">${cleanHtml(b.content)}</h3>`;
    case "h4": return `<h4 class="font-display">${cleanHtml(b.content)}</h4>`;
    case "quote": return `<blockquote><p class="font-display">${cleanHtml(b.content)}</p></blockquote>`;
    case "bulletList": return `<ul>${(b.items || []).map((i) => `<li>${cleanHtml(i)}</li>`).join("")}</ul>`;
    case "numberedList": return `<ol>${(b.items || []).map((i) => `<li>${cleanHtml(i)}</li>`).join("")}</ol>`;
    case "checklist": return `<ul class="blog-checklist">${(b.items || []).map((i) => `<li>${cleanHtml(i)}</li>`).join("")}</ul>`;
    case "table": {
      const [head = [], ...rows] = b.rows || [];
      return `<figure class="blog-table"><div class="blog-table__wrap"><table><thead><tr>${head.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>`
        + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
        + `${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
    }
    case "steps": return `<ol class="blog-steps">${(b.steps || []).map((s, i) => `<li><span class="blog-steps__num" aria-hidden="true">${i + 1}</span><div>`
      + `<p class="blog-steps__title">${esc(s.title)}</p>${s.text ? `<p class="blog-steps__text">${esc(s.text)}</p>` : ""}</div></li>`).join("")}</ol>`;
    case "image": return /^https?:/i.test(b.content || "")
      ? `<figure><img src="${esc(sized(b.content, 1200))}" alt="${esc(b.alt || "")}"${sizeAttrs(b.content)} loading="lazy" decoding="async">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`
      : "";
    case "code": return `<div class="blog-code">${b.language ? `<div class="blog-code__lang">${esc(b.language)}</div>` : ""}<pre><code>${esc(b.content)}</code></pre></div>`;
    case "divider": return "<hr>";
    default: return "";
  }
}

const bodyHtml = (blocks = []) => { let n = 0; return blocks.map((b) => blockHtml(b, b.type === "h2" ? ++n : 0)).join("\n"); };

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

// Sanity image URLs end in -<width>x<height>.<ext>; the size lets the browser reserve the space.
const sizeAttrs = (url) => { const m = /-(\d+)x(\d+)\.\w+(?:\?|$)/.exec(url || ""); return m ? ` width="${m[1]}" height="${m[2]}"` : ""; };

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
${image ? `<img src="${esc(sized(image, 1400))}" alt="${esc(post.featuredImageAlt || post.title)}"${sizeAttrs(image)} fetchpriority="high">` : ""}
${bodyHtml(post.blocks)}
<p><a href="/blog">More guides on the Arthaleads blog</a> · <a href="/features">Arthaleads features</a> · <a href="/pricing">Pricing</a></p>
</article></main>
${siteFooter()}`;
}

// ── The real page, from blog-post-template.html ────────────────────────────
// Placeholders come from renderBlogTemplate() in src/entry-prerender.jsx. Plain
// split/join, never String.replace with a string, so "$" in a post is safe.
const put = (s, token, value) => s.split(token).join(value);
// Same data as faqLd in pages/PublicBlogPost.jsx (the app replaces it, same id).
const faqLd = (faqs) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
});
const TPL_COVER = "https://cdn.sanity.io/images/tpl/tpl/tplcover-2000x1125.png";
// Entities decoded, as on the live page; esc() encodes once when the text is written.
const decodeEntities = (s) => String(s).replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (_, e) => ({ amp: "&", quot: '"', "#39": "'", apos: "'", lt: "<", gt: ">", nbsp: " " })[e]);
const stripTags = (h) => decodeEntities(String(h || "").replace(/<[^>]*>/g, "")).trim();
const dateIN = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "");

// Up to three other guides, same topic first, then the newest: the same choice the
// live page makes in the browser, so crawlers see the links too (SEO audit, 30 Oct 2026).
function relatedHtml(post, posts) {
  const others = (posts || []).filter((p) => p.slug && p.slug !== post.slug && !p.redirectUrl);
  const same = others.filter((p) => p.category?.slug && p.category.slug === post.category?.slug);
  const pick = [...same, ...others.filter((p) => !same.includes(p))].slice(0, 3);
  if (!pick.length) return "";
  return `<nav aria-label="Related guides"><p><strong>Related guides</strong></p><ul>${pick.map((p) => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></li>`).join("")}</ul></nav>`;
}

function fillTemplate(html, post, categories, posts) {
  const author = post.byline || post.author?.name || "Arthaleads Team";
  const initials = author.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const tags = post.tags || [];
  const heads = (post.blocks || []).filter((b) => b.type === "h2")
    .map((b) => ({ id: `sec-${b.id}`, text: stripTags(b.content) })).filter((h) => h.text);
  const takeaways = post.keyTakeaways || [];
  const faqs = post.faqs || [];
  if (faqs.length) heads.push({ id: "faq", text: "Frequently asked questions" });   // as the live page's contents list

  // Parts a post may not have.
  if (!post.category?.name) html = html.replace(/<a [^>]*>@@CATNAME@@<\/a>/, "");
  if (!post.excerpt) html = html.replace(/<p class="mt-9[^>]*>@@EXCERPT@@<\/p>/, "");
  if (!post.featuredImage) html = html.replace(/<figure class="blog-cover[\s\S]*?<\/figure>/, "");
  else {
    const img = abs(post.featuredImage);
    if (img.includes("cdn.sanity.io") && !img.includes("?")) {
      // Same widths and parameters as the template, so only the image path changes.
      html = put(html, TPL_COVER, esc(img));
      html = html.replace(/(<figure class="blog-cover[^>]*><img [^>]*?)alt="@@IMGALT@@"([^>]*?) width="2000" height="1125"/,
        (_, start, mid) => `${start}alt="${esc(post.featuredImageAlt || post.title)}"${mid}${sizeAttrs(img)}`);
      // Start the connection to Sanity's CDN while the page is still arriving.
      html = html.replace("</head>", `    <link rel="preconnect" href="https://cdn.sanity.io">\n  </head>`);
    } else {
      html = html.replace(/(<figure class="blog-cover[^>]*><img )src="[^"]*" alt="@@IMGALT@@"([^>]*?) srcSet="[^"]*" sizes="[^"]*"([^>]*?) width="2000" height="1125"/,
        (_, start, mid, rest) => `${start}src="${esc(img)}" alt="${esc(post.featuredImageAlt || post.title)}"${mid}${rest}${sizeAttrs(img)}`);
    }
  }
  // Repeated parts: the template has one of each.
  html = html.replace(/<a class="site-chip[^"]*" href="\/blog\?tag=%40%40TAG%40%40">#<!-- -->@@TAG@@<\/a>/,
    (chip) => tags.map((t) => put(put(chip, "%40%40TAG%40%40", encodeURIComponent(t)), "@@TAG@@", esc(t))).join(""));
  if (!tags.length) html = html.replace(/<div class="mt-12 pt-7 flex[^"]*"[^>]*><svg[\s\S]*?<\/svg><\/div>/, "");
  html = html.replace(/(<ol class="space-y-1">)(<li>[\s\S]*?<\/li>)(<li>[\s\S]*?<\/li>)(<\/ol>)/, (_, open, first, other, close) =>
    open + heads.map((h, i) => {
      const n = i === 0 ? 1 : 2;
      let li = put(i === 0 ? first : other, `@@HID${n}@@`, esc(h.id));
      li = put(li, `@@HTEXT${n}@@`, esc(h.text));
      return put(li, `>0${n}<`, `>${String(i + 1).padStart(2, "0")}<`);
    }).join("") + close);
  if (heads.length < 2) html = html.replace(/<div class="pt-6"[^>]*><nav aria-label="In this article">[\s\S]*?<\/nav><\/div>/, "");
  html = html.replace(/<option value="@@CSLUG@@">@@CNAME@@<\/option>/,
    () => categories.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}${c.count ? ` (${c.count})` : ""}</option>`).join(""));
  html = html.replace(/<li>@@TK@@<\/li>/, () => takeaways.map((t) => `<li>${esc(t)}</li>`).join(""));
  if (!takeaways.length) html = html.replace(/<aside class="blog-takeaways"[\s\S]*?<\/aside>/, "");
  html = html.replace(/(<details class="blog-faq__item" open="">[\s\S]*?<\/details>)(<details class="blog-faq__item">[\s\S]*?<\/details>)/, (_, first, other) =>
    faqs.map((f, i) => {
      const n = i === 0 ? 1 : 2;
      return put(put(i === 0 ? first : other, `@@FQ${n}@@`, esc(f.question)), `@@FA${n}@@`, esc(f.answer));
    }).join(""));
  if (!faqs.length) html = html.replace(/<section id="faq"[\s\S]*?<\/section>/, "");
  else html = html.replace("</head>", () => `    <script type="application/ld+json" id="faq-jsonld">${JSON.stringify(faqLd(faqs)).replace(/</g, "\u005Cu003c")}</script>\n  </head>`);
  if (!categories.length) html = html.replace(/<label class="relative flex items-center mt-3">[\s\S]*?<\/label>/, "");

  html = put(html, "<p>@@BODY@@</p>", bodyHtml(post.blocks) + relatedHtml(post, posts));
  html = put(html, "%40%40TITLE%40%40", encodeURIComponent(post.title));
  html = put(html, "%40%40SLUG%40%40", encodeURIComponent(post.slug));
  html = put(html, "@@TITLE@@", esc(post.title));
  html = put(html, "@@SLUG@@", esc(post.slug));
  html = put(html, "@@EXCERPT@@", esc(post.excerpt));
  html = put(html, "@@CATSLUG@@", esc(post.category?.slug));
  html = put(html, "@@CATNAME@@", esc(post.category?.name));
  html = put(html, "Qqauthor Zzauthor", esc(author));
  html = put(html, ">QZ<", `>${esc(initials)}<`);
  html = put(html, "3 Feb 2001<!-- -->", `${dateIN(post.publishedAt)}<!-- -->`);
  html = put(html, "<!-- -->97<!-- --> min read", `<!-- -->${Number(post.readingTime) || 1}<!-- --> min read`);
  return /@@[A-Z0-9]+@@|%40%40[A-Z0-9]+%40%40|Qqauthor|tplcover/.test(html) ? null : html;
}

// Same switches the prerendered marketing pages use: the copy stays hidden and
// the splash stays up until the live page takes over.
const HIDE_UNTIL_LIVE = `    <style id="prerender-css">[data-prerender-hide] [data-prerendered] { visibility: hidden; }</style>
    <script>document.documentElement.setAttribute("data-prerender-hide","")</script>`;

export default async function handler(req, res) {
  const API = apiFor(req.headers.host);
  const slug = String(req.query.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  let post = null;
  let status = 200;
  const cats = fetch(`${API}/blog/categories?inUse=1`, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : {})).then((d) => d.categories || []).catch(() => []);
  const recent = fetch(`${API}/blog/posts?limit=12`, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : {})).then((d) => d.posts || []).catch(() => []);
  try {
    // nocount: this lookup must not add to the post's view counter.
    const r = await fetch(`${API}/blog/posts/${encodeURIComponent(slug)}?nocount=1`, { headers: { Accept: "application/json" } });
    if (r.status === 404) status = 404;
    else if (r.ok) post = (await r.json()).post;
  } catch { /* fall back to the plain shell */ }

  // The real page for a post; the plain shell otherwise (or if the template is missing).
  let html = null;
  if (post && !post.redirectUrl) {
    try { html = fillTemplate(await shell(req, "blog-post-template.html"), post, await cats, await recent); } catch { html = null; }
  }
  const filled = !!html;
  if (!html) {
    try { html = await shell(req); } catch { res.status(502).send("Temporarily unavailable"); return; }
  }

  if (post?.redirectUrl) {
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=604800");
    res.redirect(post.redirectPermanent === false ? 302 : 301, post.redirectUrl);
    return;
  }

  if (post) {
    const title = clip(post.metaTitle || post.title, 70);
    const desc = clip(post.metaDescription || post.excerpt, 160);
    const url = post.canonicalUrl || `${SITE}/blog/${post.slug}`;
    const image = abs(post.ogImage || post.featuredImage) || `${SITE}/og-image-ai.png`;
    // Google shows about 60 characters: long titles drop the brand suffix rather than get cut.
    const full = title.length > 47 ? title : `${title} - Arthaleads`;
    const ogTitle = clip(post.ogTitle || full, 95);
    const ogDesc = clip(post.ogDescription || desc, 200);
    const twTitle = clip(post.twitterTitle || post.ogTitle || full, 70);
    const twDesc = clip(post.twitterDescription || post.ogDescription || desc, 200);
    const twImage = abs(post.twitterImage) || image;

    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(full)}</title>`);
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
    const words = stripTags(bodyHtml(post.blocks)).split(/\s+/).filter(Boolean).length;   // lists and tables included
    const ld = articleLd(post, { url: `${SITE}/blog/${post.slug}`, desc, image, words });
    html = html.replace("</head>", () => `    <script type="application/ld+json" id="blog-jsonld">${JSON.stringify(ld).replace(/</g, "\u005Cu003c")}</script>\n  </head>`);
    // Breadcrumb too, built exactly like PublicBlogPost's (same id, so the app replaces it).
    const crumbs = [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
    ];
    if (post.category?.name) crumbs.push({ "@type": "ListItem", position: 3, name: post.category.name, item: `${SITE}/blog/category/${post.category.slug}` });
    crumbs.push({ "@type": "ListItem", position: crumbs.length + 1, name: post.breadcrumbTitle || post.title, item: `${SITE}/blog/${post.slug}` });
    const bc = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs };
    html = html.replace("</head>", () => `    <script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(bc).replace(/</g, "\u005Cu003c")}</script>
  </head>`);
    if (!filled && html.includes('<div id="root"></div>')) {
      html = html
        .replace("</head>", `${HIDE_UNTIL_LIVE}
  </head>`)
        .replace('<div id="root"></div>', () => `<div id="root" data-prerendered>${articleHtml(post)}</div>`);
    }
  } else {
    // Unknown or unreachable: keep the shell, but never claim the home canonical.
    html = html.replace(/<link rel="canonical"[^>]*>\s*/g, "");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Edge-cache for 5 minutes; a post edit shows up in previews within that.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=604800");
  res.status(status).send(html);
}
