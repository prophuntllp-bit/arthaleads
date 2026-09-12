import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  AlertTriangle, Bot, Check, CheckCheck, ChevronDown, Clock, ExternalLink,
  Plus, RefreshCw, Search, Send, Settings, User, UserCheck, Wallet, X, Zap,
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

// WhatsApp does not expose a customer's profile photo: the webhook carries only
// `profile.name`, and the Cloud API has no endpoint for a contact's picture —
// reading one needs an unofficial WhatsApp-Web bridge, which risks the WABA.
// So the avatar is a deterministic colour per phone number instead, which at
// least makes threads distinguishable at a glance the way a photo would.
const AVATAR_TINTS = [
  ["#c2410c", "rgba(194,65,12,0.13)"],   ["#0369a1", "rgba(3,105,161,0.13)"],
  ["#15803d", "rgba(21,128,61,0.13)"],   ["#7e22ce", "rgba(126,34,206,0.13)"],
  ["#a16207", "rgba(161,98,7,0.14)"],    ["#be123c", "rgba(190,18,60,0.12)"],
  ["#0f766e", "rgba(15,118,110,0.13)"],  ["#4338ca", "rgba(67,56,202,0.13)"],
];

function avatarTint(seed) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [fg, bg] = AVATAR_TINTS[h % AVATAR_TINTS.length];
  return { color: fg, background: bg };
}

function Avatar({ name, seed, size = 40, badge = null }) {
  const tint = avatarTint(seed || name);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full flex items-center justify-center font-bold"
        style={{ ...tint, fontSize: size <= 32 ? 10 : 12 }}>
        {initials(name)}
      </div>
      {badge}
    </div>
  );
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

// A linked lead's name is the live, editable source of truth; contactName is a
// snapshot taken the moment the conversation was created (or a WhatsApp profile
// name Meta sent us) and never updates again on its own — so if the two
// disagree, the lead wins. This is also what keeps a conversation's displayed
// name correct after a lead gets renamed, or after a mis-linked conversation is
// relinked to the right lead.
const displayName = (conv) => conv?.leadId?.name || conv?.contactName || conv?.contactPhone;

// ── Conversation list item ───────────────────────────────────────────────────
function ConvItem({ conv, active, onClick }) {
  const name = displayName(conv);
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 pl-3 pr-4 py-3 text-left transition border-b ${active ? "" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"}`}
      style={{
        borderColor: "var(--app-border)",
        borderLeft: `3px solid ${active ? "var(--app-primary)" : "transparent"}`,
        background: active ? "rgba(var(--app-primary-rgb),0.07)" : undefined,
      }}>
      <Avatar name={name} seed={conv.contactPhone} badge={conv.botEnabled && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: "#22c55e", border: "2px solid var(--app-card-solid)" }}>
          <Bot className="w-2 h-2 text-white" />
        </span>
      )} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-app truncate">{name}</p>
          <span className="text-[10px] text-app-soft shrink-0">{fmtListTime(conv.lastMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-app-soft truncate">{conv.lastMessagePreview || "No messages yet"}</p>
          {conv.unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
              style={{ background: "var(--app-primary)", color: "#fff" }}>
              {conv.unreadCount}
            </span>
          )}
        </div>
        {conv.assignedTo?.name && (
          <p className="text-[10px] text-app-soft truncate mt-0.5 flex items-center gap-1">
            <UserCheck className="w-2.5 h-2.5 shrink-0" />
            {conv.assignedTo.name}
          </p>
        )}
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
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${isOut ? "rounded-tr-[4px] wa-bubble-out" : "rounded-tl-[4px] wa-bubble-in"}`}>
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
  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal]               = useState(0);
  // The list is sorted by lastMessageAt, which reorders as messages arrive, so
  // offset paging would duplicate and drop rows between polls. Growing one
  // window instead keeps every already-loaded thread stable.
  const [limit, setLimit]               = useState(50);

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
      const params = { limit };
      if (filter !== "all") params.status = filter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const { data } = await api.get("/whatsapp/conversations", { params });
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
    } catch {}
    finally { setLoadingConvs(false); }
  }, [filter, debouncedSearch, limit]);

  useEffect(() => { fetchConvs(); }, [fetchConvs]);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A new search or filter starts from the first window again.
  useEffect(() => { setLimit(50); }, [debouncedSearch, filter]);

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

  // Claiming a thread is the one assignment action that needs no team picker,
  // and it is the one an agent actually reaches for.
  const claimConv = async () => {
    if (!activeConv) return;
    const mine = activeConv.assignedTo?._id === user._id;
    try {
      const { data } = await api.patch(`/whatsapp/conversations/${activeId}`,
        { assignedTo: mine ? null : user._id });
      setConversations((prev) => prev.map((c) => (c._id === activeId ? { ...c, ...data.conversation } : c)));
      toast.success(mine ? "Released — now unassigned" : "Assigned to you");
    } catch {
      toast.error("Could not change who this is assigned to");
    }
  };

  const lead = activeConv?.leadId;
  const priorityText = lead?.priority
    ? (lead.priority === "Hot" ? "Hot lead" : `${lead.priority} priority`)
    : "";
  const wants = leadContext(lead);
  const firstName = String(displayName(activeConv) || "").trim().split(/\s+/)[0] || "they";
  const composerHint = credits?.billedDirectlyByMeta
    ? "Billed directly to your Meta account, not through credits"
    : freeLeft > 0
      ? `${freeLeft.toLocaleString("en-IN")} free replies left this month`
      : credits?.ratesPaise?.service
        ? `₹${(credits.ratesPaise.service / 100).toFixed(2)} per reply`
        : "";

  // Meta refuses free-form outside the window, so the composer becomes a
  // template button. Other providers keep the box, with a warning.
  const templateOnly = windowKnown && !windowOpen && isMeta;

  return (
    <>
    {/* Full-bleed chat panel: CLAUDE.md's stitch-page exception, which owns its
        own internal padding rather than skipping the class entirely. */}
    <div className="stitch-page !p-0 h-full">
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

        <div className="px-4 pt-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-app-soft pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="w-full rounded-full pr-8 py-1.5 text-xs text-app outline-none"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", paddingLeft: 30 }}
            />
            {search && (
              <button onClick={() => setSearch("")} title="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                <X className="w-3 h-3 text-app-soft" />
              </button>
            )}
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
              <p className="text-sm text-app-soft">
                {debouncedSearch ? `No conversations match "${debouncedSearch}"` : "No conversations yet"}
              </p>
            </div>
          ) : (
            <>
              {conversations.map((conv) => (
                <ConvItem key={conv._id} conv={conv} active={conv._id === activeId} onClick={() => selectConv(conv._id)} />
              ))}
              {conversations.length < total && (
                <button onClick={() => setLimit((l) => l + 50)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                  style={{ color: "var(--app-primary)" }}>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Load older ({total - conversations.length} more)
                </button>
              )}
            </>
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
            <Avatar name={displayName(activeConv)} seed={activeConv?.contactPhone} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-app truncate">{displayName(activeConv)}</p>
                {lead?.status && <StatusBadge status={lead.status} />}
                {priorityText && <span className="text-[11px] text-app-soft">· {priorityText}</span>}
              </div>
              <p className="text-[11px] text-app-soft truncate">
                +{activeConv?.contactPhone}{wants ? ` · ${wants}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={claimConv}
                title={activeConv?.assignedTo ? `Assigned to ${activeConv.assignedTo.name}` : "Nobody is handling this yet"}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition max-w-[170px]"
                style={activeConv?.assignedTo
                  ? { background: "rgba(var(--app-primary-rgb),0.10)", color: "var(--app-primary)", border: "1px solid rgba(var(--app-primary-rgb),0.28)" }
                  : { background: "var(--app-surface-low)", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
                <UserCheck className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {activeConv?.assignedTo
                    ? (activeConv.assignedTo._id === user._id ? "You" : activeConv.assignedTo.name)
                    : "Assign to me"}
                </span>
              </button>
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

          <div ref={threadRef} className="wa-thread flex-1 overflow-y-auto px-4 py-3">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--app-primary)", borderTopColor: "transparent" }} />
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
                  {/* Always WhatsApp green. It used to go grey on an empty
                      composer, which read as a broken button rather than a
                      disabled one — dimming the green says the same thing
                      without losing the affordance. */}
                  <button onClick={sendMessage} disabled={!msgInput.trim() || sending} title="Send"
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-45"
                    style={{ background: "#25D366" }}>
                    <Send className="w-4 h-4 text-white" />
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
