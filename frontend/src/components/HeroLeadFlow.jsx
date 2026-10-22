// components/HeroLeadFlow.jsx - the "1 AM lead" moment beside the hero product.
//
// Three cards arrive once, a beat apart, then stay: a Facebook lead comes in,
// the AI answers on WhatsApp, a site visit is booked. It tells the product's
// story in five seconds without reading. Desktop only (it sits on the edge of
// the product frame); with reduced motion the cards are simply there.
// Names and figures are an illustration, like the lead ticker below the hero.
import WhatsAppLogo from "./WhatsAppLogo";

const CSS = `
@keyframes leadflow-in { from { opacity: 0; transform: translate3d(18px, 6px, 0) scale(.97); } to { opacity: 1; transform: none; } }
.leadflow-card { animation: leadflow-in 520ms cubic-bezier(.2,.7,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .leadflow-card { animation: none; } }
`;

function FbMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path d="M13.4 19v-5.6h1.9l.3-2.2h-2.2V9.8c0-.6.2-1.1 1.1-1.1h1.2V6.8c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.5H9v2.2h1.9V19h2.5z" fill="#fff" />
    </svg>
  );
}

export default function HeroLeadFlow({ isDark }) {
  const card = isDark
    ? { background: "rgba(24,24,40,0.92)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff" }
    : { background: "rgba(255,255,255,0.96)", border: "1px solid #ece5dc", color: "#111827" };
  const soft = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const shadow = isDark ? "0 18px 40px rgba(0,0,0,0.45)" : "0 18px 40px rgba(17,24,39,0.12)";

  const Card = ({ delay, children }) => (
    <div className="leadflow-card rounded-2xl px-4 py-3 backdrop-blur-md"
      style={{ ...card, boxShadow: shadow, animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );

  return (
    <div aria-hidden="true" className="hidden lg:flex flex-col gap-3 absolute z-10 w-[290px] -right-6 xl:-right-10 top-[92px] pointer-events-none">
      <style>{CSS}</style>

      <Card delay={900}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: soft }}>
          <FbMark /> New lead · Facebook ad <span className="ml-auto normal-case tracking-normal font-medium">1:04 AM</span>
        </div>
        <p className="mt-1.5 text-[14px] font-bold">Raj Patil</p>
        <p className="text-[12.5px]" style={{ color: soft }}>2 BHK · Hinjewadi, Pune · ₹85 L budget</p>
      </Card>

      <Card delay={2200}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: soft }}>
          <WhatsAppLogo className="w-4 h-4" /> AI replied in 6 sec
        </div>
        <p className="mt-2 text-[12.5px] leading-snug rounded-xl rounded-tl-sm px-3 py-2"
          style={{ background: isDark ? "rgba(37,211,102,0.14)" : "#e9fbe8", color: isDark ? "#d1fae5" : "#14532d" }}>
          Hi Raj, 2 BHK homes here start at ₹82 L. Would a site visit this Saturday at 11 suit you?
        </p>
      </Card>

      <Card delay={3600}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
          <p className="text-[14px] font-bold">Site visit booked</p>
          <span className="ml-auto text-[11px]" style={{ color: soft }}>Just now</span>
        </div>
        <p className="mt-0.5 text-[12.5px]" style={{ color: soft }}>Sat, 11:00 AM · assigned to Neha · before anyone woke up</p>
      </Card>
    </div>
  );
}
