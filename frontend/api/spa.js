// api/spa.js - the app shell for website URLs that have no page of their own.
//
// vercel.json sends every path the website hosts (www and staging) don't serve
// from a file here, instead of straight to app.html. The HTML is the same
// app.html either way, so the browser shows exactly what it did before (the
// app's own "not found" page, or the redirect to app.arthaleads.com for CRM
// paths). What changes is the status: a URL the app has no route for now
// answers 404, so search engines see a real "not found" instead of a 200
// "soft 404" (audit, 28 Oct 2026).
//
// Keep KNOWN in step with the routes in src/App.jsx.
const KNOWN = new RegExp("^/(" + [
  // website pages (served from their own .html; reaches here only with other letter case)
  "privacy", "terms", "refund", "cookie-policy", "security", "refer", "api-docs", "compare", "features", "pricing",
  "download-app", "whatsapp-crm", "ai-crm", "builder-crm", "product-tour", "blog", "about-us", "case-studies",
  "product-updates", "help-guide", "wordpress-plugin", "careers", "contact", "book-demo",
  // public app pages on the website host
  "fb-callback", "google-callback", "verify-email", "delete-account", "share-target", "form",
  // CRM and sign-in pages (the app sends these on to app.arthaleads.com)
  "login", "signup", "forgot-password", "reset-password", "admin-login", "dashboard", "leads", "pipeline", "settings",
  "help-support", "referrals", "projects", "followups", "conversations", "calls", "tasks", "attendance", "bookings",
  "invoices", "developers", "plans", "team", "integrations", "automation", "performance", "dump-leads", "super-admin",
].join("|") + ")(/|$)", "i");

export default async function handler(req, res) {
  const path = "/" + String(req.query.__p || "").replace(/^\/+/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  let html;
  try {
    const r = await fetch(`${proto}://${req.headers.host}/app.html`);
    if (!r.ok) throw new Error(`shell ${r.status}`);
    html = await r.text();
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).send("Temporarily unavailable");   // as api/blog-post.js
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(path === "/" || KNOWN.test(path) ? 200 : 404).send(html);
}
