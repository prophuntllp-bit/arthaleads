// pages/WordPressPlugin.jsx - /wordpress-plugin on the shared marketing theme
// (components/site/*). The hero form is a coded illustration, not a screenshot.
// Form-builder icons are the official WordPress.org plugin icons; a plugin with
// no icon (Gravity Forms is premium, not on wp.org) is shown by name only,
// never as a letter tile (owner rule: real logos or text).
import { CRM_SIGNUP_URL } from "../utils/crmLinks";
import { Check, Download, ArrowRight, Zap, Shield, RefreshCw, Globe, Bell, Code2, PlugZap, ChevronDown, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, FaqSection } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";

// ── Brand logos using official WordPress.org plugin icon URLs ─────────────────
const FORM_PLUGINS = [
  {
    name: "Contact Form 7", users: "5M+", color: "#0073aa",
    logo: "https://ps.w.org/contact-form-7/assets/icon-256x256.png",
  },
  {
    name: "WPForms", users: "6M+", color: "#1f4dc4",
    logo: "https://ps.w.org/wpforms-lite/assets/icon-256x256.png",
  },
  {
    name: "Ninja Forms", users: "800K+", color: "#ff7900",
    logo: "https://ps.w.org/ninja-forms/assets/icon-256x256.png",
  },
  {
    name: "Elementor Pro Forms", users: "9M+", color: "#e2185b",
    logo: "https://ps.w.org/elementor/assets/icon-256x256.gif",
  },
  {
    name: "Fluent Forms", users: "400K+", color: "#18b77e",
    logo: "https://ps.w.org/fluentform/assets/icon-256x256.png",
  },
  {
    name: "Forminator", users: "500K+", color: "#17a1fa",
    logo: "https://ps.w.org/forminator/assets/icon-256x256.gif",
  },
  {
    name: "MetForm", users: "100K+", color: "#7c3aed",
    logo: "https://ps.w.org/metform/assets/icon-256x256.png",
  },
  {
    name: "Gravity Forms", users: "1M+", color: "#c2410c",
    logo: null, // premium plugin, not on wp.org
  },
];

// Keep in step with wordpress-plugin/arthaleads-integration.php and the ZIP in
// public/ (same release as WordPress.org, see AGENT_BRIDGE.md).
const PLUGIN_VERSION = "1.0.9";
const WP_ORG_URL = "https://wordpress.org/plugins/arthaleads/";

// The WordPress "W" mark, drawn inline (no external image).
function WordPressMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="#21759b">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zM3.01 12c0-1.3.28-2.54.78-3.66l4.29 11.75A9.002 9.002 0 0 1 3.01 12zM12 20.99c-.88 0-1.73-.13-2.54-.37l2.7-7.84 2.76 7.57c.02.04.04.09.06.13-.93.33-1.93.51-2.98.51zm1.24-13.2c.54-.03 1.03-.09 1.03-.09.48-.06.43-.77-.06-.74 0 0-1.46.11-2.4.11-.88 0-2.37-.11-2.37-.11-.49-.03-.54.71-.06.74 0 0 .46.06.94.09l1.4 3.83-1.96 5.89-3.27-9.72c.54-.03 1.03-.09 1.03-.09.48-.06.43-.77-.06-.74 0 0-1.46.11-2.4.11-.17 0-.37 0-.58-.01A8.99 8.99 0 0 1 12 3.01c2.34 0 4.47.9 6.07 2.36-.04 0-.08-.01-.12-.01-.88 0-1.51.77-1.51 1.6 0 .74.43 1.37.88 2.11.34.6.74 1.37.74 2.48 0 .77-.3 1.66-.68 2.91l-.9 3-3.24-9.67zm3.29 12.03 2.74-7.93c.51-1.28.68-2.3.68-3.21 0-.33-.02-.64-.06-.93A8.99 8.99 0 0 1 20.99 12c0 3.31-1.8 6.21-4.46 7.82z"/>
    </svg>
  );
}

const INSTALL_STEPS = [
  { title: "Find It in WordPress", desc: "In your WordPress admin, go to Plugins → Add New Plugin and search for “Arthaleads”. Installing from WordPress.org means you get update notices automatically." },
  { title: "Install & Activate", desc: "Click Install Now, then Activate. Can't reach WordPress.org from your site? Download the ZIP above and use Upload Plugin instead." },
  { title: "Open Arthaleads Settings", desc: "In the WordPress sidebar, click Arthaleads to open the settings panel." },
  { title: "Copy Your Token", desc: "Log in to arthaleads.com/automation and copy your account token." },
  { title: "Paste Token & Name", desc: "Paste the token in the Account Token field and enter your website name." },
  { title: "Select Your Forms", desc: "Toggle ON the contact forms you want to capture leads from." },
  { title: "Save & Test", desc: "Click Save Settings, then Send Test Lead to verify the connection works." },
];

const FEATURES = [
  { icon: Zap,       title: "Instant Capture",        desc: "Leads arrive in your CRM within seconds of a form submission. No delays, no missed enquiries." },
  { icon: RefreshCw, title: "Auto-Assigned",           desc: "Route each lead to the right agent based on your project rules automatically." },
  { icon: Shield,    title: "Duplicate Detection",     desc: "The same phone number won't create duplicate leads. Existing records are updated instead." },
  { icon: Globe,     title: "Any WordPress Site",      desc: "Works on single sites, multisite, and WooCommerce. No server-side configuration needed." },
  { icon: Bell,      title: "Instant Notifications",   desc: "Your team gets a push notification the moment a new website lead comes in." },
  { icon: Code2,     title: "Zero Code Required",      desc: "No webhooks, no API calls from your side. Install, connect your token, done." },
];

const FAQS = [
  {
    q: "Which WordPress form plugins are supported?",
    a: "Arthaleads supports Contact Form 7 (5M+ installs), WPForms, Elementor Pro Forms, Ninja Forms, Gravity Forms, MetForm, Forminator, and Fluent Forms. We cover all the major form builders used on Indian real estate websites.",
  },
  {
    q: "Is the Arthaleads WordPress plugin free?",
    a: "Yes, completely free. You need an active Arthaleads account to receive leads. Start with our 14-day free trial, no credit card required.",
  },
  {
    q: "What lead data is captured from my forms?",
    a: "The plugin captures the lead's name, phone number, email address, message/enquiry, the form name, and the URL of the page where the form was submitted. All data is transmitted securely over HTTPS.",
  },
  {
    q: "Do I need a developer to set this up?",
    a: "No. The entire setup takes under 5 minutes and requires no coding. You just install the plugin, paste your Arthaleads account token, select which forms to capture, and click Save.",
  },
  {
    q: "Will it work with my existing Contact Form 7 setup?",
    a: "Yes. The plugin hooks into Contact Form 7's submission event without modifying your existing form setup, redirects, or confirmation messages. Everything continues to work exactly as before.",
  },
  {
    q: "How does the plugin handle duplicate leads?",
    a: "If a lead submits the same phone number twice, Arthaleads detects the duplicate and adds a new note to the existing lead record rather than creating a second entry. This keeps your CRM clean.",
  },
  {
    q: "Can I connect multiple WordPress websites to the same Arthaleads account?",
    a: "Yes. Each website gets a separate 'website name' label in the plugin settings. All leads appear in your CRM with the correct source label so you know which site they came from.",
  },
  {
    q: "What happens if my website is down or the CRM is temporarily unavailable?",
    a: "If the connection fails, the plugin retries automatically. Your form submissions are never lost. Leads that couldn't be synced are queued and retried on the next submission.",
  },
  {
    q: "Does the plugin slow down my WordPress website?",
    a: "No. The lead data is sent to Arthaleads asynchronously in the background after form submission. There is zero impact on your page load speed or the user's form experience.",
  },
  {
    q: "Can I choose which forms send leads to Arthaleads?",
    a: "Yes. The plugin lists all detected forms on your site. You simply toggle on the forms you want to capture from. Forms that are toggled off are ignored completely.",
  },
  {
    q: "Does it work with WooCommerce or custom post type forms?",
    a: "The plugin works with any form created using the supported form builders, regardless of what page or post type it's placed on, including WooCommerce product pages.",
  },
  {
    q: "What is the Arthaleads account token and where do I get it?",
    a: "The account token is a secure API key that links your WordPress site to your Arthaleads workspace. You can find it in your Arthaleads account under Integrations → WordPress Integration.",
  },
  {
    q: "Is the plugin compatible with the latest version of WordPress?",
    a: "Yes. The plugin is tested and compatible with WordPress 5.8 and above, including the latest WordPress 6.x releases.",
  },
  {
    q: "How are leads assigned to agents after they come in from WordPress?",
    a: "You can configure lead routing rules in Arthaleads under Settings → Auto-Assign. Rules can be based on project, source, round-robin rotation, or a fixed agent.",
  },
];

// In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS.
const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
}).replace(/</g, "\\u003c");

const REDUCED_MOTION = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };
const btnLg = "!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base";

// ── Form-builder card: official icon, or the name alone when there is none ───
function PluginCard({ plugin }) {
  const [imgOk, setImgOk] = useState(!!plugin.logo);
  return (
    <Card hover className="h-full flex flex-col items-center justify-center gap-3 p-5 text-center">
      {imgOk ? (
        <img
          src={plugin.logo}
          alt={plugin.name}
          width={52} height={52}
          loading="lazy"
          decoding="async"
          className="w-[52px] h-[52px] rounded-xl object-contain"
          onError={() => setImgOk(false)}
        />
      ) : null}
      <div>
        <p className={imgOk ? "text-[13px] font-bold site-ink leading-tight" : "font-display text-base font-bold site-ink leading-tight"}>{plugin.name}</p>
        <p className="text-xs site-muted mt-1">{plugin.users} installs</p>
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#16a34a" }}>
        <Check className="w-3.5 h-3.5" aria-hidden="true" /> Supported
      </span>
    </Card>
  );
}

// ── Live notification widget (illustrative leads, cycles after mount) ────────
const FAKE_LEADS = [
  { name: "Rahul Sharma",    form: "Contact Form",    site: "Aurum Heights website" },
  { name: "Priya Desai",     form: "Enquiry Form",    site: "Skyline Residency website" },
  { name: "Suresh Patil",    form: "Site Visit Form", site: "Green Acres website" },
  { name: "Anita Kulkarni",  form: "Callback Form",   site: "Aurum Heights website" },
];

function LiveNotification() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (REDUCED_MOTION()) return undefined;
    let swap;
    const t = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => { setIdx(i => (i + 1) % FAKE_LEADS.length); setVisible(true); }, 400);
    }, 3000);
    return () => { clearInterval(t); clearTimeout(swap); };
  }, []);

  const lead = FAKE_LEADS[idx];
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{ background: "var(--site-card)", borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.12)" }}>
        <Bell className="w-[18px] h-[18px]" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold site-ink leading-tight truncate">New lead: {lead.name}</span>
        <span className="block text-[11px] site-muted leading-tight mt-0.5 truncate">{lead.form} · {lead.site}</span>
      </span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "rgba(22,163,74,0.14)", color: "#16a34a" }}>Live</span>
    </div>
  );
}

/** A coded WordPress enquiry form sending a lead to Arthaleads (an illustration, not a screenshot). */
function FormToCrmViz() {
  const fields = [["Full name", "Rahul Sharma"], ["Phone", "98765 43210"], ["Interested in", "2 BHK, Aurum Heights"]];
  return (
    <div className="relative mx-auto w-full max-w-[460px] px-3 sm:px-6 lg:px-0 pb-16 sm:pb-12">
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative rounded-[24px] border overflow-hidden text-left" role="img"
        aria-label="A contact form on a WordPress property website, with each submission arriving in Arthaleads as a new lead"
        style={{ background: "var(--site-card)", borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--site-line)", background: "var(--site-card-soft)" }}>
          <span className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((d) => <span key={d} className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--site-line-strong)" }} />)}
          </span>
          <span className="ml-2 flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2.5 py-1 text-[11px] site-muted site-chip truncate">
            <WordPressMark size={13} /> yourprojectwebsite.in/contact
          </span>
        </div>
        <div className="p-5 sm:p-6">
          <p className="font-display text-base font-bold site-ink">Book a site visit</p>
          <p className="text-xs site-muted mt-0.5">Contact Form 7</p>
          <div className="mt-4 space-y-3">
            {fields.map(([label, value]) => (
              <div key={label}>
                <span className="block text-[11px] font-semibold site-muted mb-1">{label}</span>
                <span className="block rounded-xl border px-3 py-2 text-[13px] site-ink" style={{ borderColor: "var(--site-line-strong)" }}>{value}</span>
              </div>
            ))}
          </div>
          <span className="mt-4 flex items-center justify-center rounded-xl py-2.5 text-[13px] font-bold text-white" style={{ background: "var(--brand-btn)" }}>Send enquiry</span>
        </div>
      </div>
      <div className="absolute left-0 right-0 sm:left-auto sm:-right-2 lg:-right-8 bottom-0 mx-3 sm:mx-0 sm:w-[300px]">
        <LiveNotification />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function WordPressPluginInner() {
  const [activeStep, setActiveStep] = useState(0);

  useSEO({
    title: "Free WordPress Plugin for Real Estate Leads | Arthaleads",
    description: "Free Arthaleads WordPress plugin: capture leads from Contact Form 7, WPForms, Elementor, Gravity Forms and 5 more form builders straight into your CRM.",
    canonical: "https://www.arthaleads.com/wordpress-plugin",
  });

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />

      {/* ── Hero ── */}
      <PageHero
        eyebrow="WordPress plugin"
        title={<>Every Website Enquiry <span className="site-dim">Lands in Your CRM</span></>}
        lede="Connect Contact Form 7, WPForms, Elementor and 5 more form builders to Arthaleads in under 5 minutes. No code needed."
        visual={<FormToCrmViz />}
        actions={
          <div className="mt-7 flex flex-wrap gap-2.5 sm:gap-3 justify-center lg:justify-start">
            <SiteButton href="/arthaleads-integration.zip" download className={btnLg}><Download className="w-5 h-5" /> Download Plugin - Free</SiteButton>
            <SiteButton href={CRM_SIGNUP_URL} external variant="secondary" className={btnLg}>Get Free CRM Account <ArrowRight className="w-4 h-4" /></SiteButton>
          </div>
        }
        trust={false}
      >
        <a href={WP_ORG_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-6 text-sm font-semibold site-ink hover:underline underline-offset-4">
          <WordPressMark />
          Also on WordPress.org: search “Arthaleads” in Plugins → Add New
        </a>
        <p className="text-[13px] site-muted mt-3">
          v{PLUGIN_VERSION} &nbsp;·&nbsp; Free forever &nbsp;·&nbsp; 8 form plugins &nbsp;·&nbsp; No credit card
        </p>
      </PageHero>

      {/* ── Stats strip ── */}
      <Section tone="tint" className="!py-10 sm:!py-12">
        <Container>
          <ul className="grid grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {[
              { label: "Form plugins supported", value: "8" },
              { label: "Minutes to set up", value: "5" },
              { label: "Lines of code needed", value: "0" },
            ].map(({ label, value }) => (
              <li key={label}>
                <Card glow className="h-full p-4 sm:p-6 text-center">
                  <p className="font-display text-3xl sm:text-4xl font-extrabold" style={{ color: "var(--site-brand-ink)" }}>{value}</p>
                  <p className="text-xs sm:text-sm site-muted mt-1">{label}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ── Supported Form Plugins ── */}
      <Section tone="white">
        <Container>
          <SectionHeader eyebrow="Supported form builders" title="Works With Every Major Form Builder" align="center"
            lede="Covering 95% of all WordPress contact forms used on real estate websites in India." />
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
            {FORM_PLUGINS.map((plugin, i) => (
              <Reveal as="li" key={plugin.name} delay={(i % 4) * 60} className="min-w-0">
                <PluginCard plugin={plugin} />
              </Reveal>
            ))}
          </ul>
          <p className="text-center text-sm site-muted mt-8">
            More integrations added regularly · <a href="mailto:contact@arthaleads.com" className="site-link">Request a plugin</a>
          </p>
        </Container>
      </Section>

      {/* ── How it works (3-step) ── */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="How it works" title="How It Works" lede="Three steps. Five minutes. Done." />
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { n: "01", icon: Download, title: "Install Plugin", desc: "Install it from WordPress.org (search “Arthaleads”) or upload the ZIP. Takes about a minute." },
              { n: "02", icon: PlugZap,  title: "Paste Your Token", desc: "Copy your Arthaleads account token and paste it in the plugin settings." },
              { n: "03", icon: Zap,      title: "Leads Flow In",   desc: "Every form submission arrives in your CRM instantly, assigned to the right agent." },
            ].map(({ n, icon: Icon, title, desc }, i) => (
              <Reveal as="li" key={n} delay={i * 80} className="min-w-0 flex">
                <Card glow className="w-full p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center" style={iconTile}>
                      <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                    </span>
                    <span className="font-display text-sm font-extrabold site-muted">{n}</span>
                  </div>
                  <h3 className="font-display text-base font-bold site-ink mb-2">{title}</h3>
                  <p className="text-[14px] leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ── Interactive Install Steps ── */}
      <Section tone="white" id="setup">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div className="lg:sticky lg:top-28 self-start">
            <SectionHeader eyebrow="Setup guide" title="Step-by-Step Setup Guide" className="!mb-6"
              lede="Be up and running in under 5 minutes. No developer needed." />
            <div className="flex flex-wrap gap-3">
              <SiteButton href="/arthaleads-integration.zip" download><Download className="w-4 h-4" /> Download Plugin ZIP</SiteButton>
              <SiteButton href={WP_ORG_URL} external variant="secondary"><WordPressMark /> View on WordPress.org</SiteButton>
            </div>
          </div>
          <ol className="space-y-3 min-w-0">
            {INSTALL_STEPS.map(({ title, desc }, i) => {
              const open = activeStep === i;
              return (
                <li key={title}>
                  <Card className="overflow-hidden" style={open ? { borderColor: "rgba(255,107,0,0.35)" } : undefined}>
                    <button
                      type="button"
                      onClick={() => setActiveStep(open ? -1 : i)}
                      aria-expanded={open}
                      aria-controls={`wp-step-${i}`}
                      className="w-full text-left flex items-start gap-4 p-4 sm:p-5"
                    >
                      <span className="font-display w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 transition-colors"
                        style={open
                          ? { background: "var(--brand-btn)", color: "#fff", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }
                          : { background: "rgba(255,107,0,0.10)", color: "var(--site-brand-ink)" }}>
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0 pt-1.5">
                        <span className="block font-display font-bold site-ink">{title}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 shrink-0 mt-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                        style={{ color: open ? "var(--site-brand-ink)" : "var(--site-muted)" }} aria-hidden="true" />
                    </button>
                    {/* Always in the HTML (visually hidden when closed) so every step is readable by crawlers. */}
                    <div id={`wp-step-${i}`} className={open ? "px-4 sm:px-5 pb-5 pl-[4.25rem] sm:pl-[4.75rem] -mt-2" : "sr-only"}>
                      <p className="text-[15px] leading-relaxed">{desc}</p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </Container>
      </Section>

      {/* ── Features ── */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="Features" title="Everything Your Team Needs"
            lede="More than just a form-to-CRM bridge. Built for real estate teams." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={(i % 3) * 80} className="min-w-0 flex">
                <Card glow className="w-full p-6">
                  <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={iconTile}>
                    <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-base font-bold site-ink mb-2">{title}</h3>
                  <p className="text-[14px] leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── FAQ ── */}
      <FaqSection title="Frequently Asked Questions" items={FAQS.map(({ q, a }) => [q, a])} tone="white" />
      <Section tone="white" className="!pt-0 !pb-12 sm:!pb-16">
        <Container>
          <p className="text-center text-sm site-muted">
            Still have questions?{" "}
            <a href="mailto:contact@arthaleads.com" className="site-link"><Mail className="w-4 h-4" aria-hidden="true" /> Email us <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></a>
          </p>
        </Container>
      </Section>

      {/* ── CTA ── */}
      <Section tone="white" className="!pt-0">
        <Container>
          <Reveal>
            <div className="site-cta-panel relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-6 sm:p-12 text-center">
              <span className="site-icon relative w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6" style={iconTile}>
                <Globe className="w-6 h-6" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              </span>
              <h2 className="relative font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[30px] sm:text-[40px]" style={{ textWrap: "balance" }}>
                Your Website Leads Deserve <span className="site-dim">a Better CRM</span>
              </h2>
              <p className="relative mt-4 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
                Stop copy-pasting form submissions into Excel. Connect your WordPress site and let Arthaleads handle lead capture, follow-ups, and team routing automatically.
              </p>
              <div className="relative mt-8 flex flex-wrap gap-3 justify-center">
                <SiteButton href="/arthaleads-integration.zip" download className={btnLg}><Download className="w-5 h-5" /> Download Plugin Free</SiteButton>
                <SiteButton to="/book-demo" variant="secondary" className={btnLg}>Book a Demo</SiteButton>
                <SiteButton href={CRM_SIGNUP_URL} external variant="secondary" className={btnLg}>Create Free Account <ArrowRight className="w-4 h-4" /></SiteButton>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    </SitePage>
  );
}

export default function WordPressPlugin() {
  return <WordPressPluginInner />;
}
