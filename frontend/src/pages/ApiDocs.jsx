// pages/ApiDocs.jsx - /api-docs on the shared marketing theme (components/site/*).
// Code samples stay on a dark panel in both themes.
import { useState } from "react";
import { Copy, Check, Terminal, KeyRound, ArrowRight, Mail } from "lucide-react";
import { SitePage, Section, Container, Card, SiteButton } from "../components/site/Site";
import { PageHero, ClosingCta } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";

const METHOD_COLORS = {
  GET:  "#15803d",
  POST: "#cc4b00",
  PUT:  "#3b82f6",
  DELETE: "#ef4444",
};

// Method as small text on the page background (sidebar): theme tokens that pass 4.5:1 in light and dark.
const METHOD_TEXT = {
  GET:  "var(--site-green-ink)",
  POST: "var(--site-brand-ink)",
};

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };
const inlineCode = "px-1.5 py-0.5 rounded-md text-[13px] font-mono site-chip";

// ── Copy-able code block with language tabs (dark in both themes) ─────────────
function CodeBlock({ samples }) {
  const langs = Object.keys(samples);
  const [lang, setLang] = useState(langs[0]);
  const [copied, setCopied] = useState(false);

  const border = "rgba(255,255,255,0.09)";

  const copy = () => {
    navigator.clipboard?.writeText(samples[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0f1117", border: `1px solid ${border}`, boxShadow: "var(--site-shadow)" }}>
      <div className="flex items-center justify-between gap-2 px-2 py-1" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">
          {langs.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className="min-h-[44px] px-3 sm:px-3.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors shrink-0"
              style={{
                background: lang === l ? "rgba(255,107,0,0.16)" : "transparent",
                color: lang === l ? "#ff8a3d" : "rgba(230,230,230,0.6)",
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-[13px] font-semibold cursor-pointer shrink-0" style={{ color: copied ? "#4ade80" : "rgba(230,230,230,0.7)" }}>
          {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="relative px-4 sm:px-5 py-4 overflow-x-auto text-[12.5px] leading-relaxed" style={{ color: "#e6e6e6", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
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
    desc: "Push a new lead into your pipeline from a website, landing page or any external system.",
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
    desc: "Page through and filter your leads. Only your organisation's leads are returned.",
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
    desc: "Connect any website form (WordPress, custom HTML, landing pages) to capture submissions automatically. Include the connection's token (the `token` field) to authenticate.",
    samples: {
      cURL: `curl -X POST https://api.arthaleads.com/webhook/website \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "YOUR_WEBHOOK_TOKEN",
    "name": "Priya Patel",
    "phone": "9123456780",
    "email": "priya@example.com",
    "source": "Landing Page"
  }'`,
      JavaScript: `await fetch("https://api.arthaleads.com/webhook/website", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: "YOUR_WEBHOOK_TOKEN",
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
        "token": "YOUR_WEBHOOK_TOKEN",
        "name": "Priya Patel",
        "phone": "9123456780",
        "email": "priya@example.com",
        "source": "Landing Page",
    },
)`,
    },
  },
];

/** Hero visual: one real request against the lead capture endpoint, as a code card. */
function ApiHeroCode() {
  const line = (k, v) => <><span style={{ color: "#7dd3fc" }}>{k}</span>{v}</>;
  return (
    <div className="relative mx-auto lg:mx-5 w-full lg:w-auto max-w-[520px]">
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative rounded-[22px] overflow-hidden text-left" style={{ background: "#0f1117", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "var(--site-shadow-lg)" }}>
        <div className="flex items-center gap-2 px-4 h-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>POST /api/leads</span>
        </div>
        <pre className="relative overflow-x-auto p-5 text-[12.5px] leading-[1.75] font-mono" style={{ color: "#e6e6e6" }}>
{line("curl", " -X POST https://api.arthaleads.com/api/leads \\")}{"\n"}
{"  "}{line("-H", " \"Authorization: Bearer YOUR_API_TOKEN\" \\")}{"\n"}
{"  "}{line("-H", " \"Content-Type: application/json\" \\")}{"\n"}
{"  "}{line("-d", " '{")}{"\n"}
{"    "}<span style={{ color: "#fdba74" }}>"name"</span>: <span style={{ color: "#86efac" }}>"Ananya Iyer"</span>,{"\n"}
{"    "}<span style={{ color: "#fdba74" }}>"phone"</span>: <span style={{ color: "#86efac" }}>"+91 98765 43210"</span>,{"\n"}
{"    "}<span style={{ color: "#fdba74" }}>"source"</span>: <span style={{ color: "#86efac" }}>"Website"</span>{"\n"}
{"  }'"}
        </pre>
        <div className="flex items-center gap-2 px-5 py-3 text-[12px] font-mono" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "#86efac" }}>
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Lead created in your CRM
        </div>
      </div>
    </div>
  );
}

export default function ApiDocs() {
  const [activeId, setActiveId] = useState(ENDPOINTS[0].id);

  useSEO({
    title:       "API Documentation | Arthaleads Real Estate CRM",
    description: "Arthaleads REST API documentation. Create and list leads, connect website form webhooks, and integrate your real estate stack with the Arthaleads CRM.",
    canonical:   "https://www.arthaleads.com/api-docs",
  });

  const scrollTo = (id) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SitePage>
      <PageHero
        eyebrow="Developers"
        title={<>Arthaleads <span className="site-dim">API</span></>}
        lede="Push leads into your CRM, list your pipeline and connect any web form. On the Enterprise plan."
        actions={[
          { label: "Read the endpoints", href: "#endpoints" },
          { label: "Get API access", to: "/book-demo" },
        ]}
        trust={["REST and JSON", "Token auth", "Enterprise plan"]}
        visual={<ApiHeroCode />}
      />

      {/* Signature band: the endpoint reference */}
      <Section tone="sand" id="endpoints" className="!pt-12 sm:!pt-16">
        <Container className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 items-start">
          {/* Sidebar */}
          <nav aria-label="Endpoints" className="hidden lg:block sticky top-28">
            <p className="site-eyebrow mb-4">Endpoints</p>
            <ol className="space-y-1">
              {ENDPOINTS.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(e.id)}
                    aria-current={activeId === e.id ? "true" : undefined}
                    className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-left text-sm font-medium cursor-pointer transition-colors"
                    style={{
                      background: activeId === e.id ? "rgba(255,107,0,0.10)" : "transparent",
                      color: activeId === e.id ? "var(--site-brand-ink)" : "var(--site-muted)",
                    }}
                  >
                    <span className="font-bold w-10 shrink-0 text-xs" style={{ color: METHOD_TEXT[e.method] || METHOD_COLORS[e.method] }}>{e.method}</span>
                    {e.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-12">
            {/* Auth note */}
            <Reveal>
              <Card raised className="p-6 sm:p-7 flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={iconTile}>
                  <KeyRound className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="site-h3 mb-2">Authentication</h2>
                  <p className="text-[15px] leading-relaxed">
                    Lead capture endpoints (website form, Google, custom source) use the token of the connection you created. Find it under{" "}
                    <strong className="site-ink">Integrations</strong> in your CRM, on that connection's card, and send it in the request body as <code className={inlineCode}>token</code>. The CRM endpoints below (leads and so on) take a Bearer token: sign in with POST /api/auth/login and use the token it returns as YOUR_API_TOKEN. It acts as that user, with that user's role and access.
                    Base URL: <code className={`${inlineCode} break-all`}>https://api.arthaleads.com</code>
                  </p>
                </div>
              </Card>
            </Reveal>

            {/* Endpoints */}
            {ENDPOINTS.map((e) => (
              <Reveal key={e.id}>
                <div id={e.id} className="scroll-mt-28">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: METHOD_COLORS[e.method] }}>{e.method}</span>
                    <code className="text-sm font-mono site-ink">{e.path}</code>
                  </div>
                  <h2 className="site-h3 mb-2">{e.title}</h2>
                  <p className="text-[15px] mb-5 leading-relaxed">{e.desc}</p>
                  <CodeBlock samples={e.samples} />
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Help CTA */}
      <Section tone="white">
        <Container>
          <Reveal>
            <Card raised className="p-6 sm:p-10 flex flex-col sm:flex-row sm:items-start gap-6">
              <span className="site-icon w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={iconTile}>
                <Terminal className="w-7 h-7" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="site-h3 mb-2">Need a custom integration?</h2>
                <p className="text-[15px] leading-relaxed">
                  We can connect Arthaleads to your existing tools and portals.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <SiteButton href="mailto:contact@arthaleads.com?subject=API%20Integration" variant="secondary">
                    <Mail className="w-4 h-4" /> contact@arthaleads.com
                  </SiteButton>
                  <SiteButton to="/wordpress-plugin" variant="secondary">
                    WordPress plugin <ArrowRight className="w-4 h-4" />
                  </SiteButton>
                </div>
              </div>
            </Card>
          </Reveal>
        </Container>
      </Section>

      <ClosingCta tone="tint" />
    </SitePage>
  );
}
