import { Link } from "react-router-dom";
import { Check, Download, ArrowRight, ChevronDown, Zap, Shield, RefreshCw, Globe, Star, Bell, Code2, PlugZap } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
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
    logo: "https://ps.w.org/elementor/assets/icon-256x256.png",
  },
  {
    name: "Fluent Forms", users: "400K+", color: "#18b77e",
    logo: "https://ps.w.org/fluentform/assets/icon-256x256.png",
  },
  {
    name: "Forminator", users: "500K+", color: "#17a1fa",
    logo: "https://ps.w.org/forminator/assets/icon-256x256.png",
  },
  {
    name: "MetForm", users: "100K+", color: "#7c3aed",
    logo: "https://ps.w.org/metform/assets/icon-256x256.png",
  },
  {
    name: "Gravity Forms", users: "1M+", color: "#f97316",
    logo: null, // premium plugin, not on wp.org
  },
];

const INSTALL_STEPS = [
  { title: "Download the Plugin", desc: "Click the Download button above to get the arthaleads-integration.zip file." },
  { title: "Upload to WordPress", desc: "In your WordPress admin, go to Plugins → Add New → Upload Plugin." },
  { title: "Install & Activate", desc: "Upload the ZIP file, click Install Now, then Activate Plugin." },
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
    a: "The account token is a secure API key that links your WordPress site to your Arthaleads workspace. You can find it in your Arthaleads account under Automation → WordPress Integration.",
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

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const step = Math.ceil(target / 60);
        const t = setInterval(() => {
          start = Math.min(start + step, target);
          setCount(start);
          if (start >= target) clearInterval(t);
        }, 20);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString("en-IN")}{suffix}</span>;
}

// ── FAQ item with smooth CSS transition ───────────────────────────────────────
function FAQItem({ q, a, isDark }) {
  const [open, setOpen] = useState(false);
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const text   = isDark ? "#fff" : "#111827";
  const soft   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ border: `1px solid ${open ? "rgba(255,107,0,0.35)" : border}`, background: open ? (isDark ? "rgba(255,107,0,0.05)" : "#fffaf7") : "transparent" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
        style={{ color: text }}
      >
        <span className="font-semibold text-sm leading-snug">{q}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180 text-[#ff6b00]" : ""}`} style={{ color: soft }} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48" : "max-h-0"}`}>
        <div className="px-6 pb-5 pt-1">
          <p className="text-sm leading-relaxed" style={{ color: soft }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

// ── Plugin logo card ──────────────────────────────────────────────────────────
function PluginCard({ plugin, isDark }) {
  const [imgOk, setImgOk] = useState(!!plugin.logo);
  const cardBg     = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const text       = isDark ? "#fff" : "#111827";
  const soft       = isDark ? "rgba(255,255,255,0.4)" : "#9ca3af";

  return (
    <div
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl cursor-default transition-all duration-200 hover:-translate-y-1"
      style={{
        background: cardBg, border: `1px solid ${cardBorder}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = plugin.color + "55"; e.currentTarget.style.boxShadow = `0 8px 24px ${plugin.color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = cardBorder; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
    >
      {imgOk ? (
        <img
          src={plugin.logo}
          alt={plugin.name}
          width={52} height={52}
          className="rounded-xl object-contain"
          onError={() => setImgOk(false)}
        />
      ) : (
        <div className="w-13 h-13 w-[52px] h-[52px] rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0"
          style={{ background: plugin.color }}>
          {plugin.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="text-center">
        <p className="text-xs font-bold leading-tight" style={{ color: text }}>{plugin.name}</p>
        <p className="text-[11px] mt-0.5" style={{ color: soft }}>{plugin.users} installs</p>
      </div>
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: plugin.color + "20" }}>
        <Check className="w-3 h-3" style={{ color: plugin.color }} />
      </div>
    </div>
  );
}

// ── Live notification widget ──────────────────────────────────────────────────
const FAKE_LEADS = [
  { name: "Rahul Sharma",    form: "Contact Form",   site: "mahindracitadel.in" },
  { name: "Priya Desai",     form: "Enquiry Form",   site: "runwalrealty.com" },
  { name: "Suresh Patil",    form: "Site Visit Form", site: "lodhaworld.com" },
  { name: "Anita Kulkarni",  form: "Callback Form",  site: "koltepatil.com" },
];

function LiveNotification({ isDark }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % FAKE_LEADS.length); setVisible(true); }, 400);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const lead = FAKE_LEADS[idx];
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{
        background: isDark ? "rgba(255,255,255,0.07)" : "#fff",
        border: `1px solid ${isDark ? "rgba(255,107,0,0.2)" : "#fde8d8"}`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
        maxWidth: 320,
      }}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,0,0.12)" }}>
        <Bell className="w-3.5 h-3.5 text-[#ff6b00]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold truncate" style={{ color: isDark ? "#ededed" : "#111" }}>New lead: {lead.name}</p>
        <p className="text-[11px] truncate" style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#9ca3af" }}>{lead.form} · {lead.site}</p>
      </div>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)", color: "#16a34a" }}>Live</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function WordPressPluginInner() {
  const { isDark } = usePublicTheme();
  const [activeStep, setActiveStep] = useState(0);

  useSEO({
    title: "Free WordPress Plugin – Capture Website Leads into Arthaleads CRM",
    description: "Download the free Arthaleads WordPress plugin to automatically capture leads from Contact Form 7, WPForms, Elementor, Gravity Forms and 5 more form builders directly into your CRM.",
    canonical: "https://www.arthaleads.com/wordpress-plugin",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#0a0a14" : "#f9fafb";
  const text       = isDark ? "#ffffff" : "#111827";
  const soft       = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-24 overflow-hidden text-center"
        style={{ background: isDark ? "linear-gradient(135deg,#0d0d1a 0%,#1a0a00 100%)" : "linear-gradient(135deg,#fff7ed 0%,#ffedd5 50%,#ffffff 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.09)" }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.06)" }} />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 animate-pulse" style={{ borderColor: "rgba(255,107,0,0.35)", background: "rgba(255,107,0,0.10)" }}>
            <PlugZap className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Free WordPress Plugin</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] mb-6" style={{ color: text }}>
            Every Website Enquiry<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Lands in Your CRM
            </span>
          </h1>
          <p className="text-lg leading-relaxed mb-3 max-w-xl mx-auto" style={{ color: soft }}>
            Connect Contact Form 7, WPForms, Elementor and 5 more form builders to Arthaleads in under 5 minutes. No code needed.
          </p>

          {/* Live notification demo */}
          <div className="flex justify-center mb-8 mt-6">
            <LiveNotification isDark={isDark} />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/arthaleads-integration.zip" download
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5 hover:shadow-orange-500/40"
              style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
              <Download className="w-5 h-5" />
              Download Plugin - Free
            </a>
            <Link to="/signup"
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: cardBorder, color: text }}>
              Get Free CRM Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-xs mt-5" style={{ color: soft }}>
            v1.0.2 &nbsp;·&nbsp; Free forever &nbsp;·&nbsp; 8 form plugins &nbsp;·&nbsp; No credit card
          </p>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="py-12 border-y" style={{ borderColor: cardBorder, background: isDark ? "rgba(255,107,0,0.04)" : "#fffaf5" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { label: "Form plugins supported", value: 8, suffix: "" },
              { label: "Minutes to set up", value: 5, suffix: "" },
              { label: "Lines of code needed", value: 0, suffix: "" },
              { label: "Monthly leads captured", value: 2000, suffix: "+" },
            ].map(({ label, value, suffix }) => (
              <div key={label}>
                <p className="text-3xl font-black text-[#ff6b00]">
                  <Counter target={value} suffix={suffix} />
                </p>
                <p className="text-xs mt-1" style={{ color: soft }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported Form Plugins ── */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: text }}>Works With Every Major Form Builder</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: soft }}>
              Covering 95% of all WordPress contact forms used on real estate websites in India.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {FORM_PLUGINS.map((plugin) => (
              <PluginCard key={plugin.name} plugin={plugin} isDark={isDark} />
            ))}
          </div>
          <p className="text-center text-xs mt-6" style={{ color: soft }}>
            More integrations added regularly · <a href="mailto:contact@arthaleads.com" className="text-[#ff6b00] hover:underline">Request a plugin</a>
          </p>
        </div>
      </section>

      {/* ── How it works (3-step) ── */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: text }}>How It Works</h2>
            <p className="text-base" style={{ color: soft }}>Three steps. Five minutes. Done.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
            {/* Connector line */}
            <div className="hidden sm:block absolute top-10 left-1/3 right-1/3 h-px" style={{ background: "rgba(255,107,0,0.25)" }} />
            {[
              { n: "01", icon: Download, title: "Install Plugin", desc: "Download the ZIP and upload it to your WordPress site in 60 seconds." },
              { n: "02", icon: PlugZap,  title: "Paste Your Token", desc: "Copy your Arthaleads account token and paste it in the plugin settings." },
              { n: "03", icon: Zap,      title: "Leads Flow In",   desc: "Every form submission arrives in your CRM instantly, assigned to the right agent." },
            ].map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="relative flex flex-col items-center text-center p-6 rounded-2xl transition-all hover:-translate-y-1"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.22)" }}>
                  <Icon className="w-5 h-5 text-[#ff6b00]" />
                </div>
                <span className="text-xs font-black mb-2" style={{ color: "rgba(255,107,0,0.5)" }}>{n}</span>
                <h3 className="text-base font-bold mb-2" style={{ color: text }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: soft }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive Install Steps ── */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: text }}>Step-by-Step Setup Guide</h2>
            <p className="text-base" style={{ color: soft }}>Be up and running in under 5 minutes. No developer needed.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INSTALL_STEPS.map(({ title, desc }, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(activeStep === i ? -1 : i)}
                className="text-left flex items-start gap-4 p-4 rounded-2xl transition-all duration-200 w-full"
                style={{
                  background: activeStep === i ? (isDark ? "rgba(255,107,0,0.10)" : "#fff7ed") : cardBg,
                  border: `1px solid ${activeStep === i ? "rgba(255,107,0,0.35)" : cardBorder}`,
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 transition-all"
                  style={{
                    background: activeStep === i ? "#ff6b00" : "rgba(255,107,0,0.12)",
                    color: activeStep === i ? "#fff" : "#ff6b00",
                  }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: text }}>{title}</p>
                  {activeStep === i && (
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: soft }}>{desc}</p>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 mt-1 transition-transform duration-200 ${activeStep === i ? "rotate-180 text-[#ff6b00]" : ""}`}
                  style={{ color: soft }} />
              </button>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a href="/arthaleads-integration.zip" download
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/25 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
              <Download className="w-5 h-5" />
              Download Plugin ZIP
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: text }}>Everything Your Team Needs</h2>
            <p className="text-base" style={{ color: soft }}>
              More than just a form-to-CRM bridge. Built for real estate teams.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="p-6 rounded-2xl transition-all duration-200 hover:-translate-y-1 group"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,107,0,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = cardBorder; }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(255,107,0,0.12)" }}>
                  <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-[#ff6b00]" />
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: text }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: soft }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: text }}>Frequently Asked Questions</h2>
            <p className="text-base" style={{ color: soft }}>Everything you need to know before connecting your WordPress site.</p>
          </div>
          <div className="space-y-2">
            {FAQS.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} isDark={isDark} />
            ))}
          </div>
          <p className="text-center text-sm mt-8" style={{ color: soft }}>
            Still have questions? &nbsp;
            <a href="mailto:contact@arthaleads.com" className="text-[#ff6b00] font-semibold hover:underline">
              Email us →
            </a>
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 relative overflow-hidden" style={{ background: isDark ? "linear-gradient(135deg,#1a0a00,#0d0d1a)" : "linear-gradient(135deg,#fff7ed,#ffedd5)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.1)" }} />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.25)" }}>
            <Globe className="w-6 h-6 text-[#ff6b00]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: text }}>
            Your Website Leads Deserve<br />a Better CRM
          </h2>
          <p className="text-base mb-8" style={{ color: soft }}>
            Stop copy-pasting form submissions into Excel. Connect your WordPress site and let Arthaleads handle lead capture, follow-ups, and team routing automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/arthaleads-integration.zip" download
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
              <Download className="w-5 h-5" />
              Download Plugin Free
            </a>
            <Link to="/signup"
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border transition-all hover:-translate-y-0.5"
              style={{ borderColor: "rgba(255,107,0,0.35)", color: "#ff6b00" }}>
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default function WordPressPlugin() {
  return <WordPressPluginInner />;
}
