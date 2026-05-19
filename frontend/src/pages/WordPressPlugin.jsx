import { Link } from "react-router-dom";
import { Check, Download, ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const SUPPORTED_FORMS = [
  "Contact Form 7",
  "WPForms",
  "MetForm",
  "Elementor Pro Forms",
  "Gravity Forms",
  "Ninja Forms",
  "Forminator",
  "Fluent Forms",
];

const INSTALL_STEPS = [
  { n: 1,  text: <>Download the plugin ZIP using the button above.</> },
  { n: 2,  text: <>In your WordPress admin, go to <strong>Plugins → Add New → Upload Plugin</strong>.</> },
  { n: 3,  text: <>Upload <code className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[13px]">arthaleads-integration.zip</code> and click <strong>Install Now</strong>.</> },
  { n: 4,  text: <>Click <strong>Activate Plugin</strong>.</> },
  { n: 5,  text: <>In the WordPress sidebar, click <strong>Arthaleads</strong>.</> },
  { n: 6,  text: <>Log in to <a href="https://www.arthaleads.com/automation" className="text-[#ff6b00] underline underline-offset-2 hover:text-orange-600 transition-colors">arthaleads.com/automation</a> → copy your account token.</> },
  { n: 7,  text: <>Paste the token in the <strong>Arthaleads Account Token</strong> field.</> },
  { n: 8,  text: <>Enter your website name (shown as lead source in CRM).</> },
  { n: 9,  text: <>Toggle ON the contact forms you want to capture from.</> },
  { n: 10, text: <>Click <strong>Save Settings</strong> - your forms are now connected!</> },
  { n: 11, text: <>Click <strong>Send Test Lead</strong> to verify the connection.</> },
];

const FAQS = [
  {
    q: "Which form plugins are supported?",
    a: "Contact Form 7, WPForms, MetForm, Elementor Pro Forms, Gravity Forms, Ninja Forms, Forminator, and Fluent Forms.",
  },
  {
    q: "Is the plugin free?",
    a: "Yes, completely free. You need an Arthaleads account (free trial available) to receive leads.",
  },
  {
    q: "What data is sent to Arthaleads?",
    a: "Lead name, phone, email, message, form name, and the page URL. No other data is transmitted.",
  },
];

function FAQItem({ q, a, isDark }) {
  const [open, setOpen] = useState(false);
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const textColor   = isDark ? "#fff" : "#111827";
  const bodyColor   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const hoverBg     = isDark ? "rgba(255,255,255,0.03)" : "#f9fafb";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${borderColor}` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors"
        style={{ color: textColor }}
        onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <span className="font-medium text-sm leading-snug">{q}</span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: bodyColor }}
        />
      </button>
      {open && (
        <div
          className="px-6 pb-5"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <p className="text-sm leading-relaxed pt-4" style={{ color: bodyColor }}>{a}</p>
        </div>
      )}
    </div>
  );
}

function WordPressPluginInner() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "WordPress Plugin - Arthaleads CRM Integration",
    description: "Download the free Arthaleads WordPress plugin to automatically capture leads from your contact forms (CF7, WPForms, MetForm, Elementor & more) directly into your CRM.",
    canonical: "https://www.arthaleads.com/wordpress-plugin",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const stepNum    = isDark ? "#ff6b00" : "#ff6b00";

  return (
    <div style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section
        className="relative pt-32 pb-20 overflow-hidden text-center"
        style={{ background: isDark ? "linear-gradient(135deg, #0d0d1a 0%, #1a0a00 100%)" : "linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #ffffff 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.08)" }} />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.06)" }} />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Free WordPress Plugin</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] mb-6" style={{ color: textColor }}>
            Connect Your WordPress Site<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              to Arthaleads CRM
            </span>
          </h1>
          <p className="text-lg leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: softText }}>
            Every form submission lands in your CRM instantly. No code. No CSV exports. Just leads.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/arthaleads-integration.zip"
              download
              className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              Download Plugin ZIP
            </a>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: cardBorder, color: textColor }}
            >
              Get Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-xs mt-5" style={{ color: softText }}>
            v1.0.2 &nbsp;&middot;&nbsp; Free &nbsp;&middot;&nbsp; 8 form plugins supported
          </p>
        </div>
      </section>

      {/* Supported Forms */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>Supported Form Plugins</h2>
            <p className="text-base" style={{ color: softText }}>
              Works with all major WordPress form builders - no extra configuration needed.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {SUPPORTED_FORMS.map((name) => (
              <div
                key={name}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,0,0.15)" }}>
                  <Check className="w-3.5 h-3.5 text-[#ff6b00]" />
                </div>
                <span className="text-sm font-medium" style={{ color: textColor }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Install Guide */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>How to Install the Plugin</h2>
            <p className="text-base" style={{ color: softText }}>
              Be up and running in under 5 minutes - no developer needed.
            </p>
          </div>
          <ol className="space-y-5">
            {INSTALL_STEPS.map(({ n, text }) => (
              <li key={n} className="flex items-start gap-5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm"
                  style={{ background: "rgba(255,107,0,0.12)", color: stepNum }}
                >
                  {n}
                </div>
                <div
                  className="flex-1 pt-1.5 text-sm leading-relaxed"
                  style={{ color: softText }}
                >
                  {text}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 text-center">
            <a
              href="/arthaleads-integration.zip"
              download
              className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/25"
            >
              <Download className="w-5 h-5" />
              Download Plugin ZIP
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} isDark={isDark} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-base mb-2" style={{ color: softText }}>Don't have an Arthaleads account yet?</p>
          <h2 className="text-3xl font-bold mb-6" style={{ color: textColor }}>Start managing leads today - free.</h2>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default function WordPressPlugin() {
  return <WordPressPluginInner />;
}
