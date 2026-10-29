import { Link } from "react-router-dom";
import { Instagram, Facebook, Linkedin, Youtube, Mail, Phone } from "lucide-react";
import WhatsAppLogo from "./WhatsAppLogo";

// The WhatsApp glyph in the social row, coloured like the lucide icons beside it.
const WaIcon = ({ strokeWidth, ...props }) => <WhatsAppLogo {...props} color="currentColor" />;
import { PHONE_DISPLAY, PHONE_TEL, waLink, WA_MESSAGES, SOCIAL_LINKS } from "../utils/crmLinks";
import { usePublicTheme } from "../context/PublicThemeContext";

export default function PublicFooter() {
  const { isDark } = usePublicTheme();
  const bg      = isDark ? "#0d0d1a" : "#f9fafb";
  const text    = isDark ? "rgba(255,255,255,0.5)" : "#6b7280";
  const heading = isDark ? "#fff" : "#111827";
  const border  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <footer style={{ background: bg, borderTop: `1px solid ${border}` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src={isDark ? "/logo-lockup-dark.webp" : "/logo-lockup.webp"}
                srcSet={isDark ? "/logo-lockup-dark-240.webp 240w, /logo-lockup-dark.webp 420w" : "/logo-lockup-240.webp 240w, /logo-lockup.webp 420w"} sizes="120px"
                width={isDark ? 1515 : 1574} height={isDark ? 459 : 471}
                alt="Arthaleads — Turning Opportunities Into Value"
                className="h-8 w-auto"
              />
            </div>
            <p style={{ color: text }} className="text-sm leading-relaxed max-w-xs">
              India's real estate CRM for developers, brokers &amp; channel partners. Built in Pune by Prophunt LLP.
            </p>
            <a
              href="mailto:contact@arthaleads.com"
              style={{ color: text }}
              className="flex items-center min-h-[44px] md:min-h-0 md:block text-sm mt-2 md:mt-4 hover:text-[color:var(--brand-text)] transition-colors"
            >
              contact@arthaleads.com
            </a>
            {/* The phone number is the fastest way to reach sales: shown as a highlighted call chip. */}
            <a href={PHONE_TEL}
              className="inline-flex items-center gap-2 mt-3 pl-1.5 pr-3.5 py-1.5 rounded-full text-[15px] font-bold transition-transform duration-200 hover:-translate-y-0.5"
              style={{ color: isDark ? "#ffffff" : "#111827", background: "rgba(255,107,0,0.10)", border: "1px solid rgba(255,107,0,0.35)" }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: "var(--brand-btn)" }}>
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              {PHONE_DISPLAY}
            </a>

            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mt-7 mb-3" style={{ color: heading }}>
              Follow Arthaleads
            </p>
            <div className="flex flex-wrap gap-2.5">
              {[
                { label: "Chat on WhatsApp",        href: waLink(WA_MESSAGES.sales), Icon: WaIcon, hover: "#25D366" },
                { label: "Arthaleads on Instagram", href: SOCIAL_LINKS.instagram, Icon: Instagram, hover: "#E1306C" },
                { label: "Arthaleads on Facebook",  href: SOCIAL_LINKS.facebook,  Icon: Facebook,  hover: "#1877F2" },
                { label: "Arthaleads on LinkedIn",  href: SOCIAL_LINKS.linkedin,  Icon: Linkedin,  hover: "#0A66C2" },
                { label: "Arthaleads on YouTube",   href: SOCIAL_LINKS.youtube,   Icon: Youtube,   hover: "#FF0000" },
                { label: "Email Arthaleads",        href: "mailto:contact@arthaleads.com", Icon: Mail, hover: "#ff6b00" },
              ].map(({ label, href, Icon, hover }) => (
                <a key={label} href={href} aria-label={label} title={label}
                  {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 hover:-translate-y-0.5"
                  style={{ color: text, borderColor: border, background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = hover; e.currentTarget.style.borderColor = hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = text; e.currentTarget.style.borderColor = border; }}>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <p style={{ color: heading }} className="font-semibold text-sm mb-4">Product</p>
            <div className="md:space-y-2.5">
              {[
                ["Features",           "/features"],
                ["Pricing",            "/pricing"],
                ["WhatsApp CRM",       "/whatsapp-crm"],
                ["AI CRM",             "/ai-crm"],
                ["Builder CRM",        "/builder-crm"],
                ["Download App",       "/download-app"],
                ["WordPress Plugin",   "/wordpress-plugin"],
                ["API Docs",           "/api-docs"],
                ["Refer & Earn",       "/refer"],
              ].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="flex items-center min-h-[44px] md:min-h-0 md:block text-sm hover:text-[color:var(--brand-text)] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          {/* Compare */}
          <div>
            <p style={{ color: heading }} className="font-semibold text-sm mb-4">Compare</p>
            <div className="md:space-y-2.5">
              {[
                ["All comparisons",        "/compare"],
                ["Arthaleads vs Sell.Do",  "/compare/sell-do-alternative"],
                ["Arthaleads vs Leadrat",  "/compare/leadrat-alternative"],
                ["Arthaleads vs Kylas",    "/compare/kylas-alternative"],
              ].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="flex items-center min-h-[44px] md:min-h-0 md:block text-sm hover:text-[color:var(--brand-text)] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <p style={{ color: heading }} className="font-semibold text-sm mb-4">Company</p>
            <div className="md:space-y-2.5">
              {[
                ["About Us",      "/about-us"],
                ["Careers",       "/careers"],
                ["Blog",          "/blog"],
                ["Product Updates", "/product-updates"],
                ["Help Guide",    "/help-guide"],
                ["Security",      "/security"],
                ["Book a Demo",   "/book-demo"],
                ["Contact Us",    "/contact"],
              ].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="flex items-center min-h-[44px] md:min-h-0 md:block text-sm hover:text-[color:var(--brand-text)] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <p style={{ color: heading }} className="font-semibold text-sm mb-4">Legal</p>
            <div className="md:space-y-2.5">
              {[
                ["Privacy Policy",   "/privacy"],
                ["Terms of Service", "/terms"],
                ["Refund Policy",    "/refund"],
                ["Cookie Policy",    "/cookie-policy"],
              ].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="flex items-center min-h-[44px] md:min-h-0 md:block text-sm hover:text-[color:var(--brand-text)] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: "1.5rem" }} className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p style={{ color: text }} className="text-xs">© {new Date().getFullYear()} Arthaleads, operated by Prophunt LLP · Pune, India</p>
        </div>
      </div>
    </footer>
  );
}
