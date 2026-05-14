import { Link } from "react-router-dom";
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="Arthaleads" className="w-8 h-8 rounded-xl object-cover" />
              <div>
                <span style={{ color: heading }} className="font-bold text-lg leading-none">Artha</span>
                <span className="text-[#ff6b00] font-bold text-lg leading-none">leads</span>
              </div>
            </div>
            <p style={{ color: text }} className="text-sm leading-relaxed">India's real estate CRM for developers, brokers &amp; channel partners.</p>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ color: heading }} className="font-semibold text-sm mb-4">Product</h4>
            <div className="space-y-2.5">
              {[["Features", "/#features"], ["Pricing", "/#pricing"], ["WordPress Plugin", "/wordpress-plugin"], ["Product Updates", "/product-updates"]].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 style={{ color: heading }} className="font-semibold text-sm mb-4">Resources</h4>
            <div className="space-y-2.5">
              {[["Blog", "/blog"], ["Case Studies", "/case-studies"], ["Help Guide", "/help-guide"], ["About Us", "/about-us"]].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ color: heading }} className="font-semibold text-sm mb-4">Legal</h4>
            <div className="space-y-2.5">
              {[["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"]].map(([label, href]) => (
                <Link key={label} to={href} style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">{label}</Link>
              ))}
              <Link to="/contact" style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">Contact Us</Link>
              <a href="mailto:contact@arthaleads.com" style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">contact@arthaleads.com</a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: "1.5rem" }} className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p style={{ color: text }} className="text-xs">© {new Date().getFullYear()} Arthaleads (Prophunt LLP). All rights reserved.</p>
          <p style={{ color: text }} className="text-xs">Built for Indian real estate.</p>
        </div>
      </div>
    </footer>
  );
}
