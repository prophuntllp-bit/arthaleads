import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown, Sun, Moon,
  BookOpen, Zap, HelpCircle, PlayCircle,
  Building2, Briefcase, Puzzle, Info, Mail,
  Code2, GitCompare, Shield, Gift,
  Smartphone, Scale, Bot, CalendarCheck2,
} from "lucide-react";
import WhatsAppLogo from "./WhatsAppLogo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { CRM_LOGIN_URL, CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { ScrollProgress } from "./motion/Motion";
import CardNav from "./site/reactbits/CardNav";
import WhatsAppWidget from "./WhatsAppWidget";

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

// Desktop mega menus. Each menu is a list of groups; `col` puts a group in a
// panel column (groups sharing a column stack), `grid: 2` lays its items 2x2.
// Case studies is hidden from the menus until a real one is published (the
// route and page stay).
const NAV_RESOURCES = [
  { title: "Solutions", col: 0, items: [
    { label: "WhatsApp CRM", href: "/whatsapp-crm", desc: "AI replies and one team inbox", icon: WhatsAppLogo },
    { label: "AI CRM",       href: "/ai-crm",       desc: "What the AI does for your sales team",    icon: Bot },
    { label: "Builder CRM",  href: "/builder-crm",  desc: "Project-wise sales for developers",       icon: Building2 },
  ] },
  { title: "Learn", col: 1, items: [
    { label: "Blog",            href: "/blog",            desc: "Guides and market notes", icon: BookOpen },
    { label: "Product updates", href: "/product-updates", desc: "What is new in Arthaleads",             icon: Zap },
    { label: "Help guide",      href: "/help-guide",      desc: "Tutorials and FAQs",                    icon: HelpCircle },
    { label: "Product tour",    href: "/product-tour",    desc: "The app in a 2 minute film",            icon: PlayCircle },
  ] },
  { title: "Apps and developers", col: 1, items: [
    { label: "Download app",     href: "/download-app",     desc: "Arthaleads on your Android phone", icon: Smartphone },
    { label: "WordPress plugin", href: "/wordpress-plugin", desc: "Capture leads from any WP form",   icon: Puzzle },
    { label: "API docs",         href: "/api-docs",         desc: "Integrate with the REST API",      icon: Code2 },
  ] },
];

// One entry per comparison page. Add more here as they go live
// (and as a card in the "Detailed comparisons" section of pages/Compare.jsx).
const NAV_COMPARE = [
  { title: "Compare Arthaleads", col: 0, grid: 2, items: [
    { label: "All comparisons",       href: "/compare",                     desc: "Leadrat, Sell.Do and Kylas", icon: GitCompare },
    { label: "Arthaleads vs Sell.Do", href: "/compare/sell-do-alternative", desc: "Pricing and features compared",  icon: Scale },
    { label: "Arthaleads vs Leadrat", href: "/compare/leadrat-alternative", desc: "Pricing and features compared",  icon: Scale },
    { label: "Arthaleads vs Kylas",   href: "/compare/kylas-alternative",   desc: "Pricing and features compared",    icon: Scale },
  ] },
];

const NAV_COMPANY = [
  { title: "Company", col: 0, items: [
    { label: "About us", href: "/about-us", desc: "Who we are and why we built it", icon: Info },
    { label: "Careers",  href: "/careers",  desc: "Join the Arthaleads team",       icon: Briefcase, badge: "Hiring" },
    { label: "Security", href: "/security", desc: "How we protect your data",       icon: Shield },
    { label: "Contact",  href: "/contact",  desc: "Call, WhatsApp or email us",     icon: Mail },
  ] },
  { title: "Get started", col: 1, items: [
    { label: "Book a demo",    href: "/book-demo", desc: "30 minutes, on your own leads", icon: CalendarCheck2 },
    { label: "Refer and earn", href: "/refer",     desc: "Give a month, get a month",     icon: Gift, badge: "Earn" },
  ] },
];

const MEGA_MENUS = [
  { id: "compare",   label: "Compare",   groups: NAV_COMPARE,   width: 580 },
  { id: "resources", label: "Resources", groups: NAV_RESOURCES, width: 620 },
  { id: "company",   label: "Company",   groups: NAV_COMPANY,   width: 580 },
];

// Phone and tablet menu (Card Nav): the same pages as the desktop bar, grouped
// into four cards (2x2 on tablets, stacked on phones).
const MOBILE_CARDS = [
  { label: "Product", description: "Everything a property sales team needs.", links: [
    { label: "Features", href: "/features" }, { label: "Pricing", href: "/pricing" },
    { label: "WhatsApp CRM", href: "/whatsapp-crm" }, { label: "AI CRM", href: "/ai-crm" },
    { label: "Builder CRM", href: "/builder-crm" },
  ] },
  { label: "Compare", description: "See how Arthaleads stacks up.", links: [
    { label: "All comparisons", href: "/compare" }, { label: "vs Sell.Do", href: "/compare/sell-do-alternative" },
    { label: "vs Leadrat", href: "/compare/leadrat-alternative" }, { label: "vs Kylas", href: "/compare/kylas-alternative" },
  ] },
  { label: "Resources", description: "Learn, get the app, connect your tools.", links: [
    { label: "Blog", href: "/blog" }, { label: "Help guide", href: "/help-guide" },
    { label: "Product updates", href: "/product-updates" }, { label: "Product tour", href: "/product-tour" },
    { label: "Download app", href: "/download-app" }, { label: "WordPress plugin", href: "/wordpress-plugin" },
    { label: "API docs", href: "/api-docs" }, { label: "Refer and earn", href: "/refer" },
  ] },
  { label: "Company", description: "Get in touch or get started.", links: [
    { label: "Book a demo", href: "/book-demo" }, { label: "About us", href: "/about-us" },
    { label: "Careers", href: "/careers" }, { label: "Security", href: "/security" },
    { label: "Contact", href: "/contact" }, { label: "Login", href: CRM_LOGIN_URL },
  ] },
];

// Card Nav renders links through this: router links inside the site, plain
// links (new tab) for the CRM app.
function NavAnchor({ href, children, ...rest }) {
  if (/^https?:/.test(href)) return <a href={href} {...CRM_LINK_PROPS} {...rest}>{children}</a>;
  return <Link to={href} {...rest}>{children}</Link>;
}

const VIEWPORT_GUTTER = 16;
const HOVER_CLOSE_MS = 120;

// ── Desktop mega menu ─────────────────────────────────────────────────────────
// Opens on hover (mouse) and on click; closes 120ms after the pointer leaves so
// the pointer can cross into the panel. The panel is always rendered (hidden
// when closed) so its links are in the prerendered HTML for crawlers.
function MegaMenu({ id, label, groups, width, open, onHoverOpen, onHoverClose, onToggle, onClose }) {
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const [left, setLeft] = useState(0);
  const panelId = `mega-${id}`;

  // Centre the panel under its trigger, then nudge it back inside the viewport.
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let x = r.left + r.width / 2 - width / 2;
    x = Math.max(VIEWPORT_GUTTER, Math.min(x, vw - VIEWPORT_GUTTER - width));
    setLeft(Math.round(x - r.left));
  }, [open, width]);

  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el || !el.animate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 160, easing: "cubic-bezier(0.22,1,0.36,1)" });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      onClose();
      btnRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const cols = [];
  groups.forEach((g) => { (cols[g.col || 0] ||= []).push(g); });

  return (
    <div
      ref={wrapRef}
      className="relative"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") onHoverOpen(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") onHoverClose(); }}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        className={`flex items-center gap-1 py-2 text-sm font-medium whitespace-nowrap bg-transparent border-0 cursor-pointer transition-colors hover:text-[color:var(--site-ink)] ${open ? "text-[color:var(--site-ink)]" : "text-[color:var(--site-text)]"}`}
      >
        {label}
        <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {/* The transparent top padding bridges the gap to the trigger, so the hover holds. */}
      <div id={panelId} hidden={!open} style={{ position: "absolute", top: "100%", left, width, paddingTop: 14, zIndex: 100 }}>
        <div
          ref={panelRef}
          className="grid rounded-2xl p-2.5"
          style={{
            gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
            columnGap: 8,
            background: "var(--site-card)",
            border: "1px solid var(--site-line-strong)",
            boxShadow: "var(--site-shadow-lg)",
          }}
        >
          {cols.map((colGroups, ci) => (
            <div key={ci} className="flex flex-col gap-2 min-w-0">
              {colGroups.map((g) => {
                const titleId = `${panelId}-${g.title.replace(/\W+/g, "-").toLowerCase()}`;
                return (
                  <div key={g.title}>
                    <p id={titleId} className="px-3 pt-2 pb-1 text-[13px] font-semibold leading-5" style={{ color: "var(--site-muted)" }}>{g.title}</p>
                    <ul aria-labelledby={titleId} className={g.grid === 2 ? "grid grid-cols-2 gap-x-2" : ""} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {g.items.map((l) => <MegaItem key={l.href} item={l} onClose={onClose} />)}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MegaItem({ item, onClose }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.href}
        onClick={onClose}
        className="group flex items-center gap-3 min-h-[52px] px-3 py-2 rounded-xl no-underline transition-colors hover:bg-[color:var(--site-chip)] focus-visible:bg-[color:var(--site-chip)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--brand-text)]"
      >
        <span
          aria-hidden="true"
          className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center transition-colors bg-[color:var(--site-chip)] text-[color:var(--site-muted)] group-hover:bg-[rgba(255,107,0,0.12)] group-hover:text-[color:var(--brand-text)] group-focus-visible:bg-[rgba(255,107,0,0.12)] group-focus-visible:text-[color:var(--brand-text)]"
        >
          <Icon style={{ width: 16, height: 16 }} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold leading-5 text-[color:var(--site-ink)] transition-colors group-hover:text-[color:var(--brand-text)] group-focus-visible:text-[color:var(--brand-text)]">{item.label}</span>
            {item.badge && (
              <span className="text-xs font-bold leading-4 px-1.5 rounded-full" style={{ background: "rgba(255,107,0,0.12)", color: "var(--brand-text)" }}>{item.badge}</span>
            )}
          </span>
          <span className="block text-xs leading-4 mt-0.5" style={{ color: "var(--site-muted)" }}>{item.desc}</span>
        </span>
      </Link>
    </li>
  );
}

// A plain top-level link in the desktop bar.
function BarLink({ href, label }) {
  return (
    <Link to={href} className="py-2 text-sm font-medium whitespace-nowrap transition-colors text-[color:var(--site-text)] hover:text-[color:var(--site-ink)]">{label}</Link>
  );
}

// ── Main nav ──────────────────────────────────────────────────────────────────
function NavInner() {
  const { isDark, toggle } = usePublicTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [openKey, setOpenKey]       = useState(null);   // which desktop mega menu is open
  const openedByHover = useRef(false);
  const pinned = useRef(false);   // a click pins a menu open until Escape, an outside click or another menu
  const closeTimer = useRef(0);
  const linksRef = useRef(null);
  const location = useLocation();

  // Navigation closes every menu.
  useEffect(() => { setMobileOpen(false); pinned.current = false; setOpenKey(null); }, [location.pathname, location.hash]);

  // Phone menu open: hide the chat launcher (styles.css .menu-open) and lock the page scroll.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.overflow, body: body.style.overflow };
    html.classList.add("menu-open");
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.classList.remove("menu-open");
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
    };
  }, [mobileOpen]);

  // Checked once on mount too: a page opened part-way down (refresh, back
  // button, or the live page replacing the prerendered copy after the visitor
  // scrolled) fires no scroll event, and the bar stayed see-through over the text.
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Desktop menus: a click outside the links closes them.
  useEffect(() => {
    if (!openKey) return undefined;
    const handler = (e) => { if (linksRef.current && !linksRef.current.contains(e.target)) { pinned.current = false; setOpenKey(null); } };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [openKey]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const closeMenus = useCallback(() => { window.clearTimeout(closeTimer.current); pinned.current = false; setOpenKey(null); }, []);

  function hoverOpen(id) {
    window.clearTimeout(closeTimer.current);
    if (openKey !== id) { openedByHover.current = true; pinned.current = false; setOpenKey(id); }
  }
  function hoverClose(id) {
    window.clearTimeout(closeTimer.current);
    if (pinned.current) return;
    closeTimer.current = window.setTimeout(() => setOpenKey((k) => (k === id ? null : k)), HOVER_CLOSE_MS);
  }
  // A click right after hover-opening keeps the menu open (the visitor wanted it open);
  // otherwise a click toggles.
  function toggleMenu(id) {
    window.clearTimeout(closeTimer.current);
    if (openKey === id && openedByHover.current) { openedByHover.current = false; pinned.current = true; return; }
    openedByHover.current = false;
    pinned.current = openKey !== id;
    setOpenKey(openKey === id ? null : id);
  }

  // Solid, not blurred: backdrop-filter on a fixed bar made Android Chrome paint blank tiles on scroll.
  // No bottom border: a 1px line read as a bright stripe on dark pages. A soft shadow separates the bar instead.
  // The fill sits on the desktop bar itself (not <nav>): styles.css makes <nav> transparent below 1280px.
  const barStyle = scrolled
    ? { background: isDark ? "rgba(10,11,16,0.97)" : "rgba(255,255,255,0.97)", boxShadow: isDark ? "0 12px 32px -18px rgba(0,0,0,0.9)" : "0 10px 28px -18px rgba(15,18,34,0.28)", pointerEvents: "auto" }
    : { background: "transparent", pointerEvents: "auto" };

  return (
    <nav className="public-nav fixed top-0 left-0 right-0 z-50">
      {/* Desktop bar, from 1024px (phones and tablets use the Card Nav below) */}
      <div className="hidden lg:block transition-[background-color,box-shadow] duration-300" style={barStyle}>
        <div className="site-container">
          <div className="flex items-center justify-between gap-4 h-20">

            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0">
              {/* The full lockup, in the variant that suits the theme. The
                  wordmark is near-black in one and white in the other, so a
                  single file would disappear on one of the two backgrounds. */}
              <img
                src={isDark ? "/logo-lockup-dark.webp" : "/logo-lockup.webp"}
                srcSet={isDark ? "/logo-lockup-dark-240.webp 240w, /logo-lockup-dark.webp 420w" : "/logo-lockup-240.webp 240w, /logo-lockup.webp 420w"} sizes="120px"
                width={isDark ? 1515 : 1574} height={isDark ? 459 : 471}
                alt="Arthaleads — Turning Opportunities Into Value"
                className="h-8 xl:h-9 w-auto"
              />
            </Link>

            {/* Desktop nav links */}
            <div ref={linksRef} className="flex items-center gap-4 xl:gap-6">
              <BarLink href="/features" label="Features" />
              <BarLink href="/pricing"  label="Pricing" />
              {MEGA_MENUS.map((m) => (
                <MegaMenu
                  key={m.id}
                  {...m}
                  open={openKey === m.id}
                  onHoverOpen={() => hoverOpen(m.id)}
                  onHoverClose={() => hoverClose(m.id)}
                  onToggle={() => toggleMenu(m.id)}
                  onClose={closeMenus}
                />
              ))}
              <BarLink href="/about-us" label="About Us" />
              <BarLink href="/contact"  label="Contact" />
            </div>

            {/* Desktop CTAs */}
            <div className="flex items-center gap-1 xl:gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={toggle}
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-[color:var(--site-chip)] text-[color:var(--site-text)]"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <a href={CRM_LOGIN_URL} {...CRM_LINK_PROPS}
                className="text-sm font-medium transition-colors px-2.5 xl:px-4 py-2 whitespace-nowrap text-[color:var(--site-text)] hover:text-[color:var(--site-ink)]"
              >
                Login
              </a>
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
                className="bg-[color:var(--brand-btn)] hover:bg-[color:var(--brand-btn-hover)] text-white text-sm font-semibold px-4 xl:px-5 py-2.5 rounded-xl whitespace-nowrap transition-[background-color,box-shadow,transform] duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
              >
                Start <span className="hidden xl:inline">14-day </span>free trial
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* Phone and tablet menu: dimmed backdrop (tap closes) behind the Card Nav. */}
      <div
        aria-hidden="true"
        className="lg:hidden fixed inset-0 transition-opacity duration-300"
        style={{ background: "rgba(10,11,16,0.45)", opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? "auto" : "none" }}
        onClick={() => setMobileOpen(false)}
      />
      {/* React Bits Card Nav, solid surface (no backdrop blur on phones). Gutter matches the page container. */}
      <div className="lg:hidden relative px-4 sm:px-6 pt-2.5">
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
          logo={<img src={isDark ? "/logo-lockup-dark.webp" : "/logo-lockup.webp"} srcSet={isDark ? "/logo-lockup-dark-240.webp 240w, /logo-lockup-dark.webp 420w" : "/logo-lockup-240.webp 240w, /logo-lockup.webp 420w"} sizes="120px" alt="" width={isDark ? 1515 : 1574} height={isDark ? 459 : 471} />}
          logoHref="/"
          logoAlt="Arthaleads home"
          cta={{ label: "Start free trial", href: CRM_SIGNUP_URL }}
          items={MOBILE_CARDS}
          barEnd={
            <button type="button" onClick={toggle} className="w-11 h-11 flex items-center justify-center rounded-xl text-[color:var(--site-text)]" aria-label="Toggle theme">
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          }
          style={{
            "--cn-logo": "30px",
            "--cn-top": "10px",
            ...(isDark
              ? { "--cn-solid": "#15171f", "--cn-panel": "#15171f", "--cn-tile": "linear-gradient(180deg,#1d2029 0%,#191b24 100%)" }
              : { "--cn-solid": "#ffffff", "--cn-panel": "#ffffff", "--cn-tile": "linear-gradient(180deg,#faf7f3 0%,#f6f1eb 100%)" }),
          }}
        />
      </div>
    </nav>
  );
}

export default function PublicNav() {
  return (
    <>
      <ScrollProgress />
      <NavInner />
      <WhatsAppWidget />
      <IdleChatBot />
    </>
  );
}
