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
import PublicBlogPost from "./pages/PublicBlogPost";
import AboutUs from "./pages/AboutUs";
import CaseStudies from "./pages/CaseStudies";
import ProductUpdates from "./pages/ProductUpdates";
import HelpGuide from "./pages/HelpGuide";
import WordPressPlugin from "./pages/WordPressPlugin";
import ApiDocs from "./pages/ApiDocs";
import DownloadApp from "./pages/DownloadApp";
import WhatsAppCrm from "./pages/WhatsAppCrm";
import AiCrm from "./pages/AiCrm";
import BuilderCrm from "./pages/BuilderCrm";
import SellDoAlternative from "./pages/SellDoAlternative";
import LeadratAlternative from "./pages/LeadratAlternative";
import KylasAlternative from "./pages/KylasAlternative";
import ProductTour from "./pages/ProductTour";
import ReferEarn from "./pages/ReferEarn";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import BookDemo from "./pages/BookDemo";
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
  "/whatsapp-crm": WhatsAppCrm,
  "/ai-crm": AiCrm,
  "/builder-crm": BuilderCrm,
  "/compare/sell-do-alternative": SellDoAlternative,
  "/compare/leadrat-alternative": LeadratAlternative,
  "/compare/kylas-alternative": KylasAlternative,
  "/product-tour": ProductTour,
  "/refer": ReferEarn,
  "/careers": Careers,
  "/contact": Contact,
  "/book-demo": BookDemo,
  "/security": Security,
  "/privacy": Privacy,
  "/terms": Terms,
  "/refund": Refund,
  "/cookie-policy": CookiePolicy,
};

// The blog post page with placeholder values (@@...@@, plus a sample author,
// date and image the function recognises). api/blog-post.js fills it in for
// each post, so a post's first paint is the real page, not a hidden plain copy.
// One heading, category, tag, takeaway and FAQ of each kind is enough: the
// function repeats them (two FAQs and headings: the first is drawn differently).
export function renderBlogTemplate() {
  const post = {
    _id: "tpl", slug: "@@SLUG@@", title: "@@TITLE@@", excerpt: "@@EXCERPT@@", byline: "Qqauthor Zzauthor",
    publishedAt: "2001-02-03T06:30:00.000Z", readingTime: 97, category: { _id: "@@CATID@@", slug: "@@CATSLUG@@", name: "@@CATNAME@@" },
    featuredImage: "https://cdn.sanity.io/images/tpl/tpl/tplcover-2000x1125.png", featuredImageAlt: "@@IMGALT@@",
    blocks: [{ id: "tpl", type: "paragraph", content: "@@BODY@@" }], tags: ["@@TAG@@"],
    keyTakeaways: ["@@TK@@"],
    faqs: [{ question: "@@FQ1@@", answer: "@@FA1@@" }, { question: "@@FQ2@@", answer: "@@FA2@@" }],
  };
  const initial = {
    post,
    categories: [{ _id: "@@CID@@", slug: "@@CSLUG@@", name: "@@CNAME@@" }],
    headings: [{ id: "@@HID1@@", text: "@@HTEXT1@@" }, { id: "@@HID2@@", text: "@@HTEXT2@@" }],
  };
  return renderToString(
    <StaticRouter location="/blog/@@SLUG@@">
      <PublicThemeProvider>
        <AuthProvider>
          <PublicBlogPost initial={initial} />
        </AuthProvider>
      </PublicThemeProvider>
    </StaticRouter>
  );
}

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
