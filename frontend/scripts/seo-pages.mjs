// scripts/seo-pages.mjs - runs after `vite build`.
//
// The site is a single-page app, so without this every URL is served the same
// index.html: same <title>, same description, no canonical. Google sees dozens
// of identical documents before any JavaScript runs and reports them as
// "Duplicate without user-selected canonical".
//
// This writes one HTML file per public page (dist/pricing.html, ...) with that
// page's own title, description, canonical and social tags in the raw HTML.
// vercel.json's `cleanUrls` serves dist/pricing.html at /pricing, and static
// files win over the SPA rewrite, so app routes are unaffected.
//
// The metadata is read straight from each page's useSEO({...}) call, so there
// is one source of truth: change the title in the page and the HTML follows.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root  = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist  = join(root, "dist");
const pages = join(root, "src", "pages");
const SITE  = "https://www.arthaleads.com";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function readSeo(file) {
  const src = readFileSync(join(pages, file), "utf8");
  const m = src.match(/useSEO\(\{([\s\S]*?)\}\);/);
  if (!m) return null;
  const pick = (key) => {
    const r = m[1].match(new RegExp(`${key}:\\s*(["'])((?:\\\\.|(?!\\1).)*)\\1`));
    return r ? r[2].replace(/\\(["'])/g, "$1") : null;
  };
  const canonical = pick("canonical");
  if (!canonical || !canonical.startsWith(SITE)) return null;
  // Pages that write their own BreadcrumbList (compare/*, solution pages) keep it.
  const ownCrumbs = /BreadcrumbList|CompetitorComparison|SolutionPage/.test(src);
  return { file, title: pick("title"), description: pick("description"), canonical, robots: pick("robots"), ownCrumbs };
}

const entries = readdirSync(pages).filter((f) => f.endsWith(".jsx")).map(readSeo).filter(Boolean);
// The blog index sets its tags with its own hook; add it by hand.
entries.push({
  file: "PublicBlog.jsx",
  title: "Blog - Arthaleads Real Estate CRM",
  description: "Practical guides on real estate lead management, WhatsApp follow-up, Facebook lead ads and CRM habits that help Indian sales teams close more deals.",
  canonical: `${SITE}/blog`,
});

const base = readFileSync(join(dist, "index.html"), "utf8");
// index.html is about to become the home page's file. Keep an untouched copy as
// the fallback for the CRM host and for unknown URLs (vercel.json rewrites
// everything else to /app.html), so they never claim to be the home page.
// It is also what a mistyped www URL gets (status 200), so it carries noindex
// in the raw HTML; otherwise Google sees a soft 404. Marketing pages reached
// from it in the browser set their own robots tag through useSEO.
writeFileSync(join(dist, "app.html"), base.replace(/(<meta name="description"[^>]*>)/, `$1
    <meta name="robots" content="noindex, follow" />`));

// Breadcrumb names: short, as in the menu. Anything not listed uses the part
// of its <title> before " | " / " - ".
const CRUMB = {
  "/features": "Features", "/pricing": "Pricing", "/compare": "Compare", "/whatsapp-crm": "WhatsApp CRM",
  "/product-tour": "Product tour", "/blog": "Blog", "/about-us": "About us", "/contact": "Contact",
  "/careers": "Careers", "/security": "Security", "/help-guide": "Help guide", "/product-updates": "Product updates",
  "/download-app": "Download the app", "/wordpress-plugin": "WordPress plugin", "/api-docs": "API docs",
  "/refer": "Refer and earn", "/privacy": "Privacy policy", "/terms": "Terms of service", "/refund": "Refund policy",
  "/cookie-policy": "Cookie policy",
};
const crumbName = (path, title) => CRUMB[path] || String(title || "").split(/ \| | - /)[0].trim();

// BreadcrumbList for every indexable page below the home page, in the raw HTML,
// so Google can show "Arthaleads > Pricing" in results.
function breadcrumbLd(path, title) {
  const parts = path.split("/").filter(Boolean);
  const items = [{ name: "Home", item: `${SITE}/` }];
  parts.forEach((_, i) => {
    const p = "/" + parts.slice(0, i + 1).join("/");
    items.push({ name: crumbName(p, i === parts.length - 1 ? title : ""), item: `${SITE}${p}` });
  });
  const ld = { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, item: x.item })) };
  return `    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n`;
}

function render({ title, description, canonical, robots, ownCrumbs }) {
  let html = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(description)}">`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(canonical)}">`)
    .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}">`)
    .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(description)}">`)
    .replace(/<link rel="canonical"[^>]*>\s*/g, "")
    // Marketing pages may be zoomed (accessibility); the CRM shell (app.html) keeps its fixed viewport.
    .replace(/<meta name="viewport"[^>]*>/, `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`);
  html = html.replace(/(<meta name="description"[^>]*>)/, `$1\n    <link rel="canonical" href="${esc(canonical)}" />`);
  // A page that asks for it in useSEO({ robots }) (e.g. "noindex, follow") gets the tag in the HTML too.
  if (robots) html = html.replace(/(<meta name="description"[^>]*>)/, `$1\n    <meta name="robots" content="${esc(robots)}" />`);
  // The blog and contact form talk to the API, blog images come from Sanity's CDN.
  const path = new URL(canonical).pathname.replace(/\/+$/, "");
  if (path && !ownCrumbs && !/noindex/.test(robots || "")) html = html.replace("</head>", `${breadcrumbLd(path, title)}  </head>`);
  html = html.replace("</head>", `    <link rel="preconnect" href="https://api.arthaleads.com" crossorigin />\n    <link rel="preconnect" href="https://cdn.sanity.io" />\n  </head>`);
  return html;
}

let written = 0;
for (const e of entries) {
  const path = new URL(e.canonical).pathname.replace(/\/+$/, "");
  const out = path === "" ? "index.html" : `${path.slice(1)}.html`;
  // Nested pages (/compare/sell-do-alternative) go in a subfolder of dist.
  mkdirSync(dirname(join(dist, out)), { recursive: true });
  writeFileSync(join(dist, out), render(e));
  written++;
  console.log(`  seo  /${path.slice(1).padEnd(28)} -> ${out}  "${e.title}"`);
}
// Every generated page needs an explicit rewrite in vercel.json (/pricing -> /pricing.html),
// otherwise it is written but never served.
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const rewritten = new Set((vercel.rewrites || []).map((r) => r.source));
const missing = entries
  .map((e) => new URL(e.canonical).pathname.replace(/\/+$/, ""))
  .filter((p) => p && !rewritten.has(p));
if (missing.length) { console.error(`seo-pages: add rewrites to vercel.json for: ${missing.join(", ")}`); process.exit(1); }
console.log(`seo-pages: wrote ${written} pages`);
