import { Link } from "react-router-dom";
import { PHONE_DISPLAY, PHONE_TEL, waLink, WA_MESSAGES } from "../utils/crmLinks";
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src={isDark ? "/logo-lockup-dark.png" : "/logo-lockup.png"}
                alt="Arthaleads — Turning Opportunities Into Value"
                className="h-8 w-auto"
              />
            </div>
            <p style={{ color: text }} className="text-sm leading-relaxed max-w-xs">
              India's real estate CRM for developers, brokers &amp; channel partners. Built in Pune, trusted across Maharashtra.
            </p>
            <a
              href="mailto:contact@arthaleads.com"
              style={{ color: text }}
              className="block text-sm mt-4 hover:text-[#ff6b00] transition-colors"
            >
              contact@arthaleads.com
            </a>
            <a href={PHONE_TEL} style={{ color: text }} className="block text-sm mt-2 hover:text-[#ff6b00] transition-colors">
              {PHONE_DISPLAY}
            </a>
            <a href={waLink(WA_MESSAGES.sales)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
              style={{ background: "#128C7E" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.38 9.38 0 0 1 6.67 2.77 9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.46A11.3 11.3 0 0 0 12.05.73C5.8.73.7 5.82.7 12.08c0 2 .52 3.95 1.52 5.67L.6 23.27l5.66-1.48a11.33 11.33 0 0 0 5.42 1.38h.01c6.25 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.33-8.03z"/></svg>
              Chat on WhatsApp
            </a>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ color: heading }} className="font-semibold text-sm mb-4">Product</h4>
            <div className="space-y-2.5">
              {[
                ["Pricing",            "/pricing"],
                ["WordPress Plugin",   "/wordpress-plugin"],
                ["API Docs",           "/api-docs"],
                ["Feature Comparison", "/compare"],
                ["Refer & Earn",       "/refer"],
              ].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 style={{ color: heading }} className="font-semibold text-sm mb-4">Company</h4>
            <div className="space-y-2.5">
              {[
                ["About Us",      "/about-us"],
                ["Careers",       "/careers"],
                ["Blog",          "/blog"],
                ["Help Guide",    "/help-guide"],
                ["Security",      "/security"],
                ["Contact Us",    "/contact"],
              ].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ color: heading }} className="font-semibold text-sm mb-4">Legal</h4>
            <div className="space-y-2.5">
              {[
                ["Privacy Policy",   "/privacy"],
                ["Terms of Service", "/terms"],
                ["Refund Policy",    "/refund"],
                ["Cookie Policy",    "/cookie-policy"],
              ].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: "1.5rem" }} className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p style={{ color: text }} className="text-xs">© {new Date().getFullYear()} Arthaleads · Pune, India</p>
          <a
            href="https://www.vistrow.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Arthaleads is a product of Vistrow Technologies"
            style={{ color: text }}
            className="flex items-center gap-2 text-xs transition-opacity hover:opacity-80"
          >
            by
            <img
              src={isDark ? "/vistrow-technologies-dark.png" : "/vistrow-technologies.png"}
              alt="Vistrow Technologies"
              className="h-8 w-auto"
              width="103" height="32"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
