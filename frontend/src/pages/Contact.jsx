import { useEffect } from "react";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";

export default function Contact() {
  const { isDark } = usePublicTheme();

  useEffect(() => {
    document.title = "Contact Us — Arthaleads CRM | Get in Touch";
    return () => { document.title = "Arthaleads — Real Estate CRM"; };
  }, []);

  const bg        = isDark ? "#080810" : "#f9fafb";
  const heading   = isDark ? "#ffffff" : "#111827";
  const body      = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const infoLabel = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const infoVal   = isDark ? "#ffffff" : "#111827";
  const cardBg    = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr   = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";

  const info = [
    { icon: Mail,   label: "Email Us",  val: "contact@arthaleads.com",   href: "mailto:contact@arthaleads.com" },
    { icon: Phone,  label: "Call Us",   val: "+91 98765 43210",          href: "tel:+919876543210" },
    { icon: MapPin, label: "Based In",  val: "Pune, Maharashtra, India", href: null },
  ];

  return (
    <>
      <PublicNav />

      <main style={{ background: bg, minHeight: "100vh" }}>
        {/* Hero */}
        <section className="pt-24 pb-8 px-4" style={{ background: isDark ? "#0d0d1a" : "#fff7f0" }}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
              <MessageCircle className="w-3.5 h-3.5 text-[#ff6b00]" />
              <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Get in Touch</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: heading }}>
              We'd love to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
                hear from you
              </span>
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: body }}>
              Whether you want a personalised demo, have questions about pricing, or need help getting started — our team is here for you.
            </p>
          </div>
        </section>

        {/* Main content */}
        <section className="py-10 px-4">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            {/* Left — info */}
            <div>
              <h2 className="text-2xl font-black mb-8" style={{ color: heading }}>Contact Information</h2>

              <div className="space-y-6 mb-10">
                {info.map(({ icon: Icon, label, val, href }) => (
                  <div key={label} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#ff6b00]/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#ff6b00]" />
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: infoLabel }}>{label}</div>
                      {href ? (
                        <a href={href} className="text-sm font-semibold hover:text-[#ff6b00] transition-colors" style={{ color: infoVal }}>{val}</a>
                      ) : (
                        <div className="text-sm font-semibold" style={{ color: infoVal }}>{val}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* WhatsApp */}
              <a href="https://wa.me/919876543210?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Arthaleads"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors px-5 py-3 rounded-xl">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <div>
                  <div className="text-sm font-semibold" style={{ color: heading }}>Chat on WhatsApp</div>
                  <div className="text-xs" style={{ color: body }}>Usually replies within minutes</div>
                </div>
              </a>

              {/* FAQ teaser */}
              <div className="mt-12 p-6 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
                <h3 className="font-bold text-base mb-4" style={{ color: heading }}>Frequently Asked</h3>
                <div className="space-y-4">
                  {[
                    ["How quickly do you respond?", "We reply within 24 hours on weekdays, usually much sooner."],
                    ["Can I get a free demo?", "Absolutely — just fill out the form and mention 'demo' in your message."],
                    ["Is there a free trial?", "Yes, new accounts get a 7-day free trial with full access."],
                  ].map(([q, a]) => (
                    <div key={q}>
                      <div className="text-sm font-semibold mb-0.5" style={{ color: heading }}>{q}</div>
                      <div className="text-xs leading-relaxed" style={{ color: body }}>{a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — MetForm iframe */}
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
              <iframe
                src="https://prophuntllp.com/metform-form/arthaleads-contact-form/"
                title="Contact Form"
                width="100%"
                height="820"
                frameBorder="0"
                scrolling="auto"
                style={{ display: "block", border: "none", minHeight: "820px" }}
              />
            </div>

          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
