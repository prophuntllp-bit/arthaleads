// api/blog-index.js - serves /blog and each topic page /blog/category/<slug>
// with the real list of articles in the HTML.
//
// /blog is prerendered at build time, before any post exists in that build, so
// its static copy has no articles, no topics and "0" counts. Crawlers that read
// the HTML (and Google's first pass) would find no links to any post. This
// function takes that prerendered page and fills its four regions (see the top
// of pages/PublicBlog.jsx) with the live list, in the same markup:
// <header id="blog-head">, <dl id="blog-stats">, <nav id="blog-topics"> and
// <section id="blog-articles">. A topic page also gets its own title,
// description, canonical and breadcrumb data. main.jsx then swaps in the live
// page as usual.
//
// vercel.json routes /blog and /blog/category/:slug here. An unknown topic
// answers 404. Any other failure falls back to the plain blog.html.
// The staging site reads the staging API, so its HTML matches the staging app.
const apiFor = (host) => (/staging/.test(String(host)) ? "https://api-staging.arthaleads.com/api" : "https://api.arthaleads.com/api");
const SITE = "https://www.arthaleads.com";

// Same as BLOG_TITLE, BLOG_DESCRIPTION and topicTitle in pages/PublicBlog.jsx.
const BLOG_TITLE = "Real Estate CRM Blog: Lead and Sales Guides | Arthaleads";
const BLOG_DESCRIPTION = "Practical guides for Indian real estate teams on CRM software, lead generation, WhatsApp, follow-ups, site visits and running a sales floor.";
const topicTitle = (t) => (t.seoTitle && t.seoTitle.length > 47 ? t.seoTitle : `${t.seoTitle || t.name} | Arthaleads`);
const PAGE_SIZE = 12;

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sized = (url, w) => (url && url.includes("cdn.sanity.io") && !url.includes("?") ? `${url}?w=${w}&fit=max&auto=format&q=75` : url);
const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "");
const authorOf = (p) => p.byline || p.author?.name || "Arthaleads Team";
const articles = (n) => `${n} ${n === 1 ? "article" : "articles"}`;

// lucide-react icons as they render.
const icon = (name, paths, cls, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name} ${cls}"${extra} aria-hidden="true">${paths.map((d) => `<path d="${d}"></path>`).join("")}</svg>`;
const chevron = () => icon("chevron-right", ["m9 18 6-6-6-6"], "w-3.5 h-3.5");
const arrowRight = () => icon("arrow-right", ["M5 12h14", "m12 5 7 7-7 7"], "w-4 h-4");
const arrowUpRight = () => icon("arrow-up-right", ["M7 7h10v10", "M7 17 17 7"], "w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5", ' style="color:var(--site-brand-ink)"');

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--site-brand)] focus-visible:outline-offset-2";
const category = (p) => (p.category?.name ? `<span class="text-[11px] font-bold uppercase tracking-[0.14em] " style="color:var(--site-brand-ink)">${esc(p.category.name)}</span>` : "");
const fallback = `<div class="absolute inset-0 flex items-center justify-center" style="background:linear-gradient(135deg, rgba(255,107,0,0.16), rgba(255,170,0,0.05)), var(--site-chip)"><img src="/logo.png" alt="" aria-hidden="true" class="w-14 h-14 object-contain opacity-70"/></div>`;

// SiteBlogCard
function card(p) {
  const cover = p.featuredImage
    ? `<img src="${esc(sized(p.featuredImage, 720))}" alt="${esc(p.featuredImageAlt || p.title)}" width="720" height="405" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"/>`
    : fallback;
  return `<a class="site-card site-glow blog-card group h-full flex flex-col overflow-hidden ${FOCUS}" href="/blog/${esc(p.slug)}">`
    + `<div class="p-3 pb-0"><div class="blog-cover relative overflow-hidden" style="aspect-ratio:16 / 9">${cover}</div></div>`
    + `<div class="flex flex-col flex-1 p-6"><div class="flex items-center justify-between gap-3 mb-3">${category(p)}`
    + `<span class="text-xs shrink-0 site-muted">${p.readingTime || 1} min read</span></div>`
    + `<h3 class="font-display site-ink font-bold text-[1.15rem] leading-snug tracking-[-0.01em] mb-3 line-clamp-3 transition-colors group-hover:text-[color:var(--site-brand-ink)]" style="text-wrap:balance">${esc(p.title)}</h3>`
    + (p.excerpt ? `<p class="text-[15px] leading-relaxed line-clamp-3 mb-5">${esc(p.excerpt)}</p>` : "")
    + `<div class="mt-auto pt-4 flex items-center justify-between gap-3 text-xs site-muted" style="border-top:1px solid var(--site-line)">`
    + `<span>${esc(date(p.publishedAt))} · ${esc(authorOf(p))}</span>${arrowUpRight()}</div></div></a>`;
}

// FeaturedCard
function featured(p) {
  const cover = p.featuredImage
    ? `<img src="${esc(sized(p.featuredImage, 1200))}" alt="${esc(p.featuredImageAlt || p.title)}" width="1200" height="675" loading="eager" fetchpriority="high" decoding="async" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"/>`
    : fallback;
  return `<a class="site-card site-glow blog-card site-feature-glow group grid lg:grid-cols-[1.15fr_1fr] overflow-hidden !rounded-[28px] ${FOCUS}" href="/blog/${esc(p.slug)}">`
    + `<div class="blog-cover relative self-center overflow-hidden aspect-video m-3 sm:m-4 lg:m-5 !rounded-[18px] sm:!rounded-[22px]">${cover}</div>`
    + `<div class="flex flex-col justify-between p-6 sm:p-8 lg:p-10"><div>`
    + `<div class="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5"><span class="site-eyebrow !text-xs">Latest</span>${category(p)}</div>`
    + `<h3 class="font-display site-ink font-extrabold text-[26px] sm:text-[32px] xl:text-[36px] leading-[1.12] tracking-[-0.02em] mb-4 transition-colors group-hover:text-[color:var(--site-brand-ink)]" style="text-wrap:balance">${esc(p.title)}</h3>`
    + (p.excerpt ? `<p class="text-base leading-relaxed line-clamp-3">${esc(p.excerpt)}</p>` : "")
    + `</div><div class="flex items-center justify-between gap-4 mt-7 pt-5" style="border-top:1px solid var(--site-line)">`
    + `<span class="text-xs site-muted">${esc(date(p.publishedAt))} · ${p.readingTime || 1} min read</span>`
    + `<span class="site-link text-sm transition-all group-hover:gap-2">Read the guide ${arrowRight()}</span></div></div></a>`;
}

// ListHead
const listHead = (eyebrow, title, note) => `<div class="mb-7">${eyebrow ? `<p class="site-eyebrow !text-xs mb-2">${esc(eyebrow)}</p>` : ""}`
  + `<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2"><h2 class="font-display site-ink font-extrabold tracking-[-0.02em] text-[26px] sm:text-[32px]">${esc(title)}</h2>`
  + `${note ? `<span class="text-sm site-muted">${esc(note)}</span>` : ""}</div></div>`;
const grid = (ps) => `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">${ps.map((p) => `<div class="h-full">${card(p)}</div>`).join("")}</div>`;

function articlesHtml(posts, topic, totalAll) {
  if (topic) {
    return `<div id="blog-all" class="scroll-mt-28">${listHead(null, `All ${topic.name} guides`, articles(posts.length))}${grid(posts.slice(0, PAGE_SIZE))}</div>`;
  }
  const [first, ...others] = posts;
  const recent = others.slice(0, 3);
  const rest = others.slice(3);
  return `<div class="mb-14 lg:mb-16">${listHead("Featured", "The latest guide")}${featured(first)}</div>`
    + (recent.length ? `<div class="mb-14 lg:mb-16"><p class="text-[11px] font-bold uppercase tracking-[0.14em] site-muted mb-5">Also recent</p>`
      + `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">${recent.map(card).join("")}</div></div>` : "")
    + (rest.length ? `<div id="blog-all" class="scroll-mt-28">${listHead("All guides", "Keep exploring", articles(totalAll))}${grid(rest.slice(0, PAGE_SIZE))}</div>` : "");
}

const tab = (href, on, label, count) =>
  `<a${on ? ' aria-current="page"' : ""} class="blog-topic${on ? " is-on" : ""}" href="${href}">${esc(label)}<span class="blog-topic__count">${count}</span></a>`;

function headHtml(topic) {
  const link = (href, text) => `<a class="hover:text-[color:var(--site-brand-ink)] transition-colors" href="${href}">${text}</a>`;
  return `<nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-2 text-sm site-muted mb-6">${link("/", "Home")}${chevron()}`
    + `${link("/blog", "Blog")}${chevron()}<span style="color:var(--site-text)" aria-current="page">${esc(topic.name)}</span></nav>`
    + `<p class="site-eyebrow mb-4">Topic</p>`
    + `<h1 class="font-display site-ink font-extrabold tracking-[-0.03em] text-[34px] leading-[1.08] sm:text-[46px] lg:text-[52px]" style="text-wrap:balance">${esc(topic.name)}</h1>`
    + `<p class="mt-5 text-base sm:text-[17px] leading-relaxed max-w-[38rem]" style="text-wrap:pretty">${esc(topic.intro || topic.description)}</p>`;
}

function setTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, () => tag) : html.replace("</head>", () => `    ${tag}\n  </head>`);
}
// A region's contents, found by its opening tag (with id) and the first closing tag of that kind.
const fill = (html, tag, id, inner) =>
  html.replace(new RegExp(`(<${tag} id="${id}"[^>]*>)[\\s\\S]*?(</${tag}>)`), (_, open, close) => `${open}${inner}${close}`);

export default async function handler(req, res) {
  const API = apiFor(req.headers.host);
  const proto = req.headers["x-forwarded-proto"] || "https";
  const slug = String(req.query.category || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  let html;
  try {
    const r = await fetch(`${proto}://${req.headers.host}/blog.html`);
    if (!r.ok) throw new Error(`blog.html ${r.status}`);
    html = await r.text();
  } catch { res.status(502).send("Temporarily unavailable"); return; }

  let status = 200;
  try {
    const get = (path) => fetch(`${API}${path}`, { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : {}));
    const [catData, postData] = await Promise.all([
      get("/blog/categories?inUse=1"),
      get(`/blog/posts?page=1&limit=100${slug ? `&category=${encodeURIComponent(slug)}` : ""}`),
    ]);
    const categories = catData.categories || [];
    const posts = postData.posts || [];
    const totalAll = categories.reduce((n, c) => n + (c.count || 0), 0);
    const topic = slug ? categories.find((c) => c.slug === slug) : null;

    if (slug && !topic) {
      // No such topic (or no article in it yet): the app shows "Topic not found".
      status = 404;
      html = setTag(html, /<meta name="robots"[^>]*>/, `<meta name="robots" content="noindex, follow" />`)
        .replace(/<link rel="canonical"[^>]*>\s*/g, "");
    } else {
      const title = topic ? topicTitle(topic) : BLOG_TITLE;
      const desc = topic ? topic.description : BLOG_DESCRIPTION;
      const url = topic ? `${SITE}/blog/category/${topic.slug}` : `${SITE}/blog`;
      html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`);
      html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`);
      html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
      html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`);
      html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`);
      html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}">`);
      if (topic) {
        const bc = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
          { "@type": "ListItem", position: 3, name: topic.name, item: url },
        ] };
        // Swap the /blog page's own Home > Blog trail for this one: one BreadcrumbList per page.
        html = html.replace(/\s*<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>/, "");
        html = html.replace("</head>", () => `    <script type="application/ld+json" id="topic-breadcrumb-jsonld">${JSON.stringify(bc).replace(/</g, "\\u003c")}</script>\n  </head>`);
        html = fill(html, "header", "blog-head", headHtml(topic));
      }
      html = html.replace(/(<dl id="blog-stats"[^>]*>[\s\S]*?<dd class="font-display[^"]*">)\d+(<\/dd>[\s\S]*?<dd class="font-display[^"]*">)\d+(<\/dd>)/,
        (_, a, b, c) => `${a}${totalAll}${b}${categories.length}${c}`);
      html = fill(html, "nav", "blog-topics",
        tab("/blog", !topic, "All guides", totalAll) + categories.map((c) => tab(`/blog/category/${esc(c.slug)}`, c.slug === slug, c.name, c.count || 0)).join(""));
      if (posts.length) html = fill(html, "section", "blog-articles", articlesHtml(posts, topic, totalAll));
    }
  } catch { /* keep the prerendered page as it is */ }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Edge-cache for 5 minutes; a newly published post appears within that.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=604800");
  res.status(status).send(html);
}
