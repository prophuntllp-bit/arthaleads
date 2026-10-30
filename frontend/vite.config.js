import { createHash } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The id an open CRM tab compares with /version.json to offer "A new version
// is ready" (components/UpdateBanner.jsx). It is a hash of the code the CRM
// can run, not the commit: a push that only changes the website (or only the
// backend) used to prompt every signed-in user to refresh for nothing
// (30 Oct 2026). Website page chunks, and whatever only they load, are left
// out; a CRM tab that later opens one of those pages and finds its old chunk
// gone reloads by itself (components/ErrorBoundary.jsx).
const BUILD_PLACEHOLDER = "__ARTHALEADS_BUILD_ID__";
const WEBSITE_PAGE = /\/src\/pages\/(Landing|Features|Pricing|Compare|SellDoAlternative|LeadratAlternative|KylasAlternative|WhatsAppCrm|AiCrm|BuilderCrm|AboutUs|CaseStudies|ProductUpdates|HelpGuide|WordPressPlugin|Contact|BookDemo|Careers|DownloadApp|ProductTour|PublicBlog|PublicBlogPost|Privacy|Terms|Refund|CookiePolicy|Security|ReferEarn|ApiDocs|DeleteAccount)\.jsx$/;
// "Leads-AbC12xYz.js" -> "Leads.js", so a renamed chunk alone does not count.
const FILE_HASH = /-[\w-]{8}(?=\.(?:js|css)\b)/g;

function crmBuildId(bundle) {
  const files = Object.values(bundle);
  const byName = Object.fromEntries(files.map((f) => [f.fileName, f]));
  // A chunk holding a website page loads only through website pages: Rollup
  // groups modules that are reached through the same pages.
  const websiteOnly = (f) => f.type === "chunk" && !f.isEntry && f.moduleIds.some((m) => WEBSITE_PAGE.test(m.replace(/\\/g, "/")));
  const seen = new Set();
  const stack = files.filter((f) => f.type === "chunk" && f.isEntry).map((f) => f.fileName);
  while (stack.length) {
    const name = stack.pop();
    const f = byName[name];
    if (seen.has(name) || !f || websiteOnly(f)) continue;
    seen.add(name);
    if (f.type === "chunk") stack.push(...f.imports, ...f.dynamicImports, ...(f.viteMetadata?.importedCss || []));
  }
  const hash = createHash("sha256");
  [...seen].map((n) => [n.replace(FILE_HASH, ""), byName[n]]).sort(([a], [b]) => a.localeCompare(b)).forEach(([n, f]) => {
    hash.update(n);
    hash.update(String(f.type === "chunk" ? f.code : f.source).replace(FILE_HASH, ""));
  });
  return hash.digest("hex").slice(0, 16);
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "write-version-json",
      apply: "build",
      generateBundle(_, bundle) {
        const build = crmBuildId(bundle);
        for (const f of Object.values(bundle)) {
          if (f.type === "chunk" && f.code.includes(BUILD_PLACEHOLDER)) f.code = f.code.split(BUILD_PLACEHOLDER).join(build);
        }
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build }) });
      },
    },
  ],
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_PLACEHOLDER),
  },
  build: {
    // Never inline fonts as data: URLs: the CSP's font-src allows only 'self'
    // and Google Fonts, so an inlined @fontsource subset would be blocked.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  server: {
    port: 3000,
  },
});
