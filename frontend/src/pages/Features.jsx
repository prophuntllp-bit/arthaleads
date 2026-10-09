// pages/Features.jsx - the full product feature catalogue.
//
// Organised by the job a sales team is doing, in order. A sticky progress bar
// follows you down the page; each workflow shows the real screen it happens on
// (a short clip that plays when scrolled to) beside its heading, with the
// individual features as cards underneath.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { FEATURES, FEATURE_GROUPS } from "../data/features";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

// The screen that best shows each workflow. "control" has none: it is about trust, not a screen.
const SCREEN = {
  capture:    { id: "lead",        path: "leads" },
  prioritise: { id: "dashboard",   path: "dashboard" },
  talk:       { id: "inbox",       path: "conversations" },
  projects:   { id: "project",     path: "projects" },
  close:      { id: "pipeline",    path: "pipeline" },
  team:       { id: "performance", path: "performance" },
};

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** True once the element has been on screen (stays true). */
function useReveal(margin = "0px 0px -12% 0px") {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: margin, threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, shown];
}

/** The product screen in a browser frame; plays its clip only while on screen. */
function Screen({ spec, isDark }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const [near, setNear] = useState(false);   // close enough to start downloading
  const [live, setLive] = useState(false);   // mostly on screen: play
  const frameBg = isDark ? "#16161f" : "#f6f3ef";
  const frameBd = isDark ? "rgba(255,255,255,0.08)" : "#e9e3db";
  const urlBg   = isDark ? "rgba(255,255,255,0.06)" : "#ffffff";
  const urlText = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const reduce = prefersReducedMotion();
    const save = navigator.connection?.saveData;
    const a = new IntersectionObserver(([e]) => { if (e.isIntersecting && !reduce && !save) setNear(true); }, { rootMargin: "400px 0px" });
    const b = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.4 });
    a.observe(el); b.observe(el);
    return () => { a.disconnect(); b.disconnect(); };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (live) v.play().catch(() => {}); else v.pause();
  }, [live, near]);

  return (
    <div ref={wrapRef} className="rounded-[20px] sm:rounded-[24px] overflow-hidden"
      style={{
        background: frameBg, border: `1px solid ${frameBd}`,
        boxShadow: isDark ? "0 40px 80px -28px rgba(0,0,0,0.7)" : "0 1px 2px rgba(17,24,39,0.04), 0 36px 70px -30px rgba(120,60,10,0.32)",
      }}>
      <div className="flex items-center gap-3 px-4 h-9" style={{ borderBottom: `1px solid ${frameBd}` }}>
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex-1 flex justify-center min-w-0">
          <span className="text-[11px] px-3 py-0.5 rounded-md truncate max-w-[75%]" style={{ background: urlBg, color: urlText }}>app.arthaleads.com/{spec.path}</span>
        </span>
        <span className="w-[46px]" aria-hidden="true" />
      </div>
      <div className="relative" style={{ aspectRatio: "16 / 9" }}>
        <img src={`/tour/${spec.id}.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-top" />
        {near && (
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover object-top" poster={`/tour/${spec.id}.webp`}
            muted loop playsInline preload="auto" aria-hidden="true">
            <source src={`/tour/${spec.id}.mp4`} type="video/mp4" />
            <source src={`/tour/${spec.id}.webm`} type="video/webm" />
          </video>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ f, i, t }) {
  const [ref, shown] = useReveal();
  const Icon = f.icon;
  return (
    <article ref={ref}
      className="group relative h-full rounded-[22px] border p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl"
      style={{
        background: t.card, borderColor: t.cardBorder,
        opacity: shown ? 1 : 0, transform: shown ? undefined : "translateY(18px)",
        transitionDelay: shown ? `${(i % 3) * 70}ms` : "0ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${f.color}66`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.cardBorder; }}>
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" style={{ background: `${f.color}18` }}>
        <Icon className="w-5 h-5" style={{ color: f.color }} />
      </div>
      <h3 className="font-bold text-[17px] mb-2 leading-snug" style={{ color: t.heading }}>{f.title}</h3>
      <p className="text-[15px] leading-relaxed" style={{ color: t.body }}>{f.desc}</p>
    </article>
  );
}

function Workflow({ group, index, isDark, t }) {
  const items = FEATURES.filter((f) => f.group === group.id);
  const spec = SCREEN[group.id];
  const flip = index % 2 === 1;
  const [textRef, textShown] = useReveal();
  const [shotRef, shotShown] = useReveal();
  const reveal = (shown, from) => ({ opacity: shown ? 1 : 0, transform: shown ? "none" : from, transition: "opacity 700ms ease, transform 700ms cubic-bezier(.2,.7,.2,1)" });
  // A six-column grid so every row is full: 4 cards = 2 + 2, 5 = 2 + 3, 6 = 3 + 3, 3 = 3.
  const spanFor = (i, n) => (n === 5 ? (i < 2 ? "lg:col-span-3" : "lg:col-span-2") : n === 4 ? "lg:col-span-3" : "lg:col-span-2");

  return (
    <section id={`group-${group.id}`} aria-labelledby={`group-${group.id}-title`} className="scroll-mt-40 py-14 lg:py-20 overflow-x-clip"
      style={{ borderTop: index === 0 ? "none" : `1px solid ${t.rule}` }}>
      <div className={`grid ${spec ? "lg:grid-cols-2 items-center" : "max-w-3xl mx-auto text-center"} gap-8 lg:gap-16 mb-10 lg:mb-14`}>
        <div ref={textRef} style={reveal(textShown, flip ? "translateX(24px)" : "translateX(-24px)")} className={flip ? "lg:order-2" : ""}>
          <div className={`flex items-center gap-3 mb-4 ${spec ? "" : "justify-center"}`}>
            <span className="w-9 h-9 rounded-full bg-[#ff6b00] text-white text-sm font-bold flex items-center justify-center tabular-nums">{index + 1}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b00]">{group.label}</span>
          </div>
          <h2 id={`group-${group.id}-title`} className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black leading-[1.1] tracking-tight mb-4" style={{ color: t.heading, textWrap: "balance" }}>
            {group.title}
          </h2>
          <p className={`text-base sm:text-lg leading-relaxed ${spec ? "mb-6 max-w-xl" : "max-w-xl mx-auto"}`} style={{ color: t.body }}>{group.blurb}</p>
          {spec && (
            <ul className="space-y-2.5">
              {items.slice(0, 3).map((f) => (
                <li key={f.title} className="flex items-start gap-3 text-[15px]" style={{ color: t.heading }}>
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-[#ff6b00]/12 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-[#ff6b00]" strokeWidth={3} /></span>
                  <span className="font-medium">{f.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {spec && (
          <div ref={shotRef} style={reveal(shotShown, flip ? "translateX(-24px) scale(0.98)" : "translateX(24px) scale(0.98)")} className={flip ? "lg:order-1" : ""}>
            <Screen spec={spec} isDark={isDark} />
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-5">
        {items.map((f, i) => (
          <div key={f.title} className={spanFor(i, items.length)}><FeatureCard f={f} i={i} t={t} /></div>
        ))}
      </div>
    </section>
  );
}

export default function Features() {
  const { isDark } = usePublicTheme();
  const [active, setActive] = useState(FEATURE_GROUPS[0].id);
  const navRef = useRef(null);

  useSEO({
    title: "Features - Arthaleads Real Estate CRM",
    description: "Every Arthaleads feature: lead capture from ads, portals and WhatsApp, AI lead scoring, WhatsApp campaigns and consent, call intelligence, projects, bookings and invoices, Meta Conversions API, attendance and tasks.",
    canonical: "https://www.arthaleads.com/features",
  });

  const t = {
    bg:        isDark ? "#0d0d1a" : "#ffffff",
    heading:   isDark ? "#ffffff" : "#111827",
    body:      isDark ? "rgba(255,255,255,0.60)" : "#5b6170",
    rule:      isDark ? "rgba(255,255,255,0.08)" : "#ece8e3",
    card:      isDark ? "rgba(255,255,255,0.035)" : "#ffffff",
    cardBorder:isDark ? "rgba(255,255,255,0.09)" : "#ebe5dd",
    bar:       isDark ? "rgba(13,13,26,0.86)" : "rgba(255,255,255,0.88)",
  };

  // Which workflow is on screen drives the progress bar.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id.replace("group-", ""));
    }, { rootMargin: "-30% 0px -60% 0px" });
    FEATURE_GROUPS.forEach((g) => { const el = document.getElementById(`group-${g.id}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  // Keep the active step in view where the bar scrolls sideways (phones).
  useEffect(() => {
    const bar = navRef.current;
    const el = bar?.querySelector(`[data-id="${active}"]`);
    if (!bar || !el || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const jump = (id) => document.getElementById(`group-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const activeIndex = FEATURE_GROUPS.findIndex((g) => g.id === active);

  return (
    <div style={{ background: t.bg, minHeight: "100vh" }}>
      <PublicNav />

      {/* ── Hero ── */}
      <header className="relative overflow-hidden pt-28 pb-12 lg:pt-36 lg:pb-16" style={{ background: isDark ? "#0d0d1a" : "linear-gradient(180deg,#fff7f0 0%,#ffffff 100%)" }}>
        <div className="absolute -top-28 right-[-8%] w-[560px] h-[560px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,107,0,0.14), transparent 65%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b00]">{FEATURES.length} features, one workspace</span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.07] tracking-tight mt-4 mb-5 max-w-4xl mx-auto" style={{ color: t.heading, textWrap: "balance" }}>
            From the first enquiry to the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">paid invoice</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-2xl mx-auto mb-8" style={{ color: t.body }}>
            Built for Indian real estate teams, from small channel partner offices to large developer sales floors.
            Here is everything ArthaLeads does, in the order your team uses it.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-orange-500/30 hover:-translate-y-0.5 transition-all">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </a>
            <Link to="/pricing" className="inline-flex items-center px-7 py-3.5 rounded-2xl border font-medium transition-colors hover:border-[#ff6b00]"
              style={{ color: t.heading, borderColor: t.cardBorder }}>See pricing</Link>
          </div>
        </div>
      </header>

      {/* ── Sticky workflow progress ── */}
      <div className="sticky top-16 lg:top-20 z-30 backdrop-blur-xl" style={{ background: t.bar, borderTop: `1px solid ${t.rule}`, borderBottom: `1px solid ${t.rule}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav ref={navRef} aria-label="Workflow steps" className="relative flex items-center gap-1 overflow-x-auto py-3 lg:justify-center" style={{ scrollbarWidth: "none" }}>
            {FEATURE_GROUPS.map((g, i) => {
              const on = g.id === active;
              const done = i < activeIndex;
              return (
                <div key={g.id} className="flex items-center shrink-0">
                  <button type="button" data-id={g.id} onClick={() => jump(g.id)} aria-current={on ? "step" : undefined}
                    className="flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
                    style={{ background: on ? (isDark ? "rgba(255,107,0,0.16)" : "#fff0e3") : "transparent", color: on ? "#e85d04" : t.body }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums transition-colors"
                      style={{ background: on || done ? "#ff6b00" : (isDark ? "rgba(255,255,255,0.10)" : "#efeae3"), color: on || done ? "#fff" : t.body }}>
                      {done ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
                    </span>
                    {g.label}
                  </button>
                  {i < FEATURE_GROUPS.length - 1 && <span className="w-4 sm:w-8 h-px mx-0.5 transition-colors" style={{ background: done ? "#ff6b00" : t.rule }} />}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Workflows ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {FEATURE_GROUPS.map((g, i) => <Workflow key={g.id} group={g} index={i} isDark={isDark} t={t} />)}
      </div>

      {/* ── Closing call to action ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 lg:pb-24">
        <div className="relative overflow-hidden rounded-[30px] px-7 py-12 sm:px-14 sm:py-16 text-center" style={{ background: "linear-gradient(135deg,#ff7a1a 0%,#e85d04 100%)" }}>
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -left-16 -bottom-24 w-72 h-72 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3" style={{ textWrap: "balance" }}>See it running on your own leads</h2>
            <p className="text-white/85 text-lg mb-8 max-w-xl mx-auto">Request your workspace, import your existing leads, and have your team calling the same day.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-[#e85d04] font-bold hover:-translate-y-0.5 transition-transform">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </a>
              <Link to="/pricing" className="inline-flex items-center px-7 py-3.5 rounded-2xl border border-white/50 text-white font-semibold hover:bg-white/10 transition-colors">View Pricing</Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
