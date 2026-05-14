import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";

const LOGO_PATH = "M 81.33 228.04 C76.53,226.90 69.36,222.34 66.66,218.73 C63.05,213.90 61.68,208.54 62.27,201.61 C62.84,194.98 63.99,192.31 88.99,139.50 C125.09,63.23 129.72,53.73 132.37,50.40 C133.79,48.63 137.45,45.95 140.51,44.45 C145.24,42.14 146.94,41.81 151.87,42.25 C163.03,43.27 168.29,47.91 174.96,62.65 C177.41,68.07 181.29,76.55 183.59,81.50 C200.52,117.99 217.35,157.62 216.51,158.99 C216.23,159.43 213.20,158.28 209.76,156.42 C201.54,152.01 190.75,149.61 181.96,150.24 L 175.14 150.72 L 162.66 124.11 C155.80,109.48 149.80,97.56 149.34,97.64 C148.37,97.79 142.41,109.59 129.48,137.00 C124.41,147.73 116.59,164.30 112.08,173.84 C107.58,183.38 104.03,191.57 104.20,192.05 C104.71,193.52 112.09,189.63 128.01,179.49 C154.06,162.91 166.96,158.00 184.43,158.00 C207.45,158.00 221.06,166.74 230.38,187.49 C233.03,193.40 236.95,201.99 239.10,206.59 C243.38,215.76 243.70,217.75 241.57,221.85 C239.45,225.96 236.05,227.00 224.79,227.00 C215.85,227.00 214.19,226.71 210.48,224.54 C208.17,223.19 205.58,221.01 204.72,219.70 C203.45,217.76 196.30,202.29 186.47,180.23 L 185.02 176.97 L 181.40 178.48 C175.00,181.15 164.75,188.60 154.50,198.01 C140.57,210.81 132.94,216.40 122.50,221.44 C109.16,227.89 92.15,230.62 81.33,228.04 Z";

const resourcesLinks = {
  knowledgeHub: [
    { label: "Blog",            href: "/blog" },
    { label: "Case Studies",    href: "/case-studies" },
    { label: "Product Updates", href: "/product-updates" },
    { label: "Help Guide",      href: "/help-guide" },
  ],
  company: [
    { label: "About Us", href: "/about-us" },
  ],
};

export default function PublicNav({ onScrollTo }) {
  const [open, setOpen]       = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const resRef                = useRef(null);
  const location              = useLocation();
  const isHome                = location.pathname === "/";

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

  function navAction(id) {
    if (isHome && onScrollTo) {
      onScrollTo(id);
    }
  }

  function NavLink({ id, label }) {
    if (isHome && onScrollTo) {
      return (
        <button
          onClick={() => { onScrollTo(id); setOpen(false); }}
          className="text-white/70 hover:text-white text-sm font-medium transition-colors duration-200"
        >
          {label}
        </button>
      );
    }
    return (
      <Link
        to={`/#${id}`}
        className="text-white/70 hover:text-white text-sm font-medium transition-colors duration-200"
      >
        {label}
      </Link>
    );
  }

  function MobileNavLink({ id, label }) {
    if (isHome && onScrollTo) {
      return (
        <button
          onClick={() => { onScrollTo(id); setOpen(false); }}
          className="block w-full text-left px-4 py-3 text-white/70 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors"
        >
          {label}
        </button>
      );
    }
    return (
      <Link
        to={`/#${id}`}
        onClick={() => setOpen(false)}
        className="block px-4 py-3 text-white/70 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors"
      >
        {label}
      </Link>
    );
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-[#0d0d1a]/95 backdrop-blur-xl shadow-2xl border-b border-white/5" : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#a04100] flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
              <svg viewBox="0 0 300 300" className="w-5 h-5">
                <path d={LOGO_PATH} fill="white" />
              </svg>
            </div>
            <div>
              <span className="text-white font-bold text-lg leading-none">Artha</span>
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
                className="flex items-center gap-1 text-white/70 hover:text-white text-sm font-medium transition-colors duration-200"
              >
                Resources
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${resOpen ? "rotate-180" : ""}`} />
              </button>

              {resOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
                  style={{ background: "rgba(13,13,26,0.98)", backdropFilter: "blur(24px)" }}>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-3">Knowledge Hub</p>
                      <ul className="space-y-1">
                        {resourcesLinks.knowledgeHub.map((l) => (
                          <li key={l.href}>
                            <Link
                              to={l.href}
                              onClick={() => setResOpen(false)}
                              className="block px-2 py-1.5 text-white/65 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
                            >
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-3">Company</p>
                      <ul className="space-y-1">
                        {resourcesLinks.company.map((l) => (
                          <li key={l.href}>
                            <Link
                              to={l.href}
                              onClick={() => setResOpen(false)}
                              className="block px-2 py-1.5 text-white/65 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
                            >
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <NavLink id="pricing"  label="Pricing" />
            <NavLink id="contact"  label="Contact" />
            <Link to="/blog" className="text-white/70 hover:text-white text-sm font-medium transition-colors duration-200">
              Blog
            </Link>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login"
              className="text-white/80 hover:text-white text-sm font-medium transition-colors px-4 py-2">
              Login
            </Link>
            <Link to="/signup"
              className="bg-[#ff6b00] hover:bg-[#e05f00] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5">
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setOpen(!open)} className="lg:hidden text-white/80 hover:text-white">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-[#0d0d1a]/98 backdrop-blur-xl border-t border-white/5">
          <div className="px-4 py-4 space-y-1">
            <MobileNavLink id="hero"     label="Home" />
            <MobileNavLink id="features" label="Features" />

            <p className="px-4 pt-3 pb-1 text-white/30 text-[10px] font-semibold uppercase tracking-widest">
              Resources
            </p>
            {resourcesLinks.knowledgeHub.map((l) => (
              <Link key={l.href} to={l.href} onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-white/65 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors">
                {l.label}
              </Link>
            ))}
            {resourcesLinks.company.map((l) => (
              <Link key={l.href} to={l.href} onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-white/65 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors">
                {l.label}
              </Link>
            ))}

            <MobileNavLink id="pricing"  label="Pricing" />
            <MobileNavLink id="contact"  label="Contact" />
            <Link to="/blog" onClick={() => setOpen(false)}
              className="block px-4 py-3 text-white/70 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors">
              Blog
            </Link>

            <div className="pt-3 flex flex-col gap-2 border-t border-white/5 mt-3">
              <Link to="/login" onClick={() => setOpen(false)}
                className="text-center py-2.5 text-white/80 hover:text-white text-sm font-medium border border-white/10 rounded-xl">
                Login
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)}
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
