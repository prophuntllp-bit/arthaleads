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

function setTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

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

  if (post) {
    const title = clip(post.metaTitle || post.title, 70);
    const desc = clip(post.metaDescription || post.excerpt, 160);
    const url = `${SITE}/blog/${post.slug}`;
    const image = post.featuredImage
      ? (post.featuredImage.startsWith("http") ? post.featuredImage : `${SITE}${post.featuredImage}`)
      : `${SITE}/og-image.png`;
    const full = `${title} - Arthaleads`;

    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(full)}</title>`);
    html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`);
    html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
    html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(full)}">`);
    html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`);
    html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}">`);
    html = setTag(html, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="article">`);
    html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}">`);
    html = html.replace(/<meta property="og:image:(width|height|type)"[^>]*>\s*/g, "");   // sizes belong to the default image, not this one
    html = setTag(html, /<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(post.featuredImageAlt || post.title)}">`);
    html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(full)}">`);
    html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(desc)}">`);
    html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}">`);
  } else {
    // Unknown or unreachable: keep the shell, but never claim the home canonical.
    html = html.replace(/<link rel="canonical"[^>]*>\s*/g, "");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Edge-cache for 5 minutes; a post edit shows up in previews within that.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(status).send(html);
}
