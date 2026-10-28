// IntegrationUI.jsx — the shared look of the Integrations area (owner, 27 Oct 2026,
// modelled on the Vistrow Voice dashboard): every integration is the same
// card on /integrations, and every integration's own page has the same frame
// (back link, header card, stat tiles, tabs).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import SegmentTabs from "../SegmentTabs";

const TONES = {
  on:   { bg: "rgba(22,163,74,0.10)",  fg: "#15803d", dot: "#16a34a" },
  off:  { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", dot: "var(--app-text-soft)" },
  warn: { bg: "rgba(245,158,11,0.12)", fg: "#b45309", dot: "#f59e0b" },
  plan: { bg: "rgba(var(--app-primary-rgb),0.10)", fg: "var(--app-primary)", dot: null },
};

/** Small status chip: tone on | off | warn | plan. */
export function StatusChip({ tone = "off", children }) {
  const t = TONES[tone] || TONES.off;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap shrink-0"
      style={{ background: t.bg, color: t.fg, border: tone === "off" ? "1px solid var(--app-border)" : "1px solid transparent" }}>
      {tone === "plan" ? <Lock className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />}
      {children}
    </span>
  );
}

/** The square logo tile used on cards and page headers. */
export function LogoTile({ children, size = 40, bg = "var(--app-surface-low)" }) {
  return (
    <div className="flex items-center justify-center rounded-xl overflow-hidden shrink-0"
      style={{ width: size, height: size, background: bg, border: "1px solid var(--app-border)" }}>
      {children}
    </div>
  );
}

/** Section heading on /integrations: small caps title and one line. */
export function SectionTitle({ title, note }) {
  return (
    <div className="pt-2">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-app-soft">{title}</p>
      {note && <p className="text-xs text-app-soft mt-0.5">{note}</p>}
    </div>
  );
}

/**
 * One integration on /integrations. Same height and parts for every card:
 * logo, name + category, status chip, one line, then a footer with the state
 * on the left and the action on the right.
 */
export function IntegrationCard({ logo, name, category, status, statusTone = "off", description, footer, action = "Set up", onOpen, locked, lockLabel, toggle }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen?.(); } }}
      className="card text-left p-5 flex flex-col h-full cursor-pointer transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--app-primary-rgb),0.5)]"
      style={{ boxShadow: "none" }}>
      <div className="flex items-start gap-3">
        {logo}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-app leading-tight">{name}</p>
          <p className="text-xs text-app-soft mt-0.5">{category}</p>
        </div>
        {locked ? <StatusChip tone="plan">{lockLabel}</StatusChip>
          : toggle ? <Switch {...toggle} label={name} />
          : <StatusChip tone={statusTone}>{status}</StatusChip>}
      </div>
      <p className="text-[13px] text-app-soft mt-3 leading-relaxed line-clamp-2 flex-1">{description}</p>
      <div className="mt-4 pt-3 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--app-border)" }}>
        <span className="text-xs text-app-soft truncate">{locked ? `Part of the ${lockLabel} plan` : footer}</span>
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold shrink-0" style={{ color: "var(--app-primary)" }}>
          {locked ? "See plans" : action} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

/** On/off switch (green when on). Clicks don't reach the card around it. */
export function Switch({ on, onChange, disabled, busy, title, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={`${label}: ${on ? "on" : "off"}`} title={title || ""}
      disabled={disabled || busy}
      onClick={(e) => { e.stopPropagation(); onChange?.(!on); }}
      onKeyDown={(e) => e.stopPropagation()}
      className="flex items-center gap-2 shrink-0 select-none disabled:cursor-not-allowed">
      <span className="text-xs font-semibold" style={{ color: on ? "#15803d" : "var(--app-text-soft)" }}>{busy ? "..." : on ? "On" : "Off"}</span>
      <span className="w-10 h-6 rounded-full relative transition" style={{ background: on ? "#16a34a" : "var(--app-border-strong)", opacity: disabled && !on ? 0.5 : 1 }}>
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: on ? "translateX(16px)" : "none" }} />
      </span>
    </button>
  );
}

/** A stat tile: icon, small caps label, value, optional note. */
export function StatTile({ icon: Icon, label, value, note, inset = false }) {
  return (
    <div className={`${inset ? "rounded-2xl" : "card"} p-3 sm:p-4 flex items-center gap-3`}
      style={inset ? { border: "1px solid var(--app-border-strong)", background: "var(--app-surface-low)" } : { boxShadow: "none" }}>
      {Icon && (
        <div className="hidden sm:flex h-9 w-9 rounded-xl items-center justify-center shrink-0" style={{ background: "rgba(var(--app-primary-rgb),0.10)" }}>
          <Icon className="h-4 w-4" style={{ color: "var(--app-primary)" }} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-app-soft truncate">{label}</p>
        <p className="text-lg font-bold text-app leading-tight truncate">{value}</p>
        {note && <p className="hidden sm:block text-[11px] text-app-soft truncate">{note}</p>}
      </div>
    </div>
  );
}

/** A titled box inside an integration page tab. */
export function Panel({ icon: Icon, title, children, className = "" }) {
  return (
    <section className={`card p-5 space-y-3 ${className}`} style={{ boxShadow: "none" }}>
      {title && (
        <p className="text-sm font-bold text-app flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" style={{ color: "var(--app-primary)" }} />} {title}
        </p>
      )}
      {children}
    </section>
  );
}

/** Label / value rows, as in a Connection box. */
export function KeyValues({ rows }) {
  return (
    <dl className="text-sm">
      {rows.filter(Boolean).map(([k, v], i) => (
        <div key={k} className="flex items-center justify-between gap-4 py-1.5" style={i ? { borderTop: "1px solid var(--app-border)" } : undefined}>
          <dt className="text-app-soft">{k}</dt>
          <dd className="text-app font-semibold text-right min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Numbered steps for a Setup help tab. */
export function Steps({ items }) {
  return (
    <ol className="space-y-2.5">
      {items.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-app">
          <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "rgba(var(--app-primary-rgb),0.10)", color: "var(--app-primary)" }}>{i + 1}</span>
          <span className="pt-0.5 leading-relaxed">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The frame of every integration's own page: back link, header card (logo,
 * name, status, one line, actions), stat tiles, tabs, then the tab's content.
 */
export function IntegrationShell({ logo, name, status, statusTone = "off", description, actions, stats = [], tabs = [], tab, onTab, back = "/integrations", backLabel = "All integrations", children }) {
  const navigate = useNavigate();
  return (
    <div className="stitch-page space-y-5">
      <button type="button" onClick={() => navigate(back)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-app-soft hover:text-app">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </button>

      <section className="card p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between" style={{ boxShadow: "none" }}>
        <div className="flex items-start gap-4 min-w-0">
          {logo}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-app">{name}</h1>
              {status && <StatusChip tone={statusTone}>{status}</StatusChip>}
            </div>
            {description && <p className="text-sm text-app-soft mt-1 max-w-2xl">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </section>

      {stats.length > 0 && (
        <div className={`grid grid-cols-2 gap-3 ${stats.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {stats.map((s) => <StatTile key={s.label} {...s} />)}
        </div>
      )}

      {tabs.length > 1 && (
        <SegmentTabs ariaLabel={`${name} sections`} value={tab} onChange={onTab}
          tabs={tabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))} />
      )}

      {children}
    </div>
  );
}

/** Shown on an integration page the company's plan doesn't include. */
export function PlanLocked({ plan = "Growth", what }) {
  const navigate = useNavigate();
  return (
    <section className="card p-6 flex flex-col items-start gap-3" style={{ boxShadow: "none" }}>
      <StatusChip tone="plan">{plan}</StatusChip>
      <p className="text-sm text-app">{what} is part of the {plan} plan.</p>
      <button type="button" onClick={() => navigate("/plans")} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold">See plans</button>
    </section>
  );
}

/** "27 Oct, 4:51 pm" in IST. */
export const istWhen = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/** "2h ago" style, for card footers. */
export function ago(d) {
  if (!d) return "";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Real brand marks (owner, 27 Oct 2026), each company's own site icon, in public/logos.
export const LOGOS = {
  plivo: "/logos/plivo.png", enablex: "/logos/enablex.png", meta: "/logos/meta.jpg",
  "99acres": "/logos/99acres.png", housing: "/logos/housing.png", magicbricks: "/logos/magicbricks.png",
};

/** A brand's own logo in the standard tile. */
export function BrandLogo({ brand, alt, size = 40 }) {
  return (
    <LogoTile size={size} bg="#fff">
      {/* Meta's mark comes with wide white margins, so it is drawn larger to match. */}
      <img src={LOGOS[brand]} alt={alt || brand} className="object-contain" style={{ width: size * (brand === "meta" ? 0.95 : 0.62), height: size * (brand === "meta" ? 0.95 : 0.62) }} loading="lazy" />
    </LogoTile>
  );
}

/** A small inline logo, for lists and tabs. */
export function MiniLogo({ brand, size = 18, alt = "" }) {
  return <img src={LOGOS[brand]} alt={alt} width={size} height={size} className="rounded-[5px] object-contain shrink-0" loading="lazy" />;
}

/** The three portals' logos side by side in one tile. */
export function PortalsLogo({ size = 40 }) {
  const s = Math.round(size * 0.42);
  return (
    <LogoTile size={size} bg="#fff">
      <div className="grid grid-cols-2 gap-0.5 place-items-center">
        <MiniLogo brand="99acres" size={s} /><MiniLogo brand="housing" size={s} />
        <div className="col-span-2"><MiniLogo brand="magicbricks" size={s} /></div>
      </div>
    </LogoTile>
  );
}

// A connected website's own icon: its favicon, or its logo when it has none,
// found by the server (backend/utils/siteIcon.js). Until one is found, or if it
// will not load, a first-letter tile, never Google's grey globe (owner, 28 Oct 2026).
export function SiteFavicon({ iconUrl, kind, name, size = 32 }) {
  const [failed, setFailed] = useState(false);
  if (!iconUrl || failed) return <LetterTile name={name} />;
  return (
    <img src={iconUrl} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)}
      className="bg-white object-contain"
      style={kind === "logo" ? { width: "100%", height: "100%", padding: 4 } : { width: size, height: size, borderRadius: 6 }} />
  );
}

/** The first letter of a site's name on a colour picked from the name. */
export function LetterTile({ name }) {
  const text = String(name || "?").replace(/^https?:\/\//i, "").replace(/^www\./i, "").trim();
  const letter = (text.match(/[a-z0-9]/i) || ["?"])[0].toUpperCase();
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <div className="flex h-full w-full items-center justify-center text-base font-bold text-white"
      style={{ background: `hsl(${h} 55% 48%)` }}>{letter}</div>
  );
}

export function WordPressIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM3.5 12c0-1.232.252-2.405.7-3.471L7.942 19.1A8.5 8.5 0 013.5 12zm8.5 8.5a8.46 8.46 0 01-2.41-.349l2.56-7.438 2.622 7.186a.95.95 0 00.07.136A8.472 8.472 0 0112 20.5zm1.17-12.485c.512-.027.973-.08.973-.08.457-.054.403-.726-.054-.7 0 0-1.376.108-2.265.108-.835 0-2.238-.108-2.238-.108-.457-.027-.511.673-.054.7 0 0 .435.053.893.08l1.327 3.635-1.863 5.589-3.102-9.224c.511-.027.972-.08.972-.08.457-.054.403-.726-.054-.7 0 0-1.376.108-2.265.108a15.1 15.1 0 01-.548-.018A8.5 8.5 0 0120.338 9.2c-.027.001-.054.004-.082.004-.835 0-1.428.726-1.428 1.508 0 .7.403 1.292.835 1.992.323.566.7 1.293.7 2.346 0 .727-.28 1.57-.646 2.75l-.847 2.826-3.07-9.11zm2.832 10.934l2.607-7.533c.487-1.219.65-2.193.65-3.059 0-.314-.021-.607-.058-.883a8.5 8.5 0 01-3.199 11.475z"/>
    </svg>
  );
}

export const FORM_PLUGINS = [
  "Contact Form 7", "WPForms", "Elementor", "Gravity Forms",
  "Ninja Forms", "Forminator", "Fluent Forms",
];
