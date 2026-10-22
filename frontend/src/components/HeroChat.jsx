// components/HeroChat.jsx - the hero's phone: a 1 AM WhatsApp enquiry answered
// by the AI agent, from first message to booked site visit.
//
// It plays once on load (typing dots, then each bubble), then rests on the
// finished conversation. The first message is there from the first paint, the
// end state is fully readable, and reduced motion shows the whole chat at once.
// Names, project and prices are an illustration, like the product clips.
import { useEffect, useRef, useState } from "react";
import { CheckCheck, CalendarCheck2, Sparkles } from "lucide-react";

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

export default function HeroChat() {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduced ? SCRIPT.length : 1);
  const [typing, setTyping] = useState(false);
  const [live, setLive] = useState(false);   // starts once the phone is on screen (below the fold on phones)
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
    <div ref={rootRef} className="relative mx-auto w-full max-w-[330px]">
      <style>{`
        @keyframes hc-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
        .hc-in { animation: hc-in 320ms cubic-bezier(.2,.7,.2,1) both; }
        @keyframes hc-dot { 0%, 80%, 100% { opacity: .3; transform: none; } 40% { opacity: 1; transform: translateY(-2px); } }
        .hc-dot { animation: hc-dot 1s infinite; }
        @media (prefers-reduced-motion: reduce) { .hc-in, .hc-dot { animation: none; } }
      `}</style>

      {/* Phone */}
      <div className="relative rounded-[2.6rem] p-[10px] bg-[#111827] shadow-[0_40px_80px_-24px_rgba(120,60,10,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset]">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-[#efeae2]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-2.5 pb-1 bg-[#075e54] text-white text-[11px] font-semibold">
            <span>1:06</span>
            <span className="absolute left-1/2 -translate-x-1/2 top-2 w-20 h-[18px] rounded-full bg-[#111827]" aria-hidden="true" />
            <span className="opacity-80">5G</span>
          </div>
          {/* Chat header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#075e54] text-white">
            <span className="w-9 h-9 rounded-full bg-[#25d366] flex items-center justify-center text-[13px] font-bold shrink-0">RP</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight truncate">Raj Patil</p>
              <p className="text-[11px] opacity-80 truncate">Lead from Facebook ad · Aurum Heights</p>
            </div>
          </div>
          {/* AI banner */}
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-[#9a3412] bg-[#fff7ed] border-b border-[#fed7aa]">
            <Sparkles className="w-3.5 h-3.5" /> Arthaleads AI agent is replying
          </div>

          {/* Messages */}
          <div ref={bodyRef} className="h-[372px] overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}
            aria-label="Example WhatsApp conversation answered by the Arthaleads AI agent">
            <p className="self-center text-[10.5px] font-semibold text-[#54656f] bg-white/80 rounded-md px-2 py-0.5">TODAY</p>
            {msgs.map((m, i) => {
              if (m.who === "booked") {
                return (
                  <div key={i} className="hc-in self-stretch mt-1 rounded-xl bg-white border border-[#bbf7d0] px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[#15803d]">
                      <CalendarCheck2 className="w-4 h-4" /> Site visit booked
                    </div>
                    <p className="text-[12px] text-[#374151] mt-0.5">Sat, 11:00 AM · Aurum Heights</p>
                    <p className="text-[11.5px] text-[#6b7280] mt-1">Lead sent to Neha with budget, purpose and visit time. Nobody on the team was awake.</p>
                  </div>
                );
              }
              const mine = m.who === "ai";
              return (
                <div key={i} className={`hc-in max-w-[84%] ${mine ? "self-end" : "self-start"}`}>
                  <div className={`rounded-lg px-2.5 pt-1.5 pb-1 text-[13px] leading-snug shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${mine ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none"} text-[#111b21]`}>
                    {m.text}
                    <span className="float-right ml-2 mt-1.5 flex items-center gap-0.5 text-[10px] text-[#667781]">
                      {m.time}{mine && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </span>
                  </div>
                  {mine && m.options && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.options.map((o) => (
                        <span key={o} className={`flex-1 basis-[30%] whitespace-nowrap text-center text-[12px] font-semibold rounded-lg py-1.5 px-2 bg-white ${i === lastAi ? "text-[#008069]" : "text-[#8696a0]"}`}>{o}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {typing && (
              <div className="hc-in self-end rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2.5 flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((d) => <span key={d} className="hc-dot w-1.5 h-1.5 rounded-full bg-[#667781]" style={{ animationDelay: `${d * 160}ms` }} />)}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 px-2.5 py-2 bg-[#efeae2]">
            <span className="flex-1 h-9 rounded-full bg-white px-3 text-[12.5px] text-[#8696a0] flex items-center">Message</span>
            <span className="w-9 h-9 rounded-full bg-[#00a884]" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
