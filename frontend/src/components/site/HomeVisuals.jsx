// components/site/HomeVisuals.jsx - illustrative product visuals for the home
// page. Owner rule (24 Oct 2026): no real CRM screenshots on the marketing
// site. These are small, coded mock-ups (like vistrow.com's) that show what
// the product does, layered over AI-generated photos. Names, projects and
// prices are illustrations. Everything reads theme tokens, so it works in
// light, dark and inside dark bands.
import { CalendarCheck2, Sparkles, Flame, Phone, CheckCheck, ArrowUpRight, FileText, MapPin, Users } from "lucide-react";
import { SiteImage, Card } from "./Site";
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
      <div aria-hidden="true" className="absolute -inset-4 sm:-inset-10 pointer-events-none"
        style={{ background: "radial-gradient(50% 50% at 60% 40%, rgba(255,107,0,0.16), transparent 75%)" }} />
      <div className="relative overflow-hidden rounded-[28px] border" style={{ borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
        <SiteImage name="hero" width={1024} height={1280} priority sizes="(min-width: 1024px) 520px, 92vw"
          alt="A real estate sales manager smiling at her phone in a modern sales lounge"
          className="block w-full h-auto aspect-[4/5] object-cover" />
      </div>

      <FloatCard className="left-0 top-6 sm:-left-2 lg:-left-6 xl:-left-12 w-[230px] sm:w-[250px]">
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

      <FloatCard className="hidden sm:block right-0 lg:-right-3 xl:-right-10 top-[42%] w-[240px]">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--site-brand-ink)" }}>
          <Sparkles className="w-3.5 h-3.5" /> AI agent replied in seconds
        </p>
        <p className="mt-2 rounded-xl px-3 py-2 text-[13px] leading-snug" style={{ background: "rgba(37,211,102,0.12)", color: "var(--site-ink)" }}>
          Yes, it is. 2 BHK homes start at ₹82 L. Would you like to visit this Saturday?
        </p>
      </FloatCard>

      <FloatCard className="left-2 bottom-6 sm:left-4 lg:-left-4 xl:-left-8 flex items-center gap-3 !py-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(22,163,74,0.12)" }}>
          <CalendarCheck2 className="w-[18px] h-[18px]" style={{ color: "#16a34a" }} />
        </span>
        <div>
          <p className="text-[13px] font-semibold site-ink leading-tight">Site visit booked</p>
          <p className="text-[11px] site-muted leading-tight">Saturday · 11:00 AM</p>
        </div>
      </FloatCard>

      <FloatCard className="hidden sm:flex right-4 top-6 lg:right-2 xl:-right-6 items-center gap-2 !py-2.5 !px-3">
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
    <Card glow className="h-full p-5 flex flex-col">
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
      <p className="mt-auto pt-4 flex items-center gap-1.5 text-xs font-medium site-muted">
        <Phone className="w-3.5 h-3.5" /> Next step: call before 11 AM Saturday
      </p>
    </Card>
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
    <Card glow className="h-full p-5 flex flex-col">
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
              <li key={n} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "var(--site-chip)", border: "1px solid var(--site-line)" }}>
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
    </Card>
  );
}

// ── Feature mini-visuals (one per feature card) ────────────────────────────────
// Each one is a small, filled piece of illustrative UI on a dotted "stage" of a
// fixed height, so every card in the grid lines up and none looks empty.
const tile = "rounded-xl border";
const tileStyle = { background: "var(--site-card)", borderColor: "var(--site-line)", boxShadow: "var(--site-shadow-sm)" };
const GREEN = { background: "rgba(22,163,74,0.12)", color: "#16a34a" };
const ORANGE = { background: "rgba(255,107,0,0.12)", color: "var(--site-brand-ink)" };
const RED = { background: "rgba(220,38,38,0.12)", color: "#dc2626" };
const AVATAR_COLORS = ["#ff6b00", "#2563eb", "#16a34a", "#9333ea", "#db2777", "#0891b2"];

function Avatar({ name, i = 0, size = 26 }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <span className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
      {initials}
    </span>
  );
}

function Badge({ tone, children }) {
  return <span className="text-[10px] font-semibold rounded-md px-1.5 py-0.5 whitespace-nowrap" style={tone}>{children}</span>;
}

/** The dotted stage every feature visual sits on. */
export function Stage({ children, className }) {
  return <div className={cx("site-stage p-4 sm:h-[232px]", className)}>{children}</div>;
}

export function CaptureViz() {
  const rows = [
    [FacebookLogo, "Ananya Iyer", "2 BHK · Aurum Heights", "Facebook ad", "1:04 AM", "Neha"],
    [GoogleLogo, "Kabir Jain", "3 BHK · Skyline Residency", "Google form", "1:12 AM", "Rohit"],
    [WhatsAppLogo, "Rohan Patil", "Plot · Green Acres", "WhatsApp", "6:40 AM", "Sana"],
  ];
  return (
    <Stage>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold site-ink flex items-center gap-2">
          <span className="w-2 h-2 rounded-full site-pulse" style={{ background: "#16a34a" }} /> 3 new leads overnight
        </p>
        <Badge tone={ORANGE}>Auto-assigned</Badge>
      </div>
      <div className="space-y-2">
        {rows.map(([Logo, n, want, src, time, agent], i) => (
          <div key={n} className={cx(tile, "flex items-center gap-3 px-3 py-2.5")} style={tileStyle}>
            <Avatar name={n} i={i} size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold site-ink truncate leading-tight">{n}</p>
              <p className="text-[11px] site-muted truncate leading-tight mt-0.5">{want}</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] site-muted shrink-0"><Logo className="w-3.5 h-3.5" /> {src}</span>
            <span className="hidden md:inline text-[11px] site-muted shrink-0 w-14 text-right">{time}</span>
            <span className="site-chip text-[10.5px] font-medium rounded-full pl-1 pr-2 py-0.5 flex items-center gap-1 shrink-0">
              <Avatar name={agent} i={i + 3} size={16} /> {agent}
            </span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

export function PipelineViz() {
  const cols = [
    ["New", 12, [["Kabir J.", "3 BHK"], ["Meera S.", "2 BHK"]]],
    ["Site visit", 5, [["Raj P.", "Sat 11 AM", "hot"], ["Vikram R.", "Overdue", "late"]]],
    ["Booked", 2, [["Asha K.", "Flat 1204", "won"]]],
  ];
  return (
    <Stage>
      <div className="grid grid-cols-3 gap-2 h-full">
        {cols.map(([name, count, cards]) => (
          <div key={name} className="rounded-xl p-2 site-chip">
            <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide site-muted mb-2 px-0.5">
              <span className="truncate">{name}</span><span className="site-ink">{count}</span>
            </p>
            <div className="space-y-1.5">
              {cards.map(([n, tag, state]) => (
                <div key={n} className={cx(tile, "px-2 py-1.5")}
                  style={{ ...tileStyle, ...(state === "late" ? { borderColor: "rgba(220,38,38,0.55)" } : state === "hot" ? { borderColor: "rgba(255,107,0,0.6)" } : {}) }}>
                  <p className="text-[11px] font-semibold site-ink truncate">{n}</p>
                  <p className="mt-0.5"><Badge tone={state === "late" ? RED : state === "won" ? GREEN : state === "hot" ? ORANGE : { background: "var(--site-chip)", color: "var(--site-muted)" }}>{tag}</Badge></p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}

export function ProjectViz() {
  return (
    <Stage className="flex flex-col">
      <div className={cx(tile, "overflow-hidden flex-1 flex flex-col")} style={tileStyle}>
        <div className="relative h-[84px] overflow-hidden">
          <SiteImage name="builder" width={640} height={427} sizes="320px" alt="" className="w-full h-full object-cover object-[50%_70%]" />
          <span className="absolute top-2 left-2"><Badge tone={{ background: "rgba(15,18,34,0.7)", color: "#fff" }}>RERA registered</Badge></span>
        </div>
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-semibold site-ink truncate">Aurum Heights</p>
            <span className="text-[11px] font-semibold site-ink shrink-0">₹82 L+</span>
          </div>
          <p className="text-[11px] site-muted flex items-center gap-1"><MapPin className="w-3 h-3" /> Baner, Pune</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            {[["128", "Leads"], ["24", "Visits"], ["6", "Booked"]].map(([v, l]) => (
              <div key={l} className="site-chip rounded-lg py-1">
                <p className="text-[12px] font-bold site-ink leading-none">{v}</p>
                <p className="text-[9.5px] site-muted mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Stage>
  );
}

export function VisitViz() {
  const days = [["Mon", 20, 1], ["Tue", 21, 0], ["Wed", 22, 2], ["Thu", 23, 1], ["Fri", 24, 0], ["Sat", 25, 3], ["Sun", 26, 2]];
  const visits = [
    ["11:00 AM", "Raj Patil", "Aurum Heights · 2 BHK", "Booked by AI", ORANGE],
    ["4:00 PM", "Meera Shah", "Skyline Residency · 3 BHK", "Confirmed", GREEN],
  ];
  return (
    <Stage>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(([d, n, dots]) => {
          const on = d === "Sat";
          return (
            <div key={d} className={cx(tile, "py-1.5 text-center")}
              style={on ? { background: "var(--brand-btn)", borderColor: "transparent", color: "#fff" } : { ...tileStyle, boxShadow: "none" }}>
              <p className="text-[9.5px] font-medium" style={on ? undefined : { color: "var(--site-muted)" }}>{d}</p>
              <p className="text-[13px] font-bold leading-tight" style={on ? undefined : { color: "var(--site-ink)" }}>{n}</p>
              <p className="flex justify-center gap-0.5 h-1.5 mt-0.5">
                {Array.from({ length: dots }).map((_, k) => <span key={k} className="w-1 h-1 rounded-full" style={{ background: on ? "#fff" : "#ff6b00" }} />)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 space-y-2">
        {visits.map(([t, n, where, label, tone], i) => (
          <div key={n} className={cx(tile, "flex items-center gap-3 px-3 py-2")} style={tileStyle}>
            <span className="text-[11.5px] font-bold site-ink w-16 shrink-0">{t}</span>
            <Avatar name={n} i={i} size={24} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold site-ink truncate leading-tight">{n}</p>
              <p className="text-[10.5px] site-muted truncate leading-tight">{where}</p>
            </div>
            <Badge tone={tone}>{label}</Badge>
          </div>
        ))}
      </div>
    </Stage>
  );
}

export function TeamViz() {
  const agents = [["Neha Kulkarni", 46, 92, "9:31"], ["Rohit Desai", 39, 78, "9:44"], ["Sana Shaikh", 31, 64, "9:52"], ["Amit Pawar", 24, 51, "10:05"]];
  return (
    <Stage>
      <p className="flex items-center justify-between text-[11px] font-semibold site-muted mb-2.5">
        <span className="site-ink">Today</span><span>Calls · Check-in</span>
      </p>
      <div className="space-y-2">
        {agents.map(([n, calls, pct, inAt], i) => (
          <div key={n} className={cx(tile, "flex items-center gap-2.5 px-2.5 py-1.5")} style={tileStyle}>
            <Avatar name={n} i={i + 1} size={24} />
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold site-ink truncate leading-tight">{n.split(" ")[0]}</p>
              <span className="mt-1 block h-1.5 rounded-full overflow-hidden site-chip">
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#ff9a55,#ff6b00)" }} />
              </span>
            </div>
            <span className="text-[11.5px] font-bold site-ink w-6 text-right">{calls}</span>
            <span className="text-[10px] font-medium flex items-center gap-0.5 shrink-0" style={{ color: "#16a34a" }}>
              <CheckCheck className="w-3 h-3" aria-hidden="true" />{inAt}
            </span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

export function BookingViz() {
  return (
    <Stage>
      <div className={cx(tile, "p-3.5 text-[12px] h-full flex flex-col")} style={tileStyle}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold site-ink flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" style={{ color: "var(--site-brand-ink)" }} /> Invoice AL-0142</p>
            <p className="text-[11px] site-muted mt-0.5 truncate">Flat 1204 · Aurum Heights · Asha Kulkarni</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Badge tone={GREEN}>PDF ready</Badge>
            <span className="hidden sm:inline"><Badge tone={ORANGE}>Payment pending</Badge></span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 site-muted">
          <p className="flex justify-between"><span>Agreement value</span><span className="site-ink">₹82,00,000</span></p>
          <p className="flex justify-between"><span>Brokerage 2%</span><span>₹1,64,000</span></p>
          <p className="flex justify-between"><span>CGST 9% + SGST 9%</span><span>₹29,520</span></p>
        </div>
        <p className="mt-auto pt-2 flex justify-between font-bold site-ink" style={{ borderTop: "1px solid var(--site-line)" }}>
          <span>Total due</span><span>₹1,93,520</span>
        </p>
      </div>
    </Stage>
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
