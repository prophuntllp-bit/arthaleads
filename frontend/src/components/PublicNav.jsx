import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Sun, Moon } from "lucide-react";
import { usePublicTheme } from "../context/PublicThemeContext";

const resourcesLinks = {
  knowledgeHub: [
    { label: "Blog",            href: "/blog",            desc: "CRM insights & real estate tips" },
    { label: "Case Studies",    href: "/case-studies",    desc: "Real results from real teams" },
    { label: "Product Updates", href: "/product-updates", desc: "What's new in Arthaleads" },
    { label: "Help Guide",      href: "/help-guide",      desc: "Tutorials & FAQs" },
  ],
  company: [
    { label: "About Us", href: "/about-us", desc: "Our mission & story" },
    { label: "Careers",  href: "/careers",  desc: "Join the Arthaleads team" },
  ],
};

function NavInner({ onScrollTo }) {
  const { isDark, toggle } = usePublicTheme();
  const [open, setOpen]       = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const resRef                = useRef(null);
  const location              = useLocation();
  const isHome                = location.pathname === "/";

  // Text colour helpers
  const textMuted  = isDark ? "rgba(255,255,255,0.70)" : "#4b5563";
  const textActive = isDark ? "#ffffff" : "#111827";
  const logoText   = isDark ? "#ffffff" : "#111827";

  // Scrolled nav background
  const scrolledBg    = isDark
    ? "rgba(13,13,26,0.97)"
    : "rgba(255,255,255,0.97)";
  const scrolledBorder = isDark
    ? "1px solid rgba(255,255,255,0.08)"
    : "1px solid #e5e7eb";
  const mobileBg = isDark ? "rgba(13,13,26,0.98)" : "rgba(255,255,255,0.98)";

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (resRef.current && !resRef.current.contains(e.target)) {
        setResOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Dropdown card styles
  const dropdownBg     = isDark ? "rgba(18,18,30,0.99)" : "#ffffff";
  const dropdownBorder = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const dropdownShadow = isDark
    ? "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)"
    : "0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px #e5e7eb";
  const catLabel    = isDark ? "rgba(255,255,255,0.30)" : "#9ca3af";
  const itemText    = isDark ? "rgba(255,255,255,0.65)" : "#374151";
  const itemDesc    = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const itemHoverBg = isDark ? "rgba(255,255,255,0.06)" : "#f9fafb";

  function NavLink({ id, label, href }) {
    const linkClass = "text-sm font-medium transition-colors duration-200";
    const style = { color: textMuted };
    const hoverStyle = { color: textActive };

    if (href) {
      return (
        <Link
          to={href}
          className={linkClass}
          style={style}
          onMouseEnter={e => Object.assign(e.currentTarget.style, hoverStyle)}
          onMouseLeave={e => Object.assign(e.currentTarget.style, style)}
        >
          {label}
        </Link>
      );
    }
    if (isHome && onScrollTo) {
      return (
        <button
          onClick={() => { onScrollTo(id); setOpen(false); }}
          className={linkClass}
          style={style}
          onMouseEnter={e => Object.assign(e.currentTarget.style, hoverStyle)}
          onMouseLeave={e => Object.assign(e.currentTarget.style, style)}
        >
          {label}
        </button>
      );
    }
    return (
      <Link
        to={`/#${id}`}
        className={linkClass}
        style={style}
        onMouseEnter={e => Object.assign(e.currentTarget.style, hoverStyle)}
        onMouseLeave={e => Object.assign(e.currentTarget.style, style)}
      >
        {label}
      </Link>
    );
  }

  function MobileNavLink({ id, label, href }) {
    const cls = "block w-full text-left px-4 py-3 text-sm font-medium rounded-xl transition-colors";
    const style = { color: textMuted };
    if (href) {
      return (
        <Link to={href} onClick={() => setOpen(false)} className={cls} style={style}>
          {label}
        </Link>
      );
    }
    if (isHome && onScrollTo) {
      return (
        <button onClick={() => { onScrollTo(id); setOpen(false); }} className={cls} style={style}>
          {label}
        </button>
      );
    }
    return (
      <Link to={`/#${id}`} onClick={() => setOpen(false)} className={cls} style={style}>
        {label}
      </Link>
    );
  }

  const navStyle = scrolled
    ? { background: scrolledBg, borderBottom: scrolledBorder, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }
    : { background: "transparent" };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={navStyle}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img
              src="/logo.png"
              alt="Arthaleads"
              className="w-9 h-9 rounded-xl object-cover"
            />
            <div>
              <span style={{ color: isDark ? "#fff" : "#111827" }} className="font-bold text-lg leading-none">Artha</span>
              <span className="text-[#ff6b00] font-bold text-lg leading-none">leads</span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-8">
            <NavLink id="hero"     label="Home" />
            <NavLink id="features" label="Features" />

            {/* Resources dropdown */}
            <div className="relative" ref={resRef}>
              <button
                onClick={() => setResOpen(!resOpen)}
                className="flex items-center gap-1 text-sm font-medium transition-colors duration-200"
                style={{ color: textMuted }}
                onMouseEnter={e => (e.currentTarget.style.color = textActive)}
                onMouseLeave={e => (e.currentTarget.style.color = resOpen ? textActive : textMuted)}
              >
                Resources
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${resOpen ? "rotate-180" : ""}`} />
              </button>

              {resOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 rounded-2xl overflow-hidden"
                  style={{
                    background: dropdownBg,
                    border: `1px solid ${dropdownBorder}`,
                    boxShadow: dropdownShadow,
                  }}
                >
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-x-6">
                      {/* Knowledge Hub column */}
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                          style={{ color: catLabel }}
                        >
                          Knowledge Hub
                        </p>
                        <ul className="space-y-0.5">
                          {resourcesLinks.knowledgeHub.map((l) => (
                            <li key={l.href}>
                              <Link
                                to={l.href}
                                onClick={() => setResOpen(false)}
                                className="block px-2.5 py-2 rounded-xl transition-colors group"
                                style={{ color: itemText }}
                                onMouseEnter={e => (e.currentTarget.style.background = itemHoverBg)}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >
                                <div className="text-sm font-medium leading-none mb-0.5 group-hover:text-[#ff6b00] transition-colors">{l.label}</div>
                                <div className="text-[11px] leading-snug" style={{ color: itemDesc }}>{l.desc}</div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Company column */}
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                          style={{ color: catLabel }}
                        >
                          Company
                        </p>
                        <ul className="space-y-0.5">
                          {resourcesLinks.company.map((l) => (
                            <li key={l.href}>
                              <Link
                                to={l.href}
                                onClick={() => setResOpen(false)}
                                className="block px-2.5 py-2 rounded-xl transition-colors group"
                                style={{ color: itemText }}
                                onMouseEnter={e => (e.currentTarget.style.background = itemHoverBg)}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >
                                <div className="text-sm font-medium leading-none mb-0.5 group-hover:text-[#ff6b00] transition-colors">{l.label}</div>
                                <div className="text-[11px] leading-snug" style={{ color: itemDesc }}>{l.desc}</div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <NavLink id="pricing"  label="Pricing" />
            <NavLink href="/contact" label="Contact" />
            <NavLink href="/wordpress-plugin" label="WordPress Plugin" />
          </div>

          {/* Desktop CTAs + theme toggle */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: textMuted }}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to="/login"
              className="text-sm font-medium transition-colors px-4 py-2"
              style={{ color: textMuted }}
              onMouseEnter={e => (e.currentTarget.style.color = textActive)}
              onMouseLeave={e => (e.currentTarget.style.color = textMuted)}
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="bg-[#ff6b00] hover:bg-[#e05f00] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ color: textMuted }}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setOpen(!open)}
              className="w-8 h-8 flex items-center justify-center"
              style={{ color: textMuted }}
            >
              {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="lg:hidden backdrop-blur-xl"
          style={{
            background: mobileBg,
            borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb"}`,
          }}
        >
          <div className="px-4 py-4 space-y-1">
            <MobileNavLink id="hero"     label="Home" />
            <MobileNavLink id="features" label="Features" />

            <p
              className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: catLabel }}
            >
              Resources
            </p>
            {resourcesLinks.knowledgeHub.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ color: textMuted }}
              >
                {l.label}
              </Link>
            ))}
            {resourcesLinks.company.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ color: textMuted }}
              >
                {l.label}
              </Link>
            ))}

            <MobileNavLink id="pricing"  label="Pricing" />
            <MobileNavLink href="/contact" label="Contact" />
            <MobileNavLink href="/wordpress-plugin" label="WordPress Plugin" />

            <div
              className="pt-3 flex flex-col gap-2 mt-3"
              style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb"}` }}
            >
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="text-center py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{
                  color: textMuted,
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#d1d5db"}`,
                }}
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={() => setOpen(false)}
                className="text-center bg-[#ff6b00] text-white py-2.5 rounded-xl text-sm font-semibold"
              >
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
