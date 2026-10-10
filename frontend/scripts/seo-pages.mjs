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
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
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
  return { file, title: pick("title"), description: pick("description"), canonical };
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
writeFileSync(join(dist, "app.html"), base);

function render({ title, description, canonical }) {
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
  // The blog and contact form talk to the API, blog images come from Sanity's CDN.
  html = html.replace("</head>", `    <link rel="preconnect" href="https://api.arthaleads.com" crossorigin />\n    <link rel="preconnect" href="https://cdn.sanity.io" />\n  </head>`);
  return html;
}

let written = 0;
for (const e of entries) {
  const path = new URL(e.canonical).pathname.replace(/\/+$/, "");
  const out = path === "" ? "index.html" : `${path.slice(1)}.html`;
  if (out.includes("/")) continue; // nested paths are rendered client-side
  writeFileSync(join(dist, out), render(e));
  written++;
  console.log(`  seo  /${path.slice(1).padEnd(18)} -> ${out}  "${e.title}"`);
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
