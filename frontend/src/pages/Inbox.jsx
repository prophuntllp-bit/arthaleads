import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, Check, CheckCheck, ChevronRight, ExternalLink,
  MessageCircle, Phone, RefreshCw, Send, User, Wifi, WifiOff, X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000)  return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function MessageStatus({ status }) {
  if (status === "read")      return <CheckCheck className="w-3 h-3 text-blue-400" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-app-soft" />;
  return <Check className="w-3 h-3 text-app-soft" />;
}

// ── Conversation List Item ────────────────────────────────────────────────────
function ConvItem({ conv, active, onClick }) {
  const name = conv.contactName || conv.contactPhone;
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b ${active ? "bg-orange-500/10" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"}`}
      style={{ borderColor: "var(--app-border)" }}>
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
          {name?.[0]?.toUpperCase() || "?"}
        </div>
        {conv.botEnabled && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "#22c55e", border: "2px solid var(--app-surface)" }}>
            <Bot className="w-2 h-2 text-white" />
          </span>
        )}
      </div>
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-app truncate">{name}</p>
          <span className="text-[10px] text-app-soft shrink-0">{fmt(conv.lastMessageAt)}</span>
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

// ── Message Bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isOut = msg.direction === "outbound";
  const isBot = msg.sender === "bot";
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 relative ${isOut ? "rounded-tr-sm" : "rounded-tl-sm"}`}
        style={isOut
          ? { background: isBot ? "rgba(34,197,94,0.15)" : "#dcf8c6", color: "#111" }
          : { background: "var(--app-surface-low)", color: "var(--app-text)" }}>
        {isBot && (
          <p className="text-[9px] font-bold text-green-600 mb-0.5 flex items-center gap-1">
            <Bot className="w-2.5 h-2.5" /> Bot
          </p>
        )}
        <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">{msg.body}</p>
        <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] opacity-60">{fmt(msg.timestamp)}</span>
          {isOut && <MessageStatus status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// ── Main Inbox Page ───────────────────────────────────────────────────────────
export default function Inbox() {
  useEffect(() => { document.title = "Inbox - Arthaleads CRM"; }, []);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [connected, setConnected]       = useState(null); // null=loading
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId]         = useState(null);
  const [messages, setMessages]         = useState([]);
  const [msgInput, setMsgInput]         = useState("");
  const [sending, setSending]           = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [filter, setFilter]             = useState("all"); // all | bot | open | resolved
  const threadRef = useRef(null);
  const pollRef   = useRef(null);

  const activeConv = conversations.find(c => c._id === activeId);

  // Check if WhatsApp is connected
  useEffect(() => {
    api.get("/whatsapp/settings")
      .then(r => setConnected(r.data.connected))
      .catch(() => setConnected(false));
  }, []);

  // Fetch conversations
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

  // Poll conversations every 4s
  useEffect(() => {
    const iv = setInterval(() => fetchConvs(true), 4000);
    return () => clearInterval(iv);
  }, [fetchConvs]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (id, silent = false) => {
    if (!id) return;
    if (!silent) setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/whatsapp/conversations/${id}/messages`);
      setMessages(data.messages || []);
      // Update unread count in list
      setConversations(prev => prev.map(c => c._id === id ? { ...c, unreadCount: 0 } : c));
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  const selectConv = (id) => {
    setActiveId(id);
    setMessages([]);
    setMsgInput("");
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeId || sending) return;
    const text = msgInput.trim();
    setMsgInput("");
    setSending(true);
    // Optimistic
    const temp = { _id: "tmp_" + Date.now(), direction: "outbound", sender: "agent", senderName: user.name, body: text, status: "sent", timestamp: new Date() };
    setMessages(prev => [...prev, temp]);
    try {
      const { data } = await api.post("/whatsapp/send", { conversationId: activeId, body: text });
      setMessages(prev => prev.map(m => m._id === temp._id ? data.message : m));
    } catch (e) {
      setMessages(prev => prev.filter(m => m._id !== temp._id));
      setMsgInput(text);
    } finally { setSending(false); }
  };

  const toggleBot = async () => {
    if (!activeConv) return;
    const next = !activeConv.botEnabled;
    const { data } = await api.patch(`/whatsapp/conversations/${activeId}`, { botEnabled: next });
    setConversations(prev => prev.map(c => c._id === activeId ? { ...c, ...data.conversation } : c));
  };

  // ── Not connected state ───────────────────────────────────────────────────
  if (connected === false) {
    return (
      <div className="stitch-page flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)" }}>
          <MessageCircle className="w-8 h-8" style={{ color: "#25D366" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-app mb-2">WhatsApp not connected</h2>
          <p className="text-sm text-app-soft max-w-xs">Connect your WhatsApp Business number in Settings to start using the Inbox.</p>
        </div>
        <button onClick={() => navigate("/settings")}
          className="btn-primary px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2">
          Go to Settings <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (connected === null) return null;

  return (
    <div className="stitch-page !p-0 h-[calc(100vh-4rem)] flex overflow-hidden rounded-[1.25rem]"
      style={{ border: "1px solid var(--app-border)", background: "var(--app-surface)" }}>

      {/* ── Left panel: conversation list ── */}
      <div className={`flex flex-col ${activeId ? "hidden md:flex" : "flex"} w-full md:w-[320px] lg:w-[360px] shrink-0`}
        style={{ borderRight: "1px solid var(--app-border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 shrink-0" style={{ color: "#25D366" }} />
            <span className="text-sm font-bold text-app">Inbox</span>
          </div>
          <button onClick={() => fetchConvs()} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition">
            <RefreshCw className="w-3.5 h-3.5 text-app-soft" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2" style={{ borderBottom: "1px solid var(--app-border)" }}>
          {[["all","All"],["bot","Bot"],["open","Open"],["resolved","Done"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition ${filter === val ? "text-white" : "text-app-soft hover:text-app"}`}
              style={filter === val ? { background: "var(--app-primary)" } : {}}>
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs && conversations.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--app-primary)", borderTopColor: "transparent" }} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
              <MessageCircle className="w-8 h-8 text-app-soft opacity-40" />
              <p className="text-sm text-app-soft">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <ConvItem key={conv._id} conv={conv} active={conv._id === activeId} onClick={() => selectConv(conv._id)} />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: chat thread ── */}
      {!activeId ? (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MessageCircle className="w-12 h-12 text-app-soft opacity-20" />
          <p className="text-sm text-app-soft">Select a conversation to start chatting</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col min-w-0">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--app-border)" }}>
            <button className="md:hidden p-1 rounded-lg hover:bg-black/5" onClick={() => setActiveId(null)}>
              <X className="w-4 h-4 text-app-soft" />
            </button>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
              {(activeConv?.contactName || activeConv?.contactPhone)?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-app truncate">
                {activeConv?.contactName || activeConv?.contactPhone}
              </p>
              <p className="text-[11px] text-app-soft">
                +{activeConv?.contactPhone}
                {activeConv?.leadId && (
                  <span> · <span className="text-orange-500">{activeConv.leadId.status}</span></span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Bot toggle */}
              <button onClick={toggleBot}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition`}
                style={activeConv?.botEnabled
                  ? { background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }
                  : { background: "rgba(var(--app-primary-rgb),0.08)", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
                {activeConv?.botEnabled ? <><Bot className="w-3 h-3" /> Bot ON</> : <><User className="w-3 h-3" /> Manual</>}
              </button>
              {/* Open lead */}
              {activeConv?.leadId && (
                <button onClick={() => navigate("/leads", { state: { openLeadId: activeConv.leadId._id } })}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition" title="Open Lead">
                  <ExternalLink className="w-4 h-4 text-app-soft" />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3"
            style={{ background: "var(--app-bg)" }}>
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#25D366", borderTopColor: "transparent" }} />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-app-soft py-12">No messages yet. Start the conversation!</div>
            ) : (
              messages.map(msg => <Bubble key={msg._id} msg={msg} />)
            )}
          </div>

          {/* Composer */}
          <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--app-border)" }}>
            {activeConv?.status === "resolved" ? (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-app-soft">
                <Check className="w-4 h-4" /> Conversation resolved
                <button onClick={() => api.patch(`/whatsapp/conversations/${activeId}`, { status: "open" }).then(() => fetchConvs())}
                  className="text-orange-500 hover:underline text-xs font-semibold">Reopen</button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm text-app outline-none"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", maxHeight: 120, minHeight: 42 }}
                  placeholder="Type a message…"
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                />
                <button onClick={sendMessage} disabled={!msgInput.trim() || sending}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-40"
                  style={{ background: msgInput.trim() ? "#25D366" : "var(--app-surface-low)" }}>
                  <Send className={`w-4 h-4 ${msgInput.trim() ? "text-white" : "text-app-soft"}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
