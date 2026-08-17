// components/MarketingChatBot.jsx
// Floating pre-sales assistant for the public marketing site. Talks to
// POST /api/public/chat — no login, no CRM data access, knowledge-base only
// (see backend/utils/openai.js MARKETING_SYSTEM_PROMPT). Rendered once from
// PublicNav so it appears on every marketing page without per-page wiring.
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X, Send, Bot, ArrowRight } from "lucide-react";
import { usePublicTheme } from "../context/PublicThemeContext";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";

const QUICK_QUESTIONS = [
  "What does Arthaleads do?",
  "Is there a free trial?",
  "How much does it cost?",
  "How do I contact support?",
];

const WELCOME_TEXT =
  "Hi! I'm Artha 👋 Ask me anything about Arthaleads — features, pricing, or how it works for your team.";

function CtaButton({ cta }) {
  if (cta === "signup") {
    return (
      <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
        className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: "#ff6b00", color: "#fff" }}>
        Start Free Trial <ArrowRight className="w-3 h-3" />
      </a>
    );
  }
  if (cta === "pricing") {
    return (
      <Link to="/pricing"
        className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: "rgba(255,107,0,0.12)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.3)" }}>
        See Pricing <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  if (cta === "contact") {
    return (
      <Link to="/contact"
        className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: "rgba(255,107,0,0.12)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.3)" }}>
        Contact Us <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  return null;
}

export default function MarketingChatBot() {
  const { isDark } = usePublicTheme();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([{ role: "bot", text: WELCOME_TEXT, cta: null }]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const listRef  = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const panelBg     = isDark ? "#12121e" : "#ffffff";
  const panelBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const headerBg    = isDark ? "#0d0d1a" : "#fff7f0";
  const heading     = isDark ? "#ffffff" : "#111827";
  const body        = isDark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const botBubbleBg = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const inputBg     = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "#d1d5db";

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
      const res = await fetch(`${apiBase}/api/public/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((m) => [...m, { role: "bot", text: data.answer, cta: data.cta }]);
      } else {
        setMessages((m) => [...m, { role: "bot", text: data.message || "Something went wrong — please try again.", cta: "contact" }]);
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

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed z-[9990] flex items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-105"
        style={{
          right: 24, bottom: 96, width: 56, height: 56,
          background: "linear-gradient(135deg, #ff6b00, #ffaa00)",
          boxShadow: "0 8px 28px rgba(255,107,0,0.45)",
        }}
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed z-[9989] flex flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{
            right: 24, bottom: 164,
            width: "min(370px, calc(100vw - 32px))",
            height: "min(520px, calc(100vh - 220px))",
            background: panelBg,
            border: `1px solid ${panelBorder}`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: headerBg, borderBottom: `1px solid ${panelBorder}` }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #ff6b00, #ffaa00)" }}>
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight" style={{ color: heading }}>Artha</p>
              <p className="text-[11px] leading-tight" style={{ color: body }}>Ask about Arthaleads</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                  style={
                    m.role === "user"
                      ? { background: "#ff6b00", color: "#fff", borderBottomRightRadius: 4 }
                      : { background: botBubbleBg, color: heading, borderBottomLeftRadius: 4 }
                  }
                >
                  {m.text}
                  {m.role === "bot" && m.cta && <div><CtaButton cta={m.cta} /></div>}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-3 flex items-center gap-1" style={{ background: botBubbleBg, borderBottomLeftRadius: 4 }}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: body, animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick questions — only before the conversation starts */}
            {messages.length === 1 && !loading && (
              <div className="flex flex-col gap-1.5 pt-1">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="text-left text-xs px-3 py-2 rounded-xl transition-colors"
                    style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: body }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,107,0,0.4)"; e.currentTarget.style.color = "#ff6b00"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = panelBorder; e.currentTarget.style.color = body; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: `1px solid ${panelBorder}` }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Type a question…"
              disabled={loading}
              maxLength={500}
              className="flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff6b00]/40"
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: heading }}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex-shrink-0 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40"
              style={{ width: 38, height: 38, background: "#ff6b00" }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
