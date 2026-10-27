// api/blog-index.js - serves /blog with the real list of articles in the HTML.
//
// /blog is prerendered at build time, before any post exists in that build, so
// its static copy showed placeholder cards and "0 articles". Crawlers that read
// the HTML (and Google's first pass) found no links to any post. This function
// takes that prerendered page and swaps in the live list: same card design as
// SiteBlogCard in pages/PublicBlog.jsx, coloured by the site's --site-* tokens.
// main.jsx then swaps in the live page as usual.
//
// vercel.json routes /blog here. Any failure falls back to the plain blog.html.
const API = "https://api.arthaleads.com/api";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sized = (url, w) => (url && url.includes("cdn.sanity.io") && !url.includes("?") ? `${url}?w=${w}&fit=max&auto=format&q=75` : url);
const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "");

function card(p) {
  const author = p.byline || p.author?.name || "Arthaleads Team";
  const cover = p.featuredImage
    ? `<img src="${esc(sized(p.featuredImage, 720))}" alt="${esc(p.featuredImageAlt || p.title)}" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover">`
    : `<div class="absolute inset-0" style="background:linear-gradient(135deg, rgba(255,107,0,0.16), rgba(255,170,0,0.05)), var(--site-chip)"></div>`;
  return `<a href="/blog/${esc(p.slug)}" class="site-card group h-full flex flex-col overflow-hidden">`
    + `<div class="relative overflow-hidden" style="aspect-ratio:16 / 10">${cover}</div>`
    + `<div class="flex flex-col flex-1 p-6">`
    + `<div class="flex items-center justify-between gap-3 mb-3">`
    + (p.category?.name ? `<span class="text-[11px] font-bold uppercase tracking-[0.14em]" style="color:var(--site-brand-ink)">${esc(p.category.name)}</span>` : "<span></span>")
    + `<span class="text-xs shrink-0 site-muted">${p.readingTime || 1} min read</span></div>`
    + `<h3 class="font-display site-ink font-bold text-[1.15rem] leading-snug tracking-[-0.01em] mb-3">${esc(p.title)}</h3>`
    + (p.excerpt ? `<p class="text-[15px] leading-relaxed mb-5">${esc(p.excerpt)}</p>` : "")
    + `<div class="mt-auto pt-4 text-xs site-muted" style="border-top:1px solid var(--site-line)">${esc(date(p.publishedAt))} · ${esc(author)}</div>`
    + `</div></a>`;
}

export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  let html;
  try {
    const r = await fetch(`${proto}://${req.headers.host}/blog.html`);
    if (!r.ok) throw new Error(`blog.html ${r.status}`);
    html = await r.text();
  } catch { res.status(502).send("Temporarily unavailable"); return; }

  try {
    const r = await fetch(`${API}/blog/posts?page=1&limit=24`, { headers: { Accept: "application/json" } });
    const { posts = [], total = posts.length } = r.ok ? await r.json() : {};
    if (posts.length) {
      // PublicBlog's <section id="blog-articles"> holds only the loading skeleton
      // in the prerendered copy (no nested sections), so the first </section> closes it.
      const list = `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">${posts.map(card).join("")}</div>`;
      html = html
        .replace(/(<section id="blog-articles"[^>]*>)[\s\S]*?(<\/section>)/, (_, open, close) => `${open}${list}${close}`)
        .replace(/(<span class="font-semibold tabular-nums"[^>]*>)0(<\/span><span>)articles(<\/span>)/,
          (_, a, b, c) => `${a}${total}${b}${total === 1 ? "article" : "articles"}${c}`);
    }
  } catch { /* keep the prerendered page as it is */ }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Edge-cache for 5 minutes; a newly published post appears within that.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(html);
}
