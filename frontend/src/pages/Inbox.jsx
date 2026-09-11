import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  AlertTriangle, Bot, Check, CheckCheck, Clock, ExternalLink,
  Plus, RefreshCw, Send, Settings, User, Wallet, X, Zap,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import WhatsAppIcon from "../components/WhatsAppIcon";
import CreditTopUpModal from "../components/CreditTopUpModal";
import TemplateSendModal from "../components/TemplateSendModal";
import { StatusBadge } from "../components/UI";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
// Every date here is shown in IST. The server runs UTC and a browser can be
// anywhere; an Indian sales team reading "yesterday" should mean their day.
const TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });

function fmtClock(d) {
  if (!d) return "";
  return new Date(d)
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ })
    .replace(/am|pm/i, (m) => m.toUpperCase());
}

function fmtListTime(d) {
  if (!d) return "";
  const k = dayKey(d);
  if (k === dayKey(new Date())) return fmtClock(d);
  if (k === dayKey(Date.now() - 86400000)) return "Yesterday";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ });
}

function dayLabel(d) {
  const k = dayKey(d);
  if (k === dayKey(new Date())) return "Today";
  if (k === dayKey(Date.now() - 86400000)) return "Yesterday";
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  if (/^\+?\d[\d\s]*$/.test(s)) return s.replace(/\D/g, "").slice(-2);
  const parts = s.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// ₹ in the units an Indian property buyer talks in.
function inr(n) {
  if (n >= 1e7) return `${+(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${+(n / 1e5).toFixed(1)} L`;
  return n.toLocaleString("en-IN");
}

function budgetText(b) {
  const min = b?.min || 0, max = b?.max || 0;
  if (min && max) return `₹${inr(min)}–${inr(max)}`;
  if (max) return `up to ₹${inr(max)}`;
  if (min) return `from ₹${inr(min)}`;
  return "";
}

// What the lead is looking for, from the lead record itself.
function leadContext(lead) {
  if (!lead) return "";
  const bhk = lead.bhk && lead.bhk !== "N/A" ? lead.bhk : "";
  const want = [bhk, lead.propertyType].filter(Boolean).join(" ");
  return [want, lead.preferredLocation, budgetText(lead.budget)].filter(Boolean).join(" · ");
}

function fmtLeft(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function MessageStatus({ status }) {
  if (status === "read")      return <CheckCheck className="w-3 h-3 text-blue-500" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-app-soft" />;
  if (status === "failed")    return <AlertTriangle className="w-3 h-3" style={{ color: "#ef4444" }} />;
  return <Check className="w-3 h-3 text-app-soft" />;
}

// ── Conversation list item ───────────────────────────────────────────────────
function ConvItem({ conv, active, onClick }) {
  const name = conv.contactName || conv.contactPhone;
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 pl-3 pr-4 py-3 text-left transition border-b ${active ? "" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"}`}
      style={{
        borderColor: "var(--app-border)",
        borderLeft: `3px solid ${active ? "var(--app-primary)" : "transparent"}`,
        background: active ? "rgba(var(--app-primary-rgb),0.07)" : undefined,
      }}>
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
          {initials(name)}
        </div>
        {conv.botEnabled && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "#22c55e", border: "2px solid var(--app-card-solid)" }}>
            <Bot className="w-2 h-2 text-white" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-app truncate">{name}</p>
          <span className="text-[10px] text-app-soft shrink-0">{fmtListTime(conv.lastMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-app-soft truncate">{conv.lastMessagePreview || "No messages yet"}</p>
          {conv.unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
              style={{ background: "#25D366", color: "#fff" }}>
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isOut = msg.direction === "outbound";
  const isBot = msg.sender === "bot";
  const isAgent = isOut && msg.sender === "agent";
  return (
    <div className={`flex flex-col ${isOut ? "items-end" : "items-start"} mb-3`}>
      {isBot && (
        <p className="text-[10px] font-bold text-green-600 mb-1 px-1 flex items-center gap-1">
          <Bot className="w-3 h-3" /> Bot
        </p>
      )}
      {isAgent && msg.senderName && (
        <p className="text-[10px] font-bold mb-1 px-1 flex items-center gap-1.5" style={{ color: "#3a7d1f" }}>
          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] shrink-0"
            style={{ background: "rgba(58,125,31,0.18)" }}>
            {initials(msg.senderName).slice(0, 1)}
          </span>
          {msg.senderName}
        </p>
      )}
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${isOut ? "rounded-tr-[4px]" : "rounded-tl-[4px]"}`}
        style={isOut
          ? { background: "#dcf8c6", color: "#111" }
          : { background: "var(--app-card-solid)", color: "var(--app-text)", border: "1px solid var(--app-border)" }}>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
      </div>
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[10px] text-app-soft">{fmtClock(msg.timestamp)}</span>
        {isOut && <MessageStatus status={msg.status} />}
      </div>
    </div>
  );
}

const FILTERS = [["all", "All"], ["bot", "Bot"], ["open", "Open"], ["resolved", "Done"]];

// ── Main inbox page ──────────────────────────────────────────────────────────
export default function Inbox() {
  useEffect(() => { document.title = "Inbox - Arthaleads CRM"; }, []);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId]         = useState(null);
  const [messages, setMessages]         = useState([]);
  // undefined = not loaded yet (show nothing), null = they have never written.
  const [lastInboundAt, setLastInbound] = useState(undefined);
  const [msgInput, setMsgInput]         = useState("");
  const [sending, setSending]           = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [filter, setFilter]             = useState("all");
  const [showTopUp, setShowTopUp]       = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  // Connection and credit balance both live in ConversationsLayout, so every
  // page under /conversations reads one consistent answer.
  const { credits, refreshCredits, isAdmin, channel } = useOutletContext();
  const threadRef = useRef(null);
  const pollRef   = useRef(null);

  const activeConv = conversations.find((c) => c._id === activeId);
  // Template sending goes through Meta's template API, which only the direct
  // Meta connection has.
  const isMeta = channel?.provider === "meta";

  // Free monthly replies count as spendable — a tenant on zero balance can
  // still use those before anything is blocked.
  const freeLeft = credits?.freeService?.remaining || 0;
  const canSend = !credits
    || credits.availablePaise >= (credits.ratesPaise?.service || 0)
    || freeLeft > 0;

  // WhatsApp's customer-service window: a normal reply is only allowed within
  // 24 hours of the customer's last message. After that, only a template.
  const windowLeft = lastInboundAt ? DAY_MS - (Date.now() - new Date(lastInboundAt).getTime()) : 0;
  const windowKnown = lastInboundAt !== undefined;
  const windowOpen = windowLeft > 0;

  const fetchConvs = useCallback(async (silent = false) => {
    if (!silent) setLoadingConvs(true);
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const { data } = await api.get("/whatsapp/conversations", { params });
      setConversations(data.conversations || []);
    } catch {}
    finally { setLoadingConvs(false); }
  }, [filter]);

  useEffect(() => { fetchConvs(); }, [fetchConvs]);

  // Arrived from "Message from CRM Inbox" on a lead — the conversation may be
  // brand new, so fetch it directly instead of waiting for it to appear in a
  // (possibly filtered) list.
  useEffect(() => {
    const openId = location.state?.openConversationId;
    if (!openId) return;
    navigate(location.pathname, { replace: true, state: {} });
    api.get(`/whatsapp/conversations/${openId}`)
      .then(({ data }) => {
        setConversations((prev) => (prev.some((c) => c._id === openId) ? prev : [data.conversation, ...prev]));
        selectConv(openId);
      })
      .catch(() => toast.error("Could not open that conversation"));
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const iv = setInterval(() => fetchConvs(true), 4000);
    return () => clearInterval(iv);
  }, [fetchConvs]);

  const fetchMessages = useCallback(async (id, silent = false) => {
    if (!id) return;
    if (!silent) setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/whatsapp/conversations/${id}/messages`);
      setMessages(data.messages || []);
      setLastInbound(data.lastInboundAt ?? null);
      setConversations((prev) => prev.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)));
    } catch {}
    finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    if (activeId) {
      fetchMessages(activeId);
      clearInterval(pollRef.current);
      pollRef.current = setInterval(() => fetchMessages(activeId, true), 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [activeId, fetchMessages]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  // Day separators, grouped on IST calendar days.
  const threadItems = useMemo(() => {
    const out = [];
    let last = null;
    for (const m of messages) {
      const k = dayKey(m.timestamp);
      if (k !== last) { out.push({ sep: dayLabel(m.timestamp), key: `sep-${k}` }); last = k; }
      out.push(m);
    }
    return out;
  }, [messages]);

  const selectConv = (id) => {
    setActiveId(id);
    setMessages([]);
    setLastInbound(undefined);
    setMsgInput("");
  };

  const needCredits = () => {
    toast.error("Out of WhatsApp credits — top up to keep sending.");
    setShowTopUp(true);
    refreshCredits();
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeId || sending) return;
    const text = msgInput.trim();
    setMsgInput("");
    setSending(true);
    const temp = { _id: "tmp_" + Date.now(), direction: "outbound", sender: "agent", senderName: user.name, body: text, status: "sent", timestamp: new Date() };
    setMessages((prev) => [...prev, temp]);
    try {
      const { data } = await api.post("/whatsapp/send", { conversationId: activeId, body: text });
      setMessages((prev) => prev.map((m) => (m._id === temp._id ? data.message : m)));
      refreshCredits();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m._id !== temp._id));
      setMsgInput(text);
      // 402 is the credit cap, not a failure — nothing was sent or charged.
      if (e.response?.status === 402) needCredits();
      else if (e.response?.data?.code === "WINDOW_CLOSED") {
        toast.error(e.response.data.message, { duration: 8000 });
        fetchMessages(activeId, true);
      } else {
        toast.error(e.response?.data?.message || "Message failed to send.");
      }
    } finally { setSending(false); }
  };

  const onTemplateSent = (message) => {
    if (message) setMessages((prev) => [...prev, message]);
    setConversations((prev) => prev.map((c) => (c._id === activeId
      ? { ...c, lastMessageAt: message?.timestamp || new Date(), lastMessagePreview: (message?.body || "").slice(0, 80) }
      : c)));
    refreshCredits();
  };

  const toggleBot = async () => {
    if (!activeConv) return;
    const next = !activeConv.botEnabled;
    const { data } = await api.patch(`/whatsapp/conversations/${activeId}`, { botEnabled: next });
    setConversations((prev) => prev.map((c) => (c._id === activeId ? { ...c, ...data.conversation } : c)));
  };

  const lead = activeConv?.leadId;
  const priorityText = lead?.priority
    ? (lead.priority === "Hot" ? "Hot lead" : `${lead.priority} priority`)
    : "";
  const wants = leadContext(lead);
  const firstName = String(activeConv?.contactName || "").trim().split(/\s+/)[0] || "they";
  const composerHint = freeLeft > 0
    ? `${freeLeft.toLocaleString("en-IN")} free replies left this month`
    : credits?.ratesPaise?.service
      ? `₹${(credits.ratesPaise.service / 100).toFixed(2)} per reply`
      : "";

  // Meta refuses free-form outside the window, so the composer becomes a
  // template button. Other providers keep the box, with a warning.
  const templateOnly = windowKnown && !windowOpen && isMeta;

  return (
    <>
    <div className="h-full mx-4 sm:mx-6 lg:mx-8 mb-4 flex overflow-hidden rounded-[1.25rem]"
      style={{ border: "1px solid var(--app-border)", background: "var(--app-surface)" }}>

      {/* ── Left: conversation list ── */}
      <div className={`flex flex-col ${activeId ? "hidden md:flex" : "flex"} w-full md:w-[320px] shrink-0`}
        style={{ borderRight: "1px solid var(--app-border)" }}>

        <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5 shrink-0" style={{ color: "#25D366" }} />
            <span className="text-sm font-bold text-app">Inbox</span>
          </div>
          <div className="flex items-center gap-1">
            {credits && (
              <button onClick={() => setShowTopUp(true)} title="WhatsApp credits — click to top up"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition mr-1"
                style={canSend
                  ? { background: "rgba(34,197,94,0.12)", color: "#15803d", border: "1px solid rgba(34,197,94,0.25)" }
                  : { background: "rgba(239,68,68,0.10)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.3)" }}>
                <Wallet className="w-3 h-3" />
                ₹{(credits.availablePaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </button>
            )}
            {/* Only an admin can save WhatsApp settings; hide the gear rather
                than open a page that cannot be saved. */}
            {isAdmin && (
              <button onClick={() => navigate("/conversations/settings")} title="WhatsApp settings"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition">
                <Settings className="w-3.5 h-3.5 text-app-soft" />
              </button>
            )}
            <button onClick={() => fetchConvs()} title="Refresh"
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition">
              <RefreshCw className="w-3.5 h-3.5 text-app-soft" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--app-border)" }}>
          {FILTERS.map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition"
              style={filter === val
                ? { background: "var(--app-primary)", color: "#fff" }
                : { color: "var(--app-text-soft)" }}>
              {label}
              {val === "bot" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs && conversations.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--app-primary)", borderTopColor: "transparent" }} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
              <WhatsAppIcon className="w-8 h-8 text-app-soft opacity-40" />
              <p className="text-sm text-app-soft">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConvItem key={conv._id} conv={conv} active={conv._id === activeId} onClick={() => selectConv(conv._id)} />
            ))
          )}
        </div>
      </div>

      {/* ── Right: thread ── */}
      {!activeId ? (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <WhatsAppIcon className="w-12 h-12 text-app-soft opacity-20" />
          <p className="text-sm text-app-soft">Select a conversation to start chatting</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--app-border)" }}>
            <button className="md:hidden p-1 rounded-lg hover:bg-black/5" onClick={() => setActiveId(null)} title="Back to list">
              <X className="w-4 h-4 text-app-soft" />
            </button>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
              {initials(activeConv?.contactName || activeConv?.contactPhone)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-app truncate">{activeConv?.contactName || activeConv?.contactPhone}</p>
                {lead?.status && <StatusBadge status={lead.status} />}
                {priorityText && <span className="text-[11px] text-app-soft">· {priorityText}</span>}
              </div>
              <p className="text-[11px] text-app-soft truncate">
                +{activeConv?.contactPhone}{wants ? ` · ${wants}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={toggleBot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition"
                style={activeConv?.botEnabled
                  ? { background: "rgba(34,197,94,0.12)", color: "#15803d", border: "1px solid rgba(34,197,94,0.3)" }
                  : { background: "var(--app-surface-low)", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
                {activeConv?.botEnabled ? <><Bot className="w-3 h-3" /> Bot ON</> : <><User className="w-3 h-3" /> Manual</>}
              </button>
              {lead && (
                <button onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })} title="Open lead"
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition">
                  <ExternalLink className="w-4 h-4 text-app-soft" />
                </button>
              )}
            </div>
          </div>

          <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ background: "var(--app-bg)" }}>
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#25D366", borderTopColor: "transparent" }} />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-app-soft py-12">No messages yet. Start the conversation!</div>
            ) : (
              threadItems.map((item) => (item.sep ? (
                <div key={item.key} className="flex justify-center my-3">
                  <span className="text-[10px] font-semibold px-3 py-1 rounded-full text-app-soft"
                    style={{ background: "var(--app-card-solid)", border: "1px solid var(--app-border)" }}>
                    {item.sep}
                  </span>
                </div>
              ) : <Bubble key={item._id} msg={item} />))
            )}
          </div>

          <div className="px-4 pt-3 pb-2 shrink-0" style={{ borderTop: "1px solid var(--app-border)" }}>
            {activeConv?.status === "resolved" ? (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-app-soft">
                <Check className="w-4 h-4" /> Conversation resolved
                <button onClick={() => api.patch(`/whatsapp/conversations/${activeId}`, { status: "open" }).then(() => fetchConvs())}
                  className="text-xs font-semibold hover:underline" style={{ color: "var(--app-primary)" }}>Reopen</button>
              </div>
            ) : !canSend ? (
              // Out of credits. The thread stays readable — inbound is free and
              // still arriving, so hiding it would only lose the context the
              // tenant is paying to get back.
              <div className="flex items-center justify-center gap-3 py-2.5 flex-wrap">
                <span className="flex items-center gap-1.5 text-sm text-app-soft">
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#b45309" }} />
                  Out of credits — you can read, but not reply.
                </span>
                <button onClick={() => setShowTopUp(true)}
                  className="btn-primary rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add credits
                </button>
              </div>
            ) : templateOnly ? (
              <div className="flex items-center justify-between gap-3 py-1.5 flex-wrap rounded-2xl px-3.5"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.3)" }}>
                <span className="flex items-start gap-2 text-xs py-1.5" style={{ color: "#b45309" }}>
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    {lastInboundAt
                      ? `More than 24 hours since ${firstName} last wrote. WhatsApp only allows an approved template until they reply.`
                      : `${firstName === "they" ? "This person has" : `${firstName} has`} not written to you yet. WhatsApp only allows an approved template to start a conversation.`}
                  </span>
                </span>
                <button onClick={() => setShowTemplate(true)}
                  className="btn-primary rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <Zap className="w-3.5 h-3.5" /> Send a template
                </button>
              </div>
            ) : (
              <>
                {windowKnown && !windowOpen && (
                  <p className="text-[11px] mb-2 px-1 flex items-start gap-1.5" style={{ color: "#b45309" }}>
                    <Clock className="w-3.5 h-3.5 shrink-0 mt-px" />
                    More than 24 hours since they last wrote — WhatsApp will only deliver an approved
                    template. Send one from your provider's dashboard.
                  </p>
                )}
                <div className="flex items-end gap-2">
                  {isMeta && (
                    <button onClick={() => setShowTemplate(true)} title="Send a template"
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-80"
                      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                      <Zap className="w-4 h-4" style={{ color: "#f59e0b" }} />
                    </button>
                  )}
                  <textarea
                    rows={1}
                    className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm text-app outline-none"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", maxHeight: 120, minHeight: 42 }}
                    placeholder="Type a message…"
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  />
                  <button onClick={sendMessage} disabled={!msgInput.trim() || sending} title="Send"
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-40"
                    style={{ background: msgInput.trim() ? "#25D366" : "var(--app-surface-low)" }}>
                    <Send className={`w-4 h-4 ${msgInput.trim() ? "text-white" : "text-app-soft"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1.5 px-1 text-[10px] text-app-soft">
                  <span className="truncate">
                    {composerHint}
                    {windowOpen && (
                      <span style={windowLeft < 2 * 3600000 ? { color: "#b45309" } : undefined}>
                        {composerHint ? " · " : ""}reply window closes in {fmtLeft(windowLeft)}
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:inline shrink-0">Enter to send · Shift + Enter for a new line</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>

    <CreditTopUpModal open={showTopUp} onClose={() => setShowTopUp(false)} onSuccess={refreshCredits} />

    {isMeta && activeConv && (
      <TemplateSendModal
        open={showTemplate}
        onClose={() => setShowTemplate(false)}
        conversation={activeConv}
        credits={credits}
        onSent={onTemplateSent}
        onNeedCredits={needCredits}
      />
    )}
    </>
  );
}
