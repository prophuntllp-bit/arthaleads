// components/site/HomeVisuals.jsx - illustrative product visuals for the home
// page. Owner rule (24 Oct 2026): no real CRM screenshots on the marketing
// site. These are small, coded mock-ups (like vistrow.com's) that show what
// the product does, layered over AI-generated photos. Names, projects and
// prices are illustrations. Everything reads theme tokens, so it works in
// light, dark and inside dark bands.
import { CalendarCheck2, Sparkles, Flame, Phone, CheckCheck, ArrowUpRight, FileText, MapPin, Clock3, Users } from "lucide-react";
import { SiteImage } from "./Site";
import { WhatsAppLogo, FacebookLogo, GoogleLogo } from "./BrandLogos";

const cx = (...c) => c.filter(Boolean).join(" ");

/** A small floating UI card used over photos. Always opaque so it never bleeds. */
export function FloatCard({ className, children, style }) {
  return (
    <div className={cx("absolute rounded-2xl border p-3.5 text-left", className)}
      style={{ background: "var(--site-card)", borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)", ...style }}>
      {children}
    </div>
  );
}

// ── Hero: photo + the 1 AM enquiry, the AI reply and the booked visit ─────────
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] px-3 sm:px-6 lg:px-0">
      <div aria-hidden="true" className="absolute -inset-6 sm:-inset-10 rounded-[40px] blur-3xl opacity-70"
        style={{ background: "radial-gradient(60% 60% at 60% 40%, rgba(255,107,0,0.22), transparent 70%)" }} />
      <div className="relative overflow-hidden rounded-[28px] border" style={{ borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
        <SiteImage name="hero" width={1024} height={1280} priority sizes="(min-width: 1024px) 520px, 92vw"
          alt="A real estate sales manager smiling at her phone in a modern sales lounge"
          className="block w-full h-auto aspect-[4/5] object-cover" />
      </div>

      <FloatCard className="left-0 top-6 sm:-left-2 lg:-left-12 w-[230px] sm:w-[250px]">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(37,211,102,0.14)" }}>
            <WhatsAppLogo className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold site-ink leading-tight">New enquiry</p>
            <p className="text-[11px] site-muted leading-tight">Facebook ad · 1:04 AM</p>
          </div>
        </div>
        <p className="mt-2.5 text-[13px] leading-snug site-ink">Is the 2 BHK at Aurum Heights still available?</p>
      </FloatCard>

      <FloatCard className="hidden sm:block right-0 lg:-right-10 top-[42%] w-[240px]">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--site-brand-ink)" }}>
          <Sparkles className="w-3.5 h-3.5" /> AI agent replied in seconds
        </p>
        <p className="mt-2 rounded-xl px-3 py-2 text-[13px] leading-snug" style={{ background: "rgba(37,211,102,0.12)", color: "var(--site-ink)" }}>
          Yes, it is. 2 BHK homes start at ₹82 L. Would you like to visit this Saturday?
        </p>
      </FloatCard>

      <FloatCard className="left-2 bottom-6 sm:left-4 lg:-left-8 flex items-center gap-3 !py-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(22,163,74,0.12)" }}>
          <CalendarCheck2 className="w-[18px] h-[18px]" style={{ color: "#16a34a" }} />
        </span>
        <div>
          <p className="text-[13px] font-semibold site-ink leading-tight">Site visit booked</p>
          <p className="text-[11px] site-muted leading-tight">Saturday · 11:00 AM</p>
        </div>
      </FloatCard>

      <FloatCard className="hidden sm:flex right-4 top-6 lg:-right-6 items-center gap-2 !py-2.5 !px-3">
        <Flame className="w-4 h-4" style={{ color: "#ff6b00" }} />
        <span className="text-[12px] font-semibold site-ink">Lead score 87 · Hot</span>
      </FloatCard>
    </div>
  );
}

// ── AI lead score card ─────────────────────────────────────────────────────────
export function ScoreCard() {
  const r = 26, c = 2 * Math.PI * r, pct = 0.87;
  return (
    <div className="site-card site-card--raised p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold site-ink truncate">Raj Patil</p>
          <p className="text-xs site-muted truncate">Aurum Heights · 2 BHK · ₹80 L – 1 Cr</p>
        </div>
        <div className="relative w-16 h-16 shrink-0" aria-label="Lead score 87 out of 100">
          <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--site-line-strong)" strokeWidth="6" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="#ff6b00" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold site-ink">87</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold rounded-md px-2 py-1" style={{ background: "rgba(255,107,0,0.12)", color: "var(--site-brand-ink)" }}>
          <Flame className="w-3.5 h-3.5" /> Hot
        </span>
        <span className="site-muted">Includes +15 from AI</span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed site-ink">
        <Sparkles className="inline w-3.5 h-3.5 mr-1 -mt-0.5" style={{ color: "var(--site-brand-ink)" }} />
        Asked for a Saturday site visit and confirmed his budget on WhatsApp.
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium site-muted">
        <Phone className="w-3.5 h-3.5" /> Next step: call before 11 AM Saturday
      </p>
    </div>
  );
}

// ── Artha copilot card ─────────────────────────────────────────────────────────
export function CopilotCard() {
  const leads = [
    ["Raj Patil", "87", "Site visit Sat"],
    ["Neha Joshi", "81", "Asked for brochure"],
    ["Vikram Rao", "74", "Follow-up overdue"],
  ];
  return (
    <div className="site-card site-card--raised p-5">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] text-white" style={{ background: "var(--brand-btn)" }}>
          Who should I call first today?
        </p>
      </div>
      <div className="mt-3 flex items-start gap-2.5">
        <img src="/ai-avatar2.png" alt="" width="32" height="32" className="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] site-ink"><span className="font-semibold">Artha:</span> Start with these three.</p>
          <ul className="mt-2 space-y-1.5">
            {leads.map(([n, s, why]) => (
              <li key={n} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px]"
                style={{ background: "var(--site-tint)", border: "1px solid var(--site-line)" }}>
                <span className="font-semibold site-ink truncate">{n}</span>
                <span className="site-muted truncate flex-1">{why}</span>
                <span className="font-semibold shrink-0" style={{ color: "var(--site-brand-ink)" }}>{s}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2 text-[12px]">
            <span className="site-muted">Set follow-ups for all three?</span>
            <span className="rounded-lg px-3 py-1.5 font-semibold text-white" style={{ background: "var(--brand-btn)" }}>Apply</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Feature mini-visuals (one per feature card) ────────────────────────────────
const miniBox = "rounded-xl border px-3 py-2";
const miniStyle = { background: "var(--site-card)", borderColor: "var(--site-line)" };

export function CaptureViz() {
  const rows = [
    [FacebookLogo, "Ananya I.", "Facebook ad"],
    [GoogleLogo, "Kabir J.", "Google lead form"],
    [WhatsAppLogo, "Rohan P.", "WhatsApp"],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([Logo, n, src]) => (
        <div key={n} className={cx(miniBox, "flex items-center gap-2.5 text-[12px]")} style={miniStyle}>
          <Logo className="w-4 h-4 shrink-0" />
          <span className="font-semibold site-ink">{n}</span>
          <span className="site-muted truncate">{src}</span>
          <span className="ml-auto text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "rgba(22,163,74,0.12)", color: "#15803d" }}>New</span>
        </div>
      ))}
    </div>
  );
}

export function PipelineViz() {
  const cols = [["New", 3], ["Contacted", 2], ["Site visit", 2], ["Booked", 1]];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cols.map(([name, n], i) => (
        <div key={name} className="rounded-lg p-1.5" style={{ background: "var(--site-tint)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wide site-muted truncate mb-1.5">{name}</p>
          {Array.from({ length: n }).map((_, k) => (
            <div key={k} className="h-5 rounded-md mb-1 border" style={{ ...miniStyle, borderColor: i === 2 && k === 0 ? "#ff6b00" : "var(--site-line)" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ProjectViz() {
  return (
    <div className={cx(miniBox, "!p-3")} style={miniStyle}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg shrink-0" style={{ background: "linear-gradient(160deg,#ffb27a,#ff6b00 60%,#c2410c)" }} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold site-ink truncate">Aurum Heights</p>
          <p className="text-[11px] site-muted flex items-center gap-1"><MapPin className="w-3 h-3" /> Baner, Pune</p>
        </div>
        <span className="ml-auto text-[11px] font-semibold site-ink">₹82 L+</span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {["2 BHK", "3 BHK", "RERA", "Brochure"].map((t) => (
          <span key={t} className="text-[10px] font-medium rounded-md px-1.5 py-0.5" style={{ background: "var(--site-tint)", color: "var(--site-text)" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function VisitViz() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <div key={d} className="rounded-lg py-1.5 text-center text-[10px] font-semibold border"
            style={d === "Sat"
              ? { background: "var(--brand-btn)", color: "#fff", borderColor: "transparent" }
              : { ...miniStyle, color: "var(--site-muted)" }}>
            {d}
          </div>
        ))}
      </div>
      <div className={cx(miniBox, "mt-2 flex items-center gap-2 text-[12px]")} style={miniStyle}>
        <Clock3 className="w-3.5 h-3.5" style={{ color: "var(--site-brand-ink)" }} />
        <span className="font-semibold site-ink">11:00 AM</span>
        <span className="site-muted truncate">Raj Patil · Aurum Heights</span>
      </div>
    </div>
  );
}

export function TeamViz() {
  const agents = [["Kabir", 92], ["Neha", 78], ["Sana", 64], ["Rohan", 51]];
  return (
    <div className="space-y-2">
      {agents.map(([n, v]) => (
        <div key={n} className="flex items-center gap-2 text-[11px]">
          <span className="w-11 site-ink font-medium">{n}</span>
          <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--site-tint)" }}>
            <span className="block h-full rounded-full" style={{ width: `${v}%`, background: "linear-gradient(90deg,#ff8a3d,#ff6b00)" }} />
          </span>
          <CheckCheck className="w-3.5 h-3.5" style={{ color: "#16a34a" }} aria-label="Checked in today" />
        </div>
      ))}
    </div>
  );
}

export function BookingViz() {
  return (
    <div className={cx(miniBox, "!p-3 text-[12px]")} style={miniStyle}>
      <div className="flex items-center justify-between">
        <span className="font-semibold site-ink flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Invoice AL-0142</span>
        <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "rgba(22,163,74,0.12)", color: "#15803d" }}>PDF ready</span>
      </div>
      <div className="mt-2 space-y-1 site-muted">
        <p className="flex justify-between"><span>Brokerage 2% on ₹82 L</span><span>₹1,64,000</span></p>
        <p className="flex justify-between"><span>GST 18%</span><span>₹29,520</span></p>
      </div>
      <p className="mt-1.5 pt-1.5 flex justify-between font-semibold site-ink" style={{ borderTop: "1px solid var(--site-line)" }}>
        <span>Total</span><span>₹1,93,520</span>
      </p>
    </div>
  );
}

// ── Field photo with a follow-up reminder (How it works) ──────────────────────
export function FieldVisual() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[28px] border" style={{ borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
        <SiteImage name="field" width={1536} height={1024} sizes="(min-width: 1024px) 600px, 92vw"
          alt="A sales executive in a hard hat checking her phone outside a residential construction site"
          className="block w-full h-auto aspect-[3/2] object-cover" />
      </div>
      <FloatCard className="left-3 bottom-3 sm:left-5 sm:bottom-5 flex items-center gap-3 !py-3 max-w-[calc(100%-1.5rem)]">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.12)" }}>
          <Phone className="w-4 h-4" style={{ color: "var(--site-brand-ink)" }} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold site-ink leading-tight">Follow-up due · 4:00 PM</p>
          <p className="text-[11px] site-muted leading-tight truncate">Neha Joshi · wants a 3 BHK in Baner</p>
        </div>
        <ArrowUpRight className="w-4 h-4 site-muted shrink-0" />
      </FloatCard>
      <FloatCard className="hidden sm:flex right-5 top-5 items-center gap-2 !py-2.5 !px-3">
        <Users className="w-4 h-4" style={{ color: "#16a34a" }} />
        <span className="text-[12px] font-semibold site-ink">Checked in · 9:42 AM</span>
      </FloatCard>
    </div>
  );
}
