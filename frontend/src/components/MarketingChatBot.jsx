// components/MarketingChatBot.jsx
// The same Artha assistant from inside the CRM (components/HelpBot.jsx),
// transplanted onto the public marketing site — same avatar, same panel,
// same message/typing/chip styling, same "Artha - Help Assistant" header.
// What's genuinely different: no login, so no page-aware live-data copilot,
// no guided tours (they target [data-tour] elements that only exist inside
// the authenticated app), no support tickets, no CRM write actions. Talks to
// POST /api/public/chat instead of /help/ask — a separate endpoint with a
// marketing-only knowledge base and zero access to any customer's CRM data
// (see backend/utils/openai.js MARKETING_SYSTEM_PROMPT). Rendered once from
// PublicNav so it appears on every marketing page with no per-page wiring.
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Send, ArrowRight, Sparkles, MessageCircle, ChevronDown } from "lucide-react";
import { usePublicTheme } from "../context/PublicThemeContext";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";

// Exact values from styles.css's :root / :root.dark --app-* tokens, so this
// panel matches the real in-app HelpBot pixel-for-pixel regardless of
// whether the marketing site's own theme toggle happens to also flip the
// CRM's .dark class (it doesn't — PublicThemeContext is a separate system).
const THEME = {
  light: { bg: "#f0ede8", surfaceLow: "rgba(255,255,255,0.38)", text: "#18181b", textSoft: "#5f5f66", border: "rgba(160,65,0,0.12)" },
  dark:  { bg: "#111113", surfaceLow: "rgba(22,21,24,0.68)",   text: "#ededed", textSoft: "#969696", border: "rgba(255,255,255,0.10)" },
};
const PRIMARY = "#ff6b00";

const QUICK_QUESTIONS = [
  "What does Arthaleads do?",
  "Is there a free trial?",
  "How much does it cost?",
  "How do I contact support?",
];

const GREETING = "Hi! I'm Artha 👋 Ask me anything about Arthaleads - features, pricing, or how it works for your team.";

function CtaChip({ cta }) {
  if (cta === "signup") {
    return (
      <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
        style={{ background: "rgba(255,107,0,0.10)", color: PRIMARY, border: "1px solid rgba(255,107,0,0.25)" }}>
        Start Free Trial <ArrowRight className="h-3 w-3" />
      </a>
    );
  }
  if (cta === "pricing") {
    return (
      <Link to="/pricing"
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
        style={{ background: "rgba(255,107,0,0.10)", color: PRIMARY, border: "1px solid rgba(255,107,0,0.25)" }}>
        See Pricing <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }
  if (cta === "contact") {
    return (
      <Link to="/contact"
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
        style={{ background: "rgba(255,107,0,0.10)", color: PRIMARY, border: "1px solid rgba(255,107,0,0.25)" }}>
        Contact Us <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }
  return null;
}

export default function MarketingChatBot() {
  const { isDark } = usePublicTheme();
  const t = isDark ? THEME.dark : THEME.light;

  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'bot', text, cta?}
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showCommonQ, setShowCommonQ] = useState(false);
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async (e, overrideText) => {
    e?.preventDefault();
    const question = (overrideText ?? input).trim();
    if (!question || loading) return;
    if (!overrideText) setInput("");

    const historyToSend = messages.slice(-6).map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      text: m.text || "",
    }));

    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
      const res = await fetch(`${apiBase}/api/public/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: historyToSend }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((m) => [...m, { role: "bot", text: data.answer, cta: data.cta }]);
      } else {
        setMessages((m) => [...m, { role: "bot", text: data.message || "Something went wrong - please try again.", cta: "contact" }]);
      }
    } catch {
      setMessages((m) => [...m, {
        role: "bot",
        text: "Couldn't reach the server. Please try again, or email contact@arthaleads.com / WhatsApp +91 80801 97945.",
        cta: "contact",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => { setMessages([]); setShowCommonQ(false); };

  return (
    <>
      {/* Floating button with pulse ring — exact match to the in-app HelpBot launcher */}
      {!open && (
        <div className="fixed z-[997]" style={{ right: 20, bottom: `calc(20px + env(safe-area-inset-bottom, 0px))` }}>
          <span className="absolute inset-0 rounded-full animate-ping pointer-events-none" style={{ background: "rgba(255,107,0,0.35)" }} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open chat assistant"
            className="relative rounded-full shadow-lg transition hover:scale-105 cursor-pointer overflow-hidden"
            style={{ width: 56, height: 56, background: t.bg }}
          >
            <img src="/ai-avatar2.png" alt="Chat assistant" className="w-full h-full object-cover" />
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-[998] flex flex-col overflow-hidden shadow-2xl"
          style={{
            right: "max(12px, env(safe-area-inset-right))",
            bottom: `calc(12px + env(safe-area-inset-bottom, 0px))`,
            width: "min(390px, calc(100vw - 24px))",
            height: "min(580px, calc(100vh - 80px))",
            background: t.bg,
            border: `1px solid ${t.border}`,
            borderRadius: 20,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${t.border}`, background: "linear-gradient(to right, rgba(255,107,0,0.08), transparent)" }}>
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full overflow-hidden">
                <img src="/ai-avatar2.png" alt="Artha" className="w-full h-full object-cover" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 bg-green-500" style={{ borderColor: t.bg }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight" style={{ color: t.text }}>Artha - Help Assistant</p>
              <p className="text-[11px] text-green-500 leading-tight font-medium">Online - Ask me anything</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button type="button" onClick={resetChat} aria-label="Back to home" title="Back to quick answers"
                  className="p-1.5 rounded-lg transition cursor-pointer" style={{ color: t.textSoft }}>
                  <MessageCircle className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="p-1.5 rounded-lg transition cursor-pointer" style={{ color: t.textSoft }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2 items-start">
                  <img src="/ai-avatar2.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 object-cover" />
                  <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm" style={{ background: t.surfaceLow, color: t.text }}>
                    {GREETING}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {QUICK_QUESTIONS.map((q) => (
                    <button key={q} type="button" onClick={() => send(null, q)} disabled={loading}
                      className="w-full text-left rounded-xl px-3 py-2 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                      style={{ border: `1px solid ${t.border}`, color: t.text }}>
                      <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: PRIMARY }} />
                      <span className="min-w-0 flex-1 text-xs font-medium">{q}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: t.textSoft }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start gap-2 items-start"}>
                {m.role === "bot" && (
                  <img src="/ai-avatar2.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 object-cover" />
                )}
                <div className="max-w-[80%]">
                  <div
                    className={`rounded-2xl px-3 py-2.5 text-sm whitespace-pre-line ${m.role === "bot" ? "rounded-tl-sm" : "rounded-tr-sm"}`}
                    style={m.role === "user" ? { background: PRIMARY, color: "#fff" } : { background: t.surfaceLow, color: t.text }}
                  >
                    {m.text}
                  </div>
                  {m.role === "bot" && m.cta && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <CtaChip cta={m.cta} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start gap-2 items-start">
                <img src="/ai-avatar2.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 object-cover" />
                <div className="rounded-2xl rounded-tl-sm px-3 py-2.5" style={{ background: t.surfaceLow }}>
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "0ms", color: t.text }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "150ms", color: t.text }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "300ms", color: t.text }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={send} className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Arthaleads..."
              maxLength={500}
              disabled={loading}
              className="flex-1 rounded-full px-4 py-2 text-sm focus:outline-none"
              style={{ background: t.surfaceLow, border: `1px solid ${t.border}`, color: t.text }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full shrink-0 cursor-pointer disabled:opacity-50 transition hover:opacity-90"
              style={{ background: PRIMARY, color: "#fff" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
