// scripts/prerender.mjs - runs after `vite build` and seo-pages.mjs.
//
// Writes each marketing page's rendered HTML into its dist/*.html file, inside
// <div id="root" data-prerendered>. Before this every page was an empty shell
// until JavaScript ran: Google saw no <h1> and no copy on first pass, and
// phones painted nothing for several seconds. main.jsx shows the prerendered
// HTML until the live app has rendered the same page, then swaps.
//
// Never fatal: a page that fails to render keeps its plain shell, and the
// build carries on. dist/app.html (CRM shell, unknown URLs) is never touched.
import { build } from "vite";
import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const outDir = join(root, "node_modules", ".prerender");

// ── 1. Server bundle of the marketing pages ────────────────────────────────
await build({
  root,
  logLevel: "warn",
  build: {
    ssr: "src/entry-prerender.jsx",
    outDir,
    emptyOutDir: true,
    rollupOptions: { output: { format: "esm", entryFileNames: "entry.mjs" } },
  },
  ssr: { noExternal: true },   // bundle everything: deps here are ESM/CJS mixed
});

// ── 2. Just enough browser to render (effects never run on the server) ────
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: () => null, length: 0 };
};
const noop = () => {};
const location = new URL("https://www.arthaleads.com/");
const fakeEl = () => ({
  setAttribute: noop, getAttribute: () => null, removeAttribute: noop, appendChild: (c) => c, insertBefore: (c) => c, removeChild: noop, remove: noop,
  querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop,
  classList: { add: noop, remove: noop, contains: () => false, toggle: noop }, style: {}, dataset: {},
  firstChild: { data: "" }, childNodes: [], innerHTML: "", textContent: "",
});
const g = globalThis;
g.window = g;
g.localStorage = memStore();
g.sessionStorage = memStore();
g.location = location;
if (!g.navigator || !g.navigator.userAgent) Object.defineProperty(g, "navigator", { value: { userAgent: "Mozilla/5.0 (prerender)", language: "en-IN", connection: { saveData: false } }, configurable: true });
// Reduced motion on the server: count-ups render their final value and
// reveals start visible, so the static HTML never contains hidden copy.
g.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop });
g.document = {
  documentElement: fakeEl(), body: fakeEl(), head: fakeEl(),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: fakeEl, addEventListener: noop, removeEventListener: noop, cookie: "", title: "",
};
g.addEventListener = noop;
g.removeEventListener = noop;
g.dispatchEvent = noop;
g.scrollTo = noop;
g.requestAnimationFrame = (cb) => setTimeout(cb, 0);
g.cancelAnimationFrame = clearTimeout;
g.innerWidth = 1366;
g.innerHeight = 860;

// ── 3. Render and inject ──────────────────────────────────────────────────
// Added to each prerendered page's <head>:
//  - sections that fade in on scroll start at opacity:0 in their first render;
//    in the static copy they are simply shown. Match exactly "opacity:0" (then
//    ";" or end of attribute): a bare substring match also caught decorative
//    values like the hero grid's opacity:0.035 and drew it at full strength.
//  - the HTML is rendered in the light theme. Visitors who chose dark (and the
//    CRM host, which serves the same files for /) keep the splash screen and
//    never see it; everyone else skips the splash, because the page itself is
//    already on screen.
//  - the static copy has no React, so its nav never turns solid on scroll; a
//    tiny script sets data-scrolled and the CSS gives that nav its scrolled look.
const HEAD_EXTRA = `    <style id="prerender-css">
      [data-prerendered] [style*="opacity:0;"], [data-prerendered] [style$="opacity:0"] { opacity: 1 !important; transform: none !important; filter: none !important; }
      [data-prerender-hide] [data-prerendered] { visibility: hidden; }
      html:not([data-prerender-hide]) #app-splash { display: none; }
      [data-scrolled] [data-prerendered] nav { background: rgba(255,255,255,0.97) !important; border-bottom: 1px solid #e5e7eb; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
    </style>
    <script>(function(){var f=function(){document.documentElement.toggleAttribute("data-scrolled",window.scrollY>20)};f();addEventListener("scroll",f,{passive:true})})()</script>
    <script>try{if(location.hostname==="app.arthaleads.com"||localStorage.getItem("public_theme")==="dark")document.documentElement.setAttribute("data-prerender-hide","")}catch(e){}</script>`;

// ── 3a. Load order ─────────────────────────────────────────────────────────
// Audit, 28 Oct 2026: on a phone the app's JavaScript arrived and ran before
// the browser had painted the static copy (the hero text waited on its font,
// the hero photo on its download), so the page's main content showed only
// after the app had finished starting: 3.5-5.5 s in Lighthouse's phone test.
// Now the fonts the first screen uses are preloaded, and the app starts once
// the static copy is on screen: fonts ready, the page's main image (the one
// marked fetchpriority=high; measuring positions forced an early layout) loaded
// and decoded (30 Oct 2026: a decoded-later hero waited 1-2 s behind the app's
// start-up on a slow phone), two frames painted (2.5 s at most; straight away in background tabs and for
// dark-theme visitors, who see the splash, not the static copy). Links
// in the static copy work as plain links in the meantime.
const assets = readdirSync(join(dist, "assets"));
const FONT_PRELOADS = [/^inter-latin-400-normal-.*\.woff2$/, /^inter-latin-600-normal-.*\.woff2$/, /^manrope-latin-800-normal-.*\.woff2$/]
  .map((re) => assets.find((f) => re.test(f)))
  .filter(Boolean)
  .map((f) => `    <link rel="preload" as="font" type="font/woff2" href="/assets/${f}" crossorigin>`)
  .join("\n");
const bootScript = (src) => `<script>(function(){var d=document,w=window,started=0;
      function boot(){if(started)return;started=1;w.__alBootStarted=Date.now();var s=d.createElement("script");s.type="module";s.crossOrigin="";s.src=${JSON.stringify(src)};d.head.appendChild(s)}
      function painted(){requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(boot,0)})});setTimeout(boot,500)}
      function ready(){setTimeout(boot,2500);if(d.hidden||d.documentElement.hasAttribute("data-prerender-hide"))return boot();var waits=[];if(d.fonts&&d.fonts.ready)waits.push(d.fonts.ready);
        var imgs=d.querySelectorAll("#root img[fetchpriority=high]");for(var i=0;i<imgs.length;i++){var im=imgs[i];
          waits.push(im.decode?im.decode().catch(function(){}):im.complete?0:new Promise(function(r){im.addEventListener("load",r);im.addEventListener("error",r)}))}
        Promise.all(waits).then(painted,painted)}
      if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",ready);else ready()})()</script>`;
const deferBoot = (html) => html.replace(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"><\/script>/, (_, src) => bootScript(src));
// The stylesheet goes into the page itself: a separate file held the first
// paint back by a whole extra request on a slow phone connection (Lighthouse
// "render-blocking", ~1 s). Its font and image URLs are absolute (/assets/...).
const inlineCss = (html) => html.replace(/<link rel="stylesheet"(?: crossorigin)? href="(\/assets\/[^"]+\.css)"\s*\/?>/, (tag, href) => {
  const css = readFileSync(join(dist, href.slice(1)), "utf8");
  // The disabled link is never fetched or applied; it is there so Vite's lazy
  // chunk loader (which looks for link[href][rel=stylesheet]) knows the sheet
  // is already on the page and does not add and re-parse it after the app starts.
  return css.includes("</style") ? tag : `<style id="app-css">${css}</style><link rel="stylesheet" href="${href}" disabled>`;
});

// ── 3b. Render and inject ──────────────────────────────────────────────────
const { render, renderBlogTemplate, PAGES } = await import(pathToFileURL(join(outDir, "entry.mjs")).href);

let ok = 0;
for (const path of Object.keys(PAGES)) {
  const file = join(dist, path === "/" ? "index.html" : `${path.slice(1)}.html`);
  if (!existsSync(file)) { console.warn(`  prerender  ${path}: no ${file}, skipped`); continue; }
  try {
    // Videos in the static copy show their poster only: no autoplay, no
    // preloading. The live app starts them itself once it has taken over, so
    // a 2.4 MB clip no longer competes with the first paint on slow phones.
    const body = render(path)
      .replace(/<video\b[^>]*>/g, (tag) => tag.replace(/\sautoplay=""/g, "").replace(/\spreload="[^"]*"/g, "") .replace(/^<video/, '<video preload="none"'));
    if (!body || body.length < 500) throw new Error(`suspiciously small output (${body.length} bytes)`);
    const shell = readFileSync(file, "utf8");
    if (!shell.includes('<div id="root"></div>')) throw new Error("no empty #root in shell");
    const out = deferBoot(inlineCss(shell
      // The splash never shows on these pages for light-theme visitors: don't preload its logo.
      .replace(/\s*<link rel="preload" as="image" href="\/logo-splash\.webp" \/>/, "")
      .replace("</head>", `${FONT_PRELOADS}
${HEAD_EXTRA}
  </head>`)
      .replace('<div id="root"></div>', `<div id="root" data-prerendered>${body}</div>`)));
    if (!out.includes("__alBootStarted")) console.warn(`  prerender  ${path}: app script tag not found, app starts as before`);
    writeFileSync(file, out);
    ok++;
    console.log(`  prerender  ${path.padEnd(18)} ${(body.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.warn(`  prerender  ${path}: FAILED, keeping the plain shell (${e.message.split("\n")[0]})`);
  }
}
// ── 4. Blog post template ─────────────────────────────────────────────────
// api/blog-post.js fills this in for each post (see renderBlogTemplate). It is
// built from app.html, the shell that function used before; noindex in case
// anyone opens the file itself (the function sets each post's own robots).
try {
  const body = renderBlogTemplate();
  if (!body.includes("@@BODY@@") || !body.includes("<footer")) throw new Error("placeholders or footer missing");
  const shell = readFileSync(join(dist, "app.html"), "utf8");
  if (!shell.includes('<div id="root"></div>')) throw new Error("no empty #root in app.html");
  const out = deferBoot(inlineCss(shell
    .replace(/\s*<link rel="preload" as="image" href="\/logo-splash\.webp" \/>/, "")
    .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex" />')
    .replace("</head>", `${FONT_PRELOADS}
${HEAD_EXTRA}
  </head>`)
    .replace('<div id="root"></div>', `<div id="root" data-prerendered>${body}</div>`)));
  writeFileSync(join(dist, "blog-post-template.html"), out);
  console.log(`  prerender  blog post template ${(body.length / 1024).toFixed(0)} KB`);
} catch (e) {
  console.warn(`  prerender  blog post template: FAILED, posts keep the plain copy (${e.message.split("\n")[0]})`);
}

rmSync(outDir, { recursive: true, force: true });
console.log(`prerender: ${ok}/${Object.keys(PAGES).length} pages`);
process.exit(0);   // stray timers from rendered modules must not hold the build open
