import { Link } from "react-router-dom";
import { Instagram, Facebook, Linkedin, Youtube, Mail, Phone } from "lucide-react";
import WhatsAppLogo from "./WhatsAppLogo";

// The WhatsApp glyph in the social row, coloured like the lucide icons beside it.
const WaIcon = ({ strokeWidth, ...props }) => <WhatsAppLogo {...props} color="currentColor" />;
import { PHONE_DISPLAY, PHONE_TEL, waLink, WA_MESSAGES, SOCIAL_LINKS } from "../utils/crmLinks";
import { usePublicTheme } from "../context/PublicThemeContext";

// One column of footer links. Every link always shows (owner: no accordions);
// each link is a 32px hit area with no gap between rows, so the list is no
// longer than before. On phones the groups sit two to a row (Product beside
// Company, Compare beside Legal, so the rows are even); from md up the columns
// keep their order.
function FooterGroup({ title, links, className = "" }) {
  return (
    <div className={className}>
      <p className="font-semibold text-sm mb-1 md:mb-2" style={{ color: "var(--site-ink)" }}>{title}</p>
      <div>
        {links.map(([label, href]) => (
          <Link key={label} to={href} className="block py-1.5 text-[13px] md:text-sm leading-5 text-[color:var(--site-text)] hover:text-[color:var(--brand-text)] transition-colors">{label}</Link>
        ))}
      </div>
    </div>
  );
}

const PRODUCT = [
  ["Features",           "/features"],
  ["Pricing",            "/pricing"],
  ["WhatsApp CRM",       "/whatsapp-crm"],
  ["AI CRM",             "/ai-crm"],
  ["Builder CRM",        "/builder-crm"],
  ["Download app",       "/download-app"],
  ["WordPress plugin",   "/wordpress-plugin"],
  ["API docs",           "/api-docs"],
  ["Refer and earn",      "/refer"],
];
const COMPARE = [
  ["All comparisons",        "/compare"],
  ["Arthaleads vs Sell.Do",  "/compare/sell-do-alternative"],
  ["Arthaleads vs Leadrat",  "/compare/leadrat-alternative"],
  ["Arthaleads vs Kylas",    "/compare/kylas-alternative"],
];
const COMPANY = [
  ["About us",        "/about-us"],
  ["Careers",         "/careers"],
  ["Blog",            "/blog"],
  ["Product updates", "/product-updates"],
  ["Help guide",      "/help-guide"],
  ["Security",        "/security"],
  ["Book a demo",     "/book-demo"],
  ["Contact us",      "/contact"],
];
const LEGAL = [
  ["Privacy Policy",   "/privacy"],
  ["Terms of Service", "/terms"],
  ["Refund Policy",    "/refund"],
  ["Cookie Policy",    "/cookie-policy"],
];

export default function PublicFooter() {
  const { isDark } = usePublicTheme();
  // Warm site tokens (they switch with the public theme on their own).
  const text    = "var(--site-text)";
  const heading = "var(--site-ink)";
  const border  = "var(--site-line)";

  return (
    <footer style={{ background: "var(--site-tint)", borderTop: `1px solid ${border}` }}>
      <div className="site-container py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-5 md:gap-8 mb-6 md:mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-3 md:mb-4">
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
              className="block w-fit py-1.5 text-sm mt-1 md:mt-3 hover:text-[color:var(--brand-text)] transition-colors"
            >
              contact@arthaleads.com
            </a>
            {/* The phone number is the fastest way to reach sales: shown as a highlighted call chip. */}
            <a href={PHONE_TEL}
              className="inline-flex items-center gap-2 mt-2.5 md:mt-3 pl-1.5 pr-3.5 py-2 rounded-full text-[15px] font-bold transition-transform duration-200 hover:-translate-y-0.5"
              style={{ color: heading, background: "rgba(255,107,0,0.10)", border: "1px solid rgba(255,107,0,0.35)" }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: "var(--brand-btn)" }}>
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              {PHONE_DISPLAY}
            </a>

            <p className="text-[13px] font-semibold mt-4 md:mt-7 mb-2.5 md:mb-3" style={{ color: heading }}>
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
                  className="w-11 h-11 rounded-xl flex items-center justify-center border transition-transform duration-200 hover:-translate-y-0.5"
                  style={{ color: text, borderColor: border, background: "var(--site-card)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = hover; e.currentTarget.style.borderColor = hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = text; e.currentTarget.style.borderColor = border; }}>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </a>
              ))}
            </div>
          </div>

          <FooterGroup title="Product" links={PRODUCT} className="md:order-1" />
          <FooterGroup title="Company" links={COMPANY} className="md:order-3" />
          <FooterGroup title="Compare" links={COMPARE} className="md:order-2" />
          <FooterGroup title="Legal" links={LEGAL} className="md:order-4" />

        </div>

        <div style={{ borderTop: `1px solid ${border}` }} className="pt-4 md:pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p style={{ color: "var(--site-muted)" }} className="text-xs">© {new Date().getFullYear()} Arthaleads, operated by Prophunt LLP · Pune, India</p>
        </div>
      </div>
    </footer>
  );
}
