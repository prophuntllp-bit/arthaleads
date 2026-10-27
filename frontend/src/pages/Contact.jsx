// pages/Contact.jsx - /contact on the shared marketing theme (components/site/*).
// The form posts to /api/contact (reCAPTCHA); demo requests have their own page
// (/book-demo), which this page points to.
import { useState } from "react";
import { Mail, Phone, MapPin, ArrowRight, Check, CalendarCheck2 } from "lucide-react";
import WhatsAppLogo from "../components/WhatsAppLogo";
import { waLink, WA_MESSAGES } from "../utils/crmLinks";
import { SitePage, Section, Container, Card, SiteButton } from "../components/site/Site";
import { PageHero, FaqSection } from "../components/site/Blocks";
import { useSEO } from "../utils/useSEO";
import { getRecaptchaToken } from "../utils/recaptcha";

const FAQS = [
  ["How quickly do you respond?", "We reply within 24 hours on weekdays, usually much sooner."],
  ["Can I get a free demo?", "Yes. Book a 30-minute demo on our Book a Demo page, or message us on WhatsApp."],
  ["Is there a free trial?", "Yes. New accounts get a 14-day free trial of the Growth plan, no credit card needed."],
];

// In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS.
const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(([q, a]) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
}).replace(/</g, "\\u003c");

const inputCls = "w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-[color:var(--site-brand)]";
const inputStyle = { background: "var(--site-bg)", border: "1px solid var(--site-line-strong)", color: "var(--site-ink)" };
const EMPTY = { name: "", email: "", phone: "", company: "", message: "" };

const INFO = [
  { icon: Mail,   label: "Email us", val: "contact@arthaleads.com",   href: "mailto:contact@arthaleads.com" },
  { icon: Phone,  label: "Call us",  val: "+91 90670 97779",          href: "tel:+919067097779", note: "Also on WhatsApp" },
  { icon: MapPin, label: "Based in", val: "Pune, Maharashtra, India", href: null },
];

export default function Contact() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useSEO({
    title:       "Contact Arthaleads | Real Estate CRM Sales & Support",
    description: "Get in touch with the Arthaleads team. Questions about our real estate lead management CRM, pricing, or integrations? We’re here to help.",
    canonical:   "https://www.arthaleads.com/contact",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
    try {
      const recaptchaToken = await getRecaptchaToken("contact");
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recaptchaToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
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

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />

      <PageHero
        eyebrow="Contact"
        title={<>We'd love to <span className="site-dim">hear from you</span></>}
        lede="Questions about pricing, integrations or getting started? Send us a message, call, or chat on WhatsApp. A real person from our Pune team replies."
        actions={[
          { label: "Call +91 90670 97779", href: "tel:+919067097779", Icon: Phone },
          { label: "WhatsApp us", href: waLink(WA_MESSAGES.sales), external: true, variant: "whatsapp", Icon: WhatsAppLogo },
          { label: "Email us", href: "mailto:contact@arthaleads.com", Icon: Mail, variant: "secondary" },
        ]}
        trust={["Replies within 24 hours on weekdays", "Real people in Pune"]}
      />

      <Section tone="tint" className="!pt-12 sm:!pt-16">
        <Container className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 lg:gap-10 items-start">
          {/* Left: ways to reach us */}
          <div className="grid gap-4 min-w-0">
            <Card raised className="p-6 sm:p-7">
              <h2 className="font-display text-xl font-bold site-ink mb-6">Contact information</h2>
              <ul className="space-y-5">
                {INFO.map(({ icon: Icon, label, val, href, note }) => (
                  <li key={label} className="flex items-center gap-4">
                    <span className="site-icon w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
                      <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs site-muted mb-0.5">{label}</span>
                      {href
                        ? <a href={href} className="block text-[15px] font-semibold site-ink hover:underline underline-offset-4 break-words">{val}</a>
                        : <span className="block text-[15px] font-semibold site-ink">{val}</span>}
                      {note && <span className="block text-xs site-muted mt-0.5">{note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <SiteButton href={waLink(WA_MESSAGES.sales)} external variant="whatsapp" className="mt-7 w-full sm:w-auto">
                <WhatsAppLogo className="w-[18px] h-[18px]" color="#fff" /> Chat on WhatsApp
              </SiteButton>
            </Card>

            <Card glow className="p-6 sm:p-7" style={{ borderColor: "rgba(255,107,0,0.35)" }}>
              <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-white" style={{ background: "var(--brand-btn)" }}>
                <CalendarCheck2 className="w-5 h-5" aria-hidden="true" />
              </span>
              <h2 className="font-display text-xl font-bold site-ink mb-2">Want to see it working?</h2>
              <p className="text-[15px] leading-relaxed mb-5">Book a 30-minute demo. We set Arthaleads up on your own leads and answer every question live.</p>
              <SiteButton to="/book-demo">Book a Demo <ArrowRight className="w-4 h-4" /></SiteButton>
            </Card>
          </div>

          {/* Right: the form */}
          <Card raised className="p-6 sm:p-8 min-w-0">
            {sent ? (
              <div className="flex flex-col items-center justify-center text-center py-16" role="status">
                <span className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(22,163,74,0.12)" }}>
                  <Check className="w-8 h-8" style={{ color: "#16a34a" }} aria-hidden="true" />
                </span>
                <h2 className="font-display font-extrabold text-2xl site-ink mb-2">Message sent</h2>
                <p className="text-[15px] leading-relaxed max-w-sm">
                  Thanks for reaching out. We'll get back to you at <strong className="site-ink">{form.email}</strong> within 24 hours.
                </p>
                <button type="button" onClick={() => { setSent(false); setForm(EMPTY); }} className="site-link mt-6">Send another message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-display font-bold text-xl site-ink mb-2">Send us a message</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { id: "name",    label: "Your name",      type: "text",  ph: "Rajesh Patil",         req: true,  ac: "name" },
                    { id: "email",   label: "Email address",  type: "email", ph: "rajesh@example.com",   req: true,  ac: "email" },
                    { id: "phone",   label: "Phone number",   type: "tel",   ph: "+91 98765 43210",      req: false, ac: "tel" },
                    { id: "company", label: "Company or team", type: "text", ph: "Milestone Properties", req: false, ac: "organization" },
                  ].map(({ id, label, type, ph, req, ac }) => (
                    <div key={id} className="min-w-0">
                      <label htmlFor={`ct-${id}`} className="block text-[13px] font-semibold site-ink mb-1.5">
                        {label}{req && <span style={{ color: "var(--site-brand-ink)" }}> *</span>}
                      </label>
                      <input id={`ct-${id}`} type={type} placeholder={ph} required={req} autoComplete={ac}
                        value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                        className={inputCls} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div>
                  <label htmlFor="ct-message" className="block text-[13px] font-semibold site-ink mb-1.5">Message</label>
                  <textarea id="ct-message" rows={5}
                    placeholder="Tell us about your team size, current lead volume, and what you're looking for..."
                    value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className={`${inputCls} resize-none`} style={inputStyle} />
                </div>
                {error && <p className="text-sm text-center" style={{ color: "#dc2626" }} role="alert">{error}</p>}
                <SiteButton type="submit" disabled={loading} className="w-full disabled:opacity-60">
                  {loading ? "Sending…" : <>Send message <ArrowRight className="w-4 h-4" /></>}
                </SiteButton>
              </form>
            )}
          </Card>
        </Container>
      </Section>

      <FaqSection title="Before you write" items={FAQS} tone="white" />
    </SitePage>
  );
}
