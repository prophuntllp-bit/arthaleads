import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Send, ArrowRight, Sparkles, MessageCircle, Compass, House, TicketCheck, ChevronDown, Paperclip, Zap, CheckCircle2, XCircle } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCopilot } from "../context/CopilotContext";
import { QUICK_ANSWERS, TOURS } from "../data/helpData";
import GuidedTour from "./GuidedTour";

const TICKET_CATEGORIES = [
  { value: "general",         label: "General question" },
  { value: "technical",       label: "Technical issue / bug" },
  { value: "billing",         label: "Billing / plan" },
  { value: "feature-request", label: "Feature request" },
];

export default function HelpBot() {
  const [open, setOpen] = useState(false);
  // {role:'user'|'bot', text, goto?, tour?, suggestTicket?, comingSoon?}
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTour, setActiveTour] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  // Ticket panel state
  const [ticketPanel, setTicketPanel] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketCategory, setTicketCategory] = useState("general");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketFiles, setTicketFiles] = useState([]); // [{name, size, url(base64)}]
  const fileInputRef = useRef(null);

  const { user } = useAuth();
  const { focusedLead } = useCopilot();
  const navigate = useNavigate();
  const location = useLocation();
  const [actionLoading, setActionLoading] = useState(null); // messageIndex being confirmed
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, ticketPanel]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && !ticketPanel) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, ticketPanel]);

  // First-login tour offer
  const welcomeKey = user?._id ? `al_tour_offered_${user._id}` : null;
  useEffect(() => {
    if (!welcomeKey) return;
    if (localStorage.getItem(welcomeKey)) return;
    const t = setTimeout(() => setShowWelcome(true), 1500);
    return () => clearTimeout(t);
  }, [welcomeKey]);

  const dismissWelcome = () => {
    if (welcomeKey) localStorage.setItem(welcomeKey, "1");
    setShowWelcome(false);
  };
  const acceptWelcome = () => { dismissWelcome(); startTour("dashboard"); };

  const startTour = (tourKey) => {
    const tour = TOURS[tourKey];
    if (!tour) return;
    setOpen(false);
    const launch = () => setActiveTour(tour.steps);
    if (tour.path && location.pathname !== tour.path) {
      navigate(tour.path);
      setTimeout(launch, 600);
    } else {
      setTimeout(launch, 150);
    }
  };

  const handleQuick = (item) => {
    setMessages((m) => [
      ...(m.length === 0 ? [greetingMsg] : []),
      ...m,
      { role: "user", text: item.q },
      { role: "bot", text: item.a, goto: item.goto, tour: item.tour },
    ]);
  };

  const handleGoto = (path) => { setOpen(false); navigate(path); };

  const firstName = user?.name?.split(" ")[0]?.trim() || "there";

  const greetingMsg = { role: "bot", text: `Hi ${firstName}! I'm Artha, your CRM assistant. How can I help you today?` };

  const handleAsk = async (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...(m.length === 0 ? [greetingMsg] : []), ...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const { data } = await api.post("/help/ask", {
        question: q,
        page: location.pathname,
        userName: user?.name,
        leadId: focusedLead?._id || "",
      });
      setMessages((m) => [...m, {
        role: "bot",
        text: data.answer,
        suggestTicket: data.suggestTicket,
        comingSoon: data.comingSoon,
        action: data.action || null,
        actionDone: false,
      }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role: "bot",
        text: err.response?.data?.message || "Sorry, I couldn't reach the assistant. Try one of the quick questions or raise a support ticket.",
        suggestTicket: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Open ticket panel, pre-fill subject from last user message
  const openTicket = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    setTicketSubject(lastUserMsg?.text?.slice(0, 200) || "");
    setTicketDesc("");
    setTicketCategory("general");
    setTicketPanel(true);
  };

  const closeTicket = () => { setTicketPanel(false); setTicketFiles([]); inputRef.current?.focus(); };

  const handleFileSelect = (e) => {
    const MAX_FILES = 3;
    const MAX_BYTES = 600 * 1024;
    const files = Array.from(e.target.files || []).slice(0, MAX_FILES - ticketFiles.length);
    const valid = files.filter((f) => f.size <= MAX_BYTES);
    if (valid.length < files.length) alert("Some files exceed 600 KB and were skipped.");
    Promise.all(valid.map((f) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, size: f.size, url: reader.result });
      reader.readAsDataURL(f);
    }))).then((results) => setTicketFiles((prev) => [...prev, ...results].slice(0, MAX_FILES)));
    e.target.value = "";
  };

  const removeFile = (idx) => setTicketFiles((prev) => prev.filter((_, i) => i !== idx));

  const submitTicket = async () => {
    if (!ticketSubject.trim() || !ticketDesc.trim() || ticketSubmitting) return;
    setTicketSubmitting(true);
    try {
      const { data } = await api.post("/tickets", {
        subject: ticketSubject.trim(),
        description: ticketDesc.trim(),
        category: ticketCategory,
        priority: "medium",
        attachments: ticketFiles,
      });
      setTicketPanel(false);
      setTicketFiles([]);
      setMessages((m) => [...m, {
        role: "bot",
        text: `Ticket ${data.ticket.ticketNumber} raised! We'll get back to you at ${user?.email || "your email"} within 24 hours. You can track it in Settings > Support.`,
      }]);
    } catch {
      setMessages((m) => [...m, {
        role: "bot",
        text: "Couldn't raise the ticket right now. Please try again in a moment.",
      }]);
      setTicketPanel(false);
    } finally {
      setTicketSubmitting(false);
    }
  };

  const resetChat = () => { setMessages([]); setTicketPanel(false); };

  const confirmAction = async (msgIndex) => {
    const msg = messages[msgIndex];
    if (!msg?.action || actionLoading !== null) return;
    setActionLoading(msgIndex);
    try {
      const { data } = await api.post("/help/action", { type: msg.action.type, params: msg.action.params });
      setMessages((m) => m.map((x, i) => i === msgIndex ? { ...x, actionDone: true } : x));
      setMessages((m) => [...m, { role: "bot", text: `Done! ${data.message}` }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "bot", text: err.response?.data?.message || "Action failed. Please try again." }]);
    } finally {
      setActionLoading(null);
    }
  };

  const cancelAction = (msgIndex) => {
    setMessages((m) => m.map((x, i) => i === msgIndex ? { ...x, actionDone: true } : x));
    setMessages((m) => [...m, { role: "bot", text: "No problem, no changes were made." }]);
  };

  return (
    <>
      {/* First-login welcome bubble */}
      {showWelcome && !open && !activeTour && (
        <div
          className="fixed z-[997] card p-4 shadow-2xl"
          style={{
            right: "max(16px, env(safe-area-inset-right))",
            bottom: `calc(88px + env(safe-area-inset-bottom, 0px))`,
            width: "min(300px, calc(100vw - 32px))",
            background: "var(--app-bg)", border: "1px solid var(--app-border)", borderRadius: 18,
          }}
        >
          <button type="button" onClick={dismissWelcome} aria-label="Dismiss"
            className="absolute right-3 top-3 text-app-soft hover:text-app transition cursor-pointer">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
              <img src="/ai-avatar.png" alt="" className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-bold text-app">Welcome to Arthaleads!</p>
          </div>
          <p className="text-xs text-app-soft leading-relaxed mb-3">
            New here? Take a 30-second tour and I'll show you where everything is on your dashboard.
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

      {/* Floating button with pulse ring */}
      {!open && (
        <div
          className="fixed z-[997]"
          style={{ right: 20, bottom: `calc(20px + env(safe-area-inset-bottom, 0px))` }}
        >
          <span
            className="absolute inset-0 rounded-full animate-ping pointer-events-none"
            style={{ background: "rgba(255,107,0,0.35)" }}
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open help assistant"
            className="relative rounded-full shadow-lg transition hover:scale-105 cursor-pointer overflow-hidden"
            style={{ width: 56, height: 56, background: "var(--app-surface)" }}
          >
            <img src="/ai-avatar.png" alt="Help Assistant" className="w-full h-full object-cover" />
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
            background: "var(--app-bg)",
            border: "1px solid var(--app-border)",
            borderRadius: 20,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--app-border)", background: "linear-gradient(to right, rgba(255,107,0,0.08), transparent)" }}
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full overflow-hidden">
                <img src="/ai-avatar.png" alt="Artha" className="w-full h-full object-cover" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 bg-green-500" style={{ borderColor: "var(--app-bg)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-app leading-tight">Artha · Help Assistant</p>
              {focusedLead ? (
                <p className="text-[11px] leading-tight font-medium flex items-center gap-1" style={{ color: "#6366f1" }}>
                  <Zap className="h-2.5 w-2.5" /> Copilot · {focusedLead.name}
                </p>
              ) : (
                <p className="text-[11px] text-green-500 leading-tight font-medium">Online · Ask me anything</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button type="button" onClick={resetChat} aria-label="Back to home"
                  title="Back to quick answers"
                  className="p-1.5 rounded-lg text-app-soft hover:text-app hover:bg-black/5 transition cursor-pointer">
                  <House className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="p-1.5 rounded-lg text-app-soft hover:text-app hover:bg-black/5 transition cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                {/* Intro bubble */}
                <div className="flex gap-2 items-start">
                  <img src="/ai-avatar.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 object-cover" />
                  <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-app" style={{ background: "var(--app-surface-low)" }}>
                    Hi {user?.name?.split(" ")[0] || "there"}! I'm Artha, your CRM assistant. Tap a question below, ask me anything, or take a guided tour.
                  </div>
                </div>

                {/* Tour buttons */}
                <div className="flex flex-wrap gap-2 pl-9">
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
                      className="w-full text-left rounded-xl px-3 py-2 text-sm text-app transition cursor-pointer flex items-center gap-2 hover:bg-orange-500/5 min-w-0"
                      style={{ border: "1px solid var(--app-border)" }}>
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-app-soft" />
                      <span className="min-w-0 flex-1">{item.q}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-app-soft" />
                    </button>
                  ))}
                </div>

                {/* Raise ticket from home */}
                <button type="button" onClick={openTicket}
                  className="w-full text-left rounded-xl px-3 py-2 text-sm transition cursor-pointer flex items-center gap-2 hover:bg-orange-500/5"
                  style={{ border: "1px solid var(--app-border)", color: "var(--app-primary, #ff6b00)" }}>
                  <TicketCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 font-medium">Raise a support ticket</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start gap-2 items-start"}>
                {m.role === "bot" && (
                  <img src="/ai-avatar.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 object-cover" />
                )}
                <div className="max-w-[80%]">
                  {/* Coming Soon badge */}
                  {m.comingSoon && (
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: "rgba(255,107,0,0.12)", color: "var(--app-primary, #ff6b00)", border: "1px solid rgba(255,107,0,0.25)" }}>
                      <Sparkles className="h-2.5 w-2.5" /> Coming Soon
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2.5 text-sm whitespace-pre-line ${m.role === "bot" ? "rounded-tl-sm" : "rounded-tr-sm"}`}
                    style={m.role === "user"
                      ? { background: "var(--app-primary, #ff6b00)", color: "#fff" }
                      : { background: "var(--app-surface-low)", color: "var(--app-text)" }}
                  >
                    {m.text}
                  </div>
                  {/* Action chips */}
                  {m.role === "bot" && (m.goto || m.tour || m.suggestTicket || (m.action && !m.actionDone)) && (
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
                      {m.suggestTicket && (
                        <button type="button" onClick={openTicket}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
                          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <TicketCheck className="h-3 w-3" /> Raise a ticket
                        </button>
                      )}
                      {m.action && !m.actionDone && (() => {
                        const idx = messages.indexOf(m);
                        const isLoading = actionLoading === idx;
                        return (
                          <>
                            <button type="button" onClick={() => confirmAction(idx)} disabled={isLoading}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-60"
                              style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }}>
                              {isLoading ? (
                                <span className="h-2.5 w-2.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {isLoading ? "Working…" : `Do it — ${m.action.label}`}
                            </button>
                            <button type="button" onClick={() => cancelAction(idx)} disabled={isLoading}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-60"
                              style={{ background: "rgba(239,68,68,0.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.18)" }}>
                              <XCircle className="h-3 w-3" /> Cancel
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start gap-2 items-start">
                <img src="/ai-avatar.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 object-cover" />
                <div className="rounded-2xl rounded-tl-sm px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ticket form (replaces input when open) */}
          {ticketPanel ? (
            <div className="shrink-0 px-3 pt-3 pb-3 space-y-2" style={{ borderTop: "1px solid var(--app-border)" }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <TicketCheck className="h-4 w-4" style={{ color: "var(--app-primary, #ff6b00)" }} />
                  <p className="text-sm font-bold text-app">Raise a Support Ticket</p>
                </div>
                <button type="button" onClick={closeTicket} className="text-app-soft hover:text-app cursor-pointer">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <input
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Subject"
                maxLength={200}
                className="input w-full rounded-xl text-sm"
              />
              <textarea
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
                placeholder="Describe your issue in detail…"
                maxLength={2000}
                rows={3}
                className="input w-full rounded-xl text-sm resize-none"
              />
              {/* File attachments */}
              <div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileSelect} />
                {ticketFiles.length < 3 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs cursor-pointer transition text-app-soft hover:text-app">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach screenshot or file (max 600 KB, up to 3)
                  </button>
                )}
                {ticketFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ticketFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                        <span className="truncate max-w-[90px] text-app">{f.name}</span>
                        <button type="button" onClick={() => removeFile(i)}
                          className="text-app-soft hover:text-red-500 cursor-pointer shrink-0">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="input w-full rounded-xl text-sm appearance-none pr-8 cursor-pointer"
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-soft pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={submitTicket}
                  disabled={!ticketSubject.trim() || !ticketDesc.trim() || ticketSubmitting}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                >
                  {ticketSubmitting ? (
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-bounce" style={{ animationDelay: "150ms" }} />
                    </span>
                  ) : (
                    <><Send className="h-3.5 w-3.5" /> Submit</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Chat input */
            <form onSubmit={handleAsk} className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--app-border)" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about the CRM…"
                className="input flex-1 rounded-full text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="flex h-9 w-9 items-center justify-center rounded-full shrink-0 cursor-pointer disabled:opacity-50 transition hover:opacity-90"
                style={{ background: "var(--app-primary, #ff6b00)", color: "#fff" }}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}

      {/* Guided tour overlay */}
      {activeTour && <GuidedTour steps={activeTour} onClose={() => setActiveTour(null)} />}
    </>
  );
}
