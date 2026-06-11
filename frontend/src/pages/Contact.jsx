import { useState, useEffect } from "react";
import { Mail, Phone, MapPin, MessageCircle, ArrowRight, Check } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

export default function Contact() {
  const { isDark } = usePublicTheme();
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useSEO({
    title:       "Contact Arthaleads | Real Estate CRM Support & Sales – India",
    description: "Get in touch with the Arthaleads team. Questions about our real estate lead management CRM, pricing, or integrations? We’re here to help.",
    canonical:   "https://www.arthaleads.com/contact",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
    try {
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
      } else {
        setError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const bg        = isDark ? "#080810" : "#f9fafb";
  const heading   = isDark ? "#ffffff" : "#111827";
  const body      = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const infoLabel = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const infoVal   = isDark ? "#ffffff" : "#111827";
  const cardBg    = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr   = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const labelClr  = isDark ? "rgba(255,255,255,0.50)" : "#6b7280";
  const inputBg   = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const inputBdr  = isDark ? "rgba(255,255,255,0.08)" : "#d1d5db";
  const inputClr  = isDark ? "#ffffff" : "#111827";

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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-5">
              <MessageCircle className="w-3.5 h-3.5 text-[#ff6b00]" />
              <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Get in Touch</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: heading }}>
              We'd love to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
                hear from you
              </span>
            </h1>
            <p className="text-base leading-relaxed" style={{ color: body }}>
              Whether you want a personalised demo, have questions about pricing, or need help getting started - our team is here for you.
            </p>
          </div>
        </section>

        {/* Main content */}
        <section className="py-10 px-4">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            {/* Left - info */}
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

              <a href="https://wa.me/919876543210?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Arthaleads"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors px-5 py-3 rounded-xl">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <div>
                  <div className="text-sm font-semibold" style={{ color: heading }}>Chat on WhatsApp</div>
                  <div className="text-xs" style={{ color: body }}>Usually replies within minutes</div>
                </div>
              </a>

              <div className="mt-10 p-6 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
                <h3 className="font-bold text-base mb-4" style={{ color: heading }}>Frequently Asked</h3>
                <div className="space-y-4">
                  {[
                    ["How quickly do you respond?", "We reply within 24 hours on weekdays, usually much sooner."],
                    ["Can I get a free demo?", "Absolutely - just fill out the form and mention 'demo' in your message."],
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

            {/* Right - form */}
            <div className="p-8 rounded-2xl" style={{ background: cardBg, border: `1px solid ${cardBdr}` }}>
              {sent ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="font-black text-xl mb-2" style={{ color: heading }}>Message Sent!</h3>
                  <p className="text-sm leading-relaxed" style={{ color: body }}>
                    Thanks for reaching out. We'll get back to you at <strong>{form.email}</strong> within 24 hours.
                  </p>
                  <button onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", company: "", message: "" }); }}
                    className="mt-6 text-[#ff6b00] text-sm font-medium hover:underline">
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="font-black text-xl mb-6" style={{ color: heading }}>Send us a message</h3>
                  {[
                    { id: "name",    label: "Your Name",      type: "text",  ph: "Rajesh Patil",        req: true },
                    { id: "email",   label: "Email Address",  type: "email", ph: "rajesh@example.com",  req: true },
                    { id: "phone",   label: "Phone Number",   type: "tel",   ph: "+91 98765 43210",     req: false },
                    { id: "company", label: "Company / Team", type: "text",  ph: "Milestone Properties", req: false },
                  ].map(({ id, label, type, ph, req }) => (
                    <div key={id}>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: labelClr }}>
                        {label}{req && <span className="text-[#ff6b00] ml-0.5">*</span>}
                      </label>
                      <input
                        type={type} placeholder={ph} required={req}
                        value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff6b00]/40 transition-all"
                        style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: inputClr }} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: labelClr }}>Message</label>
                    <textarea rows={5}
                      placeholder="Tell us about your team size, current lead volume, and what you're looking for..."
                      value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff6b00]/40 transition-all resize-none"
                      style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: inputClr }} />
                  </div>
                  {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-[#ff6b00] hover:bg-[#e05f00] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                    {loading ? "Sending…" : "Send Message"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </div>

          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
