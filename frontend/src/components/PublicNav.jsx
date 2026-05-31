import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu, X, ChevronDown, Sun, Moon,
  BookOpen, BarChart2, Zap, HelpCircle,
  Building2, Briefcase, Puzzle,
  Code2, GitCompare, Shield, Activity, Gift,
} from "lucide-react";
import { usePublicTheme } from "../context/PublicThemeContext";

const NAV_RESOURCES = [
  { label: "Blog",             href: "/blog",             desc: "CRM insights & real estate tips",    icon: BookOpen },
  { label: "Case Studies",     href: "/case-studies",     desc: "Real results from real teams",       icon: BarChart2 },
  { label: "Product Updates",  href: "/product-updates",  desc: "What's new in Arthaleads",           icon: Zap },
  { label: "Help Guide",       href: "/help-guide",       desc: "Tutorials & FAQs",                  icon: HelpCircle },
  { label: "WordPress Plugin", href: "/wordpress-plugin", desc: "Capture leads from any WP form",    icon: Puzzle },
  { label: "API Docs",         href: "/api-docs",         desc: "Integrate with the REST API",       icon: Code2 },
  { label: "Compare",          href: "/compare",          desc: "Arthaleads vs other CRMs",          icon: GitCompare },
];

const NAV_COMPANY = [
  { label: "About Us",      href: "/about-us", desc: "Our mission & story",        icon: Building2 },
  { label: "Careers",       href: "/careers",  desc: "Join the Arthaleads team",   icon: Briefcase, badge: "Hiring" },
  { label: "Security",      href: "/security", desc: "How we protect your data",   icon: Shield },
  { label: "System Status", href: "/status",   desc: "Live uptime & incidents",    icon: Activity },
  { label: "Refer & Earn",  href: "/refer",    desc: "Give a month, get a month",  icon: Gift, badge: "Earn" },
];

// ── Reusable dropdown panel ───────────────────────────────────────────────────
function DropdownPanel({ items, onClose, isDark, width = 268 }) {
  const bg     = isDark ? "rgba(18,18,30,0.99)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const shadow = isDark
    ? "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)"
    : "0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px #e5e7eb";
  const itemText    = isDark ? "rgba(255,255,255,0.75)" : "#111827";
  const itemDesc    = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const iconBase    = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const iconColor   = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const hoverBg     = isDark ? "rgba(255,255,255,0.06)" : "#f9fafb";

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 12px)",
        left: "50%",
        transform: "translateX(-50%)",
        width,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: shadow,
        borderRadius: 16,
        padding: "8px",
        zIndex: 100,
        animation: "ddIn 0.18s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <style>{`
        @keyframes ddIn {
          from { opacity:0; transform:translateX(-50%) translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:translateX(-50%) translateY(0)    scale(1);    }
        }
      `}</style>
      {items.map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            to={l.href}
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, textDecoration: "none", transition: "background 0.15s", color: "inherit" }}
            onMouseEnter={e => {
              e.currentTarget.style.background = hoverBg;
              e.currentTarget.querySelector(".dd-icon").style.background = "rgba(255,107,0,0.12)";
              e.currentTarget.querySelector(".dd-icon").style.color = "#ff6b00";
              e.currentTarget.querySelector(".dd-label").style.color = "#ff6b00";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.querySelector(".dd-icon").style.background = iconBase;
              e.currentTarget.querySelector(".dd-icon").style.color = iconColor;
              e.currentTarget.querySelector(".dd-label").style.color = itemText;
            }}
          >
            {/* Icon box */}
            <div
              className="dd-icon"
              style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: 9,
                background: iconBase, color: iconColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Icon style={{ width: 15, height: 15 }} />
            </div>

            {/* Text */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span
                  className="dd-label"
                  style={{ fontSize: 13, fontWeight: 600, color: itemText, transition: "color 0.15s", lineHeight: 1 }}
                >
                  {l.label}
                </span>
                {l.badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
                    background: "rgba(255,107,0,0.12)", color: "#ff6b00",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {l.badge}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: itemDesc, lineHeight: 1.3 }}>{l.desc}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Nav trigger button ────────────────────────────────────────────────────────
function DropdownTrigger({ label, isOpen, onClick, textMuted, textActive }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 3,
        fontSize: 14, fontWeight: 500, color: isOpen ? textActive : textMuted,
        background: "none", border: "none", cursor: "pointer",
        padding: 0,
        transition: "color 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = textActive)}
      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.color = textMuted; }}
    >
      {label}
      <ChevronDown
        style={{
          width: 14, height: 14,
          transition: "transform 0.2s",
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
        }}
      />
    </button>
  );
}

// ── Main nav ──────────────────────────────────────────────────────────────────
function NavInner({ onScrollTo }) {
  const { isDark, toggle } = usePublicTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [resOpen, setResOpen]       = useState(false);
  const [compOpen, setCompOpen]     = useState(false);
  const resRef  = useRef(null);
  const compRef = useRef(null);
  const location = useLocation();
  const isHome   = location.pathname === "/";

  const textMuted  = isDark ? "rgba(255,255,255,0.70)" : "#4b5563";
  const textActive = isDark ? "#ffffff" : "#111827";

  const scrolledBg     = isDark ? "rgba(13,13,26,0.97)" : "rgba(255,255,255,0.97)";
  const scrolledBorder = isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb";
  const mobileBg       = isDark ? "rgba(13,13,26,0.98)" : "rgba(255,255,255,0.98)";
  const catLabel       = isDark ? "rgba(255,255,255,0.30)" : "#9ca3af";

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (resRef.current  && !resRef.current.contains(e.target))  setResOpen(false);
      if (compRef.current && !compRef.current.contains(e.target)) setCompOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function closeAll() { setResOpen(false); setCompOpen(false); }

  function NavLink({ id, label, href }) {
    const style = { fontSize: 14, fontWeight: 500, color: textMuted, transition: "color 0.2s" };
    const hov   = { color: textActive };
    const shared = {
      style,
      onMouseEnter: e => Object.assign(e.currentTarget.style, hov),
      onMouseLeave: e => Object.assign(e.currentTarget.style, style),
    };
    if (href) return <Link to={href} className="transition-colors" {...shared}>{label}</Link>;
    if (isHome && onScrollTo) {
      return (
        <button onClick={() => { onScrollTo(id); setMobileOpen(false); }}
          style={{ ...style, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={e => Object.assign(e.currentTarget.style, hov)}
          onMouseLeave={e => Object.assign(e.currentTarget.style, style)}
        >{label}</button>
      );
    }
    return <Link to={`/#${id}`} className="transition-colors" {...shared}>{label}</Link>;
  }

  const navStyle = scrolled
    ? { background: scrolledBg, borderBottom: scrolledBorder, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }
    : { background: "transparent" };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300" style={navStyle}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo.png" alt="Arthaleads" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <span style={{ color: isDark ? "#fff" : "#111827" }} className="font-bold text-lg leading-none">Artha</span>
              <span className="text-[#ff6b00] font-bold text-lg leading-none">leads</span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-7">
            <NavLink id="hero"     label="Home" />
            <NavLink id="features" label="Features" />

            {/* Resources dropdown */}
            <div className="relative" ref={resRef}>
              <DropdownTrigger
                label="Resources"
                isOpen={resOpen}
                onClick={() => { setResOpen(o => !o); setCompOpen(false); }}
                textMuted={textMuted}
                textActive={textActive}
              />
              {resOpen && (
                <DropdownPanel
                  items={NAV_RESOURCES}
                  onClose={() => setResOpen(false)}
                  isDark={isDark}
                  width={272}
                />
              )}
            </div>

            {/* Company dropdown */}
            <div className="relative" ref={compRef}>
              <DropdownTrigger
                label="Company"
                isOpen={compOpen}
                onClick={() => { setCompOpen(o => !o); setResOpen(false); }}
                textMuted={textMuted}
                textActive={textActive}
              />
              {compOpen && (
                <DropdownPanel
                  items={NAV_COMPANY}
                  onClose={() => setCompOpen(false)}
                  isDark={isDark}
                  width={248}
                />
              )}
            </div>

            <NavLink id="pricing"  label="Pricing" />
            <NavLink href="/contact" label="Contact" />
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
              style={{ color: textMuted }}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link to="/login"
              className="text-sm font-medium transition-colors px-4 py-2"
              style={{ color: textMuted }}
              onMouseEnter={e => (e.currentTarget.style.color = textActive)}
              onMouseLeave={e => (e.currentTarget.style.color = textMuted)}
            >
              Login
            </Link>
            <Link to="/signup"
              className="bg-[#ff6b00] hover:bg-[#e05f00] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile: theme + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={toggle} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: textMuted }} aria-label="Toggle theme">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => setMobileOpen(o => !o)} className="w-8 h-8 flex items-center justify-center" style={{ color: textMuted }}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden backdrop-blur-xl" style={{ background: mobileBg, borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb"}` }}>
          <div className="px-4 py-4 space-y-1">

            {/* Main links */}
            {[
              { id: "hero",     label: "Home" },
              { id: "features", label: "Features" },
            ].map(({ id, label }) => (
              isHome && onScrollTo
                ? <button key={id} onClick={() => { onScrollTo(id); setMobileOpen(false); }}
                    className="block w-full text-left px-4 py-3 text-sm font-medium rounded-xl"
                    style={{ color: textMuted }}>{label}</button>
                : <Link key={id} to={`/#${id}`} onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-sm font-medium rounded-xl"
                    style={{ color: textMuted }}>{label}</Link>
            ))}

            {/* Resources section */}
            <p className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: catLabel }}>
              Resources
            </p>
            {NAV_RESOURCES.map(l => (
              <Link key={l.href} to={l.href} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: textMuted, textDecoration: "none" }}>
                <l.icon style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.6 }} />
                {l.label}
              </Link>
            ))}

            {/* Company section */}
            <p className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: catLabel }}>
              Company
            </p>
            {NAV_COMPANY.map(l => (
              <Link key={l.href} to={l.href} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: textMuted, textDecoration: "none" }}>
                <l.icon style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.6 }} />
                {l.label}
                {l.badge && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "rgba(255,107,0,0.12)", color: "#ff6b00", marginLeft: 2 }}>
                    {l.badge}
                  </span>
                )}
              </Link>
            ))}

            {/* Rest */}
            {[
              { id: "pricing", label: "Pricing" },
            ].map(({ id, label }) => (
              isHome && onScrollTo
                ? <button key={id} onClick={() => { onScrollTo(id); setMobileOpen(false); }}
                    className="block w-full text-left px-4 py-3 text-sm font-medium rounded-xl"
                    style={{ color: textMuted }}>{label}</button>
                : <Link key={id} to={`/#${id}`} onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-sm font-medium rounded-xl"
                    style={{ color: textMuted }}>{label}</Link>
            ))}
            <Link to="/contact" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium rounded-xl" style={{ color: textMuted }}>Contact</Link>

            {/* Auth CTAs */}
            <div className="pt-3 flex flex-col gap-2 mt-3" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb"}` }}>
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="text-center py-2.5 text-sm font-medium rounded-xl"
                style={{ color: textMuted, border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#d1d5db"}` }}>
                Login
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)}
                className="text-center bg-[#ff6b00] text-white py-2.5 rounded-xl text-sm font-semibold">
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default function PublicNav({ onScrollTo }) {
  return <NavInner onScrollTo={onScrollTo} />;
}
