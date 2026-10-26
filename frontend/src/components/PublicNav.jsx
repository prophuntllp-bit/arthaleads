import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown, Sun, Moon,
  BookOpen, BarChart2, Zap, HelpCircle,
  Building2, Briefcase, Puzzle,
  Code2, GitCompare, Shield, Gift,
  Smartphone, Scale, Bot,
} from "lucide-react";
import WhatsAppLogo from "./WhatsAppLogo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { CRM_LOGIN_URL, CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { ScrollProgress } from "./motion/Motion";
import CardNav from "./site/reactbits/CardNav";

// The chat widget is not needed for first paint; load it once the page is idle.
const MarketingChatBot = lazy(() => import("./MarketingChatBot"));
function IdleChatBot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => setReady(true), { timeout: 3000 });
    return () => cancel(id);
  }, []);
  return ready ? <Suspense fallback={null}><MarketingChatBot /></Suspense> : null;
}

const NAV_RESOURCES = [
  { label: "WhatsApp CRM",     href: "/whatsapp-crm",     desc: "AI replies and a team inbox for WhatsApp", icon: WhatsAppLogo },
  { label: "AI CRM",           href: "/ai-crm",           desc: "What the AI does for your sales team", icon: Bot },
  { label: "Builder CRM",      href: "/builder-crm",      desc: "Project-wise sales for developers",  icon: Building2 },
  { label: "Blog",             href: "/blog",             desc: "Guides, market notes & product news", icon: BookOpen },
  { label: "Case Studies",     href: "/case-studies",     desc: "Real results from real teams",       icon: BarChart2 },
  { label: "Product Updates",  href: "/product-updates",  desc: "What's new in Arthaleads",           icon: Zap },
  { label: "Help Guide",       href: "/help-guide",       desc: "Tutorials & FAQs",                  icon: HelpCircle },
  { label: "Download App",    href: "/download-app",     desc: "Arthaleads on your Android phone", icon: Smartphone },
  { label: "WordPress Plugin", href: "/wordpress-plugin", desc: "Capture leads from any WP form",    icon: Puzzle },
  { label: "API Docs",         href: "/api-docs",         desc: "Integrate with the REST API",       icon: Code2 },
];

// One entry per comparison page. Add LeadRat, Kylas, ... here as they go live
// (and as a card in the "Detailed comparisons" section of pages/Compare.jsx).
const NAV_COMPARE = [
  { label: "All comparisons",       href: "/compare",                     desc: "Feature table: Leadrat, Sell.Do, Kylas", icon: GitCompare },
  { label: "Arthaleads vs Sell.Do", href: "/compare/sell-do-alternative", desc: "Sell.Do pricing and features compared",  icon: Scale },
  { label: "Arthaleads vs Leadrat", href: "/compare/leadrat-alternative", desc: "Leadrat pricing and features compared",  icon: Scale },
  { label: "Arthaleads vs Kylas",   href: "/compare/kylas-alternative",   desc: "Kylas pricing and features compared",    icon: Scale },
];

const NAV_COMPANY = [
  { label: "Careers",       href: "/careers",  desc: "Join the Arthaleads team",   icon: Briefcase, badge: "Hiring" },
  { label: "Security",      href: "/security", desc: "How we protect your data",   icon: Shield },
  { label: "Refer & Earn",  href: "/refer",    desc: "Give a month, get a month",  icon: Gift, badge: "Earn" },
];

// Phone and tablet menu (Card Nav): the same pages as the desktop bar, grouped
// into three cards so 20 links fit without a long scrolling list.
const MOBILE_CARDS = [
  { label: "Product", description: "Everything a property sales team needs.", links: [
    { label: "Features", href: "/features" }, { label: "Pricing", href: "/pricing" },
    { label: "WhatsApp CRM", href: "/whatsapp-crm" }, { label: "AI CRM", href: "/ai-crm" },
    { label: "Builder CRM", href: "/builder-crm" }, { label: "Android app", href: "/download-app" },
  ] },
  { label: "Compare", description: "See how Arthaleads stacks up.", links: [
    { label: "All comparisons", href: "/compare" }, { label: "vs Sell.Do", href: "/compare/sell-do-alternative" },
    { label: "vs Leadrat", href: "/compare/leadrat-alternative" }, { label: "vs Kylas", href: "/compare/kylas-alternative" },
  ] },
  { label: "Company", description: "Learn, get help and get in touch.", links: [
    { label: "About us", href: "/about-us" }, { label: "Blog", href: "/blog" }, { label: "Help guide", href: "/help-guide" },
    { label: "Careers", href: "/careers" }, { label: "Security", href: "/security" }, { label: "Contact", href: "/contact" },
    { label: "Login", href: CRM_LOGIN_URL },
  ] },
];

// Card Nav renders links through this: router links inside the site, plain
// links (new tab) for the CRM app.
function NavAnchor({ href, children, ...rest }) {
  if (/^https?:/.test(href)) return <a href={href} {...CRM_LINK_PROPS} {...rest}>{children}</a>;
  return <Link to={href} {...rest}>{children}</Link>;
}

// ── Reusable dropdown panel ───────────────────────────────────────────────────
// Always rendered (hidden when closed) so its links are in the prerendered HTML for crawlers.
function DropdownPanel({ open, items, onClose, isDark, width = 268 }) {
  const bg     = isDark ? "rgba(18,18,30,0.99)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";
  const shadow = isDark
    ? "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)"
    : "0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px #e5e7eb";
  const itemText    = isDark ? "rgba(255,255,255,0.75)" : "#111827";
  const itemDesc    = isDark ? "rgba(255,255,255,0.35)" : "#6b7280";
  const iconBase    = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const iconColor   = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const hoverBg     = isDark ? "rgba(255,255,255,0.06)" : "#f9fafb";

  return (
    <div
      hidden={!open}
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
                    background: "rgba(255,107,0,0.12)", color: "var(--brand-text)",
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
  const [cmpOpen, setCmpOpen]       = useState(false);
  const resRef  = useRef(null);
  const compRef = useRef(null);
  const cmpRef  = useRef(null);
  const location = useLocation();
  const isHome   = location.pathname === "/";

  // Mobile menu: close on navigation; hide the chat launcher while it is open.
  useEffect(() => { setMobileOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    document.documentElement.classList.add("menu-open");   // hides the chat launcher (styles.css)
    return () => document.documentElement.classList.remove("menu-open");
  }, [mobileOpen]);

  const textMuted  = isDark ? "rgba(255,255,255,0.70)" : "#4b5563";
  const textActive = isDark ? "#ffffff" : "#111827";

  // Solid, not blurred: backdrop-filter on a fixed bar made Android Chrome paint blank tiles on scroll.
  const scrolledBg     = isDark ? "rgba(10,11,16,0.97)" : "rgba(255,255,255,0.97)";
  // No bottom border: a 1px line read as a bright stripe on dark pages. A soft shadow separates the bar instead.
  const scrolledShadow = isDark ? "0 12px 32px -18px rgba(0,0,0,0.9)" : "0 10px 28px -18px rgba(15,18,34,0.28)";
  const mobileBg       = isDark ? "rgba(13,13,26,0.98)" : "rgba(255,255,255,0.98)";
  const catLabel       = isDark ? "rgba(255,255,255,0.30)" : "#6b7280";

  // Checked once on mount too: a page opened part-way down (refresh, back
  // button, or the live page replacing the prerendered copy after the visitor
  // scrolled) fires no scroll event, and the bar stayed see-through over the text.
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (resRef.current  && !resRef.current.contains(e.target))  setResOpen(false);
      if (compRef.current && !compRef.current.contains(e.target)) setCompOpen(false);
      if (cmpRef.current  && !cmpRef.current.contains(e.target))  setCmpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function closeAll() { setResOpen(false); setCompOpen(false); setCmpOpen(false); }

  function NavLink({ id, label, href }) {
    const style = { fontSize: 14, fontWeight: 500, color: textMuted, transition: "color 0.2s", whiteSpace: "nowrap" };
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
    ? { background: scrolledBg, boxShadow: scrolledShadow }
    : { background: mobileOpen ? mobileBg : "transparent" };

  return (
    <nav className="public-nav fixed top-0 left-0 right-0 z-50 transition-all duration-300" style={navStyle}>
      {/* Desktop bar (phones and tablets use the Card Nav below) */}
      <div className="hidden xl:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
              {/* The full lockup, in the variant that suits the theme. The
                  wordmark is near-black in one and white in the other, so a
                  single file would disappear on one of the two backgrounds. */}
              <img
                src={isDark ? "/logo-lockup-dark.png" : "/logo-lockup.png"}
                width={isDark ? 1515 : 1574} height={isDark ? 459 : 471}
                alt="Arthaleads — Turning Opportunities Into Value"
                className="h-9 w-auto"
              />
            </Link>
            <a
              href="https://www.vistrow.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Arthaleads is a product of Vistrow Technologies"
              // A quiet maker's credit, not a second brand: about half the
              // height of the Arthaleads lockup, no divider, greyed until hovered.
              // Side by side at full size the two read as a partnership.
              className="group flex items-center gap-1 self-end mb-1.5 opacity-90 hover:opacity-100 transition-opacity"
            >
              <span className="text-[10px] font-medium" style={{ color: textMuted }}>by</span>
              <span className="text-[12px] sm:text-[13px] font-semibold tracking-tight leading-none" style={{ color: textMuted }}>Vistrow</span>
            </a>
          </div>

          {/* Desktop nav links */}
          <div className="hidden xl:flex items-center gap-6">
            <NavLink id="hero"        label="Home" />
            <NavLink href="/features" label="Features" />
            <NavLink href="/about-us" label="About Us" />
            <NavLink href="/pricing"  label="Pricing" />

            {/* Compare dropdown */}
            <div className="relative" ref={cmpRef}>
              <DropdownTrigger
                label="Compare"
                isOpen={cmpOpen}
                onClick={() => { setCmpOpen(o => !o); setResOpen(false); setCompOpen(false); }}
                textMuted={textMuted}
                textActive={textActive}
              />
              <DropdownPanel
                open={cmpOpen}
                items={NAV_COMPARE}
                onClose={() => setCmpOpen(false)}
                isDark={isDark}
                width={276}
              />
            </div>

            {/* Resources dropdown */}
            <div className="relative" ref={resRef}>
              <DropdownTrigger
                label="Resources"
                isOpen={resOpen}
                onClick={() => { setResOpen(o => !o); setCompOpen(false); setCmpOpen(false); }}
                textMuted={textMuted}
                textActive={textActive}
              />
              <DropdownPanel
                open={resOpen}
                items={NAV_RESOURCES}
                onClose={() => setResOpen(false)}
                isDark={isDark}
                width={272}
              />
            </div>

            {/* Company dropdown */}
            <div className="relative" ref={compRef}>
              <DropdownTrigger
                label="Company"
                isOpen={compOpen}
                onClick={() => { setCompOpen(o => !o); setResOpen(false); setCmpOpen(false); }}
                textMuted={textMuted}
                textActive={textActive}
              />
              <DropdownPanel
                open={compOpen}
                items={NAV_COMPANY}
                onClose={() => setCompOpen(false)}
                isDark={isDark}
                width={248}
              />
            </div>

            <NavLink href="/contact" label="Contact" />
          </div>

          {/* Desktop CTAs */}
          <div className="hidden xl:flex items-center gap-3">
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
              style={{ color: textMuted }}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <a href={CRM_LOGIN_URL} {...CRM_LINK_PROPS}
              className="text-sm font-medium transition-colors px-4 py-2 whitespace-nowrap"
              style={{ color: textMuted }}
              onMouseEnter={e => (e.currentTarget.style.color = textActive)}
              onMouseLeave={e => (e.currentTarget.style.color = textMuted)}
            >
              Login
            </a>
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="bg-[color:var(--brand-btn)] hover:bg-[color:var(--brand-btn-hover)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              Start 14-day free trial
            </a>
          </div>

        </div>
      </div>

      {/* Phone and tablet menu: React Bits Card Nav, solid surface (no backdrop blur on phones). */}
      <div className="xl:hidden px-3 pt-2.5">
        <CardNav
          theme={isDark ? "dark" : "light"}
          surface="solid"
          maxWidth={760}
          cardHeight={0}
          accentColor="#cc4b00"
          menuLabel={false}
          intro={false}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          linkComponent={NavAnchor}
          logo={<img src={isDark ? "/logo-lockup-dark.png" : "/logo-lockup.png"} alt="" width={isDark ? 1515 : 1574} height={isDark ? 459 : 471} />}
          logoHref="/"
          logoAlt="Arthaleads home"
          cta={{ label: "Start free trial", href: CRM_SIGNUP_URL }}
          items={MOBILE_CARDS}
          barEnd={
            <button type="button" onClick={toggle} className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ color: textMuted }} aria-label="Toggle theme">
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          }
          style={{
            "--cn-logo": "30px",
            ...(isDark
              ? { "--cn-solid": "#15171f", "--cn-panel": "#15171f", "--cn-tile": "linear-gradient(180deg,#1d2029 0%,#191b24 100%)" }
              : { "--cn-solid": "#ffffff", "--cn-panel": "#ffffff", "--cn-tile": "linear-gradient(180deg,#faf7f3 0%,#f6f1eb 100%)" }),
          }}
        />
      </div>
    </nav>
  );
}

export default function PublicNav({ onScrollTo }) {
  return (
    <>
      <ScrollProgress />
      <NavInner onScrollTo={onScrollTo} />
      <IdleChatBot />
    </>
  );
}
