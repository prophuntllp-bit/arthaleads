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
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
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
const HEAD_EXTRA = `    <style id="prerender-css">
      [data-prerendered] [style*="opacity:0;"], [data-prerendered] [style$="opacity:0"] { opacity: 1 !important; transform: none !important; filter: none !important; }
      [data-prerender-hide] [data-prerendered] { visibility: hidden; }
      html:not([data-prerender-hide]) #app-splash { display: none; }
    </style>
    <script>try{if(location.hostname==="app.arthaleads.com"||localStorage.getItem("public_theme")==="dark")document.documentElement.setAttribute("data-prerender-hide","")}catch(e){}</script>`;

// ── 3b. Render and inject ──────────────────────────────────────────────────
const { render, PAGES } = await import(pathToFileURL(join(outDir, "entry.mjs")).href);

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
    writeFileSync(file, shell
      .replace("</head>", `${HEAD_EXTRA}
  </head>`)
      .replace('<div id="root"></div>', `<div id="root" data-prerendered>${body}</div>`));
    ok++;
    console.log(`  prerender  ${path.padEnd(18)} ${(body.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.warn(`  prerender  ${path}: FAILED, keeping the plain shell (${e.message.split("\n")[0]})`);
  }
}
rmSync(outDir, { recursive: true, force: true });
console.log(`prerender: ${ok}/${Object.keys(PAGES).length} pages`);
process.exit(0);   // stray timers from rendered modules must not hold the build open
