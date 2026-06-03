import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HelpCircle, X, Send, ArrowRight, Sparkles, MessageCircle, Compass, House } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { QUICK_ANSWERS, TOURS } from "../data/helpData";
import GuidedTour from "./GuidedTour";

export default function HelpBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'bot', text, goto?, tour?}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTour, setActiveTour] = useState(null); // steps[] when a tour is running
  const [showWelcome, setShowWelcome] = useState(false); // first-login tour offer
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Offer the dashboard tour once, on the user's first visit after this feature ships.
  const welcomeKey = user?._id ? `al_tour_offered_${user._id}` : null;
  useEffect(() => {
    if (!welcomeKey) return;
    if (localStorage.getItem(welcomeKey)) return;
    const t = setTimeout(() => setShowWelcome(true), 1500); // let the page settle first
    return () => clearTimeout(t);
  }, [welcomeKey]);

  const dismissWelcome = () => {
    if (welcomeKey) localStorage.setItem(welcomeKey, "1");
    setShowWelcome(false);
  };

  const acceptWelcome = () => {
    dismissWelcome();
    startTour("dashboard");
  };

  const startTour = (tourKey) => {
    const tour = TOURS[tourKey];
    if (!tour) return;
    setOpen(false);
    const launch = () => setActiveTour(tour.steps);
    if (tour.path && location.pathname !== tour.path) {
      navigate(tour.path);
      setTimeout(launch, 600); // let the page mount
    } else {
      setTimeout(launch, 150);
    }
  };

  const handleQuick = (item) => {
    setMessages((m) => [
      ...m,
      { role: "user", text: item.q },
      { role: "bot", text: item.a, goto: item.goto, tour: item.tour },
    ]);
  };

  const handleGoto = (path) => { setOpen(false); navigate(path); };

  const handleAsk = async (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const { data } = await api.post("/help/ask", { question: q, page: location.pathname });
      setMessages((m) => [...m, { role: "bot", text: data.answer }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role: "bot",
        text: err.response?.data?.message || "Sorry, I couldn't reach the assistant. Try one of the quick questions below, or visit the Help Guide.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* First-login tour offer — appears once above the help button */}
      {showWelcome && !open && !activeTour && (
        <div
          className="fixed z-[997] card p-4 shadow-2xl"
          style={{
            right: "max(16px, env(safe-area-inset-right))",
            bottom: `calc(84px + env(safe-area-inset-bottom, 0px))`,
            width: "min(300px, calc(100vw - 32px))",
            background: "var(--app-bg)", border: "1px solid var(--app-border)", borderRadius: 18,
          }}
        >
          <button type="button" onClick={dismissWelcome} aria-label="Dismiss"
            className="absolute right-3 top-3 text-app-soft hover:text-app transition cursor-pointer">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ background: "rgba(255,107,0,0.14)" }}>
              <Sparkles className="h-4 w-4" style={{ color: "var(--app-primary, #ff6b00)" }} />
            </div>
            <p className="text-sm font-bold text-app">Welcome to Arthaleads! 👋</p>
          </div>
          <p className="text-xs text-app-soft leading-relaxed mb-3">
            New here? Take a 30-second tour and I’ll show you where everything is on your dashboard.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={acceptWelcome}
              className="btn-primary flex-1 rounded-lg px-3 py-1.5 text-xs cursor-pointer flex items-center justify-center gap-1">
              <Compass className="h-3.5 w-3.5" /> Take the tour
            </button>
            <button type="button" onClick={dismissWelcome}
              className="btn-secondary rounded-lg px-3 py-1.5 text-xs cursor-pointer">
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open help assistant"
          className="fixed z-[997] flex items-center justify-center rounded-full shadow-lg transition hover:scale-105 cursor-pointer"
          style={{
            right: 20,
            bottom: `calc(20px + env(safe-area-inset-bottom, 0px))`,
            width: 52, height: 52,
            background: "var(--app-primary, #ff6b00)", color: "#fff",
          }}
        >
          <HelpCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed z-[998] flex flex-col overflow-hidden shadow-2xl"
          style={{
            right: "max(12px, env(safe-area-inset-right))",
            bottom: `calc(12px + env(safe-area-inset-bottom, 0px))`,
            left: "auto",
            width: "min(380px, calc(100vw - 24px))",
            height: "min(560px, calc(100vh - 80px))",
            background: "var(--app-bg)",
            border: "1px solid var(--app-border)",
            borderRadius: 20,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--app-border)", background: "linear-gradient(to right, rgba(255,107,0,0.08), transparent)" }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0" style={{ background: "rgba(255,107,0,0.14)" }}>
              <Sparkles className="h-4 w-4" style={{ color: "var(--app-primary, #ff6b00)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-app leading-tight">Help Assistant</p>
              <p className="text-[11px] text-app-soft leading-tight">Ask anything about the CRM</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} aria-label="Back to FAQs"
                className="text-app-soft hover:text-app transition cursor-pointer mr-1" title="Back to quick answers">
                <House className="h-4.5 w-4.5" />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-app-soft hover:text-app transition cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl px-3 py-2.5 text-sm text-app" style={{ background: "var(--app-surface-low)" }}>
                  👋 Hi! Confused about where something is or how to do it? Tap a question below, ask me anything, or take a quick guided tour.
                </div>

                {/* Guided tour buttons */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TOURS).map(([key, t]) => (
                    <button key={key} type="button" onClick={() => startTour(key)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition"
                      style={{ background: "rgba(99,102,241,0.10)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                      <Compass className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-wider text-app-soft px-1 pt-1">Popular questions</p>
                <div className="space-y-1.5">
                  {QUICK_ANSWERS.map((item) => (
                    <button key={item.id} type="button" onClick={() => handleQuick(item)}
                      className="w-full text-left rounded-xl px-3 py-2 text-sm text-app transition cursor-pointer flex items-center gap-2 hover:bg-orange-500/5"
                      style={{ border: "1px solid var(--app-border)" }}>
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-app-soft" />
                      <span className="min-w-0 flex-1">{item.q}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-app-soft" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[85%]">
                  <div className="rounded-2xl px-3 py-2.5 text-sm whitespace-pre-line"
                    style={m.role === "user"
                      ? { background: "var(--app-primary, #ff6b00)", color: "#fff" }
                      : { background: "var(--app-surface-low)", color: "var(--app-text)" }}>
                    {m.text}
                  </div>
                  {/* Action buttons under bot answers */}
                  {m.role === "bot" && (m.goto || m.tour) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.goto && (
                        <button type="button" onClick={() => handleGoto(m.goto)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
                          style={{ background: "rgba(255,107,0,0.10)", color: "var(--app-primary, #ff6b00)", border: "1px solid rgba(255,107,0,0.25)" }}>
                          Take me there <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                      {m.tour && TOURS[m.tour] && (
                        <button type="button" onClick={() => startTour(m.tour)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
                          style={{ background: "rgba(99,102,241,0.10)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                          <Compass className="h-3 w-3" /> Start tour
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleAsk} className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--app-border)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about the CRM…"
              className="input flex-1 rounded-full text-sm"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full shrink-0 cursor-pointer disabled:opacity-50"
              style={{ background: "var(--app-primary, #ff6b00)", color: "#fff" }}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Guided tour overlay */}
      {activeTour && <GuidedTour steps={activeTour} onClose={() => setActiveTour(null)} />}
    </>
  );
}
