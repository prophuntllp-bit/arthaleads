import { useState } from "react";
import { Link } from "react-router-dom";
import { Code2, Copy, Check, Terminal, Webhook, KeyRound, ArrowRight, Mail } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const METHOD_COLORS = {
  GET:  "#22c55e",
  POST: "#ff6b00",
  PUT:  "#3b82f6",
  DELETE: "#ef4444",
};

// ── Copy-able code block with language tabs ───────────────────────────────────
function CodeBlock({ samples, isDark }) {
  const langs = Object.keys(samples);
  const [lang, setLang] = useState(langs[0]);
  const [copied, setCopied] = useState(false);

  const bg     = isDark ? "#0a0a14" : "#1e1e2e";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.1)";

  const copy = () => {
    navigator.clipboard?.writeText(samples[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-1">
          {langs.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: lang === l ? "rgba(255,107,0,0.15)" : "transparent",
                color: lang === l ? "#ff6b00" : "rgba(255,255,255,0.5)",
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer" style={{ color: copied ? "#22c55e" : "rgba(255,255,255,0.6)" }}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-4 overflow-x-auto text-xs leading-relaxed" style={{ color: "#e2e8f0", fontFamily: "ui-monospace, monospace" }}>
        <code>{samples[lang]}</code>
      </pre>
    </div>
  );
}

const ENDPOINTS = [
  {
    id: "create-lead",
    method: "POST",
    path: "/api/leads",
    title: "Create a lead",
    desc: "Push a new lead into your CRM pipeline. Use this from your website, landing pages, or any external system.",
    samples: {
      cURL: `curl -X POST https://api.arthaleads.com/api/leads \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "source": "Website",
    "message": "Interested in 2BHK in Pune"
  }'`,
      JavaScript: `await fetch("https://api.arthaleads.com/api/leads", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_TOKEN",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Rahul Sharma",
    phone: "9876543210",
    email: "rahul@example.com",
    source: "Website",
    message: "Interested in 2BHK in Pune",
  }),
});`,
      Python: `import requests

requests.post(
    "https://api.arthaleads.com/api/leads",
    headers={"Authorization": "Bearer YOUR_API_TOKEN"},
    json={
        "name": "Rahul Sharma",
        "phone": "9876543210",
        "email": "rahul@example.com",
        "source": "Website",
        "message": "Interested in 2BHK in Pune",
    },
)`,
    },
  },
  {
    id: "list-leads",
    method: "GET",
    path: "/api/leads",
    title: "List leads",
    desc: "Retrieve leads from your pipeline with pagination and filtering. Returns leads scoped to your organisation only.",
    samples: {
      cURL: `curl https://api.arthaleads.com/api/leads?page=1&limit=50 \\
  -H "Authorization: Bearer YOUR_API_TOKEN"`,
      JavaScript: `const res = await fetch(
  "https://api.arthaleads.com/api/leads?page=1&limit=50",
  { headers: { "Authorization": "Bearer YOUR_API_TOKEN" } }
);
const { data } = await res.json();`,
      Python: `import requests

res = requests.get(
    "https://api.arthaleads.com/api/leads",
    headers={"Authorization": "Bearer YOUR_API_TOKEN"},
    params={"page": 1, "limit": 50},
)
data = res.json()["data"]`,
    },
  },
  {
    id: "webhook",
    method: "POST",
    path: "/webhook/website",
    title: "Website form webhook",
    desc: "Connect any website form (WordPress, custom HTML, landing pages) to capture submissions automatically. Include your verify token to authenticate.",
    samples: {
      cURL: `curl -X POST https://api.arthaleads.com/webhook/website \\
  -H "Content-Type: application/json" \\
  -d '{
    "verifyToken": "YOUR_WEBHOOK_TOKEN",
    "name": "Priya Patel",
    "phone": "9123456780",
    "email": "priya@example.com",
    "source": "Landing Page"
  }'`,
      JavaScript: `await fetch("https://api.arthaleads.com/webhook/website", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    verifyToken: "YOUR_WEBHOOK_TOKEN",
    name: "Priya Patel",
    phone: "9123456780",
    email: "priya@example.com",
    source: "Landing Page",
  }),
});`,
      Python: `import requests

requests.post(
    "https://api.arthaleads.com/webhook/website",
    json={
        "verifyToken": "YOUR_WEBHOOK_TOKEN",
        "name": "Priya Patel",
        "phone": "9123456780",
        "email": "priya@example.com",
        "source": "Landing Page",
    },
)`,
    },
  },
];

export default function ApiDocs() {
  const { isDark } = usePublicTheme();
  const [activeId, setActiveId] = useState(ENDPOINTS[0].id);

  useSEO({
    title:       "API Documentation | Arthaleads Real Estate CRM",
    description: "Arthaleads REST API documentation. Create and list leads, connect website form webhooks, and integrate your real estate stack with the Arthaleads CRM.",
    canonical:   "https://www.arthaleads.com/api-docs",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  const scrollTo = (id) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-12 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <Code2 className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Developers</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5" style={{ color: textColor }}>
            Arthaleads{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">API</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: softText }}>
            A simple REST API to push leads into your CRM, list your pipeline, and connect any form on the
            web. Available on the Enterprise plan.
          </p>
        </div>
      </section>

      {/* Auth note */}
      <section className="pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-5 rounded-2xl flex items-start gap-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,0,0.1)" }}>
              <KeyRound className="w-5 h-5 text-[#ff6b00]" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: textColor }}>Authentication</h3>
              <p className="text-sm leading-relaxed" style={{ color: softText }}>
                All API requests are authenticated with a Bearer token. Find your API token in{" "}
                <strong style={{ color: textColor }}>Settings → Integrations</strong> inside your CRM. Pass it in the{" "}
                <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6", color: "#ff6b00" }}>Authorization</code> header.
                Base URL: <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6", color: "#ff6b00" }}>https://api.arthaleads.com</code>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Docs body: sidebar + endpoints */}
      <section className="pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: softText }}>Endpoints</p>
              <nav className="space-y-1">
                {ENDPOINTS.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => scrollTo(e.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-medium cursor-pointer transition-colors"
                    style={{
                      background: activeId === e.id ? "rgba(255,107,0,0.1)" : "transparent",
                      color: activeId === e.id ? "#ff6b00" : softText,
                    }}
                  >
                    <span className="font-bold" style={{ color: METHOD_COLORS[e.method], fontSize: 9 }}>{e.method}</span>
                    {e.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Endpoint cards */}
          <div className="space-y-10 min-w-0">
            {ENDPOINTS.map((e) => (
              <div key={e.id} id={e.id} className="scroll-mt-28">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold text-white" style={{ background: METHOD_COLORS[e.method] }}>{e.method}</span>
                  <code className="text-sm font-mono" style={{ color: textColor }}>{e.path}</code>
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: textColor }}>{e.title}</h2>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: softText }}>{e.desc}</p>
                <CodeBlock samples={e.samples} isDark={isDark} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Terminal className="w-8 h-8 text-[#ff6b00] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3" style={{ color: textColor }}>Need a custom integration?</h2>
          <p className="text-base mb-6" style={{ color: softText }}>
            Our team can help you connect Arthaleads to your existing tools and portals. Reach out and we'll
            get you set up.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="mailto:contact@arthaleads.com?subject=API%20Integration" className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl" style={{ background: "rgba(255,107,0,0.10)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.40)" }}>
              <Mail className="w-4 h-4" /> contact@arthaleads.com
            </a>
            <Link to="/wordpress-plugin" className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-white bg-[#ff6b00] hover:bg-[#e05f00] transition-colors">
              WordPress Plugin <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
