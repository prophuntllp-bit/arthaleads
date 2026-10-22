// components/FeatureBento.jsx - the home page's six features, each with a small
// piece of the product doing its job.
//
// The old section was six identical icon + title + two-line blocks, which read
// as static. Here every card carries a mini UI that plays once when it scrolls
// into view (a lead score filling to 87, a call transcript writing itself, a
// card moving down the pipeline) and then rests on its final state. Content is
// readable before, during and after the motion, and reduced motion shows the
// final state straight away. Names and amounts are illustrations.
import { useLayoutEffect, useRef } from "react";
import { useInView } from "./motion/Motion";
import WhatsAppLogo from "./WhatsAppLogo";

const CSS = `
.fb-card { transition: transform .3s ease, box-shadow .3s ease, border-color .3s ease; }
.fb-card:hover { transform: translateY(-3px); }
.fb-row { transform: translateX(-10px); opacity: .35; transition: transform .5s cubic-bezier(.2,.7,.2,1), opacity .5s ease; }
[data-in="1"] .fb-row { transform: none; opacity: 1; }
.fb-ring { stroke-dasharray: 251.3; stroke-dashoffset: 251.3; transition: stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1) .2s; }
[data-in="1"] .fb-ring { stroke-dashoffset: 32.7; }
.fb-chip { opacity: .3; transition: opacity .4s ease; }
[data-in="1"] .fb-chip { opacity: 1; }
.fb-line { clip-path: inset(0 100% 0 0); transition: clip-path .9s steps(28, end); }
[data-in="1"] .fb-line { clip-path: inset(0 0 0 0); }
.fb-move { transform: translateX(0); transition: transform 1.1s cubic-bezier(.6,0,.2,1) .5s; }
/* --fb-dx is measured from the real columns (PipelineUI), so it lands exactly at every width */
[data-in="1"] .fb-move { transform: translateX(var(--fb-dx, 0px)); }
.fb-type { clip-path: inset(0 100% 0 0); transition: clip-path 1.6s steps(40, end) .3s; }
[data-in="1"] .fb-type { clip-path: inset(0 0 0 0); }
.fb-stamp { transform: scale(.6) rotate(-8deg); opacity: 0; transition: transform .4s cubic-bezier(.3,1.6,.5,1) 1.3s, opacity .3s ease 1.3s; }
[data-in="1"] .fb-stamp { transform: rotate(-8deg); opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .fb-row, .fb-ring, .fb-chip, .fb-line, .fb-move, .fb-type, .fb-stamp { transition: none !important; }
}
`;

function useStage() {
  const ref = useRef(null);
  const seen = useInView(ref);
  return [ref, seen ? "1" : "0"];
}

// ── The six mini UIs ─────────────────────────────────────────────────────────
function InboxUI({ t }) {
  const rows = [
    { name: "Raj Patil", src: "Facebook ad", dot: "#1877F2", meta: "2 BHK · Hinjewadi", time: "1:04 AM" },
    { name: "Priya Sharma", src: "WhatsApp", dot: "#25D366", meta: "3 BHK · Baner", time: "1:12 AM" },
    { name: "Amit Deshmukh", src: "Google Ads", dot: "#EA4335", meta: "Plot · Wagholi", time: "7:40 AM" },
    { name: "Kavya Nair", src: "99acres", dot: "#f97316", meta: "2 BHK · Wakad", time: "8:15 AM" },
  ];
  return (
    <div className="rounded-2xl p-3 grid gap-2" style={{ background: t.well, border: `1px solid ${t.line}` }}>
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.soft }}>All sources · today</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ff6b00] text-white">4 new</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.name} className="fb-row flex items-center gap-3 rounded-xl px-3 py-2"
          style={{ background: t.card, border: `1px solid ${t.line}`, transitionDelay: `${i * 140}ms` }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.dot }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold truncate" style={{ color: t.ink }}>{r.name}</p>
            <p className="text-[11.5px] truncate" style={{ color: t.soft }}>{r.src} · {r.meta}</p>
          </div>
          <span className="text-[11px] tabular-nums shrink-0" style={{ color: t.soft }}>{r.time}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreUI({ t }) {
  return (
    <div className="flex items-center gap-5">
      <div className="relative w-[96px] h-[96px] shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke={t.line} strokeWidth="9" />
          <circle className="fb-ring" cx="50" cy="50" r="40" fill="none" stroke="#ff6b00" strokeWidth="9" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-black leading-none tabular-nums" style={{ color: t.ink }}>87</span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#ff6b00]">Hot</span>
        </div>
      </div>
      <div className="grid gap-1.5">
        {["Budget fits ₹85 L", "Wants to visit this week", "Replied in 2 min"].map((c, i) => (
          <span key={c} className="fb-chip text-[12px] font-medium rounded-full px-2.5 py-1"
            style={{ background: t.well, color: t.ink, border: `1px solid ${t.line}`, transitionDelay: `${500 + i * 250}ms` }}>✓ {c}</span>
        ))}
      </div>
    </div>
  );
}

function CallUI({ t }) {
  const lines = [
    { who: "Buyer", text: "Looking for a 2 BHK under 90 lakh, near Hinjewadi." },
    { who: "Agent", text: "We have one at ₹82 L. Can you visit on Saturday?" },
    { who: "Buyer", text: "Saturday works. Morning is better." },
  ];
  return (
    <div className="rounded-2xl p-3 grid gap-2" style={{ background: t.well, border: `1px solid ${t.line}` }}>
      {lines.map((l, i) => (
        <p key={i} className="fb-line text-[12.5px] leading-snug" style={{ color: t.ink, transitionDelay: `${i * 900}ms` }}>
          <span className="font-bold" style={{ color: l.who === "Buyer" ? "#7c3aed" : t.soft }}>{l.who}:</span> {l.text}
        </p>
      ))}
      <div className="fb-chip flex flex-wrap gap-1.5 pt-1" style={{ transitionDelay: "2700ms" }}>
        <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}>Intent: high</span>
        <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>Moved to Site Visit</span>
      </div>
    </div>
  );
}

function PipelineUI({ t }) {
  const cols = ["New", "Contacted", "Site Visit", "Negotiation"];
  const gridRef = useRef(null);
  // The card travels from the New column to the empty slot at the top of Site
  // Visit. Measure that distance instead of guessing it, so it lands on the slot
  // at every width (a fixed calc overshot on phones).
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    const measure = () => {
      const wells = grid.querySelectorAll("[data-well]");
      if (wells.length < 3) return;
      const dx = wells[2].getBoundingClientRect().left - wells[0].getBoundingClientRect().left;
      grid.style.setProperty("--fb-dx", `${dx}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={gridRef} className="grid grid-cols-4 gap-2 sm:gap-4">
      {cols.map((c, ci) => (
        <div key={c} className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 truncate" style={{ color: t.soft }}>{c}</p>
          <div data-well className="rounded-xl p-1.5 grid gap-1.5 content-start min-h-[92px]" style={{ background: t.well, border: `1px solid ${t.line}` }}>
            {ci === 0 && (
              <div className="fb-move rounded-lg px-2 py-1.5 relative z-[1]" style={{ background: t.card, border: "1px solid rgba(255,107,0,0.45)", boxShadow: "0 6px 16px rgba(255,107,0,0.18)" }}>
                <p className="text-[11.5px] font-bold truncate" style={{ color: t.ink }}>Raj Patil</p>
                <p className="text-[10.5px] truncate" style={{ color: t.soft }}>₹85 L · 87</p>
              </div>
            )}
            {ci === 1 && <Ghost t={t} name="Sneha K." />}
            {ci === 2 && <><Slot t={t} /><Ghost t={t} name="Vikram P." /></>}
            {ci === 3 && <><Ghost t={t} name="Neha J." /><Ghost t={t} name="Rahul M." /></>}
          </div>
        </div>
      ))}
    </div>
  );
}
// Where the moving card lands: same size as a card, dashed until it arrives.
function Slot({ t }) {
  return (
    <div aria-hidden="true" className="rounded-lg px-2 py-1.5" style={{ border: `1px dashed ${t.line}` }}>
      <p className="text-[11.5px]">&nbsp;</p>
      <p className="text-[10.5px]">&nbsp;</p>
    </div>
  );
}
function Ghost({ t, name }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
      <p className="text-[11.5px] font-semibold truncate" style={{ color: t.ink }}>{name}</p>
      <p className="text-[10.5px]" style={{ color: t.soft }}>&nbsp;</p>
    </div>
  );
}

function DraftUI({ t, isDark }) {
  return (
    <div className="rounded-2xl p-3 grid gap-2.5" style={{ background: isDark ? "rgba(37,211,102,0.06)" : "#f3fbf1", border: `1px solid ${t.line}` }}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.soft }}>
        <WhatsAppLogo className="w-4 h-4" /> AI draft for Priya · 3 BHK, Baner
      </div>
      <p className="fb-type text-[13px] leading-snug rounded-xl rounded-tr-sm px-3 py-2 justify-self-end max-w-[92%]"
        style={{ background: isDark ? "rgba(37,211,102,0.16)" : "#dcf8c6", color: isDark ? "#d1fae5" : "#14532d" }}>
        Hi Priya, the 3 BHK in Baner you asked about is ₹1.45 Cr with 2 car parks. Shall I send the floor plan?
      </p>
      <div className="flex justify-end gap-2">
        <span className="text-[12px] font-semibold rounded-lg px-3 py-1.5" style={{ color: t.soft, border: `1px solid ${t.line}` }}>Edit</span>
        <span className="text-[12px] font-bold rounded-lg px-3 py-1.5 bg-[#16a34a] text-white">Send</span>
      </div>
    </div>
  );
}

function InvoiceUI({ t }) {
  const rows = [["Brokerage 2% on ₹82 L", "₹1,64,000"], ["GST 18%", "₹29,520"]];
  return (
    <div className="relative rounded-2xl p-4" style={{ background: t.card, border: `1px solid ${t.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-bold" style={{ color: t.ink }}>Invoice AL-0142</span>
        <span className="text-[11px]" style={{ color: t.soft }}>Unit B-704</span>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between text-[12px] py-1" style={{ color: t.soft }}>
          <span>{k}</span><span className="tabular-nums">{v}</span>
        </div>
      ))}
      <div className="flex justify-between text-[13px] font-bold pt-2 mt-1" style={{ color: t.ink, borderTop: `1px dashed ${t.line}` }}>
        <span>Total</span><span className="tabular-nums">₹1,93,520</span>
      </div>
      <span className="fb-stamp absolute right-3 bottom-12 text-[11px] font-black uppercase tracking-wider rounded-md px-2 py-1"
        style={{ color: "#16a34a", border: "2px solid #16a34a", background: t.card }}>PDF ready</span>
    </div>
  );
}

const VISUALS = {
  "Unified Lead Inbox": { UI: InboxUI, span: "lg:col-span-2" },
  "AI Lead Scoring": { UI: ScoreUI, span: "" },
  "AI Call Intelligence": { UI: CallUI, span: "" },
  "Lead Pipeline": { UI: PipelineUI, span: "lg:col-span-2" },
  "AI WhatsApp Draft": { UI: DraftUI, span: "lg:col-span-2" },
  "Booking & Invoice Engine": { UI: InvoiceUI, span: "" },
};

function Tile({ feature, t, isDark }) {
  const [ref, stage] = useStage();
  const { icon: Icon, color, title, short, desc } = feature;
  const v = VISUALS[title];
  return (
    <div ref={ref} data-in={stage}
      className={`fb-card rounded-3xl p-5 sm:p-6 flex flex-col gap-5 min-w-0 ${v?.span || ""}`}
      style={{ background: t.card, border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}14` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-[17px] leading-tight" style={{ color: t.ink }}>{title}</h3>
          <p className="text-[14.5px] leading-relaxed mt-1" style={{ color: t.soft }}>{short || desc}</p>
        </div>
      </div>
      {v && <div className="flex-1 flex flex-col justify-center"><v.UI t={t} isDark={isDark} /></div>}
    </div>
  );
}

export default function FeatureBento({ features, isDark }) {
  const t = isDark
    ? { card: "#14141f", well: "rgba(255,255,255,0.03)", line: "rgba(255,255,255,0.08)", ink: "#ffffff", soft: "rgba(255,255,255,0.55)", shadow: "none" }
    : { card: "#ffffff", well: "#faf8f5", line: "#ece7e1", ink: "#111827", soft: "#6b7280", shadow: "0 1px 2px rgba(17,24,39,0.04), 0 12px 32px -18px rgba(17,24,39,0.12)" };
  return (
    <>
      <style>{CSS}</style>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {features.map((f) => <Tile key={f.title} feature={f} t={t} isDark={isDark} />)}
      </div>
    </>
  );
}
