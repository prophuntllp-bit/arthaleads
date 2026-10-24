// components/HeroChat.jsx - the home page phone: a 1 AM WhatsApp enquiry
// answered by the AI agent, from first message to booked site visit.
//
// Drawn as a realistic phone (titanium frame, side buttons, Dynamic Island,
// iOS status bar, WhatsApp's own header, wallpaper, bubble tails and input
// bar) because a flat cartoon phone reads as cheap next to real photos.
// It plays once when it scrolls into view (typing dots, then each bubble) and
// rests on the finished conversation; reduced motion shows the whole chat.
// Names, project and prices are an illustration, like the product clips.
import { useEffect, useRef, useState } from "react";
import { CheckCheck, CalendarCheck2, Sparkles, ChevronLeft, Video, Phone, Plus, Camera, Mic, Sticker } from "lucide-react";

// who: "buyer" (incoming, left) | "ai" (our reply, right) | "booked" (system card)
const SCRIPT = [
  { who: "buyer", text: "Hi, is the 2 BHK at Aurum Heights still available? What's the price?", time: "1:04 AM" },
  { who: "ai", text: "Hi Raj, yes it is. 2 BHK homes start at ₹82 L. Are you buying to live in or as an investment?", time: "1:04 AM", options: ["To live in", "Investment"] },
  { who: "buyer", text: "To live in", time: "1:05 AM" },
  { who: "ai", text: "What budget are you looking at?", time: "1:05 AM", options: ["Under ₹80 L", "₹80 L – 1 Cr", "₹1 Cr +"] },
  { who: "buyer", text: "₹80 L – 1 Cr", time: "1:05 AM" },
  { who: "ai", text: "Can you visit the site this Saturday? 11 AM or 4 PM?", time: "1:05 AM", options: ["11 AM", "4 PM"] },
  { who: "buyer", text: "11 AM", time: "1:06 AM" },
  { who: "booked" },
];

const FIRST_DELAY = 700;   // ms before the AI starts "typing"
const TYPING_MS = 900;     // dots before each AI message
const BUYER_GAP = 750;     // pause before each buyer reply

// WhatsApp's doodle wallpaper, approximated with a few line icons on beige.
const WALLPAPER = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' fill='none' stroke='#ddd6cb' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'>" +
  "<path d='M14 20h14v10H14zM18 20v-4h6v4'/><circle cx='86' cy='18' r='7'/><path d='M83 18l2 2 4-4'/>" +
  "<path d='M52 52l6-8 6 8M55 52v6h6v-6'/><path d='M14 84c4-6 10-6 14 0s10 6 14 0'/>" +
  "<path d='M92 74l4 8 8 1-6 5 2 8-8-4-8 4 2-8-6-5 8-1z'/><path d='M60 100h18M60 106h12'/><circle cx='30' cy='108' r='4'/></svg>"
)}")`;

const SIDE_BUTTON = { background: "linear-gradient(90deg,#5a5d64,#2a2c31)" };

function StatusIcons() {
  return (
    <span className="flex items-center gap-[5px]" aria-hidden="true">
      <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.8" /><rect x="4.5" y="5" width="3" height="6" rx="0.8" /><rect x="9" y="2.5" width="3" height="8.5" rx="0.8" /><rect x="13.5" y="0" width="3" height="11" rx="0.8" /></svg>
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2.3c2.1 0 4 .8 5.5 2.1l1.1-1.1A9.4 9.4 0 0 0 7.5.7 9.4 9.4 0 0 0 .9 3.3L2 4.4a7.8 7.8 0 0 1 5.5-2.1Zm0 3.1c1.2 0 2.3.4 3.3 1.2l1.1-1.1a6.4 6.4 0 0 0-8.8 0l1.1 1.1c.9-.8 2.1-1.2 3.3-1.2Zm0 3.1c.4 0 .8.2 1.1.4L7.5 10 6.4 8.9c.3-.2.7-.4 1.1-.4Z" /></svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor" /><path d="M23 4v4c.8-.3 1.3-1.1 1.3-2S23.8 4.3 23 4Z" fill="currentColor" opacity="0.5" /></svg>
    </span>
  );
}

export default function HeroChat() {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduced ? SCRIPT.length : 1);
  const [typing, setTyping] = useState(false);
  const [live, setLive] = useState(false);   // starts once the phone is on screen
  const rootRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) { setLive(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLive(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live || reduced || shown >= SCRIPT.length) return undefined;
    const next = SCRIPT[shown];
    let t1, t2;
    if (next.who === "ai") {
      t1 = setTimeout(() => {
        setTyping(true);
        t2 = setTimeout(() => { setTyping(false); setShown((n) => n + 1); }, TYPING_MS);
      }, shown === 1 ? FIRST_DELAY : 350);
    } else {
      t1 = setTimeout(() => setShown((n) => n + 1), BUYER_GAP);
    }
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shown, reduced, live]);

  // Keep the newest message in view inside the phone, like a real chat.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [shown, typing, reduced]);

  const msgs = SCRIPT.slice(0, shown);
  // A quick-reply row stays tappable-looking only on the newest AI message.
  const lastAi = msgs.map((m) => m.who).lastIndexOf("ai");

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-[318px]">
      <style>{`
        @keyframes hc-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
        .hc-in { animation: hc-in 320ms cubic-bezier(.2,.7,.2,1) both; }
        @keyframes hc-dot { 0%, 80%, 100% { opacity: .3; transform: none; } 40% { opacity: 1; transform: translateY(-2px); } }
        .hc-dot { animation: hc-dot 1s infinite; }
        .hc-tail-in::before, .hc-tail-out::before { content: ""; position: absolute; top: 0; width: 9px; height: 12px; }
        .hc-tail-in::before { left: -7px; background: #fff; clip-path: polygon(100% 0, 0 0, 100% 100%); }
        .hc-tail-out::before { right: -7px; background: #d9fdd3; clip-path: polygon(0 0, 100% 0, 0 100%); }
        @media (prefers-reduced-motion: reduce) { .hc-in, .hc-dot { animation: none; } }
      `}</style>

      {/* Side buttons: action, volume up, volume down (left) and power (right) */}
      <span aria-hidden="true" className="absolute -left-[3px] top-[100px] w-[4px] h-[26px] rounded-l-md" style={SIDE_BUTTON} />
      <span aria-hidden="true" className="absolute -left-[3px] top-[146px] w-[4px] h-[50px] rounded-l-md" style={SIDE_BUTTON} />
      <span aria-hidden="true" className="absolute -left-[3px] top-[206px] w-[4px] h-[50px] rounded-l-md" style={SIDE_BUTTON} />
      <span aria-hidden="true" className="absolute -right-[3px] top-[166px] w-[4px] h-[78px] rounded-r-md" style={{ background: "linear-gradient(270deg,#5a5d64,#2a2c31)" }} />

      {/* Titanium frame */}
      <div className="relative rounded-[3.1rem] p-[3px]"
        style={{ background: "linear-gradient(145deg,#9a9da4 0%,#3d4047 22%,#1b1c20 50%,#4a4d54 78%,#a2a5ac 100%)", boxShadow: "0 50px 90px -30px rgba(0,0,0,0.6), 0 30px 70px -30px rgba(194,65,12,0.35)" }}>
        {/* Black bezel */}
        <div className="rounded-[2.95rem] p-[9px] bg-black">
          {/* Screen */}
          <div className="relative overflow-hidden rounded-[2.4rem] flex flex-col bg-[#efeae2]" style={{ height: 600 }}>
            {/* Status bar + Dynamic Island */}
            <div className="relative flex items-center justify-between px-7 pt-[14px] pb-[6px] text-[#0b0b0c] text-[14px] font-semibold bg-[#f6f6f6]">
              <span className="tracking-tight">1:06</span>
              <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-[9px] w-[96px] h-[28px] rounded-full bg-black" />
              <StatusIcons />
            </div>
            {/* WhatsApp header */}
            <div className="flex items-center gap-2 pl-1.5 pr-3.5 py-2 bg-[#f6f6f6] border-b border-black/[0.08]">
              <ChevronLeft className="w-6 h-6 text-[#0b0b0c] shrink-0" strokeWidth={2.2} aria-hidden="true" />
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg,#7dd3a8,#1fa463)" }}>RP</span>
              <div className="min-w-0 flex-1 ml-0.5">
                <p className="text-[15px] font-semibold leading-tight text-[#0b0b0c] truncate">Raj Patil</p>
                <p className="text-[11.5px] leading-tight text-[#667781] truncate">Facebook ad · Aurum Heights</p>
              </div>
              <Video className="w-[22px] h-[22px] text-[#0b0b0c] shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <Phone className="w-[19px] h-[19px] text-[#0b0b0c] shrink-0 ml-3" strokeWidth={1.8} aria-hidden="true" />
            </div>

            {/* Messages */}
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5"
              style={{ scrollbarWidth: "none", backgroundImage: WALLPAPER, backgroundSize: "120px 120px" }}
              aria-label="Example WhatsApp conversation answered by the Arthaleads AI agent">
              <p className="self-center text-[11px] font-medium text-[#54656f] bg-white rounded-lg px-2.5 py-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.1)]">Today</p>
              <p className="self-center max-w-[90%] text-center text-[11px] leading-snug text-[#54656f] bg-[#fdf4c5] rounded-lg px-3 py-1.5 my-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.1)]">
                <Sparkles className="inline w-3 h-3 -mt-0.5 mr-1 text-[#c2410c]" aria-hidden="true" />Replies here are sent by the Arthaleads AI agent
              </p>
              {msgs.map((m, i) => {
                if (m.who === "booked") {
                  return (
                    <div key={i} className="hc-in self-stretch mt-1.5 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] border-l-4 border-[#25d366]">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-[#15803d]">
                        <CalendarCheck2 className="w-4 h-4" aria-hidden="true" /> Site visit booked
                      </div>
                      <p className="text-[12px] text-[#111b21] mt-0.5">Sat, 11:00 AM · Aurum Heights</p>
                      <p className="text-[11.5px] text-[#667781] mt-1 leading-snug">Sent to Neha with budget, purpose and visit time. Nobody on the team was awake.</p>
                    </div>
                  );
                }
                const mine = m.who === "ai";
                const firstOfGroup = i === 0 || msgs[i - 1].who !== m.who;
                return (
                  <div key={i} className={`hc-in ${mine && m.options ? "w-[82%]" : "max-w-[82%]"} ${mine ? "self-end" : "self-start"} ${firstOfGroup ? "mt-1" : ""}`}>
                    <div className={`relative flow-root rounded-[10px] px-2.5 pt-1.5 pb-1 text-[13.5px] leading-[1.35] text-[#111b21] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${mine ? "bg-[#d9fdd3]" : "bg-white"} ${firstOfGroup ? (mine ? "rounded-tr-none hc-tail-out" : "rounded-tl-none hc-tail-in") : ""}`}>
                      {m.text}
                      <span className="float-right ml-2 mt-[7px] -mb-0.5 flex items-center gap-0.5 text-[10.5px] text-[#667781]">
                        {m.time}{mine && <CheckCheck className="w-[15px] h-[15px] text-[#53bdeb]" aria-hidden="true" />}
                      </span>
                    </div>
                    {mine && m.options && (
                      // Like WhatsApp: two buttons share a row, three stack as full-width rows.
                      <div className={`mt-[3px] grid gap-[3px] ${m.options.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {m.options.map((o) => (
                          <span key={o} className={`whitespace-nowrap text-center text-[12.5px] font-medium rounded-[10px] py-[7px] px-1 bg-white shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${i === lastAi ? "text-[#027eb5]" : "text-[#8696a0]"}`}>{o}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {typing && (
                <div className="hc-in self-end relative rounded-[10px] rounded-tr-none hc-tail-out bg-[#d9fdd3] px-3 py-2.5 flex gap-1 mt-1" aria-hidden="true">
                  {[0, 1, 2].map((d) => <span key={d} className="hc-dot w-1.5 h-1.5 rounded-full bg-[#667781]" style={{ animationDelay: `${d * 160}ms` }} />)}
                </div>
              )}
            </div>

            {/* Input bar (iOS layout) + home indicator */}
            <div className="bg-[#f6f6f6] border-t border-black/[0.08] px-3 pt-2 pb-2">
              <div className="flex items-center gap-2.5 text-[#0b0b0c]" aria-hidden="true">
                <Plus className="w-6 h-6 shrink-0" strokeWidth={1.8} />
                <span className="flex-1 h-[34px] rounded-full bg-white border border-black/[0.1] px-3 flex items-center justify-end">
                  <Sticker className="w-[18px] h-[18px] text-[#54656f]" strokeWidth={1.8} />
                </span>
                <Camera className="w-[22px] h-[22px] shrink-0" strokeWidth={1.8} />
                <Mic className="w-[22px] h-[22px] shrink-0" strokeWidth={1.8} />
              </div>
              <span aria-hidden="true" className="block mx-auto mt-3 w-[118px] h-[5px] rounded-full bg-black" />
            </div>

            {/* Glass reflection */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
