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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#a04100] flex items-center justify-center">
                <svg viewBox="0 0 300 300" className="w-5 h-5" fill="white">
                  <path d="M 81.33 228.04 C76.53,226.90 69.36,222.34 66.66,218.73 C63.05,213.90 61.68,208.54 62.27,201.61 C62.84,194.98 63.99,192.31 88.99,139.50 C125.09,63.23 129.72,53.73 132.37,50.40 C133.79,48.63 137.45,45.95 140.51,44.45 C145.24,42.14 146.94,41.81 151.87,42.25 C163.03,43.27 168.29,47.91 174.96,62.65 C177.41,68.07 181.29,76.55 183.59,81.50 C200.52,117.99 217.35,157.62 216.51,158.99 C216.23,159.43 213.20,158.28 209.76,156.42 C201.54,152.01 190.75,149.61 181.96,150.24 L 175.14 150.72 L 162.66 124.11 C155.80,109.48 149.80,97.56 149.34,97.64 C148.37,97.79 142.41,109.59 129.48,137.00 C124.41,147.73 116.59,164.30 112.08,173.84 C107.58,183.38 104.03,191.57 104.20,192.05 C104.71,193.52 112.09,189.63 128.01,179.49 C154.06,162.91 166.96,158.00 184.43,158.00 C207.45,158.00 221.06,166.74 230.38,187.49 C233.03,193.40 236.95,201.99 239.10,206.59 C243.38,215.76 243.70,217.75 241.57,221.85 C239.45,225.96 236.05,227.00 224.79,227.00 C215.85,227.00 214.19,226.71 210.48,224.54 C208.17,223.19 205.58,221.01 204.72,219.70 C203.45,217.76 196.30,202.29 186.47,180.23 L 185.02 176.97 L 181.40 178.48 C175.00,181.15 164.75,188.60 154.50,198.01 C140.57,210.81 132.94,216.40 122.50,221.44 C109.16,227.89 92.15,230.62 81.33,228.04 Z" />
                </svg>
              </div>
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
              <a href="mailto:support@arthaleads.com" style={{ color: text }} className="block text-sm hover:text-[#ff6b00] transition-colors">support@arthaleads.com</a>
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
