// entry-prerender.jsx
//
// Build-time only (scripts/prerender.mjs). Renders each public marketing page
// to HTML in Node so the files Vercel serves contain the real headings and
// copy, not an empty <div id="root">. Crawlers and link previews read that
// HTML directly; visitors see it instantly while the app loads, then main.jsx
// swaps in the live app (see "Prerendered pages" there).
//
// Pages are imported directly (not lazily) so renderToString can finish in one
// pass. Effects never run on the server, so anything a page fetches or
// measures appears in its initial/loading state.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { PublicThemeProvider } from "./context/PublicThemeContext";
import { AuthProvider } from "./context/AuthContext";

import Landing from "./pages/Landing";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Compare from "./pages/Compare";
import PublicBlog from "./pages/PublicBlog";
import AboutUs from "./pages/AboutUs";
import CaseStudies from "./pages/CaseStudies";
import ProductUpdates from "./pages/ProductUpdates";
import HelpGuide from "./pages/HelpGuide";
import WordPressPlugin from "./pages/WordPressPlugin";
import ApiDocs from "./pages/ApiDocs";
import DownloadApp from "./pages/DownloadApp";
import ReferEarn from "./pages/ReferEarn";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import Security from "./pages/Security";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Refund from "./pages/Refund";
import CookiePolicy from "./pages/CookiePolicy";

// Keep in step with the public routes in App.jsx and scripts/seo-pages.mjs.
export const PAGES = {
  "/": Landing,
  "/features": Features,
  "/pricing": Pricing,
  "/compare": Compare,
  "/blog": PublicBlog,
  "/about-us": AboutUs,
  "/case-studies": CaseStudies,
  "/product-updates": ProductUpdates,
  "/help-guide": HelpGuide,
  "/wordpress-plugin": WordPressPlugin,
  "/api-docs": ApiDocs,
  "/download-app": DownloadApp,
  "/refer": ReferEarn,
  "/careers": Careers,
  "/contact": Contact,
  "/security": Security,
  "/privacy": Privacy,
  "/terms": Terms,
  "/refund": Refund,
  "/cookie-policy": CookiePolicy,
};

export function render(path) {
  const Page = PAGES[path];
  if (!Page) throw new Error(`No prerender page for ${path}`);
  return renderToString(
    <StaticRouter location={path}>
      <PublicThemeProvider>
        <AuthProvider>
          <Page />
        </AuthProvider>
      </PublicThemeProvider>
    </StaticRouter>
  );
}
